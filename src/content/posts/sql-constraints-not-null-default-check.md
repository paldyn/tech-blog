---
title: "컬럼 제약 조건 — NOT NULL · DEFAULT · CHECK"
description: "NOT NULL로 빈 값을 막고, DEFAULT로 기본값을 설정하고, CHECK로 범위를 검증하는 세 가지 컬럼 제약 조건의 동작 원리와 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "constraint", "not-null", "default", "check", "ddl", "3vl", "제약조건"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-datetime/)에서 DATE, TIMESTAMP 같은 날짜·시간 타입을 살펴봤다. 이번에는 컬럼 정의에 붙이는 세 가지 기본 제약 조건 — NOT NULL, DEFAULT, CHECK — 을 다룬다. 테이블 설계의 첫 번째 방어선이다.

---

## 왜 제약 조건이 필요한가

데이터베이스는 "믿을 수 있는 데이터"를 보장해야 한다. 애플리케이션 레이어에서 검증하더라도, DB가 직접 규칙을 강제하지 않으면 잘못된 데이터가 스며드는 경로는 수없이 많다 — 마이그레이션 스크립트, 직접 SQL, 레거시 배치 등. 제약 조건은 **데이터가 어떤 경로로 들어오든 규칙을 지키게** 만드는 안전망이다.

![컬럼 제약 조건 개요](/assets/posts/sql-constraints-not-null-default-check-overview.svg)

---

## NOT NULL

`NOT NULL`은 컬럼에 NULL을 저장할 수 없게 막는다. INSERT 또는 UPDATE 시 해당 컬럼이 NULL이면 오류가 발생한다.

```sql
CREATE TABLE members (
    member_id  INTEGER      NOT NULL,
    email      VARCHAR(255) NOT NULL,
    nickname   VARCHAR(50)  -- NULL 허용
);
```

`nickname`처럼 선택 항목은 NULL을 허용하고, `email`처럼 필수 항목은 NOT NULL로 막는 것이 일반적인 패턴이다.

### NULL의 의미

NULL은 "값이 없음"을 나타내며, 빈 문자열(`''`)이나 0과는 다르다. `NULL = NULL`은 FALSE가 아니라 UNKNOWN이다. 이 세 값 논리(Three-Valued Logic, 3VL)를 이해하면 이후 CHECK 동작도 자연스럽게 이해된다.

---

## DEFAULT

`DEFAULT`는 INSERT 시 값을 생략했을 때 자동으로 채워 넣을 기본값을 지정한다.

```sql
CREATE TABLE orders (
    order_id   INTEGER,
    status     VARCHAR(20)  DEFAULT 'PENDING',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN      DEFAULT FALSE
);

-- status, created_at, is_deleted를 생략해도 기본값이 들어간다
INSERT INTO orders (order_id) VALUES (1001);
```

기본값으로 리터럴 상수 외에 `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_USER` 같은 함수도 사용할 수 있다(DBMS마다 지원 범위가 다르다).

### DEFAULT와 NOT NULL의 조합

```sql
-- DEFAULT만 있으면: 생략 시 기본값, 명시적으로 NULL 삽입 가능
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- DEFAULT + NOT NULL: 생략 시 기본값, 명시적 NULL 삽입도 거부
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

감사 컬럼(created_at, updated_at)처럼 항상 값이 있어야 한다면 `NOT NULL DEFAULT`를 함께 쓰는 것이 안전하다.

---

## CHECK

`CHECK`는 불리언 표현식을 지정하고, 결과가 FALSE면 삽입·수정을 거부한다.

```sql
CREATE TABLE employees (
    emp_id  INTEGER,
    salary  NUMERIC(12,2) CHECK (salary > 0),
    age     INTEGER       CHECK (age BETWEEN 18 AND 65),
    grade   CHAR(1)       CHECK (grade IN ('A','B','C','D','F'))
);
```

### CHECK와 NULL — 반드시 알아야 할 함정

![NULL 처리와 세 값 논리](/assets/posts/sql-constraints-not-null-default-check-null-behavior.svg)

CHECK는 표현식이 **FALSE일 때만** 거부한다. NULL이 포함된 비교는 UNKNOWN을 반환하고, UNKNOWN은 거부되지 않는다.

```sql
-- salary 컬럼에 NOT NULL 없이 CHECK만 있다면:
INSERT INTO employees (salary) VALUES (NULL);
-- NULL > 0 → UNKNOWN → 통과! (의도와 다를 수 있음)

-- NULL도 막으려면 NOT NULL을 함께 사용
salary NUMERIC(12,2) NOT NULL CHECK (salary > 0)
```

이 동작은 버그가 아니라 SQL 표준의 의도된 설계다. NULL은 "알 수 없는 값"이므로 규칙을 위반한다고 단정할 수 없다는 논리다. 그러나 실무에서는 의도치 않은 NULL 허용으로 이어지기 쉬우니, 범위 제약이 필요한 컬럼은 NOT NULL을 함께 붙이는 습관을 들이는 게 좋다.

### 테이블 수준 CHECK

여러 컬럼을 교차 검증할 때는 컬럼이 아닌 테이블 수준에 CHECK를 선언한다.

```sql
CREATE TABLE reservations (
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    CONSTRAINT chk_date_range CHECK (end_date >= start_date)
);
```

---

## 제약 조건 이름 지정

이름을 지정하면 에러 메시지가 명확해지고, 나중에 ALTER TABLE로 제약을 수정·삭제할 때 편리하다.

```sql
CREATE TABLE products (
    price  NUMERIC(12,2)
        CONSTRAINT nn_products_price     NOT NULL
        CONSTRAINT chk_products_price    CHECK (price >= 0),
    status VARCHAR(20)
        CONSTRAINT df_products_status    DEFAULT 'ACTIVE'
        CONSTRAINT chk_products_status   CHECK (status IN ('ACTIVE','INACTIVE'))
);
```

이름 규칙은 팀마다 다르지만 `{타입}_{테이블}_{컬럼}` 형식이 흔히 쓰인다.

---

## 실전 체크리스트

| 상황 | 권장 |
|---|---|
| 반드시 값이 있어야 하는 컬럼 | `NOT NULL` |
| 값 없이도 의미 있는 컬럼 | NULL 허용 |
| 삽입 시 자주 생략되는 컬럼 | `DEFAULT` |
| 기본값도 있고 NULL도 막아야 | `NOT NULL DEFAULT` |
| 값의 범위·목록 제한 | `CHECK` |
| CHECK 대상 컬럼에 NULL도 불허 | `NOT NULL CHECK` |

NOT NULL, DEFAULT, CHECK는 PRIMARY KEY나 FOREIGN KEY에 비해 단순해 보이지만, 데이터 품질을 지키는 가장 직접적인 수단이다. 다음 글에서는 테이블의 식별자 역할을 하는 PRIMARY KEY를 설계하는 방법을 다룬다.

---

**다음 글:** [기본 키 설계 — PRIMARY KEY의 본질과 전략](/posts/sql-primary-key-design/)

<br>
읽어주셔서 감사합니다. 😊
