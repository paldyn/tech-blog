---
title: "SQL Server 파티셔닝 — Sliding Window 패턴"
description: "SQL Server 테이블 파티셔닝의 구성 요소(파티션 함수·스킴·인덱스)와 Sliding Window 패턴으로 오래된 데이터를 메타데이터 조작만으로 아카이브하는 실전 절차를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "파티셔닝", "SlidingWindow", "SWITCH", "대용량", "아카이브"]
featured: false
draft: false
---

[지난 글](/posts/mssql-dmv-diagnostics/)에서 DMV로 성능 병목을 실시간 진단하는 방법을 살펴봤다. 이번에는 수억 건 이상의 대용량 테이블을 효율적으로 관리하는 **테이블 파티셔닝**과, 그 핵심 패턴인 **Sliding Window** 를 실전 절차와 함께 정리한다.

## 파티셔닝이 필요한 이유

단일 테이블에 몇 년치 데이터가 쌓이면 두 가지 문제가 발생한다. 첫째, 오래된 데이터를 삭제하려면 수억 건을 DELETE 해야 하는데 이는 트랜잭션 로그를 폭발시키고 오랜 시간 테이블을 잠근다. 둘째, 쿼리가 최근 데이터만 다루는데도 인덱스가 전체 테이블 범위에 걸려 불필요한 IO가 발생한다.

파티셔닝은 테이블의 물리적 저장을 여러 파일그룹으로 분리한다. 파티션 단위로 메타데이터를 조작해 데이터를 이동하지 않고도 즉시 아카이브·추가할 수 있다.

## 파티셔닝 구성 요소

![파티션 테이블 생성 T-SQL](/assets/posts/mssql-partitioning-sliding-window-setup.svg)

**파티션 함수(Partition Function)**: 파티션 키 값을 어느 파티션에 배치할지 결정하는 규칙이다. `RANGE RIGHT`는 경계값이 오른쪽 파티션에 포함된다(≥ 경계). `RANGE LEFT`는 왼쪽(≤ 경계).

**파티션 스킴(Partition Scheme)**: 파티션 함수의 각 파티션을 어느 파일그룹에 저장할지 매핑한다. `ALL TO ([PRIMARY])`는 모든 파티션을 PRIMARY 파일그룹에 저장한다. 파일그룹을 분리하면 파티션별로 다른 스토리지 계층(SSD/HDD)을 사용할 수 있다.

**정렬된 파티션 인덱스**: 파티셔닝의 효과를 최대화하려면 클러스터드 인덱스의 선두 컬럼이 파티션 키와 같아야 한다. 이를 **정렬된(Aligned) 인덱스**라 하며, `SWITCH` 작업의 필수 조건이다.

```sql
-- 정렬된 클러스터드 인덱스 생성
CREATE CLUSTERED INDEX CIX_SalesData_Date
  ON SalesData(SaleDate)
  ON ps_Monthly(SaleDate);

-- 파티션 현황 확인
SELECT p.partition_number, p.rows, rv.value AS boundary
FROM   sys.partitions p
JOIN   sys.partition_range_values rv
         ON rv.function_id = (SELECT function_id FROM sys.partition_functions WHERE name = 'pf_Monthly')
        AND rv.boundary_id = p.partition_number - 1
WHERE  p.object_id = OBJECT_ID('SalesData')
ORDER  BY p.partition_number;
```

## Sliding Window 패턴

Sliding Window는 정기적으로(매월, 분기 등) 윈도우를 한 칸씩 밀어내는 패턴이다. 오래된 파티션을 아카이브 테이블로 스위치하고, 동시에 새 파티션을 추가해 다음 기간 데이터를 받는다.

![Sliding Window 파티셔닝 패턴](/assets/posts/mssql-partitioning-sliding-window-concept.svg)

```sql
-- 1단계: 아카이브 테이블 준비 (동일 구조 + 동일 파티션 함수/스킴)
CREATE TABLE SalesData_Archive (
  SaleDate DATE, OrderID INT, Amount DECIMAL(18,2)
) ON ps_Monthly(SaleDate);

CREATE CLUSTERED INDEX CIX_Archive_Date
  ON SalesData_Archive(SaleDate)
  ON ps_Monthly(SaleDate);

-- 2단계: SWITCH OUT (P1을 아카이브로 이동 — 메타데이터만 변경)
ALTER TABLE SalesData
  SWITCH PARTITION 1
  TO SalesData_Archive PARTITION 1;

-- 3단계: 더 이상 필요 없으면 아카이브에서 삭제 또는 파일그룹 분리
TRUNCATE TABLE SalesData_Archive;  -- 아카이브 비우기

-- 4단계: 파티션 함수에 새 경계값 추가 (분리, SPLIT)
ALTER PARTITION SCHEME ps_Monthly
  NEXT USED [PRIMARY];

ALTER PARTITION FUNCTION pf_Monthly()
  SPLIT RANGE ('2025-02-01');

-- 5단계: 스테이징 테이블의 신규 데이터를 새 파티션으로 SWITCH IN
-- 스테이징 테이블이 비어 있거나, 해당 파티션 범위 데이터만 있어야 함
ALTER TABLE SalesData_Stage
  SWITCH TO SalesData PARTITION 14;
```

`SWITCH`는 데이터를 물리적으로 이동하지 않고 파일그룹 포인터만 변경한다. 수백 GB 데이터도 거의 즉시(밀리초 단위) 완료된다.

## SPLIT/MERGE 시 주의사항

`SPLIT RANGE`로 새 경계값을 추가하면 기존 파티션이 두 개로 나뉘면서 데이터가 재배치된다. 이 파티션에 데이터가 없어야 즉시 완료된다. 데이터가 있으면 실제 데이터 이동이 발생해 시간이 오래 걸린다.

```sql
-- SPLIT 전 해당 파티션이 비어있는지 확인
SELECT p.partition_number, p.rows
FROM   sys.partitions p
WHERE  p.object_id = OBJECT_ID('SalesData')
  AND  p.rows > 0
ORDER  BY p.partition_number;
```

Sliding Window 패턴에서는 SPLIT 대상 파티션(맨 마지막 빈 파티션)이 항상 비어 있도록 설계한다. 그러면 SPLIT도 메타데이터 조작만으로 즉시 완료된다.

## 파티션 제거(MERGE RANGE)

더 이상 필요 없는 파티션 경계를 제거할 때는 `MERGE RANGE`를 사용한다.

```sql
-- P1의 경계값을 제거 (P1과 P2 병합)
ALTER PARTITION FUNCTION pf_Monthly()
  MERGE RANGE ('2024-01-01');
```

`MERGE RANGE`도 데이터가 없을 때는 즉시 완료되지만, 있으면 데이터가 인접 파티션으로 이동한다. SWITCH OUT으로 먼저 비우고 MERGE를 실행하는 것이 권장된다.

## 정리

테이블 파티셔닝의 핵심 가치는 `SWITCH` 작업이다. 메타데이터만 조작해 수백 GB를 즉시 이동·아카이브하고, 파티션 제거(MERGE)·단위 통계 갱신으로 유지보수 창을 최소화할 수 있다. Sliding Window 패턴을 월별 배치로 자동화하면 대용량 시계열 테이블을 오랜 기간 안정적으로 운영할 수 있다.

---

**지난 글:** [SQL Server DMV 진단 — 성능 병목 실시간 분석](/posts/mssql-dmv-diagnostics/)

**다음 글:** [SQL Server 행 수준 보안 · Always Encrypted — 데이터 접근 제어](/posts/mssql-rls-always-encrypted/)

<br>
읽어주셔서 감사합니다. 😊
