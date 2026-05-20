---
title: "SQL Server 스케줄러·워커·스레드 모델 — 협력적 스케줄링의 내부"
description: "SQL Server SQLOS의 Scheduler·Worker·Thread 3계층 구조, 협력적 스케줄링 원리, max worker threads 설정, Fiber Mode, 병렬 쿼리 스레드 분배를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "SQLOS", "스케줄러", "Worker", "스레드", "협력적스케줄링", "병렬처리"]
featured: false
draft: false
---

[지난 글](/posts/mssql-sqlos/)에서 SQLOS의 전체 아키텍처와 대기 통계 진단을 살펴봤다. 이번 글에서는 SQLOS의 실행 모델 핵심인 **스케줄러·워커·스레드 3계층**을 깊게 파고든다. 이 구조를 이해하면 CPU 병목이나 스레드 기아(starvation) 문제를 정확히 진단할 수 있다.

## 3계층 실행 모델 복습

SQLOS는 실행 흐름을 세 계층으로 추상화한다.

- **Scheduler**: 논리 CPU(하이퍼스레딩 포함)와 1:1 매핑. 동시에 1개의 Worker만 실행한다
- **Worker**: OS 스레드를 래핑한 실행 컨텍스트. 스레드 풀에서 재사용된다
- **Task**: 쿼리 실행의 최소 단위. 병렬 쿼리면 스케줄러 수만큼 Task가 생성된다

![Scheduler·Worker·Thread 모델](/assets/posts/mssql-scheduler-worker-model.svg)

## Scheduler 종류

`sys.dm_os_schedulers`에는 여러 종류의 스케줄러가 존재한다.

| status | 설명 |
|---|---|
| `ONLINE` | 일반 쿼리 처리용 (CPU 코어당 1개) |
| `ONLINE HIDDEN` | 내부 시스템 태스크용 |
| `DAC` | 관리자 전용 연결(DAC) 스케줄러 |
| `OFFLINE` | 사용 불가 상태 |

```sql
-- 스케줄러 목록 확인
SELECT
    scheduler_id,
    cpu_id,
    parent_node_id AS numa_node,
    status,
    is_online,
    current_tasks_count,
    runnable_tasks_count,   -- 0 이상이면 CPU 포화 신호
    current_workers_count,
    active_workers_count
FROM sys.dm_os_schedulers
ORDER BY scheduler_id;
```

![협력적 vs 선점형 스케줄링](/assets/posts/mssql-scheduler-worker-thread.svg)

## 협력적 스케줄링 — Quantum과 양보

SQLOS 기본 모드는 **협력적(cooperative) 스케줄링**이다. 각 Worker는 자발적으로 CPU를 양보해야 다음 Worker가 실행된다.

**Quantum**: Worker가 한 번에 점유할 수 있는 최대 CPU 시간 = **4밀리초(ms)**

Worker가 CPU를 양보하는 시점:
1. I/O 발생 (페이지 읽기·쓰기)
2. 잠금 대기 (Lock, Latch)
3. 네트워크 전송 대기
4. Quantum 초과 (4ms 이상 CPU 점유)
5. `WAITFOR DELAY` 등 명시적 대기

```sql
-- SQLOS 스케줄러에서 양보 발생 통계
SELECT
    scheduler_id,
    yield_count,            -- 자발적 양보 횟수
    context_switches_count, -- 컨텍스트 스위치 총 수
    preemptive_switches_count -- 강제 선점 횟수
FROM sys.dm_os_schedulers
WHERE status = 'ONLINE';
```

`preemptive_switches_count`가 높으면 SQLOS 외부 코드(CLR, 확장 프로시저, 드라이버)가 OS 선점 모드로 실행 중이라는 신호다.

## max worker threads 설정

Worker는 OS 스레드를 래핑한다. Worker가 필요하면 Free Pool에서 꺼내 재사용하고, Free Pool이 비면 새 스레드를 생성한다. 총 Worker 수는 `max worker threads`로 제한된다.

```sql
-- 현재 설정 확인
EXEC sp_configure 'max worker threads';
-- 기본값: 0 (자동)

-- 자동 계산 공식 (64비트 기준)
-- CPU ≤ 4:  512개
-- CPU ≤ 8:  CPU×64 + 512
-- CPU > 8:  CPU×32 + 512 (최대 2048)

-- 수동 설정 예시 (32코어 서버, 권장값 예시)
EXEC sp_configure 'max worker threads', 0;  -- 일반적으로 0(자동) 권장
RECONFIGURE;
```

