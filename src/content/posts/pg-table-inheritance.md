---
title: "테이블 상속 — INHERITS와 파티셔닝의 뿌리"
description: "PostgreSQL INHERITS로 테이블 상속 계층을 구성하는 방법, 부모 조회 시 자식 포함 동작, ONLY 키워드, tableoid를 이용한 자식 테이블 구분, 상속과 선언적 파티셔닝의 관계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["postgresql", "table-inheritance", "inherits", "only", "tableoid", "partitioning", "single-table-inheritance"]
featured: false
draft: false
---

[지난 글](/posts/pg-identity-vs-sequence/)에서 자동 증가 키 생성 전략을 살펴봤다. 이번에는 PostgreSQL 고유 기능인 **테이블 상속(Table Inheritance)**을 다룬다. 객체지향의 상속 개념을 관계형 테이블에 적용한 이 기능은 선언적 파티셔닝의 뿌리이기도 하다.

## 테이블 상속이란

`INHERITS` 키워드를 사용하면 자식 테이블이 부모 테이블의 모든 컬럼과 CHECK 제약을 이어받는다. 부모 테이블을 조회하면 자식 테이블의 데이터도 포함된다.

```sql
-- 부모 테이블
CREATE TABLE vehicle (
    id    bigint PRIMARY KEY,
    make  text NOT NULL,
    model text,
    year  integer CHECK (year >= 1886),
    price numeric(12,2)
);

-- 자식 테이블: 부모 컬럼 + 고유 컬럼
CREATE TABLE car (
    num_doors integer DEFAULT 4,
    fuel_type text
) INHERITS (vehicle);

CREATE TABLE truck (
    payload_tons numeric(6,2),
    axles        integer
) INHERITS (vehicle);
```

![테이블 상속 계층 구조](/assets/posts/pg-table-inheritance-hierarchy.svg)

## 데이터 삽입과 조회

```sql
-- 자식 테이블에 삽입 (부모 컬럼 포함)
INSERT INTO car (id, make, model, year, price, num_doors, fuel_type)
VALUES (1, 'Hyundai', 'Ioniq6', 2024, 55000000, 4, 'electric');

INSERT INTO truck (id, make, model, year, price, payload_tons)
VALUES (2, 'Hyundai', 'Porter', 2023, 28000000, 1.5);

-- 부모 조회 → 자식 포함
SELECT id, make, year FROM vehicle ORDER BY id;
-- 1 | Hyundai | 2024  (car에서)
-- 2 | Hyundai | 2023  (truck에서)

-- 자식 테이블 구분
SELECT tableoid::regclass AS source, id, make
FROM vehicle;
-- car   | 1 | Hyundai
-- truck | 2 | Hyundai
```

`tableoid`는 각 행이 실제로 어느 테이블에 저장되어 있는지 OID를 반환한다. `::regclass`로 캐스팅하면 테이블 이름으로 변환된다.

![테이블 상속 DDL 패턴](/assets/posts/pg-table-inheritance-code.svg)

## ONLY 키워드

```sql
-- 부모 테이블 직접 삽입 데이터만 조회
SELECT * FROM ONLY vehicle;

-- UPDATE/DELETE도 ONLY 사용 가능
UPDATE ONLY vehicle SET price = price * 1.05;  -- 자식 제외
DELETE FROM ONLY vehicle WHERE year < 2000;
```

`ONLY`를 쓰지 않으면 모든 자식의 해당 행도 함께 영향을 받는다.

## CHECK 제약 상속

부모의 CHECK 제약은 자식에게 상속된다. 자식은 추가 CHECK를 더할 수 있다.

```sql
-- 부모의 year >= 1886 제약이 car에도 적용
INSERT INTO car (id, make, year) VALUES (3, 'Test', 1800);
-- ERROR: new row violates check constraint "vehicle_year_check"

-- 자식 전용 추가 제약
ALTER TABLE truck ADD CONSTRAINT chk_payload
    CHECK (payload_tons > 0 AND payload_tons <= 50);
```

**주의**: 부모에서 `NOT NULL` 제약은 상속되지만, `UNIQUE`와 `PRIMARY KEY`는 자식에 자동 상속되지 않는다. 각 자식에 독립적으로 선언해야 한다.

