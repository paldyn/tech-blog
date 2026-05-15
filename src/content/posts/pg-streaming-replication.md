---
title: "PostgreSQL 스트리밍 복제 — WAL 기반 고가용성"
description: "WAL 스트림으로 Primary에서 Standby로 변경을 전파하는 스트리밍 복제의 동작 원리, 동기·비동기 복제 설정, replication slot 관리, Hot Standby 읽기 분산 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["postgresql", "streaming-replication", "고가용성", "wal", "hot-standby", "replication-slot"]
featured: false
draft: false
---

[지난 글](/posts/pg-materialized-view/)에서 구체화 뷰로 쿼리 성능을 개선하는 방법을 살펴봤습니다. 이번에는 시스템 가용성 측면을 다룹니다. 단일 PostgreSQL 서버가 다운됐을 때 서비스를 이어받을 수 있는 **스트리밍 복제(Streaming Replication)** 를 분석합니다.

## WAL이 복제의 기반이 되는 이유

PostgreSQL은 모든 변경을 WAL(Write-Ahead Log)에 먼저 기록합니다. 트랜잭션 커밋 전에 WAL이 디스크에 플러시되므로, WAL 파일만 있으면 어느 시점이든 데이터를 복구할 수 있습니다.

스트리밍 복제는 이 WAL을 네트워크를 통해 Standby 서버로 전송합니다. Standby는 받은 WAL을 적용(Apply)해 Primary와 동일한 상태를 유지합니다.

![PostgreSQL 스트리밍 복제 아키텍처](/assets/posts/pg-streaming-replication-arch.svg)

## 설정 구성

![스트리밍 복제 핵심 설정](/assets/posts/pg-streaming-replication-config.svg)

### 1단계: Standby 초기 구성

```bash
# Primary에서 Base Backup 생성 (Standby 서버에서 실행)
pg_basebackup \
  -h primary_host \
  -U replicator \
  -D /var/lib/postgresql/data \
  --slot=standby1_slot \
  -R \          # recovery 설정 자동 생성
  -P            # 진행률 표시
```

`-R` 플래그가 `standby.signal` 파일을 생성하고 `postgresql.auto.conf`에 `primary_conninfo`를 기록합니다.

### 2단계: Standby 서버 시작

```bash
# postgresql.conf 확인 후 기동
pg_ctl start -D /var/lib/postgresql/data

# 복제 상태 확인 (Primary에서)
SELECT pid, application_name, state, sent_lsn, replay_lsn,
       (sent_lsn - replay_lsn) AS replay_lag
FROM   pg_stat_replication;
```

`state`가 `streaming`이면 정상입니다.

## 동기 vs 비동기 복제

스트리밍 복제의 **동기화 수준**을 설정에서 조절할 수 있습니다.

| 설정 | RPO | 쓰기 지연 | 데이터 손실 위험 |
|------|-----|-----------|-----------------|
| `synchronous_commit=on` | 0 | 왕복 지연 발생 | 없음 |
| `synchronous_commit=remote_write` | 거의 0 | 중간 | 매우 낮음 |
| `synchronous_commit=off` | 수 ms | 없음 | 수 ms치 손실 가능 |

금융 거래처럼 데이터 무손실이 필수라면 동기 복제를 사용하고, 쓰기 처리량이 중요한 서비스라면 비동기 복제로 지연을 줄입니다.

## Replication Slot 관리

Replication Slot은 Standby가 따라잡을 때까지 Primary가 WAL을 삭제하지 않도록 보장합니다.

```sql
-- 슬롯 생성 (pg_basebackup -R이 자동 처리)
SELECT pg_create_physical_replication_slot('standby1_slot');

-- 슬롯 상태 모니터링
SELECT slot_name, active, restart_lsn,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag_size
FROM   pg_replication_slots;
```

Standby가 장시간 연결 끊기면 슬롯이 WAL을 계속 보존해 **디스크가 가득 찰 위험**이 있습니다. `wal_keep_size`를 상한선으로 설정하거나, 필요 없는 슬롯은 `pg_drop_replication_slot()`으로 삭제해야 합니다.

## Hot Standby 읽기 분산

`hot_standby = on`을 설정한 Standby는 읽기 전용 쿼리를 처리합니다. 이를 이용해 읽기 부하를 분산할 수 있습니다.

```sql
-- Standby에서 실행 가능한 읽기 쿼리
SELECT AVG(amount)
FROM   orders
WHERE  created_at >= NOW() - INTERVAL '30 days';

-- 복제 지연 확인 (Standby에서 실행)
SELECT NOW() - pg_last_xact_replay_timestamp() AS replication_lag;
```

애플리케이션에서 `PgBouncer`, `HAProxy`, `Patroni` 같은 미들웨어를 통해 읽기는 Standby로, 쓰기는 Primary로 자동 라우팅할 수 있습니다.

## Failover 절차

Primary 장애 시 Standby를 Primary로 승격합니다.

```bash
# Standby를 Primary로 승격
pg_ctl promote -D /var/lib/postgresql/data

# 또는 SQL (PostgreSQL 12+)
SELECT pg_promote();
```

Patroni, Repmgr 같은 HA 매니저를 사용하면 장애 감지 → 승격 → DNS/VIP 전환을 자동으로 수행합니다.

---

**지난 글:** [PostgreSQL 구체화 뷰 — REFRESH 전략과 쿼리 최적화](/posts/pg-materialized-view/)

**다음 글:** [PostgreSQL 논리 복제 — 선택적 복제와 버전 업그레이드](/posts/pg-logical-replication/)

<br>
읽어주셔서 감사합니다. 😊
