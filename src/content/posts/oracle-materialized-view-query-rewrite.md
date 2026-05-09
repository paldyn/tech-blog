---
title: "Materialized View와 Query Rewrite"
description: "Oracle Materialized View의 생성, Refresh 방식(COMPLETE/FAST/ON COMMIT), Query Rewrite 동작 원리, 그리고 실무 튜닝 활용 패턴을 단계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["oracle", "materialized-view", "query-rewrite", "fast-refresh", "mv-log", "on-commit", "performance", "cbo"]
featured: false
draft: false
---

[지난 글](/posts/oracle-partition-wise-join/)에서 파티션-와이즈 조인으로 대용량 조인 성능을 개선하는 방법을 다뤘다. 이번에는 쿼리 결과를 미리 계산해두는 **Materialized View(MV)**와, 원본 쿼리를 자동으로 MV 조회로 바꿔주는 **Query Rewrite**를 살펴본다.

## Materialized View란

일반 View는 쿼리를 저장한 이름표다. 조회할 때마다 원본 쿼리가 실행된다. Materialized View는 다르다. **쿼리 결과 자체를 디스크에 저장**한다. 복잡한 집계나 조인의 결과가 이미 계산되어 있으므로, 조회 시점에는 단순한 테이블 스캔만 하면 된다.

OLAP 리포팅에서 "어제 집계가 왜 이렇게 느리냐"는 질문의 답이 MV인 경우가 많다.

![Materialized View 아키텍처](/assets/posts/oracle-materialized-view-query-rewrite-arch.svg)

## MV 생성과 Refresh 방식

```sql
-- 기본 MV (ON DEMAND, COMPLETE)
CREATE MATERIALIZED VIEW mv_dept_sales
REFRESH COMPLETE ON DEMAND
AS
  SELECT d.dept_name,
         SUM(o.amount)    AS total_sales,
         COUNT(o.order_id) AS order_cnt
  FROM   orders     o
  JOIN   departments d ON o.dept_id = d.dept_id
  GROUP BY d.dept_name;

-- 수동 갱신
EXEC DBMS_MVIEW.REFRESH('MV_DEPT_SALES', 'C');
```

`REFRESH COMPLETE`는 MV를 통째로 다시 계산한다. 베이스 테이블이 바뀔 때마다 전체 재계산하므로 정확하지만 대용량에는 느리다.

## FAST Refresh — 증분 갱신

변경된 부분만 MV에 반영하는 것이 FAST Refresh다. 이를 위해 베이스 테이블에 **MV Log(Materialized View Log)**를 먼저 만들어야 한다.

```sql
-- MV Log 생성 (변경 추적)
CREATE MATERIALIZED VIEW LOG ON orders
  WITH PRIMARY KEY, ROWID (cust_id, amount)
  INCLUDING NEW VALUES;

CREATE MATERIALIZED VIEW LOG ON departments
  WITH PRIMARY KEY, ROWID (dept_name)
  INCLUDING NEW VALUES;
```

MV Log는 베이스 테이블의 변경(INSERT/UPDATE/DELETE)을 별도 로그 테이블에 기록한다. FAST Refresh 시 이 로그만 읽어 MV를 업데이트하므로 COMPLETE보다 훨씬 빠르다.

```sql
-- FAST Refresh MV
CREATE MATERIALIZED VIEW mv_cust_sales
REFRESH FAST ON COMMIT
ENABLE QUERY REWRITE
AS
  SELECT cust_id,
         COUNT(*)         AS order_cnt,
         SUM(amount)      AS total_amount
  FROM   orders
  GROUP BY cust_id;
```

`ON COMMIT`은 베이스 테이블의 트랜잭션이 커밋될 때 자동으로 MV를 갱신한다. 데이터 최신성이 중요한 경우에 적합하다. 단, 커밋 오버헤드가 증가한다.

## Query Rewrite — 자동 쿼리 변환

![MV 생성 & Query Rewrite DDL](/assets/posts/oracle-materialized-view-query-rewrite-flow.svg)

`ENABLE QUERY REWRITE`를 지정하면 CBO가 원본 쿼리를 MV 조회로 자동 변환한다. 사용자는 베이스 테이블을 쿼리하지만, 실제로는 MV를 스캔한다.

