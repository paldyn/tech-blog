---
title: "CREATE TABLE 기초 — 테이블을 올바르게 만드는 법"
description: "CREATE TABLE 문법의 모든 요소(컬럼 정의, 인라인/테이블 제약, FK ON DELETE, IF NOT EXISTS, CTAS)와 DBMS별 차이를 예제와 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["CREATE TABLE", "DDL", "테이블설계", "CTAS", "임시테이블", "자동증가", "FK", "제약조건"]
featured: false
draft: false
---

[지난 글](/posts/sql-language-categories/)에서 DDL이 스키마를 정의하며 자동 COMMIT된다는 것을 배웠다. 이번 글에서는 DDL의 핵심인 `CREATE TABLE`을 완전히 파헤친다. 단순히 "테이블 만드는 명령"을 넘어, 올바른 설계를 위한 구문 요소들을 하나씩 짚는다.

## CREATE TABLE 기본 구조

테이블은 **컬럼 정의**와 **제약조건(Constraint)** 목록으로 구성된다.

![CREATE TABLE 구문 구조](/assets/posts/sql-create-table-syntax.svg)

```sql
CREATE TABLE employees (
    -- 컬럼 정의: 이름  타입  [제약...]
    emp_id    INT           NOT NULL PRIMARY KEY,
    name      VARCHAR(100)  NOT NULL,
    dept_id   INT,
    salary    DECIMAL(12,2) DEFAULT 0,
    hire_date DATE          NOT NULL,

    -- 테이블 수준 제약 (이름 지정 가능)
    CONSTRAINT fk_dept
        FOREIGN KEY (dept_id)
        REFERENCES departments(dept_id)
        ON DELETE RESTRICT,

    CHECK (salary >= 0)
);
```

### 인라인 제약 vs 테이블 제약

- **인라인 제약**: 컬럼 정의 옆에 바로 붙이는 방식. 단일 컬럼 제약에 편리
- **테이블 제약**: 마지막 섹션에 별도로 정의. `CONSTRAINT 이름`으로 이름 지정 가능, 복합 키(Composite Key) 표현 필수

```sql
-- 복합 기본 키는 테이블 제약으로만 가능
CREATE TABLE order_items (
    order_id    INT NOT NULL,
    product_id  INT NOT NULL,
    quantity    INT NOT NULL DEFAULT 1,

    -- 복합 PK: 인라인으로는 불가
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);
```

## IF NOT EXISTS

개발·배포 환경에서 멱등성(Idempotency)을 확보하려면 `IF NOT EXISTS`를 사용한다.

```sql
-- 이미 테이블이 있으면 오류 대신 경고
CREATE TABLE IF NOT EXISTS products (
    product_id  INT PRIMARY KEY,
    name        VARCHAR(200) NOT NULL
);
-- PostgreSQL, MySQL, SQLite 지원 / Oracle은 미지원(PL/SQL로 대체)
```

## 자동 증가 컬럼 — DBMS마다 다르다

```sql
-- PostgreSQL: IDENTITY (SQL 표준, 권장)
emp_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- PostgreSQL: SERIAL (레거시, 내부적으로 SEQUENCE 생성)
emp_id SERIAL PRIMARY KEY

-- MySQL: AUTO_INCREMENT
emp_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY

-- Oracle 12c+: IDENTITY
emp_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- SQL Server: IDENTITY(seed, increment)
emp_id INT IDENTITY(1,1) PRIMARY KEY
```

## FOREIGN KEY ON DELETE 옵션

참조하는 부모 행이 삭제될 때 자식 행을 어떻게 처리할지 정의한다.

| 옵션 | 동작 | 사용 케이스 |
|------|------|-----------|
| `RESTRICT` | 자식이 있으면 삭제 거부 | 기본값, 안전 |
| `CASCADE` | 자식도 함께 삭제 | 의존 데이터 자동 정리 |
| `SET NULL` | 자식의 FK 컬럼을 NULL로 | 선택적 관계 |
| `NO ACTION` | RESTRICT와 유사, 지연 검사 가능 | Oracle 기본 |
| `SET DEFAULT` | 자식의 FK를 기본값으로 | 거의 미사용 |

```sql
-- CASCADE 예시: 주문 삭제 시 주문 항목도 자동 삭제
CONSTRAINT fk_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
```

## CTAS — CREATE TABLE AS SELECT

기존 쿼리 결과로 새 테이블을 만들 때 사용한다.

![CTAS와 DBMS별 차이](/assets/posts/sql-create-table-ctas.svg)

```sql
-- 데이터 포함 복사 (고성능, 배치 처리 시 유용)
CREATE TABLE high_salary_emp AS
SELECT * FROM employees WHERE salary > 100000;

-- 구조만 복사 (데이터 없음)
CREATE TABLE emp_template AS
SELECT * FROM employees WHERE 1 = 0;
```

**중요**: CTAS는 컬럼 타입만 복사하며, **PRIMARY KEY, FOREIGN KEY, INDEX, DEFAULT 값은 복사되지 않는다**. 제약조건은 `ALTER TABLE`로 별도 추가해야 한다.

## 임시 테이블

세션 범위로만 존재하는 테이블이다. 중간 결과를 저장하거나 복잡한 쿼리를 단계별로 처리할 때 사용한다.

```sql
-- PostgreSQL/MySQL
CREATE TEMPORARY TABLE temp_calc (
    emp_id INT,
    bonus  DECIMAL(12,2)
);

-- SQL Server (# 접두어)
CREATE TABLE #temp_calc (
    emp_id INT,
    bonus  DECIMAL(12,2)
);

-- Oracle (전역 임시 테이블: 구조는 영구, 데이터만 임시)
CREATE GLOBAL TEMPORARY TABLE temp_calc (
    emp_id INT,
    bonus  DECIMAL(12,2)
) ON COMMIT DELETE ROWS;
```

## 설계 체크리스트

```text
CREATE TABLE 작성 전 확인사항:
[ ] 모든 컬럼에 적절한 NOT NULL 제약 적용
[ ] 기본 키(PK) 명시적 정의
[ ] FK에 ON DELETE 옵션 명시
[ ] 자동 증가 컬럼 방식 (DBMS별 차이 주의)
[ ] VARCHAR 길이 충분히 여유 있게 설정
[ ] DECIMAL(전체자리, 소수자리) 범위 확인
[ ] 제약조건에 이름 부여 (에러 메시지 식별용)
[ ] CREATE TABLE IF NOT EXISTS (배포 스크립트)
```

## 정리

- `CREATE TABLE`은 컬럼 정의 + 제약조건 섹션으로 구성
- 복합 키는 **테이블 제약**으로만 정의 가능
- 자동 증가 컬럼은 DBMS마다 문법이 다르다 (`IDENTITY` vs `AUTO_INCREMENT`)
- `FK ON DELETE` 옵션을 항상 명시하자 — 기본값(`RESTRICT`)만 믿으면 안 됨
- **CTAS는 구조만 복사**, 제약조건은 직접 추가 필요

---

**지난 글:** [SQL 언어 분류 — DDL, DML, DCL, TCL 완전 정복](/posts/sql-language-categories/)

**다음 글:** [SQL 데이터 타입 완전 정복 — 숫자, 문자, 논리형](/posts/sql-data-types-numeric-string-bool/)

<br>
읽어주셔서 감사합니다. 😊
