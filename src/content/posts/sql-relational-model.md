---
title: "관계 모델의 수학적 기초 — 릴레이션, 속성, 튜플"
description: "E. F. Codd가 제안한 관계 모델의 이론적 토대를 살펴봅니다. 도메인, 속성, 튜플, 릴레이션, 스키마의 정의와 관계 대수 6가지 기본 연산이 SQL에 어떻게 대응되는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["SQL", "관계모델", "릴레이션", "관계대수", "Codd", "튜플", "도메인"]
featured: false
draft: false
---

[지난 글](/posts/sql-what-is-rdb/)에서 관계형 데이터베이스의 탄생 배경과 핵심 개념을 개괄적으로 다뤘다. 이번에는 그 수학적 토대인 **관계 모델(Relational Model)**을 좀 더 엄밀하게 살펴본다. 이론이 지루하게 느껴질 수 있지만, 관계 모델을 이해해야 설계와 최적화에서 "왜 이렇게 해야 하는가"라는 질문에 스스로 답할 수 있다.

## E. F. Codd와 관계 모델

1970년 Edgar F. Codd는 IBM 연구 논문 "A Relational Model of Data for Large Shared Data Banks"에서 관계 모델을 제안했다. 당시 DBMS는 계층형(IMS)이나 망형(CODASYL) 구조였는데, 이들은 데이터에 접근하려면 포인터를 따라가는 네비게이션 방식을 사용했다. Codd는 이를 집합론(Set Theory)과 술어 논리(First-Order Predicate Logic)에 기반한 선언형 방식으로 대체하자고 주장했다.

핵심 아이디어는 간단했다. "사용자는 *무엇*을 원하는지만 기술하고, *어떻게* 찾을지는 시스템이 결정한다."

## 도메인 — 값의 허용 집합

**도메인(Domain)**은 속성이 가질 수 있는 값의 집합이다. 예를 들어 `age` 속성의 도메인은 0 이상 150 이하의 정수, `email` 속성의 도메인은 이메일 형식 문자열이다.

도메인의 핵심 조건은 **원자성(Atomicity)**이다. 각 도메인 값은 더 이상 분해할 수 없어야 한다. 하나의 셀에 여러 값을 담거나, 콤마로 구분된 문자열을 저장하는 것은 관계 모델을 위반한다. 이것이 제1정규형(1NF)의 기초가 되는 규칙이다.

```sql
-- 위반 예시: 한 셀에 여러 전화번호
-- phones: "010-1234-5678, 02-987-6543"  ← 원자성 위반

-- 올바른 설계: 별도 테이블로 분리
CREATE TABLE user_phones (
    user_id  INT,
    phone    VARCHAR(20),
    PRIMARY KEY (user_id, phone)
);
```

## 속성과 스키마

**속성(Attribute)**은 이름과 도메인의 쌍이다. 테이블에서는 열(Column)로 구현된다. 속성들의 집합이 릴레이션의 **스키마(Schema)**다. 스키마는 구조를 정의하고, 인스턴스(Instance)는 실제 데이터를 담는다.

```sql
-- 스키마 정의
CREATE TABLE employees (
    emp_id     INT,           -- 속성: 이름=emp_id, 도메인=정수
    name       VARCHAR(100),  -- 속성: 이름=name, 도메인=문자열
    hire_date  DATE,          -- 속성: 이름=hire_date, 도메인=날짜
    salary     DECIMAL(12,2)  -- 속성: 이름=salary, 도메인=소수
);
```

## 튜플과 릴레이션

**튜플(Tuple)**은 각 속성에 대해 도메인에서 하나의 값을 선택한 순서 없는 쌍의 집합이다. 테이블의 한 행(Row)에 해당한다.

**릴레이션(Relation)**은 헤더(속성의 집합)와 바디(튜플의 집합)로 구성된다. 바디는 수학적 집합이므로 두 가지 성질이 보장된다.

