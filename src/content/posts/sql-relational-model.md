---
title: "관계형 모델의 수학적 기초 — 릴레이션과 집합 이론"
description: "에드거 코드의 관계형 모델이 집합 이론과 어떻게 연결되는지, 도메인·릴레이션·관계 대수의 개념을 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["SQL", "RDB", "관계형모델", "관계대수", "집합이론"]
featured: false
draft: false
---

[지난 글](/posts/sql-what-is-rdb/)에서 RDB가 파일 시스템의 문제를 어떻게 해결하는지 살펴봤다. 이번에는 한 단계 더 들어가서 관계형 모델의 수학적 토대를 살펴본다. "SQL은 그냥 테이블 조회 언어 아닌가?"라는 생각을 넘어서면 SQL이 왜 이렇게 설계되었는지, 쿼리 최적화가 왜 가능한지가 보인다.

## 도메인(Domain)

관계형 모델에서 **도메인**은 특정 속성이 취할 수 있는 값의 집합이다. 수학의 정의역(domain)과 같은 개념이다.

- `나이` 속성의 도메인: 0 이상 150 이하의 정수
- `이메일` 속성의 도메인: RFC 5321을 따르는 유효한 이메일 문자열
- `성별` 속성의 도메인: `{ 'M', 'F', 'X' }`

SQL에서 도메인은 **데이터 타입 + 제약 조건**으로 표현된다. `INTEGER CHECK (나이 BETWEEN 0 AND 150)` 이 코드가 바로 도메인을 선언하는 것이다.

![관계형 모델 — 도메인과 릴레이션](/assets/posts/sql-relational-model-sets.svg)

## 릴레이션(Relation)

n개의 도메인 D1, D2, ..., Dn이 있을 때, 그들의 **카르테시안 곱(Cartesian Product) D1 × D2 × ... × Dn의 부분집합**이 릴레이션이다. SQL의 테이블이 바로 릴레이션이다.

릴레이션은 네 가지 성질을 갖는다.

1. **행 순서 없음**: 튜플(행)은 집합의 원소이므로 순서가 없다. `ORDER BY` 없이 가져온 행 순서는 보장되지 않는다.
2. **중복 튜플 없음**: 같은 행이 두 번 존재할 수 없다. 기본 키가 이를 보장한다.
3. **원자 값(1NF)**: 각 셀은 분해할 수 없는 단일 값이어야 한다. 배열을 한 셀에 넣는 것은 원칙적으로 1NF 위반이다.
4. **열 순서 없음**: 속성도 집합이므로 이론상 순서가 없다. `SELECT *`보다 열 이름을 명시하는 것이 좋은 이유다.

## 관계 대수(Relational Algebra)

코드는 릴레이션을 입력받아 릴레이션을 출력하는 **관계 대수 연산**을 정의했다. SQL은 이 연산의 선언형 인터페이스다.

```sql
-- σ Selection → WHERE
SELECT * FROM 고객 WHERE 나이 > 28;

-- π Projection → SELECT 열 목록
SELECT 이름, 도시 FROM 고객;

-- ⋈ Join → JOIN
SELECT c.이름, o.제품명
FROM 고객 c JOIN 주문 o ON c.고객ID = o.고객ID;

-- ∪ Union → UNION
SELECT 고객ID FROM 우수고객
UNION
SELECT 고객ID FROM 신규고객;
```

![관계 대수 핵심 연산](/assets/posts/sql-relational-model-operations.svg)

## 닫힘 성질(Closure Property)

관계 대수의 핵심은 **닫힘 성질**이다. 모든 연산의 결과가 다시 릴레이션이다. 이 덕분에 연산을 중첩할 수 있다.

```sql
-- Selection 후 Projection — 연산 합성 가능
SELECT 이름
FROM   고객
WHERE  나이 > 28;
```

이 쿼리는 σ(고객, 나이>28) 결과에 π(이름)을 적용한 것이다. 결과가 항상 릴레이션이기 때문에 서브쿼리, CTE, 파생 테이블 등 SQL의 조합 능력이 가능해진다.

## NULL과 3치 논리

순수 수학적 관계형 모델은 NULL을 정의하지 않는다. 코드 자신도 NULL을 두 개(미지(Unknown) vs 해당없음(Not Applicable))로 구분하자고 했지만, 실제 SQL은 단일 NULL을 사용해 3치 논리(TRUE / FALSE / UNKNOWN)를 만들었다.

```sql
-- UNKNOWN 논리의 함정
SELECT * FROM 고객 WHERE 나이 <> 30;
-- 나이가 NULL인 행은 결과에 포함되지 않는다!
-- <> 30은 NULL에 대해 UNKNOWN을 반환하기 때문
```

`WHERE` 절은 UNKNOWN을 FALSE로 처리한다. NULL을 다룰 때 `IS NULL`, `IS NOT NULL`, `COALESCE`를 쓰는 이유가 여기에 있다.

## 왜 이 이론이 중요한가

관계형 모델을 이해하면 SQL을 더 정확하게 다룰 수 있다.

- **행 순서는 보장되지 않는다** → 정렬이 필요하면 반드시 `ORDER BY`를 쓴다
- **집합 연산은 중복을 제거한다** → `UNION ALL`과 `UNION`의 차이가 이해된다
- **NULL은 값이 아니다** → `= NULL`이 아니라 `IS NULL`을 써야 하는 이유가 자명해진다
- **쿼리 최적화가 가능하다** → 대수 등가 변환으로 실행 계획을 바꿔도 결과가 같다

---

**지난 글:** [RDB란 무엇인가 — 관계형 데이터베이스의 핵심 개념](/posts/sql-what-is-rdb/)

**다음 글:** [SQL의 역사와 표준 — ISO SQL이 중요한 이유](/posts/sql-history-and-standard/)

<br>
읽어주셔서 감사합니다. 😊
