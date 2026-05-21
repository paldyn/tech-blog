---
title: "SQL Server 필터된 인덱스 — 조건부 인덱스로 공간과 성능 최적화"
description: "SQL Server 필터된 인덱스(Filtered Index)의 구조, 일반 인덱스 대비 크기 절감 효과, 소프트 삭제·희소 유니크·상태 필터 등 활용 패턴과 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "인덱스", "필터인덱스", "FilteredIndex", "소프트삭제", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/mssql-include-columns/)에서 INCLUDE 절로 커버링 인덱스를 만드는 방법을 살펴봤다. 이번에는 **필터된 인덱스(Filtered Index)** — 테이블 행의 일부에만 적용되는 조건부 인덱스로 크기와 성능을 동시에 최적화하는 기법이다.

## 필터된 인덱스란

일반 비클러스터형 인덱스는 테이블의 모든 행을 색인한다. 필터된 인덱스는 `WHERE` 절을 추가해 **조건에 맞는 행만** 색인한다. SQL Server 2008에서 도입됐다.

```sql
-- 일반 인덱스 (100만 행 모두 색인)
CREATE NONCLUSTERED INDEX ix_status_all
ON orders (status, order_date);

-- 필터된 인덱스 (status='ACTIVE' 1만 행만 색인)
CREATE NONCLUSTERED INDEX ix_active_only
ON orders (order_date, customer_id)
WHERE status = 'ACTIVE';
```

![필터된 인덱스 구조 비교](/assets/posts/mssql-filtered-index-structure.svg)

데이터가 불균일하게 분포할 때 효과가 극적이다. 100만 행 중 1%만 `ACTIVE` 상태라면 필터된 인덱스의 크기는 일반 인덱스의 **1%**에 불과하다. 유지비용(INSERT/UPDATE/DELETE 시 인덱스 업데이트)도 99% 감소한다.

## 주요 활용 패턴

![필터된 인덱스 활용 패턴](/assets/posts/mssql-filtered-index-usecases.svg)

### NULL을 제외한 희소 유니크 제약

표준 UNIQUE 인덱스는 NULL을 한 번만 허용한다. 필터된 인덱스를 사용하면 NULL을 여러 개 허용하면서 비-NULL 값에만 유니크를 보장할 수 있다.

```sql
-- 이메일이 입력된 사용자만 중복 방지 (NULL은 여러 개 허용)
CREATE UNIQUE NONCLUSTERED INDEX uix_email_nonnull
ON users (email)
WHERE email IS NOT NULL;

-- 테스트
INSERT INTO users (name, email) VALUES ('김민수', 'kim@test.com');   -- OK
INSERT INTO users (name, email) VALUES ('이지현', 'kim@test.com');   -- ERROR: 중복
INSERT INTO users (name, email) VALUES ('박서준', NULL);              -- OK
INSERT INTO users (name, email) VALUES ('최유나', NULL);              -- OK (NULL 중복 허용)
```

### 소프트 삭제 패턴

`deleted_at IS NULL` 필터로 활성 데이터만 색인해 대부분의 쿼리가 삭제된 데이터를 제외하는 환경에서 매우 효과적이다.

```sql
CREATE NONCLUSTERED INDEX ix_active_products
ON products (category_id, price)
INCLUDE (name, stock_qty)
WHERE deleted_at IS NULL;

-- 이 쿼리가 필터된 인덱스를 사용하려면 WHERE 조건이 일치해야 함
SELECT name, price, stock_qty
FROM   products
WHERE  category_id = 5
  AND  deleted_at IS NULL;   -- ← 필터 조건 포함 필수
```

### 작업 큐 최적화

상태가 `PENDING`인 행이 전체의 1% 미만일 때, 나머지 99%를 불필요하게 색인하지 않는다.

```sql
CREATE NONCLUSTERED INDEX ix_pending_jobs
ON background_jobs (priority DESC, created_at ASC)
INCLUDE (job_type, payload)
WHERE status = 'PENDING';

-- 워커가 다음 작업을 가져오는 쿼리
WITH next_job AS (
    SELECT TOP 1 job_id, job_type, payload
    FROM   background_jobs WITH (UPDLOCK, READPAST)
    WHERE  status = 'PENDING'
    ORDER  BY priority DESC, created_at ASC
)
UPDATE next_job SET status = 'PROCESSING'
OUTPUT inserted.job_id, inserted.job_type, inserted.payload;
```

## 주의사항

**파라미터화된 쿼리 주의**: 변수나 파라미터를 WHERE 조건에 쓰면 옵티마이저가 필터된 인덱스를 선택하지 못할 수 있다.

```sql
DECLARE @status NVARCHAR(20) = 'ACTIVE';

-- 아래는 필터된 인덱스 미사용 (변수이므로 옵티마이저 인식 불가)
SELECT * FROM orders WHERE status = @status;

-- 강제 사용: OPTIMIZE FOR 힌트 또는 리터럴 사용
SELECT * FROM orders WHERE status = 'ACTIVE';  -- 리터럴: 인식 가능

-- 또는 OPTION 힌트
SELECT * FROM orders WHERE status = @status
OPTION (OPTIMIZE FOR (@status = 'ACTIVE'));
```

**필터 조건 제한**: 단순 비교(`=`, `>`, `<`, `<>`, `IS NULL`, `IS NOT NULL`)와 `AND` 조합만 지원한다. 서브쿼리, `OR`, 복잡한 표현식은 사용할 수 없다.

```sql
-- 지원: 단순 조건
WHERE status = 'ACTIVE' AND deleted_at IS NULL

-- 미지원: OR, 서브쿼리, 함수
WHERE status IN ('ACTIVE', 'PENDING')  -- ✗ IN 절 미지원
WHERE YEAR(created_at) = 2026          -- ✗ 함수 미지원
```

---

**지난 글:** [SQL Server 포함 열 인덱스 — INCLUDE 절 활용 가이드](/posts/mssql-include-columns/)

**다음 글:** [SQL Server 컬럼스토어 인덱스 — OLAP 성능의 핵심](/posts/mssql-columnstore-index/)

<br>
읽어주셔서 감사합니다. 😊
