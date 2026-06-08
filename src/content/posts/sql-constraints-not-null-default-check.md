---
title: "제약조건 완전 정복 — NOT NULL, DEFAULT, CHECK"
description: "NOT NULL, DEFAULT, CHECK 제약조건의 정확한 동작 방식, 열 제약과 테이블 제약의 차이, ALTER TABLE로 제약조건을 추가/제거하는 방법, 그리고 MySQL에서 CHECK가 무시되는 버전 이슈를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["SQL", "제약조건", "NOT NULL", "DEFAULT", "CHECK", "무결성", "ALTER TABLE"]
featured: false
draft: false
---

[지난 글](/posts/sql-data-types-datetime/)에서 날짜와 시간 타입을 다뤘다. 올바른 타입을 선택했다면 이제 그 열에 어떤 값이 들어올 수 있는지를 제약조건으로 강제할 차례다. 제약조건은 데이터 무결성의 첫 번째 방어선이다. 애플리케이션 코드에서 유효성 검사를 아무리 철저히 해도, DB 레벨 제약이 없으면 마이그레이션 스크립트, 배치 작업, 직접 SQL 실행으로 유효하지 않은 데이터가 들어올 수 있다.

## NOT NULL

`NOT NULL`은 가장 기본적인 제약조건이다. 해당 열에 `NULL` 값이 저장되는 것을 막는다. 열 정의 뒤에 바로 붙인다.

```sql
CREATE TABLE employees (
    id     INT         NOT NULL,
    name   VARCHAR(100) NOT NULL,
    phone  VARCHAR(20)  NULL,       -- 선택적 정보
    dept   VARCHAR(50)  NOT NULL
);
```

### NOT NULL 추가 시 주의사항

이미 데이터가 있는 열에 NOT NULL을 추가하려면 기존 NULL 값을 먼저 처리해야 한다.

```sql
-- 1단계: NULL인 행 확인
SELECT COUNT(*) FROM employees WHERE phone IS NULL;

-- 2단계: NULL 값 채우기
UPDATE employees SET phone = '000-0000-0000' WHERE phone IS NULL;

-- 3단계: NOT NULL 추가
ALTER TABLE employees ALTER COLUMN phone SET NOT NULL;  -- PostgreSQL
```

### NOT NULL의 의미

`NOT NULL`을 강제하면 쿼리에서 `IS NULL` 조건을 빠뜨리는 실수로 발생하는 버그를 방지한다. 또한 옵티마이저가 해당 열에 NULL이 없음을 알므로 더 효율적인 실행 계획을 선택할 수 있다.

## DEFAULT

`DEFAULT`는 INSERT 시 해당 열의 값을 생략했을 때 자동으로 채워질 기본값을 지정한다. NOT NULL과 자주 함께 쓰인다.

```sql
CREATE TABLE orders (
    id          BIGINT       NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
    is_paid     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- status를 지정하지 않으면 'pending'으로 삽입됨
INSERT INTO orders (id) VALUES (1001);
```

![제약조건 계층과 역할](/assets/posts/sql-constraints-not-null-default-check-overview.svg)

### DEFAULT 표현식

상수뿐만 아니라 함수나 표현식도 DEFAULT로 쓸 수 있다.

```sql
-- 타임스탬프 자동 생성
created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

-- PostgreSQL: UUID 자동 생성
id UUID NOT NULL DEFAULT gen_random_uuid()

-- PostgreSQL: 계산된 기본값
score INT NOT NULL DEFAULT 0

-- Oracle: 시퀀스 기본값 (12c 이상)
id NUMBER NOT NULL DEFAULT order_seq.NEXTVAL
```

`DEFAULT`는 `INSERT` 시에만 적용된다. `UPDATE` 시에는 적용되지 않는다. `updated_at`을 자동 갱신하려면 트리거나 애플리케이션 코드가 필요하다(MySQL의 `ON UPDATE CURRENT_TIMESTAMP`는 예외).

```sql
-- MySQL에서만 지원: UPDATE 시 자동 갱신
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## CHECK

`CHECK` 제약조건은 열 값이 특정 조건을 만족해야 함을 강제한다. 조건이 `FALSE`이면 INSERT/UPDATE가 실패한다. 조건이 `NULL`이면 통과한다(NULL은 UNKNOWN이므로).

```sql
CREATE TABLE products (
    id       INT           NOT NULL,
    price    DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    discount DECIMAL(5,2)  NOT NULL DEFAULT 0 CHECK (discount BETWEEN 0 AND 100),
    status   VARCHAR(20)   NOT NULL CHECK (status IN ('active', 'inactive', 'discontinued')),
    CONSTRAINT pk_products PRIMARY KEY (id)
);
```

### 테이블 레벨 CHECK

여러 열을 동시에 참조하는 CHECK는 테이블 제약으로 정의한다.

```sql
CREATE TABLE events (
    id         INT  NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    CONSTRAINT pk_events        PRIMARY KEY (id),
    CONSTRAINT chk_event_dates  CHECK (end_date >= start_date)
);
```

### MySQL의 CHECK 버전 이슈

MySQL 8.0.16 이전 버전에서는 `CHECK` 제약조건이 파싱은 되지만 **실제로 강제되지 않았다**. 문법 오류도 나지 않고 조건을 위반해도 삽입이 성공했다. MySQL 8.0.16부터 CHECK가 실제로 동작한다. 이전 버전을 쓴다면 CHECK 대신 트리거로 구현해야 한다.

MariaDB는 10.2.1부터 CHECK를 지원한다.

## ALTER TABLE로 제약조건 관리

![ALTER TABLE로 제약조건 추가/제거](/assets/posts/sql-constraints-not-null-default-check-alter.svg)

## DBMS별 제약조건 비활성화

대용량 데이터 로드 시 제약조건을 임시로 비활성화하면 성능을 높일 수 있다.

```sql
-- PostgreSQL: 트랜잭션 내에서 제약 지연
SET CONSTRAINTS ALL DEFERRED;

-- MySQL: FK 검사 비활성화 (대용량 로드 시)
SET foreign_key_checks = 0;
-- 로드 완료 후 반드시 다시 활성화
SET foreign_key_checks = 1;

-- Oracle: 제약 비활성화
ALTER TABLE orders DISABLE CONSTRAINT fk_orders_user;
-- 데이터 로드 후
ALTER TABLE orders ENABLE VALIDATE CONSTRAINT fk_orders_user;
```

## 제약조건 설계 원칙

**DB를 최후 방어선으로 사용하라**. 애플리케이션 유효성 검사와 DB 제약조건을 이중으로 설정한다. 애플리케이션 코드는 빠른 피드백을 위해, DB 제약조건은 진짜 무결성 보장을 위해 존재한다. 어느 하나만으로는 충분하지 않다.

다음 글에서는 제약조건 중 가장 핵심인 기본 키 설계를 깊이 다룬다.

---

**지난 글:** [날짜/시간 데이터 타입 완전 정복](/posts/sql-data-types-datetime/)

**다음 글:** [기본 키 설계 — 자연 키, 대리 키, UUID](/posts/sql-primary-key-design/)

<br>
읽어주셔서 감사합니다. 😊
