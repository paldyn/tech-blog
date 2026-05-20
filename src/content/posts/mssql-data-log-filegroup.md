---
title: "SQL Server 데이터 파일·로그 파일·파일 그룹 — 저장소 구조 완전 가이드"
description: "SQL Server의 MDF/NDF/LDF 파일 구조, VLF 원리, FileGroup 설계, 파일 사전 할당 전략, 자동 증가 설정 모범 사례를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "MDF", "LDF", "FileGroup", "VLF", "파일관리", "트랜잭션로그"]
featured: false
draft: false
---

[지난 글](/posts/mssql-buffer-pool-plan-cache/)에서 버퍼 풀과 플랜 캐시를 살펴봤다. 이번 글에서는 SQL Server의 물리적 저장소 구조인 **데이터 파일·로그 파일·파일 그룹**을 다룬다. 파일 구조를 이해하면 I/O 최적화와 올바른 자동 증가 설정이 가능해진다.

## 파일 종류

SQL Server 데이터베이스는 세 종류의 파일로 구성된다.

| 확장자 | 이름 | 역할 |
|---|---|---|
| `.mdf` | Primary Data File | 주 데이터 파일. FileGroup PRIMARY에 속함 |
| `.ndf` | Secondary Data File | 보조 데이터 파일. 추가 FileGroup에 배치 가능 |
| `.ldf` | Log File | 트랜잭션 로그. FileGroup에 속하지 않음 |

![SQL Server 파일 구조](/assets/posts/mssql-data-log-filegroup-structure.svg)

```sql
-- 새 데이터베이스 생성 예시
CREATE DATABASE AdventureWorks
ON PRIMARY (
    NAME = 'AW_Primary',
    FILENAME = 'D:\data\AW.mdf',
    SIZE = 1024MB,
    FILEGROWTH = 512MB
),
FILEGROUP UserData (
    NAME = 'AW_UserData_1',
    FILENAME = 'E:\data\AW_ud1.ndf',
    SIZE = 2048MB,
    FILEGROWTH = 512MB
),
(
    NAME = 'AW_UserData_2',
    FILENAME = 'F:\data\AW_ud2.ndf',
    SIZE = 2048MB,
    FILEGROWTH = 512MB
)
LOG ON (
    NAME = 'AW_Log',
    FILENAME = 'L:\log\AW.ldf',
    SIZE = 2048MB,
    FILEGROWTH = 512MB
);
```

## FileGroup 전략

FileGroup은 데이터 파일을 논리적으로 묶은 그룹이다. 테이블이나 인덱스를 특정 FileGroup에 배치하면 I/O 분산 및 파티셔닝 관리가 용이해진다.

```sql
-- 기본 FileGroup 변경
ALTER DATABASE AdventureWorks
MODIFY FILEGROUP UserData DEFAULT;

-- 특정 FileGroup에 테이블 생성
CREATE TABLE Orders (
    OrderID     INT IDENTITY PRIMARY KEY,
    CustomerID  INT NOT NULL,
    OrderDate   DATE NOT NULL,
    Amount      DECIMAL(12,2)
) ON UserData;

-- 인덱스를 다른 FileGroup에 배치 (I/O 분산)
CREATE INDEX IX_Orders_Customer
ON Orders(CustomerID) ON IndexGroup;

-- 현재 FileGroup 정보
SELECT
    ds.name AS filegroup_name,
    ds.type_desc,
    mf.name AS file_name,
    mf.physical_name,
    mf.size * 8 / 1024 AS size_mb
FROM sys.filegroups ds
JOIN sys.database_files mf
  ON ds.data_space_id = mf.data_space_id;
```

## 트랜잭션 로그와 VLF

로그 파일(`.ldf`)은 순환 재사용 방식으로 동작하며 내부적으로 **VLF(Virtual Log File)** 단위로 나뉜다.

- **활성(Active) VLF**: 아직 백업되지 않은 트랜잭션 로그 포함. 덮어쓸 수 없음
- **비활성(Inactive) VLF**: 로그 백업 후 재사용 가능

