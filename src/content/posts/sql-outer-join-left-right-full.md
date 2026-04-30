---
title: "OUTER JOIN — LEFT, RIGHT, FULL 완전 정리"
description: "LEFT OUTER JOIN, RIGHT OUTER JOIN, FULL OUTER JOIN의 차이와 동작 원리, ON 조건과 WHERE 조건 위치에 따른 결과 차이, 실무에서 가장 많이 쓰는 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "outer-join", "left-join", "right-join", "full-outer-join", "null", "on", "where", "조인"]
featured: false
draft: false
---

[지난 글](/posts/sql-inner-join/)에서 INNER JOIN의 동작 원리와 ON 조건 작성법을 살펴봤다. INNER JOIN은 양쪽에 모두 매칭되는 행만 반환한다. 그러나 실무에서는 한쪽에 데이터가 없더라도 결과에 포함해야 하는 상황이 훨씬 많다. 이때 사용하는 것이 OUTER JOIN이다.

---

## OUTER JOIN의 핵심 개념

OUTER JOIN은 한 테이블의 행을 **조인 조건과 무관하게 모두 보존**한다. 상대 테이블에 매칭 행이 없으면 해당 컬럼에 NULL이 채워진다. 방향에 따라 LEFT, RIGHT, FULL 세 가지로 나뉜다.

```sql
-- LEFT OUTER JOIN (OUTER 생략 가능)
SELECT u.name, o.amount
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;

-- RIGHT OUTER JOIN
SELECT u.name, o.amount
FROM users u
RIGHT JOIN orders o ON o.user_id = u.id;

-- FULL OUTER JOIN
SELECT u.name, o.amount
FROM users u
FULL OUTER JOIN orders o ON o.user_id = u.id;
```

![OUTER JOIN 종류별 결과 비교](/assets/posts/sql-outer-join-left-right-full-venn.svg)

---

## LEFT OUTER JOIN

FROM 절 왼쪽 테이블의 **모든 행**을 반환한다. 오른쪽 테이블에서 ON 조건을 만족하는 행이 없으면 오른쪽 컬럼이 NULL로 채워진다.

```sql
-- 주문이 없는 사용자도 포함
SELECT u.id, u.name, o.id AS order_id, o.amount
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;

-- users: Alice(1), Bob(2), Carol(3)
-- orders: 101(user_id=1), 102(user_id=2)
-- 결과:
--   1  Alice  101  5000
--   2  Bob    102  3000
--   3  Carol  NULL NULL   ← 주문 없음, NULL 채움
```

실무에서 가장 흔히 쓰이는 OUTER JOIN이다. "모든 사용자와 그들의 최근 주문"처럼 기준 테이블을 왼쪽에 두고 관련 데이터를 선택적으로 붙이는 패턴에 맞다.

---

## RIGHT OUTER JOIN

오른쪽 테이블의 **모든 행**을 보존한다. LEFT JOIN을 테이블 순서만 바꾼 것과 논리적으로 동일하다. 실무에서는 LEFT JOIN으로 테이블 순서를 바꾸는 방식이 더 읽기 쉬워서 RIGHT JOIN은 잘 사용하지 않는다.

```sql
-- 아래 두 쿼리는 결과가 같다
SELECT u.name, o.amount
FROM users u RIGHT JOIN orders o ON o.user_id = u.id;

SELECT u.name, o.amount
FROM orders o LEFT JOIN users u ON u.id = o.user_id;
```

---

## FULL OUTER JOIN

양쪽 테이블의 **모든 행**을 보존한다. 어느 쪽에도 매칭이 없는 행은 상대편 컬럼에 NULL이 채워진다. 두 테이블 간 데이터 불일치를 찾거나 마이그레이션 검증에 유용하다.

```sql
-- 데이터 정합성 검사: 양쪽에 없는 행 찾기
SELECT a.id AS a_id, b.id AS b_id
FROM table_a a
FULL OUTER JOIN table_b b ON a.key = b.key
WHERE a.id IS NULL OR b.id IS NULL;
```

MySQL은 FULL OUTER JOIN을 지원하지 않는다. LEFT JOIN + UNION + RIGHT JOIN으로 우회한다.

```sql
-- MySQL에서 FULL OUTER JOIN 대체
SELECT u.name, o.amount FROM users u LEFT JOIN orders o ON o.user_id = u.id
UNION
SELECT u.name, o.amount FROM users u RIGHT JOIN orders o ON o.user_id = u.id;
```

---

## ON vs WHERE — 결과가 달라지는 함정

OUTER JOIN에서 가장 자주 나오는 실수다. 추가 조건을 ON에 두는지 WHERE에 두는지에 따라 결과가 달라진다.

![OUTER JOIN에서 ON vs WHERE 조건 위치](/assets/posts/sql-outer-join-left-right-full-on-where.svg)

```sql
-- ON에 조건: LEFT JOIN 특성 유지
-- orders에 status='paid'가 없으면 NULL로 보존
SELECT u.name, o.amount
FROM users u
LEFT JOIN orders o
  ON o.user_id = u.id AND o.status = 'paid';
-- 결과: Alice(5000), Bob(NULL), Carol(NULL) → 3행

-- WHERE에 조건: NULL 행이 탈락 → INNER JOIN과 동일 효과
SELECT u.name, o.amount
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.status = 'paid';
-- 결과: Alice(5000) → 1행만 반환
```

LEFT JOIN을 쓰면서 WHERE에 오른쪽 테이블의 조건을 두면 NULL 행이 모두 필터되어 INNER JOIN과 같아진다. "왜 LEFT JOIN인데 모든 행이 안 나오지?"라는 질문의 원인 대부분이 이 패턴이다.

**규칙**: 오른쪽 테이블의 **조인 관련 필터**는 ON에, 전체 결과에 대한 **후처리 필터**는 WHERE에 둔다.

---

## NULL 확인 패턴 — 매칭 없는 행만 추출

LEFT JOIN의 NULL을 역으로 활용해 상대 테이블에 없는 행을 추출할 수 있다.

```sql
-- 주문이 한 건도 없는 사용자
SELECT u.id, u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.user_id IS NULL;

-- NOT EXISTS와 동일한 결과
SELECT id, name FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);
```

두 방법의 결과는 같지만 NOT EXISTS는 매칭 행이 발견되는 순간 탐색을 멈추므로 일치 행이 많을 때 더 효율적인 경우가 있다. 옵티마이저에 따라 실행 계획이 동일해지기도 한다.

---

## 실무 요약

| 상황 | 권장 JOIN |
|------|-----------|
| 기준 테이블 보존, 관련 데이터 선택적 포함 | LEFT JOIN |
| 양쪽 불일치 행 검출 | FULL OUTER JOIN |
| "없는 것" 찾기 | LEFT JOIN + WHERE 오른쪽 IS NULL |
| RIGHT JOIN 필요 | 테이블 순서 바꿔 LEFT JOIN 사용 |

---

**지난 글:** [INNER JOIN — 가장 기본적인 조인](/posts/sql-inner-join/)

**다음 글:** [CROSS JOIN과 카테시안 곱](/posts/sql-cross-join-cartesian/)

<br>
읽어주셔서 감사합니다. 😊
