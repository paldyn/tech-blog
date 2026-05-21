---
title: "SQL Server 교착상태 분석 — 데드락 그래프 읽는 법"
description: "SQL Server 데드락의 발생 원리, Lock Monitor 동작, 데드락 그래프 XML 분석 방법, XEvent를 이용한 수집 및 예방 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "데드락", "교착상태", "DeadlockGraph", "XEvent", "락", "성능"]
featured: false
draft: false
---

[지난 글](/posts/mssql-lock-hint-nolock-risk/)에서 NOLOCK 힌트의 위험성을 다뤘다. 이번에는 동시성 문제 중 가장 골치 아픈 현상인 **데드락(Deadlock)**을 분석하고 예방하는 방법을 알아본다.

## 데드락이란

두 트랜잭션이 서로 상대방이 보유한 자원의 락 해제를 무한히 기다리는 상태다. 혼자서는 절대 해결되지 않으므로 SQL Server의 **Lock Monitor**가 주기적으로(약 5초) 사이클을 탐지해 희생자(Victim) 트랜잭션을 선택하고 강제 롤백한다.

![데드락 사이클 발생 패턴](/assets/posts/mssql-deadlock-cycle.svg)

희생자로 선택되면 애플리케이션은 **오류 1205**를 받는다. 재시도 로직이 없으면 사용자에게 오류가 표출된다.

```sql
-- 데드락 오류 처리 패턴 (저장 프로시저)
DECLARE @retry INT = 0;
WHILE @retry < 3
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
            UPDATE accounts SET balance = balance - 100 WHERE id = 1;
            UPDATE orders   SET status  = 'PAID'         WHERE id = 99;
        COMMIT;
        BREAK;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        IF ERROR_NUMBER() = 1205   -- 데드락 희생자
        BEGIN
            SET @retry += 1;
            WAITFOR DELAY '00:00:00.1';  -- 100ms 후 재시도
        END
        ELSE THROW;
    END CATCH
END
```

## 데드락 그래프 수집

SQL Server는 데드락 발생 시 XML 형식의 **데드락 그래프**를 생성한다. 수집 방법은 세 가지다.

```sql
-- 방법 1: 시스템 헬스 확장 이벤트 세션 (기본 활성화)
-- SSMS에서 Management > Extended Events > Sessions > system_health

-- 방법 2: 추적 플래그 1222 (가장 상세)
DBCC TRACEON(1222, -1);   -- 전역 활성화
DBCC TRACEON(1204, -1);   -- 간단한 텍스트 형식

-- 방법 3: XEvent 세션 직접 생성 (권장)
CREATE EVENT SESSION [DeadlockCapture] ON SERVER
ADD EVENT sqlserver.xml_deadlock_report
ADD TARGET package0.ring_buffer (SET max_memory = 51200)
WITH (MAX_DISPATCH_LATENCY = 5 SECONDS);
ALTER EVENT SESSION [DeadlockCapture] ON SERVER STATE = START;
```

## 데드락 그래프 읽기

```xml
<!-- 데드락 그래프 XML 핵심 구조 -->
<deadlock>
  <victim-list>
    <victimProcess id="process1" />
  </victim-list>
  <process-list>
    <process id="process1"
             spid="54"
             loginname="AppUser"
             waitresource="KEY: 5:72057594..."
             waittime="4812"
             transactionname="UPDATE">
      <executionStack>
        <frame procname="dbo.sp_TransferFunds" line="12" />
      </executionStack>
    </process>
    <process id="process2" spid="58" ... />
  </process-list>
  <resource-list>
    <keylock objectname="AdventureWorks.dbo.accounts" ... />
  </resource-list>
</deadlock>
```

핵심 필드: `spid`(세션 ID), `loginname`(로그인), `waitresource`(대기 중인 리소스), `procname/line`(코드 위치). 이 정보로 어떤 코드 경로에서 데드락이 발생했는지 정확히 파악할 수 있다.

## 데드락 예방 전략

![데드락 예방 전략](/assets/posts/mssql-deadlock-prevention.svg)

**락 획득 순서 통일**이 가장 확실한 예방책이다. 모든 코드 경로에서 항상 동일한 순서로 테이블과 행에 접근하면 사이클 자체가 만들어지지 않는다.

```sql
-- 나쁜 예: T1은 accounts→orders, T2는 orders→accounts (사이클 가능)
-- BEGIN TRAN
--   UPDATE accounts ...  -- 다른 세션이 동시에 orders를 먼저 락
--   UPDATE orders   ...

-- 좋은 예: 항상 accounts → orders 순서
BEGIN TRANSACTION;
    -- 순서: 작은 id → 큰 id 또는 알파벳 순
    UPDATE accounts SET balance = balance - 100 WHERE id = 1;
    UPDATE orders   SET status  = 'PAID'         WHERE id = 99;
COMMIT;
```

**트랜잭션을 짧게** 유지하는 것도 중요하다. 트랜잭션 내부에서 HTTP 호출, 사용자 입력 대기, 파일 I/O를 하면 락 보유 시간이 늘어나 데드락 확률이 급증한다.

**UPDLOCK 힌트**를 SELECT 시점에 사용하면 공유 락 → 배타 락 변환 단계를 없애 데드락을 예방한다.

```sql
BEGIN TRANSACTION;
    -- 처음부터 업데이트 락으로 읽어 변환 단계 제거
    SELECT @amt = balance
    FROM   accounts WITH (UPDLOCK)
    WHERE  id = 1;
    
    UPDATE accounts SET balance = @amt - 100 WHERE id = 1;
COMMIT;
```

**RCSI 활성화**는 읽기 트랜잭션이 공유 락을 걸지 않게 해 읽기-쓰기 간 데드락을 원천 차단한다.

---

**지난 글:** [NOLOCK 힌트의 위험성 — SQL Server 락 힌트 가이드](/posts/mssql-lock-hint-nolock-risk/)

**다음 글:** [SQL Server 클러스터형 vs 비클러스터형 인덱스](/posts/mssql-clustered-nonclustered/)

<br>
읽어주셔서 감사합니다. 😊
