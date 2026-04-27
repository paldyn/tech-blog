---
title: "관계형 모델 이론 — 관계·튜플·속성"
description: "E.F. Codd가 정립한 관계형 모델의 수학적 기반을 살펴봅니다. 릴레이션·튜플·속성·도메인·카디널리티의 의미와 이것이 실제 SQL 설계에 주는 시사점을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "관계형모델", "codd", "릴레이션", "튜플", "정규화"]
featured: false
draft: false
---

지난 글에서 파일 시스템의 한계를 살펴보고 DBMS가 왜 필요한지 확인했습니다. 그렇다면 DBMS는 데이터를 어떤 수학적 원리로 저장하고 조작할까요? 그 답이 **관계형 모델(Relational Model)**입니다.

## Codd의 혁명 (1970)

1970년 IBM 연구원 E.F. Codd는 논문 *"A Relational Model of Data for Large Shared Data Banks"*를 발표했습니다. 당시 데이터베이스는 탐색 방식이 제각각인 계층형·네트워크형이 주류였습니다. Codd는 **집합론(Set Theory)**과 **1차 술어 논리(First-Order Predicate Logic)**를 바탕으로 완전히 새로운 접근을 제안했습니다.

핵심 아이디어: "데이터를 수학적 **관계(relation)**로 표현하면, 물리적 저장 방법과 무관하게 데이터를 선언적으로 조작할 수 있다."

## 릴레이션의 구조

![관계의 해부 — 속성·튜플·도메인](/assets/posts/sql-relational-model-relation-anatomy.svg)

### 속성(Attribute)

릴레이션의 **열(column)**에 해당합니다. 각 속성은 이름과 **도메인**을 가집니다.

```sql
-- 속성 정의 = 컬럼 정의
CREATE TABLE customers (
  id     INTEGER,       -- 도메인: 양의 정수
  name   VARCHAR(50),   -- 도메인: 50자 이내 문자열
  email  VARCHAR(100),  -- 도메인: 이메일 형식 문자열
  grade  VARCHAR(10)    -- 도메인: {BRONZE, SILVER, GOLD, PLATINUM}
);
```

- **차수(Degree)**: 속성의 수. 위 테이블은 차수 4.
- **도메인(Domain)**: 해당 속성이 가질 수 있는 값의 집합. SQL에서는 데이터 타입 + CHECK 제약으로 표현합니다.

### 튜플(Tuple)

릴레이션의 **행(row)**입니다. 하나의 튜플은 각 속성에 대응하는 값들의 순서 있는 집합입니다.

```sql
-- 튜플 삽입 = 행 삽입
INSERT INTO customers (id, name, email, grade)
VALUES (1, '김민준', 'minjun@ex.com', 'GOLD');
```

- **카디널리티(Cardinality)**: 튜플의 수. 위에서 행이 3개면 카디널리티 3.
- 수학적으로 튜플은 **순서쌍(ordered pair)**이지만, 릴레이션 안에서 튜플 간 순서는 의미 없습니다.

### 릴레이션 스키마 vs 인스턴스

| 개념 | 설명 | SQL 대응 |
|------|------|---------|
| **스키마** | 속성 이름·도메인의 정의 | `CREATE TABLE` 구조 |
| **인스턴스** | 특정 시점의 튜플 집합 | 테이블에 현재 저장된 데이터 |

## 관계형 모델의 핵심 성질

![관계형 모델 핵심 성질](/assets/posts/sql-relational-model-codd-rules.svg)

### 순서 무관성이 SQL에 미치는 영향

가장 오해하기 쉬운 성질입니다. **테이블의 행 순서는 보장되지 않습니다.** `ORDER BY` 없이 실행한 `SELECT`의 결과 순서는 같은 쿼리를 두 번 실행해도 달라질 수 있습니다.

```sql
-- 순서를 가정하면 위험한 코드 (Oracle, PostgreSQL에서 실제 확인됨)
SELECT * FROM customers;
-- 결과 순서: id=2, id=1, id=3 일 수도 있음

-- 항상 명시적으로
SELECT * FROM customers
ORDER  BY id;
```

