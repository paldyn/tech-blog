---
title: "IN · BETWEEN · IS NULL"
description: "SQL IN, BETWEEN, IS NULL의 동작 원리, NOT IN에 숨어 있는 NULL 함정, 인덱스 활용 여부, 그리고 각 연산자를 가장 효과적으로 쓰는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["sql", "in", "between", "is-null", "not-in", "null-trap", "where", "필터"]
featured: false
draft: false
---

[지난 글](/posts/sql-like-pattern-matching/)에서 LIKE 패턴 매칭을 살펴봤다. 이번에는 WHERE 절에서 자주 쓰이는 IN, BETWEEN, IS NULL을 다룬다.

---

## IN — 이산 값 목록 필터

`IN`은 여러 OR 조건의 축약형이다.

```sql
-- 아래 두 쿼리는 동일하게 동작
WHERE country IN ('KR', 'US', 'JP')
WHERE country = 'KR' OR country = 'US' OR country = 'JP'
```

목록이 짧으면 가독성 차이가 크지 않지만, 항목이 늘어날수록 IN이 훨씬 읽기 쉽다. 옵티마이저도 IN을 효율적인 인덱스 탐색으로 변환할 수 있다.

### 서브쿼리와 결합

```sql
-- 활성 부서에 속한 직원만 조회
SELECT * FROM employees
WHERE dept_id IN (
    SELECT id FROM departments WHERE active = true
);
```

서브쿼리 결과가 크면 EXISTS나 JOIN으로 변환하는 편이 성능에 유리할 수 있다. 옵티마이저가 자동으로 변환하는 경우도 많다.

![IN · BETWEEN · IS NULL 시각적 정리](/assets/posts/sql-in-between-isnull-overview.svg)

---

## BETWEEN — 범위 조건

`BETWEEN a AND b`는 `a <= 컬럼 AND 컬럼 <= b`와 동일하다. 양쪽 경계가 모두 포함된다.

```sql
-- 숫자 범위
WHERE score BETWEEN 80 AND 100
-- 위와 동일: WHERE score >= 80 AND score <= 100

-- 날짜 범위 (시간까지 있으면 주의)
WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'
-- TIMESTAMP 컬럼이면 '2024-12-31 00:00:00'까지만 포함됨
-- 안전한 대안:
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
```

날짜/시간 컬럼에 BETWEEN을 쓸 때 `'2024-12-31'`은 `'2024-12-31 00:00:00'`으로 해석된다. 하루 전체를 포함하려면 `'2024-12-31 23:59:59'`이나 `< '2025-01-01'` 형태를 써야 한다.

### NOT BETWEEN

```sql
WHERE age NOT BETWEEN 18 AND 65
-- 동일: WHERE age < 18 OR age > 65
```

---

## IS NULL / IS NOT NULL

NULL 여부 확인은 반드시 `IS NULL` 또는 `IS NOT NULL`을 사용한다. 앞선 글에서 설명했듯이 `= NULL`은 UNKNOWN을 반환해 항상 0행이다.

```sql
-- 최상위 관리자(상위 관리자가 없는 직원)
WHERE manager_id IS NULL

-- 소프트 삭제: 삭제되지 않은 행
WHERE deleted_at IS NULL

-- 전화번호가 입력된 고객
WHERE phone IS NOT NULL
```

---

## NOT IN의 NULL 함정

가장 자주 발생하는 버그 중 하나다. **서브쿼리나 목록에 NULL이 하나라도 있으면 NOT IN의 결과 전체가 UNKNOWN이 되어 0행을 반환한다.**

```sql
-- blacklist 테이블에 user_id = NULL 인 행이 있다면
SELECT * FROM orders
WHERE user_id NOT IN (
    SELECT user_id FROM blacklist
);
-- → 0행 반환! (블랙리스트가 없는 것처럼 보임)
```

이유: `1 NOT IN (2, NULL)`은 `1 <> 2 AND 1 <> NULL`로 전개된다. `1 <> NULL`은 UNKNOWN이고, `TRUE AND UNKNOWN = UNKNOWN`이므로 해당 행은 제외된다.

```sql
-- 해결 1: NOT EXISTS 사용 (NULL 안전)
SELECT * FROM orders o
WHERE NOT EXISTS (
    SELECT 1 FROM blacklist b
    WHERE b.user_id = o.user_id
);

-- 해결 2: LEFT JOIN + IS NULL
SELECT o.*
FROM orders o
LEFT JOIN blacklist b ON b.user_id = o.user_id
WHERE b.user_id IS NULL;

-- 해결 3: 서브쿼리에 IS NOT NULL 추가
SELECT * FROM orders
WHERE user_id NOT IN (
    SELECT user_id FROM blacklist WHERE user_id IS NOT NULL
);
```

![NOT IN NULL 함정과 해결책](/assets/posts/sql-in-between-isnull-notin-trap.svg)

---

## 인덱스 활용 여부

| 연산자 | 인덱스 활용 |
|---|---|
| `IN (v1, v2, ...)` | 값 목록이 짧으면 Index Range Scan |
| `NOT IN (v1, v2, ...)` | 대부분 풀 스캔 |
| `BETWEEN a AND b` | Index Range Scan |
| `IS NULL` | 인덱스가 NULL을 저장하면 활용 가능 |
| `IS NOT NULL` | 대부분 활용 가능 |

`IN` 목록이 수백 개 이상이면 임시 테이블이나 JOIN으로 대체하는 것이 낫다.

---

## 핵심 정리

1. `IN`은 OR 목록의 가독성 좋은 대안이며, 서브쿼리와 결합할 수 있다.
2. `BETWEEN`은 양쪽 경계를 포함한다. 날짜 컬럼은 시간 부분에 주의한다.
3. `IS NULL`과 `IS NOT NULL`만 NULL을 안전하게 확인한다.
4. `NOT IN`은 목록/서브쿼리에 NULL이 있으면 0행 — `NOT EXISTS`가 안전하다.

---

**지난 글:** [LIKE 패턴 매칭](/posts/sql-like-pattern-matching/)

**다음 글:** [ORDER BY와 NULL 정렬](/posts/sql-order-by-and-null-sort/)

<br>
읽어주셔서 감사합니다. 😊
