---
title: "관계형 모델 이론 — 관계·튜플·속성"
description: "코드의 1970년 논문에서 비롯된 관계형 모델의 핵심 개념을 스키마, 인스턴스, 무결성 규칙까지 단계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "관계형모델", "릴레이션", "무결성", "codd", "기초"]
featured: false
draft: false
---

## 이전 글 연결

앞 글에서 "왜 파일 시스템 대신 데이터베이스를 써야 하는가"를 살펴봤다. 이번 글은 그 데이터베이스가 어떤 수학적 토대 위에 서 있는지를 다룬다.

모든 RDBMS는 1970년 에드거 F. 코드(Edgar F. Codd)가 IBM 연구 저널에 발표한 논문 *"A Relational Model of Data for Large Shared Data Banks"* 위에 세워져 있다. 이 논문을 이해하면 SQL의 모든 동작이 훨씬 명확해진다.

---

## 코드가 빌려온 수학: 집합론

관계형 모델의 뼈대는 **집합론(set theory)**이다. 핵심 아이디어는 간단하다:

> 데이터를 n-차원 공간의 관계(relation)로 표현하고, 집합 연산으로 원하는 부분집합을 얻는다.

이 추상적인 문장을 하나씩 풀어보자.

---

## 도메인(Domain)

도메인은 속성이 취할 수 있는 **값들의 집합**이다.

```sql
-- 도메인 예시 (SQL에서는 타입 + CHECK로 표현)
age     INTEGER  CHECK (age BETWEEN 0 AND 150)
status  CHAR(1)  CHECK (status IN ('A', 'I', 'D'))
email   VARCHAR(200)   -- 문자열 도메인
```

- `age`의 도메인: 0 이상 150 이하의 정수
- `status`의 도메인: {'A', 'I', 'D'} 세 값의 집합

도메인은 타입(INTEGER, VARCHAR)보다 더 세밀하다. 같은 INTEGER라도 `나이`와 `상품 번호`는 도메인이 다르다. 실수로 `나이 = 상품 번호` 비교를 막아주는 논리적 장치다.

---

## 속성(Attribute)과 릴레이션 스키마

**속성(Attribute)**은 이름이 붙은 도메인이다. "id: INTEGER", "name: VARCHAR(100)"처럼 이름과 도메인의 쌍이다.

**릴레이션 스키마(Relation Schema)**는 속성들의 이름 목록이다. 표기법은 다음과 같다.

```text
R(A1, A2, ..., An)

예) employees(id, name, email, dept_id)
```

스키마는 **설계 시점에 정의**되고 거의 변하지 않는다. 건물의 설계 도면에 해당한다.

---

## 릴레이션 인스턴스(Relation Instance)

스키마가 도면이라면, **인스턴스**는 특정 시점에 실제로 존재하는 데이터다. 시간이 지나면서 행이 추가·삭제되면 인스턴스가 바뀐다.

![스키마 vs 인스턴스](/assets/posts/sql-relational-model-schema-instance.svg)

인스턴스의 수학적 정의는:

> R의 인스턴스 r = D1 × D2 × ... × Dn의 부분집합

`×`는 카테시안 곱(Cartesian product)이다. 즉, 모든 가능한 튜플 조합 중에서 실제로 저장된 것들의 집합이 인스턴스다.

---

## 릴레이션의 두 가지 중요한 성질

### 1. 순서 없음

릴레이션은 **집합**이므로 순서가 없다. `SELECT` 결과의 행 순서는 `ORDER BY` 없이는 보장되지 않는다. 이는 버그가 아니라 수학적 정의에서 비롯된 동작이다.

### 2. 중복 없음

집합에는 같은 원소가 두 번 있을 수 없다. 따라서 릴레이션에는 완전히 동일한 튜플이 둘 이상 존재할 수 없다. 기본 키(PRIMARY KEY)가 이를 물리적으로 보장한다.

---

## 키(Key)의 종류

| 키 종류 | 정의 |
|--------|------|
| 슈퍼 키(Super Key) | 튜플을 유일하게 식별하는 속성 집합 (중복 포함) |
| 후보 키(Candidate Key) | 최소 슈퍼 키 (불필요한 속성 없음) |
| 기본 키(Primary Key) | 후보 키 중 대표로 선택된 하나 |
| 대안 키(Alternate Key) | 선택되지 않은 나머지 후보 키 |
| 외래 키(Foreign Key) | 다른 릴레이션의 기본 키를 참조 |

