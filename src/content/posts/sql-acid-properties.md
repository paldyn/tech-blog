---
title: "ACID 속성 완전 이해"
description: "트랜잭션의 Atomicity(원자성), Consistency(일관성), Isolation(격리성), Durability(지속성) 각각의 의미, 구현 메커니즘, 실무 함의를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "acid", "transaction", "atomicity", "consistency", "isolation", "durability", "undo-log", "redo-log", "wal"]
featured: false
draft: false
---

[지난 글](/posts/sql-pivot-unpivot-pattern/)에서 PIVOT · UNPIVOT 패턴을 살펴봤다. 이번에는 트랜잭션의 근간을 이루는 **ACID** 속성—원자성·일관성·격리성·지속성—의 의미와 구현 원리를 정리한다.

---

## 트랜잭션이란

트랜잭션(Transaction)은 **하나의 논리적 작업 단위**다. 여러 SQL 문을 묶어 하나처럼 처리하며, 중간에 실패하면 전체를 취소하거나 전체를 완료해야 한다.

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 10000 WHERE id = 1;  -- 출금
  UPDATE accounts SET balance = balance + 10000 WHERE id = 2;  -- 입금
COMMIT;
```

위 예시에서 출금은 성공했지만 입금이 실패하면 돈이 공중으로 사라진다. 이런 상황을 방지하기 위해 ACID가 필요하다.

---

## A — Atomicity (원자성)

**트랜잭션 내 모든 작업은 전부 성공하거나 전부 실패해야 한다.**

![ACID 속성 개요](/assets/posts/sql-acid-properties-overview.svg)

```sql
BEGIN;
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
-- 만약 이 시점에 프로세스 죽으면?
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;
```

DB는 커밋되지 않은 변경 사항을 **Undo Log(롤백 세그먼트)**에 기록한다. 장애 발생 시 DB는 재시작 후 Undo Log를 사용해 커밋되지 않은 변경을 자동으로 되돌린다.

- `COMMIT` → 변경 영구 반영
- `ROLLBACK` 또는 오류 → Undo Log로 전체 취소

---

## C — Consistency (일관성)

**트랜잭션 실행 전후로 DB는 항상 정의된 제약(Constraints)을 만족해야 한다.**

```sql
BEGIN;
-- balance가 음수가 되면 CHECK 제약 위반
UPDATE accounts SET balance = balance - 999999
WHERE id = 1;  -- 잔액 1000원인 계좌
-- ERROR: violates check constraint "balance_positive"
ROLLBACK;  -- 자동 롤백 (트랜잭션 중단)
```

일관성을 보장하는 DB 메커니즘: `PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL`, `CHECK`, `UNIQUE`. C는 ACID 중 유일하게 **애플리케이션 설계 책임**도 포함한다—DB 제약이 없더라도 비즈니스 규칙(예: 총 재고 수량이 음수 불가)을 애플리케이션에서 보장해야 한다.

---

## I — Isolation (격리성)

**동시에 실행되는 트랜잭션들은 서로의 중간 상태를 볼 수 없어야 한다.**

```sql
-- Tx1: 잔액 조회 중        -- Tx2: 이체 중 (커밋 전)
BEGIN;                       BEGIN;
SELECT balance FROM accounts  UPDATE accounts
WHERE id = 1;                SET balance = balance - 100
-- 여기서 Tx2가 변경 중      WHERE id = 1;
-- Tx1은 변경 전 값을 봐야 함
COMMIT;                       COMMIT;
```

완벽한 격리는 직렬 실행(SERIALIZABLE)이지만 성능이 나쁘다. 실무에서는 격리 수준을 선택해 **정확성과 성능을 교환**한다. 격리 구현 방식은 다음 글에서 자세히 다룬다.

- 잠금 기반(2PL): 읽기·쓰기 잠금으로 동시성 제어
- MVCC: 스냅샷을 이용해 잠금 없이 읽기 허용

---

## D — Durability (지속성)

**COMMIT된 트랜잭션 결과는 시스템 장애 후에도 영구 보존된다.**

구현의 핵심은 **Write-Ahead Log(WAL)** 또는 **Redo Log**다.

```
COMMIT 처리 순서:
1. 변경 내용을 Redo Log에 기록 (디스크 flush)
2. "이 트랜잭션은 커밋됨"을 로그에 표시
3. 실제 데이터 파일은 나중에 비동기로 반영 (checkpoint)

장애 복구:
재시작 → Redo Log 스캔 → 커밋됐지만 데이터 파일에 없는 것 재수행
```

![ACID 계좌 이체 코드 예시](/assets/posts/sql-acid-properties-code.svg)

`fsync()`를 비활성화하면 성능이 올라가지만 D가 깨진다. PostgreSQL의 `synchronous_commit = off`, MySQL의 `innodb_flush_log_at_trx_commit = 2` 등은 지속성과 성능을 절충하는 설정이다.

---

## ACID와 BASE

NoSQL 진영에서는 높은 가용성·확장성을 위해 **BASE**(Basically Available, Soft state, Eventually consistent)를 채택하는 경우가 많다. ACID는 강력한 일관성을 보장하지만 단일 DB에 묶이므로 분산 환경에서 완전한 ACID는 성능 비용이 크다.

| 속성 | ACID | BASE |
|------|------|------|
| 일관성 | 즉시 일관성 | 최종 일관성 |
| 가용성 | 제한적 | 높음 |
| 복잡도 | DB 보장 | 애플리케이션 책임 |

---

## 실무 체크리스트

- **자동 커밋 주의**: 대부분의 DB 드라이버는 autocommit=true가 기본. 배치 작업은 명시적 트랜잭션으로 묶어야 원자성을 확보한다.
- **긴 트랜잭션 지양**: 트랜잭션이 길수록 잠금 보유 시간이 길어져 동시성이 감소한다.
- **오류 처리**: `ROLLBACK`을 오류 핸들러에 반드시 포함해야 부분 커밋을 막을 수 있다.

```sql
-- Python 예시: 자동 롤백 보장
try:
    conn.autocommit = False
    cur.execute("UPDATE accounts ...")
    cur.execute("UPDATE accounts ...")
    conn.commit()
except Exception:
    conn.rollback()
    raise
```

---

**지난 글:** [PIVOT · UNPIVOT 패턴](/posts/sql-pivot-unpivot-pattern/)

**다음 글:** [트랜잭션 격리 수준 표준](/posts/sql-isolation-levels-standard/)

<br>
읽어주셔서 감사합니다. 😊
