---
title: "SQL Server 버퍼 풀과 플랜 캐시 — 메모리 관리 완전 가이드"
description: "SQL Server 버퍼 풀의 8KB 페이지 구조, Clean/Dirty Pages, LazyWriter, Checkpoint, 플랜 캐시 라이프사이클, 파라미터 스니핑 문제를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "버퍼풀", "플랜캐시", "메모리관리", "파라미터스니핑", "Checkpoint"]
featured: false
draft: false
---

[지난 글](/posts/mssql-scheduler-worker-thread/)에서 스케줄러·워커·스레드 실행 모델을 살펴봤다. 이번 글에서는 SQL Server 메모리 관리의 두 핵심인 **버퍼 풀**과 **플랜 캐시**를 다룬다. 이 두 가지를 이해하면 메모리 압박, 과도한 컴파일, 파라미터 스니핑 같은 문제를 정확히 진단할 수 있다.

## 버퍼 풀 구조

버퍼 풀은 SQL Server가 데이터 페이지를 메모리에 캐시하는 영역이다. 데이터 파일의 모든 접근은 버퍼 풀을 경유하며, 디스크 I/O를 최소화한다.

- 기본 페이지 크기: **8KB**
- 익스텐트: 8페이지 = 64KB
- 버퍼 풀 내 페이지는 상태에 따라 분류된다

![버퍼 풀 구조](/assets/posts/mssql-buffer-pool-structure.svg)

### 페이지 상태

| 상태 | 설명 | 제거 가능 여부 |
|---|---|---|
| **Clean** | 디스크 내용과 동일 | 즉시 재사용 가능 |
| **Dirty** | 메모리에서 수정됨, 디스크 미기록 | Checkpoint 후 재사용 |
| **Free** | 아무 데이터도 없음 | 즉시 사용 가능 |
| **Stolen** | 플랜 캐시·정렬 버퍼 등 비데이터 용도 | 해당 컴포넌트 해제 시 |

```sql
-- DB별 버퍼 풀 사용량
SELECT
    DB_NAME(database_id) AS db_name,
    COUNT(*) * 8 / 1024  AS cached_mb,
    SUM(is_modified)     AS dirty_pages,
    SUM(CASE WHEN is_modified = 0 THEN 1 ELSE 0 END) AS clean_pages
FROM sys.dm_os_buffer_descriptors
WHERE database_id != 32767   -- RESOURCEDB 제외
GROUP BY database_id
ORDER BY cached_mb DESC;
```

## LazyWriter와 Checkpoint

### LazyWriter

Free 페이지가 `min_free_buffers` 임계치 아래로 떨어지면 SQLOS가 **LazyWriter** 스레드를 활성화한다. LazyWriter는 LRU(Least Recently Used) 기반으로 오래 사용되지 않은 Clean 페이지를 Free 목록으로 돌리고, Dirty 페이지는 디스크에 기록한 뒤 Clean으로 전환한다.

### Checkpoint

**Checkpoint**는 Dirty 페이지를 디스크에 기록해 재시작 시 WAL(Write-Ahead Log) 복구 시간을 단축하는 프로세스다.

```sql
-- 수동 Checkpoint 실행
CHECKPOINT;
CHECKPOINT 30;   -- 최소 30초 이내 완료 목표

-- Checkpoint 관련 설정
EXEC sp_configure 'recovery interval (min)', 0;  -- 0 = 자동 (기본 1분)
RECONFIGURE;
```

SQL Server 2016+의 **간접 Checkpoint**는 대상 복구 시간(`TARGET_RECOVERY_TIME`)을 기반으로 연속적 소규모 Checkpoint를 수행해 대형 Checkpoint 급증을 방지한다.

```sql
-- DB별 간접 Checkpoint 설정 (초 단위)
ALTER DATABASE AdventureWorks
SET TARGET_RECOVERY_TIME = 60 SECONDS;   -- 기본 60초
```

## 메모리 한도 설정

SQL Server는 기본적으로 사용 가능한 RAM을 무제한으로 점유할 수 있다. 다른 서비스와 공존할 때는 반드시 상한을 설정해야 한다.

