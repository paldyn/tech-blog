---
title: "멀티테넌트 — CDB와 PDB"
description: "Oracle 12c에서 도입된 멀티테넌트 아키텍처의 CDB(Container Database)와 PDB(Pluggable Database) 구조, PDB 생성·관리·플러그인 방법, 공유 자원과 격리 범위를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["oracle", "multitenant", "cdb", "pdb", "pluggable-database", "container", "12c", "pdb-seed", "unplug", "resource-manager"]
featured: false
draft: false
---

[지난 글](/posts/oracle-nls-korean/)에서 NLS와 한국어 환경 설정을 살펴봤다. 이번에는 Oracle 12c(2013년)에서 도입된 **멀티테넌트 아키텍처** — 하나의 Oracle 인스턴스에서 여러 독립 데이터베이스를 운영하는 방법 — 를 다룬다. Oracle 21c부터는 단일 인스턴스도 기본적으로 CDB 구조다.

## CDB vs 비CDB

멀티테넌트 이전의 전통적인 Oracle DB는 **non-CDB**로, 인스턴스(SGA + 프로세스)와 데이터베이스(데이터파일)가 1:1로 결합된다. 여러 애플리케이션을 운영하려면 각각 별도의 인스턴스가 필요해 메모리·관리 비용이 높았다.

**CDB(Container Database)**는 하나의 인스턴스와 SGA를 공유하면서, 내부에 여러 **PDB(Pluggable Database)**를 최대 4096개까지 담을 수 있다. 각 PDB는 독립된 데이터 딕셔너리와 데이터파일을 가져 애플리케이션 관점에서는 기존 데이터베이스처럼 보인다.

## CDB의 컨테이너 구조

![Oracle 멀티테넌트 아키텍처](/assets/posts/oracle-multitenant-architecture.svg)

| 컨테이너 | con_id | 역할 |
|---|---|---|
| CDB$ROOT | 1 | Oracle 시스템 딕셔너리, 공통 사용자·롤 |
| PDB$SEED | 2 | 새 PDB 생성 시 복사되는 읽기 전용 템플릿 |
| 사용자 PDB | 3 이상 | 독립적인 스키마·데이터·딕셔너리 |

