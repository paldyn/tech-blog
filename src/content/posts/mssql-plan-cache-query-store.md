---
title: "SQL Server 플랜 캐시와 Query Store — 실행 계획 재사용과 관리"
description: "SQL Server 플랜 캐시의 재사용 메커니즘과 Ad-hoc 쿼리 오염 문제, Query Store로 실행 계획 이력을 영속 관리하고 플랜 회귀를 대응하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "플랜캐시", "QueryStore", "파라미터스니핑", "실행계획", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/mssql-cardinality-estimator/)에서 카디널리티 추정기가 실행 계획의 품질을 결정한다는 것을 살펴봤다. 이번에는 한번 만든 실행 계획을 SQL Server가 어떻게 재사용하는지, 그리고 SQL Server 2016부터 도입된 Query Store가 플랜 관리를 어떻게 바꾸는지 알아본다.

## 플랜 캐시 기본 원리

SQL Server는 쿼리를 처음 받으면 파싱 → 바인딩 → 최적화 → 실행 순서로 처리한다. 최적화 단계는 CPU를 가장 많이 소비한다. 이 비용을 줄이기 위해 SQL Server는 완성된 실행 계획을 **플랜 캐시(Buffer Pool 내 Procedure Cache)** 에 저장해 두고, 동일한 쿼리가 다시 들어오면 캐싱된 플랜을 바로 사용한다.

플랜 캐시 키는 쿼리 텍스트, DB 컨텍스트, 호환성 수준, 파라미터 스니핑 값 등을 조합한 해시다. 대소문자나 공백 하나가 달라도 새 플랜이 생성되므로, 애플리케이션에서 쿼리 텍스트를 통일하는 것이 중요하다.

![플랜 캐시 vs Query Store 아키텍처](/assets/posts/mssql-plan-cache-query-store-arch.svg)

## Ad-hoc 쿼리 오염

저장 프로시저나 파라미터화된 쿼리(`sp_executesql`)는 플랜 캐시를 효율적으로 재사용한다. 반면 파라미터가 리터럴로 박힌 Ad-hoc 쿼리는 값마다 새 플랜이 캐싱된다. 쿼리가 많은 시스템에서 수십만 개의 1회용(single-use) 플랜이 플랜 캐시를 가득 채워 유용한 플랜을 밀어내는 현상이 발생한다.

```sql
-- 단일 사용 플랜 오염 점검
SELECT objtype, usecounts,
       CAST(size_in_bytes / 1024.0 AS DECIMAL(10,1)) AS size_kb,
       SUBSTRING(text, 1, 80) AS sql_snippet
FROM   sys.dm_exec_cached_plans
       CROSS APPLY sys.dm_exec_sql_text(plan_handle)
WHERE  usecounts = 1
  AND  objtype   = 'Adhoc'
ORDER  BY size_in_bytes DESC;
```

이 문제의 처방은 두 가지다. 첫째, `sp_configure 'optimize for ad hoc workloads', 1` 을 활성화하면 첫 번째 실행에 전체 플랜 대신 스텁(stub)만 저장해 메모리를 아낀다. 둘째, 애플리케이션에서 파라미터화 쿼리를 사용하도록 리팩터링한다.

## 파라미터 스니핑 문제

저장 프로시저가 처음 컴파일될 때 전달된 파라미터 값을 기준으로 실행 계획이 만들어진다. 이후 매우 다른 선택도를 가진 파라미터로 호출해도 캐싱된 플랜을 재사용한다. 이를 **파라미터 스니핑(Parameter Sniffing)** 이라 하며, 특정 파라미터 조합에서 성능이 급격히 떨어지는 주요 원인이다.

```sql
-- 문제 예: VIP 고객(소량)과 일반 고객(대량) 처리
CREATE OR ALTER PROCEDURE dbo.GetOrders
    @CustomerID INT
AS
BEGIN
    SELECT * FROM Orders WHERE CustomerID = @CustomerID;
    -- 최초 @CustomerID = 1(VIP)로 컴파일 → Index Seek 플랜 캐싱
    -- 이후 @CustomerID = 9999(100만 건)로 호출 → Seek 플랜이 비효율
END;

-- 해결 1: 쿼리마다 재컴파일 (정확하지만 CPU ↑)
SELECT * FROM Orders WHERE CustomerID = @CustomerID
OPTION (RECOMPILE);

-- 해결 2: 미지 파라미터 최적화 (평균 선택도로 컴파일)
SELECT * FROM Orders WHERE CustomerID = @CustomerID
OPTION (OPTIMIZE FOR UNKNOWN);
```

## Query Store: 영속 플랜 이력 관리

SQL Server 2016에 도입된 Query Store는 플랜 캐시의 치명적 약점(재시작 시 소멸, 이력 없음)을 해결한다. 모든 실행 계획과 런타임 통계(CPU, 읽기, 지속 시간)를 DB 파일에 지속적으로 기록한다.

```sql
-- Query Store 활성화
ALTER DATABASE AdventureWorks
  SET QUERY_STORE = ON
  (OPERATION_MODE     = READ_WRITE,
   MAX_STORAGE_SIZE_MB = 2048,
   QUERY_CAPTURE_MODE  = AUTO,       -- 중요 쿼리만 캡처
   INTERVAL_LENGTH_MINUTES = 60);    -- 집계 주기
```

![Query Store 플랜 회귀 대응 흐름](/assets/posts/mssql-plan-cache-query-store-lifecycle.svg)

Query Store의 가장 강력한 기능은 **플랜 강제(Force Plan)** 다. 통계 변경이나 인덱스 재구성 후 옵티마이저가 나쁜 플랜을 선택해도, 이전에 효율적이었던 플랜을 DB에서 찾아 강제 적용할 수 있다. 재시작해도 유지된다.

```sql
-- 문제 쿼리의 좋은 플랜 강제
EXEC sys.sp_query_store_force_plan
  @query_id = 42,   -- query_store_query에서 확인
  @plan_id  = 17;   -- query_store_plan에서 확인

-- 강제 해제 (옵티마이저 자율로 복구)
EXEC sys.sp_query_store_unforce_plan
  @query_id = 42,
  @plan_id  = 17;
```

## 자동 계획 수정 (Automatic Plan Correction)

SQL Server 2017 이상에서는 Query Store를 기반으로 자동 계획 수정(Automatic Plan Correction)을 활성화할 수 있다. 옵티마이저가 플랜 회귀를 감지하면 이전 플랜을 자동으로 강제하고, 더 나은 플랜이 나타나면 자동으로 해제한다.

```sql
ALTER DATABASE AdventureWorks
  SET AUTOMATIC_TUNING (FORCE_LAST_GOOD_PLAN = ON);

-- 자동 수정 이력 확인
SELECT * FROM sys.dm_db_tuning_recommendations
ORDER BY create_date DESC;
```

## 정리

플랜 캐시는 재컴파일 비용을 줄이지만 Ad-hoc 오염과 파라미터 스니핑 문제가 따른다. Query Store는 플랜 캐시를 대체하지 않고, 그 위에 영속 이력과 강제 메커니즘을 얹어 플랜 안정성을 제공한다. SQL Server 2016 이상 환경에서는 Query Store를 항상 활성화하고, 정기적으로 Regressed Queries 보고서를 검토하는 것이 성능 관리의 기본이다.

---

**지난 글:** [SQL Server 카디널리티 추정기 — 실행 계획 품질의 핵심](/posts/mssql-cardinality-estimator/)

**다음 글:** [SQL Server 복구 모델 — Full · Bulk-Logged · Simple](/posts/mssql-recovery-models/)

<br>
읽어주셔서 감사합니다. 😊