1. **중복 없음**: 완전히 동일한 튜플이 두 개 존재할 수 없다.
2. **순서 없음**: 행의 순서는 릴레이션에서 의미가 없다. `ORDER BY` 없이 반환되는 행의 순서는 보장되지 않는다.

![관계 모델의 구성 요소](/assets/posts/sql-relational-model-theory.svg)

## NULL의 의미

관계 모델에서 `NULL`은 "값이 없다"가 아니라 "**알 수 없다(Unknown)**"는 의미다. NULL이 포함된 연산은 예상치 못한 결과를 낳는다.

```sql
-- NULL 비교
SELECT 1 = NULL;    -- NULL (True도 False도 아님)
SELECT NULL = NULL; -- NULL (두 NULL이 같은지도 알 수 없음)

-- NULL 처리
SELECT COALESCE(salary, 0) FROM employees; -- NULL이면 0으로 대체
SELECT * FROM employees WHERE salary IS NULL; -- NULL 비교는 IS NULL 사용
```

이런 특성 때문에 NULL 처리를 잘못하면 WHERE 조건에서 행이 예상치 못하게 필터링된다. 이 부분은 시리즈 후반부에 자세히 다룬다.

## 관계 대수 — SQL의 이론적 토대

Codd는 릴레이션을 다루는 연산 집합인 **관계 대수(Relational Algebra)**를 정의했다. 6가지 기본 연산이 있으며, 이것들의 조합으로 모든 쿼리를 표현할 수 있다.

![관계 대수 6가지 기본 연산](/assets/posts/sql-relational-model-algebra.svg)

| 연산 | 기호 | SQL 대응 |
|---|---|---|
| 선택(Selection) | σ | `WHERE` |
| 투영(Projection) | π | `SELECT 열목록` |
| 조인(Join) | ⋈ | `JOIN` |
| 합집합(Union) | ∪ | `UNION` |
| 차집합(Difference) | − | `EXCEPT` / `MINUS` |
| 곱집합(Cartesian Product) | × | `CROSS JOIN` |

파생 연산인 교집합(∩, `INTERSECT`)과 나누기(÷)도 있지만, 기본 연산의 조합으로 표현 가능하다.

### 선택과 투영 조합

```sql
-- σ(selection): 조건 만족하는 튜플
-- π(projection): 특정 속성만 추출
-- 아래 SQL = π_{name,email}(σ_{age > 30}(users))

SELECT name, email
FROM users
WHERE age > 30;
```

### 조인

조인은 두 릴레이션의 튜플을 조건에 따라 결합한다. 관계 대수에서는 `σ(R × S)`로 표현되며, 곱집합 후 선택 연산을 적용하는 것과 같다. 하지만 실제 DBMS는 이를 그대로 실행하지 않고 최적화된 알고리즘(Nested Loop, Hash Join 등)을 사용한다.

```sql
-- ⋈ (자연 조인): 같은 이름의 속성을 자동 조인
SELECT o.order_id, u.name, o.amount
FROM orders o
JOIN users u ON o.user_id = u.user_id
WHERE o.amount > 50000;
```

## 관계 완전성

관계 대수로 표현 가능한 모든 쿼리를 표현할 수 있는 언어를 **관계 완전(Relationally Complete)**하다고 한다. SQL은 관계 완전하며, 여기에 집계(Aggregation)와 정렬(Ordering) 같은 추가 기능을 갖춘다. 따라서 SQL로 표현할 수 없는 관계 대수 쿼리는 없다.

이 이론적 토대를 이해하면, SQL의 이상한 동작이 버그가 아니라 집합론의 자연스러운 결과임을 알 수 있다. 다음 글에서는 SQL 언어 자체의 역사와 표준화 과정을 살펴본다.

---

**지난 글:** [관계형 데이터베이스란 무엇인가](/posts/sql-what-is-rdb/)

**다음 글:** [SQL의 역사와 표준 — ANSI SQL부터 SQL:2023까지](/posts/sql-history-and-standard/)

<br>
읽어주셔서 감사합니다. 😊
