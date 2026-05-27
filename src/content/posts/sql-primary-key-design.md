---
title: "기본 키(Primary Key) 설계 — 자연 키 vs 대리 키, 복합 키"
description: "자연 키와 대리 키의 차이, BIGINT vs UUID vs ULID vs Snowflake ID 선택 기준, 복합 기본 키의 장단점, B-Tree 단편화 문제를 예제와 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["기본키", "PrimaryKey", "자연키", "대리키", "UUID", "ULID", "Snowflake", "복합키", "B-Tree단편화"]
featured: false
draft: false
---

[지난 글](/posts/sql-constraints-not-null-default-check/)에서 NOT NULL, DEFAULT, CHECK 제약조건을 살펴봤다. 이번 글에서는 테이블 설계에서 가장 중요한 결정 중 하나인 **기본 키(Primary Key) 설계**를 다룬다. 단순히 "고유 식별자"를 넘어, 성능과 유지보수성에 직결되는 선택이다.

## 기본 키의 조건

기본 키가 만족해야 하는 세 가지 조건:

1. **유일성(Uniqueness)**: 같은 값을 가진 행이 두 개 이상 존재할 수 없다
2. **NULL 불가**: 기본 키 컬럼에는 NULL이 들어갈 수 없다
3. **최소성(Minimality)**: 복합 키라면, 일부 컬럼을 제거해도 유일성이 유지되면 안 된다

```sql
-- 기본 키 선언 방식 1: 인라인
CREATE TABLE orders (
    order_id BIGINT NOT NULL PRIMARY KEY,
    ...
);

-- 방식 2: 테이블 제약 (복합 키 필수)
CREATE TABLE order_items (
    order_id    BIGINT NOT NULL,
    product_id  BIGINT NOT NULL,
    quantity    INT    NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, product_id)  -- 복합 PK
);
```

## 자연 키 vs 대리 키

![자연 키 vs 대리 키 비교](/assets/posts/sql-primary-key-natural-vs-surrogate.svg)

**자연 키(Natural Key)**는 비즈니스 세계에 실제로 존재하는 식별자다. 주민등록번호, 사원번호, 이메일 주소, ISBN이 그 예다.

**대리 키(Surrogate Key)**는 시스템이 자동으로 생성하는 의미 없는 식별자다. 순차 정수(AUTO_INCREMENT), UUID, ULID 등이 해당된다.

### 왜 대리 키가 권장되는가?

```sql
-- 자연 키의 문제: 변경 시 CASCADE 전파
-- 사원번호 체계가 변경되면...
UPDATE employees SET emp_no = 'EMP-2026-001' WHERE emp_no = 'EMP-001';
-- → 이 emp_no를 FK로 참조하는 모든 테이블에 연쇄 UPDATE 필요
-- → 잠금 경합, 성능 저하, 데이터 정합성 위험

-- 대리 키의 해결책: 비즈니스 변경과 무관
-- emp_id(BIGINT)는 절대 바뀌지 않음
-- emp_no(사원번호)는 UNIQUE로 별도 관리
CREATE TABLE employees (
    emp_id  BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    emp_no  VARCHAR(20) NOT NULL UNIQUE,  -- 자연 키를 UNIQUE로 별도 관리
    name    VARCHAR(100) NOT NULL
);
```

## 대리 키 전략 비교

![대리 키 전략 비교](/assets/posts/sql-primary-key-strategies.svg)

### BIGINT (순차 정수) — 단일 DB의 최선택

```sql
-- PostgreSQL
emp_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- MySQL
emp_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY

-- Oracle
emp_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- SQL Server
emp_id BIGINT IDENTITY(1,1) PRIMARY KEY
```

BIGINT는 약 922경(9.2 × 10^18)까지 지원해 사실상 고갈 위험이 없다. JOIN 성능이 UUID보다 훨씬 빠르고, 저장 공간도 8 bytes로 효율적이다.

