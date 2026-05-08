---
title: "비용 기반 옵티마이저(CBO)"
description: "SQL을 실행하는 최적 플랜을 선택하는 비용 기반 옵티마이저(Cost-Based Optimizer)의 작동 원리, 비용 추정 요소, 통계와 선택도의 역할, 잘못된 플랜 대응 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "cbo", "optimizer", "query-plan", "explain", "statistics", "cost", "index", "performance"]
featured: false
draft: false
---

[지난 글](/posts/sql-index-not-used-patterns/)에서 인덱스가 사용되지 않는 패턴을 살펴봤다. 이번에는 그 결정을 내리는 주체인 **비용 기반 옵티마이저(CBO, Cost-Based Optimizer)**의 작동 원리를 파악한다.

---

## 옵티마이저의 역할

개발자가 작성한 SQL은 **"무엇을 원하는지"** 를 선언한다. 실제로 **"어떻게 가져올지"** 를 결정하는 것은 옵티마이저다. 테이블을 어떤 순서로 읽을지, 어떤 인덱스를 쓸지, 어떤 조인 알고리즘을 사용할지 모두 옵티마이저가 선택한다.

초기 RDB는 규칙 기반 옵티마이저(RBO)를 사용해 미리 정의된 우선순위로 플랜을 결정했다. 현대 데이터베이스는 **실제 데이터 통계**를 바탕으로 비용을 수치화하는 CBO를 사용한다.

---

## CBO 작동 흐름

![CBO 작동 흐름](/assets/posts/sql-cost-based-optimizer-flow.svg)

1. **파싱(Parsing)**: SQL 구문을 분석해 파스 트리를 생성한다.
2. **재작성(Rewrite)**: 뷰를 펼치고, 서브쿼리를 조인으로 변환하는 등 논리적 최적화를 수행한다.
3. **후보 플랜 생성**: 조인 순서 조합, 인덱스 사용 여부 등 가능한 실행 계획을 열거한다.
4. **비용 추정**: 각 후보 플랜에 대해 I/O·CPU 비용을 수치로 계산한다.
5. **최적 플랜 선택**: 비용이 가장 낮은 플랜을 실행 계획으로 확정한다.

---

## 비용 추정 요소

옵티마이저가 비용을 계산할 때 사용하는 주요 요소는 다음과 같다.

```sql
-- PostgreSQL 비용 파라미터 (기본값)
seq_page_cost    = 1.0   -- 순차 페이지 읽기 비용 기준
random_page_cost = 4.0   -- 랜덤 페이지 읽기 비용
cpu_tuple_cost   = 0.01  -- 행 처리 CPU 비용
cpu_index_tuple_cost = 0.005
cpu_operator_cost    = 0.0025
```

인덱스 스캔은 랜덤 I/O를 수반하므로 `random_page_cost`가 높을수록 Full Scan 대비 인덱스 스캔의 상대 비용이 높아진다. SSD 환경에서는 `random_page_cost`를 낮추면(예: 1.1~2.0) 인덱스 스캔이 더 자주 선택된다.

---

## 통계(Statistics)의 중요성

비용 추정의 정확도는 **통계 품질**에 달려 있다.

| 통계 항목 | 설명 |
|-----------|------|
| `reltuples` | 테이블 행 수 추정 |
| `n_distinct` | 고유값 수(NDV) |
| 히스토그램 | 값 분포 (Most Common Values + 버킷) |
| 상관계수 | 컬럼 값과 물리적 저장 순서의 상관 |

통계가 오래됐거나 대량 DML 후 갱신되지 않으면 옵티마이저가 행 수를 크게 잘못 추정해 비효율적인 플랜을 선택한다.

```sql
-- PostgreSQL: 테이블 통계 확인
SELECT relname, reltuples, relpages
FROM pg_class WHERE relname = 'orders';

-- 통계 갱신
ANALYZE orders;

-- MySQL: 통계 갱신
ANALYZE TABLE orders;
```

---

## 잘못된 플랜 대응 방법

![잘못된 플랜 대응 - 힌트와 통계 갱신](/assets/posts/sql-cost-based-optimizer-hints.svg)

옵티마이저가 나쁜 플랜을 고르는 상황에서 대응 우선순위는 다음과 같다.

1. **통계 갱신**: 대부분의 잘못된 플랜은 낡은 통계가 원인이다.
2. **쿼리 재작성**: 조건을 명확히 하거나 서브쿼리를 CTE로 분리한다.
3. **인덱스 추가·수정**: 옵티마이저가 더 효율적인 경로를 찾을 수 있도록 한다.
4. **힌트(Hint)**: 통계·쿼리·인덱스로 해결되지 않을 때 마지막 수단으로 사용한다.

### EXPLAIN ANALYZE로 플랜 확인

```sql
-- PostgreSQL: 예상 vs 실제 비용 확인
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM orders
WHERE user_id = 42 AND status = 'pending';
```

출력의 `rows=` (예상)와 `actual rows=` (실제)가 크게 다르면 통계를 갱신한다. `Buffers: shared hit=` 값이 크면 캐시를 많이 활용하고 있음을 나타낸다.

---

## CBO의 한계

- **카디널리티 추정 오류**: 복합 조건에서 컬럼 간 상관관계를 정확히 반영하지 못할 수 있다.
- **플랜 공간 폭발**: 조인이 많아질수록 후보 플랜 수가 기하급수적으로 늘어 탐색 시간이 증가한다(PostgreSQL의 경우 기본 8개 테이블 이상은 GEQO로 전환).
- **파라미터 스니핑**: 파라미터 값에 따라 최적 플랜이 달라지는데 캐시된 하나의 플랜을 재사용해 비효율이 생기는 문제(SQL Server에서 두드러짐).

---

**지난 글:** [인덱스가 사용되지 않는 패턴](/posts/sql-index-not-used-patterns/)

**다음 글:** [조인 알고리즘](/posts/sql-join-algorithms/)

<br>
읽어주셔서 감사합니다. 😊
