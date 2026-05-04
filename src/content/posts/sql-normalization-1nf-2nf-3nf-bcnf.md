---
title: "정규화: 1NF ~ BCNF"
description: "함수 종속성 개념, 1NF(원자값), 2NF(부분 종속 제거), 3NF(이행적 종속 제거), BCNF(모든 결정자는 슈퍼키) 각 단계의 조건, 분해 예시, 이상 현상 제거 원리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["sql", "normalization", "1nf", "2nf", "3nf", "bcnf", "functional-dependency", "anomaly", "database-design", "schema"]
featured: false
draft: false
---

[지난 글](/posts/sql-savepoint/)에서 SAVEPOINT와 부분 롤백을 살펴봤다. 이번에는 관계형 데이터베이스 설계의 핵심인 **정규화(Normalization)**—함수 종속성을 분석해 이상 현상을 제거하는 과정—를 1NF부터 BCNF까지 단계별로 정리한다.

---

## 정규화란

**중복 데이터**와 **갱신 이상(Update Anomaly)**을 제거하기 위해 테이블을 작은 단위로 분해하는 과정이다. 목표는 각 데이터가 **한 곳에만 존재**하도록 설계하는 것이다.

```
이상 현상 3종:
- 삽입 이상: 불필요한 데이터 없이 원하는 데이터만 삽입 불가
- 갱신 이상: 일부 행만 수정해 데이터 불일치 발생
- 삭제 이상: 행 삭제 시 원하지 않는 정보도 함께 손실
```

![정규화 단계 개요](/assets/posts/sql-normalization-1nf-2nf-3nf-bcnf-progression.svg)

---

## 함수 종속성 (Functional Dependency)

정규화의 기반 개념이다. **X → Y**는 "X의 값을 알면 Y의 값이 유일하게 결정된다"는 의미다.

```
예시 함수 종속성:
학번 → 이름, 학과    (학번이 같으면 이름·학과도 같음)
(주문번호, 상품번호) → 수량   (복합키로 수량 결정)
상품번호 → 상품명    (상품번호만으로 상품명 결정)
```

---

## 1NF: 제1정규형

**모든 속성은 원자값(Atomic Value)이어야 한다.** 반복 그룹이나 다중값 속성이 없어야 한다.

```sql
-- 1NF 위반: 한 컬럼에 여러 값
-- 잘못된 설계
CREATE TABLE orders_bad (
    order_id  INT,
    products  TEXT  -- '마우스, 키보드, 모니터' ← 원자값 아님!
);

-- 1NF 만족: 행으로 분리
CREATE TABLE order_items (
    order_id    INT,
    product_id  INT,
    PRIMARY KEY (order_id, product_id)
);
```

---

## 2NF: 제2정규형

**1NF를 만족하면서, 복합 기본키가 있을 때 비키 속성이 기본키 전체에 완전 함수 종속이어야 한다.** 기본키의 일부에만 종속되는 **부분 함수 종속**을 제거한다.

![2NF 분해 예시](/assets/posts/sql-normalization-1nf-2nf-3nf-bcnf-table.svg)

```sql
-- 2NF 위반 예시
-- PK = (order_id, product_id)
-- product_name은 product_id만으로 결정됨 → 부분 종속
CREATE TABLE order_items_bad (
    order_id     INT,
    product_id   INT,
    product_name VARCHAR(100),  -- product_id만으로 결정 → 위반!
    qty          INT,
    PRIMARY KEY (order_id, product_id)
);

-- 2NF 만족: 분리
CREATE TABLE order_items (
    order_id    INT,
    product_id  INT REFERENCES products(id),
    qty         INT,
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE products (
    id    INT PRIMARY KEY,
    name  VARCHAR(100)  -- product_id → name (완전 종속)
);
```

단일 컬럼 PK라면 부분 종속이 불가능하므로 자동으로 2NF를 만족한다.

---

## 3NF: 제3정규형

**2NF를 만족하면서, 비키 속성은 기본키에만 직접 종속되어야 한다.** 비키 속성 간의 **이행적 함수 종속(Transitive Dependency)**을 제거한다.

```sql
-- 3NF 위반 예시
-- PK = emp_id
-- emp_id → dept_id → dept_name  ← 이행적 종속!
CREATE TABLE employees_bad (
    emp_id    INT PRIMARY KEY,
    name      VARCHAR(100),
    dept_id   INT,
    dept_name VARCHAR(100)  -- dept_id를 통해 결정 → 위반!
);

-- 3NF 만족: 분리
CREATE TABLE employees (
    emp_id   INT PRIMARY KEY,
    name     VARCHAR(100),
    dept_id  INT REFERENCES departments(id)
);

CREATE TABLE departments (
    id    INT PRIMARY KEY,
    name  VARCHAR(100)
);
```

이제 부서명을 변경할 때 `departments.name` 한 곳만 수정하면 된다. 3NF까지 정규화하면 대부분의 이상 현상이 해소된다.

---

## BCNF: 보이스-코드 정규형

**3NF보다 엄격한 형태.** 테이블에서 모든 결정자(Determinant)가 후보키(Candidate Key)이어야 한다.

```
수강 테이블: (학생, 과목, 교수)
후보키: (학생, 과목) 또는 (학생, 교수)
함수 종속: 교수 → 과목  (교수가 정해지면 과목이 결정)
→ 교수는 결정자이지만 후보키가 아님 → BCNF 위반!
```

```sql
-- BCNF 위반
CREATE TABLE enrollment_bad (
    student   VARCHAR(50),
    subject   VARCHAR(50),
    professor VARCHAR(50),
    PRIMARY KEY (student, subject)
    -- 교수 → 과목 이지만 교수는 후보키 아님
);

-- BCNF 만족: 분리
CREATE TABLE teaching (
    professor VARCHAR(50) PRIMARY KEY,
    subject   VARCHAR(50)  -- 교수 → 과목
);

CREATE TABLE enrollment (
    student   VARCHAR(50),
    professor VARCHAR(50) REFERENCES teaching(professor),
    PRIMARY KEY (student, professor)
);
```

BCNF 분해는 항상 **무손실(Lossless)**이어야 하며, 때로는 함수 종속 보존(Dependency Preservation)을 포기해야 할 수 있다.

---

## 실무 고려사항

정규화를 무조건 높이는 것이 답이 아니다. 성능과 일관성의 트레이드오프를 고려해야 한다.

| 정규화 수준 | 장점 | 단점 |
|-----------|------|------|
| 높음 (3NF+) | 중복 최소화, 갱신 이상 없음 | JOIN 증가, 쿼리 복잡도 상승 |
| 낮음 (비정규화) | 읽기 성능 향상 | 갱신 이상 위험, 데이터 불일치 |

OLTP(트랜잭션 처리)에서는 3NF를 목표로 하고, OLAP(분석 처리)에서는 성능을 위해 의도적으로 비정규화(Denormalization)하는 스타 스키마를 사용한다.

```sql
-- 비정규화 예: 자주 조회되는 계산값 미리 저장
ALTER TABLE orders ADD COLUMN total_price DECIMAL(10,2);
-- UPDATE 시 트리거 또는 애플리케이션에서 동기화
```

---

**지난 글:** [SAVEPOINT와 부분 롤백](/posts/sql-savepoint/)

<br>
읽어주셔서 감사합니다. 😊
