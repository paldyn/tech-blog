---
title: "SQL Server SSIS — ETL 파이프라인 설계와 데이터 통합"
description: "SSIS(SQL Server Integration Services)의 Control Flow·Data Flow 아키텍처, 전체·증분·SCD Type 2 적재 패턴, 성능 최적화 기법과 SSISDB 카탈로그 배포 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "SSIS", "ETL", "데이터통합", "DW", "SCD"]
featured: false
draft: false
---

[지난 글](/posts/mssql-rls-always-encrypted/)에서 SQL Server 데이터 보안을 다뤘다. 이번에는 데이터 웨어하우스(DW) 구축의 핵심인 **SSIS(SQL Server Integration Services)** — SQL Server 생태계의 ETL 도구를 살펴본다.

## SSIS란 무엇인가

SSIS는 SQL Server에 포함된 ETL(Extract-Transform-Load) 플랫폼이다. 다양한 소스(SQL Server, Oracle, CSV, REST API, Excel 등)에서 데이터를 추출하고, 변환 컴포넌트로 정제·병합·분기한 뒤, 목적지 DW나 데이터 마트에 적재한다. Visual Studio(SSDT) 기반 GUI 디자이너로 파이프라인을 시각적으로 구성한다.

![SSIS 패키지 아키텍처](/assets/posts/mssql-ssis-etl-architecture.svg)

## 핵심 개념: Control Flow vs Data Flow

SSIS 패키지는 두 레이어로 구성된다.

**Control Flow**는 작업 실행 순서와 조건 분기를 제어하는 워크플로 레이어다. Execute SQL Task(스테이징 TRUNCATE, 후처리), Data Flow Task(실제 ETL), File System Task, Send Mail Task 등을 순서와 조건에 따라 연결한다. 실패 시 알림 전송, 성공 시 다음 단계 이동 같은 분기를 표현한다.

**Data Flow Task**는 메모리 기반 스트리밍 파이프라인이다. Source 컴포넌트 → 변환(Transform) 컴포넌트 → Destination 컴포넌트로 데이터가 버퍼 단위로 흐른다. 메모리를 최대한 활용해 디스크 IO를 줄이고 성능을 극대화한다.

주요 변환 컴포넌트:
- **Lookup**: 참조 테이블에서 일치하는 값을 찾아 컬럼 추가
- **Merge Join**: 두 정렬된 스트림을 SQL JOIN처럼 결합
- **Derived Column**: 수식으로 새 컬럼 계산
- **Data Conversion**: 데이터 타입 변환
- **Conditional Split**: 조건에 따라 데이터 행 분기 (정상/오류 행 분리)

## 적재 패턴

![SSIS 주요 적재 패턴 비교](/assets/posts/mssql-ssis-etl-patterns.svg)

**Full Load**: 매 실행마다 스테이징을 TRUNCATE하고 전체를 재적재한다. 구현이 단순하지만 대용량에서 시간이 많이 걸린다. 소용량 참조 테이블·코드 테이블에 적합하다.

**Incremental Load (증분)**: 마지막 실행 시점 이후 변경된 데이터만 추출해 적재한다. 소스 테이블에 `UpdatedAt` 컬럼이 있거나 CDC(Change Data Capture)가 활성화된 경우 적용한다.

```sql
-- 마지막 실행 시간 이후 변경된 행만 추출
DECLARE @LastRun DATETIME = (SELECT LastRunTime FROM dbo.ETL_Control WHERE JobName = 'Orders');

SELECT * FROM dbo.Orders
WHERE  UpdatedAt > @LastRun;

-- 실행 완료 후 LastRunTime 갱신
UPDATE dbo.ETL_Control SET LastRunTime = GETDATE() WHERE JobName = 'Orders';
```