Worker 부족 시 새 연결 요청이 큐에 쌓이고, 큐가 가득 차면 오류가 발생한다. `sys.dm_os_workers`로 현황을 파악한다.

```sql
-- Worker 상태별 집계
SELECT
    state,          -- INIT, RUNNING, RUNNABLE, SUSPENDED, DONE
    COUNT(*) AS cnt
FROM sys.dm_os_workers
GROUP BY state;

-- 오랫동안 실행 중인 Worker 탐지
SELECT
    w.state,
    w.worker_address,
    t.session_id,
    r.command,
    r.status,
    r.wait_type,
    DATEDIFF(ms, w.last_wait_type_stopwatch, GETDATE()) AS running_ms
FROM sys.dm_os_workers w
LEFT JOIN sys.dm_os_tasks t ON w.task_address = t.task_address
LEFT JOIN sys.dm_exec_requests r ON t.session_id = r.session_id
WHERE w.state = 'RUNNING'
ORDER BY running_ms DESC;
```

## 병렬 쿼리와 스레드 분배

병렬 쿼리(Parallel Plan)는 여러 Task를 생성해 각 스케줄러에 분배한다. MAXDOP(Max Degree of Parallelism)가 병렬 스레드 수를 제한한다.

```sql
-- 인스턴스 기본 MAXDOP
EXEC sp_configure 'max degree of parallelism';

-- SQL Server 2019+: 인스턴스 MAXDOP 기본값 가이드라인
-- NUMA 노드당 CPU ≤ 8: MAXDOP = CPU 수
-- NUMA 노드당 CPU > 8: MAXDOP = 8
-- 하이퍼스레딩: 물리 코어 수 이하로 제한 권장

-- 쿼리 힌트로 즉시 적용
SELECT /*+ MAXDOP(4) */
    customer_id, SUM(amount) AS total
FROM orders
GROUP BY customer_id;

-- SQL Server 2022+ 구문
SELECT customer_id, SUM(amount) AS total
FROM orders
GROUP BY customer_id
OPTION (MAXDOP 4);
```

병렬 쿼리에서 `CXPACKET` 대기가 많이 발생하면 가장 느린 스레드(runt thread)를 기다리는 것이다. `CXCONSUMER`와 `CXPACKET`를 구분해서 분석하는 것이 중요하다.

```sql
-- 병렬 쿼리 스레드별 실행 현황
SELECT
    session_id,
    request_id,
    exec_context_id,    -- 0 = 코디네이터, 1+ = 병렬 워커
    scheduler_id,
    cpu_time,
    logical_reads
FROM sys.dm_os_tasks
WHERE session_id IN (
    SELECT session_id FROM sys.dm_exec_requests
    WHERE parallel_worker_count > 0
)
ORDER BY session_id, exec_context_id;
```

## Thread Starvation 진단

`runnable_tasks_count`가 지속적으로 높거나, 특정 스케줄러만 편중되면 스레드 기아 또는 CPU 불균형이 발생한 것이다.

```sql
-- CPU 불균형 탐지 (스케줄러별 부하)
SELECT
    scheduler_id,
    cpu_id,
    runnable_tasks_count,
    current_tasks_count,
    work_queue_count
FROM sys.dm_os_schedulers
WHERE status = 'ONLINE'
  AND runnable_tasks_count > 2
ORDER BY runnable_tasks_count DESC;
```

해결책:
- **MAXDOP 조정**: 과도한 병렬 쿼리가 스레드 독점 시 MAXDOP 감소
- **Resource Governor**: 워크로드 그룹별 CPU 쿼터 설정
- **max worker threads**: 과도하게 낮게 설정된 경우 증가

다음 글에서는 SQL Server 메모리 관리의 핵심인 **버퍼 풀과 플랜 캐시**를 살펴본다.

---

**지난 글:** [SQL Server SQLOS — 운영체제 추상화 계층 완전 가이드](/posts/mssql-sqlos/)

**다음 글:** [SQL Server 버퍼 풀과 플랜 캐시](/posts/mssql-buffer-pool-plan-cache/)

<br>
읽어주셔서 감사합니다. 😊
