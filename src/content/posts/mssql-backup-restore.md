---
title: "SQL Server 백업과 복원 — 전략과 실전 절차"
description: "SQL Server Full · Differential · Log 백업 유형과 RPO·RTO 관계, CHECKSUM 검증, 테스트 복원 자동화, 재해 복구 시나리오별 T-SQL 절차를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "백업복원", "PITR", "재해복구", "RPO", "RTO"]
featured: false
draft: false
---

[지난 글](/posts/mssql-recovery-models/)에서 복구 모델이 백업 전략의 전제 조건임을 확인했다. 이번에는 실전 백업 설계와 복원 절차를 다룬다. 백업은 저장했지만 한 번도 복원 테스트를 하지 않은 조직이 생각보다 많다. 실제 장애 시 처음 복원하면 RTO는 예측 불가능하다.

## 백업 유형별 특성

![SQL Server 백업 유형과 복원 전략](/assets/posts/mssql-backup-restore-strategy.svg)

**Full 백업**은 DB의 전체 데이터 페이지를 복사한다. 백업 중에도 트랜잭션이 발생하므로 백업 시작~종료 시점의 로그 구간도 함께 기록한다. 이후 복원의 기준점이 된다.

**Differential(차등) 백업**은 마지막 Full 백업 이후 변경된 익스텐트(Extent, 8페이지 단위)만 기록한다. Full 대비 크기가 작고 빠르다. 복원 시 Full + 최신 Diff 하나면 충분하다.

**Log 백업**은 완료된 트랜잭션 로그 레코드를 순서대로 기록한다. 로그 체인이 유지되는 한 임의 시점으로 복원(PITR)이 가능하다. Full 모델에서 로그 파일이 계속 커지는 것을 막으려면 주기적 로그 백업이 필수다.

## 표준 백업 스케줄 설계

```sql
-- 주 1회 Full 백업 (일요일 02:00)
BACKUP DATABASE AdventureWorks
  TO DISK = 'D:\Backup\Weekly\full_20260524.bak'
  WITH COMPRESSION,      -- 백업 크기 40~70% 절감
       CHECKSUM,         -- 페이지 무결성 검증
       STATS = 10;       -- 10%마다 진행률 출력

-- 일 1회 Differential 백업 (평일 02:00)
BACKUP DATABASE AdventureWorks
  TO DISK = 'D:\Backup\Daily\diff_20260524.bak'
  WITH DIFFERENTIAL, COMPRESSION, CHECKSUM;

-- 15분마다 Log 백업 (SQL Agent 작업)
BACKUP LOG AdventureWorks
  TO DISK = 'D:\Backup\Log\log_20260524_1430.bak'
  WITH COMPRESSION, CHECKSUM;
```

## 백업 파일 검증

```sql
-- 백업 내용 확인 (실제 복원 없이)
RESTORE HEADERONLY FROM DISK = 'D:\Backup\Weekly\full_20260524.bak';
RESTORE FILELISTONLY FROM DISK = 'D:\Backup\Weekly\full_20260524.bak';

-- 무결성만 검증 (복원보다 빠름)
RESTORE VERIFYONLY
  FROM DISK = 'D:\Backup\Weekly\full_20260524.bak'
  WITH CHECKSUM;
```

![백업 검증 및 복원 테스트 패턴](/assets/posts/mssql-backup-restore-verify.svg)

## 복원 시나리오별 절차

**시나리오 1: 실수 삭제 복구 (PITR)**

```sql
-- 1. Tail-Log 백업 (현재 로그 보존)
BACKUP LOG AdventureWorks TO DISK = 'D:\tail.bak' WITH NORECOVERY;

-- 2. Full 복원
RESTORE DATABASE AdventureWorks FROM DISK = 'D:\Backup\Weekly\full_20260524.bak'
  WITH NORECOVERY;

-- 3. Diff 복원 (있으면)
RESTORE DATABASE AdventureWorks FROM DISK = 'D:\Backup\Daily\diff_20260524.bak'
  WITH NORECOVERY;

-- 4. Log를 삭제 직전 시점까지 적용
RESTORE LOG AdventureWorks FROM DISK = 'D:\Backup\Log\log_20260524_1420.bak'
  WITH RECOVERY, STOPAT = '2026-05-24 14:25:00';
```

**시나리오 2: 전체 서버 재해 복구**

다른 서버에서 복원 시 파일 경로가 다를 수 있다. `MOVE` 절로 논리적 파일 이름과 물리 경로를 매핑한다.

```sql
RESTORE DATABASE AdventureWorks
  FROM DISK = 'D:\Backup\Weekly\full_20260524.bak'
  WITH MOVE 'AdventureWorks_Data' TO 'E:\Data\aw_data.mdf',
       MOVE 'AdventureWorks_Log'  TO 'F:\Log\aw_log.ldf',
       NORECOVERY, STATS = 5;
```

**시나리오 3: 페이지 수준 복구 (SQL Server 2005+)**

데이터 파일의 특정 페이지만 손상된 경우, 전체 복원 없이 해당 페이지만 복구할 수 있다.

```sql
-- 손상 페이지 확인
SELECT * FROM msdb.dbo.suspect_pages WHERE event_type < 5;

-- 손상 페이지만 복원 (온라인 복구 가능)
RESTORE DATABASE AdventureWorks PAGE = '1:29392'
  FROM DISK = 'D:\Backup\Weekly\full_20260524.bak'
  WITH NORECOVERY;
RESTORE LOG AdventureWorks FROM DISK = 'D:\Backup\Log\log_20260524_1430.bak'
  WITH RECOVERY;
```

## 복원 테스트 자동화

월 1회 이상 테스트 서버에 전체 복원을 수행해 실제 RTO를 측정하고 절차를 숙달해야 한다. SQL Server Agent 작업이나 PowerShell 스크립트로 자동화할 수 있다.

```powershell
# PowerShell로 복원 후 DB 무결성 검사
Invoke-Sqlcmd -Query "
  RESTORE DATABASE AdventureWorks_Test
    FROM DISK = 'D:\Backup\Weekly\full_20260524.bak'
    WITH REPLACE, RECOVERY, STATS = 10;
  DBCC CHECKDB(AdventureWorks_Test) WITH NO_INFOMSGS;
" -ServerInstance "TestServer"
```

## 정리

백업 전략은 RPO·RTO 목표에서 역산한다. 15분 RPO가 목표라면 15분 로그 백업 주기가 필요하고, 1시간 RTO라면 Full+Diff+Log 복원이 그 시간 안에 끝나야 한다. CHECKSUM으로 백업 무결성을 항상 검증하고, 정기적인 복원 테스트로 실제 RTO를 검증하는 것이 재해 복구 준비의 핵심이다.

---

**지난 글:** [SQL Server 복구 모델 — Full · Bulk-Logged · Simple](/posts/mssql-recovery-models/)

**다음 글:** [SQL Server Always On 가용성 그룹 — HA와 DR의 통합](/posts/mssql-alwayson-availability-group/)

<br>
읽어주셔서 감사합니다. 😊
