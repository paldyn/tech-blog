---
title: "Snowflake 아키텍처 — 스토리지·컴퓨팅 분리"
description: "Snowflake의 3-레이어 아키텍처(Cloud Services·Virtual Warehouses·Cloud Storage), Micro-partition, Time Travel, Zero-copy Clone, Multi-cluster 자동 확장 원리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["Snowflake", "데이터웨어하우스", "VirtualWarehouse", "MicroPartition", "TimeTravel", "ZeroCopyClone"]
featured: false
draft: false
---

[지난 글](/posts/olap-bigquery-intro/)에서 BigQuery의 Dremel-Jupiter-Colossus 스택과 서버리스 과금 모델을 살펴봤다. 이번에는 클라우드 DW 시장에서 BigQuery와 쌍벽을 이루는 **Snowflake**를 다룬다. Snowflake는 2012년 창업 이후 2020년 역대 최대 소프트웨어 IPO 기록을 세울 만큼 급성장했으며, "컴퓨팅과 스토리지를 분리한다"는 설계 철학을 BigQuery와 독립적으로 구현했다.

## 3-레이어 아키텍처

Snowflake는 세 개의 레이어로 구성된다.

![Snowflake 3-레이어 아키텍처](/assets/posts/olap-snowflake-architecture-layers.svg)

**Cloud Services Layer**: 항상 실행 중인 공유 레이어다. 인증·접근 제어, 메타데이터 관리, 쿼리 파싱·최적화, 트랜잭션 조율을 담당한다. 이 레이어는 컴퓨팅 크레딧 없이 동작하므로 별도 과금이 없다(컴퓨팅의 10% 미만 사용 시 무료).

**Query Processing Layer (Virtual Warehouses)**: 실제 쿼리를 실행하는 컴퓨팅 레이어다. **Virtual Warehouse(VW)**는 독립된 MPP 클러스터이며, 각 VW는 동일한 스토리지 데이터를 공유하지만 로컬 디스크 캐시는 독립적이다. XS부터 6XL까지 크기를 선택할 수 있으며, 초 단위로 크레딧을 소비한다.

**Cloud Storage Layer**: AWS S3, Azure Blob, GCS에 데이터를 저장한다. Snowflake가 자체 관리하는 **Micro-partition** 형식으로 변환해 저장한다.

## Virtual Warehouse의 독립성

Snowflake의 가장 큰 강점 중 하나는 **복수의 VW가 동일 데이터를 동시에 읽어도 서로 영향을 주지 않는다**는 점이다. 분석 팀·ETL·BI 대시보드 각각 별도 VW를 할당하면, 한 팀의 무거운 쿼리가 다른 팀 쿼리를 지연시키지 않는다.

```sql
-- 사용 목적별 VW 분리
USE WAREHOUSE analytics_wh;    -- 분석 팀 전용 (XL)
USE WAREHOUSE etl_wh;          -- ETL 파이프라인 전용 (M)
USE WAREHOUSE bi_wh;           -- 대시보드 전용 (S, AUTO_SUSPEND=60)
```

## Micro-partition — 인덱스 없는 Pruning

Snowflake는 인덱스를 지원하지 않는다. 대신 모든 테이블을 **Micro-partition**으로 자동 분할한다. 각 Micro-partition(50~500MB 압축)은 min/max·distinct 통계를 메타데이터에 저장한다. 쿼리 최적화기는 이 통계로 관련 없는 파티션을 Pruning한다.

```sql
-- Clustering Key 설정: 특정 컬럼 기준으로 파티션 재정렬
ALTER TABLE orders CLUSTER BY (order_date, region);

-- Pruning 효율 확인
SELECT system$clustering_information('orders', '(order_date, region)');
```

Clustering Key를 설정하면 DML이 발생할 때마다 Snowflake가 백그라운드로 재정렬(Reclustering)을 수행한다.

## Time Travel과 Zero-copy Clone

Snowflake의 독특한 기능이다.

**Time Travel**: 최대 90일(Enterprise 이상) 이전 시점의 데이터를 조회하거나 복구할 수 있다.

```sql
-- 특정 타임스탬프 시점 데이터 조회
SELECT * FROM orders AT (TIMESTAMP => '2025-04-01 09:00:00'::TIMESTAMP);

-- 실수로 삭제된 테이블 복구
UNDROP TABLE orders;
```

**Zero-copy Clone**: 메타데이터만 복사해 테이블·스키마·데이터베이스 전체를 순간 복제한다. 데이터는 공유하므로 추가 스토리지 비용이 들지 않는다.

```sql
-- 개발 환경 클론 (비용 없음)
CREATE DATABASE dev_clone CLONE production_db;
CREATE TABLE orders_backup CLONE orders AT (OFFSET => -3600);
```

![Snowflake SQL 패턴](/assets/posts/olap-snowflake-architecture-sql.svg)

## Multi-cluster Warehouse — 동시성 자동 처리

단일 VW에 동시 쿼리가 몰리면 대기가 발생한다. **Multi-cluster Warehouse**를 설정하면 자동으로 클러스터를 추가해 동시성을 처리한다.

```sql
CREATE WAREHOUSE high_concurrency_wh
  WITH WAREHOUSE_SIZE        = 'MEDIUM'
       MIN_CLUSTER_COUNT     = 1
       MAX_CLUSTER_COUNT     = 6
       SCALING_POLICY        = 'STANDARD'  -- ECONOMY: 비용 우선
       AUTO_SUSPEND          = 120
       AUTO_RESUME           = TRUE;
```

## BigQuery vs Snowflake 간단 비교

| 항목 | BigQuery | Snowflake |
|---|---|---|
| 컴퓨팅 모델 | 서버리스 (슬롯 자동) | VW 수동/자동 관리 |
| 과금 | 스캔 TB당 or 슬롯 예약 | 스토리지 + VW 크레딧/초 |
| 클라우드 | GCP 전용 | AWS·Azure·GCP |
| 인덱스 | 없음 | 없음 (Micro-partition) |
| Time Travel | 7일 | 1~90일 |
| Zero-copy Clone | 없음 | 지원 |

## 정리

Snowflake의 핵심 가치는 **독립적 확장, 분리된 과금, 유연한 클론**에 있다. VW를 목적별로 분리하면 조직 내 다양한 팀이 동일 데이터를 서로 방해 없이 활용할 수 있고, VW 일시정지 시 컴퓨팅 비용이 0이 되는 구조는 사용 패턴이 불규칙한 팀에게 특히 매력적이다.

---

**지난 글:** [BigQuery 입문: 서버리스 열 지향 DW](/posts/olap-bigquery-intro/)

**다음 글:** [Redshift 아키텍처 — MPP 열 지향 DW](/posts/olap-redshift-architecture/)

<br>
읽어주셔서 감사합니다. 😊
