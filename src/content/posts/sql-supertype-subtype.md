---
title: "수퍼타입/서브타입 테이블 설계"
description: "객체지향의 상속 개념을 관계형 DB로 표현하는 세 가지 전략—단일 테이블(STI), 클래스 테이블(CTI), 서브타입별 테이블—의 구조, 트레이드오프, 적합한 사용 시나리오를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["sql", "supertype", "subtype", "single-table-inheritance", "class-table-inheritance", "polymorphism", "database-design", "schema", "erd"]
featured: false
draft: false
---

[지난 글](/posts/sql-identifying-vs-non-identifying/)에서 식별/비식별 관계를 살펴봤다. 이번에는 객체지향의 **상속(Inheritance)** 개념을 관계형 데이터베이스로 표현하는 **수퍼타입/서브타입 설계 패턴**을 다룬다.

---

## 문제: 공통 속성과 타입별 속성의 공존

결제(Payment) 도메인을 생각해보자. 모든 결제는 `금액`, `결제일`, `주문 ID`를 공유하지만, 카드 결제는 `카드번호`와 `카드사`를, 계좌이체는 `은행코드`와 `계좌번호`를 추가로 갖는다.

```
PAYMENT (공통)
  ├─ CARD_PAYMENT    (카드번호, 카드사)
  ├─ BANK_TRANSFER   (은행코드, 계좌번호)
  └─ CRYPTO_PAYMENT  (지갑주소, 체인)
```

이를 SQL로 표현하는 방법이 세 가지 있다.

---

## 세 가지 전략

![수퍼타입/서브타입 전략 비교](/assets/posts/sql-supertype-subtype-strategies.svg)

### 전략 1: 단일 테이블 상속(STI — Single Table Inheritance)

모든 타입을 하나의 테이블에 담는다. 타입 구분 컬럼(discriminator)을 두고, 해당 타입에 없는 컬럼은 NULL이 된다.

```sql
CREATE TABLE payments (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id    BIGINT         NOT NULL,
    amount      NUMERIC(12,2)  NOT NULL,
    pay_type    VARCHAR(20)    NOT NULL CHECK (pay_type IN ('card','bank','crypto')),
    paid_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    -- 카드 결제 전용
    card_no     VARCHAR(20),
    issuer      VARCHAR(50),
    -- 계좌이체 전용
    bank_code   VARCHAR(10),
    account_no  VARCHAR(30),
    -- 암호화폐 전용
    wallet_addr VARCHAR(100),
    chain       VARCHAR(20),
    -- NULL 무결성 보장
    CONSTRAINT ck_card  CHECK (pay_type <> 'card'   OR (card_no IS NOT NULL AND issuer IS NOT NULL)),
    CONSTRAINT ck_bank  CHECK (pay_type <> 'bank'   OR (bank_code IS NOT NULL)),
    CONSTRAINT ck_crypto CHECK (pay_type <> 'crypto' OR (wallet_addr IS NOT NULL))
);

-- 조회: JOIN 없음
SELECT id, amount, card_no FROM payments WHERE pay_type = 'card';
```

장점은 쿼리가 단순하고 JOIN이 없다는 점이다. 단점은 NULL 컬럼이 많고, 서브타입이 늘어날수록 테이블이 넓어진다는 점이다.

### 전략 2: 클래스 테이블 상속(CTI — Class Table Inheritance)

수퍼타입과 서브타입 각각을 별도 테이블로 만든다. 서브타입 PK가 수퍼타입 PK를 참조한다.

![CTI 구현 코드](/assets/posts/sql-supertype-subtype-cti-code.svg)