### NULL의 3값 논리

관계형 모델은 NULL을 "알 수 없음(unknown)"으로 정의합니다. 따라서 일반 비교 연산의 결과가 `UNKNOWN`이 될 수 있습니다.

```sql
-- 잘못된 패턴: NULL 비교
SELECT * FROM customers WHERE email = NULL;    -- 항상 0건
SELECT * FROM customers WHERE email != NULL;   -- 항상 0건

-- 올바른 패턴
SELECT * FROM customers WHERE email IS NULL;
SELECT * FROM customers WHERE email IS NOT NULL;

-- UNKNOWN이 WHERE 절에서 미치는 영향
-- WHERE 조건이 UNKNOWN인 행은 결과에 포함되지 않음
```

### SQL 테이블은 다중집합(Multiset)

엄밀한 관계형 모델의 릴레이션은 중복 튜플을 허용하지 않습니다. 그러나 실제 SQL 테이블은 PRIMARY KEY가 없으면 완전히 동일한 행을 여러 개 저장할 수 있습니다. 이는 수학적 집합이 아닌 **다중집합(bag)**입니다.

```sql
-- 중복 허용 테이블 (순수 관계형 모델 위반)
CREATE TABLE log_events (
  message TEXT,
  ts      TIMESTAMP
);
-- PRIMARY KEY 없음 → 동일 행 중복 삽입 가능

-- 집합 이론에 충실하게: 항상 PK 추가
ALTER TABLE log_events ADD COLUMN id BIGSERIAL PRIMARY KEY;
```

## 관계 대수(Relational Algebra)

Codd는 릴레이션을 조작하는 8개의 연산을 정의했습니다. SQL은 이 관계 대수를 선언적으로 표현합니다.

| 관계 대수 연산 | SQL 대응 |
|---------------|---------|
| σ (Selection) | `WHERE` 절 |
| π (Projection) | `SELECT` 컬럼 목록 |
| ⋈ (Join) | `JOIN` |
| ∪ (Union) | `UNION` |
| − (Difference) | `EXCEPT` |
| × (Cartesian Product) | `CROSS JOIN` |
| ρ (Rename) | `AS` 별칭 |
| ∩ (Intersection) | `INTERSECT` |

```sql
-- σ (Selection) + π (Projection) + ⋈ (Join) 조합
SELECT c.name, o.amount          -- π: 투영
FROM   customers c               -- 릴레이션 c
JOIN   orders o                  -- ⋈: 조인
  ON   o.customer_id = c.id
WHERE  c.grade = 'GOLD'          -- σ: 선택
  AND  o.amount > 100000;
```

## 닫힘 성질과 서브쿼리

관계 연산의 결과도 릴레이션이라는 성질 덕분에, 결과를 다시 입력으로 사용할 수 있습니다. 이것이 서브쿼리·CTE·뷰의 이론적 근거입니다.

```sql
-- 닫힘 성질 활용: 서브쿼리 결과를 FROM에 사용
SELECT sub.name, sub.total
FROM (
  SELECT c.name,
         SUM(o.amount) AS total
  FROM   customers c
  JOIN   orders o ON o.customer_id = c.id
  GROUP  BY c.name
) AS sub                         -- 이 결과도 릴레이션
WHERE sub.total > 500000;
```

## 정리

관계형 모델은 데이터를 수학적 집합인 **릴레이션**으로 추상화합니다. 속성·도메인·튜플·카디널리티·차수의 개념이 SQL의 컬럼·데이터타입·행·레코드수·컬럼수로 직접 대응됩니다. 순서 무관성과 NULL의 3값 논리는 SQL을 처음 배울 때 반드시 체화해야 할 핵심 성질입니다. 다음 글에서는 이 모델이 어떻게 표준 언어로 발전했는지, **SQL의 역사와 ANSI/ISO 표준**을 살펴봅니다.

**다음 글:** SQL의 역사와 표준 — ANSI/ISO/JIS

<br>
읽어주셔서 감사합니다. 😊
