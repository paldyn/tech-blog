---
title: "다중 JOIN 쿼리 가독성"
description: "세 개 이상 테이블을 JOIN할 때 쿼리를 읽기 쉽게 구성하는 방법, 별칭 일관성·ON 정렬·들여쓰기 관례, 그리고 다중 JOIN에서 흔히 빠지는 함정과 CTE 분리 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["sql", "join", "가독성", "readability", "별칭", "alias", "다중조인", "코드스타일"]
featured: false
draft: false
---

[지난 글](/posts/sql-natural-join-using/)에서 NATURAL JOIN과 USING이 실무에서 기피되는 이유를 살펴봤다. 이번에는 실무에서 가장 자주 만나는 상황인 **세 개 이상 테이블을 JOIN하는 쿼리**를 어떻게 읽기 쉽게 작성하는지 다룬다. 가독성은 단순한 미관이 아니라 버그를 줄이고 유지보수 속도를 높이는 실질적인 도구다.

---

## 가독성이 중요한 이유

JOIN이 세 개를 넘으면 쿼리가 길어지고, 어떤 테이블의 어떤 컬럼이 어떻게 연결되는지 파악하기 어려워진다. 명확하게 구조화되지 않은 쿼리는 조건 하나를 수정하려 해도 전체를 다시 읽어야 한다.

![다중 JOIN 구조화 원칙](/assets/posts/sql-multi-join-readability-structure.svg)

---

## 원칙 1 — 별칭(Alias) 일관성

모든 테이블에 짧고 의미 있는 별칭을 붙인다. 관례는 테이블 이름의 이니셜을 쓰는 것이다. 한 쿼리에서 같은 테이블이 여러 번 등장할 경우 역할을 나타내는 이름을 쓴다.

```sql
-- ✓ 일관된 별칭 — 읽을 때 테이블 맥락이 명확
SELECT
    o.id        AS order_id,
    u.name      AS customer,
    p.title     AS product,
    oi.quantity
FROM orders         o
JOIN users          u   ON u.id = o.user_id
JOIN order_items    oi  ON oi.order_id = o.id
JOIN products       p   ON p.id = oi.product_id;

-- ✗ 별칭 없이 풀네임 반복 — 장황하고 오타 위험
SELECT orders.id, users.name, products.title, order_items.quantity
FROM orders
JOIN users ON users.id = orders.user_id
...
```

별칭 없이 풀 테이블명을 반복하면 쿼리가 길어지고 오타로 인한 오류 위험이 높다.

---

## 원칙 2 — JOIN 줄바꿈과 ON 들여쓰기

JOIN 키워드와 테이블은 한 줄에, ON 조건은 들여쓰기해서 소속을 명확히 한다.

```sql
-- ✓ JOIN 한 줄 + ON 들여쓰기
FROM orders o
    JOIN users u
        ON u.id = o.user_id
    JOIN order_items oi
        ON oi.order_id = o.id
    LEFT JOIN coupons c
        ON c.order_id = o.id
       AND c.valid_until >= CURRENT_DATE;

-- ✗ 한 줄에 나열
FROM orders o JOIN users u ON u.id = o.user_id JOIN order_items oi ON oi.order_id = o.id
```

ON 조건이 복수일 때도 AND를 ON 아래 정렬해 가독성을 유지한다.

---

## 원칙 3 — 조인 조건과 필터 조건 분리

ON에는 **조인 관계**만, WHERE에는 **결과 필터링**만 둔다. 혼용하면 OUTER JOIN에서 의도와 다른 결과가 나오고, 쿼리를 읽는 사람도 조인 구조와 필터 의도를 동시에 파악해야 하는 인지 부하가 생긴다.

```sql
-- ✓ ON = 조인 관계, WHERE = 비즈니스 필터
FROM orders o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN coupons c
        ON c.order_id = o.id          -- 조인 조건
       AND c.is_valid = true          -- 이 조건은 LEFT JOIN 보존을 위해 ON에
WHERE o.status = 'paid'               -- 필터 조건
  AND u.country = 'KR';
```

---

## 원칙 4 — SELECT 컬럼에 접두사 명시

조인 쿼리에서 SELECT 컬럼은 **반드시 테이블 접두사**를 붙인다. 어느 테이블에서 온 값인지 명확해지고, 나중에 테이블 구조가 바뀌었을 때 컬럼 충돌 오류를 즉시 발견할 수 있다.

```sql
-- ✗ 어느 테이블 컬럼인지 불분명
SELECT id, name, amount, title, created_at

-- ✓ 접두사로 출처 명확히
SELECT
    o.id        AS order_id,
    u.name      AS customer_name,
    o.amount,
    p.title     AS product_title,
    o.created_at
```

![나쁜 예 vs 좋은 예](/assets/posts/sql-multi-join-readability-example.svg)

---

## 복잡한 조인은 CTE로 분리

JOIN이 5개를 넘거나 서브쿼리가 섞이면 CTE로 단계를 나누는 것이 좋다.

```sql
-- CTE로 복잡한 조인 분리
WITH paid_orders AS (
    SELECT o.id, o.user_id, o.amount
    FROM orders o
    WHERE o.status = 'paid'
),
order_details AS (
    SELECT po.id, po.amount, oi.product_id, oi.quantity
    FROM paid_orders po
    JOIN order_items oi ON oi.order_id = po.id
)
SELECT
    od.id,
    u.name,
    p.title,
    od.quantity,
    od.amount
FROM order_details od
JOIN users      u ON u.id = od.user_id
JOIN products   p ON p.id = od.product_id;
```

CTE는 쿼리를 '단계'로 읽게 만들어 전체 로직의 흐름을 이해하기 쉽게 한다. 옵티마이저가 CTE를 인라인 뷰로 처리하는지 여부는 DB마다 다르므로 성능에 영향이 없는지 실행 계획으로 확인한다.

---

## 흔한 함정 — 같은 테이블 두 번 JOIN

같은 테이블을 두 번 JOIN해야 할 때 별칭으로 구분한다. 혼용하면 어느 쪽 데이터인지 파악하기 어렵다.

```sql
-- 배송지와 청구지가 모두 addresses 테이블에 있을 때
SELECT
    o.id,
    ship_addr.line1  AS ship_address,
    bill_addr.line1  AS bill_address
FROM orders o
JOIN addresses ship_addr ON ship_addr.id = o.ship_address_id
JOIN addresses bill_addr ON bill_addr.id = o.bill_address_id;
```

---

**지난 글:** [NATURAL JOIN과 USING 절](/posts/sql-natural-join-using/)

**다음 글:** [JOIN 순서와 성능](/posts/sql-join-order-performance/)

<br>
읽어주셔서 감사합니다. 😊