```sql
-- 서브타입: 계좌이체 전용
CREATE TABLE bank_transfers (
    payment_id  BIGINT      PRIMARY KEY REFERENCES payments(id) ON DELETE CASCADE,
    bank_code   VARCHAR(10) NOT NULL,
    account_no  VARCHAR(30) NOT NULL,
    holder_name VARCHAR(100)
);

-- 서브타입: 암호화폐 전용
CREATE TABLE crypto_payments (
    payment_id   BIGINT       PRIMARY KEY REFERENCES payments(id) ON DELETE CASCADE,
    wallet_addr  VARCHAR(100) NOT NULL,
    chain        VARCHAR(20)  NOT NULL,
    tx_hash      VARCHAR(100)
);

-- 삽입: 2단계 필요
BEGIN;
INSERT INTO payments (order_id, amount, pay_type)
    VALUES (42, 15000, 'card')
    RETURNING id INTO _pid;
INSERT INTO card_payments (payment_id, card_no, issuer)
    VALUES (_pid, '1234-****-****-5678', 'KB국민');
COMMIT;
```

수퍼타입만 조회하면 JOIN 없이 빠르고, 서브타입 전용 속성에 NOT NULL 제약을 걸 수 있다.

### 전략 3: 서브타입별 독립 테이블

수퍼타입 테이블 없이 서브타입마다 완전히 독립된 테이블을 만든다. 공통 속성이 중복된다.

```sql
CREATE TABLE card_payments (
    id       BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    amount   NUMERIC(12,2) NOT NULL,  -- 공통 속성 중복
    paid_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    card_no  VARCHAR(20)   NOT NULL,  -- 전용 속성
    issuer   VARCHAR(50)
);

CREATE TABLE bank_transfers (
    id         BIGINT PRIMARY KEY,
    order_id   BIGINT NOT NULL,
    amount     NUMERIC(12,2) NOT NULL,  -- 공통 속성 중복
    paid_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    bank_code  VARCHAR(10) NOT NULL,     -- 전용 속성
    account_no VARCHAR(30) NOT NULL
);

-- 전체 결제 조회: UNION ALL 필요
SELECT id, amount, 'card' AS pay_type FROM card_payments
UNION ALL
SELECT id, amount, 'bank' FROM bank_transfers;
```

---

## 전략 비교 요약

| 기준 | STI | CTI | 서브타입별 |
|------|-----|-----|-----------|
| NULL 컬럼 | 많음 | 없음 | 없음 |
| 조회 JOIN | 없음 | 있음 | 없음 |
| 전체 조회 | 빠름 | 빠름(수퍼타입) | UNION ALL |
| 정규화 수준 | 낮음 | 높음 | 중간 |
| 서브타입 추가 | 컬럼 추가 | 테이블 추가 | 테이블 추가 |
| ORM 지원 | 쉬움 | 보통 | 어려움 |

---

## PostgreSQL: 파티션 테이블로 변형

PostgreSQL의 선언적 파티셔닝을 STI 변형으로 활용할 수 있다.

```sql
-- 수퍼타입을 파티션 테이블로
CREATE TABLE payments (
    id       BIGINT NOT NULL,
    pay_type VARCHAR(20) NOT NULL,
    amount   NUMERIC(12,2) NOT NULL,
    paid_at  TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY LIST (pay_type);

CREATE TABLE payments_card   PARTITION OF payments FOR VALUES IN ('card');
CREATE TABLE payments_bank   PARTITION OF payments FOR VALUES IN ('bank');
CREATE TABLE payments_crypto PARTITION OF payments FOR VALUES IN ('crypto');
```

---

## 실무 권장

```
서브타입 2~3개, 속성 차이 작음  → STI (단순함 우선)
서브타입 많음, 속성 차이 큼     → CTI (정규화 우선)
타입 간 공통 조회 거의 없음      → 서브타입별 독립 테이블
JPA/Hibernate 사용              → STI (@DiscriminatorColumn)
                                   또는 CTI (@Inheritance(JOINED))
```

---

**지난 글:** [식별 관계 vs 비식별 관계](/posts/sql-identifying-vs-non-identifying/)

**다음 글:** [다형성 관계(Polymorphic Relationship)](/posts/sql-polymorphic-relationships/)

<br>
읽어주셔서 감사합니다. 😊