```sql
-- 후보 키가 두 개인 예시
CREATE TABLE employees (
  id     INTEGER PRIMARY KEY,   -- PK (후보 키 1)
  email  VARCHAR(200) UNIQUE,   -- 대안 키 (후보 키 2)
  name   VARCHAR(100) NOT NULL
);
```

`id`와 `email` 모두 각 직원을 유일하게 식별할 수 있으므로 둘 다 후보 키다. 우리는 `id`를 기본 키로 선택했고, `email`은 UNIQUE 제약으로 대안 키가 되었다.

---

## 3대 무결성 규칙

코드는 관계형 모델이 항상 지켜야 하는 무결성 규칙을 세 가지로 정의했다.

![3대 무결성 규칙](/assets/posts/sql-relational-model-integrity.svg)

### 개체 무결성 (Entity Integrity)

**기본 키는 NULL이 될 수 없고, 반드시 유일해야 한다.**

기본 키의 목적은 튜플을 유일하게 식별하는 것이다. NULL은 "알 수 없음"을 의미하므로 식별자로 쓸 수 없다. RDBMS는 PRIMARY KEY 선언 시 자동으로 이 규칙을 강제한다.

### 참조 무결성 (Referential Integrity)

**외래 키 값은 참조하는 테이블의 기본 키에 반드시 존재하거나 NULL이어야 한다.**

```sql
-- 참조 무결성 위반 예시
INSERT INTO orders (customer_id, amount)
VALUES (9999, 50000);  -- customer_id = 9999가 customers에 없으면 오류
```

FOREIGN KEY … REFERENCES 선언이 이 규칙을 자동으로 검증한다.

### 도메인 무결성 (Domain Integrity)

**각 속성의 값은 해당 도메인(허용 범위) 안에 있어야 한다.**

CHECK 제약, NOT NULL, 타입 선언이 이 규칙을 강제한다.

---

## 관계 대수(Relational Algebra): SQL의 수학적 기반

관계 대수는 릴레이션을 입력으로 받아 새 릴레이션을 반환하는 연산 집합이다. SQL의 모든 쿼리는 결국 이 연산들의 조합이다.

| 연산 | 기호 | SQL 대응 |
|------|------|----------|
| 선택 (Selection) | σ | WHERE |
| 프로젝션 (Projection) | π | SELECT 컬럼 목록 |
| 합집합 (Union) | ∪ | UNION |
| 차집합 (Difference) | − | EXCEPT |
| 카테시안 곱 | × | CROSS JOIN |
| 조인 (Join) | ⋈ | JOIN |

```sql
-- 관계 대수: σ(dept_id=10)(π(id,name)(employees))
-- SQL로 표현하면:
SELECT id, name
FROM   employees
WHERE  dept_id = 10;
```

`WHERE` 절이 σ(선택), `SELECT` 컬럼 목록이 π(프로젝션)에 대응된다. `SELECT *`는 프로젝션 없이 모든 속성을 반환한다.

---

## Null의 의미

SQL에서 NULL은 "값이 없음" 또는 "알 수 없음"을 나타낸다. 관계형 모델에서 NULL은 논쟁의 여지가 많은 개념으로, 코드의 12번째 규칙에서 체계적으로 다뤄진다.

NULL을 다룰 때 주의할 점:

```sql
-- NULL 비교는 = 이 아닌 IS NULL / IS NOT NULL
SELECT * FROM employees WHERE dept_id IS NULL;

-- NULL + 숫자 = NULL (전파)
SELECT 100 + NULL;  -- 결과: NULL
```

NULL과 관련된 함정은 이후 `IS NULL · IN · BETWEEN` 편에서 자세히 다룬다.

---

## 정리

- **도메인**: 속성의 허용 값 집합
- **속성**: 이름 + 도메인의 쌍
- **릴레이션 스키마**: 속성 이름 목록 (정적, 설계 시점)
- **릴레이션 인스턴스**: 특정 시점의 실제 데이터 (동적)
- **3대 무결성**: 개체(PK ≠ NULL) · 참조(FK 대상 존재) · 도메인(값 범위)
- **관계 대수**: SQL의 수학적 기반 — σ(WHERE), π(SELECT), ⋈(JOIN)

**다음 글:** SQL의 역사와 표준 (ANSI/ISO/JIS) — SQL-86부터 SQL:2023까지 어떻게 진화했는지를 추적합니다.

<br>
읽어주셔서 감사합니다. 😊
