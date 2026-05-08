---
title: "Oracle 인스턴스와 데이터베이스"
description: "Oracle에서 '인스턴스'(메모리+프로세스)와 '데이터베이스'(디스크 파일 집합)가 어떻게 구분되는지, NOMOUNT/MOUNT/OPEN 기동 단계, 클라이언트 연결 경로와 SID·DB_NAME 식별자를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["oracle", "instance", "database", "sga", "pga", "startup", "listener", "sid", "architecture"]
featured: false
draft: false
---

[지난 글](/posts/sql-statistics-selectivity/)에서 CBO 통계와 선택도를 다뤘다. 이제 Oracle 특화 시리즈로 넘어간다. Oracle의 첫 번째 핵심 개념은 **인스턴스(Instance)와 데이터베이스(Database)의 분리**다.

---

## 인스턴스 ≠ 데이터베이스

많은 개발자가 Oracle을 "오라클 데이터베이스"라 부르며 하나로 생각하지만, Oracle은 이 두 개념을 명확히 구분한다.

| 구분 | 인스턴스 (Instance) | 데이터베이스 (Database) |
|------|---------------------|------------------------|
| 위치 | 서버 메모리 + 프로세스 | 디스크 파일 |
| 영속성 | 서버 재기동 시 사라짐 | 전원이 꺼져도 유지 |
| 식별자 | `ORACLE_SID` | `DB_NAME` |
| 구성 | SGA + PGA + 백그라운드 프로세스 | 데이터 파일 + Redo Log + Control 파일 |

![Oracle 인스턴스와 데이터베이스 구조](/assets/posts/oracle-instance-vs-database-arch.svg)

---

## 인스턴스 구성 요소

### SGA (System Global Area)

모든 서버 프로세스와 백그라운드 프로세스가 **공유**하는 메모리 영역이다.

- **Buffer Cache**: 디스크에서 읽은 데이터 블록을 캐싱한다.
- **Shared Pool**: 파싱된 SQL(Library Cache)과 데이터 딕셔너리(Dictionary Cache)를 저장한다.
- **Redo Log Buffer**: 변경 내역을 LGWR가 디스크에 쓰기 전 임시 보관한다.
- **Large Pool**: 병렬 쿼리·RMAN 등 대형 메모리 작업용.

### PGA (Program Global Area)

각 서버 프로세스에 **개별 할당**되는 메모리다. 정렬 버퍼, 해시 조인 영역, 세션 상태 등이 여기에 저장된다.

### 백그라운드 프로세스

Oracle을 기동하면 자동으로 시작되는 핵심 프로세스들이다(다음 포스트에서 상세히 다룬다).

---

## 데이터베이스 구성 파일

```sql
-- 데이터 파일 확인
SELECT file#, name, bytes/1024/1024 AS mb
FROM v$datafile;

-- Redo Log 그룹 확인
SELECT group#, members, bytes/1024/1024 AS mb, status
FROM v$log;

-- Control 파일 확인
SELECT name FROM v$controlfile;
```

---

## 기동 단계 (Startup Sequence)

![클라이언트 연결 경로](/assets/posts/oracle-instance-vs-database-connection.svg)

Oracle 기동은 3단계로 나뉜다.

```sql
-- SQL*Plus로 기동 제어
STARTUP NOMOUNT;    -- 1단계: 파라미터 파일 읽어 SGA 생성
ALTER DATABASE MOUNT;   -- 2단계: Control 파일 읽기
ALTER DATABASE OPEN;    -- 3단계: 데이터 파일·Redo 열기

-- 한번에 OPEN까지
STARTUP;

-- 종료
SHUTDOWN IMMEDIATE;
```

| 단계 | 파라미터 파일 | Control 파일 | 데이터 파일 |
|------|-------------|--------------|-------------|
| NOMOUNT | ✓ | ✗ | ✗ |
| MOUNT | ✓ | ✓ | ✗ |
| OPEN | ✓ | ✓ | ✓ |

MOUNT 단계는 Control 파일만 열어 DB 복구 작업이나 ARCHIVELOG 모드 변경에 사용된다.

---

## 연결 식별자

### ORACLE_SID

운영체제 환경변수로, 로컬 호스트의 어떤 인스턴스에 연결할지 지정한다.

```bash
export ORACLE_SID=ORCL
sqlplus / as sysdba
```

### TNS (Transparent Network Substrate)

원격 클라이언트는 `tnsnames.ora` 또는 Easy Connect 방식으로 연결한다.

```bash
# Easy Connect (Oracle 10g+)
sqlplus user/password@hostname:1521/ORCL

# TNS 이름 사용
sqlplus user/password@mydb_tns
```

---

## RAC: 다중 인스턴스 × 하나의 데이터베이스

Oracle RAC(Real Application Clusters)는 **여러 인스턴스가 하나의 데이터베이스 파일을 공유**하는 구성이다. 각 노드에 인스턴스가 하나씩 있고, 공유 스토리지 위의 데이터 파일은 동일하다. 이것이 "인스턴스 ≠ 데이터베이스" 분리 개념이 중요한 이유다.

```sql
-- RAC 환경에서 인스턴스 목록 확인
SELECT inst_id, instance_name, host_name, status
FROM gv$instance;
```

---

**지난 글:** [통계와 선택도](/posts/sql-statistics-selectivity/)

**다음 글:** [Oracle 메모리 구조 (SGA·PGA·UGA)](/posts/oracle-memory-sga-pga-uga/)

<br>
읽어주셔서 감사합니다. 😊
