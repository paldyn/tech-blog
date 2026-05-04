---
title: "UNION · INTERSECT · EXCEPT 집합 연산"
description: "UNION ALL vs UNION 성능 차이, INTERSECT 교집합, EXCEPT/MINUS 차집합, 컬럼 수·타입 규칙, ORDER BY 위치, 실무 대체 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "union", "intersect", "except", "minus", "set-operations", "union-all"]
featured: false
draft: false
---

[지난 글](/posts/sql-timezone-handling/)에서 타임존 처리와 `AT TIME ZONE` 변환 패턴을 살펴봤다. 이번에는 두 개 이상의 `SELECT` 결과를 수직으로 합치거나 교차·차분하는 집합 연산—`UNION`, `INTERSECT`, `EXCEPT`—을 정리한다.

---

## 집합 연산이란

JOIN이 행을 수평으로(컬럼 추가) 결합한다면, 집합 연산은 **수직으로(행 추가·제거)** 결합한다. 두 쿼리의 결과 집합을 다음과 같이 처리한다.

| 연산자 | 의미 | Oracle 방언 |
|--------|------|------------|
| `UNION` | 합집합 (중복 제거) | `UNION` |
| `UNION ALL` | 합집합 (중복 유지) | `UNION ALL` |
| `INTERSECT` | 교집합 | `INTERSECT` |
| `EXCEPT` | 차집합 (A − B) | `MINUS` |

![집합 연산 벤 다이어그램](/assets/posts/sql-union-intersect-except-venn.svg)

---

## 필수 규칙

1. **컬럼 수 동일**: 양쪽 `SELECT`의 컬럼 수가 반드시 같아야 한다.
2. **데이터 타입 호환**: 위치별 컬럼 타입이 암묵 변환 가능해야 한다.
3. **컬럼명**: 최종 결과의 컬럼명은 **첫 번째 쿼리**의 컬럼명(또는 별칭)을 따른다.
4. **`ORDER BY` 위치**: 전체 집합 연산의 **마지막**에 한 번만 사용 가능하다.

---

## UNION vs UNION ALL

```sql
-- UNION: 중복 제거 (내부적으로 SORT 또는 HASH 연산 수행)
SELECT employee_id FROM employees_kr
UNION
SELECT employee_id FROM employees_us;

-- UNION ALL: 중복 유지 (정렬·해시 없음 → 훨씬 빠름)
SELECT employee_id FROM employees_kr
UNION ALL
SELECT employee_id FROM employees_us;
```

두 집합 사이에 중복이 없음을 **알고 있다면** 반드시 `UNION ALL`을 사용하라. `UNION`은 내부적으로 중복 제거를 위해 전체 결과를 정렬하거나 해시 테이블에 올리므로 오버헤드가 크다.

---

## INTERSECT: 교집합

```sql
-- 2025년과 2026년 모두 구매한 고객 ID
SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2025
INTERSECT
SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2026;
```

`INTERSECT`는 양쪽에 모두 존재하는 행만 반환한다. 동일 결과를 `INNER JOIN`으로도 표현할 수 있다.

```sql
-- INTERSECT 대안: JOIN 방식 (대용량에서 인덱스 활용 가능)
SELECT DISTINCT a.customer_id
FROM (SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2025) a
JOIN (SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2026) b
  ON a.customer_id = b.customer_id;
```

---

## EXCEPT / MINUS: 차집합

```sql
-- 2025년에 구매했지만 2026년에는 구매하지 않은 고객
SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2025
EXCEPT   -- Oracle은 MINUS
SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2026;
```

`EXCEPT`는 A 집합에만 있고 B 집합에 없는 행을 반환한다. `NOT EXISTS` 또는 `NOT IN`으로 대체 가능하다.

```sql
-- EXCEPT 대안: NOT EXISTS (대용량 인덱스 활용)
SELECT DISTINCT a.customer_id
FROM orders a
WHERE EXTRACT(YEAR FROM a.created_at) = 2025
  AND NOT EXISTS (
        SELECT 1 FROM orders b
        WHERE b.customer_id = a.customer_id
          AND EXTRACT(YEAR FROM b.created_at) = 2026
      );
```

![집합 연산 코드 패턴](/assets/posts/sql-union-intersect-except-code.svg)

---

## DB별 지원 현황

| 기능 | PostgreSQL | MySQL | Oracle | SQL Server |
|------|-----------|-------|--------|-----------|
| UNION / UNION ALL | ✓ | ✓ | ✓ | ✓ |
| INTERSECT | ✓ | 8.0.31+ | ✓ | ✓ |
| EXCEPT | ✓ | 8.0.31+ | MINUS | ✓ |
| INTERSECT ALL | ✓ | ✗ | ✗ | ✗ |

MySQL 5.x에서 `INTERSECT`가 필요하면 `INNER JOIN`, `EXCEPT`가 필요하면 `NOT IN` / `NOT EXISTS`로 대체해야 한다.

---

## ORDER BY와 괄호

```sql
-- 전체 결과를 name 오름차순 정렬
SELECT name FROM a
UNION ALL
SELECT name FROM b
ORDER BY name;

-- 각 쿼리를 개별 정렬 후 합치려면 서브쿼리(인라인 뷰) 사용
SELECT * FROM (SELECT name FROM a ORDER BY name FETCH FIRST 10 ROWS ONLY) x
UNION ALL
SELECT * FROM (SELECT name FROM b ORDER BY name FETCH FIRST 10 ROWS ONLY) y;
```

집합 연산 중간에 `ORDER BY`를 넣으면 오류가 발생한다. 개별 정렬이 필요한 경우 서브쿼리로 감싸야 한다.

---

## 실무 팁

- **리포트 헤더/푸터 추가**: `UNION ALL`로 헤더 행(컬럼명)이나 합계 행을 직접 삽입하는 패턴이 있다.
- **로그 테이블 합치기**: 월별 파티션 테이블을 `UNION ALL`로 연결하면 파티션 뷰를 만들 수 있다.
- **데이터 비교**: `EXCEPT`를 양방향으로 사용(`A EXCEPT B` + `B EXCEPT A`)하면 두 테이블 간 차이를 완전히 파악할 수 있다.

---

**지난 글:** [타임존 처리와 AT TIME ZONE](/posts/sql-timezone-handling/)

**다음 글:** [PIVOT · UNPIVOT 패턴](/posts/sql-pivot-unpivot-pattern/)

<br>
읽어주셔서 감사합니다. 😊
