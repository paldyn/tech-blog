---
title: "INNER JOIN — 가장 기본적인 조인"
description: "SQL INNER JOIN의 의미와 동작 방식, ON 절 작성법, 다중 테이블 JOIN, 암묵적 조인과의 차이, ON vs WHERE 조건의 위치 문제, 그리고 인덱스 활용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["sql", "inner-join", "join", "on", "multi-join", "카테시안곱", "조인", "인덱스"]
featured: false
draft: false
---

[지난 글](/posts/sql-aliases-readability/)에서 별칭과 쿼리 가독성을 살펴봤다. 이번에는 SQL에서 가장 자주 쓰이는 조인인 INNER JOIN을 다룬다.

---

## INNER JOIN이란

INNER JOIN은 두 테이블에서 **ON 조건이 일치하는 행만** 반환한다. 수학적으로는 교집합(∩)과 같다. 어느 한 쪽에만 있는 행은 결과에 포함되지 않는다.

```sql
-- INNER JOIN 기본 문법
SELECT u.id, u.name, o.id AS order_id
FROM users AS u
INNER JOIN orders AS o ON o.user_id = u.id;

-- INNER 키워드 생략 가능 (기본값이 INNER)
SELECT u.id, u.name, o.id
FROM users u
JOIN orders o ON o.user_id = u.id;
```

![INNER JOIN 벤 다이어그램과 결과](/assets/posts/sql-inner-join-venn.svg)

---

## 동작 방식

1. FROM 절에서 첫 번째 테이블(드라이빙 테이블)의 행을 읽는다.
2. 각 행에 대해 두 번째 테이블에서 ON 조건을 만족하는 행을 찾는다.
3. 양쪽 모두에서 매칭이 성립한 행 쌍만 결과에 포함한다.

ON 조건에 매칭 행이 없으면 해당 행은 결과에서 제외된다. 이것이 INNER JOIN과 OUTER JOIN의 핵심 차이다.

---

## ON 절

ON 절에는 조인 조건을 작성한다. 등호(`=`) 외에도 범위 조건이나 함수를 사용할 수 있다.

```sql
-- 등호 조인 (가장 일반적)
JOIN orders o ON o.user_id = u.id

-- 범위 조인 (비등가 조인)
JOIN price_ranges pr ON p.price BETWEEN pr.min_price AND pr.max_price

-- 복합 조건
JOIN discounts d ON d.user_id = u.id AND d.valid_until >= CURRENT_DATE
```

등호 이외의 조건을 사용하는 **비등가 조인(Non-Equi Join)**은 카디널리티가 높으면 성능 문제가 생길 수 있다.

---

## 다중 테이블 JOIN

JOIN을 반복해 세 개 이상의 테이블을 연결할 수 있다. 옵티마이저가 실제 실행 순서를 결정하지만, 논리적으로는 왼쪽에서 오른쪽으로 순서대로 처리된다고 이해하면 된다.

```sql
SELECT o.id, u.name, p.title, oi.quantity
FROM orders o
JOIN users u        ON u.id = o.user_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p     ON p.id = oi.product_id
WHERE o.status = 'paid';
```

모든 JOIN이 성립하는 행만 반환된다. 한 단계라도 매칭이 안 되면 그 행은 제외된다.

![INNER JOIN 실전 패턴](/assets/posts/sql-inner-join-patterns.svg)

---

## 암묵적 조인 vs 명시적 JOIN

SQL-89 스타일의 암묵적 조인은 `FROM table1, table2 WHERE 조건` 형태다. 명시적 JOIN과 결과는 같지만 사용을 권장하지 않는다.

```sql
-- ✗ 암묵적 조인 (SQL-89 스타일)
SELECT u.name, o.amount
FROM users u, orders o
WHERE o.user_id = u.id;

-- ✓ 명시적 INNER JOIN (권장)
SELECT u.name, o.amount
FROM users u
JOIN orders o ON o.user_id = u.id;
```

암묵적 조인에서 WHERE 조건을 빠뜨리면 카테시안 곱(모든 조합)이 발생한다. 명시적 JOIN은 ON이 없으면 문법 오류를 내므로 실수를 방지할 수 있다.

---

## INNER JOIN에서 ON vs WHERE

INNER JOIN에서는 조인 조건을 ON에 두든 WHERE에 두든 결과가 같다.

```sql
-- 아래 두 쿼리는 동일한 결과
SELECT u.name, o.amount
FROM users u
JOIN orders o ON o.user_id = u.id AND o.status = 'paid';

SELECT u.name, o.amount
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.status = 'paid';
```

단, **OUTER JOIN에서는 ON과 WHERE의 위치에 따라 결과가 달라진다.** 다음 편에서 자세히 다룬다.

---

## 성능 — JOIN 인덱스

JOIN 성능의 핵심은 ON 절의 컬럼에 인덱스가 있는지 여부다. 특히 드리븐 테이블(두 번째 테이블)의 조인 컬럼에 인덱스가 없으면 행마다 전체 스캔이 발생한다.

```sql
-- users.id (PK): 인덱스 있음
-- orders.user_id: 인덱스 없으면 풀 스캔

-- 권장: FK 컬럼에 인덱스 생성
CREATE INDEX idx_orders_user_id ON orders (user_id);
```

옵티마이저는 통계 정보를 바탕으로 어느 테이블을 드라이빙으로 사용할지, 어떤 조인 알고리즘(Nested Loop, Hash, Merge)을 사용할지 결정한다.

---

**지난 글:** [별칭(Alias)과 쿼리 가독성](/posts/sql-aliases-readability/)

<br>
읽어주셔서 감사합니다. 😊
