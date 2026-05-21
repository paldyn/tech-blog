---
title: "SQL Server 클러스터형 vs 비클러스터형 인덱스"
description: "SQL Server 클러스터형 인덱스와 비클러스터형 인덱스의 물리적 구조, 데이터 저장 방식, Key Lookup 발생 원리와 INCLUDE로 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "인덱스", "클러스터형", "비클러스터형", "KeyLookup", "BTree", "성능"]
featured: false
draft: false
---

[지난 글](/posts/mssql-deadlock-graph-analysis/)에서 SQL Server 데드락 분석을 다뤘다. 이번에는 SQL Server 성능 최적화의 핵심인 **클러스터형 인덱스**와 **비클러스터형 인덱스**의 물리적 구조 차이를 살펴본다.

## 클러스터형 인덱스 — 데이터 페이지가 리프 노드

클러스터형 인덱스(Clustered Index)는 **데이터 행 자체가 B-Tree의 리프 노드**에 저장된다. 테이블당 하나만 가질 수 있다. PRIMARY KEY를 정의하면 기본적으로 클러스터형 인덱스가 생성된다.

```sql
-- PK 생성 → 클러스터형 인덱스 자동 생성
CREATE TABLE customers (
    customer_id INT          NOT NULL CONSTRAINT pk_customers PRIMARY KEY,
    name        NVARCHAR(100) NOT NULL,
    email       NVARCHAR(255),
    phone       NVARCHAR(20)
);

-- 클러스터 인덱스 정보 확인
SELECT i.name, i.type_desc, ic.column_id, c.name AS col_name
FROM   sys.indexes i
JOIN   sys.index_columns ic ON ic.object_id = i.object_id
                             AND ic.index_id = i.index_id
JOIN   sys.columns c ON c.object_id = i.object_id
                      AND c.column_id = ic.column_id
WHERE  i.object_id = OBJECT_ID('customers')
ORDER  BY i.index_id, ic.key_ordinal;
```

![클러스터형 인덱스 B-Tree 구조](/assets/posts/mssql-clustered-structure.svg)

클러스터형 인덱스의 가장 큰 장점은 **범위 조회** 성능이다. 조건에 맞는 행이 물리적으로 인접한 페이지에 정렬되어 있어 I/O를 최소화한다.

```sql
-- 클러스터 키로 범위 조회: 인접 페이지 순차 읽기 → 매우 빠름
SELECT *
FROM   orders
WHERE  order_date BETWEEN '2026-01-01' AND '2026-03-31';
```

## 비클러스터형 인덱스 — 클러스터 키 포인터

비클러스터형 인덱스(Non-Clustered Index)의 리프 노드에는 실제 데이터 행이 없다. 대신 **클러스터 키(Cluster Key) 값**이 포인터로 저장된다. 클러스터형 인덱스가 없는 힙(Heap) 테이블의 경우 RID(Row ID) 포인터를 사용한다.

```sql
-- 비클러스터형 인덱스 생성
CREATE NONCLUSTERED INDEX ix_email
ON customers (email ASC);

-- 복합 비클러스터형 인덱스
CREATE NONCLUSTERED INDEX ix_name_email
ON customers (name, email);
```

## Key Lookup — 성능 병목의 원인

비클러스터형 인덱스에 없는 열을 SELECT 하면 **Key Lookup**(또는 RID Lookup)이 발생한다. NC 인덱스로 클러스터 키를 찾은 후 클러스터 인덱스를 다시 탐색하는 추가 I/O 단계다.

![비클러스터형 인덱스 Key Lookup 구조](/assets/posts/mssql-nonclustered-lookup.svg)

```sql
-- 실행 계획에서 Key Lookup 확인
SET STATISTICS IO ON;
SELECT customer_id, name, phone    -- phone은 NC Index에 없음
FROM   customers
WHERE  email = 'kim@example.com';  -- ix_email 사용
-- 실행 계획: [NC Index Seek] → [Key Lookup (Clustered)]

-- Key Lookup 제거: INCLUDE 절로 phone 추가
CREATE NONCLUSTERED INDEX ix_email_incl
ON customers (email)
INCLUDE (name, phone);   -- 리프 노드에 phone도 함께 저장
```

## 클러스터 키 선택 기준

클러스터 키 선택은 삽입/수정 성능에 직접 영향을 준다.

| 특성 | 권장 | 위험 |
|------|------|------|
| 단조 증가 | INT IDENTITY, BIGINT SEQUENCE | GUID(랜덤) |
| 크기 | ≤8바이트 | 큰 문자열, 복합 키 |
| 변경 빈도 | 거의 변경 없음 | 자주 변경되는 열 |

**GUID를 클러스터 키로 쓰면** 페이지 분할(Page Split)이 무작위로 발생해 단편화가 심각해진다. 반드시 사용해야 한다면 `NEWSEQUENTIALID()`를 쓰거나 별도 INT IDENTITY를 클러스터 키로 사용하고 GUID는 UNIQUE 제약으로 관리한다.

```sql
-- GUID를 클러스터 키로 쓰면 안 되는 이유
CREATE TABLE bad_design (
    id    UNIQUEIDENTIFIER DEFAULT NEWID()  -- ← 랜덤 GUID: 페이지 분할 多
                          PRIMARY KEY,
    ...
);

-- 권장: INT IDENTITY를 클러스터 키, GUID는 UK
CREATE TABLE good_design (
    id         INT              IDENTITY(1,1) PRIMARY KEY,  -- 클러스터 키
    public_id  UNIQUEIDENTIFIER DEFAULT NEWID() NOT NULL    -- 비클러스터 UK
                               CONSTRAINT uk_public_id UNIQUE
);
```

## 인덱스 단편화 확인

```sql
-- 인덱스 단편화율 조회 (5% 이상이면 REBUILD/REORGANIZE 고려)
SELECT i.name,
       ips.avg_fragmentation_in_percent,
       ips.page_count
FROM   sys.dm_db_index_physical_stats(
           DB_ID(), OBJECT_ID('customers'), NULL, NULL, 'LIMITED'
       ) ips
JOIN   sys.indexes i ON i.object_id = ips.object_id
                     AND i.index_id = ips.index_id
ORDER  BY ips.avg_fragmentation_in_percent DESC;

-- 재구성 (온라인, 소규모 단편화)
ALTER INDEX ix_email ON customers REORGANIZE;

-- 재생성 (오프라인, 대규모 단편화)
ALTER INDEX ix_email ON customers REBUILD;
```

---

**지난 글:** [SQL Server 교착상태 분석 — 데드락 그래프 읽는 법](/posts/mssql-deadlock-graph-analysis/)

**다음 글:** [SQL Server 포함 열 인덱스 — INCLUDE 절 활용 가이드](/posts/mssql-include-columns/)

<br>
읽어주셔서 감사합니다. 😊
