---
title: "MySQL 통계 정보와 INFORMATION_SCHEMA — 옵티마이저의 눈"
description: "MySQL 옵티마이저가 실행 계획을 선택하는 근거인 InnoDB 통계 정보(innodb_table_stats, innodb_index_stats)와 INFORMATION_SCHEMA를 조회해 인덱스 카디널리티와 테이블 크기를 분석하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 33
type: "knowledge"
category: "SQL"
tags: ["mysql", "statistics", "information-schema", "cardinality", "analyze-table", "innodb-stats", "옵티마이저통계"]
featured: false
draft: false
---

[지난 글](/posts/mysql-optimizer-hints/)에서 힌트로 실행 계획을 직접 제어하는 방법을 살펴봤습니다. 이번 글에서는 힌트가 필요한 근본 원인인 **통계 정보**가 어떻게 수집·저장·활용되는지, 그리고 `INFORMATION_SCHEMA`를 통해 어떻게 진단하는지를 다룹니다.

## 통계 정보가 중요한 이유

MySQL 옵티마이저는 **비용 기반(Cost-Based)**으로 실행 계획을 선택합니다. 비용을 계산하려면 각 테이블과 인덱스에 대한 통계 — 행 수, 인덱스 고유값 수(카디널리티), 페이지 수 — 가 필요합니다. 통계가 오래됐거나 부정확하면 옵티마이저는 잘못된 계획을 선택합니다.

```sql
-- 이상한 실행 계획이 나올 때 먼저 확인할 것
SHOW TABLE STATUS LIKE 'orders';
-- Rows: 행 수 추정치 확인 (실제와 큰 차이 있으면 통계 오래됨)
```

## InnoDB 통계 저장 위치

InnoDB는 통계를 두 개의 시스템 테이블에 저장합니다.

```sql
-- 테이블 수준 통계
SELECT * FROM mysql.innodb_table_stats
WHERE database_name = 'mydb' AND table_name = 'orders';
-- n_rows: 행 수 추정
-- clustered_index_size: PK 인덱스 크기 (페이지 수)
-- sum_of_other_index_sizes: 보조 인덱스 합계 크기

-- 인덱스 수준 통계
SELECT * FROM mysql.innodb_index_stats
WHERE database_name = 'mydb' AND table_name = 'orders';
-- n_diff_pfx01: 첫 번째 컬럼의 고유값 수
-- n_diff_pfx02: (컬럼1, 컬럼2) 조합의 고유값 수
-- n_leaf_pages: 인덱스 리프 페이지 수
```

이 테이블들은 `mysql` 시스템 데이터베이스에 있으며, `innodb_stats_persistent=ON`(기본값)일 때 디스크에 영속 저장됩니다.

## 통계 갱신 — ANALYZE TABLE

통계가 오래됐다고 판단되면 `ANALYZE TABLE`로 즉시 갱신합니다.

```sql
-- 단일 테이블 갱신
ANALYZE TABLE orders;

-- 여러 테이블 한 번에
ANALYZE TABLE orders, customers, products;

-- 결과 예시
-- Table        Op      Msg_type  Msg_text
-- mydb.orders  analyze status    OK
```

`ANALYZE TABLE`은 테이블에 읽기 잠금을 걸지 않고 실행됩니다(온라인). 다만 대규모 테이블에서는 샘플링 비용이 있으므로 트래픽이 낮은 시간대에 실행하는 것이 좋습니다.

## 자동 통계 갱신 제어

InnoDB는 행 수가 많이 변하면 자동으로 통계를 갱신합니다.

```sql
-- 자동 갱신 관련 변수
SHOW VARIABLES LIKE 'innodb_stats_auto_recalc';
-- ON: 행 수가 10% 이상 변하면 자동 갱신 (기본값)

SHOW VARIABLES LIKE 'innodb_stats_persistent_sample_pages';
-- 기본 20 페이지 샘플링 → 대형 테이블은 100+ 권장

-- 테이블 단위로 샘플 페이지 수 지정
ALTER TABLE orders STATS_SAMPLE_PAGES=100;
```

자동 갱신은 편리하지만 갱신 시점이 예측되지 않아 플래시 세일 같은 대량 쓰기 이후 실행 계획이 갑자기 바뀔 수 있습니다. 중요한 쿼리라면 자동 갱신을 끄고 수동으로 관리하기도 합니다.

