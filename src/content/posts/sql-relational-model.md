---
title: "관계형 모델 이론 — 릴레이션, 튜플, 속성의 수학적 기초"
description: "코드(Codd)의 관계형 모델을 수학 개념으로 이해합니다. 릴레이션, 튜플, 도메인, 관계 대수(σ π ⋈) 와 SQL 문법의 대응 관계를 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["관계형모델", "릴레이션", "관계대수", "코드", "SQL이론", "튜플", "도메인"]
featured: false
draft: false
---

[지난 글](/posts/sql-what-is-rdb/)에서 RDB의 전반적인 개념과 테이블·기본 키·외래 키를 살펴봤다. 이번 글에서는 그 배경이 된 수학적 토대, 즉 에드거 코드가 1970년 논문에서 제시한 **관계형 모델(Relational Model)**을 정확히 이해한다.

## 릴레이션의 수학적 정의

코드는 데이터를 **릴레이션(Relation)**이라는 수학 개념으로 모델링했다. 릴레이션은 단순히 테이블이 아니라 **도메인들의 카테시안 곱(Cartesian Product)에서 나온 부분 집합**이다.

각 속성(Attribute)은 **도메인(Domain)**이라 불리는 허용 값의 집합에서 값을 가져온다.

```text
도메인 예시:
  D₁ (student_id) = { 양의 정수 }
  D₂ (name)       = { 모든 문자열 }
  D₃ (dept)       = { '컴퓨터공학', '수학', '물리학', ... }
  D₄ (grade)      = { 1, 2, 3, 4 }

릴레이션 R ⊆ D₁ × D₂ × D₃ × D₄
```

![관계형 모델의 수학적 구조](/assets/posts/sql-relational-model-structure.svg)

이 수학적 정의에서 세 가지 중요한 특성이 도출된다.

### 릴레이션의 세 가지 핵심 특성

**1. 중복 행 없음** — 릴레이션은 수학적 집합이므로 동일한 튜플이 두 번 나올 수 없다. SQL에서 `DISTINCT`가 필요한 이유, 그리고 기본 키가 존재해야 하는 이유가 이 특성에서 비롯된다.

**2. 순서 무의미** — 집합에는 원소 순서가 없으므로, 행 순서와 열 순서는 이론상 의미가 없다. `ORDER BY` 없이 SELECT를 날렸을 때 결과 순서를 보장할 수 없는 것이 이 원칙 때문이다.

**3. 원자 값(Atomic Value)** — 각 셀은 분해 불가능한 단일 값이어야 한다. 이를 **제1정규형(1NF)** 조건이라 한다.

```sql
-- 1NF 위반 예시 (배열 값) — 피해야 할 설계
-- phones 컬럼에 '010-1111,010-2222' 저장 X

-- 올바른 설계: 별도 테이블로 분리
CREATE TABLE user_phones (
    user_id  INT NOT NULL,
    phone    VARCHAR(20) NOT NULL,
    PRIMARY KEY (user_id, phone)
);
```

## 튜플과 속성

- **튜플(Tuple)** = 릴레이션의 한 행(Row). `(1001, '김철수', '컴퓨터공학', 3)` 처럼 각 도메인에서 하나씩 값을 선택해 만든 순서 쌍
- **속성(Attribute)** = 열(Column). 이름과 도메인으로 정의됨
- **차수(Degree)** = 속성의 수 (열 개수)
- **카디널리티(Cardinality)** = 튜플의 수 (행 개수)

```sql
-- 차수(Degree) 확인: information_schema 활용
SELECT COUNT(*) AS degree
FROM   information_schema.columns
WHERE  table_name = 'students';

-- 카디널리티(Cardinality) 확인
SELECT COUNT(*) AS cardinality FROM students;
```

## 관계 대수 — SQL의 수학적 뿌리

코드는 릴레이션을 조작하는 연산 집합인 **관계 대수(Relational Algebra)**도 함께 정의했다. SQL은 이 관계 대수를 선언형 문법으로 표현한 언어다.

![관계 대수 핵심 연산](/assets/posts/sql-relational-model-algebra.svg)

| 기호 | 이름 | SQL 대응 |
|------|------|---------|
| σ | 선택(Selection) | `WHERE` 절 |
| π | 투영(Projection) | `SELECT` 컬럼 목록 |
| ⋈ | 조인(Join) | `JOIN` |
| ∪ | 합집합 | `UNION` |
| ∩ | 교집합 | `INTERSECT` |
| − | 차집합 | `EXCEPT` / `MINUS` |
| ρ | 이름 변경 | `AS` (별칭) |

### 관계 대수 표현을 SQL로 변환하는 연습

```sql
-- σ grade=3 (π name,dept (students))
-- "3학년 학생의 이름과 학과만"
SELECT name, dept
FROM   students
WHERE  grade = 3;

-- π name (students ⋈dept_id departments)
-- "학생과 학과 정보를 조인 후 이름만 추출"
SELECT s.name
FROM   students s
JOIN   departments d ON s.dept_id = d.dept_id;
```

## 관계형 모델이 중요한 이유

관계형 모델의 가장 큰 혁신은 **데이터 독립성(Data Independence)**이다. 물리적 저장 방법이 바뀌어도 논리적 질의 방법이 바뀌지 않는다. 1970년대 이전 데이터베이스는 데이터에 접근하려면 파일의 물리적 경로를 알아야 했다. 코드의 관계형 모델은 이 물리 레이어를 논리 레이어로부터 분리시켰고, 그것이 현대 SQL이 "어떻게"가 아닌 "무엇을"만 기술하는 선언형 언어로 탄생할 수 있었던 근거다.

## 정리

- 릴레이션은 도메인들의 카테시안 곱의 **부분 집합** — 수학적 집합
- **중복 없음, 순서 없음, 원자 값** — 릴레이션의 세 핵심 특성
- **관계 대수(σ π ⋈ ∪ ∩ −)** 가 SQL 문법의 수학적 기반
- 관계형 모델의 핵심 가치는 **논리-물리 데이터 독립성**

---

**지난 글:** [관계형 데이터베이스(RDB)란 무엇인가](/posts/sql-what-is-rdb/)

**다음 글:** [SQL의 역사와 표준 — SQL-86부터 SQL:2023까지](/posts/sql-history-and-standard/)

<br>
읽어주셔서 감사합니다. 😊
