---
title: "EXISTS와 NOT EXISTS — 반존재 조건 처리"
description: "EXISTS/NOT EXISTS의 단락 평가 원리, IN과의 성능 차이, NOT IN의 NULL 함정, LEFT JOIN + IS NULL 동치 패턴, 실무 적용 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["sql", "exists", "not-exists", "not-in", "null", "semi-join", "anti-join", "성능"]
featured: false
draft: false
---

[지난 글](/posts/sql-correlated-subquery/)에서 상관 서브쿼리의 실행 원리와 성능 문제를 살펴봤다. 이번에는 "존재하는가"를 묻는 **EXISTS**와 "존재하지 않는가"를 묻는 **NOT EXISTS**를 다룬다. IN과의 차이, 특히 NULL이 섞였을 때 NOT IN이 일으키는 조용한 버그를 이해하는 것이 핵심이다.

---

## EXISTS의 작동 원리

EXISTS는 서브쿼리가 **최소 한 행**이라도 반환하면 TRUE, 아무 행도 없으면 FALSE를 반환한다.

```sql
SELECT c.name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

SELECT 절에 `1`, `*`, `NULL` 무엇을 쓰든 결과는 같다. EXISTS는 값이 아니라 **행의 존재 여부**만 확인하기 때문이다. 관례적으로 `SELECT 1`이나 `SELECT *`를 쓴다.

---

## 단락 평가(Short-Circuit) — EXISTS의 성능 장점

![EXISTS 단락 평가 원리](/assets/posts/sql-exists-not-exists-shortcircuit.svg)

EXISTS는 조건을 만족하는 첫 행을 발견하는 즉시 서브쿼리 실행을 중단한다. `customer_id`에 인덱스가 있으면 인덱스 탐색 1건으로 끝난다. 반면 `IN (서브쿼리)`는 서브쿼리 전체를 실행해 해시 테이블이나 정렬 목록을 만든 뒤 체크한다.

```sql
-- 같은 의미지만 실행 방식이 다름
-- EXISTS: 첫 행 발견 즉시 중단
WHERE EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id)

-- IN: orders 전체 customer_id를 해시/정렬 후 체크
WHERE c.id IN (SELECT customer_id FROM orders)
```

최신 옵티마이저(PostgreSQL, Oracle 등)는 IN을 세미조인(semi-join)으로 변환하여 EXISTS와 동일한 계획을 내놓기도 한다. 그러나 NULL 처리 동작은 항상 다르다.

---

## NOT IN의 NULL 함정

NOT IN과 NOT EXISTS는 서브쿼리에 NULL이 포함될 때 전혀 다른 결과를 낸다.

```sql
-- orders.customer_id에 NULL이 있는 경우
-- NOT IN: 결과 항상 공집합 ← 버그
SELECT name FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);
```

이유는 3값 논리(Three-valued logic)에 있다. `1 NOT IN (2, 3, NULL)`은 `1<>2 AND 1<>3 AND 1<>NULL`인데, `1<>NULL`은 UNKNOWN이므로 AND 전체가 UNKNOWN → 해당 행 제외된다.

```sql
-- ✓ NOT EXISTS: NULL 안전
SELECT name FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

NOT EXISTS는 서브쿼리가 행을 반환하지 않을 때 TRUE이므로 NULL 영향을 받지 않는다.

![EXISTS vs IN vs JOIN 비교](/assets/posts/sql-exists-not-exists-comparison.svg)

---

## LEFT JOIN + IS NULL — NOT EXISTS 동치

NOT EXISTS는 LEFT JOIN + IS NULL 패턴으로도 표현할 수 있다.

```sql
-- NOT EXISTS와 동일 결과
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.customer_id IS NULL;    -- 조인 성공한 행 제외 = 주문 없는 고객
```

이 패턴은 NULL에 안전하고, 일부 옵티마이저에서 NOT EXISTS보다 좋은 계획이 나오기도 한다. 단, LEFT JOIN이 1:N 관계라면 중복 행이 발생할 수 있어 `SELECT DISTINCT`가 필요할 수 있다.

---

## 실무 패턴

**세미조인(EXISTS)** — 관련 행이 있는 주 테이블 행 조회

```sql
-- 리뷰를 작성한 사용자만 조회
SELECT u.id, u.name FROM users u
WHERE EXISTS (SELECT 1 FROM reviews r WHERE r.user_id = u.id);
```

**안티조인(NOT EXISTS)** — 관련 행이 없는 주 테이블 행 조회

```sql
-- 한 번도 로그인하지 않은 사용자
SELECT u.id, u.name FROM users u
WHERE NOT EXISTS (SELECT 1 FROM login_logs l WHERE l.user_id = u.id);
```

**서브쿼리 내 집계 조건**

```sql
-- 주문 합계가 100만 원 이상인 고객
SELECT c.name FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id
    GROUP BY o.customer_id
    HAVING SUM(o.amount) >= 1000000
);
```

---

## EXISTS vs IN 선택 기준

| 상황 | 권장 |
|---|---|
| 서브쿼리 결과에 NULL 가능성 | `EXISTS` / `NOT EXISTS` |
| 서브쿼리 결과 목록이 고정·소규모 | `IN (값 목록)` |
| 단순 존재 확인, 대규모 | `EXISTS` (Short-Circuit) |
| NOT 반전 조건 | `NOT EXISTS` (NOT IN은 NULL 주의) |
| 이식성 중요 | `EXISTS` (모든 DBMS 지원) |

---

**지난 글:** [상관 서브쿼리 — 외부 쿼리를 참조하는 서브쿼리](/posts/sql-correlated-subquery/)

**다음 글:** [ANY · ALL · SOME — 집합 비교 연산자](/posts/sql-any-all-some/)

<br>
읽어주셔서 감사합니다. 😊
