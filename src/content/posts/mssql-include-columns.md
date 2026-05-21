---
title: "SQL Server 포함 열 인덱스 — INCLUDE 절 활용 가이드"
description: "SQL Server 비클러스터형 인덱스의 INCLUDE 절로 커버링 인덱스를 만들어 Key Lookup을 제거하는 방법, 키 열과 포함 열의 차이, 인덱스 설계 원칙을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "인덱스", "INCLUDE", "커버링인덱스", "KeyLookup", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/mssql-clustered-nonclustered/)에서 클러스터형과 비클러스터형 인덱스의 구조 차이, Key Lookup 발생 원리를 살펴봤다. 이번에는 Key Lookup을 제거하는 핵심 도구인 **INCLUDE 절**과 커버링 인덱스 설계를 다룬다.

## Key Lookup 비용

실행 계획에 `Key Lookup (Clustered)` 연산이 보이면 비클러스터형 인덱스 탐색 후 클러스터 인덱스를 한 번 더 탐색한다는 뜻이다. 단일 행 조회에서는 무시할 수 있지만, 수천~수만 행을 처리할 때는 Key Lookup이 전체 비용의 대부분을 차지하는 병목이 된다.

```sql
-- Key Lookup이 발생하는 쿼리
SELECT customer_id, name, phone
FROM   customers
WHERE  email = 'kim@example.com';
-- 실행 계획: IX_Email (NC Index Seek) → Key Lookup → Nested Loop

-- I/O 통계 확인
SET STATISTICS IO ON;
-- customers 테이블: 스캔 수 2, 논리적 읽기 수 6
-- Key Lookup 제거 후: 논리적 읽기 수 2
```

## INCLUDE 절로 커버링 인덱스 생성

`INCLUDE` 절에 포함된 열은 인덱스의 **리프 노드에만** 저장된다. 키 열처럼 모든 B-Tree 노드에 복사되지 않아 인덱스 크기를 최소화하면서도 SELECT에서 추가 탐색 없이 값을 반환할 수 있다.

```sql
-- Key Lookup 제거: phone을 INCLUDE에 추가
CREATE NONCLUSTERED INDEX ix_email_covering
ON customers (email)
INCLUDE (name, phone);

-- 이제 위 쿼리는 인덱스만으로 처리됨 (커버링 인덱스)
SELECT customer_id, name, phone
FROM   customers
WHERE  email = 'kim@example.com';
-- 실행 계획: ix_email_covering (Index Seek) → 완료
```

![INCLUDE 절 리프 노드 구조 비교](/assets/posts/mssql-include-columns-structure.svg)

## 키 열 vs 포함 열 선택 기준

![커버링 인덱스 설계 원칙](/assets/posts/mssql-include-columns-design.svg)

**키 열**은 B-Tree의 모든 레벨에 저장되어 탐색·정렬에 사용된다. WHERE, JOIN ON, ORDER BY에 사용되는 열이어야 한다. **포함 열**은 리프 노드에만 저장되며 SELECT 목록에서 Key Lookup을 방지하는 용도다.

```sql
-- 복합 인덱스 + INCLUDE 설계 예시
-- 쿼리: WHERE dept_id = ? AND status = 'ACTIVE' ORDER BY hire_date
--       SELECT emp_id, name, salary
CREATE NONCLUSTERED INDEX ix_dept_status_hire
ON employees (dept_id, status, hire_date)    -- 키: WHERE + ORDER BY
INCLUDE (name, salary);                       -- INCLUDE: SELECT
```

## 포함 열의 특권

포함 열은 키 열보다 제한이 적다.

- **MAX 데이터 타입**(VARCHAR(MAX), NVARCHAR(MAX), VARBINARY(MAX))을 포함 가능 (키는 불가)
- 최대 1023개 포함 열 허용 (실용적 한계는 인덱스 크기)
- 계산 열도 포함 가능

```sql
-- MAX 타입 포함 예 (키에는 불가)
CREATE NONCLUSTERED INDEX ix_doc_title
ON documents (doc_type, created_date)
INCLUDE (title, content);  -- content는 NVARCHAR(MAX)
```

## 사용 패턴: 보고서 쿼리 최적화

월별 매출 보고서처럼 반복적으로 실행되는 무거운 쿼리를 커버링 인덱스로 최적화하는 패턴이다.

```sql
-- 자주 실행되는 보고서 쿼리
SELECT order_date,
       customer_id,
       SUM(amount) AS total
FROM   orders
WHERE  order_date >= '2026-01-01'
  AND  status = 'COMPLETED'
GROUP  BY order_date, customer_id;

-- 커버링 인덱스: 키는 WHERE/GROUP BY 열, INCLUDE는 SUM 대상 열
CREATE NONCLUSTERED INDEX ix_orders_report
ON orders (order_date, status)
INCLUDE (customer_id, amount);
```

## 중복 인덱스 점검

INCLUDE 인덱스가 많아지면 INSERT/UPDATE/DELETE 성능이 저하된다. 불필요한 중복 인덱스를 정기적으로 찾아 제거해야 한다.

```sql
-- 사용되지 않는 인덱스 조회 (SQL Server 재시작 후 누적)
SELECT OBJECT_NAME(ius.object_id) AS tbl,
       i.name                     AS idx,
       ius.user_seeks,
       ius.user_scans,
       ius.user_lookups,
       ius.user_updates
FROM   sys.dm_db_index_usage_stats ius
JOIN   sys.indexes i ON i.object_id = ius.object_id
                     AND i.index_id  = ius.index_id
WHERE  ius.database_id = DB_ID()
  AND  i.type_desc = 'NONCLUSTERED'
  AND  ius.user_seeks + ius.user_scans + ius.user_lookups = 0
ORDER  BY ius.user_updates DESC;
```

---

**지난 글:** [SQL Server 클러스터형 vs 비클러스터형 인덱스](/posts/mssql-clustered-nonclustered/)

**다음 글:** [SQL Server 필터된 인덱스 — 조건부 인덱스로 공간과 성능 최적화](/posts/mssql-filtered-index/)

<br>
읽어주셔서 감사합니다. 😊
