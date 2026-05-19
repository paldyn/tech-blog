---
title: "MySQL GTID 리플리케이션 — 자동 포지션 추적과 무중단 Failover"
description: "Global Transaction Identifier(GTID)의 구조, 설정 방법, AUTO_POSITION 동작 원리, Failover 시나리오, GTID 제약 사항과 우회책을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["MySQL", "GTID", "리플리케이션", "Failover", "AUTO_POSITION", "고가용성"]
featured: false
draft: false
---

[지난 글](/posts/mysql-replication-async-semi-group/)에서 비동기·반동기·그룹 리플리케이션의 작동 원리를 살펴봤다. 전통적인 바이너리 로그 파일명 + 포지션 기반 리플리케이션은 Failover 시 정확한 포지션을 직접 지정해야 했고, 이 과정에서 실수가 발생하면 데이터가 유실되거나 중복 적용되는 문제가 생겼다. MySQL 5.6에 도입된 **GTID(Global Transaction Identifier)**는 모든 트랜잭션에 전역 고유 식별자를 부여해 이 복잡성을 근본적으로 해결한다.

## GTID란 무엇인가

GTID는 `source_uuid:transaction_id` 형식의 전역 식별자다. 소스 서버의 UUID와 단조 증가하는 시퀀스 번호를 결합해 어떤 서버에서 시작된 트랜잭션인지, 몇 번째 트랜잭션인지를 고유하게 표현한다.

```sql
-- GTID 형식 예시
aaaa-bbbb-cccc-dddd-eeee:1       -- 1번 트랜잭션
aaaa-bbbb-cccc-dddd-eeee:1-100   -- 1~100번 범위 (GTID Set)

-- 현재 서버의 UUID 확인
SELECT @@server_uuid;

-- 실행된 GTID 집합 확인
SELECT @@gtid_executed;

-- 아직 Purge되지 않은 GTID
SELECT @@gtid_purged;
```

각 서버는 `gtid_executed` 변수에 자신이 적용한 모든 GTID 집합을 기록한다. Replica가 Primary에 연결할 때 이 집합을 전달하면, Primary는 아직 Replica가 받지 못한 트랜잭션만 골라 전송한다. 파일명과 오프셋을 수동으로 계산할 필요가 없다.

![GTID 기반 리플리케이션 플로우](/assets/posts/mysql-gtid-replication-flow.svg)

## GTID 활성화 설정

GTID를 활성화하려면 Primary와 Replica 모두 `my.cnf`를 수정하고 재시작해야 한다.

```ini
# my.cnf — Primary & Replica 공통
[mysqld]
gtid_mode                = ON
enforce_gtid_consistency = ON
log_bin                  = ON
log_replica_updates      = ON   # MySQL 8.0+; 구버전은 log_slave_updates
binlog_format            = ROW  # GTID와 함께 ROW 권장
```

`enforce_gtid_consistency`는 GTID와 호환되지 않는 SQL 문(예: `CREATE TABLE … SELECT`, 비트랜잭셔널 테이블과 트랜잭셔널 테이블을 혼합한 DML)을 자동으로 차단한다. Replica에서 다음 명령으로 연결을 시작한다.

```sql
-- Replica에서 실행 (MySQL 8.0+ 문법)
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST     = '192.168.1.10',
  SOURCE_PORT     = 3306,
  SOURCE_USER     = 'repl_user',
  SOURCE_PASSWORD = 'password',
  SOURCE_AUTO_POSITION = 1;   -- GTID 자동 포지션 활성화

START REPLICA;

-- 상태 확인
SHOW REPLICA STATUS\G
```

`SOURCE_AUTO_POSITION = 1`을 설정하면 Replica는 `COM_BINLOG_DUMP_GTID` 프로토콜로 연결하고, 자신의 `gtid_executed`를 Primary에 전달해 누락된 이벤트만 받는다.

## AUTO_POSITION 동작 원리

Replica가 Primary에 연결하면 다음 순서로 협상이 이루어진다.

1. Replica가 `gtid_executed`를 Primary에 전송
2. Primary가 `gtid_executed`에 없는 GTID를 binlog에서 탐색
3. 해당 이벤트를 Relay Log에 순서대로 전송
4. SQL Thread가 적용 후 Replica의 `gtid_executed`에 추가

재연결이나 Failover 후에도 동일한 과정이 자동으로 반복된다. GTID 집합에 이미 포함된 트랜잭션은 Primary가 다시 보내지 않으므로 중복 적용이 일어나지 않는다.

![GTID 설정과 장애 조치](/assets/posts/mysql-gtid-replication-config.svg)

## Failover 시나리오

GTID 기반 Failover의 핵심은 새 Primary로 승격된 서버의 `gtid_executed`를 다른 Replica가 그대로 참조한다는 점이다.

