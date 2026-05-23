---
title: "SQL Server DMV 진단 — 성능 병목 실시간 분석"
description: "SQL Server 동적 관리 뷰(DMV)로 CPU 과부하·IO 병목·블로킹·메모리 압박을 실시간 진단하는 방법과 증상별 핵심 쿼리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "DMV", "성능진단", "블로킹", "대기통계", "누락인덱스"]
featured: false
draft: false
---

[지난 글](/posts/mssql-replication-types/)에서 복제 유형과 모니터링 기본을 다뤘다. 이번에는 SQL Server 성능 문제를 빠르게 파악하는 핵심 도구인 **동적 관리 뷰(Dynamic Management View, DMV)** 를 실전 중심으로 정리한다.

## DMV란 무엇인가

DMV는 `sys.dm_*` 스키마 아래에 있는 특수 시스템 뷰다. SQL Server 인스턴스의 내부 상태 — 세션·요청·잠금·대기·IO·메모리 — 를 실시간으로 노출한다. 별도 에이전트 설치 없이 `SELECT` 권한만으로 조회할 수 있어 긴급 진단에 매우 유용하다. 단, 대부분의 DMV는 인스턴스 재시작 시 0으로 초기화된다.

![SQL Server DMV 진단 지도](/assets/posts/mssql-dmv-diagnostics-map.svg)

## 진단 첫 단계: 대기 통계

성능 문제가 발생하면 가장 먼저 `sys.dm_os_wait_stats` 를 확인한다. SQL Server는 CPU 외에 다른 자원을 기다릴 때마다 대기 유형을 기록한다. 상위 대기 유형을 보면 병목이 CPU인지, IO인지, 잠금인지 한눈에 드러난다.

```sql
-- 대기 유형 상위 10개 (관심 없는 유휴 대기 제외)
SELECT TOP 10
       wait_type,
       waiting_tasks_count,
       wait_time_ms / 1000.0        AS total_wait_sec,
       max_wait_time_ms / 1000.0    AS max_wait_sec,
       wait_time_ms * 100.0 / SUM(wait_time_ms)
         OVER ()                    AS pct
FROM   sys.dm_os_wait_stats
WHERE  wait_type NOT IN (
         'SLEEP_TASK','BROKER_TO_FLUSH','HADR_WORK_QUEUE',
         'CLR_AUTO_EVENT','DISPATCHER_QUEUE_SEMAPHORE',
         'REQUEST_FOR_DEADLOCK_SEARCH','LOGMGR_QUEUE',
         'CHECKPOINT_QUEUE','DBMIRROR_EVENTS_QUEUE'
       )
ORDER  BY wait_time_ms DESC;
```

**PAGEIOLATCH**: 디스크 IO 대기 → 인덱스 부재 또는 IO 서브시스템 포화  
**LCK_M_X / LCK_M_S**: 잠금 대기 → 블로킹 체인 조사 필요  
**RESOURCE_SEMAPHORE**: 메모리 부여 대기 → 쿼리별 메모리 사용량 확인  
**SOS_SCHEDULER_YIELD**: CPU 경쟁 → CPU 집약적 쿼리 파악

![실전 DMV 진단 쿼리 패턴](/assets/posts/mssql-dmv-diagnostics-queries.svg)

## CPU 과부하: 상위 쿼리 추출

```sql
-- CPU 누적 상위 쿼리 (재시작 이후 집계)
SELECT TOP 20
       qs.total_worker_time / 1000        AS total_cpu_ms,
       qs.execution_count                 AS exec_cnt,
       qs.total_worker_time / qs.execution_count / 1000
                                          AS avg_cpu_ms,
       qs.total_logical_reads             AS total_reads,
       SUBSTRING(st.text, (qs.statement_start_offset/2)+1,
         ((CASE qs.statement_end_offset
             WHEN -1 THEN DATALENGTH(st.text)
             ELSE qs.statement_end_offset END
           - qs.statement_start_offset)/2)+1) AS sql_text
FROM   sys.dm_exec_query_stats qs
       CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER  BY qs.total_worker_time DESC;
```

## 블로킹 체인 추적

```sql
-- 현재 블로킹 세션과 원인 SQL
SELECT r.session_id,
       r.blocking_session_id   AS blocked_by,
       r.wait_type,
       r.wait_time / 1000      AS wait_sec,
       r.status,
       SUBSTRING(st.text, 1, 100) AS current_sql,
       s.login_name,  s.program_name
FROM   sys.dm_exec_requests r
JOIN   sys.dm_exec_sessions  s ON s.session_id = r.session_id
       CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
WHERE  r.blocking_session_id > 0
ORDER  BY r.wait_time DESC;
```

블로킹 체인의 루트(다른 세션에 의해 블로킹되지 않지만 자신이 블로킹하는 세션)를 찾아야 한다. 루트 세션의 `session_id`로 `sys.dm_exec_sessions`에서 연결 정보와 최근 SQL을 확인한다.

## 누락 인덱스 추천

```sql
-- 인덱스 추가 시 예상 개선률 상위 20개
SELECT TOP 20
       ROUND(migs.avg_user_impact, 0) AS impact_pct,
       migs.user_seeks + migs.user_scans AS usage,
       mid.statement              AS table_name,
       mid.equality_columns,
       mid.inequality_columns,
       mid.included_columns
FROM   sys.dm_db_missing_index_group_stats migs
JOIN   sys.dm_db_missing_index_groups      mig  ON mig.index_group_handle = migs.group_handle
JOIN   sys.dm_db_missing_index_details     mid  ON mid.index_handle       = mig.index_handle
ORDER  BY migs.avg_user_impact * (migs.user_seeks + migs.user_scans) DESC;
```

`avg_user_impact`가 높고 `usage`가 많은 항목부터 인덱스를 추가한다. DMV 추천을 맹목적으로 적용하면 인덱스 과잉이 발생할 수 있으므로, 기존 인덱스와 중복 여부를 반드시 확인한다.

## IO 병목: 파일별 통계

```sql
-- 데이터·로그 파일별 IO 대기
SELECT DB_NAME(vfs.database_id)   AS db_name,
       mf.physical_name,
       vfs.io_stall_read_ms  / NULLIF(vfs.num_of_reads, 0)  AS avg_read_ms,
       vfs.io_stall_write_ms / NULLIF(vfs.num_of_writes, 0) AS avg_write_ms,
       vfs.io_stall           AS total_stall_ms
FROM   sys.dm_io_virtual_file_stats(NULL, NULL) vfs
JOIN   sys.master_files mf ON mf.database_id = vfs.database_id
                           AND mf.file_id    = vfs.file_id
ORDER  BY vfs.io_stall DESC;
```

평균 읽기 대기가 20ms 이상이면 IO 서브시스템에 문제가 있거나 인덱스 부재로 과다 읽기가 발생하는 것이다.

## 정리

DMV 진단의 기본 흐름은 대기 통계 → 상위 쿼리 → 블로킹 → IO → 메모리 순서다. 문제가 반복된다면 Query Store와 연계해 시계열 데이터를 축적하고, Extended Events로 더 세밀한 이벤트를 캡처하는 단계로 나아간다.

---

**지난 글:** [SQL Server 복제 유형 — Snapshot · Transactional · Merge · P2P](/posts/mssql-replication-types/)

**다음 글:** [SQL Server 파티셔닝 — Sliding Window 패턴](/posts/mssql-partitioning-sliding-window/)

<br>
읽어주셔서 감사합니다. 😊