## INFORMATION_SCHEMA — 메타데이터 뷰

`INFORMATION_SCHEMA`는 데이터베이스 메타데이터를 SQL로 조회할 수 있는 **가상 데이터베이스**입니다.

![통계 정보 수집 흐름](/assets/posts/mysql-statistics-information-schema-flow.svg)

### STATISTICS 뷰 — 인덱스 카디널리티

```sql
SELECT
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX,
  CARDINALITY,
  NULLABLE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'mydb'
  AND TABLE_NAME = 'orders'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
```

`CARDINALITY`는 고유값의 추정 개수입니다. 행 수 대비 카디널리티 비율이 높을수록 인덱스 선택도가 좋습니다. 카디널리티가 낮은 인덱스(예: status='paid'/'pending' 등 2가지 값)는 옵티마이저가 인덱스 대신 Full Scan을 선택할 수 있습니다.

### TABLES 뷰 — 테이블 크기

```sql
SELECT
  TABLE_NAME,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1048576, 2) size_mb,
  TABLE_ROWS row_estimate,
  ENGINE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'mydb'
ORDER BY size_mb DESC;
```

![INFORMATION_SCHEMA 실전 쿼리](/assets/posts/mysql-statistics-information-schema-query.svg)

`TABLE_ROWS`는 **추정치**입니다. InnoDB는 MVCC 특성상 정확한 전체 행 수를 항상 유지하지 않으므로 정확한 값이 필요하면 `SELECT COUNT(*) FROM orders`를 사용해야 합니다.

### COLUMNS 뷰 — 컬럼 정보

```sql
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_KEY         -- PRI / UNI / MUL
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'mydb'
  AND TABLE_NAME = 'orders'
ORDER BY ORDINAL_POSITION;
```

`COLUMN_KEY`가 `MUL`이면 해당 컬럼을 포함하는 인덱스가 있지만 UNIQUE가 아님을 의미합니다.

## 카디널리티와 인덱스 선택

옵티마이저는 카디널리티를 통해 **선택도(Selectivity)**를 계산합니다.

```sql
-- 선택도 = CARDINALITY / TABLE_ROWS
-- status 컬럼: CARDINALITY=3, TABLE_ROWS=1,000,000
-- → 선택도 = 0.000003 → 인덱스 효과 낮음

-- user_id 컬럼: CARDINALITY=800,000, TABLE_ROWS=1,000,000
-- → 선택도 = 0.8 → 인덱스 매우 효과적

-- 선택도를 실제 확인하는 방법
EXPLAIN SELECT * FROM orders WHERE status = 'paid';  -- type: ALL or ref?
EXPLAIN SELECT * FROM orders WHERE user_id = 12345;  -- type: ref (좋음)
```

인덱스를 추가했는데도 사용되지 않는다면 카디널리티가 낮아 옵티마이저가 풀스캔이 더 싸다고 판단한 것입니다. 이런 경우 복합 인덱스로 선택도를 높이거나 쿼리 조건 자체를 개선합니다.

## 실전 진단 체크리스트

```sql
-- 1. 통계가 언제 마지막 갱신됐는지 확인
SELECT last_update FROM mysql.innodb_table_stats
WHERE database_name = 'mydb' AND table_name = 'orders';

-- 2. 인덱스 카디널리티가 행 수에 비해 합리적인지 확인
SELECT s.INDEX_NAME, s.CARDINALITY, t.TABLE_ROWS,
       ROUND(s.CARDINALITY / t.TABLE_ROWS * 100, 2) selectivity_pct
FROM INFORMATION_SCHEMA.STATISTICS s
JOIN INFORMATION_SCHEMA.TABLES t
  ON s.TABLE_SCHEMA = t.TABLE_SCHEMA AND s.TABLE_NAME = t.TABLE_NAME
WHERE s.TABLE_SCHEMA = 'mydb' AND s.TABLE_NAME = 'orders'
  AND s.SEQ_IN_INDEX = 1
ORDER BY selectivity_pct;

-- 3. 필요 시 통계 갱신
ANALYZE TABLE orders;
```

---

**지난 글:** [MySQL 옵티마이저 힌트 — 실행 계획 직접 제어하기](/posts/mysql-optimizer-hints/)

**다음 글:** [MySQL 조인 알고리즘 — BNL과 Hash Join](/posts/mysql-join-algorithms-bnl-hash/)

<br>
읽어주셔서 감사합니다. 😊
