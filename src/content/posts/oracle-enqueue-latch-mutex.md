---
title: "Oracle Enqueue·래치·뮤텍스"
description: "Oracle의 세 가지 직렬화 장치인 Enqueue(행 수준 잠금), 래치(메모리 구조 보호), 뮤텍스(커서 핀)의 동작 원리와 경합 진단법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["oracle", "enqueue", "latch", "mutex", "concurrency", "shared-pool", "cache-buffers-chains", "cursor-pin", "v$latch", "v$mutex-sleep"]
featured: false
draft: false
---

[지난 글](/posts/oracle-lock-mechanism/)에서 Oracle의 잠금 유형(TX, TM, DDL)을 살펴봤다. 이번에는 Oracle이 내부적으로 동시성을 제어하는 세 가지 직렬화 장치, **Enqueue·래치·뮤텍스**의 동작 원리와 경합 시 진단 방법을 다룬다.

## 세 가지 직렬화 장치

Oracle은 목적과 범위에 따라 서로 다른 직렬화 메커니즘을 사용한다.

![Enqueue · 래치 · 뮤텍스 비교](/assets/posts/oracle-enqueue-latch-mutex-compare.svg)

---

## Enqueue

**Enqueue**는 사용자가 인식하는 잠금의 내부 구현이다. `v$lock`에서 확인하는 TX, TM, ST 등이 모두 Enqueue다.

Enqueue의 특성:
- **큐 기반 대기**: 잠금을 기다리는 세션들이 순서대로 대기한다
- **OS 수준 sleep**: 대기 중인 세션은 CPU를 소비하지 않는다
- **트랜잭션 생명주기**: 트랜잭션이 COMMIT/ROLLBACK될 때까지 유지된다
- **FIFO 보장**: 먼저 대기한 세션이 먼저 잠금을 획득한다 (일반적으로)

```sql
-- Enqueue 대기 현황
SELECT type, lmode, request, ctime, block, count(*) AS cnt
FROM   v$lock
WHERE  type IN ('TX','TM','ST','HW','CI')
GROUP  BY type, lmode, request, ctime, block
ORDER  BY ctime DESC;
```

---

## 래치 (Latch)

**래치**는 SGA 메모리 구조를 보호하는 단순한 Spin Lock이다. 데이터베이스 내부에서 초당 수만~수십만 번 획득·해제된다.

래치의 특성:
- **Spin 방식**: 잠금 획득 실패 시 CPU를 소비하며 재시도(Spin)한다. 일정 횟수 이상 Spin 실패 시 OS sleep
- **비재진입**: 동일 프로세스가 이미 보유한 래치를 다시 요청하면 데드락 발생
- **매우 짧은 보유 시간**: 래치는 수 마이크로초 단위로 보유하고 즉시 해제

주요 래치 유형:
- **Cache Buffers Chains Latch**: Buffer Cache에서 특정 블록 조회 시 사용. HOT 블록이 있으면 경합이 심해진다
- **Shared Pool Latch**: Shared Pool 메모리 할당·해제 시 사용. Literal SQL 남발 시 경합
- **Redo Allocation Latch**: Redo Log Buffer에 공간 할당 시 사용

```sql
-- 래치 경합 상위 목록
SELECT name, gets, misses, sleeps,
       ROUND(misses * 100 / NULLIF(gets,0), 2) AS miss_pct
FROM   v$latch
WHERE  gets > 0
ORDER  BY sleeps DESC
FETCH FIRST 15 ROWS ONLY;
```

`miss_pct`가 1% 이상이면 경합이 심하다고 본다.

---

## 뮤텍스 (Mutex)

**뮤텍스**는 Oracle 10g 이후 래치의 일부 역할을 대체하도록 도입된 경량 직렬화 장치다. 주로 **Library Cache의 커서 핀**을 보호한다.

뮤텍스가 래치보다 나은 점:
- **더 세밀한 범위**: 개별 커서(SQL)마다 뮤텍스를 갖는다 → 경합 분산
- **메모리 절약**: 래치 구조체보다 훨씬 작다
- **SMP 최적화**: 멀티코어 환경에서 더 효율적

뮤텍스 관련 Wait Event:
- `cursor: pin S wait on X` — 한 세션이 커서를 Hard Parse하는 동안 다른 세션이 Soft Parse를 기다림
- `cursor: mutex X` — 독점 뮤텍스 대기

```sql
-- 뮤텍스 슬립 현황
SELECT mutex_type, location, sleeps, wait_time
FROM   v$mutex_sleep
WHERE  sleeps > 0
ORDER  BY sleeps DESC
FETCH FIRST 10 ROWS ONLY;
```

![래치 및 뮤텍스 경합 진단](/assets/posts/oracle-enqueue-latch-mutex-diag.svg)

---

## 경합 원인과 해법

### Cache Buffers Chains Latch 경합
- **원인**: 동일 블록에 다수 세션이 동시 접근 (HOT block)
- **해법**: 세그먼트 분할, 파티셔닝, 결과 캐싱, 애플리케이션 레벨 캐시

### Shared Pool Latch 경합
- **원인**: Literal SQL(파라미터 없이 값을 직접 기입한 SQL)의 과도한 Hard Parse
- **해법**: 바인드 변수 사용, `cursor_sharing = FORCE` 적용 (임시방편)

### cursor: pin S wait on X
- **원인**: 동일 SQL에 Hard Parse 발생 빈도가 높음
- **해법**: `session_cached_cursors` 증가, 애플리케이션에서 Cursor 재사용

```sql
-- Hard Parse가 많은 SQL 확인
SELECT sql_id, sql_text,
       parse_calls,
       executions,
       ROUND(parse_calls * 100 / NULLIF(executions,0)) AS parse_ratio
FROM   v$sqlstats
WHERE  parse_calls > 1000
ORDER  BY parse_calls DESC
FETCH FIRST 20 ROWS ONLY;
```

---

## AWR에서 래치 경합 확인

AWR(Automatic Workload Repository) 보고서의 **Top 5 Timed Events** 또는 **Latch Activity** 섹션에서 래치 경합을 쉽게 파악할 수 있다.

```sql
-- AWR Latch 통계 (특정 스냅샷 범위)
SELECT l.latch_name, l.gets, l.misses, l.sleeps
FROM   dba_hist_latch l
WHERE  snap_id BETWEEN :start_snap AND :end_snap
AND    l.misses > 0
ORDER  BY l.sleeps DESC
FETCH FIRST 10 ROWS ONLY;
```

---

**지난 글:** [Oracle 잠금 메커니즘](/posts/oracle-lock-mechanism/)

**다음 글:** [Oracle B-Tree 인덱스](/posts/oracle-btree-index/)

<br>
읽어주셔서 감사합니다. 😊
