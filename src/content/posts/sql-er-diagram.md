---
title: "ER 다이어그램 읽기와 그리기"
description: "Chen 표기법과 Crow's Foot 표기법을 비교하고, 엔티티·속성·관계·기수성(Cardinality) 개념을 쇼핑몰 도메인 ERD 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "erd", "entity-relationship", "cardinality", "crow-foot", "chen", "database-design", "schema", "modeling"]
featured: false
draft: false
---

[지난 글](/posts/sql-denormalization-decisions/)에서 비정규화 결정 기준을 살펴봤다. 이번에는 데이터베이스 설계의 출발점인 **ER 다이어그램(Entity-Relationship Diagram)**을 읽고 그리는 방법을 정리한다.

---

## ERD가 필요한 이유

ERD는 비즈니스 도메인을 테이블로 옮기기 전에 **개념 수준**에서 엔티티와 관계를 그림으로 표현한다. 코드가 아니라 그림이기 때문에 개발자, DBA, 기획자가 같은 언어로 소통할 수 있다.

---

## 핵심 구성 요소

### 엔티티(Entity)

실세계에서 독립적으로 식별 가능한 객체. 테이블에 대응한다.

```
강한 엔티티(Strong Entity):  독립적으로 존재 — CUSTOMER, PRODUCT
약한 엔티티(Weak Entity):    강한 엔티티 없이 존재 불가 — ORDER_ITEM
```

### 속성(Attribute)

엔티티가 갖는 성질. 컬럼에 대응한다.

```
단순 속성:   name, email (더 이상 분해 안 됨)
복합 속성:   address = {city, street, zipcode} (분해 가능)
다치 속성:   phone_numbers (여러 값 가질 수 있음) → 별도 테이블로
파생 속성:   age (birth_date로 계산) → 일반적으로 저장 안 함
```

### 관계(Relationship)

엔티티 간의 연관. FK로 구현된다.

```
CUSTOMER  --[PLACES]-->  ORDER
ORDER     --[CONTAINS]--> ORDER_ITEM
ORDER_ITEM --[INCLUDES]--> PRODUCT
```

---

## 표기법 비교

![ERD 표기법 비교](/assets/posts/sql-er-diagram-notation.svg)

**Chen 표기법**은 엔티티를 직사각형, 속성을 타원, 관계를 마름모로 표현한다. 개념 설계 단계에서 관계의 의미를 명확히 드러낼 때 유용하다.

**Crow's Foot(IE 표기법)**은 엔티티 박스 안에 속성을 직접 나열하고, 연결선 끝에 기수성을 표기한다. 실무 ERD 도구(ERDCloud, dbdiagram.io, Mermaid)의 기본값이다.

---

## 기수성(Cardinality)

두 엔티티 간에 몇 대 몇으로 관계를 맺는지를 나타낸다.

| 관계 | 의미 | 예시 |
|------|------|------|
| **1:1** | 양쪽 모두 정확히 1 | 사원 ↔ 주차번호 |
| **1:N** | 하나가 여럿에 대응 | 고객 → 주문 |
| **N:M** | 양쪽 모두 여럿 | 학생 ↔ 강의 |

N:M 관계는 **교차 테이블(Junction Table)**로 분해해야 물리 구현이 가능하다.

```sql
-- N:M 예시: 학생-강의
CREATE TABLE student_course (
    student_id  INT REFERENCES students(id),
    course_id   INT REFERENCES courses(id),
    enrolled_at DATE,
    PRIMARY KEY (student_id, course_id)
);
```

---

## 쇼핑몰 도메인 ERD 예시

![쇼핑몰 ERD 예시](/assets/posts/sql-er-diagram-example.svg)

위 ERD를 SQL DDL로 옮기면 다음과 같다.

```sql
CREATE TABLE customers (
    id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name       VARCHAR(100)  NOT NULL,
    email      VARCHAR(255)  NOT NULL UNIQUE,
    phone      VARCHAR(20),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    grade      CHAR(1)       NOT NULL DEFAULT 'B'  -- A/B/C/D
);

CREATE TABLE orders (
    id           BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    customer_id  BIGINT         NOT NULL REFERENCES customers(id),
    status       VARCHAR(20)    NOT NULL DEFAULT 'pending',
    total_amount NUMERIC(12,2)  NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    shipped_at   TIMESTAMPTZ
);

CREATE TABLE products (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name        VARCHAR(200)  NOT NULL,
    price       NUMERIC(10,2) NOT NULL,
    stock       INT           NOT NULL DEFAULT 0,
    category_id INT           REFERENCES categories(id)
);

CREATE TABLE order_items (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id    BIGINT         NOT NULL REFERENCES orders(id),
    product_id  BIGINT         NOT NULL REFERENCES products(id),
    qty         INT            NOT NULL CHECK (qty > 0),
    unit_price  NUMERIC(10,2)  NOT NULL  -- 주문 당시 가격 스냅샷
);
```

---

## 필수 vs 선택 참여

기수성 외에 **참여 제약(Participation Constraint)**도 표기해야 한다.

```
전체 참여(Mandatory):  모든 고객은 반드시 주문을 가져야 한다
부분 참여(Optional):   고객이 주문을 가질 수도, 없을 수도 있다
```

Crow's Foot에서는 `|O≫` 기호로 표기한다: `|`는 "정확히 1", `O`는 "0 가능", `≫`는 "다수".

```sql
-- 참여 제약 → NOT NULL로 구현
-- 주문은 반드시 고객을 가져야 함: customer_id NOT NULL
-- 주문에 배송 주소는 선택: address_id NULL 허용
```

---

## ERD 작성 순서

1. **도메인 분석**: 무엇이 엔티티인가 (명사 추출)
2. **관계 식별**: 엔티티 간 동사 도출
3. **기수성 결정**: 1:1, 1:N, N:M 판별
4. **속성 배치**: 기본키, 외래키, 일반 속성
5. **정규화 검토**: 중복·이상 현상 확인
6. **DDL 생성**: ERD → SQL CREATE TABLE

---

**지난 글:** [비정규화 결정 기준](/posts/sql-denormalization-decisions/)

**다음 글:** [관계 매핑: ERD를 테이블로 변환하기](/posts/sql-relationship-mapping/)

<br>
읽어주셔서 감사합니다. 😊
