---
title: "식별 관계 vs 비식별 관계"
description: "자식 테이블의 PK에 부모 FK가 포함되는 식별 관계와 독립 PK를 갖는 비식별 관계의 차이, 자연키 vs 서로게이트키 선택 기준, 실무 권장 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "identifying-relationship", "non-identifying", "natural-key", "surrogate-key", "primary-key", "foreign-key", "database-design", "erd"]
featured: false
draft: false
---

[지난 글](/posts/sql-relationship-mapping/)에서 ERD를 SQL 테이블로 변환하는 규칙을 살펴봤다. 이번에는 ERD 도구에서 반드시 마주치는 개념인 **식별 관계(Identifying Relationship)**와 **비식별 관계(Non-Identifying Relationship)**의 차이를 정리한다.

---

## 핵심 차이: 자식의 PK에 부모 FK가 들어가는가

두 관계의 차이는 단 하나다. 자식 테이블이 부모 테이블의 FK를 자신의 PK(기본키) 안에 포함하느냐 여부다.

![식별 vs 비식별 관계](/assets/posts/sql-identifying-vs-non-identifying-compare.svg)

---

## 식별 관계 (Identifying Relationship)

자식의 PK가 부모의 PK(FK)를 포함한다. 자식은 부모 없이는 식별될 수 없다. ERD에서는 **실선**으로 표기한다.

```sql
-- 주문(부모) → 주문_항목(자식): 식별 관계
CREATE TABLE orders (
    id   BIGINT PRIMARY KEY
);

CREATE TABLE order_items (
    order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    seq        INT    NOT NULL,  -- 주문 내 순번
    product_id BIGINT NOT NULL,
    qty        INT    NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, seq)  -- 부모 FK + seq = 복합 PK
);
```

`order_items`의 PK는 `(order_id, seq)`다. `order_id`가 없으면 `order_items` 행을 유일하게 식별할 수 없다. 이것이 식별 관계다.

---

## 비식별 관계 (Non-Identifying Relationship)

자식의 PK가 부모 FK와 무관하다. 자식은 독립적인 PK를 갖는다. ERD에서는 **점선**으로 표기한다.

```sql
-- 고객(부모) → 주문(자식): 비식별 관계
CREATE TABLE customers (
    id   BIGINT PRIMARY KEY
);

CREATE TABLE orders (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    -- customer_id는 FK지만 PK가 아님
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`orders.id`는 완전히 독립적이다. `customer_id`가 NULL이어도(고객 탈퇴 후) 주문 레코드는 존재할 수 있다.

---

## 언제 식별 관계를 쓰나

식별 관계가 자연스러운 경우는 다음과 같다.

```sql
-- 1. 약한 엔티티: 부모 없이 의미 없는 자식
CREATE TABLE account_transactions (
    account_id  INT  NOT NULL REFERENCES accounts(id),
    seq         INT  NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (account_id, seq)
);

-- 2. 복합 PK 테이블 (교차 테이블은 이미 식별 관계)
CREATE TABLE role_permissions (
    role_id       INT NOT NULL REFERENCES roles(id),
    permission_id INT NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- 3. 이력/로그 테이블: 원본 없이 의미 없는 로그
CREATE TABLE product_price_history (
    product_id INT  NOT NULL REFERENCES products(id),
    seq        INT  NOT NULL,
    price      NUMERIC(10,2) NOT NULL,
    changed_at TIMESTAMPTZ   NOT NULL,
    PRIMARY KEY (product_id, seq)
);
```

---

## 자연키 vs 서로게이트키

식별/비식별 관계를 논의할 때 항상 따라오는 주제가 **PK 전략**이다.

![자연키 vs 서로게이트키](/assets/posts/sql-identifying-vs-non-identifying-pk.svg)

```sql
-- 자연키 예: 이메일을 PK로 (식별 관계에서 자식에 전파)
CREATE TABLE users (
    email VARCHAR(255) PRIMARY KEY
);
CREATE TABLE user_settings (
    user_email VARCHAR(255) PRIMARY KEY REFERENCES users(email),
    theme      VARCHAR(20)
);
-- 이메일이 바뀌면? → CASCADE UPDATE 필요, FK 인덱스 크기 ↑

-- 서로게이트키 예: 의미없는 ID
CREATE TABLE users (
    id    BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    email VARCHAR(255) NOT NULL UNIQUE  -- 자연키는 UNIQUE로 보존
);
CREATE TABLE user_settings (
    user_id BIGINT PRIMARY KEY REFERENCES users(id),
    theme   VARCHAR(20)
);
-- user.email이 바뀌어도 FK는 불변
```

서로게이트키가 실무에서 선호되는 이유는 **불변성**이다. 비즈니스 값(이메일, 주민번호 등)은 바뀔 수 있지만, 자동 증가 ID는 바뀌지 않는다.

---

## 식별 관계의 함정: 복합 PK 전파

식별 관계를 여러 단계 중첩하면 복합 PK가 점점 커진다.

```
ORDER(id)
  └─ ORDER_ITEM(order_id, seq)  ← 2컬럼 PK
       └─ ORDER_ITEM_TAG(order_id, seq, tag_id)  ← 3컬럼 PK
            └─ ORDER_ITEM_TAG_AUDIT(order_id, seq, tag_id, ts)  ← 4컬럼 PK
```

FK 인덱스가 비대해지고, ORM에서 복합 PK 처리가 번거로워진다. 깊은 계층에서는 서로게이트키 + 비식별 관계가 더 관리하기 쉽다.

---

## 실무 결정 기준

```
Q: 자식이 부모 없이 논리적으로 존재할 수 있는가?
  → YES: 비식별 관계 (서로게이트 PK)
  → NO:  식별 관계 고려 (약한 엔티티, 교차 테이블)

Q: PK 컬럼이 3개 이상이 되는가?
  → YES: 서로게이트 PK로 교체 검토

Q: 자연키가 변경될 수 있는가?
  → YES: 서로게이트 PK + UNIQUE 제약으로 분리
```

---

**지난 글:** [관계 매핑: ERD를 테이블로](/posts/sql-relationship-mapping/)

**다음 글:** [수퍼타입/서브타입 테이블 설계](/posts/sql-supertype-subtype/)

<br>
읽어주셔서 감사합니다. 😊