```sql
-- VLF 정보 조회
DBCC LOGINFO('AdventureWorks');
-- file_id, file_size, start_offset, vlf_sequence_number, status, parity, create_lsn
-- status=2 → Active VLF

-- 전체 VLF 수 집계 (100개 이상이면 파편화 심각)
USE AdventureWorks;
SELECT COUNT(*) AS vlf_count FROM sys.dm_db_log_info(DB_ID());
```

**VLF가 과도하게 많아지는 원인**: 초기 로그 파일 크기가 작고 % 기반 자동 증가로 설정된 경우다. 매 증가마다 새 VLF가 추가되어 수천 개로 늘어날 수 있다.

![파일 증가 전략](/assets/posts/mssql-data-log-filegroup-vlf.svg)

## 자동 증가 모범 사례

```sql
-- 현재 자동 증가 설정 확인
SELECT
    name,
    size * 8 / 1024 AS current_mb,
    growth,
    is_percent_growth,
    max_size
FROM sys.database_files;

-- 데이터 파일: 고정 크기 증가 설정
ALTER DATABASE AdventureWorks MODIFY FILE (
    NAME = 'AW_Primary',
    FILEGROWTH = 512MB   -- 고정 크기 (% 아님)
);

-- 로그 파일: 고정 크기 증가 + 사전 충분 할당
ALTER DATABASE AdventureWorks MODIFY FILE (
    NAME = 'AW_Log',
    SIZE = 4096MB,        -- 예상 최대 크기로 사전 할당
    FILEGROWTH = 512MB
);
```

**TF 1117**: 한 파일 그룹 내 파일들이 동시에 같은 비율로 증가 (SQL Server 2016+에서 기본 활성화)

**TF 1118**: 균일한 익스텐트 할당 (SQL Server 2016+에서 기본 활성화)

## 즉시 파일 초기화 (IFI)

SQL Server가 새 데이터 파일을 할당하거나 크기를 늘릴 때 Windows는 기본적으로 0으로 초기화한다. 이 과정이 수 분이 걸릴 수 있다. **IFI(Instant File Initialization)**를 활성화하면 데이터 파일 초기화를 건너뛰어 증가가 즉시 완료된다.

```bash
# Windows: SQL Server 서비스 계정에 "볼륨 관리 작업 수행" 권한 부여
# (Local Security Policy → User Rights Assignment)
# → SE_MANAGE_VOLUME_NAME

# 확인 방법 (SQL Server 2016+)
SELECT instant_file_initialization_enabled
FROM sys.dm_server_services
WHERE servicename LIKE 'SQL Server%';
```

로그 파일은 IFI 적용 불가 — 항상 0으로 초기화된다 (보안상 이유).

## 파일 공간 모니터링

```sql
-- 파일 여유 공간 확인
SELECT
    name,
    size * 8 / 1024                            AS total_mb,
    FILEPROPERTY(name, 'SpaceUsed') * 8 / 1024 AS used_mb,
    (size - FILEPROPERTY(name, 'SpaceUsed')) * 8 / 1024 AS free_mb
FROM sys.database_files;

-- DB별 사용량 요약
EXEC sp_spaceused;

-- 테이블별 공간 사용량
SELECT
    OBJECT_NAME(object_id) AS table_name,
    reserved_page_count * 8 / 1024 AS reserved_mb,
    used_page_count * 8 / 1024     AS used_mb
FROM sys.dm_db_partition_stats
ORDER BY reserved_page_count DESC;
```

데이터 파일과 로그 파일을 별도 드라이브(특히 로그 파일은 전용 I/O 경로)에 배치하는 것이 I/O 성능 최적화의 기본이다. 다음 글부터는 T-SQL 문법 시리즈를 시작한다.

---

**지난 글:** [SQL Server 버퍼 풀과 플랜 캐시](/posts/mssql-buffer-pool-plan-cache/)

**다음 글:** [T-SQL 핵심 문법 — SQL Server 전용 확장](/posts/tsql-syntax-essentials/)

<br>
읽어주셔서 감사합니다. 😊
