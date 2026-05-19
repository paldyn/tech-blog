---
title: "MySQL Performance Schema & sys 스키마 — 성능 진단 완전 가이드"
description: "MySQL Performance Schema의 Instruments/Consumers 구조, 활성화 방법, sys 스키마 뷰 활용, 슬로우 쿼리·락 대기·I/O 진단 실전 쿼리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["MySQL", "Performance Schema", "sys스키마", "슬로우쿼리", "성능진단", "락대기"]
featured: false
draft: false
---

[지난 글](/posts/mysql-proxysql-router/)에서 ProxySQL과 MySQL Router를 통한 연결 프록시를 살펴봤다. 프록시 레이어가 쿼리를 분산하더라도 개별 쿼리의 성능 문제는 DB 내부에서 진단해야 한다. MySQL 5.5부터 내장된 **Performance Schema**와 이를 더 쉽게 쓸 수 있게 래핑한 **sys 스키마**는 DBA가 가져야 할 핵심 진단 도구다.

## Performance Schema 개요

Performance Schema는 MySQL 서버 내부의 이벤트를 런타임에 측정하는 엔진이다. 별도 프로세스가 아니라 MySQL 서버 자체에 내장되어 있어 외부 도구 없이 실행 중인 쿼리의 레이턴시, 잠금 대기, 파일 I/O, 메모리 사용량을 마이크로초 단위로 측정한다.

```sql
-- Performance Schema 활성화 확인
SHOW VARIABLES LIKE 'performance_schema';
-- performance_schema = ON (MySQL 8.0 기본값)

-- 전체 메모리 사용량
SELECT SUM(CURRENT_NUMBER_OF_BYTES_USED) / 1024 / 1024 AS 'MB'
FROM performance_schema.memory_summary_global_by_event_name;
```

![Performance Schema 계층 구조](/assets/posts/mysql-performance-schema-overview.svg)

## Instruments와 Consumers

**Instruments**는 "무엇을 측정할지"를 정의하고, **Consumers**는 "측정된 데이터를 어디에 저장할지"를 결정한다.

```sql
-- 주요 Instrument 확인
SELECT NAME, ENABLED, TIMED
FROM performance_schema.setup_instruments
WHERE NAME LIKE 'statement/sql/%'
LIMIT 10;

-- 특정 Instrument 활성화
UPDATE performance_schema.setup_instruments
SET ENABLED = 'YES', TIMED = 'YES'
WHERE NAME LIKE 'statement/%';

-- Consumer 활성화 (events_statements_history_long 활성화)
UPDATE performance_schema.setup_consumers
SET ENABLED = 'YES'
WHERE NAME = 'events_statements_history_long';

-- 현재 Consumer 상태 확인
SELECT NAME, ENABLED
FROM performance_schema.setup_consumers;
```

MySQL 8.0에서는 대부분의 Instruments와 Consumers가 기본 활성화되어 있다.

## sys 스키마 — 사람이 읽기 쉬운 뷰

sys 스키마는 Performance Schema 위에 구축된 뷰 모음이다. 복잡한 Performance Schema 테이블 조인을 미리 작성해 두어 간단한 SELECT 한 줄로 진단이 가능하다.

![sys 스키마 실전 진단 쿼리](/assets/posts/mysql-performance-schema-queries.svg)

```sql
-- sys 스키마 사용 (별도 설치 불필요, 8.0 기본 포함)
USE sys;

-- 가장 느린 쿼리 TOP 10 (누적 실행 시간 기준)
SELECT
  query,
  exec_count,
  avg_latency,
  rows_examined_avg,
  full_scan
FROM sys.statements_with_runtimes_in_95th_pct
ORDER BY avg_latency DESC
LIMIT 10;

-- 인덱스를 사용하지 않는 쿼리
SELECT
  query,
  exec_count,
  no_index_used_count,
  rows_examined_avg
FROM sys.statements_with_full_table_scans
WHERE no_index_used_count > 0
ORDER BY no_index_used_count DESC;
```

## 락 대기 진단

```sql
-- 현재 InnoDB 락 대기 상황
SELECT
  wait_age,
  locked_table,
  locked_type,
  waiting_query,
  blocking_query
FROM sys.innodb_lock_waits;

-- 데드락 이력 (InnoDB 엔진 상태에서)
SHOW ENGINE INNODB STATUS\G
-- 'LATEST DETECTED DEADLOCK' 섹션 확인

-- 메타데이터 락 대기
SELECT
  object_schema, object_name,
  lock_type, lock_status,
  source, owner_thread_id
FROM performance_schema.metadata_locks
WHERE lock_status = 'PENDING';
```

## 슬로우 쿼리 심층 분석

