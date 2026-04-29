---
title: "WHERE 절과 비교 연산자"
description: "SQL WHERE 절에서 사용하는 비교·논리 연산자의 종류, NULL 비교의 3값 논리(Three-Valued Logic), AND/OR 우선순위 함정, 그리고 인덱스 활용을 방해하는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "where", "comparison", "null", "three-valued-logic", "and", "or", "인덱스", "필터"]
featured: false
draft: false
---

[지난 글](/posts/sql-select-logical-order/)에서 SELECT의 논리적 실행 순서를 살펴봤다. 이번에는 그 순서에서 두 번째로 실행되는 WHERE 절과 비교 연산자를 상세히 다룬다.

---

## 비교 연산자

WHERE 절에서 사용할 수 있는 기본 비교 연산자다.

```sql
-- 동등 비교
WHERE status = 'active'         -- 같음
WHERE status <> 'deleted'       -- 다름 (표준)
WHERE status != 'deleted'       -- 다름 (비표준, 대부분 지원)

-- 크기 비교
WHERE age >= 18
WHERE price < 10000
WHERE created_at > '2024-01-01'

-- 복합 조건
WHERE price >= 5000 AND price < 20000
WHERE country = 'KR' OR country = 'JP'
WHERE NOT active
```

![WHERE 절 비교 연산자 목록](/assets/posts/sql-where-comparison-operators.svg)

---

## 3값 논리와 NULL 함정

SQL에는 TRUE와 FALSE 외에 세 번째 값인 **UNKNOWN**이 있다. NULL이 포함된 비교 연산의 결과는 UNKNOWN이다. WHERE는 TRUE인 행만 통과시키므로, UNKNOWN은 사실상 FALSE와 같은 동작을 한다.

```sql
-- NULL과의 모든 비교는 UNKNOWN → 행이 반환되지 않음
WHERE deleted_at = NULL      -- ✗ 항상 0행
WHERE deleted_at != NULL     -- ✗ 항상 0행
WHERE NULL = NULL            -- ✗ UNKNOWN
```

이 규칙은 처음 접하면 직관과 다르게 느껴진다. NULL은 "알 수 없는 값"이므로 "알 수 없음 = 알 수 없음"의 결과도 "알 수 없음"이다.

```sql
-- ✓ NULL 확인은 반드시 IS NULL / IS NOT NULL
WHERE deleted_at IS NULL      -- 삭제되지 않은 행
WHERE deleted_at IS NOT NULL  -- 삭제된 행
```

![NULL 비교 함정과 3값 논리](/assets/posts/sql-where-comparison-null.svg)

---

## AND / OR / NOT 우선순위

논리 연산자의 우선순위: **NOT > AND > OR**

AND가 OR보다 먼저 묶이므로 의도와 다른 결과가 나올 수 있다.

```sql
-- 의도: (KR 또는 US 사용자) AND active
-- 실제: KR 사용자 ALL OR (US 사용자 중 active인 경우)
WHERE country = 'KR' OR country = 'US' AND active = true;

-- 의도대로 괄호 명시
WHERE (country = 'KR' OR country = 'US') AND active = true;
```

복잡한 조건에서는 괄호로 묶는 것이 가독성과 정확성 모두에 좋다.

---

## 인덱스를 방해하는 패턴

WHERE 조건이 인덱스를 활용하지 못하면 풀 스캔이 발생한다. 자주 보이는 패턴들이다.

```sql
-- ✗ 컬럼을 함수로 감싸면 인덱스 사용 불가
WHERE UPPER(name) = 'KIM'
WHERE YEAR(created_at) = 2024

-- ✓ 함수 없이 범위 조건으로
WHERE name = 'kim'            -- 혹은 함수 기반 인덱스(FBI) 활용
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
```

```sql
-- ✗ 타입 불일치 → 암묵적 변환 → 인덱스 미사용
WHERE user_id = '42'          -- user_id가 INT일 때 문자열로 비교

-- ✓ 타입 일치
WHERE user_id = 42
```

```sql
-- ✗ LIKE 앞부분 와일드카드 → 풀 스캔
WHERE name LIKE '%Kim'

-- ✓ 접두사 매칭은 인덱스 활용 가능
WHERE name LIKE 'Kim%'
```

---

## SARG 가능 조건

옵티마이저가 인덱스를 사용할 수 있도록 작성된 조건을 **SARGable(Search ARGument able)** 하다고 한다. 기준은 단순하다. 컬럼이 왼쪽에 단독으로 있고, 오른쪽에 상수나 파라미터가 오는 형태다.

```sql
-- SARGable: 인덱스 사용 가능
WHERE created_at >= '2024-01-01'
WHERE amount BETWEEN 1000 AND 9999
WHERE name = 'Kim'

-- Non-SARGable: 인덱스 사용 불가
WHERE created_at + INTERVAL 1 DAY > NOW()
WHERE amount / 100 > 10
WHERE COALESCE(name, '') = 'Kim'
```

Non-SARGable 조건은 컬럼 값을 변환해서 비교하기 때문에 인덱스 탐색이 불가능하다. 컬럼을 변환하지 말고 반대편 값을 변환하는 방향으로 쿼리를 재작성한다.

---

## 실전 WHERE 작성 원칙

1. **NULL 비교는 IS NULL / IS NOT NULL**만 사용한다.
2. **괄호로 AND/OR 의도를 명확히** 한다.
3. **컬럼에 함수나 연산 금지** — SARGable하게 작성한다.
4. **타입을 일치**시킨다 — 암묵적 변환은 인덱스를 죽인다.
5. **선택도(Selectivity)가 높은 조건을 먼저** — 인덱스의 효과가 커진다.

---

**지난 글:** [SELECT의 논리적 실행 순서](/posts/sql-select-logical-order/)

**다음 글:** [LIKE 패턴 매칭](/posts/sql-like-pattern-matching/)

<br>
읽어주셔서 감사합니다. 😊