```sql
-- 세션 파라미터 확인 (기본값: TRUE)
SHOW PARAMETER query_rewrite_enabled;

-- 이 쿼리는 MV로 리라이트된다
SELECT cust_id, SUM(amount)
FROM   orders
GROUP BY cust_id;

-- 실행 계획: MAT_VIEW REWRITE ACCESS FULL
--             MV_CUST_SALES (베이스 테이블 접근 없음)
```

Query Rewrite가 되려면 MV 정의 쿼리가 원본 쿼리를 "포함"해야 한다. 집계 함수, GROUP BY 컬럼, 조인 조건이 일치하거나 MV가 더 세밀하게 집계되어 있어야 한다.

```sql
-- Query Rewrite 가능 여부 분석
EXEC DBMS_MVIEW.EXPLAIN_MVIEW('mv_cust_sales');

SELECT * FROM mv_rewrite_equivalence
WHERE statement_id = 'test_query';
```

## Refresh 방식 선택 기준

| 시나리오 | 권장 Refresh |
|---|---|
| 배치 ETL 후 일괄 갱신 | COMPLETE ON DEMAND |
| 실시간 데이터 필요, 소규모 변경 | FAST ON COMMIT |
| 야간 갱신, 대용량 변경 | FAST ON DEMAND (스케줄러) |
| 읽기 전용 아카이브 | NEVER |

FAST가 불가능한 경우가 있다. 집계 함수가 `DISTINCT`를 포함하거나, `CONNECT BY`가 있거나, 서브쿼리가 있으면 FAST Refresh 조건을 충족하지 못한다. 이때는 FORCE(가능하면 FAST, 불가능하면 COMPLETE)를 쓴다.

```sql
-- FORCE: 자동으로 방식 결정
REFRESH FORCE ON DEMAND
```

## 파티션 MV

MV 자체도 파티셔닝할 수 있다. 이력 MV에 특히 유용하다.

```sql
CREATE MATERIALIZED VIEW mv_monthly_sales
PARTITION BY RANGE (sale_month)
INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))
(PARTITION p_before_2024
   VALUES LESS THAN (DATE '2024-01-01'))
REFRESH COMPLETE ON DEMAND
AS
  SELECT TRUNC(order_dt, 'MM') AS sale_month,
         dept_id,
         SUM(amount) AS total
  FROM   orders
  GROUP BY TRUNC(order_dt, 'MM'), dept_id;
```

이렇게 하면 오래된 MV 파티션을 DROP해 공간을 회수하면서 새 파티션은 자동으로 추가된다.

## 실무 체크리스트

Query Rewrite가 예상대로 동작하지 않을 때 확인할 항목:

1. `ENABLE QUERY REWRITE` — MV 정의에 포함 여부
2. `query_rewrite_enabled = TRUE` — 세션/시스템 파라미터
3. `query_rewrite_integrity` — STALE_TOLERATED, TRUSTED, ENFORCED 중 적절한 수준
4. MV 통계 최신화 — `DBMS_STATS.GATHER_TABLE_STATS`
5. CBO 파라미터 — `optimizer_features_enable`

```sql
-- MV 목록과 최신성 확인
SELECT mview_name,
       staleness,
       last_refresh_date,
       refresh_method
FROM   user_mviews;
```

`staleness = 'STALE'`이면 베이스 테이블이 변경됐지만 MV가 아직 갱신되지 않은 상태다. `FRESH`여야 Query Rewrite가 기본 모드에서 동작한다.

## 정리

- MV는 쿼리 결과를 디스크에 저장 → 복잡한 집계를 사전 계산
- FAST ON COMMIT: 커밋 시 자동 증분 갱신 (MV Log 필수)
- Query Rewrite: 사용자 쿼리 → MV 자동 변환, 별도 코드 수정 불필요
- OLAP 리포팅·DW 요약 테이블의 핵심 기법
- `staleness`와 `query_rewrite_integrity`가 Rewrite 동작의 핵심 제어 인자

---

**지난 글:** [파티션-와이즈 조인](/posts/oracle-partition-wise-join/)

**다음 글:** [Database Link](/posts/oracle-database-link/)

<br>
읽어주셔서 감사합니다. 😊
