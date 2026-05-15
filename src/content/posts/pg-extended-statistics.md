---
title: "확장 통계 — 다중 컬럼 상관관계를 옵티마이저에게 알리는 방법"
description: "PostgreSQL CREATE STATISTICS로 다중 컬럼 상관관계(dependencies), n_distinct, MCV(Most Common Values) 통계를 수집하는 방법, 단일 컬럼 통계의 독립 가정 오류, 표현식 확장 통계(PG14+)를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["postgresql", "extended-statistics", "create-statistics", "dependencies", "ndistinct", "mcv", "query-planner", "multi-column"]
featured: false
draft: false
---

[지난 글](/posts/pg-planner-options/)에서 플래너 GUC 파라미터로 옵티마이저 동작을 조정하는 방법을 살펴봤다. 이번에는 통계 수준에서 옵티마이저에게 더 정확한 정보를 제공하는 **확장 통계(Extended Statistics)**를 다룬다.

## 단일 컬럼 통계의 독립 가정

기본 `ANALYZE`가 수집하는 통계는 컬럼별로 독립적이다. 옵티마이저는 여러 컬럼에 조건을 걸 때 각 컬럼의 선택도를 곱한다. 이를 독립 가정(independence assumption)이라 한다.

문제는 실제 데이터에서 컬럼 간 상관관계가 있을 때다. `city='Seoul'`이면 `country='KR'`일 확률이 거의 100%인데, 두 조건을 독립으로 취급하면 선택도를 크게 과소 추정한다.

```sql
-- 독립 가정으로 인한 과소 추정 예시
-- city 선택도: 0.1 (10%)
-- country 선택도: 0.3 (30%)
-- 독립 가정 추정: 10000 × 0.1 × 0.3 = 300행
-- 실제 값: 약 1000행 (city='Seoul'은 country='KR'과 거의 함께)

EXPLAIN ANALYZE
SELECT * FROM users WHERE city = 'Seoul' AND country = 'KR';
-- 추정 rows=300, actual rows=1034 → 3배 이상 차이
```

## CREATE STATISTICS 사용법

확장 통계는 `CREATE STATISTICS`로 명시적으로 선언한다. 선언만 하면 되고, 실제 통계 수집은 다음 `ANALYZE` 시에 이루어진다.

```sql
-- 기본 확장 통계 (모든 타입 자동 수집)
CREATE STATISTICS stat_city_country
    ON city, country
    FROM users;

ANALYZE users;  -- 통계 수집

-- 특정 타입만 지정
CREATE STATISTICS stat_city_country_dep (dependencies)
    ON city, country
    FROM users;

CREATE STATISTICS stat_city_country_ndist (ndistinct)
    ON city, country
    FROM users;
```

![확장 통계 — 다중 컬럼 상관관계 수집](/assets/posts/pg-extended-statistics-concept.svg)

## 세 가지 확장 통계 타입

**dependencies (함수적 의존성)**: 한 컬럼의 값이 다른 컬럼의 값을 결정하는 정도를 0~1로 나타낸다. `city → country` 의존성이 1에 가까우면 city를 알면 country를 대부분 예측할 수 있다는 뜻이다.

**ndistinct (다중 컬럼 조합 유일 값 수)**: 단일 컬럼의 `n_distinct` 개념을 다중 컬럼 조합으로 확장한다. `GROUP BY city, country`의 예상 그룹 수를 정확히 추정하는 데 쓰인다.

**mcv (Most Common Values, PG12+)**: 자주 나타나는 컬럼 값 조합과 그 빈도를 수집한다. 가장 강력하지만 통계 크기도 크다.

```sql
-- 세 가지 타입 모두 수집
CREATE STATISTICS stat_all (dependencies, ndistinct, mcv)
    ON city, country
    FROM users;

-- 세 컬럼 이상도 가능
CREATE STATISTICS stat_triple
    ON year, month, day
    FROM events;
```

## 확장 통계 조회

```sql
-- 확장 통계 목록
SELECT stxname,
       stxkeys,
       stxkind  -- {d}=dep, {n}=ndist, {m}=mcv
FROM   pg_statistic_ext
WHERE  stxrelid = 'users'::regclass;

-- 수집된 통계 내용 (PG14+ pg_stats_ext 뷰)
SELECT *
FROM   pg_stats_ext
WHERE  statistics_name = 'stat_city_country';

-- dependencies 내용 직접 확인
SELECT stxddinherit, stxddependencies
FROM   pg_statistic_ext_data
WHERE  stxoid = 'stat_city_country'::regclass;
```

![확장 통계 조회 및 활용 확인](/assets/posts/pg-extended-statistics-query.svg)

## 표현식 확장 통계 (PostgreSQL 14+)

PostgreSQL 14부터 표현식 결과에 대한 확장 통계도 지원한다. 이를 통해 표현식 간 상관관계도 수집할 수 있다.

```sql
-- 연도-월 표현식 간 상관관계 수집
CREATE STATISTICS stat_year_month
    ON (date_part('year', created_at)),
       (date_part('month', created_at))
    FROM orders;

ANALYZE orders;

-- 활용 쿼리
SELECT count(*) FROM orders
WHERE  date_part('year', created_at) = 2025
  AND  date_part('month', created_at) = 1;
-- 1월은 2025년 데이터에만 있으므로 독립 가정 오류가 없어짐
```

## 확장 통계 삭제와 관리

```sql
-- 통계 삭제
DROP STATISTICS stat_city_country;

-- 통계 이름 변경
ALTER STATISTICS stat_city_country RENAME TO stat_location;

-- statistics_target 개별 설정
ALTER STATISTICS stat_city_country SET STATISTICS 200;

-- 언제 확장 통계가 필요한가?
-- 1. EXPLAIN ANALYZE에서 추정 vs 실제 rows 차이 10배 이상
-- 2. 두 컬럼이 논리적으로 연관됨 (city-country, zip-city, model-brand 등)
-- 3. GROUP BY 다중 컬럼 집계 쿼리 추정 오류
```

---

**지난 글:** [플래너 옵션 — 옵티마이저 동작을 제어하는 GUC 파라미터](/posts/pg-planner-options/)

**다음 글:** [PostgreSQL 함수 작성 — SQL과 PL/pgSQL 기초](/posts/pg-create-function-sql-plpgsql/)

<br>
읽어주셔서 감사합니다. 😊
