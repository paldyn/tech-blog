---
title: "외래 키와 참조 무결성 — FOREIGN KEY의 작동 원리"
description: "FOREIGN KEY가 참조 무결성을 어떻게 강제하는지, ON DELETE/ON UPDATE 다섯 가지 옵션의 차이, DEFERRABLE 지연 검사, 그리고 실전에서 FK를 끄는 상황까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "foreign-key", "referential-integrity", "on-delete", "cascade", "deferrable", "ddl", "외래키"]
featured: false
draft: false
---

[지난 글](/posts/sql-primary-key-design/)에서 기본 키 설계를 다뤘다. 이번에는 테이블 간의 관계를 정의하고 참조 무결성을 보장하는 FOREIGN KEY를 살펴본다.

---

## 참조 무결성이란

**참조 무결성(Referential Integrity)** 은 자식 테이블의 외래 키 값이 항상 부모 테이블의 기본 키(또는 UNIQUE) 값과 일치해야 한다는 규칙이다. 예를 들어 `orders.customer_id`가 존재하지 않는 고객을 가리킬 수 없다.

FOREIGN KEY 제약이 없으면 참조 무결성은 애플리케이션 코드에만 의존하게 되고, 직접 SQL이나 배치 작업이 이 규칙을 우회하는 순간 데이터는 조용히 망가진다.

![FOREIGN KEY 개요](/assets/posts/sql-foreign-key-referential-integrity-overview.svg)

---

## FOREIGN KEY 선언

```sql
CREATE TABLE orders (
    order_id    BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total       NUMERIC(12,2) NOT NULL,
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);
```

`REFERENCES` 뒤에 오는 컬럼은 부모 테이블의 PRIMARY KEY 또는 UNIQUE 제약이 걸린 컬럼이어야 한다.

![FOREIGN KEY 문법과 DEFERRABLE](/assets/posts/sql-foreign-key-referential-integrity-syntax.svg)

---

## ON DELETE / ON UPDATE 옵션 상세

부모 행이 삭제되거나 PK 값이 변경될 때 자식 행을 어떻게 처리할지를 정의한다.

### RESTRICT (기본값)

자식 행이 존재하면 부모 행의 삭제·수정을 **즉시 거부**한다. 가장 안전한 옵션으로, 명시하지 않으면 대부분의 DBMS에서 기본값이다.

```sql
-- customer_id=1인 주문이 있으면 아래 DELETE는 실패
DELETE FROM customers WHERE customer_id = 1;
-- ERROR: violates foreign key constraint
```

### CASCADE

부모 행이 삭제되면 자식 행도 함께 삭제된다. 주문-주문상세처럼 **부모 없이는 의미 없는 자식**에 적합하다.

```sql
ON DELETE CASCADE  -- 고객 삭제 시 주문도 모두 삭제
ON UPDATE CASCADE  -- 고객 ID 변경 시 주문의 FK도 자동 업데이트
```

CASCADE는 편리하지만 예상치 못한 대량 삭제를 유발할 수 있다. 중요한 비즈니스 데이터에는 신중히 사용한다.

### SET NULL

부모 행 삭제 시 자식의 FK 컬럼을 NULL로 바꾼다. 담당자가 퇴사해도 고객 레코드는 남겨야 하는 경우처럼, **선택적 관계**에서 유용하다.

```sql
CREATE TABLE customers (
    customer_id BIGINT PRIMARY KEY,
    name        VARCHAR(100),
    sales_rep_id BIGINT,  -- NULL 허용 필수
    CONSTRAINT fk_sales_rep
        FOREIGN KEY (sales_rep_id)
        REFERENCES employees (emp_id)
        ON DELETE SET NULL
);
```

`SET NULL`을 사용하려면 해당 FK 컬럼이 NULL을 허용해야 한다.

### NO ACTION

`RESTRICT`와 비슷하지만, **트랜잭션이 끝날 때까지 검사를 미룬다**. `DEFERRABLE`과 함께 사용할 때 의미가 있다.

---

## DEFERRABLE — 지연 검사

순환 참조나 배치 데이터 로딩처럼 "일시적으로 무결성이 깨져도 커밋 전에 복구되는" 시나리오에서 유용하다. PostgreSQL이 지원하며, MySQL은 지원하지 않는다.

```sql
-- 선언 시
CONSTRAINT fk_parent
    FOREIGN KEY (parent_id) REFERENCES parent(id)
    DEFERRABLE INITIALLY DEFERRED

-- 또는 세션에서 임시 활성화
SET CONSTRAINTS fk_parent DEFERRED;
-- 이 시점에는 FK 위반 허용
INSERT INTO child (parent_id) VALUES (999);
INSERT INTO parent (id) VALUES (999);  -- 커밋 전에 복구
COMMIT;  -- 커밋 시점에 검사
```

---

## FK와 성능 — 인덱스 필수

FK 컬럼에는 반드시 인덱스를 생성해야 한다. 부모 행 삭제 시 DB가 자식 테이블을 풀 스캔하기 때문이다.

```sql
-- FK 컬럼에 인덱스 추가 (MySQL은 자동 생성, PostgreSQL은 수동)
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
```

PostgreSQL은 FK 생성 시 자식 쪽 인덱스를 자동으로 만들지 않는다. **FK를 걸 때마다 인덱스도 함께 생성**하는 습관이 중요하다.

---

## 실전: FK를 끄는 경우

FK가 데이터 무결성을 보장하는 좋은 수단이지만, 대량 데이터 로딩(ETL, 마이그레이션)이나 특정 NoSQL 스타일 설계에서는 의도적으로 비활성화하기도 한다.

```sql
-- MySQL: FK 검사 임시 비활성화
SET FOREIGN_KEY_CHECKS = 0;
-- 대량 INSERT ...
SET FOREIGN_KEY_CHECKS = 1;

-- PostgreSQL: 테이블의 모든 트리거(FK 포함) 임시 비활성화
ALTER TABLE orders DISABLE TRIGGER ALL;
-- 로딩 후
ALTER TABLE orders ENABLE TRIGGER ALL;
```

FK를 끄는 작업은 반드시 범위를 최소화하고, 끈 후에 데이터 일관성을 직접 검증해야 한다.

다음 글에서는 UNIQUE 제약이 NULL을 어떻게 다루는지, 그리고 기본 키와 어떻게 다른지를 살펴본다.

---

**지난 글:** [기본 키 설계 — PRIMARY KEY의 본질과 전략](/posts/sql-primary-key-design/)

**다음 글:** [유니크 제약 — UNIQUE 인덱스와 NULL 허용 동작](/posts/sql-unique-constraint/)

<br>
읽어주셔서 감사합니다. 😊
