---
title: "SQL Server SSAS — Analysis Services로 OLAP 큐브와 Tabular 모델 구축"
description: "SSAS Multidimensional와 Tabular 모드의 차이, 큐브 설계, MDX·DAX 쿼리, 프로세싱 전략까지 SQL Server 분석 플랫폼의 전체 그림을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["SQL Server", "SSAS", "OLAP", "Tabular", "MDX", "DAX", "큐브", "분석"]
featured: false
draft: false
---

[지난 글](/posts/mssql-ssis-etl/)에서 SSIS로 ETL 파이프라인을 구성하는 방법을 살펴봤다면, 이번에는 그렇게 쌓아 둔 데이터를 비즈니스 인텔리전스 분석에 활용하는 **SSAS(SQL Server Analysis Services)** 를 다룬다. SSAS는 집계·계층·시간 인텔리전스를 서버 측에서 미리 처리해 Excel, Power BI, SSRS 같은 클라이언트가 빠르게 조회할 수 있도록 설계된 OLAP 엔진이다.

## SSAS 두 가지 모드

SQL Server 2012 이후 SSAS는 두 가지 독립적 모드로 동작한다.

| 항목 | Multidimensional | Tabular |
|---|---|---|
| 저장 방식 | MOLAP(다차원 큐브) / ROLAP | xVelocity 컬럼 스토어 (인메모리) |
| 쿼리 언어 | MDX (주), DAX (부분) | DAX (주), MDX 호환 |
| 적합 사용 | 복잡한 계층·KPI·Write-back | 빠른 개발, Power BI 연동 |
| 메모리 요구 | 낮음 (MOLAP 집계 파일) | 높음 (전체 모델 인메모리) |
| 확장성 | 파티션 + 원격 파티션 | 파티션 증분 처리 |

현재 Microsoft의 투자 방향은 **Tabular 모드**에 집중돼 있으며, Power BI Premium의 Analysis Services 엔진도 Tabular 기반이다. 신규 프로젝트라면 Tabular가 기본 선택이다.

![SSAS 아키텍처 — Multidimensional vs Tabular](/assets/posts/mssql-ssas-analysis-architecture.svg)

## Multidimensional — 큐브와 차원

### 스타 스키마와 큐브 설계

Multidimensional 모드의 핵심은 **팩트 테이블 + 차원 테이블** 스타 스키마다. 큐브는 팩트 테이블의 측정값(Measure)과 차원 테이블의 멤버(Member)를 조합한 다차원 공간으로, 각 차원에 **계층(Hierarchy)** 을 정의해 드릴다운이 가능하다.

```xml
<!-- XMLA: 큐브 파티션 처리 -->
<Batch xmlns="http://schemas.microsoft.com/analysisservices/2003/engine">
  <Process>
    <Object>
      <DatabaseID>AdventureWorksDW</DatabaseID>
      <CubeID>Adventure Works</CubeID>
      <MeasureGroupID>Internet Sales</MeasureGroupID>
      <PartitionID>Internet_Sales_2023</PartitionID>
    </Object>
    <Type>ProcessFull</Type>
  </Process>
</Batch>
```

### MDX 쿼리

MDX(MultiDimensional eXpressions)는 큐브를 쿼리하는 언어다. SQL과 달리 축(Axis) 개념을 사용한다.

```sql
-- 연도별 제품 카테고리 매출 조회
SELECT
  {[Measures].[Internet Sales Amount],
   [Measures].[Internet Order Count]} ON COLUMNS,
  NON EMPTY
    [Date].[Calendar Year].MEMBERS *
    [Product].[Category].MEMBERS    ON ROWS
FROM [Adventure Works]
WHERE [Geography].[Country].[Korea]

-- WITH 절로 계산 멤버 정의
WITH MEMBER [Measures].[Avg Order Value] AS
  [Measures].[Internet Sales Amount] /
  [Measures].[Internet Order Count]
SELECT
  {[Measures].[Internet Sales Amount],
   [Measures].[Avg Order Value]} ON COLUMNS,
  [Date].[Calendar Year].MEMBERS ON ROWS
FROM [Adventure Works]
```

### 계층과 드릴다운

```sql
-- 드릴다운: 연도 → 분기 → 월
SELECT
  [Measures].[Internet Sales Amount] ON COLUMNS,
  DRILLDOWNLEVEL(
    {[Date].[Calendar].[Calendar Year].&[2023]},
    [Date].[Calendar].[Calendar Quarter]
  ) ON ROWS
FROM [Adventure Works]
```

![SSAS 큐브 구조 — 스타 스키마와 계층](/assets/posts/mssql-ssas-analysis-cube.svg)

