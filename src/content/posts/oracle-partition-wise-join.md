---
title: "파티션-와이즈 조인"
description: "Oracle Partition-Wise Join의 동작 원리, Full PWJ와 Partial PWJ 차이, 병렬 실행 시 메모리 절감 효과, 그리고 실행 계획에서 확인하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["oracle", "partitioning", "partition-wise-join", "parallel", "hash-join", "performance", "execution-plan", "pwj"]
featured: false
draft: false
---

[지난 글](/posts/oracle-interval-partitioning/)에서 Interval 파티셔닝으로 파티션 생성을 자동화하는 방법을 살펴봤다. 파티셔닝을 제대로 설계하면 성능 이점이 단순한 프루닝에 그치지 않는다. **파티션-와이즈 조인(Partition-Wise Join, PWJ)**은 대용량 조인의 메모리 사용량과 병렬 확장성을 동시에 개선한다.

## 왜 대용량 조인이 문제인가

수억 건 ORDERS와 수천만 건 CUSTOMERS를 조인한다고 가정하자. 일반 Hash Join은 작은 쪽(CUSTOMERS)을 메모리에 올려 Hash Table을 빌드한 다음, ORDERS를 스캔하며 매칭한다. 문제는 이 작업이 **단일 세션**의 메모리(PGA)로 처리되어야 한다는 것이다. PGA 한계를 초과하면 Temp Segment로 Spill이 발생하고 I/O가 폭증한다.

병렬 실행을 추가해도 Hash Table 빌드는 각 병렬 워커가 독립적으로 수행하거나, 데이터를 재배분(redistribution)해야 한다. 재배분은 인터프로세스 통신 오버헤드를 만든다.

## Full Partition-Wise Join

![Full Partition-Wise Join 구조](/assets/posts/oracle-partition-wise-join-full.svg)

양쪽 테이블이 **동일한 파티션 키**와 **동일한 파티션 수**로 파티셔닝된 경우, Oracle은 Full PWJ를 사용한다. 핵심은 `hash(cust_id) mod N`으로 나눈 결과가 양쪽에서 동일하다는 것이다. 즉, O_P1에 있는 cust_id는 반드시 C_P1에도 있다.

이 경우 병렬 워커 하나가 O_P1과 C_P1만을 조인하면 되고, 다른 워커는 O_P2 ↔ C_P2를 처리한다. 각 워커가 독립적으로 동작하므로 **데이터 재배분이 전혀 없다**. Hash Table 크기도 전체의 `1/N`만 필요하다.

```sql
-- Full PWJ를 유도하는 테이블 설계
CREATE TABLE orders (
  order_id   NUMBER,
  cust_id    NUMBER,
  order_dt   DATE,
  amount     NUMBER
)
PARTITION BY HASH (cust_id)
PARTITIONS 8;

CREATE TABLE customers (
  cust_id    NUMBER,
  cust_name  VARCHAR2(100),
  grade      VARCHAR2(10)
)
PARTITION BY HASH (cust_id)
PARTITIONS 8;  -- 반드시 동일 파티션 수

-- 조인 쿼리
SELECT /*+ PARALLEL(o,4) PARALLEL(c,4) */
       o.order_id,
       c.cust_name,
       o.amount
FROM   orders    o
JOIN   customers c ON o.cust_id = c.cust_id
WHERE  o.order_dt >= DATE '2024-01-01';
```

## 실행 계획 확인

```sql
EXPLAIN PLAN FOR
  SELECT /*+ PARALLEL(o,4) PARALLEL(c,4) */
         o.order_id, c.cust_name, o.amount
  FROM   orders o
  JOIN   customers c ON o.cust_id = c.cust_id;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(FORMAT=>'ALL'));
```

Full PWJ가 동작하면 실행 계획에 `PARTITION HASH ALL`과 `PX PARTITION HASH ALL` 연산이 보인다. 데이터 재배분을 위한 `PX SEND HASH`나 `PX RECEIVE` 없이 바로 Hash Join으로 이어지면 PWJ가 성공한 것이다.

## Partial Partition-Wise Join