**SCD Type 2 (천천히 변하는 차원)**: DW Dimension 테이블에서 값이 변경될 때 기존 행을 만료 처리하고 새 행을 추가해 이력을 보존한다. SSIS의 SCD Wizard가 기본 지원하지만 대용량에서는 직접 MERGE 문으로 구현하는 것이 더 빠르다.

```sql
-- SCD Type 2: MERGE로 구현
MERGE INTO dim_Customers AS target
USING staging_Customers AS source
  ON target.CustomerKey = source.CustomerID AND target.IsCurrent = 1
WHEN MATCHED AND (target.Address <> source.Address OR target.Tier <> source.Tier)
  THEN UPDATE SET target.IsCurrent = 0, target.ExpiryDate = CAST(GETDATE() AS DATE)
WHEN NOT MATCHED BY TARGET
  THEN INSERT (CustomerKey, Name, Address, Tier, EffectiveDate, ExpiryDate, IsCurrent)
       VALUES (source.CustomerID, source.Name, source.Address, source.Tier,
               CAST(GETDATE() AS DATE), '9999-12-31', 1);

-- 만료된 행의 새 버전 삽입 (MERGE에서 직접 처리 어려워 별도 INSERT)
INSERT INTO dim_Customers (CustomerKey, Name, Address, Tier, EffectiveDate, ExpiryDate, IsCurrent)
SELECT source.CustomerID, source.Name, source.Address, source.Tier,
       CAST(GETDATE() AS DATE), '9999-12-31', 1
FROM   staging_Customers source
JOIN   dim_Customers target ON target.CustomerKey = source.CustomerID
WHERE  target.IsCurrent = 0 AND target.ExpiryDate = CAST(GETDATE() AS DATE);
```

## SSISDB 카탈로그 배포

SSIS 2012 이상에서는 SSISDB 카탈로그에 패키지를 배포한다. 프로젝트 단위로 배포되고, 환경 변수(연결 문자열, 파라미터)를 DB에 저장해 여러 환경(개발·스테이징·프로덕션)에 같은 패키지를 쓸 수 있다.

```sql
-- 패키지 실행 (T-SQL로 호출)
DECLARE @execution_id BIGINT;

EXEC SSISDB.catalog.create_execution
  @package_name    = N'LoadOrders.dtsx',
  @project_name    = N'SalesETL',
  @folder_name     = N'DataWarehouse',
  @use32bitruntime = 0,
  @execution_id    = @execution_id OUTPUT;

EXEC SSISDB.catalog.set_execution_parameter_value
  @execution_id,
  @object_type      = 50,  -- 실행 파라미터
  @parameter_name   = N'SYNCHRONIZED',
  @parameter_value  = 1;

EXEC SSISDB.catalog.start_execution @execution_id;

-- 실행 결과 확인
SELECT execution_id, status, start_time, end_time
FROM   SSISDB.catalog.executions
WHERE  execution_id = @execution_id;
```

## SSIS 대안 고려

현재는 Azure Data Factory, dbt, Apache Spark 기반 현대 ETL 도구가 SSIS를 대체하는 추세다. 온프레미스 SQL Server 환경에서 기존 SSIS 패키지가 많다면 유지가 합리적이지만, 새 프로젝트에는 클라우드 네이티브 툴도 검토할 필요가 있다.

## 정리

SSIS는 SQL Server 환경의 ETL 표준 도구다. Control Flow로 워크플로를 제어하고, Data Flow Task로 메모리 스트리밍 파이프라인을 구성하며, SSISDB 카탈로그로 다중 환경 배포를 관리한다. 적재 패턴은 데이터 크기와 이력 요건에 따라 Full / Incremental / SCD Type 2 중 선택하고, Bulk-Logged 모드와 인덱스 비활성화로 성능을 최대화한다.

---

**지난 글:** [SQL Server 행 수준 보안 · Always Encrypted — 데이터 접근 제어](/posts/mssql-rls-always-encrypted/)

<br>
읽어주셔서 감사합니다. 😊
