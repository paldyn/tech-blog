---
title: "MySQL my.cnf 튜닝 — InnoDB·연결·리플리케이션 핵심 파라미터"
description: "MySQL 프로덕션 환경을 위한 my.cnf 파라미터 튜닝 가이드. InnoDB 버퍼 풀, redo 로그, 연결 수, 슬로우 쿼리, 리플리케이션 설정을 서버 사양별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["MySQL", "my.cnf", "튜닝", "InnoDB", "버퍼풀", "슬로우쿼리", "설정"]
featured: false
draft: false
---

[지난 글](/posts/mysql-performance-schema-sys/)에서 Performance Schema와 sys 스키마로 성능 이상을 진단하는 방법을 다뤘다. 진단 결과를 바탕으로 실질적인 개선을 이끌어내는 수단이 `my.cnf` 파라미터 튜닝이다. 잘못된 파라미터는 성능 저하는 물론 데이터 유실로 이어질 수 있으므로 각 파라미터의 의미와 트레이드오프를 이해하고 적용해야 한다.

## 파라미터 변경 전 확인 사항

```sql
-- 현재 설정 값 확인
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
SHOW GLOBAL VARIABLES LIKE 'max_connections';

-- 동적 변경 가능 여부 확인 (DYNAMIC이면 재시작 불필요)
SELECT VARIABLE_NAME, VARIABLE_SCOPE
FROM information_schema.VARIABLES
WHERE VARIABLE_NAME = 'innodb_buffer_pool_size';

-- 런타임 동적 변경 (가능한 경우)
SET GLOBAL innodb_buffer_pool_size = 12 * 1024 * 1024 * 1024;

-- 변경 이력 기록 (my.cnf에도 반영 필수)
```

## InnoDB 핵심 파라미터

![MySQL my.cnf 핵심 파라미터 맵](/assets/posts/mysql-my-cnf-tuning-overview.svg)

### innodb_buffer_pool_size

MySQL 튜닝에서 가장 중요한 단일 파라미터다. InnoDB가 데이터와 인덱스 페이지를 메모리에 캐시하는 공간이다. 이 값이 작으면 디스크 I/O가 폭발하고, 너무 크면 OS가 메모리 부족으로 스왑을 시작한다.

```sql
-- 버퍼 풀 현황 확인
SELECT
  FORMAT(pool_size * 16384 / 1024 / 1024, 0) AS 'Size(MB)',
  FORMAT((data_pages + free_pages) * 16384 / 1024 / 1024, 0) AS 'Used(MB)',
  ROUND(data_pages / pool_size * 100, 1) AS 'Hit Rate Approximation'
FROM information_schema.INNODB_BUFFER_POOL_STATS;

-- 버퍼 풀 히트율 (높을수록 좋음)
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_reads';
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read_requests';
-- Hit Rate = 1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)
-- 목표: 99% 이상
```

**권장값**: 전용 DB 서버에서 RAM의 70~80%. 16GB RAM이면 12GB. 다른 서비스와 공유하는 서버라면 50% 이하.

### innodb_log_file_size

InnoDB redo 로그 파일 하나의 크기다. 너무 작으면 로그가 빨리 채워져 체크포인트가 자주 일어나고 성능이 떨어진다.

```bash
# 로그 파일 크기 변경 (MySQL 8.0.30+ 동적 변경 가능)
# 이전 버전은 서버 중지 후 파일 삭제 필요

# 현재 redo 로그 쓰기 속도 측정
# 1시간 동안의 LSN 변화량 = 필요한 로그 크기
```

**권장값**: 쓰기 집약적 워크로드에서 1GB~2GB. OLAP에서는 256MB도 충분.

### innodb_flush_log_at_trx_commit

```ini
innodb_flush_log_at_trx_commit = 1  # 기본: 커밋마다 fsync (ACID 완전 준수)
innodb_flush_log_at_trx_commit = 2  # OS 크래시 시 최대 1초 손실 가능, 성능↑
innodb_flush_log_at_trx_commit = 0  # MySQL 크래시 시 손실 가능, 가장 빠름
```

금융·결제 등 데이터 무결성이 최우선이면 `1`을 유지한다. 캐시나 로그성 데이터라면 `2`로 변경해 쓰기 성능을 높인다.

## 연결 파라미터

```ini
# 동시 연결 수
max_connections = 500

# 연결 거부 대기열
back_log = 128

# 유휴 연결 타임아웃
wait_timeout          = 600    # 일반 연결: 10분
interactive_timeout   = 600    # 인터랙티브: 10분

# 스레드 캐시 (연결 생성 오버헤드 감소)
thread_cache_size = 32
```