![Partial PWJ vs 일반 조인 비교](/assets/posts/oracle-partition-wise-join-partial.svg)

한쪽만 파티셔닝된 경우 Partial PWJ가 사용된다. ORDERS는 Hash 파티션이지만 CUSTOMERS는 단순 힙 테이블이라면, ORDERS의 각 파티션 단위로 조인하되 CUSTOMERS는 매번 전체를 참조한다. Full PWJ만큼 효율적이지는 않지만, 일반 조인보다는 병렬성이 높다.

Range 파티션 테이블과 비파티션 테이블을 조인하는 경우에도 Partial PWJ가 적용된다.

```sql
-- Partial PWJ: orders(파티션) ↔ customers(비파티션)
SELECT /*+ PARALLEL(o,4) */
       o.order_id,
       c.cust_name
FROM   orders    o
JOIN   customers c ON o.cust_id = c.cust_id
WHERE  o.order_dt >= DATE '2024-01-01';

-- 실행 계획에 PARTITION HASH ALL + HASH JOIN이 나오지만
-- PX SEND/RECEIVE가 함께 나타남 (CUSTOMERS 재배분)
```

## PWJ 힌트 제어

옵티마이저가 PWJ를 선택하지 않을 때 힌트로 강제할 수 있다.

```sql
SELECT /*+ PQ_DISTRIBUTE(c NONE NONE) PARALLEL(o,4) PARALLEL(c,4) */
       o.order_id,
       c.cust_name
FROM   orders    o
JOIN   customers c ON o.cust_id = c.cust_id;
```

`PQ_DISTRIBUTE(table NONE NONE)`은 "이 테이블을 재배분하지 말라"는 의미로, Full PWJ를 유도한다. 반대로 `PQ_DISTRIBUTE(c HASH HASH)`는 Hash 재배분을 명시한다.

## 성능 비교 수치 (예시 환경 기준)

| 방식 | 메모리 (4 파티션) | 처리 시간 (예시) |
|---|---|---|
| 일반 Hash Join (PARALLEL 4) | PGA 4GB (전체) | 120초 |
| Partial PWJ (PARALLEL 4) | PGA 1GB × 4 | 55초 |
| Full PWJ (PARALLEL 4) | PGA 0.5GB × 4 | 28초 |

Full PWJ는 Hash Table이 `1/N` 크기이므로 Temp Spill 없이 메모리 안에서 처리되는 경우가 많다. 이것이 시간 단축의 주된 이유다.

## 설계 체크리스트

PWJ의 효과를 극대화하려면 다음 조건을 갖춰야 한다.

1. 조인 컬럼 = 파티션 키 (양쪽 모두)
2. 파티션 수 동일 (Full PWJ의 경우)
3. 파티션 수는 병렬 DOP의 배수 (워커당 하나 이상 할당)
4. 통계 최신화 — 옵티마이저가 PWJ를 선택하려면 파티션 통계가 있어야 함

```sql
-- 파티션별 통계 갱신
EXEC DBMS_STATS.GATHER_TABLE_STATS(
  ownname => USER,
  tabname => 'ORDERS',
  granularity => 'ALL',
  cascade => TRUE
);
```

## 정리

- **Full PWJ**: 양쪽 동일 파티션 키 + 동일 파티션 수 → 데이터 재배분 없는 독립 조인
- **Partial PWJ**: 한쪽만 파티션 → 재배분 필요하지만 Full Scan보다 병렬성 향상
- Hash Table 크기 `1/N` 감소 → Temp Spill 방지 → 가장 실질적인 성능 이점
- `PQ_DISTRIBUTE(t NONE NONE)` 힌트로 Full PWJ 유도 가능
- 설계 시 "조인 컬럼 = 파티션 키" 원칙을 대용량 팩트 테이블 설계에 반영

---

**지난 글:** [Oracle Interval 파티셔닝](/posts/oracle-interval-partitioning/)

**다음 글:** [Materialized View와 Query Rewrite](/posts/oracle-materialized-view-query-rewrite/)

<br>
읽어주셔서 감사합니다. 😊
