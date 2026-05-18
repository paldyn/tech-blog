---
title: "MySQL 리플리케이션 — 비동기·반동기·그룹 리플리케이션"
description: "MySQL 리플리케이션의 세 가지 방식(비동기, 반동기, 그룹 리플리케이션)의 작동 원리, GTID 기반 리플리케이션, 지연 모니터링, 방식 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 40
type: "knowledge"
category: "SQL"
tags: ["mysql", "replication", "async-replication", "semi-sync", "group-replication", "gtid", "ha", "고가용성"]
featured: false
draft: false
---

[지난 글](/posts/mysql-json-virtual-column/)에서 JSON 타입과 가상 컬럼으로 반정형 데이터를 처리하는 방법을 살펴봤습니다. 이번 글에서는 MySQL의 **리플리케이션(복제)** 세 가지 방식을 다룹니다. 리플리케이션은 읽기 확장, 백업, 고가용성(HA)의 핵심 기반입니다.

## 리플리케이션 기본 원리

MySQL 리플리케이션은 Source(Primary) 서버의 변경 사항을 **Binary Log(binlog)**에 기록하고, Replica(Secondary) 서버가 이를 읽어와 재실행하는 방식으로 동작합니다.

```sql
-- Source: binlog 설정 확인
SHOW VARIABLES LIKE 'log_bin';
SHOW VARIABLES LIKE 'binlog_format';  -- ROW 권장

-- Replica: 리플리케이션 상태 확인
SHOW REPLICA STATUS\G
-- Seconds_Behind_Source: 복제 지연 초
-- Replica_IO_Running: Yes (binlog 수신 중)
-- Replica_SQL_Running: Yes (이벤트 적용 중)
```

## 세 가지 리플리케이션 방식

![리플리케이션 방식 비교](/assets/posts/mysql-replication-async-semi-group-compare.svg)

### ① 비동기 리플리케이션 (기본값)

Source는 binlog를 전송하고 Replica의 수신 확인(ACK) 없이 즉시 COMMIT합니다.

```sql
-- 비동기 리플리케이션 확인
SHOW VARIABLES LIKE 'rpl_semi_sync_source_enabled';
-- OFF = 비동기 (기본)
```

Source 장애 시 아직 Replica에 전달되지 않은 트랜잭션이 있으면 데이터가 손실될 수 있습니다. 쓰기 성능이 가장 좋고 단순 **읽기 분산**이 목적이라면 적합합니다.

### ② 반동기 리플리케이션 (Semi-sync)

최소 한 개의 Replica가 binlog를 수신했음을 ACK로 보낼 때까지 Source의 COMMIT이 대기합니다.

```sql
-- Source에 플러그인 설치 (8.0.26+)
INSTALL PLUGIN rpl_semi_sync_source
  SONAME 'semisync_source.so';
SET GLOBAL rpl_semi_sync_source_enabled = 1;

-- Replica에 플러그인 설치
INSTALL PLUGIN rpl_semi_sync_replica
  SONAME 'semisync_replica.so';
SET GLOBAL rpl_semi_sync_replica_enabled = 1;

-- ACK 대기 타임아웃 (ms) — 초과 시 비동기로 자동 전환
SET GLOBAL rpl_semi_sync_source_timeout = 1000;
```

ACK 대기 시간만큼 쓰기 지연이 발생하지만, 네트워크가 정상이라면 데이터 손실 없이 페일오버가 가능합니다.

### ③ 그룹 리플리케이션 (MySQL Group Replication, MGR)

Paxos 기반 합의 프로토콜로 그룹 내 과반수 이상의 멤버가 승인한 트랜잭션만 COMMIT합니다.

