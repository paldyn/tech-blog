---
title: "복합 인덱스 컬럼 순서"
description: "복합 인덱스(Composite Index)에서 컬럼 순서가 성능에 미치는 영향, Leftmost Prefix 규칙, 등호 우선·선택도·쿼리 패턴·정렬 컬럼을 고려한 순서 결정 원칙을 실전 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["sql", "composite-index", "column-order", "leftmost-prefix", "optimizer", "explain", "performance", "index-design"]
featured: false
draft: false
---

[지난 글](/posts/sql-btree-structure/)에서 B-Tree 인덱스 구조와 스캔 유형을 살펴봤다. 이번에는 실무에서 가장 자주 틀리는 **복합 인덱스 컬럼 순서** 문제를 다룬다.

---

## 왜 순서가 중요한가

복합 인덱스 `(A, B, C)`는 키를 A 기준으로 정렬하고, A가 같으면 B 기준으로, B까지 같으면 C 기준으로 정렬해 저장한다. 이 정렬 구조 때문에 **A를 건너뛰고 B나 C만 조건으로 사용하면 인덱스를 활용할 수 없다.**

---

## Leftmost Prefix 규칙

![복합 인덱스 Leftmost Prefix](/assets/posts/sql-composite-index-column-order-prefix.svg)

`INDEX (status, region, created_at)` 생성 시 사용 가능한 조합:

```sql
-- 사용 가능
WHERE status = 'pending'                                          -- A
WHERE status = 'pending' AND region = 'KR'                       -- A+B
WHERE status = 'pending' AND region = 'KR' AND created_at > now() -- A+B+C

-- 사용 불가 (A 없음)
WHERE region = 'KR'                       -- B만
WHERE created_at > now()                  -- C만
WHERE region = 'KR' AND created_at > now() -- B+C

-- 부분 사용 (A만 인덱스, C는 Filter)
WHERE status = 'pending' AND created_at > now()  -- A+C (B 스킵 → A까지만)
```

---

## 순서 결정 원칙

![복합 인덱스 설계 원칙](/assets/posts/sql-composite-index-column-order-design.svg)

### 원칙 1: 등호(=) 조건 컬럼을 먼저

범위 조건(>, <, BETWEEN, LIKE 'x%')은 해당 컬럼 이후의 인덱스 컬럼을 사용할 수 없게 만든다. 등호 조건을 앞에 두면 범위 조건 이전의 모든 컬럼을 인덱스로 걸러낸 뒤 범위를 적용한다.

```sql
-- 쿼리: WHERE status = 'pending' AND created_at > '2026-01-01'
-- 좋음: 등호 먼저
CREATE INDEX idx_good ON orders (status, created_at);
-- status로 좁힌 후 created_at 범위 → 두 컬럼 모두 활용

-- 나쁨: 범위 먼저
CREATE INDEX idx_bad ON orders (created_at, status);
-- created_at 범위 스캔 후 status는 Index Filter만 → created_at만 활용
```

### 원칙 2: 선택도(Selectivity) 고려

선택도가 높은(값이 많이 분산된) 컬럼을 앞에 두면 초기에 더 많이 걸러낸다. 단, 원칙 1(등호 먼저)이 우선이다.

```sql
-- user_id: 선택도 0.0001% (1/100만)
-- status:  선택도 20% (5가지 값)
-- 등호 조건이 둘 다 있을 때는 user_id가 선택도 높으므로 먼저
CREATE INDEX ON orders (user_id, status);
-- user_id='U123' AND status='pending' 쿼리에 최적
```

### 원칙 3: 실제 쿼리 패턴 매칭

가장 중요한 쿼리의 WHERE 절 구조에 맞게 인덱스를 설계한다.

