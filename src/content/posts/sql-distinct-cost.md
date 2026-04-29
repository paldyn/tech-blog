---
title: "DISTINCT의 비용과 대안"
description: "SQL SELECT DISTINCT의 내부 동작(정렬/해시), 발생하는 성능 비용, JOIN 이후 DISTINCT 남용 문제, 그리고 EXISTS와 GROUP BY로 대체하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["sql", "distinct", "performance", "exists", "group-by", "중복제거", "쿼리최적화"]
featured: false
draft: false
---

[지난 글](/posts/sql-limit-offset-fetch/)에서 페이지 처리를 살펴봤다. 이번에는 결과에서 중복 행을 제거하는 DISTINCT의 비용과 대안을 다룬다.

---

## DISTINCT 기본

```sql
-- 컬럼 값 기준 중복 제거
SELECT DISTINCT dept FROM employees;

-- 다중 컬럼: 두 컬럼 조합이 같은 행만 중복으로 처리
SELECT DISTINCT dept, job_title FROM employees;

-- * 와 사용: 모든 컬럼이 같은 행 제거
SELECT DISTINCT * FROM temp_data;
```

DISTINCT는 SELECT 목록 전체에 적용된다. 컬럼 하나에만 적용하는 문법(`SELECT DISTINCT(dept), name`)은 `DISTINCT(dept)`를 괄호 없는 것과 동일하게 처리하므로, 전체 행에 DISTINCT가 적용된다.

---

## 내부 동작과 비용

DISTINCT는 전체 결과를 정렬하거나 해시 테이블을 만들어 중복을 탐지한다.

![DISTINCT 동작 원리와 비용](/assets/posts/sql-distinct-cost-how.svg)

```sql
-- EXPLAIN으로 확인 (PostgreSQL)
EXPLAIN SELECT DISTINCT dept FROM employees;
-- HashAggregate 또는 Sort + Unique 노드가 나타남
```

비용의 핵심:
1. **전체 결과 집합을 메모리에 올리거나 임시 파일로 처리**해야 한다.
2. `LIMIT 10`과 함께 사용해도 DISTINCT 처리를 먼저 완료해야 10개를 선택할 수 있다.
3. 카디널리티(유니크 값의 수)가 높을수록 해시 테이블이 커진다.

---

## DISTINCT 남용 — JOIN 중복 문제

가장 자주 보이는 DISTINCT 남용 패턴은 JOIN 후 중복이 생겨 DISTINCT로 제거하는 것이다.

```sql
-- ✗ users에 여러 orders가 있으면 user 행이 중복됨
SELECT DISTINCT u.id, u.name
FROM users u
JOIN orders o ON o.user_id = u.id;
```

이 쿼리에서 DISTINCT는 근본 원인을 숨길 뿐이다. "주문이 있는 사용자 목록"이 의도라면 EXISTS가 정확하다.

```sql
-- ✓ EXISTS: 첫 번째 매칭 행 발견 즉시 멈춤 (Short-circuit)
SELECT u.id, u.name
FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);
```

EXISTS는 서브쿼리에서 첫 번째 매칭을 찾으면 즉시 멈추므로, 사용자당 주문이 많을수록 DISTINCT보다 훨씬 빠르다.

---

## 올바른 DISTINCT 사용

DISTINCT가 실제로 필요한 경우는 다음과 같다.

```sql
-- 유니크 값 목록이 필요할 때 (작은 결과)
SELECT DISTINCT country FROM customers;

-- 태그 목록 중복 제거
SELECT DISTINCT tag_name FROM product_tags ORDER BY tag_name;

-- COUNT DISTINCT: 그룹 내 유니크 값 수
SELECT dept, COUNT(DISTINCT job_title) AS unique_jobs
FROM employees
GROUP BY dept;
```

---

## GROUP BY와의 관계

단순 중복 제거에서 GROUP BY는 DISTINCT와 동일한 결과를 낸다. 내부적으로 같은 알고리즘(정렬 또는 해시)을 사용한다.

```sql
-- 아래 두 쿼리는 동일한 결과 + 유사한 성능
SELECT DISTINCT dept FROM employees ORDER BY dept;
SELECT dept FROM employees GROUP BY dept ORDER BY dept;
```

GROUP BY는 집계 함수와 결합할 수 있다는 점에서 더 유연하다.

---

## 대안 선택 기준

![DISTINCT 대안 패턴](/assets/posts/sql-distinct-cost-alternatives.svg)

| 상황 | 권장 방법 |
|---|---|
| JOIN 후 중복 제거 | `EXISTS` 또는 쿼리 재설계 |
| 단순 유니크 목록 | DISTINCT (결과 작을 때) |
| 그룹별 집계 | `GROUP BY` |
| 집계 내 유니크 수 | `COUNT(DISTINCT 컬럼)` |

---

**지난 글:** [LIMIT / OFFSET / FETCH FIRST — 페이지 처리](/posts/sql-limit-offset-fetch/)

**다음 글:** [별칭(Alias)과 쿼리 가독성](/posts/sql-aliases-readability/)

<br>
읽어주셔서 감사합니다. 😊
