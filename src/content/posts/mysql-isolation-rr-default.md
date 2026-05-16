---
title: "MySQL REPEATABLE READ — 기본 격리 수준과 Gap Lock"
description: "MySQL InnoDB의 기본 격리 수준인 REPEATABLE READ가 MVCC와 Gap Lock을 결합해 팬텀 읽기를 방지하는 방법, 4가지 격리 수준 비교, 그리고 PostgreSQL 기본 격리 수준과의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 20
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "격리수준", "repeatable-read", "gap-lock", "next-key-lock", "mvcc"]
featured: false
draft: false
---

[지난 글](/posts/mysql-innodb-mvcc/)에서 InnoDB MVCC의 버전 체인과 ReadView가 어떻게 동작하는지 살펴봤습니다. 이번 글에서는 MySQL이 REPEATABLE READ를 기본 격리 수준으로 선택한 이유, 그리고 이를 구현하는 **MVCC + Gap Lock** 조합을 다룹니다.

## 4가지 격리 수준

SQL 표준은 동시성 이상 현상과 격리 수준을 정의합니다.

| 이상 현상 | 내용 |
|-----------|------|
| **Dirty Read** | 커밋되지 않은 데이터를 읽는 현상 |
| **Non-Repeatable Read** | 같은 트랜잭션에서 같은 행을 두 번 읽으면 값이 다름 |
| **Phantom Read** | 같은 범위 쿼리를 두 번 실행하면 행 수가 달라짐 |

![MySQL InnoDB — 격리 수준과 현상](/assets/posts/mysql-isolation-rr-default-levels.svg)

MySQL InnoDB의 기본 격리 수준은 **REPEATABLE READ**입니다. SQL 표준에 따르면 RR에서 팬텀 읽기가 허용되지만, InnoDB는 **Gap Lock**을 추가해 팬텀도 방지합니다.

## 격리 수준 설정

```sql
-- 현재 세션 격리 수준 확인
SELECT @@transaction_isolation;  -- MySQL 8.0+
SELECT @@tx_isolation;           -- 구 버전

-- 세션 변경
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 글로벌 변경 (my.cnf 설정 후 재시작 또는 런타임)
SET GLOBAL TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- my.cnf: transaction_isolation = READ-COMMITTED
```

실무에서 MySQL의 격리 수준을 **READ COMMITTED**로 낮추는 경우가 있습니다. Gap Lock이 줄어들어 데드락 발생 가능성이 낮아지기 때문입니다. 대신 팬텀 읽기를 애플리케이션에서 허용할 수 있어야 하고, `binlog_format=ROW`이어야 합니다(RC에서 STATEMENT 바이너리 로그는 안전하지 않음).

## REPEATABLE READ와 MVCC

RR에서 InnoDB는 트랜잭션 시작(BEGIN 또는 첫 번째 SELECT) 시 ReadView를 생성하고 트랜잭션 종료까지 유지합니다.

```sql
START TRANSACTION;

-- ReadView 생성 (현재 커밋된 상태의 스냅샷)
SELECT balance FROM accounts WHERE id = 1;  -- 1000 반환

-- 다른 트랜잭션이 UPDATE ... COMMIT 했다고 해도
SELECT balance FROM accounts WHERE id = 1;  -- 여전히 1000
-- RR: 동일 ReadView를 재사용하므로 Non-Repeatable Read 없음

COMMIT;  -- ReadView 해제
```

일반 SELECT는 MVCC 스냅샷을 사용합니다. 커밋된 다른 트랜잭션의 변경도 내 ReadView 생성 이후라면 보이지 않습니다.

## Gap Lock과 Next-Key Lock

SQL 표준상 RR은 팬텀 읽기를 허용합니다. 하지만 InnoDB는 **Gap Lock**으로 팬텀도 차단합니다.

![RR에서 Phantom Read를 막는 Gap Lock](/assets/posts/mysql-isolation-rr-default-gaplock.svg)

```sql
-- TRX A: 범위 조회 (Locking Read)
SELECT * FROM orders WHERE id BETWEEN 10 AND 15 FOR UPDATE;
-- id=10, id=15에 Record Lock
-- id=10 이전 갭, id=10~15 사이 갭, id=15 이후 갭에 Gap Lock

-- TRX B: 갭 안에 삽입 시도 → 대기
INSERT INTO orders (id, ...) VALUES (12, ...);  -- Gap Lock에 의해 블록
```

Gap Lock의 특성:
- **INSERT를 막습니다.** 기존 레코드의 UPDATE/DELETE는 Gap Lock과 무관합니다.
- **다른 Gap Lock과 충돌하지 않습니다.** 두 트랜잭션이 동일 갭에 Gap Lock을 잡아도 서로 호환됩니다.
- **Next-Key Lock**은 해당 레코드 + 왼쪽 갭의 조합입니다. InnoDB의 기본 잠금 단위입니다.

Gap Lock은 팬텀 읽기를 막지만, **데드락 가능성을 높입니다.** 두 트랜잭션이 서로의 갭에 삽입을 시도하면 교착 상태가 됩니다.

## REPEATABLE READ가 기본인 이유

MySQL이 RR을 기본으로 선택한 이유는 **STATEMENT 기반 바이너리 로그**와의 관계입니다. STATEMENT 바이너리 로그는 실행된 SQL을 그대로 기록합니다. Slave에서 같은 SQL을 재실행할 때 Master와 동일한 결과가 나와야 합니다.

RC에서는 Non-Repeatable Read가 발생하므로, 같은 SQL이 다른 결과를 낼 수 있어 복제 불일치 위험이 있습니다. RR은 트랜잭션 내 결과가 일관되므로 STATEMENT 복제가 더 안전합니다.

현대 MySQL에서는 `binlog_format=ROW`가 권장됩니다. ROW 방식은 변경된 행 데이터를 기록하므로 격리 수준과 독립적입니다. 이 경우 RC로 변경해도 복제 안전성이 유지됩니다.

## PostgreSQL과의 비교

PostgreSQL의 기본 격리 수준은 **READ COMMITTED**입니다. PostgreSQL의 RR은 SQL 표준보다 강한 Snapshot Isolation에 가깝고, Gap Lock 없이 MVCC만으로 구현합니다. 팬텀은 SSI(Serializable Snapshot Isolation) 격리 수준에서 방지합니다.

MySQL의 RR은 Gap Lock으로 팬텀을 방지하지만 데드락 위험이 있고, PostgreSQL의 RR은 Gap Lock 없이 MVCC로만 처리하지만 write skew 이상이 발생할 수 있습니다. 두 접근 방식은 각각 트레이드오프가 다릅니다.

```sql
-- 격리 수준 확인 (어느 RDBMS든)
-- MySQL
SELECT @@transaction_isolation;

-- PostgreSQL
SHOW TRANSACTION ISOLATION LEVEL;
SHOW default_transaction_isolation;
```

---

**지난 글:** [MySQL InnoDB MVCC — 버전 체인과 ReadView](/posts/mysql-innodb-mvcc/)

<br>
읽어주셔서 감사합니다. 😊