**공통 사용자(C##)**는 CDB$ROOT에서 생성되어 모든 PDB에서 접속 가능하다. 반면 **로컬 사용자**는 특정 PDB에만 존재한다.

```sql
-- 현재 컨테이너 확인
SELECT SYS_CONTEXT('USERENV', 'CON_NAME') FROM dual;

-- 전체 PDB 목록 (CDB$ROOT에서 실행)
SELECT con_id, name, open_mode, restricted
FROM   v$pdbs
ORDER  BY con_id;
```

## PDB 생성과 열기

```sql
-- PDB$SEED 기반으로 새 PDB 생성
CREATE PLUGGABLE DATABASE pdb_prod
  ADMIN USER pdbadmin IDENTIFIED BY "SecurePwd1!"
  FILE_NAME_CONVERT = ('/oradata/pdbseed', '/oradata/pdb_prod');

-- PDB 열기
ALTER PLUGGABLE DATABASE pdb_prod OPEN;

-- DB 재기동 후에도 자동으로 OPEN 유지
ALTER PLUGGABLE DATABASE ALL OPEN SAVE STATE;

-- 특정 PDB 닫기
ALTER PLUGGABLE DATABASE pdb_prod CLOSE IMMEDIATE;
```

PDB를 생성하면 PDB$SEED의 시스템 데이터파일이 새 경로로 복사되고, 독립적인 UNDO·TEMP 테이블스페이스가 만들어진다.

![CDB · PDB 관리 SQL](/assets/posts/oracle-multitenant-sql.svg)

## PDB 접속 방식

PDB에 접속하는 방법은 두 가지다.

```sql
-- 방법 1: CDB에 접속 후 세션 전환
sqlplus sys@cdb_service AS SYSDBA
ALTER SESSION SET container = pdb_prod;

-- 방법 2: PDB 서비스명으로 직접 접속 (권장)
-- tnsnames.ora 또는 Easy Connect 사용
sqlplus pdbadmin/SecurePwd1!@//dbhost:1521/pdb_prod

-- PDB 전용 서비스 등록
EXEC DBMS_SERVICE.create_service('pdb_prod_svc', 'pdb_prod_svc');
EXEC DBMS_SERVICE.start_service('pdb_prod_svc');
```

## Unplug / Plug — PDB 이식

PDB의 가장 강력한 기능은 **Unplug/Plug**다. 파일을 그대로 옮겨 다른 CDB에 꽂을 수 있어, 데이터베이스 마이그레이션·버전 업그레이드·DR 구성이 훨씬 간편해진다.

```sql
-- 1. 현재 CDB에서 Unplug (XML 매니페스트 생성)
ALTER PLUGGABLE DATABASE pdb_prod CLOSE IMMEDIATE;
ALTER PLUGGABLE DATABASE pdb_prod UNPLUG INTO '/tmp/pdb_prod.xml';
DROP PLUGGABLE DATABASE pdb_prod KEEP DATAFILES;

-- 2. 다른 CDB에서 Plug
CREATE PLUGGABLE DATABASE pdb_prod
  USING '/tmp/pdb_prod.xml'
  COPY FILE_NAME_CONVERT = ('/old/path', '/new/path');

ALTER PLUGGABLE DATABASE pdb_prod OPEN UPGRADE;  -- 버전 차이 있을 때
```

## Resource Manager로 PDB 자원 제한

하나의 CDB 안에서 PDB 간 CPU·IO 자원 충돌을 막으려면 **Resource Manager**로 할당량을 지정한다.

```sql
-- CDB 레벨 플랜 생성
EXEC DBMS_RESOURCE_MANAGER.create_cdb_plan(
  plan    => 'cdb_plan',
  comment => 'CDB Resource Plan');

-- PDB별 CPU 비율 설정
EXEC DBMS_RESOURCE_MANAGER.create_cdb_plan_directive(
  plan               => 'cdb_plan',
  pluggable_database => 'pdb_prod',
  shares             => 3,          -- 우선순위 비율
  utilization_limit  => 70);        -- CPU 상한 70%

EXEC DBMS_RESOURCE_MANAGER.validate_pending_area;
EXEC DBMS_RESOURCE_MANAGER.submit_pending_area;
ALTER SYSTEM SET resource_manager_plan = 'cdb_plan';
```

## 주요 뷰 정리

| 뷰 | 범위 | 내용 |
|---|---|---|
| `V$PDBS` | CDB 전체 | PDB 목록과 상태 |
| `CDB_USERS` | CDB 전체 | 전체 PDB의 사용자 통합 조회 |
| `DBA_USERS` | 현재 PDB | 현재 PDB의 사용자만 |
| `V$CON_SYSMETRIC` | 현재 PDB | PDB 단위 성능 지표 |

`CDB_*` 뷰는 CDB$ROOT에서 실행하면 모든 PDB의 데이터를 `con_id` 컬럼과 함께 조회할 수 있다.

## 정리

멀티테넌트는 **인프라 통합과 빠른 프로비저닝**을 위한 아키텍처다. 하나의 SGA·프로세스를 공유해 메모리 효율을 높이고, Unplug/Plug로 데이터베이스를 컨테이너처럼 다룰 수 있다. 단, PDB 간 자원 경합과 공통 사용자 관리를 꼼꼼히 설계해야 한다. 다음은 PostgreSQL로 넘어가 아키텍처 전반을 살펴본다.

---

**지난 글:** [NLS와 한국어 환경 설정](/posts/oracle-nls-korean/)

**다음 글:** [PostgreSQL 아키텍처 개요](/posts/pg-architecture-overview/)

<br>
읽어주셔서 감사합니다. 😊