```sql
-- 특정 다이제스트의 실행 계획 이력
SELECT
  DIGEST_TEXT,
  COUNT_STAR,
  AVG_TIMER_WAIT / 1000000000 AS avg_ms,
  SUM_ROWS_EXAMINED,
  SUM_NO_INDEX_USED
FROM performance_schema.events_statements_summary_by_digest
WHERE DIGEST_TEXT LIKE '%orders%'
ORDER BY AVG_TIMER_WAIT DESC
LIMIT 5;

-- 현재 실행 중인 쿼리 (sys.session 활용)
SELECT
  thd_id,
  conn_id,
  user,
  db,
  command,
  time,
  current_statement,
  statement_latency,
  progress
FROM sys.session
WHERE command != 'Sleep'
ORDER BY statement_latency DESC;

-- 특정 연결의 상세 프로파일
SELECT
  event_name,
  timer_wait / 1000000000 AS ms
FROM performance_schema.events_stages_history_long
WHERE thread_id = (
  SELECT thread_id FROM performance_schema.processlist
  WHERE id = 123   -- connection_id
)
ORDER BY timer_start;
```

## 파일 I/O 진단

```sql
-- 파일별 I/O 통계
SELECT
  file,
  count_read, total_read,
  count_write, total_written
FROM sys.io_global_by_file_by_bytes
ORDER BY total_written DESC
LIMIT 10;

-- 테이블별 I/O 대기
SELECT
  object_schema,
  object_name,
  count_fetch,
  sum_timer_fetch / 1000000000 AS fetch_ms,
  count_insert + count_update + count_delete AS dml_count
FROM performance_schema.table_io_waits_summary_by_table
ORDER BY sum_timer_fetch DESC
LIMIT 10;
```

## 메모리 사용량 진단

```sql
-- 컴포넌트별 메모리 사용량
SELECT
  event_name,
  CURRENT_NUMBER_OF_BYTES_USED / 1024 / 1024 AS current_MB,
  HIGH_NUMBER_OF_BYTES_USED    / 1024 / 1024 AS peak_MB
FROM performance_schema.memory_summary_global_by_event_name
WHERE CURRENT_NUMBER_OF_BYTES_USED > 0
ORDER BY CURRENT_NUMBER_OF_BYTES_USED DESC
LIMIT 15;

-- 유저별 메모리 사용량
SELECT
  user,
  current_allocated,
  total_allocated
FROM sys.memory_by_user_by_current_bytes
ORDER BY current_allocated DESC;
```

## 리플리케이션 지연 모니터링

```sql
-- 리플리케이션 지연 및 에러 상태
SELECT
  CHANNEL_NAME,
  SERVICE_STATE,
  COUNT_TRANSACTIONS_RETRIES,
  LAST_ERROR_MESSAGE
FROM performance_schema.replication_applier_status;

-- Worker별 적용 현황
SELECT
  CHANNEL_NAME,
  WORKER_ID,
  SERVICE_STATE,
  LAST_APPLIED_TRANSACTION,
  APPLYING_TRANSACTION_IMMEDIATE_START_TIMESTAMP
FROM performance_schema.replication_applier_status_by_worker;
```

## 오버헤드 조정

Performance Schema는 오버헤드가 있다. 기본 설정 기준으로 성능 영향은 수% 이내지만 필요 없는 Instrument는 비활성화해 오버헤드를 최소화할 수 있다.

```sql
-- 사용하지 않는 Instrument 비활성화
UPDATE performance_schema.setup_instruments
SET ENABLED = 'NO'
WHERE NAME LIKE 'memory/%'
  AND NAME NOT LIKE 'memory/sql/%';

-- 특정 DB만 모니터링
INSERT INTO performance_schema.setup_objects
  (OBJECT_TYPE, OBJECT_SCHEMA, OBJECT_NAME, ENABLED, TIMED)
VALUES
  ('TABLE', 'mydb', '%', 'YES', 'YES');

-- 누적 통계 초기화
TRUNCATE TABLE performance_schema.events_statements_summary_by_digest;
```

Performance Schema는 문제가 발생했을 때 켜는 도구가 아니라 평소에도 켜 두고 주기적으로 확인하는 것이 좋다. sys 스키마의 뷰들을 cron으로 수집해 Grafana 같은 대시보드에 시각화하면 성능 이상을 사전에 감지할 수 있다.

---

**지난 글:** [ProxySQL & MySQL Router — MySQL 연결 프록시 완전 가이드](/posts/mysql-proxysql-router/)

**다음 글:** [MySQL my.cnf 튜닝 — InnoDB·연결·쿼리 캐시 핵심 파라미터](/posts/mysql-my-cnf-tuning/)

<br>
읽어주셔서 감사합니다. 😊
