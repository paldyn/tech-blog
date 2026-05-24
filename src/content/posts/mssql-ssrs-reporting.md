---
title: "SQL Server SSRS — 보고서 서버와 구독 보고서 설계"
description: "SSRS 아키텍처, RDL 보고서 구성 요소, 파라미터·구독·캐싱 전략, URL 접근과 ReportViewer 임베드까지 SQL Server 보고서 플랫폼 전반을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["SQL Server", "SSRS", "보고서", "RDL", "구독", "BI", "파라미터"]
featured: false
draft: false
---

[지난 글](/posts/mssql-ssas-analysis/)에서 SSAS로 분석 모델을 구성했다면, 이번에는 그 결과를 사람이 읽을 수 있는 보고서로 전달하는 **SSRS(SQL Server Reporting Services)** 를 살펴본다. SSRS는 T-SQL·MDX 쿼리를 실행해 표·차트·행렬 등의 레이아웃으로 렌더링하고, 이메일·파일 공유·웹 포털 등 다양한 채널로 배포하는 서버 기반 보고서 플랫폼이다.

## SSRS 아키텍처

SSRS는 크게 **Report Server 서비스**, **Report Server DB** (두 개의 SQL Server 데이터베이스), **Web Portal**로 구성된다. Report Server는 보고서 정의(RDL) 파일을 해석하고 데이터 원본에서 데이터를 가져와 지정된 포맷으로 렌더링한다. Report Server DB(`ReportServer`, `ReportServerTempDB`)에는 RDL 정의·구독 설정·실행 히스토리·스냅샷 캐시 등이 저장된다.

![SSRS 아키텍처 — 보고서 서버 컴포넌트](/assets/posts/mssql-ssrs-reporting-architecture.svg)

### 보고서 서버 구성 모드

| 모드 | 설명 | 사용 |
|---|---|---|
| Native 모드 | 독립 웹 서버로 동작 | 대부분의 배포 |
| SharePoint 통합 모드 | SharePoint 문서 라이브러리에 저장 | 사내 포털 통합 (레거시) |
| Power BI Report Server | Power BI 보고서 + SSRS 통합 | 온프레미스 최신 선택 |

## RDL 보고서 파일 구성

보고서의 실체는 **RDL(Report Definition Language)** 이라는 XML 파일이다. Visual Studio(SSDT) 또는 Report Builder로 디자인한다.

### 핵심 요소

**DataSource** — 연결 문자열을 저장. 공유 데이터 원본(서버 공유)과 내장 데이터 원본(RDL 포함) 두 가지가 있다. 공유 데이터 원본을 사용하면 연결 정보를 한 곳에서 관리할 수 있다.

**DataSet** — DataSource에서 데이터를 가져오는 쿼리(T-SQL, MDX 등). 파라미터는 `@ParamName` 형식으로 DataSet 쿼리와 보고서 파라미터를 연결한다.

**Report Items** — 실제 레이아웃 요소:
- **Table**: 열이 고정된 행 반복
- **Matrix(Tablix)**: 행·열 모두 동적 (피벗 표현)
- **Chart**: 막대·선·파이·게이지 등
- **List**: 자유 배치 반복 컨테이너

![RDL 보고서 구성 요소와 구독 유형](/assets/posts/mssql-ssrs-reporting-rdl.svg)

### Expressions

SSRS의 모든 속성은 VB.NET 기반 Expression으로 동적 제어할 수 있다.

```vb
' 매출이 임계값 초과 시 빨간색으로 강조
=IIF(Fields!SalesAmount.Value > 1000000, "Red", "Black")

' 전년 대비 증감 표시
=IIF(Fields!GrowthRate.Value >= 0,
     "▲ " & Format(Fields!GrowthRate.Value, "P1"),
     "▼ " & Format(Fields!GrowthRate.Value, "P1"))

' 합계 소계 계산 (집계 함수)
=Sum(Fields!SalesAmount.Value, "DataSet1")
=RunningValue(Fields!SalesAmount.Value, Sum, "DataSet1")
```

## 파라미터 설계

파라미터는 보고서를 동적으로 만드는 핵심이다. **캐스케이딩 파라미터**는 앞 파라미터 선택에 따라 다음 파라미터의 유효 값 목록이 바뀐다.

```sql
-- Dataset: 지역 목록 (첫 번째 파라미터)
SELECT RegionCode, RegionName
FROM DimRegion
ORDER BY RegionName;

-- Dataset: 도시 목록 (두 번째 파라미터 — @Region에 의존)
SELECT CityCode, CityName
FROM DimCity
WHERE RegionCode = @Region
ORDER BY CityName;

-- 메인 Dataset: 두 파라미터 모두 사용
SELECT o.OrderDate, p.ProductName,
       SUM(od.SalesAmount) AS SalesAmount
FROM FactOrders o
JOIN DimProduct p ON o.ProductKey = p.ProductKey
WHERE o.RegionCode = @Region
  AND o.CityCode   = @City
  AND o.OrderDate BETWEEN @StartDate AND @EndDate
GROUP BY o.OrderDate, p.ProductName;
```

