---
title: "관계형 모델의 핵심 — 테이블, 키, 그리고 관계"
description: "Codd의 관계형 모델을 구성하는 도메인, 속성, 튜플, 관계의 의미를 명확히 이해하고, 슈퍼키·후보키·기본키·외래키의 계층 구조와 관계 대수를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["SQL", "관계형 모델", "관계 대수", "키", "Codd"]
featured: false
draft: false
---

[지난 글](/posts/sql-what-is-rdb/)에서 RDB가 등장한 배경과 SQL의 선언적 특성을 살펴봤습니다. 이번 글에서는 Codd가 정의한 **관계형 모델**의 수학적 토대를 좀 더 구체적으로 파헤쳐봅니다. "테이블"이라고 부르는 것의 정확한 정의, 키의 계층 구조, 그리고 SQL 뒤에 숨은 **관계 대수(Relational Algebra)**까지 훑어봅니다.

## 관계형 모델의 구성 요소

관계형 모델은 집합론을 바탕으로 다음 네 개 개념으로 정의됩니다.

| 개념 | 설명 | SQL 대응 |
|---|---|---|
| 도메인(Domain) | 허용 값의 집합 | 데이터 타입 |
| 속성(Attribute) | 도메인에 부여한 이름 | 열(Column) |
| 튜플(Tuple) | 속성값의 묶음 | 행(Row) |
| 관계(Relation) | 동일 스키마 튜플의 집합 | 테이블(Table) |

집합이므로 두 가지 성질이 자동으로 따릅니다.

- **중복 없음**: 완전히 동일한 두 행은 존재할 수 없다.
- **순서 없음**: 행의 물리적 순서는 의미가 없다.

ORDER BY 없이 SELECT하면 결과 순서가 보장되지 않는 이유가 바로 이 "순서 없음" 때문입니다.

![관계형 모델 핵심 요소](/assets/posts/sql-relational-model-theory.svg)

## 키의 계층 구조

**슈퍼키(Super Key)**는 행을 유일하게 식별할 수 있는 속성의 집합입니다. 예를 들어 `{id}`, `{id, name}`, `{id, name, email}`은 모두 슈퍼키입니다.

**후보키(Candidate Key)**는 불필요한 속성이 없는 최소 슈퍼키입니다. `{id}`가 이미 식별 가능하다면 `{id, name}`은 후보키가 아닙니다.

**기본키(Primary Key)**는 후보키 중 DB 설계자가 대표로 선택한 것입니다. `NOT NULL + UNIQUE`를 보장하며, 인덱스가 자동 생성됩니다.

**외래키(Foreign Key)**는 다른 테이블의 기본키를 참조하는 속성입니다. 참조 무결성을 위반하면 DB 엔진이 오류를 반환합니다.

```sql
CREATE TABLE orders (
    id          INT         PRIMARY KEY,
    customer_id INT         NOT NULL,
    amount      NUMERIC(12,2),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

여기서 `orders.customer_id`는 외래키로, `customers.id`에 없는 값을 삽입하면 참조 무결성 위반 오류가 발생합니다.

## 무결성 규칙

Codd는 두 가지 핵심 무결성 규칙을 정의했습니다.

1. **개체 무결성(Entity Integrity)**: 기본키 속성은 NULL이 될 수 없다.
2. **참조 무결성(Referential Integrity)**: 외래키 값은 참조 테이블의 기본키에 존재하거나 NULL이어야 한다.

이 두 규칙이 지켜지면 데이터는 항상 "의미 있는 상태"를 유지합니다.

## 관계 대수 — SQL의 수학적 뿌리

관계 대수는 관계(테이블)를 입력받아 관계를 출력하는 연산 집합입니다. SQL의 모든 기능은 이 여섯 가지 기본 연산으로 표현됩니다.

![관계 대수 연산](/assets/posts/sql-relational-model-algebra.svg)

| 연산 | SQL 구문 | 의미 |
|---|---|---|
| Selection σ | WHERE | 조건에 맞는 행 선택 |
| Projection π | SELECT 열목록 | 원하는 열만 추출 |
| Join ⋈ | JOIN | 두 테이블 결합 |
| Union ∪ | UNION | 두 결과 합치기 |
| Difference − | EXCEPT | A에만 있는 행 |
| Cartesian × | CROSS JOIN | 모든 행 조합 |

## 클로저(Closure) 성질

관계 대수의 강력한 점은 **클로저**입니다. 관계를 입력받은 연산의 결과는 항상 관계입니다. 따라서 연산을 중첩해도 항상 관계가 나오고, 서브쿼리와 CTE가 자연스럽게 동작하는 이유가 됩니다.

```sql
-- 서브쿼리 결과(관계)를 또 다른 선택의 입력으로 사용
SELECT *
FROM (
    SELECT customer_id, SUM(amount) AS total
    FROM   orders
    GROUP  BY customer_id
) AS summary
WHERE total > 100000;
```

## NULL의 위치

관계 대수는 원래 NULL을 정의하지 않습니다. NULL은 실용적 필요로 SQL에 추가된 개념으로, "알 수 없는 값(unknown)" 또는 "적용 불가(inapplicable)"를 표현합니다. NULL은 세값 논리(TRUE / FALSE / UNKNOWN)를 만들어내며, SQL 초보자가 가장 많이 실수하는 원인입니다. 이는 이후 글에서 별도로 다룹니다.

## 정리

관계형 모델의 핵심은 "데이터를 집합으로 보고, 집합 연산으로 원하는 결과를 도출"하는 사고방식입니다. 슈퍼키 → 후보키 → 기본키로 이어지는 계층을 이해하면 PK 설계가 명확해지고, 관계 대수를 이해하면 복잡한 SQL이 읽히기 시작합니다. 다음 글에서는 SQL이 어떻게 표준화되어 왔는지 역사를 살펴봅니다.

---

**지난 글:** [RDB란 무엇인가 — 관계형 데이터베이스의 본질](/posts/sql-what-is-rdb/)

**다음 글:** [SQL의 역사와 표준 — ANSI/ISO SQL이 만들어진 이유](/posts/sql-history-and-standard/)

<br>
읽어주셔서 감사합니다. 😊
