---
title: "Oracle 잠금 메커니즘"
description: "Oracle의 DML 락(TX·TM), DDL 락, 내부 래치·뮤텍스의 역할과 잠금 경합 진단 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["oracle", "lock", "tx-lock", "tm-lock", "ddl-lock", "latch", "mutex", "row-lock", "contention", "v$lock"]
featured: false
draft: false
---

[지난 글](/posts/oracle-isolation-rc-serializable/)에서 격리 수준이 동시성과 일관성 사이의 트레이드오프를 어떻게 제어하는지 살펴봤다. 격리 수준과 함께 실제 데이터 보호를 담당하는 것이 잠금 메커니즘이다. Oracle의 잠금은 크게 **DML 잠금**, **DDL 잠금**, **내부 잠금(래치·뮤텍스)**으로 나뉜다.

## Oracle 잠금의 핵심 원칙

Oracle에서 가장 중요한 잠금 원칙은 하나다.

> **SELECT는 잠금을 획득하지 않으며, 다른 세션의 잠금에 의해 차단되지도 않는다.**

이 원칙이 MVCC에서 비롯된 Oracle의 가장 강력한 장점이다. SELECT가 UPDATE를 기다리거나, UPDATE가 SELECT를 기다리는 상황은 Oracle에서 발생하지 않는다.

---

## DML 잠금: TX와 TM

![Oracle 잠금 유형 구조](/assets/posts/oracle-lock-mechanism-types.svg)

### TX Lock (Row Lock)

`INSERT`, `UPDATE`, `DELETE`, `SELECT FOR UPDATE`를 실행하면 트랜잭션이 TX 잠금을 획득한다. TX 잠금은 **행 수준**이다.

Oracle은 별도의 잠금 테이블을 유지하지 않는다. 대신 변경된 **데이터 블록의 ITL(Interest Transaction List) 슬롯**에 트랜잭션 정보를 기록하는 방식으로 행 잠금을 구현한다. 이 방식은 잠금 에스컬레이션이 없고, 행 수에 관계없이 잠금 오버헤드가 일정하다.

```sql
-- 활성 TX 잠금 조회
SELECT l.sid, l.type, l.lmode, l.request,
       s.username, s.status, s.sql_id
FROM   v$lock l
JOIN   v$session s ON l.sid = s.sid
WHERE  l.type = 'TX'
ORDER  BY l.lmode DESC;
```

### TM Lock (Table Lock)

DML 문장은 TX 잠금과 함께 테이블 수준의 **TM 잠금**도 자동으로 획득한다. TM 잠금은 DML이 진행 중인 테이블에 충돌하는 DDL이 실행되지 못하도록 막는다.

TM 잠금 모드(숫자가 클수록 배타적):
- `RS(2)`: SELECT FOR UPDATE
- `RX(3)`: INSERT / UPDATE / DELETE
- `S(4)`: LOCK TABLE IN SHARE MODE
- `SRX(5)`: LOCK TABLE IN SHARE ROW EXCLUSIVE MODE
- `X(6)`: DDL 또는 LOCK TABLE IN EXCLUSIVE MODE

---

## DDL 잠금

DDL(`ALTER TABLE`, `CREATE INDEX` 등)을 실행하면 Oracle은 **딕셔너리 잠금**과 **라이브러리 캐시 잠금**을 획득한다.

```sql
-- DDL 잠금 대기 확인
SELECT sid, event, seconds_in_wait, state
FROM   v$session_wait
WHERE  event LIKE 'library cache%'
OR     event LIKE 'enq: TM%';
```

DDL이 오래 대기하는 경우, 해당 테이블에 활성 DML 트랜잭션이 있어 TM 잠금을 획득하지 못한 것이 원인이다.

---

## 잠금 경합 진단

![잠금 경합 세션 진단 쿼리](/assets/posts/oracle-lock-mechanism-diag.svg)

```sql
-- 잠금 보유자와 대기자 매핑
SELECT h.sid    AS holder_sid,
       hs.username,
       hs.sql_id AS holder_sql,
       w.sid    AS waiter_sid,
       ws.username AS waiter_user,
       ws.event,
       ws.seconds_in_wait
FROM   v$lock h
JOIN   v$lock    w  ON h.id1 = w.id1 AND h.id2 = w.id2
JOIN   v$session hs ON h.sid = hs.sid
JOIN   v$session ws ON w.sid = ws.sid
WHERE  h.block = 1   -- 잠금 보유자
AND    w.request > 0 -- 잠금 대기자
ORDER  BY ws.seconds_in_wait DESC;
```

`h.block = 1`이면 해당 세션이 다른 세션을 차단하고 있다는 뜻이다. `ws.seconds_in_wait`가 길다면 즉각 조치가 필요하다.

---

## 잠금 모니터링 뷰 요약

| 뷰 | 내용 |
|----|------|
| `v$lock` | 현재 보유·대기 중인 Enqueue 잠금 |
| `v$session_wait` | 세션별 현재 대기 이벤트 |
| `v$latch` | 래치 획득·경합 누적 통계 |
| `v$latch_children` | 자식 래치별 세부 통계 |
| `v$mutex_sleep` | 뮤텍스 슬립 통계 |
| `dba_blockers` | 현재 다른 세션을 차단하는 세션 |
| `dba_waiters` | 현재 잠금 대기 중인 세션 |

---

## 잠금 해제: KILL SESSION

```sql
-- 보유자 세션을 강제 종료 (DBA 권한 필요)
ALTER SYSTEM KILL SESSION '152,4321' IMMEDIATE;
-- 형식: 'SID,SERIAL#'
```

`IMMEDIATE`를 붙이면 세션이 즉시 롤백되고 리소스를 해제한다. 단, 대규모 트랜잭션은 롤백에 시간이 걸릴 수 있다.

---

**지난 글:** [Oracle 격리 수준: Read Committed와 Serializable](/posts/oracle-isolation-rc-serializable/)

**다음 글:** [Oracle Enqueue·래치·뮤텍스](/posts/oracle-enqueue-latch-mutex/)

<br>
읽어주셔서 감사합니다. 😊
