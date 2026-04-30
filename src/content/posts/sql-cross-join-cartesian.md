---
title: "CROSS JOIN과 카테시안 곱"
description: "CROSS JOIN의 의미와 카테시안 곱 발생 원리, 달력 생성·조합표·테스트 데이터 같은 실제 사용 사례, 그리고 ON 조건 누락으로 실수로 발생하는 카테시안 곱 방지법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "cross-join", "카테시안곱", "cartesian-product", "조인", "조합", "달력"]
featured: false
draft: false
---

[지난 글](/posts/sql-outer-join-left-right-full/)에서 LEFT·RIGHT·FULL OUTER JOIN의 동작 원리를 살펴봤다. 이번에는 모든 조인의 기반이 되는 개념인 카테시안 곱(Cartesian Product)과, 이를 의도적으로 활용하는 CROSS JOIN을 다룬다.

---

## 카테시안 곱이란

두 집합 A, B의 카테시안 곱은 A의 각 원소와 B의 각 원소를 짝지은 모든 쌍의 집합이다. A가 m개, B가 n개의 원소를 가지면 카테시안 곱은 **m × n개**의 쌍이 된다. SQL에서 CROSS JOIN이 이 연산을 그대로 구현한다.

```sql
-- CROSS JOIN 기본 문법
SELECT c.color, s.size
FROM colors c
CROSS JOIN sizes s;

-- colors(3행: Red, Blue, Green) × sizes(2행: S, M) = 6행 반환
```

ON 절이 없다. 두 테이블의 모든 행 조합을 빠짐없이 만든다.

![CROSS JOIN — 카테시안 곱](/assets/posts/sql-cross-join-cartesian-product.svg)

---

## 암묵적 CROSS JOIN

SQL-89 스타일에서 FROM 절에 테이블을 쉼표로 나열하면 카테시안 곱이 발생한다. WHERE에 조인 조건을 추가하면 사실상 INNER JOIN과 같은 동작이 된다.

```sql
-- 암묵적 CROSS JOIN (ON 조건 없으면 카테시안 곱)
SELECT * FROM orders, products;

-- WHERE로 필터하면 INNER JOIN과 동일
SELECT * FROM orders o, products p
WHERE p.id = o.product_id;
```

명시적 JOIN 문법이 권장되는 이유 중 하나가 바로 이것이다. `JOIN ... ON`을 사용하면 ON 없이는 문법 오류가 나므로 실수를 방지할 수 있다.

---

## CROSS JOIN의 실무 활용

CROSS JOIN이 의도적으로 필요한 상황이 있다. 가능한 모든 조합을 생성해야 할 때다.

![CROSS JOIN 실무 활용 패턴](/assets/posts/sql-cross-join-cartesian-usecases.svg)

### 달력·날짜 시리즈 생성

연속된 날짜 범위를 만들 때 CROSS JOIN 또는 `generate_series`를 활용한다.

```sql
-- PostgreSQL: 2024년 1월 모든 날짜 × 사용자
SELECT
    d.dt,
    u.id AS user_id
FROM generate_series(
    '2024-01-01'::date,
    '2024-01-31'::date,
    '1 day'::interval
) AS d(dt)
CROSS JOIN users u
ORDER BY u.id, d.dt;
```

이 패턴은 "사용자별 일별 데이터가 없는 날도 0으로 표시"해야 할 때 활용한다. CROSS JOIN으로 (날짜, 사용자) 전체 조합을 만든 뒤 LEFT JOIN으로 실제 데이터를 붙이는 방식이다.

### 상품 × 옵션 조합 생성

상품과 사이즈·색상 같은 옵션의 모든 조합을 미리 만들어야 할 때 사용한다.

```sql
-- 상품과 사이즈의 모든 조합
SELECT
    p.id AS product_id,
    p.name,
    s.label AS size
FROM products p
CROSS JOIN sizes s
ORDER BY p.id, s.sort_order;
```

재고 테이블이 (product_id, size) 복합키로 구성될 때 초기 데이터 삽입에 이 패턴을 쓴다.

### 통계 행렬 생성

모든 카테고리 쌍 간의 관계를 분석할 때 카테시안 곱이 필요하다.

```sql
-- 모든 카테고리 쌍 (자기 자신 제외)
SELECT a.name AS from_cat, b.name AS to_cat
FROM categories a
CROSS JOIN categories b
WHERE a.id <> b.id;
```

---

## 실수로 발생하는 카테시안 곱

ON 조건을 실수로 빠뜨리면 의도치 않은 카테시안 곱이 발생한다. 테이블이 크면 서버를 다운시킬 수 있다.

```sql
-- ✗ ON 누락 — orders(1만행) × products(1만행) = 1억행
SELECT o.id, p.name
FROM orders o
JOIN products p;  -- ON 없음!

-- ✓ ON 명시
SELECT o.id, p.name
FROM orders o
JOIN products p ON p.id = o.product_id;
```

복수의 JOIN이 있을 때 한 조인에만 ON을 빠뜨려도 결과가 폭발한다. `EXPLAIN`으로 실행 계획을 확인하면 카테시안 곱 경고를 발견할 수 있다.

---

## 성능 주의사항

| 테이블 A 행 수 | 테이블 B 행 수 | CROSS JOIN 결과 |
|----------------|----------------|-----------------|
| 100 | 100 | 10,000 |
| 1,000 | 1,000 | 1,000,000 |
| 10,000 | 10,000 | 100,000,000 |

CROSS JOIN을 사용하기 전에 결과 행 수를 반드시 계산한다. 두 테이블 크기의 곱이 허용 범위 안에 있는지 확인하고, 가능하면 WHERE나 CTE로 먼저 대상을 줄인 뒤 CROSS JOIN을 수행한다.

```sql
-- ✓ 대상 범위를 먼저 줄이고 CROSS JOIN
WITH active_users AS (
    SELECT id FROM users WHERE status = 'active'
),
current_products AS (
    SELECT id FROM products WHERE on_sale = true
)
SELECT u.id, p.id
FROM active_users u
CROSS JOIN current_products p;
```

---

**지난 글:** [OUTER JOIN — LEFT, RIGHT, FULL 완전 정리](/posts/sql-outer-join-left-right-full/)

**다음 글:** [셀프 조인과 계층형 데이터](/posts/sql-self-join-hierarchical/)

<br>
읽어주셔서 감사합니다. 😊
