---
title: "CREATE TABLE 기초 — 테이블 설계의 시작"
description: "CREATE TABLE 구문의 전체 구조와 열 정의, 제약 조건 선언 방법, CTAS와 복합 기본 키 패턴까지 테이블 생성의 모든 것을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["SQL", "CREATE TABLE", "DDL", "제약조건", "테이블설계"]
featured: false
draft: false
---

[지난 글](/posts/sql-language-categories/)에서 SQL을 DDL, DML, DCL, TCL로 분류했다. 이제 DDL의 첫 번째 구문인 `CREATE TABLE`을 깊이 살펴본다. 테이블을 제대로 만드는 것이 이후 모든 쿼리의 성능과 데이터 품질을 결정한다.

## CREATE TABLE 기본 구조

`CREATE TABLE` 구문은 테이블 이름, 열(컬럼) 목록, 테이블 수준 제약 조건으로 이루어진다.

```sql
CREATE TABLE 테이블명 (
    열이름1  데이터타입  [열 수준 제약],
    열이름2  데이터타입  [열 수준 제약],
    ...
    [테이블 수준 제약]
);
```

열 수준 제약은 해당 열 바로 뒤에 선언하고, 테이블 수준 제약은 모든 열 선언 뒤에 별도로 작성한다. 두 열 이상을 묶는 복합 제약은 반드시 테이블 수준으로 선언해야 한다.

![CREATE TABLE 구조 해부](/assets/posts/sql-create-table-basics-anatomy.svg)

## 열 정의 핵심 요소

### 데이터 타입

타입 선택은 스토리지 효율과 연산 성능에 직접 영향을 준다.

```sql
CREATE TABLE 직원 (
    직원ID     INTEGER           PRIMARY KEY,  -- 4바이트 정수
    사번       CHAR(10)          NOT NULL,     -- 고정 길이 문자열
    이름       VARCHAR(100)      NOT NULL,     -- 가변 길이 문자열
    급여       NUMERIC(12, 2)    NOT NULL,     -- 정밀 소수 (화폐)
    입사일     DATE              NOT NULL,     -- 날짜 (시간 없음)
    활성여부   BOOLEAN           DEFAULT TRUE  -- 참/거짓
);
```

정확한 화폐 계산에는 `FLOAT`/`DOUBLE` 대신 `NUMERIC(precision, scale)` 또는 `DECIMAL`을 쓴다. 부동소수점은 `0.1 + 0.2 = 0.30000000000000004` 같은 오차를 낸다.

### 제약 조건

```sql
CREATE TABLE 제품 (
    제품ID     INTEGER      PRIMARY KEY,     -- PK: UNIQUE + NOT NULL
    제품코드   VARCHAR(20)  NOT NULL UNIQUE, -- 중복 불가
    가격       NUMERIC(10,2) NOT NULL
                 CHECK (가격 > 0),           -- 양수 강제
    재고수량   INTEGER      NOT NULL
                 DEFAULT 0,                  -- 생략 시 기본값
    카테고리   VARCHAR(50)  NOT NULL
                 DEFAULT '미분류'
);
```

`CHECK` 제약은 비즈니스 규칙을 데이터베이스 계층에서 강제한다. 애플리케이션이 우회해도 막힌다.

## IF NOT EXISTS

이미 테이블이 있으면 오류 대신 무시하는 옵션이다. 멱등성이 필요한 마이그레이션 스크립트에서 유용하다.

```sql
CREATE TABLE IF NOT EXISTS 로그 (
    로그ID    BIGINT      PRIMARY KEY,
    이벤트   VARCHAR(200) NOT NULL,
    생성일시 TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

다만 `IF NOT EXISTS`는 스키마가 달라도 오류 없이 넘어가므로, 마이그레이션 도구(Flyway, Liquibase)에서는 버전 관리된 스크립트를 통해 중복을 제어한다.

## CTAS — CREATE TABLE AS SELECT

기존 쿼리 결과로 새 테이블을 만드는 방법이다.

```sql
-- 데이터와 구조 모두 복사
CREATE TABLE 2024년주문 AS
SELECT * FROM 주문 WHERE EXTRACT(YEAR FROM 주문일) = 2024;

-- 구조만 복사 (데이터 없이)
CREATE TABLE 주문_백업 AS
SELECT * FROM 주문 WHERE 1 = 0;
```

CTAS는 열 타입은 복사하지만 **기본 키, 외래 키, NOT NULL, 인덱스는 복사하지 않는다**. 복사 후 필요한 제약과 인덱스를 `ALTER TABLE`과 `CREATE INDEX`로 추가해야 한다.

![CTAS와 복합 기본 키](/assets/posts/sql-create-table-basics-patterns.svg)

## 복합 기본 키

두 개 이상의 열 조합이 행을 유일하게 식별할 때 사용한다. 다대다(M:N) 관계의 연결 테이블이 대표적이다.

```sql
CREATE TABLE 수강신청 (
    학생ID    INTEGER NOT NULL,
    강의ID    INTEGER NOT NULL,
    신청일    DATE    NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (학생ID, 강의ID),  -- 테이블 수준 선언
    FOREIGN KEY (학생ID) REFERENCES 학생(학생ID),
    FOREIGN KEY (강의ID) REFERENCES 강의(강의ID)
);
```

같은 학생이 같은 강의를 중복 신청할 수 없다는 규칙이 `PRIMARY KEY (학생ID, 강의ID)`로 표현된다.

## 명명 규칙 권장 사항

일관된 명명 규칙은 SQL 가독성과 유지 보수성을 높인다.

- **테이블**: 복수형 영문 소문자 언더스코어(`orders`, `order_items`) 또는 한국어 명사
- **열**: 소문자 언더스코어(`customer_id`, `created_at`)
- **기본 키**: `{테이블명}_id` 또는 단순 `id`
- **외래 키**: 참조 대상과 동일한 이름(`customer_id` → `customers.customer_id`)

예약어(SELECT, TABLE, ORDER 등)는 열 이름으로 쓰지 않는다. 불가피하면 큰따옴표(`"order"`)나 백틱(MySQL: `` `order` ``)으로 이스케이프한다.

---

**지난 글:** [SQL 언어 분류 — DDL, DML, DCL, TCL 완전 정리](/posts/sql-language-categories/)

**다음 글:** [데이터 타입 완전 정리 — 숫자, 문자열, 불리언](/posts/sql-data-types-numeric-string-bool/)

<br>
읽어주셔서 감사합니다. 😊
