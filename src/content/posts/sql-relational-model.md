---
title: "관계형 모델 이론 — 릴레이션, 튜플, 관계 대수"
description: "에드거 코드가 제안한 관계형 모델의 수학적 기반인 릴레이션·튜플·속성·관계 대수를 SQL과 연결해 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["SQL", "관계형 모델", "릴레이션", "관계 대수"]
featured: false
draft: false
---

[지난 글](/posts/sql-what-is-rdb/)에서 RDB가 파일 시스템에 비해 왜 강력한지 살펴봤습니다. 이번에는 한 발 더 들어가, RDB의 이론적 토대인 **관계형 모델(Relational Model)** 을 짚겠습니다. 이론처럼 보이지만, 실제 SQL을 작성할 때 "왜 이렇게 동작하지?"라는 물음에 대한 답이 여기 있습니다.

## 릴레이션이란

수학에서 릴레이션은 **집합들의 카테시안 곱 위에 정의된 부분집합**입니다. 이를 테이블로 표현하면 다음이 됩니다.

- **속성(Attribute)**: 열(Column). 각 속성에는 허용 값의 범위인 **도메인**이 있습니다.
- **튜플(Tuple)**: 행(Row). 각 속성에 해당하는 값 하나씩의 모음입니다.
- **릴레이션**: 튜플들의 집합 — 즉 순서 없는 집합이므로 "3번째 행"이라는 개념은 이론적으로 존재하지 않습니다.

```sql
-- 릴레이션(테이블)의 구성 요소 확인
SELECT column_name, data_type   -- 속성(Attribute)
FROM   information_schema.columns
WHERE  table_name = 'students';
```

![관계형 모델 핵심 용어](/assets/posts/sql-relational-model-theory.svg)

## 차수와 기수

| 용어 | 의미 | SQL 대응 |
|------|------|----------|
| **차수(Degree)** | 속성(열)의 수 | `SELECT COUNT(*) FROM information_schema.columns` |
| **기수(Cardinality)** | 튜플(행)의 수 | `SELECT COUNT(*) FROM 테이블명` |

```sql
-- 테이블의 기수(행 수) 확인
SELECT COUNT(*) AS cardinality FROM students;
```

## 관계 대수 — SQL의 수학적 기반

관계 대수(Relational Algebra)는 릴레이션에 적용하는 연산들의 집합입니다. SQL은 이 연산들을 인간이 읽기 쉬운 문법으로 표현한 것입니다.

![관계 대수와 SQL 대응](/assets/posts/sql-relational-model-algebra.svg)

주요 연산:

| 기호 | 이름 | SQL 대응 | 설명 |
|------|------|----------|------|
| σ | 선택(Selection) | `WHERE` | 조건을 만족하는 튜플만 추출 |
| π | 투영(Projection) | `SELECT` 열 목록 | 필요한 속성만 추출 |
| ⋈ | 조인(Join) | `JOIN` | 두 릴레이션을 공통 속성으로 결합 |
| ∪ | 합집합(Union) | `UNION` | 두 릴레이션의 합 |
| ∩ | 교집합(Intersection) | `INTERSECT` | 두 릴레이션의 교집합 |
| − | 차집합(Difference) | `EXCEPT` / `MINUS` | 한쪽에만 있는 튜플 |

```sql
-- σ (선택) + π (투영) 조합 예시
SELECT name, major          -- π (투영): 두 속성만
FROM   students             -- 릴레이션
WHERE  gpa > 3.7;           -- σ (선택): 조건
```

## 무결성 제약

관계형 모델은 데이터 정확성을 위한 세 가지 무결성 규칙을 정의합니다.

**개체 무결성(Entity Integrity)**: 기본 키(PK) 값은 NULL이 될 수 없습니다. 기본 키의 역할은 튜플을 유일하게 식별하는 것인데, NULL은 "알 수 없음"이므로 식별자로 사용할 수 없습니다.

**참조 무결성(Referential Integrity)**: 외래 키(FK) 값이 NULL이 아니라면, 반드시 참조하는 테이블의 기본 키에 해당 값이 존재해야 합니다.

**도메인 무결성(Domain Integrity)**: 각 속성의 값은 정의된 도메인(타입, 범위) 내에 있어야 합니다.

```sql
-- 개체·참조·도메인 무결성을 모두 포함한 테이블 정의
CREATE TABLE students (
    student_id  INT          PRIMARY KEY,         -- 개체 무결성
    name        VARCHAR(50)  NOT NULL,
    gpa         NUMERIC(3,1) CHECK (gpa BETWEEN 0.0 AND 4.5), -- 도메인 무결성
    dept_id     INT          REFERENCES departments(dept_id)   -- 참조 무결성
);
```

## 코드의 12가지 규칙

코드는 1985년 논문에서 "완전한 관계형 DBMS"가 만족해야 할 12가지 규칙을 제시했습니다. 모든 규칙을 다 외울 필요는 없지만, 규칙 1이 핵심입니다: **"모든 데이터는 릴레이션의 셀 값으로만 표현되어야 한다."** 이 원칙이 RDB의 예측 가능성과 일관성을 만들어냅니다.

## 정리

- 릴레이션 = 튜플의 집합 = 테이블. 행의 순서는 이론적으로 없습니다.
- 관계 대수(σ, π, ⋈ 등)는 SQL의 수학적 기반입니다.
- 세 가지 무결성(개체·참조·도메인)이 데이터 정확성을 보장합니다.

다음 글에서는 SQL의 역사와 ISO 표준이 어떻게 발전해 왔는지 살펴봅니다.

---

**지난 글:** [RDB란 무엇인가 — 관계형 데이터베이스의 세계로](/posts/sql-what-is-rdb/)

**다음 글:** [SQL 역사와 표준 — SQL-86부터 SQL:2023까지](/posts/sql-history-and-standard/)

<br>
읽어주셔서 감사합니다. 😊
