---
title: "SQL Server 복구 모델 — Full · Bulk-Logged · Simple"
description: "SQL Server 세 가지 복구 모델(Full, Bulk-Logged, Simple)의 로그 동작·백업 전략·PITR 가능 여부를 비교하고, 로그 체인 기반 특정 시점 복구 T-SQL 절차를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "복구모델", "PITR", "백업복구", "로그체인", "Full복구"]
featured: false
draft: false
---

[지난 글](/posts/mssql-plan-cache-query-store/)에서 실행 계획의 재사용과 Query Store 관리를 다뤘다. 이번에는 데이터 보호의 핵심인 **복구 모델(Recovery Model)** 로 넘어간다. 복구 모델은 트랜잭션 로그가 어떻게 관리되는지, 어떤 종류의 백업을 사용할 수 있는지, 장애 시 어디까지 복구할 수 있는지를 결정하는 데이터베이스 수준 설정이다.

## 세 가지 복구 모델

![SQL Server 복구 모델 비교](/assets/posts/mssql-recovery-models-overview.svg)

**Full(전체) 복구 모델**은 모든 트랜잭션을 완전히 로그에 기록한다. 로그 파일은 `BACKUP LOG`를 통해 잘라낼(truncate) 수 있다. 백업 전략은 Full → Differential → Log 의 조합이며, 특정 시점 복구(PITR, Point-In-Time Recovery)가 가능하다. 프로덕션 OLTP 데이터베이스의 표준이다.

**Bulk-Logged 복구 모델**은 `BULK INSERT`, `SELECT INTO`, `CREATE INDEX` 같은 대량 작업을 최소한으로만 로그에 기록해 로그 증가를 억제한다. 대량 작업이 이루어진 로그 구간은 PITR이 불가능하다. ETL 적재 중에 잠시 전환하고 완료 후 Full 모델로 되돌리는 용도로 적합하다.

**Simple(단순) 복구 모델**은 완료된 트랜잭션의 로그를 체크포인트 시점에 자동으로 재사용한다. 로그 파일이 소형으로 유지되지만 로그 백업 자체가 불가능하므로 PITR이 없다. 개발·테스트 환경이나 재구성 가능한 분석용 DB에 적합하다.

```sql
-- 현재 복구 모델 확인
SELECT name, recovery_model_desc
FROM   sys.databases
WHERE  name = DB_NAME();

-- 모델 변경
ALTER DATABASE AdventureWorks SET RECOVERY FULL;
-- Full 모델로 바꾼 직후 Full 백업 필수 (로그 체인 시작)
BACKUP DATABASE AdventureWorks TO DISK = 'D:\Backup\full.bak';
```

## 로그 체인과 PITR

Full 복구 모델에서 PITR의 핵심은 **로그 체인(Log Chain)** 이다. 로그 백업들이 LSN(Log Sequence Number)으로 연결되어 빈틈없이 이어져야 한다. 로그 체인은 다음 상황에서 끊긴다.

- Full 백업 없이 Simple 모델에서 Full 모델로 전환 후 로그 백업
- `BACKUP LOG ... WITH NO_LOG` (SQL Server 2005 이후 제거)
- 미러링·로그 전달 구성 중 수동 개입

로그 체인이 끊기면 체인이 끊긴 지점 이전으로는 복구할 수 없다.

![Full 모델 PITR 복구 흐름](/assets/posts/mssql-recovery-models-pitr.svg)

## 로그 백업 주기 설계

Full 모델에서 로그 파일이 무한 성장하지 않으려면 로그 백업 주기를 설정해야 한다. 로그 백업 주기가 RPO(Recovery Point Objective)를 결정한다.

```sql
-- SQL Server Agent 작업으로 15분마다 로그 백업
BACKUP LOG AdventureWorks
  TO DISK = N'D:\Backup\log_' +
            REPLACE(REPLACE(CONVERT(VARCHAR, GETDATE(), 120), ':', ''), ' ', '_') +
            N'.bak'
  WITH COMPRESSION, STATS = 10;
```

## Tail-Log 백업

데이터 파일이 손상된 후 복구를 시작하기 전에, 아직 백업되지 않은 마지막 로그 구간을 반드시 먼저 백업해야 한다. 이를 Tail-Log 백업이라 한다. Tail-Log 백업 없이 복구를 시작하면 장애 직전까지의 데이터를 잃게 된다.

```sql
-- 장애 직후 Tail-Log 백업 (DB가 온라인이든 오프라인이든 시도)
BACKUP LOG AdventureWorks
  TO DISK = 'D:\Backup\tail_log.bak'
  WITH NORECOVERY,   -- DB를 복원 중 상태로 전환
       CONTINUE_AFTER_ERROR;
```

`NORECOVERY`를 붙이면 DB가 복원 대기(Restoring) 상태로 전환되어 이후 복원 시퀀스를 이어갈 수 있다.

## Bulk-Logged 모델 활용 패턴

대규모 데이터 적재 시 Full 모델을 유지하면 로그 파일이 수십 GB 폭증하는 경우가 있다. 이때 다음 패턴을 사용한다.

```sql
-- 1. Bulk-Logged로 전환
ALTER DATABASE AdventureWorks SET RECOVERY BULK_LOGGED;

-- 2. 대량 적재 (최소 로깅)
BULK INSERT dbo.Sales
FROM 'D:\data\sales_2026.csv'
WITH (FIELDTERMINATOR = ',', ROWTERMINATOR = '\n', BATCHSIZE = 50000);

-- 3. 즉시 Full 백업 또는 Full 모델로 복귀
ALTER DATABASE AdventureWorks SET RECOVERY FULL;
BACKUP DATABASE AdventureWorks TO DISK = 'D:\Backup\post_load_full.bak';
```

Bulk-Logged 구간은 PITR이 불가능하므로, 적재 완료 직후 Full 백업을 찍어 새로운 복구 기준점을 만드는 것이 필수다.

## 정리

복구 모델 선택은 RPO·RTO 목표와 로그 관리 비용의 균형이다. 프로덕션 OLTP는 Full 모델에 주기적 로그 백업, ETL은 Bulk-Logged 일시 전환, 개발·테스트는 Simple 모델이 기본 공식이다. 로그 체인을 끊기지 않게 유지하는 것이 PITR 보장의 핵심임을 기억하자.

---

**지난 글:** [SQL Server 플랜 캐시와 Query Store — 실행 계획 재사용과 관리](/posts/mssql-plan-cache-query-store/)

**다음 글:** [SQL Server 백업과 복원 — 전략과 실전 절차](/posts/mssql-backup-restore/)

<br>
읽어주셔서 감사합니다. 😊