```sql
-- 그룹 리플리케이션 설정 (my.cnf)
-- plugin_load_add='group_replication.so'
-- group_replication_group_name="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
-- group_replication_start_on_boot=ON

-- 첫 번째 멤버 부트스트랩
SET GLOBAL group_replication_bootstrap_group=ON;
START GROUP_REPLICATION;
SET GLOBAL group_replication_bootstrap_group=OFF;

-- 그룹 멤버 확인
SELECT * FROM performance_schema.replication_group_members;
```

Primary 장애 시 Secondary 중 하나가 자동으로 새 Primary로 선출됩니다. InnoDB Cluster를 구성하는 기반 기술이며 MySQL Shell로 관리합니다.

## GTID 기반 리플리케이션

![리플리케이션 설정](/assets/posts/mysql-replication-async-semi-group-setup.svg)

GTID(Global Transaction ID)는 모든 트랜잭션에 전역 고유 ID를 부여합니다. `source_uuid:transaction_number` 형식입니다.

```sql
-- GTID 활성화 (my.cnf)
-- gtid_mode=ON
-- enforce_gtid_consistency=ON

-- 현재 실행된 GTID 확인
SHOW VARIABLES LIKE 'gtid_executed';
-- 예: aaaaaa-bbbb-cccc:1-1000

-- GTID 기반 리플리케이션 연결
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='source.example.com',
  SOURCE_USER='replication_user',
  SOURCE_PASSWORD='password',
  SOURCE_AUTO_POSITION=1;  -- GTID 기반 자동 위치 결정

START REPLICA;
```

GTID가 없으면 페일오버 시 binlog 파일명과 위치를 수동으로 계산해야 합니다. GTID를 사용하면 `SOURCE_AUTO_POSITION=1` 하나로 자동 동기화됩니다.

## Binlog 포맷

```sql
-- binlog_format 3가지
-- STATEMENT: SQL 문 그대로 기록 (용량 작음, 비결정적 함수 문제)
-- ROW: 변경된 행 데이터 기록 (안전, 용량 큼)
-- MIXED: 기본 STATEMENT, 필요시 ROW (절충)

-- ROW 포맷 권장 이유
-- - RAND(), NOW(), UUID() 등 비결정적 함수에서도 안전
-- - 트리거/스토어드 프로시저 동작 일관성

SHOW VARIABLES LIKE 'binlog_format';
-- 8.0 기본값: ROW
```

## 리플리케이션 지연 모니터링

```sql
-- 실시간 지연 확인
SHOW REPLICA STATUS\G
-- Seconds_Behind_Source: 0이면 실시간 동기화

-- Performance Schema로 상세 지연 확인 (8.0+)
SELECT
  CHANNEL_NAME,
  SERVICE_STATE,
  LAST_QUEUED_TRANSACTION,
  LAST_APPLIED_TRANSACTION,
  APPLYING_TRANSACTION
FROM performance_schema.replication_applier_status_by_worker;

-- 멀티스레드 리플리케이션으로 지연 줄이기
SET GLOBAL replica_parallel_workers = 4;
SET GLOBAL replica_parallel_type = 'LOGICAL_CLOCK';
```

## 방식 선택 가이드

| 항목 | 비동기 | 반동기 | 그룹 리플리케이션 |
|---|---|---|---|
| RPO | > 0 (손실 가능) | ≈ 0 | = 0 |
| RTO | 수동 전환 | 수동 전환 | 자동 전환 |
| 쓰기 성능 | 최고 | 약간 낮음 | 가장 낮음 |
| 구성 복잡도 | 낮음 | 보통 | 높음 |
| 적합 환경 | 읽기 분산 | 단순 HA | 무중단 HA |

운영 환경에서는 최소 **GTID + 반동기** 조합으로 데이터 손실 위험을 줄이고, 엄격한 가용성이 필요하다면 **그룹 리플리케이션(InnoDB Cluster)**을 선택합니다.

---

**지난 글:** [MySQL JSON 타입과 가상 컬럼 — 반정형 데이터 처리](/posts/mysql-json-virtual-column/)

<br>
읽어주셔서 감사합니다. 😊