## Tabular — xVelocity 컬럼 스토어

### 모델 구조

Tabular 모델은 관계형 테이블 구조를 그대로 유지한 채, **xVelocity(VertiPaq) 인메모리 컬럼 스토어**에 데이터를 올린다. 딕셔너리 인코딩 + RLE 압축으로 원본 대비 10분의 1 수준으로 압축되며, 병렬 벡터 연산으로 집계 속도가 매우 빠르다.

```json
// TMSL: Tabular 모델 측정값 추가 (JSON)
{
  "createOrReplace": {
    "object": {
      "database": "SalesTabular",
      "table": "FactInternetSales",
      "measure": "Total Sales"
    },
    "measure": {
      "name": "Total Sales",
      "expression": "SUM(FactInternetSales[SalesAmount])",
      "formatString": "#,##0.00"
    }
  }
}
```

### DAX 측정값과 컨텍스트

DAX(Data Analysis Expressions)의 핵심은 **필터 컨텍스트(Filter Context)** 와 **행 컨텍스트(Row Context)** 다. `CALCULATE`는 필터 컨텍스트를 재정의하는 가장 중요한 함수다.

```sql
-- DAX 측정값 예시
-- 1. 연간 누계 (YTD)
Sales YTD :=
CALCULATE(
    [Total Sales],
    DATESYTD('Date'[Date])
)

-- 2. 전년 동기 대비 증감률
Sales YoY % :=
VAR CurSales = [Total Sales]
VAR PrevSales =
    CALCULATE([Total Sales],
              SAMEPERIODLASTYEAR('Date'[Date]))
RETURN
    IF(PrevSales = 0, BLANK(),
       DIVIDE(CurSales - PrevSales, PrevSales))

-- 3. 상위 N개 제품 필터
TopN Sales :=
CALCULATE(
    [Total Sales],
    TOPN(10, 'Product', [Total Sales])
)
```

### 관계와 행 수준 보안(RLS)

Tabular에서 테이블 간 관계는 **단일 방향(Single) 또는 양방향(Both)** 크로스 필터를 지원한다. 양방향 필터는 편리하지만 성능 비용이 크므로 신중히 사용해야 한다.

```sql
-- 행 수준 보안 (RLS) DAX 표현식
-- DimEmployee 테이블에 적용 — 로그인한 사용자 본인 데이터만
[EmployeeLogin] = USERNAME()

-- 계층적 보안 (부서장은 팀원 데이터도 조회)
OR(
    [EmployeeLogin] = USERNAME(),
    [ManagerLogin] = USERNAME()
)
```

## 프로세싱 전략

### 처리 유형 비교

| 유형 | 설명 | 대상 |
|---|---|---|
| ProcessFull | 기존 데이터 삭제 후 전체 재로드 | Multidim / Tabular |
| ProcessAdd | 기존 데이터 유지, 새 데이터 추가 | Multidim 파티션 |
| ProcessUpdate | 변경된 데이터 반영 | Tabular |
| ProcessIndexes | 인덱스·집계만 재구성 | Multidim |
| ProcessData | 데이터만 로드, 집계 제외 | Multidim |

### SQL Server Agent를 이용한 자동화

```sql
-- SQL Agent Job: 일별 증분 처리
EXEC SSISDB.catalog.start_execution
    @execution_id = (
        SELECT MAX(execution_id)
        FROM SSISDB.catalog.executions
        WHERE package_name = 'ProcessSSAS.dtsx'
    );

-- PowerShell 방식 (T-SQL 내 xp_cmdshell 또는 별도 단계)
-- Invoke-ASCmd -Server "localhost" -InputFile "ProcessPartition.xmla"
```

## SSAS vs Power BI Premium

Power BI Premium의 내부 엔진은 Analysis Services Tabular이므로, SSAS Tabular 모델은 Power BI Premium Datasets로 거의 그대로 이전할 수 있다. 반면 Multidimensional 모델은 직접 이전이 불가능해 Power Query로 재설계가 필요하다.

온프레미스 환경에서 복잡한 큐브·KPI·Write-back이 필요하다면 Multidimensional, 새로 시작하거나 Power BI 연동이 중요하다면 Tabular를 선택하는 것이 현실적인 기준이다.

---

**지난 글:** [SQL Server SSIS — ETL 파이프라인 설계와 데이터 통합](/posts/mssql-ssis-etl/)

**다음 글:** [SQL Server SSRS — 보고서 서버와 구독 보고서 설계](/posts/mssql-ssrs-reporting/)

<br>
읽어주셔서 감사합니다. 😊