## 구독과 배포

### 표준 구독 vs 데이터 기반 구독

```sql
-- 구독 실행 히스토리 조회
SELECT
    c.Name          AS ReportName,
    s.Description   AS SubscriptionDesc,
    s.LastStatus,
    s.LastRunTime,
    s.EventType     AS TriggerType
FROM ReportServer.dbo.Subscriptions s
JOIN ReportServer.dbo.Catalog c
  ON s.Report_OID = c.ItemID
WHERE s.LastRunTime >= DATEADD(DAY, -7, GETDATE())
ORDER BY s.LastRunTime DESC;
```

**데이터 기반 구독**은 수신자 목록과 파라미터 값을 SQL 쿼리로 동적으로 결정한다. 예를 들어 영업 담당자별로 자신의 지역 데이터만 담긴 보고서를 자동 발송하는 데 사용한다.

```sql
-- 데이터 기반 구독용 수신자 쿼리
-- 각 영업 담당자 이메일 + 담당 RegionCode를 한 행씩 반환
SELECT
    e.Email           AS TO,
    e.RegionCode      AS Region,   -- 보고서 파라미터
    'PDF'             AS RenderFormat,
    e.EmployeeName + '님 담당 지역 주간 보고서' AS Subject
FROM DimEmployee e
WHERE e.IsActive = 1
  AND e.HasRegionReport = 1;
```

### 캐싱 전략

보고서가 무거운 쿼리를 실행한다면 **캐시 새로 고침 계획**으로 미리 결과를 준비해 두는 것이 좋다.

```sql
-- 캐시 만료 정책 설정 (T-SQL, ReportServer DB)
-- 특정 보고서의 캐시 유지 시간을 30분으로 설정
EXEC ReportServer.dbo.AddReportToCache
    @ReportPath = '/Sales/MonthlySales',
    @CacheExpirationMinutes = 30;

-- 스냅샷 이력 관리
-- 보고서 실행 스냅샷 보관 건수 제한
EXEC ReportServer.dbo.SetReportHistoryOptions
    @ReportPath = '/Sales/MonthlySales',
    @UseHistorySnapshot = 1,
    @MaxSnapshotCount = 12;  -- 12개 이력 보관
```

## URL 접근과 ReportViewer 임베드

### URL 파라미터

SSRS는 URL로 보고서를 직접 호출할 수 있다. `rs:` 접두사는 렌더링 지시, `rc:` 접두사는 뷰어 컨트롤 지시, 나머지는 보고서 파라미터다.

```text
http://reportserver/reportserver?
  /Sales/MonthlySales
  &StartDate=2026-01-01
  &EndDate=2026-03-31
  &Region=KR
  &rs:Format=Excel
  &rc:Toolbar=false
```

### ASP.NET ReportViewer 컨트롤

```csharp
// ReportViewer 서버 처리 모드 (원격 처리)
reportViewer1.ProcessingMode = ProcessingMode.Remote;
reportViewer1.ServerReport.ReportServerUrl =
    new Uri("http://reportserver/reportserver");
reportViewer1.ServerReport.ReportPath =
    "/Sales/MonthlySales";

// 파라미터 바인딩
var parameters = new[]
{
    new ReportParameter("StartDate", "2026-01-01"),
    new ReportParameter("EndDate",   "2026-03-31"),
    new ReportParameter("Region",    "KR")
};
reportViewer1.ServerReport.SetParameters(parameters);
reportViewer1.RefreshReport();
```

## 성능 고려사항

| 문제 | 원인 | 해결 |
|---|---|---|
| 첫 렌더 느림 | 쿼리 실행 비용 | 캐시 새로 고침 계획 |
| 행 수 많음 | 렌더링 메모리 | 파라미터로 범위 한정 |
| 파라미터 목록 느림 | 유효 값 쿼리 비용 | 공유 DataSet + 캐시 |
| 구독 동시 다발 | Agent Job 충돌 | 구독 스케줄 분산 |

SSRS는 동적 분석보다 **정형화된 정기 보고서** 배포에 강점이 있다. 자유 분석이나 인터랙티브 대시보드는 Power BI, 정기 배포 보고서는 SSRS라는 역할 분담이 실무에서 흔한 조합이다.

---

**지난 글:** [SQL Server SSAS — Analysis Services로 OLAP 큐브와 Tabular 모델 구축](/posts/mssql-ssas-analysis/)

**다음 글:** [SQLite 라이브러리 형태와 임베디드 활용](/posts/sqlite-library-form/)

<br>
읽어주셔서 감사합니다. 😊
