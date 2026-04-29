---
title: "별칭(Alias)과 쿼리 가독성"
description: "SQL 컬럼 별칭과 테이블 별칭(AS)의 문법, 사용 범위 제약, 좋은 별칭 짓기 원칙, 그리고 중첩 서브쿼리를 CTE로 리팩터링해 가독성을 높이는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["sql", "alias", "as", "readability", "cte", "inline-view", "가독성", "쿼리품질"]
featured: false
draft: false
---

[지난 글](/posts/sql-distinct-cost/)에서 DISTINCT의 비용과 대안을 살펴봤다. 이번에는 쿼리를 더 읽기 쉽게 만들어주는 별칭(Alias)과 가독성 향상 기법을 다룬다.

---

## 컬럼 별칭

컬럼 별칭은 결과 집합에서 컬럼 이름을 바꾸거나, 표현식에 이름을 붙인다.

```sql
-- AS 키워드 사용 (명시적, 권장)
SELECT
    first_name  AS name,
    salary * 1.1 AS new_salary,
    dept_id     AS department
FROM employees;

-- AS 생략 가능 (일부 DB에서만, 권장하지 않음)
SELECT salary monthly FROM employees;

-- 공백 포함 별칭: 큰따옴표(표준) 또는 백틱(MySQL)
SELECT salary AS "Monthly Salary" FROM employees;
SELECT salary AS `Monthly Salary` FROM employees;  -- MySQL
```

![컬럼 별칭과 테이블 별칭](/assets/posts/sql-aliases-readability-types.svg)

---

## 테이블 별칭

긴 테이블명을 짧게 줄이고, 특히 JOIN이나 셀프 조인에서 필수적이다.

```sql
-- 긴 테이블명 축약
SELECT e.name, d.dept_name
FROM employees AS e
JOIN departments AS d ON d.id = e.dept_id;

-- 서브쿼리(인라인 뷰)에는 별칭 필수
SELECT * FROM (
    SELECT user_id, COUNT(*) AS cnt
    FROM orders
    GROUP BY user_id
) AS order_counts        -- 별칭 없으면 에러
WHERE cnt > 5;
```

테이블 별칭을 지정하면 쿼리 내 어디서든 원래 테이블명 대신 별칭을 써야 한다.

---

## 별칭의 유효 범위

컬럼 별칭은 **ORDER BY에서만** 재사용할 수 있다. WHERE, GROUP BY, HAVING은 SELECT 전에 실행되므로 별칭이 아직 정의되지 않은 상태다.

```sql
-- ✗ WHERE에서 컬럼 별칭 불가
SELECT salary * 1.1 AS new_salary
FROM employees
WHERE new_salary > 50000;  -- column "new_salary" does not exist

-- ✓ 표현식 반복
WHERE salary * 1.1 > 50000

-- ✓ ORDER BY에서는 가능
SELECT salary * 1.1 AS new_salary
FROM employees
ORDER BY new_salary DESC;  -- 정상 동작
```

PostgreSQL에서는 GROUP BY에서도 SELECT 별칭을 허용하지만, 표준은 아니다.

---

## 좋은 별칭 짓기 원칙

1. **의미를 전달하라** — `e`보다 `emp`, `u`보다 `usr`이 낫다. 단, JOIN이 2개 이하면 초성 약어도 충분하다.
2. **일관성 유지** — 같은 쿼리 내에서 동일 테이블은 항상 같은 별칭을 사용한다.
3. **영어 소문자 snake_case** — `totalPrice`보다 `total_price`가 SQL 스타일에 맞다.
4. **SQL 예약어 피하기** — `name`, `date`, `order` 같은 단어는 혼란을 줄 수 있다.

```sql
-- ✗ 의미 불명확
SELECT o.id, u.n FROM orders o JOIN users u ON ...

-- ✓ 의미 전달
SELECT ord.id AS order_id, usr.name AS customer_name
FROM orders AS ord
JOIN users AS usr ON usr.id = ord.user_id;
```

---

## 인라인 뷰 vs CTE — 가독성 관점

중첩 서브쿼리가 깊어지면 읽기 어렵다. CTE(`WITH` 절)로 분리하면 각 단계에 이름을 붙여 의도를 명확하게 표현할 수 있다.

```sql
-- CTE: 의미 단위로 이름 붙이기
WITH
active_users AS (
    SELECT id, name FROM users WHERE active = true
),
user_orders AS (
    SELECT user_id, COUNT(*) AS order_cnt
    FROM orders
    GROUP BY user_id
)
SELECT au.name, uo.order_cnt
FROM active_users AS au
JOIN user_orders AS uo ON uo.user_id = au.id
WHERE uo.order_cnt >= 3
ORDER BY uo.order_cnt DESC;
```

CTE는 복잡한 쿼리를 읽기 쉬운 여러 단계로 나눈다. `active_users`, `user_orders`라는 이름만으로 각 블록의 역할이 명확해진다.

![인라인 뷰 vs CTE 가독성 비교](/assets/posts/sql-aliases-readability-cte.svg)

---

## 유지보수 관점

좋은 별칭은 쿼리 유지보수 비용을 줄인다. 6개월 뒤에 자신이 쓴 쿼리를 다시 볼 때, 또는 팀원이 쿼리를 수정할 때 이름이 의도를 전달해야 한다.

- 테이블 별칭: JOIN 대상이 분명해지도록 의미 있게
- 컬럼 별칭: 표현식의 비즈니스 의미를 이름으로 표현
- CTE 이름: 해당 집합이 무엇을 나타내는지 설명하는 명사

---

**지난 글:** [DISTINCT의 비용과 대안](/posts/sql-distinct-cost/)

**다음 글:** [INNER JOIN — 가장 기본적인 조인](/posts/sql-inner-join/)

<br>
읽어주셔서 감사합니다. 😊
