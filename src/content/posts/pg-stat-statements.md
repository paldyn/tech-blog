---
title: "pg_stat_statements — 쿼리 통계로 슬로우 쿼리 잡기"
description: "PostgreSQL의 pg_stat_statements 확장 설치·설정·동작 원리, 주요 컬럼(calls, total_exec_time, mean_exec_time, shared_blks_hit/read), 평균 실행 시간·I/O 핫스팟 기준 상위 쿼리 조회, pg_stat_statements_reset()으로 배포 전후 비교하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["postgresql", "pg-stat-statements", "slow-query", "performance", "monitoring", "query-statistics", "shared-blks", "mean-exec-time", "auto-explain"]
featured: false
draft: false
---

[지난 글](/posts/pg-extension-system/)에서 PostgreSQL 확장 시스템의 구조와 주요 확장 목록을 살펴봤다. 이번에는 그 목록에서 가장 자주 쓰이는 **pg_stat_statements**를 깊이 파고든다. 슬로우 쿼리 분석의 시작점이자 DBA의 필수 도구다.

## pg_stat_statements가 하는 일

`pg_stat_statements`는 PostgreSQL 서버에서 실행된 모든 SQL 문장의 실행 통계를 누적한다. 같은 패턴의 쿼리(리터럴 값은 다르지만 구조가 같은)를 하나로 정규화해 집계하므로, 호출 수·총 실행 시간·평균 시간·I/O 비용을 쿼리 패턴 단위로 파악할 수 있다.

## 설치와 설정

`pg_stat_statements`는 `shared_preload_libraries`에 미리 로드해야 한다.

```ini
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000        # 저장할 쿼리 최대 개수 (기본 5000)
pg_stat_statements.track = top        # top: 최상위 쿼리, all: 중첩 포함
pg_stat_statements.track_io_timing = on  # I/O 대기 시간 추적 (권장)
```

설정 변경 후 서버를 재시작하고 확장을 활성화한다.

```sql
-- 각 데이터베이스에서 1회 실행 (슈퍼유저)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 설치 확인
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_stat_statements';
```

## 동작 구조

![pg_stat_statements 동작 구조](/assets/posts/pg-stat-statements-flow.svg)

쿼리가 실행될 때마다 Executor Hook이 통계를 공유 메모리의 해시 테이블에 누적한다. 해시 키는 **QueryID**로, 리터럴 값을 `$1`, `$2`로 정규화한 쿼리 텍스트의 해시다. 통계는 주기적으로 `$PGDATA/pg_stat_statements.stat` 파일에 플러시되어 서버 재시작 후에도 보존된다.

## 주요 컬럼

```sql
-- 컬럼 구조 확인
\d pg_stat_statements
```

| 컬럼 | 설명 |
|------|------|
| `query` | 정규화된 쿼리 텍스트 ($1, $2로 치환) |
| `calls` | 총 실행 횟수 |
| `total_exec_time` | 총 실행 시간(ms) |
| `mean_exec_time` | 평균 실행 시간(ms) |
| `min_exec_time` / `max_exec_time` | 최소/최대 실행 시간 |
| `rows` | 총 반환 행 수 |
| `shared_blks_hit` | 버퍼 캐시 히트 수 |
| `shared_blks_read` | 디스크에서 읽은 블록 수 |
| `shared_blks_dirtied` | 더티 처리된 블록 수 |
| `blk_read_time` / `blk_write_time` | I/O 대기 시간(track_io_timing ON 필요) |
| `wal_bytes` | WAL 생성량 (PG13+) |
| `queryid` | 정규화 쿼리 해시 |

## 실전 분석 쿼리

![pg_stat_statements 실전 분석 쿼리](/assets/posts/pg-stat-statements-queries.svg)

### 총 시간 기준 핫스팟 (가장 자원을 많이 소모하는 쿼리)

```sql
SELECT
  left(query, 100) AS q,
  calls,
  round(total_exec_time::numeric, 0)               AS total_ms,
  round(mean_exec_time::numeric, 2)                AS avg_ms,
  round(total_exec_time / sum(total_exec_time) OVER () * 100, 1) AS pct
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 15;
```

### I/O 히트율이 낮은 쿼리 (캐시 미스 많은 쿼리)

```sql
SELECT
  left(query, 80) AS q,
  shared_blks_read,
  shared_blks_hit,
  round(100.0 * shared_blks_hit /
        NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS hit_pct
FROM pg_stat_statements
WHERE shared_blks_read > 1000
ORDER BY shared_blks_read DESC
LIMIT 10;
```

히트율이 낮으면 `shared_buffers`가 부족하거나 인덱스 없이 풀스캔하는 쿼리일 가능성이 높다.

### 분산이 큰 쿼리 (간헐적으로 느린 쿼리)

```sql
SELECT
  left(query, 80) AS q,
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  round(max_exec_time::numeric, 2) AS max_ms
FROM pg_stat_statements
WHERE calls > 100
ORDER BY stddev_exec_time DESC
LIMIT 10;
```

`stddev_exec_time`이 크면 실행 계획 불안정, 락 대기, 캐시 플러시 등의 간헐적 문제를 의심한다.

## 통계 리셋

```sql
-- 전체 초기화 (배포 전후 비교에 활용)
SELECT pg_stat_statements_reset();

-- 특정 쿼리만 초기화 (PG14+)
SELECT pg_stat_statements_reset(userid => 0, dbid => 0, queryid => 1234567890);
```

새 배포 후 통계를 리셋하고 일정 시간 후 다시 조회하면 변경된 코드의 성능 영향을 명확히 비교할 수 있다.

## auto_explain과 함께 쓰기

`pg_stat_statements`는 어떤 쿼리가 느린지 알려주지만, 왜 느린지는 알 수 없다. `auto_explain`을 함께 사용하면 임계 시간 이상의 쿼리에 대한 실행 계획을 로그에 자동으로 기록한다.

```ini
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements,auto_explain'
auto_explain.log_min_duration = 1000   # 1초 이상 걸린 쿼리만
auto_explain.log_analyze = on          # EXPLAIN ANALYZE 수준
auto_explain.log_buffers = on          # 버퍼 사용량 포함
auto_explain.log_format = json
```

## pg_stat_statements_info (PG14+)

PG14부터 통계 수집 상태를 확인하는 뷰가 추가되었다.

```sql
SELECT dealloc, stats_reset
FROM pg_stat_statements_info;
```

`dealloc`은 `pg_stat_statements.max` 초과로 폐기된 항목 수다. 이 값이 계속 증가한다면 `pg_stat_statements.max`를 늘려야 한다.

## 권한 관리

슈퍼유저가 아닌 사람도 `pg_stat_statements`를 조회할 수 있게 하려면 `pg_read_all_stats` 또는 `pg_monitor` 역할을 부여한다.

```sql
GRANT pg_read_all_stats TO monitoring_user;
-- 또는
GRANT pg_monitor TO monitoring_user;
```

일반 사용자는 자신의 `usesysid`에 해당하는 쿼리 통계만 볼 수 있고, `pg_read_all_stats` 권한이 있으면 모든 사용자의 통계를 볼 수 있다.

---

**지난 글:** [PostgreSQL 확장 시스템 — CREATE EXTENSION과 주요 확장들](/posts/pg-extension-system/)

**다음 글:** [PostGIS 입문 — 지리 데이터 타입과 공간 쿼리](/posts/pg-postgis-intro/)

<br>
읽어주셔서 감사합니다. 😊