```sql
-- 현재 메모리 설정 확인
EXEC sp_configure 'min server memory (MB)';
EXEC sp_configure 'max server memory (MB)';

-- 설정 예시 (16GB 서버, OS 용도로 4GB 남김)
EXEC sp_configure 'max server memory (MB)', 12288;
RECONFIGURE;

-- 메모리 사용 현황
SELECT
    physical_memory_in_use_kb / 1024 AS used_mb,
    page_fault_count,
    memory_utilization_percentage   -- 80% 이상이면 메모리 압박
FROM sys.dm_os_process_memory;
```

## 플랜 캐시 — 실행 계획 재사용

SQL Server는 쿼리를 처음 실행할 때 옵티마이저가 실행 계획을 생성하고 이를 **플랜 캐시**에 저장한다. 동일한 쿼리가 다시 실행되면 컴파일 없이 캐시된 플랜을 재사용한다.

![플랜 캐시 라이프사이클](/assets/posts/mssql-plan-cache-lifecycle.svg)

플랜 캐시는 버퍼 풀의 **Stolen Memory** 영역을 사용한다.

```sql
-- 플랜 캐시 크기 및 재사용 횟수
SELECT
    objtype,
    COUNT(*)                    AS plan_count,
    SUM(size_in_bytes) / 1048576 AS total_mb,
    AVG(usecounts)              AS avg_use_count
FROM sys.dm_exec_cached_plans
GROUP BY objtype
ORDER BY total_mb DESC;
```

`use_count = 1`인 플랜이 많으면 애드혹 쿼리가 많다는 신호다. `optimize for ad hoc workloads` 옵션을 활성화하면 첫 실행 시 전체 플랜 대신 스텁만 저장해 메모리를 절약할 수 있다.

```sql
EXEC sp_configure 'optimize for ad hoc workloads', 1;
RECONFIGURE;
```

## 파라미터 스니핑

SQL Server는 Stored Procedure를 첫 실행할 때의 **파라미터 값**을 기준으로 실행 계획을 캐시한다. 이후 다른 값이 들어와도 같은 계획을 재사용하는데, 데이터 분포가 편향될 경우 부적절한 계획이 사용되는 **파라미터 스니핑** 문제가 발생한다.

```sql
-- 문제 상황: 첫 실행이 category=1(소량)일 때 Nested Loop 계획 캐시
-- 이후 category=99(대량)가 들어오면 Hash Join이 더 효율적이나 이전 계획 사용됨

-- 해결책 1: OPTION (RECOMPILE) — 매번 재컴파일
SELECT * FROM orders WHERE category = @cat
OPTION (RECOMPILE);

-- 해결책 2: OPTIMIZE FOR — 특정 값으로 계획 고정
SELECT * FROM orders WHERE category = @cat
OPTION (OPTIMIZE FOR (@cat = 99));

-- 해결책 3: OPTIMIZE FOR UNKNOWN — 통계 기반 최적화
SELECT * FROM orders WHERE category = @cat
OPTION (OPTIMIZE FOR (@cat UNKNOWN));

-- 해결책 4: 프로시저 수준 재컴파일
CREATE OR ALTER PROCEDURE GetOrders @cat INT
WITH RECOMPILE
AS
SELECT * FROM orders WHERE category = @cat;
```

## 플랜 캐시 진단

```sql
-- 비효율 플랜 탐지 (CPU 소비 상위)
SELECT TOP 20
    qs.total_worker_time / qs.execution_count / 1000 AS avg_cpu_ms,
    qs.execution_count,
    qs.total_logical_reads / qs.execution_count      AS avg_logical_reads,
    SUBSTRING(qt.text, 1, 100)                       AS sql_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
ORDER BY avg_cpu_ms DESC;

-- 플랜 캐시 강제 제거 (테스트 후 기준선 재설정 용도)
DBCC FREEPROCCACHE;                  -- 전체 제거
DBCC FREEPROCCACHE (plan_handle);    -- 특정 플랜만 제거
```

버퍼 풀과 플랜 캐시는 SQL Server 성능 튜닝의 두 축이다. 다음 글에서는 SQL Server 저장소 구조인 **데이터 파일·로그 파일·파일 그룹**을 살펴본다.

---

**지난 글:** [SQL Server 스케줄러·워커·스레드 모델](/posts/mssql-scheduler-worker-thread/)

**다음 글:** [SQL Server 데이터 파일·로그 파일·파일 그룹](/posts/mssql-data-log-filegroup/)

<br>
읽어주셔서 감사합니다. 😊
