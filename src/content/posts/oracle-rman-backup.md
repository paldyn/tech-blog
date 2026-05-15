---
title: "RMAN 백업과 복구"
description: "Oracle RMAN의 아키텍처, Full·Incremental 백업 유형, Recovery Catalog 역할, Point-in-Time Recovery 방법, 그리고 실무 백업 전략까지 단계별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["oracle", "rman", "backup", "recovery", "incremental-backup", "pitr", "recovery-catalog", "archivelog", "fast-recovery-area", "flashback"]
featured: false
draft: false
---

[지난 글](/posts/oracle-data-guard/)에서 Data Guard로 재해 복구(DR)를 구성하는 방법을 살펴봤다. Data Guard가 실시간 복제라면, **RMAN(Recovery Manager)**은 Oracle DB 전용 백업·복구 도구다. 두 가지는 상호 보완적으로 함께 사용한다.

## RMAN이란

RMAN은 Oracle DB의 공식 백업·복구 도구다. 단순히 파일을 복사하는 것이 아니라 **Oracle 서버 내부에서 채널(Channel)을 통해 직접 데이터 블록 수준으로 백업**한다. 덕분에 손상된 블록만 선별 복구, 빈 블록 스킵, 압축, 암호화, 증분 백업 등이 가능하다.

RMAN이 없던 시절에는 OS 레벨의 파일 복사를 썼지만, 파일이 열려 있는 상태(Open Database)의 일관성 있는 백업이 불가능했다. RMAN은 DB가 Open인 상태에서도 온라인 백업을 지원한다.

![RMAN 백업 아키텍처](/assets/posts/oracle-rman-backup-arch.svg)

## 백업 전제조건: ARCHIVELOG 모드

RMAN 온라인 백업은 데이터베이스가 **ARCHIVELOG 모드**여야 한다. 백업 도중 변경된 블록은 Archived Redo Log를 함께 적용해야 일관성 있는 복구가 가능하다.

```sql
-- ARCHIVELOG 모드 확인
SELECT log_mode FROM v$database;

-- ARCHIVELOG 모드 전환 (MOUNT 상태에서)
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
```

NOARCHIVELOG 모드에서는 RMAN 백업이 DB 종료 후 Cold Backup만 가능하다.

## Fast Recovery Area (FRA)

FRA는 백업, Archived Log, Flashback Log 등을 한곳에 모아 관리하는 디스크 공간이다. RMAN이 자동으로 공간을 관리하며, 오래된 파일을 정책에 따라 삭제한다.

```sql
-- FRA 설정
ALTER SYSTEM SET db_recovery_file_dest      = '/oracle/fra'      SCOPE=BOTH;
ALTER SYSTEM SET db_recovery_file_dest_size = 200G               SCOPE=BOTH;

-- FRA 사용 현황
SELECT name, space_limit, space_used,
       ROUND(space_used/space_limit*100, 1) AS pct_used
FROM   v$recovery_file_dest;
```

## Recovery Catalog

RMAN의 백업 메타데이터는 Target DB의 Control File에 저장된다. **Recovery Catalog**는 이 정보를 별도 데이터베이스 스키마에도 저장해, Control File 손실 시에도 복구 이력을 보존한다. 여러 Target DB를 중앙에서 관리할 때도 유용하다.

```sql
-- Catalog DB에서 스키마 생성
CREATE USER rman_catalog IDENTIFIED BY password
  DEFAULT TABLESPACE rman_ts
  QUOTA UNLIMITED ON rman_ts;

GRANT RECOVERY_CATALOG_OWNER TO rman_catalog;

-- Catalog 초기화
rman CATALOG rman_catalog/password@catalog_db
RMAN> CREATE CATALOG;

-- Target DB 등록
rman TARGET / CATALOG rman_catalog/password@catalog_db
RMAN> REGISTER DATABASE;
```

## 주요 백업 명령

![RMAN 주요 명령 & 복구 시나리오](/assets/posts/oracle-rman-backup-recovery.svg)

