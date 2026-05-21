---
title: "SQL Server 컬럼스토어 인덱스 — OLAP 성능의 핵심"
description: "SQL Server 컬럼스토어 인덱스의 열 기반 저장 구조, 행 그룹·세그먼트·델타 스토어의 동작 원리, 클러스터형/비클러스터형 컬럼스토어의 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "컬럼스토어", "ColumnstoreIndex", "OLAP", "배치모드", "압축", "분석"]
featured: false
draft: false
---

[지난 글](/posts/mssql-filtered-index/)에서 필터된 인덱스로 크기와 성능을 최적화하는 방법을 살펴봤다. 이번에는 OLAP 분석 쿼리를 수십 배 빠르게 만드는 **컬럼스토어 인덱스(Columnstore Index)**를 깊이 파헤친다.

## 왜 컬럼 저장인가

전통적인 행 저장(Rowstore)은 행 단위로 데이터를 페이지에 담는다. 단일 행을 읽거나 쓰는 OLTP 작업에 최적이지만, `SUM(revenue)` 같은 집계에서는 불필요한 열(name, email 등)까지 모두 읽어 I/O가 낭비된다.

컬럼스토어는 **열 단위**로 데이터를 저장한다. `SUM(salary)`를 구할 때 salary 세그먼트만 읽어 I/O를 극적으로 줄인다. 같은 열의 값끼리 모여있어 압축률도 월등하다.

![행 저장 vs 컬럼 저장 구조 비교](/assets/posts/mssql-columnstore-structure.svg)

## 컬럼스토어 인덱스 생성

```sql
-- 클러스터형 컬럼스토어 (테이블 자체가 열 저장)
-- 주로 DW/팩트 테이블에 사용
CREATE TABLE sales_fact (
    sale_id      BIGINT         NOT NULL,
    sale_date    DATE           NOT NULL,
    customer_id  INT            NOT NULL,
    product_id   INT            NOT NULL,
    quantity     INT            NOT NULL,
    amount       DECIMAL(18,2)  NOT NULL,
    INDEX csi_sales CLUSTERED COLUMNSTORE
);

-- 비클러스터형 컬럼스토어 (행 저장 테이블에 추가)
-- OLTP 테이블에서 분석 쿼리 가속
CREATE NONCLUSTERED COLUMNSTORE INDEX ncsi_orders
ON orders (order_date, customer_id, amount, status);
```

## 내부 구조: 행 그룹과 세그먼트

컬럼스토어는 **행 그룹(Row Group)** 단위로 관리된다. 각 행 그룹은 약 100만 행을 담는다. 행 그룹 안에서 열마다 **세그먼트(Segment)** 단위로 압축 저장된다.

```sql
-- 행 그룹 상태 확인
SELECT rg.state_desc,
       rg.total_rows,
       rg.deleted_rows,
       rg.size_in_bytes
FROM   sys.column_store_row_groups rg
WHERE  rg.object_id = OBJECT_ID('sales_fact')
ORDER  BY rg.row_group_id;

-- 세그먼트 압축 정보
SELECT cs.column_id,
       c.name AS col_name,
       cs.row_count,
       cs.on_disk_size / 1024.0 AS kb,
       cs.encoding_type
FROM   sys.column_store_segments cs
JOIN   sys.columns c ON c.object_id = cs.object_id
                     AND c.column_id = cs.column_id
WHERE  cs.object_id = OBJECT_ID('sales_fact');
```

![델타 스토어 동작 원리](/assets/posts/mssql-columnstore-delta-store.svg)

## 델타 스토어와 쓰기 처리

컬럼스토어는 대용량 배치 로드에 최적화되어 있지만, 개별 행 INSERT도 지원한다. 새로 삽입된 행은 먼저 **델타 스토어(Delta Store)**에 행 저장 형식으로 쌓인다. 약 100만 행이 쌓이면 **Tuple Mover** 백그라운드 프로세스가 압축하여 새 행 그룹으로 전환한다.

DELETE는 실제로 행을 지우지 않고 **삭제 비트맵(Delete Bitmap)**에만 표시한다. 물리적 제거는 다음 REORGANIZE 시에 이루어진다.

```sql
-- 대량 INSERT (델타 스토어 우회, 직접 압축 행 그룹 생성)
-- TABLOCK 힌트로 최소 로그 + 직접 압축
INSERT INTO sales_fact WITH (TABLOCK)
SELECT ...
FROM   staging_sales;

-- 델타 스토어 강제 압축 (인덱스 재구성)
ALTER INDEX csi_sales ON sales_fact REORGANIZE
WITH (COMPRESS_ALL_ROW_GROUPS = ON);

-- 인덱스 재생성 (완전 재구축)
ALTER INDEX csi_sales ON sales_fact REBUILD;
```

## 분석 쿼리 성능 비교

```sql
-- 아래 쿼리는 컬럼스토어 인덱스로 수십 배 빨라짐
SELECT YEAR(sale_date)  AS yr,
       MONTH(sale_date) AS mo,
       SUM(amount)      AS total_revenue,
       COUNT(DISTINCT customer_id) AS unique_customers
FROM   sales_fact
WHERE  sale_date >= '2025-01-01'
GROUP  BY YEAR(sale_date), MONTH(sale_date)
ORDER  BY yr, mo;

-- 실행 계획: Batch Mode Columnstore Scan + Batch Mode Hash Aggregate
-- 배치 모드: SIMD 명령으로 벡터 연산, 한 번에 900개 행 처리
```

## OLTP + OLAP 혼합: 비클러스터형 컬럼스토어

SQL Server 2014 이상에서 **비클러스터형 컬럼스토어**를 OLTP 테이블에 추가하면 행 저장(OLTP용)과 열 저장(분석용)이 공존한다. 단건 INSERT/UPDATE는 행 저장을 사용하고, 집계 쿼리는 옵티마이저가 자동으로 컬럼스토어를 선택한다.

```sql
-- OLTP 테이블에 분석 인덱스 추가
CREATE NONCLUSTERED COLUMNSTORE INDEX ncsi_orders_analytics
ON orders (order_date, customer_id, product_id, amount, status);

-- 단건 조회: 행 저장 클러스터 인덱스 사용 (기존 OLTP 성능 유지)
SELECT * FROM orders WHERE order_id = 12345;

-- 집계 쿼리: 옵티마이저가 컬럼스토어 선택
SELECT product_id, SUM(amount)
FROM   orders
WHERE  order_date >= '2026-01-01'
GROUP  BY product_id;
```

---

**지난 글:** [SQL Server 필터된 인덱스 — 조건부 인덱스로 공간과 성능 최적화](/posts/mssql-filtered-index/)

**다음 글:** [SQL Server In-Memory OLTP — Hekaton 메모리 최적화 테이블](/posts/mssql-memory-optimized-hekaton/)

<br>
읽어주셔서 감사합니다. 😊
