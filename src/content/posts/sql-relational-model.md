---
title: "관계 모델: 집합론 위에 세운 데이터 구조"
description: "Edgar Codd가 1970년에 제안한 관계 모델의 수학적 토대를 탐구합니다. 릴레이션·도메인·키·관계 대수를 SQL과 연결해 명확히 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["관계모델", "RelationalModel", "Codd", "집합론", "관계대수", "SQL이론"]
featured: false
draft: false
---

[지난 글](/posts/sql-what-is-rdb/)에서 RDB의 기본 구조를 살펴봤다. 그런데 왜 하필 테이블 형태인가, 행과 열은 수학적으로 무엇인가 — 이 질문에 답하려면 1970년 IBM 연구원 에드거 코드(Edgar F. Codd)가 발표한 **관계 모델(Relational Model)**로 돌아가야 한다. SQL의 모든 동작은 이 이론 위에 세워져 있다.

## 관계 모델의 탄생

1970년 이전 데이터베이스는 계층형(hierarchical)이나 네트워크형(network)이었다. 데이터를 탐색하려면 포인터를 따라가는 순서가 정해져 있었고, 접근 경로가 바뀌면 프로그램 전체를 수정해야 했다.

코드는 집합론(set theory)과 일차 술어 논리(first-order predicate logic)를 기반으로 **물리적 저장 방식과 논리적 데이터 구조를 분리**하는 관계 모델을 제안했다. 사용자는 데이터가 어떻게 저장되었는지 알 필요 없이 **"무엇을 원하는지"**만 선언하면 된다.

## 핵심 개념

![관계 모델 핵심 개념](/assets/posts/sql-relational-model-concepts.svg)

### 릴레이션(Relation)

수학적 집합의 개념을 데이터에 적용한 것이다. 중요한 성질이 두 가지 있다.

- **튜플의 순서가 없다**: SQL에서 `ORDER BY` 없이 결과 순서를 기대하면 안 되는 이유가 바로 여기 있다.
- **중복 튜플이 없다**: 집합에는 원소가 중복되지 않는다. SQL의 기본 `SELECT`가 중복을 허용하는 것은 성능 때문에 수학적 정의를 느슨하게 한 것이다. 엄밀한 집합 연산이 필요할 때는 `DISTINCT`나 `UNION`(중복 제거)을 쓴다.

### 속성(Attribute)과 도메인(Domain)

속성은 릴레이션의 열이다. 각 속성에는 **도메인**이 있다 — 해당 속성이 취할 수 있는 원자적(atomic) 값들의 집합. `INTEGER`나 `VARCHAR(50)` 같은 데이터 타입이 도메인의 SQL 구현이다.

코드의 1NF(제1 정규형)는 "모든 속성값은 원자적이어야 한다"는 원칙인데, 이는 도메인 값이 더 이상 분해될 수 없어야 한다는 뜻이다.

### 키(Key)의 계층 구조

```
슈퍼 키(Super Key)
  └─ 후보 키(Candidate Key)  ← 최소성 만족
       ├─ 기본 키(Primary Key)   ← 한 개 선택
       └─ 대체 키(Alternate Key) ← 나머지 후보
```

- **슈퍼 키**: 튜플을 유일하게 식별하는 속성(들)의 집합 (여분이 있어도 됨)
- **후보 키**: 슈퍼 키 중 **최소성**을 만족하는 것 — 어떤 속성도 제거하면 유일성이 깨짐
- **기본 키(PK)**: 후보 키 중 설계자가 선택한 하나
- **대체 키**: 선택받지 못한 나머지 후보 키 (SQL의 `UNIQUE`로 강제)

### 외래 키(Foreign Key)와 참조 무결성

외래 키는 한 릴레이션의 속성이 다른 릴레이션의 기본 키를 참조하는 장치다. **참조 무결성(Referential Integrity)**은 외래 키 값이 반드시 참조 대상에 존재해야 한다는 규칙이다.

```sql
CREATE TABLE departments (
    id   INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE employees (
    id      INTEGER PRIMARY KEY,
    name    VARCHAR(50),
    dept_id INTEGER REFERENCES departments(id)  -- 외래 키
);
```

`dept_id`에 `departments.id`에 없는 값을 넣으면 RDBMS가 거부한다.

## 관계 대수(Relational Algebra)

![관계 대수 연산](/assets/posts/sql-relational-model-operations.svg)

관계 대수는 릴레이션에 적용 가능한 연산들의 집합이다. SQL은 관계 대수의 선언적 표현이다.

| 연산 | 기호 | SQL 대응 |
|------|------|---------|
| 선택(Selection) | σ | `WHERE` |
| 투영(Projection) | π | `SELECT` (열 지정) |
| 조인(Join) | ⋈ | `JOIN` |
| 합집합(Union) | ∪ | `UNION` |
| 차집합(Difference) | − | `EXCEPT` |
| 교집합(Intersection) | ∩ | `INTERSECT` |
| 카티션 곱(Cartesian Product) | × | `CROSS JOIN` |

중요한 점은 관계 대수의 **폐쇄성(closure)**이다 — 모든 연산의 결과도 릴레이션이다. SQL 서브쿼리가 테이블처럼 다루어지는 것이 이 원리 덕분이다.

## Codd의 12 규칙

코드는 RDBMS가 관계 모델을 제대로 구현했는지 검증하기 위한 **12개 규칙**을 1985년에 발표했다. 전부 만족하는 RDBMS는 사실상 없지만, 이 규칙들은 관계 모델의 이상적 목표를 명확히 보여준다.

주요 규칙:
1. **정보 규칙**: 모든 정보는 테이블의 값으로만 표현된다
2. **보장된 접근 규칙**: 테이블명 + 기본 키 + 열명으로 모든 데이터에 접근 가능하다
3. **NULL 처리 규칙**: NULL은 미지 정보를 나타내는 단일 방식으로 지원된다
4. **데이터 독립성**: 물리적 저장 방식이 바뀌어도 애플리케이션이 영향받지 않는다

## 관계 모델과 실제 SQL의 차이

순수한 관계 모델과 SQL에는 차이가 있다.

| 관계 모델 이론 | SQL 현실 |
|-------------|--------|
| 중복 튜플 없음 | 기본적으로 중복 허용 (`MULTISET`) |
| 행 순서 없음 | `ORDER BY` 없으면 순서 보장 안 됨 |
| NULL 없음 | NULL 값 허용 |
| 속성명은 집합 | 열 순서(ordinal position)가 존재함 |

이 차이를 이해하면 "왜 `SELECT *`의 컬럼 순서에 의존하면 안 되는가", "왜 `NULL = NULL`이 `TRUE`가 아닌가" 같은 SQL의 이상한 동작을 자연스럽게 납득할 수 있다.

---

**지난 글:** [RDB란 무엇인가: 관계형 데이터베이스의 본질](/posts/sql-what-is-rdb/)

**다음 글:** [SQL의 역사와 표준: ANSI SQL에서 SQL:2023까지](/posts/sql-history-and-standard/)

<br>
읽어주셔서 감사합니다. 😊
