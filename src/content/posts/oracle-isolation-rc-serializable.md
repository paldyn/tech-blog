---
title: "Oracle 격리 수준: Read Committed와 Serializable"
description: "Oracle이 지원하는 두 가지 트랜잭션 격리 수준(Read Committed, Serializable)의 동작 방식과 Snapshot Too Old, ORA-08177 오류를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["oracle", "isolation-level", "read-committed", "serializable", "mvcc", "scn", "ora-08177", "phantom-read", "dirty-read"]
featured: false
draft: false
---

[지난 글](/posts/oracle-mvcc-implementation/)에서 Oracle의 MVCC 구현 내부를 살펴봤다. MVCC 위에서 Oracle은 표준 SQL의 격리 수준을 어떻게 지원하는가. Oracle은 표준 4단계 중 **Read Committed**와 **Serializable** 두 수준만 지원하며, 나머지는 구조적으로 불가능하거나 필요하지 않다.

## Oracle이 지원하는 격리 수준

![Oracle 격리 수준 비교](/assets/posts/oracle-isolation-rc-serializable-levels.svg)

### READ UNCOMMITTED — Oracle은 지원하지 않는다

표준 SQL에서 가장 낮은 격리 수준인 READ UNCOMMITTED는 커밋되지 않은 데이터를 읽는 것을 허용한다(Dirty Read). Oracle의 MVCC 구조는 Current Block(커밋된 최신 버전)을 기반으로 동작하므로, 구조적으로 Dirty Read가 발생하지 않는다. 설사 지정하려 해도 Oracle은 이를 READ COMMITTED로 처리한다.

### REPEATABLE READ — 별도 지원 없음

Oracle은 REPEATABLE READ도 별도로 지원하지 않는다. SERIALIZABLE이 유사한 수준 이상의 보장을 제공하므로 실용상 문제가 없다.

---

## Read Committed (기본값)

```sql
-- 현재 세션의 격리 수준 확인
SELECT s.sid, t.isolation_level
FROM   v$transaction t
JOIN   v$session s ON t.ses_addr = s.saddr
WHERE  s.sid = SYS_CONTEXT('USERENV', 'SID');
```

Oracle의 기본 격리 수준이다. **각 SQL 문장이 시작될 때 SCN을 고정**하고 해당 SCN 기준으로 읽기를 수행한다.

특성:
- **Dirty Read 방지**: MVCC로 구조적 방지
- **Non-Repeatable Read 발생 가능**: 같은 트랜잭션에서 같은 행을 두 번 읽으면 다른 값이 나올 수 있다(첫 번째 SELECT 이후 다른 트랜잭션이 커밋)
- **Phantom Read 발생 가능**: 같은 범위 조건으로 두 번 SELECT하면 행 수가 다를 수 있다

OLTP 환경 대부분에서 READ COMMITTED는 충분한 일관성을 제공하면서 동시성을 극대화한다.

---

## Serializable

```sql
-- 트랜잭션 시작 시 Serializable 설정
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 또는 세션 전체에 적용
ALTER SESSION SET ISOLATION_LEVEL = SERIALIZABLE;
```

Serializable 격리 수준에서는 **트랜잭션이 시작될 때 SCN을 고정**한다. 이후 트랜잭션이 종료될 때까지 모든 읽기가 동일 SCN 기준으로 수행된다.

특성:
- **Dirty Read, Non-Repeatable Read, Phantom Read 모두 방지**
- 트랜잭션 동안 다른 세션의 커밋이 보이지 않는다
- **ORA-08177: Can't serialize access** 위험: 다른 트랜잭션이 변경한 행을 UPDATE하려 할 때 발생

---

## ORA-08177: Serialization Failure

Serializable 격리 수준에서 트랜잭션 A가 읽은 행을 트랜잭션 B가 먼저 수정·커밋했다면, 트랜잭션 A가 해당 행을 UPDATE하려 할 때 `ORA-08177`이 발생한다.

```
ORA-08177: can't serialize access for this transaction
```

이는 이상 현상이 아니라 **직렬화 가능성을 보장하기 위한 의도적 오류**다. 애플리케이션은 이 오류를 잡아 재시도하도록 설계해야 한다.

![격리 수준 설정 및 Serialization Failure 처리](/assets/posts/oracle-isolation-rc-serializable-code.svg)

---

## 실용 지침

| 사용 상황 | 권장 격리 수준 |
|-----------|--------------|
| 일반 OLTP | Read Committed |
| 보고서 생성 (일관된 집계) | Serializable 또는 SET TRANSACTION READ ONLY |
| 배치 업데이트 | Read Committed + 명시적 잠금 |
| 재무/회계 (강한 일관성) | Serializable (재시도 로직 필수) |

```sql
-- 격리 수준에 관계없이 특정 행 잠금
SELECT * FROM orders
WHERE  order_id = 100
FOR UPDATE;

-- 잠금 없이 즉시 반환 (행이 이미 잠겨있으면 건너뜀)
SELECT * FROM orders
FOR UPDATE SKIP LOCKED;
```

Serializable을 선택하면 재시도 로직 구현이 필수적이다. ORA-08177이 자주 발생하면 동시성이 낮아지고 처리량이 감소한다.

---

## Read Only 트랜잭션

Serializable과 유사하게 트랜잭션 시작 SCN을 고정하지만, **DML(INSERT/UPDATE/DELETE)이 불가능**하다. 보고서나 분석 쿼리에서 일관된 다중 문장 읽기에 적합하다.

```sql
SET TRANSACTION READ ONLY;

SELECT COUNT(*) FROM orders WHERE created_date = TRUNC(SYSDATE);
SELECT SUM(amount) FROM orders WHERE created_date = TRUNC(SYSDATE);

COMMIT; -- READ ONLY 트랜잭션 종료
```

두 SELECT는 동일 SCN 기준으로 실행되어 항상 일관된 집계를 반환한다.

---

**지난 글:** [Oracle MVCC 구현](/posts/oracle-mvcc-implementation/)

**다음 글:** [Oracle 잠금 메커니즘](/posts/oracle-lock-mechanism/)

<br>
읽어주셔서 감사합니다. 😊