```sql
-- 주요 쿼리 패턴 분석
-- Q1: WHERE dept_id = ? AND salary > ?       → (dept_id, salary)
-- Q2: WHERE dept_id = ? AND hire_date > ?    → (dept_id, hire_date)
-- Q3: WHERE dept_id = ? AND grade = ?        → (dept_id, grade)

-- dept_id는 공통 → dept_id를 첫 번째로
-- Q1 전용: CREATE INDEX ON employees (dept_id, salary);
-- Q2 전용: CREATE INDEX ON employees (dept_id, hire_date);
-- Q1+Q2 겸용 가능? dept_id만 공통으로 묶을 수 있음
-- Q3처럼 등호면 이후 컬럼 추가 가능
```

### 원칙 4: ORDER BY 컬럼 포함으로 filesort 제거

```sql
-- 쿼리: WHERE status='pending' ORDER BY created_at DESC LIMIT 20
-- 이 인덱스면 filesort 없이 인덱스 순서로 정렬 완료
CREATE INDEX ON orders (status, created_at DESC);

-- MySQL에서 확인
EXPLAIN SELECT * FROM orders
 WHERE status='pending' ORDER BY created_at DESC LIMIT 20;
-- Extra: Using index  ← filesort 없음
```

---

## EXPLAIN으로 컬럼 순서 효과 확인

```sql
-- PostgreSQL: 두 인덱스 비교
CREATE INDEX idx_a ON orders (status, created_at);
CREATE INDEX idx_b ON orders (created_at, status);

-- 쿼리: WHERE status = 'pending' AND created_at > '2026-01-01'
EXPLAIN SELECT * FROM orders
 WHERE status = 'pending' AND created_at > '2026-01-01';

-- idx_a 사용 시:
-- Index Scan using idx_a on orders
--   Index Cond: ((status = 'pending') AND (created_at > '2026-01-01'))
--   (두 컬럼 모두 Index Cond)

-- idx_b 사용 시:
-- Index Scan using idx_b on orders
--   Index Cond: (created_at > '2026-01-01')
--   Filter: (status = 'pending')  ← status는 Index Filter에서만
```

`Index Cond`에 컬럼이 있으면 인덱스 레벨에서 필터링, `Filter`에 있으면 가져온 후 걸러낸다. 더 많은 컬럼이 `Index Cond`에 있을수록 효율적이다.

---

## 실전: 인덱스 설계 예시

```sql
-- 주문 목록 조회 쿼리 (전형적 패턴)
SELECT * FROM orders
 WHERE customer_id = ?          -- 등호, 선택도 높음
   AND status IN ('pending', 'processing')  -- 등호 변형
   AND created_at > NOW() - INTERVAL '30 days'  -- 범위
 ORDER BY created_at DESC
 LIMIT 20;

-- 권장 인덱스
CREATE INDEX idx_orders_perf ON orders
    (customer_id, status, created_at DESC);
-- customer_id = (등호, 선택도 높음) → 먼저
-- status IN (등호 변형) → 두 번째
-- created_at DESC (범위 + ORDER BY) → 마지막
```

---

## 복합 인덱스로 여러 단일 인덱스 대체

```sql
-- 비효율: 개별 인덱스 3개
CREATE INDEX ON orders (status);
CREATE INDEX ON orders (customer_id);
CREATE INDEX ON orders (created_at);

-- 효율적: 복합 인덱스 1개로 대부분의 쿼리 커버
CREATE INDEX ON orders (customer_id, status, created_at);
-- + customer_id 단독 인덱스 역할도 수행 (Leftmost Prefix)
```

인덱스는 DML(INSERT/UPDATE/DELETE) 성능에 오버헤드를 준다. 필요한 인덱스만 유지하고, 복합 인덱스로 단일 인덱스를 통합하는 것이 좋다.

---

**지난 글:** [B-Tree 인덱스 구조](/posts/sql-btree-structure/)

**다음 글:** [커버링 인덱스](/posts/sql-covering-index/)

<br>
읽어주셔서 감사합니다. 😊