```sql
rman TARGET /

-- DB 전체 백업 (압축 + Archivelog 포함 + 사용한 Archivelog 삭제)
BACKUP AS COMPRESSED BACKUPSET
  DATABASE PLUS ARCHIVELOG
  DELETE INPUT;

-- Level 0 (주 1회)
BACKUP INCREMENTAL LEVEL 0 DATABASE;

-- Level 1 Cumulative (일 1회, 항상 Level 0 이후 전체 변경분)
BACKUP INCREMENTAL LEVEL 1 CUMULATIVE DATABASE;

-- Level 1 Differential (일 1회, 직전 Level 0/1 이후 변경분)
BACKUP INCREMENTAL LEVEL 1 DATABASE;

-- 백업셋 목록
LIST BACKUP SUMMARY;

-- 백업 검증 (실제 복구 없이 유효성 체크)
VALIDATE DATABASE;
```

Cumulative(누적)는 Level 0 이후 모든 변경분을 하나의 백업에 담는다. 복구 시 Level 0 하나 + Level 1 하나만 있으면 되므로 복구가 단순하다. Differential(차분)은 직전 백업 이후 변경분만 담으므로 크기는 작지만 복구 시 여러 백업을 순서대로 적용해야 한다.

## 복구 절차

```sql
-- 1. 백업 가용성 사전 확인 (실제 복구 없이)
RESTORE DATABASE PREVIEW SUMMARY;

-- 2. DB를 MOUNT 상태로
STARTUP MOUNT;

-- 3. 데이터파일 복원 + Redo 적용
RESTORE DATABASE;
RECOVER DATABASE;

-- 4. RESETLOGS로 OPEN
ALTER DATABASE OPEN RESETLOGS;
```

## Point-in-Time Recovery (PITR)

실수로 대량 DELETE가 발생했거나 특정 시점으로 되돌아가야 할 때 사용한다.

```sql
RUN {
  SET UNTIL TIME "TO_DATE('2024-03-15 08:00:00','YYYY-MM-DD HH24:MI:SS')";
  RESTORE DATABASE;
  RECOVER DATABASE;
}
ALTER DATABASE OPEN RESETLOGS;
```

PITR 후에는 반드시 `RESETLOGS`로 열어야 한다. 이후 해당 시점 이전의 Archived Log는 현재 incarnation에서 사용 불가능하므로 즉시 새 Level 0 백업을 수행해야 한다.

## Incremental Updated Backup (Block Change Tracking)

Block Change Tracking을 활성화하면 Oracle이 변경된 블록 위치를 별도 파일에 기록한다. Level 1 백업 시 전체 데이터파일을 스캔하지 않고 변경 파일만 읽으므로 백업 속도가 크게 빨라진다.

```sql
-- Block Change Tracking 활성화
ALTER DATABASE ENABLE BLOCK CHANGE TRACKING
  USING FILE '/oracle/bct/bct.f';

-- 상태 확인
SELECT filename, status, bytes
FROM   v$block_change_tracking;
```

## 보존 정책 (Retention Policy)

```sql
-- 7일 이내 복구 가능하도록 보존
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 7 DAYS;

-- 또는 최소 2개 백업 유지
CONFIGURE RETENTION POLICY TO REDUNDANCY 2;

-- 불필요 백업 삭제
REPORT OBSOLETE;
DELETE OBSOLETE;
```

## 실무 백업 스케줄 예시

| 시점 | 명령 |
|---|---|
| 매일 00:00 | `BACKUP INCREMENTAL LEVEL 1 CUMULATIVE DATABASE PLUS ARCHIVELOG DELETE INPUT;` |
| 매주 일요일 | `BACKUP INCREMENTAL LEVEL 0 DATABASE PLUS ARCHIVELOG DELETE INPUT;` |
| 매주 월요일 | `CROSSCHECK BACKUP; DELETE EXPIRED BACKUP; REPORT OBSOLETE; DELETE OBSOLETE;` |

## 정리

- RMAN = Oracle 전용 백업·복구 도구, 블록 수준 처리
- ARCHIVELOG 모드 필수 (온라인 백업)
- Level 0 (주 1회) + Level 1 Cumulative (일 1회) 가 실무 표준
- Recovery Catalog = 메타데이터 중앙 관리, Control File 보완
- PITR: `SET UNTIL TIME` → `RESTORE` → `RECOVER` → `OPEN RESETLOGS`
- Block Change Tracking으로 증분 백업 속도 향상

---

**지난 글:** [Oracle Data Guard](/posts/oracle-data-guard/)

<br>
읽어주셔서 감사합니다. 😊
