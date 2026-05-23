---
title: "SQL Server 카디널리티 추정기 — 실행 계획 품질의 핵심"
description: "SQL Server 카디널리티 추정기(CE)가 통계와 히스토그램을 어떻게 활용해 행 수를 예측하는지, CE 70·120·150의 차이와 오추정 진단·해결 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "카디널리티추정기", "실행계획", "통계", "QueryStore", "CE150"]
featured: false
draft: false
---

[지난 글](/posts/mssql-memory-optimized-hekaton/)에서 In-Memory OLTP로 트랜잭션 처리량을 극한으로 끌어올리는 방법을 살펴봤다. 이번에는 시선을 조금 달리해, SQL Server 옵티마이저가 실행 계획을 선택하는 근거인 **카디널리티 추정기(Cardinality Estimator, CE)** 를 깊이 파헤친다.

## CE란 무엇인가

SQL Server가 쿼리를 받으면 옵티마이저는 수백 가지 실행 계획 후보를 만들고 그 중 비용이 가장 낮은 것을 선택한다. 비용 계산의 핵심 변수는 **"각 연산에서 몇 행이 처리되는가"** 다. 이 행 수를 예측하는 모듈이 CE다.

CE 추정이 10배 틀리면 옵티마이저는 Nested Loops 대신 Hash Join을 선택하거나, 인덱스 Seek 대신 Table Scan을 선택할 수 있다. 실제 행 수와 추정값 사이의 간극이 성능 문제의 가장 흔한 원인 중 하나다.

![카디널리티 추정기 동작 원리](/assets/posts/mssql-cardinality-estimator-model.svg)

## CE가 사용하는 통계 정보

CE의 입력은 세 가지다.

**히스토그램(Histogram)**: 각 인덱스·통계 객체마다 최대 200개의 스텝(Step)으로 값 분포를 기록한다. 각 스텝은 범위의 상한값(RANGE_HI_KEY), 해당 범위 행 수(RANGE_ROWS), 상한값과 정확히 일치하는 행 수(EQ_ROWS) 등을 담는다.

**밀도 벡터(Density Vector)**: 열(또는 열 조합)의 선택도(selectivity)를 `1 / DISTINCT_COUNT` 형태로 저장한다. 특정 값이 매우 드물거나 매우 편중된 경우(skew) 히스토그램에 그 구간이 없으면 밀도 벡터만으로 추정해 오차가 커진다.

**메타정보**: 전체 행 수, 평균 행 길이, NULL 비율 등이다.

```sql
-- 통계 히스토그램 직접 확인
DBCC SHOW_STATISTICS ('Orders', 'IX_Orders_CustomerID');
-- STAT_HEADER / DENSITY_VECTOR / HISTOGRAM 세 결과셋 반환
```

## CE 버전: 70 → 120 → 150

SQL Server 2014(호환성 수준 120)에서 CE가 대폭 재설계됐다. 새 CE는 여러 열 조건 간 독립성 가정을 완화하고, 선택도 추정 알고리즘을 개선했다.

SQL Server 2019(수준 150)에서는 배치 모드 적응 조인, 메모리 부여 피드백(Memory Grant Feedback), 인터리브 실행(Interleaved Execution) 등 Intelligent Query Processing 기능이 추가됐고, CE도 이와 연동된다.

```sql
-- 현재 DB 호환성 수준 확인
SELECT name, compatibility_level
FROM   sys.databases
WHERE  name = DB_NAME();

-- 수준 변경 (CE 버전도 함께 변경됨)
ALTER DATABASE AdventureWorks
  SET COMPATIBILITY_LEVEL = 150;
```

호환성 수준 변경 후 플랜이 급격히 나빠지면 CE 재설계가 원인일 수 있다. 이때는 데이터베이스 범위 구성으로 CE만 레거시로 되돌릴 수 있다.

```sql
-- DB 범위에서만 CE 70 사용 (호환성 수준은 유지)
ALTER DATABASE SCOPED CONFIGURATION
  SET LEGACY_CARDINALITY_ESTIMATION = ON;
```

## 오추정 진단과 해결

![CE 오추정 진단과 해결](/assets/posts/mssql-cardinality-estimator-fix.svg)

실행 계획에서 Estimated Rows와 Actual Rows가 크게 다르면(10배 이상) CE 오추정을 의심한다. 원인별 처방은 다음과 같다.

**통계 오래됨**: 대용량 삽입·삭제 후 자동 통계 갱신이 아직 안 된 경우. `UPDATE STATISTICS` + `WITH FULLSCAN` 으로 해결한다.

**데이터 편중(Skew)**: 특정 값이 전체의 90%를 차지하는데 히스토그램 스텝이 그 경계를 놓친 경우. 필터된 통계(Filtered Statistics)를 생성하거나, 통계 샘플 비율을 높인다.

**다중 열 상관관계**: CE는 기본적으로 각 열 조건이 독립이라고 가정한다. `CustomerID = 42 AND Status = 'PAID'` 처럼 두 열이 실제로 강한 상관관계를 가지면 추정이 크게 벗어난다. 다중열 통계 생성으로 완화할 수 있다.

```sql
-- 다중열 통계로 상관관계 반영
CREATE STATISTICS stat_cust_status
  ON Orders(CustomerID, Status)
  WITH FULLSCAN;
```

**암묵적 변환**: 파라미터 타입과 열 타입이 다르면 히스토그램을 사용하지 못하고 평균 밀도로만 추정한다. 파라미터 타입을 열 타입과 일치시키는 것이 근본 해결이다.

## Query Store로 CE 회귀 감지

SQL Server 2016 이상에서 Query Store를 활성화하면 쿼리별로 실제 행 수와 추정 행 수를 시계열로 쌓는다. 통계 갱신이나 호환성 수준 변경 이후 성능이 떨어진 쿼리를 'Regressed Queries' 보고서로 자동 감지하고, 이전 플랜을 강제(Force Plan)할 수 있다.

```sql
-- Query Store 활성화
ALTER DATABASE AdventureWorks
  SET QUERY_STORE = ON
  (OPERATION_MODE = READ_WRITE,
   MAX_STORAGE_SIZE_MB = 1000,
   QUERY_CAPTURE_MODE = AUTO);

-- 상위 CE 오차 쿼리 조회
SELECT TOP 10
       qsp.query_id,
       qsrs.avg_logical_io_reads,
       qsrs.avg_rowcount          AS actual_rows,
       qsp.avg_estimated_rowcount AS est_rows
FROM   sys.query_store_plan           qsp
JOIN   sys.query_store_runtime_stats  qsrs
         ON qsp.plan_id = qsrs.plan_id
ORDER  BY ABS(qsrs.avg_rowcount - qsp.avg_estimated_rowcount) DESC;
```

## 정리

카디널리티 추정기는 실행 계획 품질의 1번 결정 요인이다. 통계를 최신 상태로 유지하고, 다중열 상관관계에 대응하는 통계를 추가하며, Query Store로 회귀를 조기에 감지하는 것이 핵심이다. 호환성 수준 변경 전에는 반드시 Query Store로 기준선(baseline)을 수집하고, 변경 후 24~48시간 플랜 품질을 모니터링해야 한다.

---

**지난 글:** [SQL Server In-Memory OLTP — Hekaton 메모리 최적화 테이블](/posts/mssql-memory-optimized-hekaton/)

**다음 글:** [SQL Server 플랜 캐시와 Query Store — 실행 계획 재사용과 관리](/posts/mssql-plan-cache-query-store/)

<br>
읽어주셔서 감사합니다. 😊