`max_connections`를 높이면 메모리 사용량이 증가한다. 연결당 약 1MB 기본 메모리가 소비된다. 500개 연결 = 약 500MB 추가 메모리 필요. 애플리케이션 커넥션 풀이 올바르게 설정되어 있다면 max_connections를 필요 이상으로 높일 필요가 없다.

```sql
-- 최대 동시 연결 이력 확인
SHOW GLOBAL STATUS LIKE 'Max_used_connections';

-- 현재 연결 수
SHOW GLOBAL STATUS LIKE 'Threads_connected';

-- 연결 거부 이력 (Too many connections 에러)
SHOW GLOBAL STATUS LIKE 'Connection_errors_max_connections';
```

## 쿼리 메모리 파라미터

```ini
# 정렬 버퍼 (세션별 할당)
sort_buffer_size    = 1M    # 기본 256K. 너무 크게 잡지 말 것

# 인덱스 없는 조인
join_buffer_size    = 256K  # 기본값 유지 권장

# 인메모리 임시 테이블
tmp_table_size          = 64M
max_heap_table_size     = 64M

# 읽기 버퍼 (MyISAM/순차 스캔용)
read_buffer_size    = 128K  # InnoDB는 버퍼 풀이 담당
```

`sort_buffer_size`, `join_buffer_size`는 세션 수와 곱해진다. 100개 연결에서 `sort_buffer_size = 32M`이면 최악의 경우 3.2GB가 소비된다. 기본값에 가깝게 유지하고 특정 세션에서만 높이는 방식을 권장한다.

## 슬로우 쿼리 로그

```ini
slow_query_log                  = ON
slow_query_log_file             = /var/log/mysql/slow.log
long_query_time                 = 1     # 1초 이상
log_queries_not_using_indexes   = ON    # 인덱스 미사용 쿼리도 기록
min_examined_row_limit          = 1000  # 1000행 이상 스캔한 경우만
```

```bash
# pt-query-digest로 슬로우 쿼리 분석 (Percona Toolkit)
pt-query-digest /var/log/mysql/slow.log \
  --since="24h" \
  --limit=10 \
  --output=report
```

## 리플리케이션 & binlog 파라미터

![my.cnf 프로덕션 템플릿](/assets/posts/mysql-my-cnf-tuning-template.svg)

```ini
# 식별자 (모든 서버 고유값)
server_id = 1

# Binlog
log_bin               = ON
binlog_format         = ROW
binlog_row_image      = FULL
sync_binlog           = 1         # 내구성 최대. 성능 트레이드오프

# GTID
gtid_mode                 = ON
enforce_gtid_consistency  = ON

# Replica
log_replica_updates               = ON
replica_parallel_workers          = 8
replica_parallel_type             = LOGICAL_CLOCK
replica_preserve_commit_order     = ON
```

`replica_parallel_workers`를 높이면 Replica의 적용 속도가 빨라져 지연이 줄어든다. `LOGICAL_CLOCK` 방식은 Primary의 커밋 순서를 분석해 병렬 적용 가능한 트랜잭션을 찾아낸다.

## 동적 파라미터 변경 검증

```sql
-- 변경 전 현황 측정
SELECT VARIABLE_NAME, VARIABLE_VALUE
FROM performance_schema.global_variables
WHERE VARIABLE_NAME IN (
  'innodb_buffer_pool_size',
  'max_connections',
  'innodb_io_capacity'
);

-- 변경 적용
SET GLOBAL innodb_io_capacity = 4000;
SET GLOBAL innodb_io_capacity_max = 8000;

-- 변경 후 상태 모니터링 (10~30분 후)
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_reads';
SHOW GLOBAL STATUS LIKE 'Threads_running';
```

파라미터 변경 후에는 반드시 `my.cnf`에도 기록해야 한다. 런타임 변경은 재시작 시 초기화된다. 중요 변경은 Staging 환경에서 검증 후 프로덕션에 적용하는 것이 안전하다.

---

**지난 글:** [MySQL Performance Schema & sys 스키마 — 성능 진단 완전 가이드](/posts/mysql-performance-schema-sys/)

**다음 글:** [MariaDB — MySQL에서 포크된 이유와 차별화 기능](/posts/mariadb-fork-from-mysql/)

<br>
읽어주셔서 감사합니다. 😊
