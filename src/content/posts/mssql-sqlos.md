---
title: "SQL Server SQLOS — 운영체제 추상화 계층 완전 가이드"
description: "SQL Server SQLOS의 역할, Task·Worker·Scheduler 3계층 모델, 메모리 관리, I/O 서브시스템, NUMA 인식, 대기 통계 진단 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "SQLOS", "스케줄러", "Worker", "Task", "대기통계", "DMV"]
featured: false
draft: false
---

[지난 글](/posts/mariadb-system-versioning/)에서 MariaDB의 시간 여행 쿼리를 살펴봤다. 이번 글부터는 SQL Server(MSSQL) 시리즈를 시작한다. 첫 번째 주제는 SQL Server 내부에서 운영체제 역할을 수행하는 **SQLOS**다.

## SQLOS란

SQLOS(SQL Server Operating System)는 SQL Server 7.0부터 내장된 경량 운영체제 추상화 계층이다. Windows 커널 위에서 동작하지만 스케줄링, 메모리 관리, I/O, 동기화를 SQL Server가 직접 제어한다. SQL Server가 OS에 의존하지 않고 독자적인 자원 관리를 수행하는 이유다.

SQLOS가 관리하는 핵심 기능:
- **스케줄러(UMS)**: 논리 CPU마다 스케줄러 생성, 협력적 멀티태스킹
- **메모리**: Buffer Pool, MemClerk별 메모리 청크 관리
- **I/O**: Completion Port 기반 비동기 I/O 큐
- **동기화**: Latch, Spinlock, Mutex 등 내부 잠금 오브젝트

![SQLOS 아키텍처](/assets/posts/mssql-sqlos-architecture.svg)

## Task · Worker · Scheduler 3계층

SQLOS의 실행 모델은 세 계층으로 이루어진다.

| 계층 | 설명 | DMV |
|---|---|---|
| **Task** | 쿼리 실행 단위. 병렬 쿼리면 여러 Task 생성 | `sys.dm_os_tasks` |
| **Worker** | OS 스레드를 래핑한 실행 컨텍스트 | `sys.dm_os_workers` |
| **Scheduler** | 논리 CPU 1:1 매핑. 한 번에 하나의 Worker만 실행 | `sys.dm_os_schedulers` |

Task가 실행되려면 Worker에 배정되고, Worker는 Scheduler 위에서 실행된다.

![Task·Worker·Scheduler 상태](/assets/posts/mssql-sqlos-components.svg)

## 협력적 스케줄링 (Cooperative Scheduling)

SQLOS는 선점형(preemptive)이 아닌 **협력적(cooperative)** 스케줄링을 기본으로 사용한다. Worker가 자발적으로 CPU를 양보해야 다음 Worker가 실행된다.

양보 시점:
- 페이지 I/O 대기
- 네트워크 전송 대기
- 잠금 대기 (Lock/Latch)
- 배치 경계(quantum 초과: 기본 4ms)

```sql
-- 스케줄러별 상태 확인
SELECT
    scheduler_id,
    cpu_id,
    status,
    is_online,
    current_tasks_count,        -- 현재 실행 중인 태스크 수
    runnable_tasks_count,       -- 실행 대기 중인 태스크 수 (높으면 CPU 병목)
    current_workers_count,
    work_queue_count,           -- 배정 대기 태스크 수
    pending_disk_io_count       -- 완료 대기 중인 디스크 I/O 수
FROM sys.dm_os_schedulers
WHERE status = 'ONLINE'
ORDER BY scheduler_id;
```

`runnable_tasks_count`가 지속적으로 0보다 크면 CPU 경합이 발생 중이라는 신호다.

## 메모리 관리 — MemClerk

SQLOS는 메모리를 `MemClerk(Memory Clerk)` 단위로 관리한다. 각 컴포넌트(Buffer Pool, 플랜 캐시, 정렬 버퍼 등)가 개별 MemClerk를 가진다.

```sql
-- 메모리 사용량 상위 컴포넌트
SELECT TOP 15
    type AS clerk_type,
    name,
    pages_kb / 1024 AS used_mb,
    virtual_memory_reserved_kb / 1024 AS vm_reserved_mb
FROM sys.dm_os_memory_clerks
ORDER BY pages_kb DESC;

-- Buffer Pool 총 크기
SELECT
    physical_memory_in_use_kb / 1024 AS physical_mb,
    page_fault_count,
    memory_utilization_percentage
FROM sys.dm_os_process_memory;
```

## I/O 서브시스템