### UUID v4 — 분산 환경의 선택, 단 단편화 주의

```sql
-- PostgreSQL: 내장 함수
emp_id UUID DEFAULT gen_random_uuid() PRIMARY KEY

-- MySQL 8.0+
emp_id CHAR(36) DEFAULT (UUID()) PRIMARY KEY
-- 또는 BINARY(16)에 바이너리로 저장 (성능 우수)
emp_id BINARY(16) DEFAULT (UUID_TO_BIN(UUID(), 1)) PRIMARY KEY
```

**UUID v4의 B-Tree 단편화 문제**: UUID v4는 완전 랜덤이라 새 UUID가 기존 B-Tree의 임의 위치에 삽입된다. MySQL InnoDB의 클러스터드 인덱스는 PK 순서로 데이터를 저장하기 때문에, 랜덤 UUID는 **페이지 분할(Page Split)**을 빈번하게 일으켜 INSERT 성능을 떨어뜨린다.

### UUID v7 / ULID — 분산 + 정렬 가능

```sql
-- UUID v7: 앞 48비트가 타임스탬프 → 시간순 정렬 가능
-- PostgreSQL 17+: gen_random_uuid() 대신 UUID v7 지원 예정
-- 현재는 확장 기능 사용

-- ULID 예시 (Universally Unique Lexicographically Sortable Identifier)
-- 26자 Base32: 01ARZ3NDEKTSV4RRFFQ69G5FAV
-- 앞 10자 = 타임스탬프, 뒤 16자 = 랜덤
```

UUID v7과 ULID는 앞부분이 타임스탬프로 시작해 **생성 시간순으로 정렬**된다. B-Tree 단편화 문제가 UUID v4보다 훨씬 적다.

## 복합 기본 키 — 관계 테이블의 표준 패턴

```sql
-- Many-to-Many 중간 테이블은 복합 PK가 자연스럽다
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- 조회 패턴에 따라 인덱스 방향을 고려
-- (user_id, role_id): user_id로 자주 검색할 때 유리
-- 반대로 role_id 기준 검색이 많다면 별도 인덱스 추가
CREATE INDEX idx_user_roles_role ON user_roles (role_id);
```

복합 PK에서는 **컬럼 순서가 성능에 영향**을 준다. 가장 자주 검색하는 조건의 컬럼을 앞에 배치한다.

## 기본 키 선택 체크리스트

```text
기본 키 설계 체크리스트:
[ ] 대리 키(BIGINT/UUID) 사용 — 자연 키는 UNIQUE로 별도 관리
[ ] 단일 DB → BIGINT AUTO_INCREMENT/IDENTITY
[ ] 분산 시스템, 외부 노출 → UUID v7 또는 ULID
[ ] MySQL InnoDB → UUID v4 사용 시 BINARY(16) 또는 UUID v7 권장
[ ] 복합 PK → 자주 검색하는 컬럼을 앞에 배치
[ ] PK 컬럼 이름: {테이블명}_id 규칙 통일 (팀 컨벤션)
```

## 정리

- **기본 키 조건**: 유일성, NOT NULL, 최소성
- **대리 키 권장**: 비즈니스 변경에 무관, 성능 우수
- **BIGINT**: 단일 DB에서 가장 빠른 선택
- **UUID v4**: 분산 환경 안전하지만 B-Tree 단편화 주의 — MySQL InnoDB에서는 BINARY(16) 또는 UUID v7 사용
- **UUID v7 / ULID**: 분산 + 정렬 가능 — UUID v4의 단편화 문제 해결
- **복합 PK**: Many-to-Many 관계 테이블에서 사용, 컬럼 순서가 성능에 영향

---

**지난 글:** [SQL 제약조건 — NOT NULL, DEFAULT, CHECK 완전 정복](/posts/sql-constraints-not-null-default-check/)

<br>
읽어주셔서 감사합니다. 😊