## 부모 컬럼 추가 → 자식 반영

부모에 컬럼을 추가하면 모든 자식에 자동으로 반영된다.

```sql
ALTER TABLE vehicle ADD COLUMN color text;

-- car, truck 모두 color 컬럼 획득
\d car
-- id, make, model, year, price, num_doors, fuel_type, color
```

반대로 자식에만 컬럼을 추가하면 부모와 다른 자식에는 영향이 없다.

## 상속 제약

1. **외래 키 참조 불가**: 다른 테이블이 부모를 FK로 참조해도 자식 행을 가리킬 수 없다.
2. **UNIQUE 제약 미상속**: 각 자식에서 독립 선언 필요.
3. **인덱스 미상속**: 부모 인덱스는 부모 행에만 적용. 자식 인덱스는 별도 생성.

```sql
-- 각 자식에 인덱스 개별 생성
CREATE INDEX idx_car_year ON car (year);
CREATE INDEX idx_truck_year ON truck (year);
-- 부모의 vehicle(year) 인덱스는 자식 조회 시 활용 안 됨
```

## 상속 vs 선언적 파티셔닝

PostgreSQL 10에서 **선언적 파티셔닝(Declarative Partitioning)**이 도입됐다. 내부적으로 상속 메커니즘을 사용하지만, 명시적 `PARTITION BY` 구문으로 파티션을 관리한다.

| 기능 | 테이블 상속 | 선언적 파티셔닝 |
|------|------------|----------------|
| 구문 | `INHERITS` | `PARTITION BY` |
| 자식 추가 | `INHERITS (부모)` | `PARTITION OF 부모` |
| FK 참조 | 불가 | pg 12+ 가능 |
| 파티션 pruning | 수동 | 자동 |
| 권장 | 모델링 상속 | 대용량 파티셔닝 |

성능 최적화 목적의 파티셔닝에는 선언적 파티셔닝을 사용하고, **단일 테이블 상속(STI) 패턴**처럼 다형성 모델링에는 `INHERITS`를 활용한다.

## 단일 테이블 상속 패턴

ORM의 STI 패턴을 PostgreSQL 상속으로 구현할 수 있다.

```sql
CREATE TABLE notification (
    id         bigint PRIMARY KEY,
    user_id    bigint NOT NULL,
    created_at timestamptz DEFAULT now(),
    is_read    boolean DEFAULT false
);

CREATE TABLE email_notification (
    subject text,
    body    text
) INHERITS (notification);

CREATE TABLE push_notification (
    device_token text,
    badge_count  integer
) INHERITS (notification);

-- 모든 알림 조회 (미읽음)
SELECT tableoid::regclass AS type, id, user_id
FROM notification
WHERE NOT is_read
ORDER BY created_at DESC;
```

## 상속 계층 조회

```sql
-- 상속 관계 조회
SELECT parent.relname AS parent, child.relname AS child
FROM pg_inherits i
JOIN pg_class parent ON i.inhparent = parent.oid
JOIN pg_class child  ON i.inhrelid  = child.oid
WHERE parent.relname = 'vehicle';
-- vehicle | car
-- vehicle | truck
-- vehicle | motorcycle

-- 자식 테이블 나열
SELECT c.relname
FROM pg_class c
JOIN pg_inherits i ON c.oid = i.inhrelid
WHERE i.inhparent = 'vehicle'::regclass;
```

## 정리

PostgreSQL 테이블 상속은 관계형 모델에 다형성을 도입하는 독특한 기능이다. 부모 테이블 조회 시 자식 데이터를 자동 포함하는 동작, `ONLY`로 범위 제한, `tableoid`로 자식 구분하는 패턴을 이해하면 다형성 엔티티 모델링에 효과적으로 활용할 수 있다. 대용량 테이블 분할이 목적이라면 선언적 파티셔닝이 더 적합하다.

---

**지난 글:** [IDENTITY vs SEQUENCE — 자동 증가 키 생성 전략](/posts/pg-identity-vs-sequence/)

**다음 글:** [MVCC — xmin, xmax, ctid로 이해하는 다중 버전 동시성](/posts/pg-mvcc-xmin-xmax-ctid/)

<br>
읽어주셔서 감사합니다. 😊