SQLOS는 Windows I/O Completion Port를 사용해 비동기 I/O를 처리한다. Worker가 I/O를 요청하면 즉시 `SUSPENDED` 상태로 전환하고 Scheduler는 다른 Worker를 실행한다. I/O가 완료되면 Completion Port가 Worker를 `RUNNABLE` 큐에 추가한다.

```sql
-- I/O 대기 파일별 통계
SELECT
    DB_NAME(vfs.database_id) AS db_name,
    mf.physical_name,
    vfs.io_stall_read_ms,
    vfs.io_stall_write_ms,
    vfs.num_of_reads,
    vfs.num_of_writes,
    vfs.io_stall_read_ms / NULLIF(vfs.num_of_reads,0) AS avg_read_ms,
    vfs.io_stall_write_ms / NULLIF(vfs.num_of_writes,0) AS avg_write_ms
FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs
JOIN sys.master_files mf
  ON vfs.database_id = mf.database_id
 AND vfs.file_id     = mf.file_id
ORDER BY vfs.io_stall_read_ms + vfs.io_stall_write_ms DESC;
```

읽기 평균 대기가 20ms, 쓰기 평균 대기가 30ms 이상이면 스토리지 성능 검토가 필요하다.

## NUMA 인식

SQL Server 2005+부터 NUMA(Non-Uniform Memory Access) 토폴로지를 인식한다. 각 NUMA 노드에 독립적인 스케줄러 그룹과 Buffer Pool 파티션을 배치해 크로스 NUMA 메모리 접근을 최소화한다.

```sql
-- NUMA 노드별 스케줄러 분포
SELECT
    parent_node_id AS numa_node,
    COUNT(*) AS scheduler_count
FROM sys.dm_os_schedulers
WHERE status = 'ONLINE'
GROUP BY parent_node_id
ORDER BY parent_node_id;

-- Soft-NUMA 설정 (SQL Server 2016+, 자동 소프트 NUMA)
-- 하나의 NUMA 노드에 CPU가 8개 이상이면 자동으로 분할
SELECT name, value_in_use
FROM sys.configurations
WHERE name = 'automatic soft-NUMA disabled';
```

## 대기 통계 진단

SQL Server 성능 진단의 핵심은 **대기 통계(Wait Statistics)**다. 모든 병목은 `sys.dm_os_wait_stats`에 누적된다.

```sql
-- 누적 대기 통계 (인스턴스 시작 이후 전체)
SELECT TOP 20
    wait_type,
    waiting_tasks_count,
    wait_time_ms,
    max_wait_time_ms,
    signal_wait_time_ms,                        -- CPU 경합 대기
    wait_time_ms - signal_wait_time_ms AS resource_wait_ms
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (                        -- 무해한 백그라운드 대기 제외
    'SLEEP_TASK','LAZYWRITER_SLEEP',
    'SQLTRACE_BUFFER_FLUSH','CLR_AUTO_EVENT',
    'REQUEST_FOR_DEADLOCK_SEARCH','RESOURCE_QUEUE'
)
ORDER BY wait_time_ms DESC;

-- 대기 통계 초기화 (기준선 재설정)
DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR);
```

주요 대기 유형과 의미:

| 대기 유형 | 원인 |
|---|---|
| `CXPACKET` | 병렬 쿼리 스레드 동기화 — `MAXDOP` 조정 고려 |
| `LCK_M_*` | 락 경합 — 트랜잭션 길이·인덱스 확인 |
| `PAGEIOLATCH_*` | 버퍼 풀에 없는 페이지 I/O — 스토리지 성능 확인 |
| `WRITELOG` | 로그 I/O 병목 — 로그 파일 디스크 분리 |
| `SOS_SCHEDULER_YIELD` | CPU 경합 — `runnable_tasks_count` 확인 |
| `RESOURCE_SEMAPHORE` | 쿼리 메모리 그랜트 대기 — 플랜 최적화 |

SQLOS를 이해하면 "왜 느린가"를 추측이 아닌 데이터로 파악할 수 있다. 다음 글에서는 SQLOS 위에서 동작하는 스케줄러·워커·스레드 모델을 더 깊게 살펴본다.

---

**지난 글:** [MariaDB System-Versioned Tables — 시간 여행 쿼리 완전 가이드](/posts/mariadb-system-versioning/)

**다음 글:** [SQL Server 스케줄러·워커·스레드 모델](/posts/mssql-scheduler-worker-thread/)

<br>
읽어주셔서 감사합니다. 😊
