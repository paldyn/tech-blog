---
title: "MySQL InnoDB MVCC — 버전 체인과 ReadView"
description: "InnoDB의 MVCC 구현 방식인 숨겨진 컬럼(DB_TRX_ID, DB_ROLL_PTR), Undo Log 버전 체인, ReadView 가시성 판단 알고리즘을 설명합니다. RC와 RR 격리 수준에서 읽기 결과가 달라지는 이유도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 19
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "mvcc", "readview", "undo-log", "격리수준", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/innodb-change-buffer/)에서 InnoDB Change Buffer가 Secondary Index 쓰기를 최적화하는 원리를 살펴봤습니다. 이번에는 InnoDB 동시성의 핵심인 **MVCC(Multi-Version Concurrency Control)** 를 다룹니다. MVCC 덕분에 SELECT는 쓰기 트랜잭션이 있어도 잠금 없이 일관된 스냅샷을 읽을 수 있습니다. Undo Log와 ReadView가 어떻게 협력하는지를 이해하면 MySQL 격리 수준의 동작이 명확해집니다.

## 숨겨진 세 개의 컬럼

InnoDB는 모든 행에 사용자가 보지 못하는 **숨겨진 컬럼**을 추가합니다.

| 컬럼 | 크기 | 역할 |
|------|------|------|
| `DB_TRX_ID` | 6 bytes | 이 행을 마지막으로 수정한 트랜잭션 ID |
| `DB_ROLL_PTR` | 7 bytes | Undo Log의 이전 버전 포인터 (Roll Pointer) |
| `DB_ROW_ID` | 6 bytes | PK가 없을 때 사용하는 내부 ID |

UPDATE가 발생하면:
1. 기존 행의 before image를 Undo Log에 저장
2. `DB_ROLL_PTR`을 새로 생성한 Undo 레코드를 가리키도록 업데이트
3. 행의 값을 새 값으로, `DB_TRX_ID`를 현재 TRX ID로 변경

이렇게 각 행에서 Undo Log를 거슬러 올라가면 모든 이전 버전을 재구성할 수 있습니다. 이것이 **버전 체인**입니다.

![InnoDB MVCC — 숨겨진 컬럼과 버전 체인](/assets/posts/mysql-innodb-mvcc-chain.svg)

## ReadView — 스냅샷의 경계

MVCC 읽기를 수행할 때 InnoDB는 **ReadView**를 생성합니다. ReadView는 "이 시점에 커밋된 버전까지만 보인다"는 경계를 정의합니다.

ReadView는 네 가지 정보를 담습니다.

```
m_ids:         ReadView 생성 시점에 열려 있는 모든 트랜잭션 ID 목록
min_trx_id:    m_ids 중 최솟값 (가장 오래된 열린 트랜잭션)
max_trx_id:    이 ReadView 생성 후 부여될 다음 트랜잭션 ID
creator_trx_id: 이 ReadView를 만든 트랜잭션 ID
```

행의 `DB_TRX_ID`를 보고 다음 규칙으로 가시성을 판단합니다.

```
TRX_ID = creator_trx_id → 내 트랜잭션이 수정 → 볼 수 있음
TRX_ID < min_trx_id     → ReadView 전에 커밋됨 → 볼 수 있음
TRX_ID >= max_trx_id    → ReadView 이후에 시작 → 볼 수 없음
TRX_ID in m_ids         → 아직 열려 있음 → 볼 수 없음
```

볼 수 없으면 `DB_ROLL_PTR`을 따라 Undo Log의 이전 버전을 확인합니다. 볼 수 있는 버전을 만날 때까지 체인을 거슬러 올라갑니다.

## 격리 수준과 ReadView 생성 시점

RC와 RR의 차이는 **ReadView를 언제 만드느냐**에 있습니다.

```sql
-- READ COMMITTED: SELECT마다 새 ReadView 생성
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 1;  -- ReadView 1 생성
-- (다른 트랜잭션이 커밋됨)
SELECT balance FROM accounts WHERE id = 1;  -- ReadView 2 생성 → 커밋된 값 반영

-- REPEATABLE READ (기본값): BEGIN 시 ReadView 생성, 트랜잭션 동안 고정
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;
SELECT balance FROM accounts WHERE id = 1;  -- ReadView 생성 (고정)
-- (다른 트랜잭션이 커밋됨)
SELECT balance FROM accounts WHERE id = 1;  -- 동일 ReadView → 이전 버전 반환
COMMIT;  -- ReadView 해제
```

![MVCC 읽기 시나리오 — RC vs RR](/assets/posts/mysql-innodb-mvcc-readview.svg)

## Locking Read와 MVCC

**Consistent Non-Locking Read**(일반 SELECT)는 MVCC로 처리합니다. 잠금이 없고 Undo Log에서 이전 버전을 읽습니다.

**Locking Read**(`SELECT ... FOR UPDATE`, `SELECT ... FOR SHARE`)는 다릅니다. 최신 버전을 읽고 잠금을 겁니다. MVCC 스냅샷을 무시합니다.

```sql
-- Non-Locking: MVCC 스냅샷 읽기 (잠금 없음)
SELECT * FROM accounts WHERE id = 1;

-- Locking: 최신 버전 + 잠금
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;     -- X Lock
SELECT * FROM accounts WHERE id = 1 FOR SHARE;      -- S Lock
SELECT * FROM accounts WHERE id = 1 LOCK IN SHARE MODE; -- S Lock (구문법)
```

## Undo Log 정리 (Purge)

MVCC 버전 체인이 길어질수록 오래된 Undo 레코드가 쌓입니다. **Purge 스레드**가 주기적으로 더 이상 필요 없는 Undo 레코드를 삭제합니다.

"더 이상 필요 없다"는 기준은, 열린 모든 ReadView 중에서 가장 오래된 것보다 앞선 버전입니다. 장시간 열린 ReadView가 있으면 그 동안 Purge가 진행되지 않아 Undo 공간이 계속 커집니다.

```sql
-- 현재 History 길이 (= 정리되지 않은 Undo 레코드 수)
SHOW ENGINE INNODB STATUS\G
-- History list length: N
-- 1000 이상이면 장시간 트랜잭션 또는 Purge 지연 의심

-- 장시간 열린 트랜잭션 확인
SELECT trx_id, trx_started, trx_isolation_level,
       TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS sec
FROM   information_schema.INNODB_TRX
ORDER  BY trx_started ASC
LIMIT  5;
```

MVCC는 읽기 성능을 획기적으로 높이지만, 장시간 트랜잭션이 Undo 공간을 잠식한다는 부작용을 항상 함께 고려해야 합니다.

---

**지난 글:** [InnoDB Change Buffer — Secondary Index 쓰기 최적화](/posts/innodb-change-buffer/)

**다음 글:** [MySQL REPEATABLE READ — 기본 격리 수준과 Gap Lock](/posts/mysql-isolation-rr-default/)

<br>
읽어주셔서 감사합니다. 😊