```sql
-- 1. 기존 Primary 장애 감지 후 가장 최신 Replica 선정
-- (gtid_executed에서 가장 많은 GTID를 적용한 서버)
SELECT @@gtid_executed;  -- 각 Replica에서 실행 후 비교

-- 2. 선정된 Replica를 새 Primary로 승격
STOP REPLICA;
RESET REPLICA ALL;       -- Replica 설정 초기화

-- 3. 나머지 Replica를 새 Primary에 연결
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '새Primary IP',
  SOURCE_AUTO_POSITION = 1;
START REPLICA;
```

수동 Failover보다 **MHA(Master High Availability)**, **Orchestrator**, **MySQL Shell의 InnoDB ClusterSet**을 사용하면 GTID 기반으로 Failover를 자동화할 수 있다. 이 도구들은 `gtid_executed` 비교, 에러 주입 방지, VIP 전환을 자동으로 처리한다.

## 멀티소스 리플리케이션

GTID는 여러 Primary에서 동시에 데이터를 받는 멀티소스 리플리케이션도 지원한다. 각 소스마다 고유한 UUID를 가지므로 GTID 충돌 없이 병합할 수 있다.

```sql
-- 채널별 소스 설정
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '192.168.1.10',
  SOURCE_AUTO_POSITION = 1
  FOR CHANNEL 'source1';

CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '192.168.1.11',
  SOURCE_AUTO_POSITION = 1
  FOR CHANNEL 'source2';

START REPLICA FOR CHANNEL 'source1';
START REPLICA FOR CHANNEL 'source2';

-- 채널별 상태 확인
SHOW REPLICA STATUS FOR CHANNEL 'source1'\G
```

## GTID 제약 사항과 우회

GTID 환경에서는 일부 SQL 문이 `enforce_gtid_consistency` 위반으로 차단된다.

```sql
-- 차단 ①: CREATE TABLE … SELECT
-- GTID 위반: CREATE(DDL)와 SELECT(DML)가 한 트랜잭션에 혼합
CREATE TABLE new_t SELECT * FROM old_t;  -- ERROR

-- 우회: 두 문장으로 분리
CREATE TABLE new_t LIKE old_t;
INSERT INTO new_t SELECT * FROM old_t;

-- 차단 ②: 비트랜잭셔널 + 트랜잭셔널 혼합
-- MyISAM(비트랜잭셔널) 테이블과 InnoDB 혼합 DML
-- → 모든 테이블을 InnoDB로 통일하면 해결

-- GTID skip (특정 트랜잭션 건너뛰기)
SET @@SESSION.GTID_NEXT = 'aaaa-bbbb-cccc-dddd-eeee:99';
BEGIN;
COMMIT;  -- 빈 트랜잭션으로 GTID 소모
SET @@SESSION.GTID_NEXT = 'AUTOMATIC';
```

`gtid_purged`는 Replica에서 복구할 수 없도록 이미 삭제된 GTID 집합이다. 새 Replica를 추가할 때 백업에서 복구하면 백업의 `gtid_purged` 값을 새 Replica에 주입해야 한다.

```sql
-- 백업 복구 후 새 Replica 초기화
RESET MASTER;
SET @@GLOBAL.GTID_PURGED = 'aaaa-bbbb-cccc-dddd-eeee:1-500';

CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '192.168.1.10',
  SOURCE_AUTO_POSITION = 1;
START REPLICA;
```

## GTID 모니터링

```sql
-- 리플리케이션 지연 및 GTID 상태 종합 확인
SELECT
  CHANNEL_NAME,
  SERVICE_STATE,
  RECEIVED_TRANSACTION_SET,
  LAST_ERROR_MESSAGE
FROM performance_schema.replication_connection_status;

SELECT
  CHANNEL_NAME,
  SERVICE_STATE,
  APPLYING_TRANSACTION,
  LAST_APPLIED_TRANSACTION,
  LAST_ERROR_MESSAGE
FROM performance_schema.replication_applier_status_by_worker;

-- GTID 간격(Gap) 확인
SELECT GTID_SUBTRACT(
  @@GLOBAL.gtid_executed,
  (SELECT received_transaction_set
   FROM performance_schema.replication_connection_status
   WHERE channel_name = '')
) AS missing_on_replica;
```

GTID는 MySQL 고가용성 구성의 사실상 표준이 됐다. 신규 서비스에서 리플리케이션을 구성한다면 파일-포지션 방식 대신 GTID 방식으로 시작하는 것이 운영 부담을 크게 줄인다.

---

**지난 글:** [MySQL 리플리케이션 — 비동기·반동기·그룹 리플리케이션](/posts/mysql-replication-async-semi-group/)

**다음 글:** [MySQL 바이너리 로그 포맷 — STATEMENT·ROW·MIXED 비교](/posts/mysql-binlog-formats/)

<br>
읽어주셔서 감사합니다. 😊
