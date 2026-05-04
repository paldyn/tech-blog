---
title: "데드락의 본질과 해결"
description: "데드락 발생 조건인 순환 대기, DB의 자동 감지·피해자 선택 메커니즘, 잠금 순서 일관화·짧은 트랜잭션·SELECT FOR UPDATE 최소화 예방 전략, DB별 진단 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["sql", "deadlock", "locking", "transaction", "concurrency", "innodb", "postgresql", "prevention", "wait-for-graph"]
featured: false
draft: false
---

[지난 글](/posts/sql-2pl-mvcc-theory/)에서 2PL에서 교착상태가 발생할 수 있다고 언급했다. 이번에는 **데드락(Deadlock)**의 발생 조건, DB의 감지 메커니즘, 예방 전략, 그리고 발생했을 때의 대처 방법을 구체적으로 살펴본다.

---

## 데드락이란

**두 개 이상의 트랜잭션이 서로 상대방이 보유한 잠금을 기다리며 무한히 대기하는 상태**다.

![데드락 순환 대기 다이어그램](/assets/posts/sql-deadlock-essence-cycle.svg)

```
Tx1: Row A 보유 → Row B 요청
Tx2: Row B 보유 → Row A 요청
→ 둘 다 영원히 기다림 = Deadlock
```

---

## 데드락 발생 4가지 조건

Coffman이 정의한 교착상태 필요조건이다. 이 중 하나만 깨도 데드락이 방지된다.

1. **상호 배제(Mutual Exclusion)**: 자원을 한 번에 하나만 점유 가능
2. **점유 대기(Hold and Wait)**: 자원을 보유한 채 다른 자원 대기
3. **비선점(No Preemption)**: 강제로 자원 뺏을 수 없음
4. **순환 대기(Circular Wait)**: T1→T2→T3→T1 형태의 순환 의존

DB에서는 주로 **순환 대기를 제거**하는 방식으로 예방한다.

---

## DB의 데드락 감지 방법

대부분의 RDBMS는 **Wait-For Graph(WFG)**를 주기적으로 분석해 사이클을 감지한다.

```sql
-- PostgreSQL: deadlock_timeout 후 감지 시작 (기본 1초)
-- postgresql.conf
-- deadlock_timeout = 1s
-- log_lock_waits = on  (잠금 대기도 로깅)

-- 현재 잠금 대기 상태 확인 (PostgreSQL)
SELECT
    pid,
    usename,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';
```

사이클이 감지되면 DB는 **비용이 가장 낮은 트랜잭션(또는 가장 최근 트랜잭션)을 피해자(Victim)로 선택**해 롤백한다. 나머지 트랜잭션은 정상 진행된다.

---

## 데드락 진단

![데드락 감지 코드](/assets/posts/sql-deadlock-essence-code.svg)

```sql
-- MySQL InnoDB: 마지막 데드락 상세 정보
SHOW ENGINE INNODB STATUS\G
-- "LATEST DETECTED DEADLOCK" 섹션 확인

-- SQL Server: 데드락 이벤트 추적
-- SQL Server Profiler → Deadlock graph 이벤트
-- 또는 시스템 헬스 세션에서 XML 데드락 그래프 확인
SELECT XDL.deadlock_graph
FROM sys.dm_exec_query_stats;  -- (실제로는 Extended Events 사용)

-- Oracle: v$session에서 잠금 대기 확인
SELECT
    s.sid, s.serial#, s.username,
    s.event, s.seconds_in_wait
FROM v$session s
WHERE s.event LIKE '%lock%';
```

---

## 예방 전략

### 1. 잠금 순서 일관화 (가장 효과적)

항상 동일한 순서로 자원에 접근하면 순환 대기가 불가능하다.

```sql
-- 나쁜 예: Tx1은 1→2, Tx2는 2→1 순서로 잠금
-- 좋은 예: 항상 id 오름차순으로 잠금 획득

-- ORDER BY id로 순서 고정
SELECT * FROM accounts
WHERE id IN (1, 2)
ORDER BY id
FOR UPDATE;
```

### 2. 트랜잭션을 짧게

트랜잭션이 길수록 잠금 보유 시간이 늘어나고 충돌 확률이 증가한다.

```sql
-- 나쁜 예: 트랜잭션 중간에 외부 API 호출
BEGIN;
UPDATE orders SET status = 'processing' WHERE id = 1;
-- 이 사이에 외부 API 호출 (수 초)
UPDATE inventory SET qty = qty - 1;
COMMIT;

-- 좋은 예: 외부 API 호출은 트랜잭션 밖에서
-- 데이터 조회 → 외부 API → 결과로 트랜잭션 (짧게)
```

### 3. 격리 수준 낮추기 (선택적)

READ COMMITTED는 REPEATABLE READ보다 잠금 범위가 좁아 데드락 발생이 줄어든다.

### 4. SELECT FOR UPDATE SKIP LOCKED

```sql
-- 잠긴 행은 건너뛰고 가용한 행만 처리 (큐 패턴)
SELECT id FROM jobs
WHERE status = 'pending'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

---

## 데드락 발생 후 대처

데드락은 완전히 막을 수 없다. 애플리케이션에서 **재시도(Retry) 로직**을 구현해야 한다.

```python
import psycopg2
from psycopg2 import errors
import time

def transfer_with_retry(conn, from_id, to_id, amount, max_retries=3):
    for attempt in range(max_retries):
        try:
            with conn.cursor() as cur:
                cur.execute("BEGIN")
                cur.execute(
                    "UPDATE accounts SET balance = balance - %s WHERE id = %s",
                    (amount, min(from_id, to_id))  # 작은 ID 먼저
                )
                cur.execute(
                    "UPDATE accounts SET balance = balance + %s WHERE id = %s",
                    (amount, max(from_id, to_id))
                )
                cur.execute("COMMIT")
                return  # 성공
        except errors.DeadlockDetected:
            conn.rollback()
            if attempt < max_retries - 1:
                time.sleep(0.1 * (2 ** attempt))  # 지수 백오프
            else:
                raise
```

---

**지난 글:** [2PL과 MVCC 이론](/posts/sql-2pl-mvcc-theory/)

**다음 글:** [SAVEPOINT와 부분 롤백](/posts/sql-savepoint/)

<br>
읽어주셔서 감사합니다. 😊
