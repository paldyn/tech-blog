---
title: "통계와 선택도"
description: "CBO가 실행 계획을 결정하는 데 사용하는 테이블 통계(row count, NDV, 히스토그램)와 선택도(Selectivity) 개념을 설명하고, 통계 갱신 방법과 잘못된 카디널리티 추정을 진단하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["sql", "statistics", "selectivity", "ndv", "histogram", "cardinality", "cbo", "analyze", "optimizer"]
featured: false
draft: false
---

[지난 글](/posts/sql-sort-aggregate-cost/)에서 정렬·집계 비용을 살펴봤다. CBO가 그 비용을 계산할 때 핵심 재료는 **통계(Statistics)**다. 통계가 틀리면 옵티마이저의 모든 비용 추정이 어긋난다.

---

## 통계란 무엇인가

데이터베이스는 테이블과 컬럼에 대한 요약 정보를 **카탈로그**에 저장한다. CBO는 실제 데이터를 보지 않고 이 통계만 보고 플랜을 결정한다.

| 통계 항목 | 설명 | PostgreSQL 열 |
|-----------|------|---------------|
| 행 수 | 테이블 전체 행 추정치 | `pg_class.reltuples` |
| 고유값 수(NDV) | 컬럼 내 고유값 개수 | `pg_stats.n_distinct` |
| 최빈값(MCV) | 가장 자주 나타나는 값과 빈도 | `pg_stats.most_common_vals` |
| 히스토그램 | 값 범위별 행 분포 | `pg_stats.histogram_bounds` |
| 상관계수 | 컬럼 값과 물리 저장 순서의 상관 | `pg_stats.correlation` |

---

## 선택도(Selectivity)

선택도는 조건을 만족하는 행의 비율이다.

```
selectivity = (조건 만족 행 수) / (전체 행 수)
```

CBO는 선택도로 **카디널리티(예상 반환 행 수)**를 추정하고, 이를 바탕으로 인덱스 스캔과 Full Scan 중 비용이 낮은 쪽을 선택한다.

```sql
-- 선택도 0.01 → 전체의 1% → 인덱스 스캔 유리
WHERE user_id = 42

-- 선택도 0.5 → 전체의 50% → Full Scan 유리
WHERE gender = 'M'
```

---

## 히스토그램

단순 NDV로는 값 분포의 편차를 표현하지 못한다. 히스토그램은 컬럼 값을 구간(버킷)으로 나눠 각 구간의 행 비율을 저장한다.

![히스토그램과 선택도 추정](/assets/posts/sql-statistics-selectivity-histogram.svg)

범위 조건(`BETWEEN`, `>`, `<`)의 선택도를 추정할 때 히스토그램 버킷을 참조한다.

```sql
-- 히스토그램 확인 (PostgreSQL)
SELECT histogram_bounds, n_distinct, most_common_vals,
       most_common_freqs
FROM pg_stats
WHERE tablename = 'orders'
  AND attname = 'score';
```

---

## NDV와 선택도

![고유값 수(NDV)와 선택도](/assets/posts/sql-statistics-selectivity-ndv.svg)

- **NDV가 낮은 컬럼(gender, status)**: 선택도가 높아 인덱스 효과가 낮다. 옵티마이저가 Full Scan을 선택할 수 있다.
- **NDV가 높은 컬럼(user_id, UUID)**: 선택도가 낮아 인덱스가 효과적이다.

등치 조건의 선택도 공식(균등 분포 가정):

```
selectivity = 1 / NDV
estimated_rows = reltuples × selectivity
```

실제로는 MCV와 히스토그램으로 더 정밀하게 계산한다.

---

## 통계 갱신

통계는 자동으로 갱신되지만(PostgreSQL autovacuum, MySQL auto-analyze), 대량 DML 직후나 autovacuum 주기가 길 때는 수동으로 갱신한다.

```sql
-- PostgreSQL: 테이블 전체 통계 갱신
ANALYZE orders;

-- 특정 컬럼만 갱신
ANALYZE orders(user_id, status, created_at);

-- 샘플링 비율 높이기 (기본 300 → 증가)
ALTER TABLE orders ALTER COLUMN score
  SET STATISTICS 1000;
ANALYZE orders;
```

```sql
-- MySQL
ANALYZE TABLE orders;

-- 통계 확인
SELECT * FROM information_schema.STATISTICS
WHERE table_name = 'orders';
```

---

## 카디널리티 추정 오류 진단

`EXPLAIN ANALYZE`에서 `rows=`(예상)과 `actual rows=`(실제)의 차이가 10배 이상이면 통계 오류다.

```sql
EXPLAIN (ANALYZE, VERBOSE)
SELECT * FROM orders WHERE user_id = 42;

-- 결과 예시
-- Seq Scan on orders
--   (cost=0.00..5000.00 rows=50000 ...)    ← 예상 50000
--   (actual time=0.05..12.34 rows=3 ...)   ← 실제 3행
--   → 대규모 추정 오류 → ANALYZE 필요
```

오류 해결 순서:

1. `ANALYZE` 실행
2. 통계 목표값(`STATISTICS N`) 상향
3. 확장 통계 생성 (복합 조건의 컬럼 간 상관관계)

```sql
-- PostgreSQL 14+: 복합 통계 (상관관계 포착)
CREATE STATISTICS stat_user_status
ON user_id, status
FROM orders;
ANALYZE orders;
```

---

**지난 글:** [정렬과 집계의 비용](/posts/sql-sort-aggregate-cost/)

**다음 글:** [Oracle 인스턴스와 데이터베이스](/posts/oracle-instance-vs-database/)

<br>
읽어주셔서 감사합니다. 😊
