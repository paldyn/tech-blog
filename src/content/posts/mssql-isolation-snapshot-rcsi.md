---
title: "SQL Server 격리 수준 — SNAPSHOT과 RCSI의 이해"
description: "SQL Server의 6가지 격리 수준을 비교하고, 읽기-쓰기 충돌을 락 없이 해결하는 RCSI와 SNAPSHOT 격리의 내부 동작을 행 버전 저장소와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "격리수준", "SNAPSHOT", "RCSI", "트랜잭션", "동시성", "행버전"]
featured: false
draft: false
---

[지난 글](/posts/tsql-temp-table-vs-table-variable/)에서 T-SQL 임시 저장소의 차이를 살펴봤다. 이번에는 동시성 환경에서 가장 중요한 주제 중 하나인 **격리 수준(Isolation Level)** — 특히 SQL Server 고유의 **RCSI**와 **SNAPSHOT** 격리를 집중적으로 다룬다.

## 격리 수준이란

여러 트랜잭션이 동시에 실행될 때 서로 어느 정도까지 영향을 줄 수 있는지를 정의한 규칙이 격리 수준이다. 격리 수준이 낮을수록 동시성이 높아지지만 **Dirty Read, Non-Repeatable Read, Phantom Read** 같은 이상 현상이 발생할 수 있다.

![SQL Server 격리 수준 비교](/assets/posts/mssql-isolation-snapshot-levels.svg)

## 기본값: READ COMMITTED

SQL Server의 기본 격리 수준은 `READ COMMITTED`다. 커밋된 데이터만 읽을 수 있어 Dirty Read는 방지되지만, 같은 트랜잭션에서 같은 행을 두 번 읽으면 값이 달라질 수 있다(Non-Repeatable Read).

```sql
-- 현재 세션 격리 수준 확인
SELECT transaction_isolation_level,
       CASE transaction_isolation_level
           WHEN 0 THEN 'Unspecified'
           WHEN 1 THEN 'Read Uncommitted'
           WHEN 2 THEN 'Read Committed'
           WHEN 3 THEN 'Repeatable Read'
           WHEN 4 THEN 'Serializable'
           WHEN 5 THEN 'Snapshot'
       END AS isolation_name
FROM   sys.dm_exec_sessions
WHERE  session_id = @@SPID;

-- 격리 수준 변경 (세션 단위)
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

## RCSI — 행 버전 기반 READ COMMITTED

**RCSI(Read Committed Snapshot Isolation)**는 데이터베이스 수준 옵션이다. 활성화하면 `READ COMMITTED` 트랜잭션이 **공유 락 없이** 행의 이전 버전을 읽는다.

```sql
-- RCSI 활성화 (DB 단독 사용 중일 때 실행)
ALTER DATABASE AdventureWorks
    SET READ_COMMITTED_SNAPSHOT ON;

-- 활성화 확인
SELECT is_read_committed_snapshot_on
FROM   sys.databases
WHERE  name = 'AdventureWorks';
```

활성화 후 별도 `SET` 명령 없이 모든 `READ COMMITTED` 트랜잭션이 즉시 행 버전을 사용한다. Azure SQL Database는 RCSI를 기본값으로 사용한다.

![RCSI 행 버전 저장 메커니즘](/assets/posts/mssql-isolation-rcsi-flow.svg)

내부적으로 SQL Server는 `tempdb`에 **버전 저장소(Version Store)**를 유지한다. 행이 수정될 때 이전 버전이 버전 저장소에 복사되고, 수정 중에 읽기 요청이 오면 버전 저장소에서 이전 값을 돌려준다. 읽기가 쓰기를 기다리지 않으므로 대기 없이 즉시 응답한다.

## SNAPSHOT — 트랜잭션 시작 시점 스냅샷

`SNAPSHOT` 격리는 `RCSI`보다 강하다. 트랜잭션이 시작된 순간의 스냅샷을 기준으로 모든 읽기가 수행되어 Phantom Read까지 방지한다. RCSI가 **문장(statement) 시작 시점**의 버전을 보는 반면, SNAPSHOT은 **트랜잭션 시작 시점**을 기준으로 삼는다.

```sql
-- SNAPSHOT 격리 활성화 (DB 수준)
ALTER DATABASE AdventureWorks
    SET ALLOW_SNAPSHOT_ISOLATION ON;

-- 세션에서 SNAPSHOT 격리 사용
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;

BEGIN TRANSACTION;
    -- 트랜잭션 시작 이후 다른 세션의 커밋은 여기서 보이지 않음
    SELECT * FROM orders WHERE order_date = '2026-05-01';
    -- ...
COMMIT;
```

## SNAPSHOT vs RCSI 선택 기준

| 특성 | RCSI | SNAPSHOT |
|------|------|---------|
| 기준 시점 | 각 문장 시작 | 트랜잭션 시작 |
| Phantom Read 방지 | 아니요 | 예 |
| 활성화 방법 | DB 옵션 | DB 옵션 + SET |
| 쓰기 충돌 감지 | 없음 | 업데이트 충돌 감지 |

SNAPSHOT 격리에서는 **업데이트 충돌(Update Conflict)** 감지가 활성화된다. 두 트랜잭션이 같은 행을 수정하려 하면 나중에 커밋을 시도하는 트랜잭션이 오류를 받는다.

```sql
-- SNAPSHOT 충돌 처리 패턴
BEGIN TRY
    SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
    BEGIN TRANSACTION;
        UPDATE accounts
        SET    balance = balance - 100
        WHERE  account_id = 1;
    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    -- 오류 3960: Snapshot isolation transaction aborted
    -- 재시도 로직 적용
    THROW;
END CATCH
```

## tempdb 부하 고려

RCSI/SNAPSHOT은 `tempdb`에 버전 저장소를 쓰므로 **tempdb 부하가 증가**한다. 대규모 OLTP 환경에서는 tempdb를 별도 고속 스토리지에 배치하고, 버전 저장소 정리 주기를 모니터링해야 한다.

```sql
-- 버전 저장소 크기 모니터링
SELECT reserved_mb   = SUM(reserved_page_count) * 8.0 / 1024,
       used_mb       = SUM(used_page_count)      * 8.0 / 1024
FROM   tempdb.sys.dm_db_file_space_usage;

-- 활성 버전 수 확인
SELECT COUNT(*) AS active_versions
FROM   sys.dm_tran_version_store_space_usage;
```

---

**지난 글:** [T-SQL 임시 테이블 vs 테이블 변수 — 언제 무엇을 쓸까](/posts/tsql-temp-table-vs-table-variable/)

**다음 글:** [NOLOCK 힌트의 위험성 — SQL Server 락 힌트 가이드](/posts/mssql-lock-hint-nolock-risk/)

<br>
읽어주셔서 감사합니다. 😊
