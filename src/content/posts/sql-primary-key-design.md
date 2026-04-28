---
title: "기본 키 설계 — PRIMARY KEY의 본질과 전략"
description: "PRIMARY KEY의 역할과 내부 동작, 자연 키 vs 대리 키 선택 기준, SERIAL·UUID·ULID 각 타입의 장단점, 복합 기본 키 설계까지 실전 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "primary-key", "natural-key", "surrogate-key", "uuid", "serial", "ulid", "ddl", "기본키"]
featured: false
draft: false
---

[지난 글](/posts/sql-constraints-not-null-default-check/)에서 NOT NULL, DEFAULT, CHECK 세 가지 컬럼 제약을 다뤘다. 이번에는 테이블의 심장부인 PRIMARY KEY를 설계하는 방법을 다룬다.

---

## PRIMARY KEY가 하는 일

기본 키(PRIMARY KEY)는 테이블의 각 행을 **유일하게 식별**하는 컬럼(또는 컬럼 조합)이다. 내부적으로는 두 가지 제약을 동시에 강제한다.

1. **UNIQUE**: 같은 값이 두 번 들어올 수 없다.
2. **NOT NULL**: NULL 값이 들어올 수 없다.

대부분의 DBMS는 기본 키 컬럼에 자동으로 **클러스터드 인덱스(Clustered Index)** 또는 기본 인덱스를 생성한다. 즉, 기본 키는 제약이면서 동시에 성능 최적화의 기반이다.

```sql
-- 기본 키 선언 방법 두 가지
-- 1. 컬럼 뒤 인라인
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL
);

-- 2. 테이블 수준 (복합 PK나 이름 지정 시 필수)
CREATE TABLE order_items (
    order_id   BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity   INTEGER NOT NULL,
    CONSTRAINT pk_order_items PRIMARY KEY (order_id, product_id)
);
```

![기본 키 설계 전략](/assets/posts/sql-primary-key-design-overview.svg)

---

## 자연 키 vs 대리 키

기본 키로 무엇을 쓸지는 설계에서 가장 먼저 결정해야 할 사항이다.

### 자연 키 (Natural Key)

비즈니스 도메인에서 이미 의미를 가진 컬럼을 기본 키로 사용하는 방식이다.

```sql
-- 주민등록번호를 PK로 (자연 키)
CREATE TABLE residents (
    rrn    CHAR(14) PRIMARY KEY,  -- 주민등록번호
    name   VARCHAR(50) NOT NULL
);
```

자연 키의 문제는 **변경 가능성**이다. 이메일 주소가 바뀌면 해당 값을 외래 키로 참조하는 모든 테이블도 연쇄 수정이 필요하다. 개인정보가 키에 노출되는 보안 문제도 있다.

### 대리 키 (Surrogate Key)

비즈니스 의미 없이 DB가 생성하는 인공 식별자를 기본 키로 사용한다. 현대 설계에서 권장되는 방식이다.

---

## 대리 키 타입 선택

![대리 키 타입 비교](/assets/posts/sql-primary-key-design-types.svg)

### BIGINT + 시퀀스 (SERIAL / AUTO_INCREMENT)

가장 간단하고 성능이 좋다. 단일 DB 환경에서는 첫 번째 선택지다.

```sql
-- PostgreSQL (표준 문법)
CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email   VARCHAR(255) NOT NULL
);

-- MySQL
CREATE TABLE users (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email   VARCHAR(255) NOT NULL
);
```

`INT` 대신 `BIGINT`를 쓰는 이유: INT 최대값(약 21억)은 트래픽이 많은 서비스에서 수년 내에 소진될 수 있다. BIGINT(약 922경)는 사실상 무한하다.

### UUID v4

전역 유일성이 보장되어 분산 시스템, 마이크로서비스 환경에 적합하다. 단, 16바이트 크기와 완전 랜덤 값으로 인한 B-Tree 인덱스 단편화가 단점이다.

```sql
-- PostgreSQL (pgcrypto 또는 기본 함수)
CREATE TABLE events (
    event_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payload  JSONB
);
```

### ULID / UUID v7

타임스탬프 접두사를 가진 정렬 가능한 ID다. UUID v4의 단편화 문제를 해결하면서 분산 환경에서도 사용할 수 있다. 아직 DBMS 기본 지원이 적어 애플리케이션 생성 후 삽입하는 방식을 쓴다.

---

## 복합 기본 키

두 개 이상 컬럼의 조합으로 행을 식별하는 방식이다. 다대다 관계 연결 테이블에 자주 쓰인다.

```sql
CREATE TABLE student_courses (
    student_id  BIGINT NOT NULL,
    course_id   BIGINT NOT NULL,
    enrolled_at DATE   NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT pk_student_courses PRIMARY KEY (student_id, course_id)
);

-- 조회 시 두 컬럼 모두 WHERE 조건으로 사용
SELECT * FROM student_courses
WHERE student_id = 101 AND course_id = 302;
```

복합 PK는 인덱스 효율을 고려해 **선택도(cardinality)가 높은 컬럼을 앞에** 배치하는 것이 유리하다.

---

## 기본 키 설계 원칙 정리

| 원칙 | 설명 |
|---|---|
| 불변성 | PK 값은 절대 바뀌지 않아야 한다 |
| 최소성 | 식별에 필요한 최소 컬럼만 포함 |
| NULL 불가 | 이미 강제되지만 설계 시 항상 의식 |
| 크기 | 작을수록 좋음 (외래 키에 반복 저장됨) |
| 의미 없음 | 대리 키 선호 (비즈니스 변경에 무관) |

기본 키가 정해지면 다른 테이블이 이를 참조할 수 있다. 다음 글에서는 그 참조 관계를 정의하는 FOREIGN KEY와 참조 무결성을 다룬다.

---

**지난 글:** [컬럼 제약 조건 — NOT NULL · DEFAULT · CHECK](/posts/sql-constraints-not-null-default-check/)

**다음 글:** [외래 키와 참조 무결성 — FOREIGN KEY의 작동 원리](/posts/sql-foreign-key-referential-integrity/)

<br>
읽어주셔서 감사합니다. 😊
