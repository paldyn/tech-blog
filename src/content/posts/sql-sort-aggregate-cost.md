---
title: "정렬과 집계의 비용"
description: "ORDER BY와 GROUP BY를 처리하는 메모리 정렬·External Sort·Sort Aggregate·Hash Aggregate의 동작 원리와 비용 구조, work_mem 튜닝 및 인덱스 활용으로 정렬을 제거하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["sql", "sort", "aggregate", "group-by", "order-by", "work-mem", "performance", "external-sort", "hash-aggregate"]
featured: false
draft: false
---

[지난 글](/posts/sql-join-algorithms/)에서 조인 알고리즘을 살펴봤다. 이번에는 `ORDER BY`와 `GROUP BY` 처리에 숨겨진 **정렬·집계 비용**을 파악하고 줄이는 방법을 알아본다.

---

## 정렬(Sort) 비용

### 메모리 정렬 vs External Sort

정렬 알고리즘은 기본적으로 **O(N log N)**이다. 문제는 데이터가 메모리에 다 들어오느냐에 달려 있다.

![정렬 비용 구조](/assets/posts/sql-sort-aggregate-cost-sort.svg)

- **In-memory Sort**: `work_mem`(PostgreSQL) 또는 `sort_buffer_size`(MySQL) 안에 데이터가 들어오면 CPU만으로 처리 가능하다. 빠르다.
- **External Sort(Disk Spill)**: 데이터가 메모리를 초과하면 청크를 디스크에 임시 저장(Run)한 뒤 병합(Merge)한다. 디스크 I/O가 수반되어 급격히 느려진다.

PostgreSQL에서 External Sort가 발생했는지는 `EXPLAIN ANALYZE`로 확인한다:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders ORDER BY created_at DESC;

-- 결과에 다음이 나오면 Spill 발생
-- Sort Method: external merge  Disk: 32768kB
```

`Sort Method: quicksort`이면 메모리 내 정렬, `external merge`이면 디스크 Spill이다.

### 인덱스로 정렬 제거

인덱스 순서와 `ORDER BY` 순서가 일치하면 옵티마이저는 **정렬 단계를 생략**한다.

```sql
-- created_at 인덱스가 있으면 Sort 단계 없음
CREATE INDEX idx_orders_created ON orders(created_at DESC);

SELECT * FROM orders
ORDER BY created_at DESC
LIMIT 20;
-- → Index Scan, no Sort step
```

---

## 집계(Aggregate) 알고리즘

### Sort Aggregate vs Hash Aggregate

![집계 알고리즘 비교](/assets/posts/sql-sort-aggregate-cost-agg.svg)

#### Sort Aggregate

GROUP BY 컬럼으로 먼저 정렬한 뒤, 인접한 같은 키를 묶어 집계한다.

```sql
-- 정렬 후 스트리밍 집계
SELECT dept_id, COUNT(*), SUM(salary)
FROM employees
GROUP BY dept_id
ORDER BY dept_id;
-- GROUP BY와 ORDER BY가 같으면 Sort 한 번으로 처리
```

**장점**: 결과가 이미 정렬돼 있어 `ORDER BY`가 같이 붙으면 추가 정렬 불필요. 스트리밍으로 메모리를 적게 쓴다.  
**단점**: 정렬 비용 O(N log N)이 선행된다.

#### Hash Aggregate

GROUP BY 키를 해시 테이블에 직접 누적한다. 정렬 없이 한 번의 테이블 스캔으로 집계한다.

```sql
-- 정렬 없이 해시로 집계
SELECT dept_id, COUNT(*)
FROM employees
GROUP BY dept_id;
-- → HashAggregate (sort 없음)
```

**장점**: 정렬 불필요 O(N). 그룹 수가 적을 때 매우 빠르다.  
**단점**: 그룹 수가 아주 많으면 해시 테이블이 메모리를 많이 차지한다. 결과 순서가 보장되지 않는다.

### CBO 선택 기준

```sql
-- EXPLAIN으로 집계 알고리즘 확인
EXPLAIN SELECT dept_id, COUNT(*)
FROM employees
GROUP BY dept_id;

-- HashAggregate (그룹 적음, 인덱스 없음)
-- GroupAggregate + Sort (인덱스로 정렬 대체 가능)
```

---

## work_mem 튜닝

정렬·해시 집계 모두 메모리 크기에 민감하다.

```sql
-- 세션 단위로 증량 (전체 설정 변경은 위험)
SET work_mem = '256MB';

-- 쿼리 실행
SELECT * FROM large_table ORDER BY col1, col2;

-- 확인 후 복구
RESET work_mem;
```

`work_mem`을 전역으로 높게 설정하면 병렬 쿼리가 여러 Sort를 동시에 수행할 때 메모리 총사용량이 `work_mem × 프로세스 수`가 될 수 있어 주의한다.

---

## 불필요한 정렬 제거

실무에서 발생하는 불필요한 정렬 패턴을 짚어 본다.

```sql
-- ✗ 서브쿼리 내부 ORDER BY (결과 순서 보장 안 됨)
SELECT * FROM (
  SELECT * FROM orders ORDER BY id
) sub WHERE status = 'pending';

-- ✓ 외부 쿼리에서만 ORDER BY
SELECT * FROM orders
WHERE status = 'pending'
ORDER BY id;

-- ✗ DISTINCT가 GROUP BY 대신 잘못 사용
SELECT DISTINCT dept_id FROM employees ORDER BY dept_id;

-- ✓ GROUP BY로 대체 가능
SELECT dept_id FROM employees GROUP BY dept_id ORDER BY dept_id;
```

---

## 요약

| 상황 | 권장 접근 |
|------|-----------|
| `ORDER BY` 느림 | EXPLAIN에서 Sort Method 확인, 인덱스 추가 |
| `GROUP BY` 느림 | HashAggregate vs Sort+Grouping 비교, work_mem 증량 |
| Disk Spill 발생 | work_mem 증량 (세션 단위로) |
| 정렬 비용 제거 | 인덱스 순서를 ORDER BY/GROUP BY와 일치 |

---

**지난 글:** [조인 알고리즘](/posts/sql-join-algorithms/)

**다음 글:** [통계와 선택도](/posts/sql-statistics-selectivity/)

<br>
읽어주셔서 감사합니다. 😊
