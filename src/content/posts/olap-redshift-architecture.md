---
title: "Redshift 아키텍처 — MPP 열 지향 DW"
description: "Amazon Redshift의 Leader Node·Compute Node 구조, DISTSTYLE(KEY/EVEN/ALL/AUTO), SORTKEY, 컬럼 압축 인코딩, Redshift Serverless를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["Redshift", "MPP", "데이터웨어하우스", "DISTSTYLE", "SORTKEY", "열지향", "AWS"]
featured: false
draft: false
---

[지난 글](/posts/olap-snowflake-architecture/)에서 Snowflake의 3-레이어 아키텍처와 Micro-partition을 살펴봤다. 이번에는 AWS 생태계의 대표 DW인 **Amazon Redshift**를 다룬다. Redshift는 2012년 출시되며 "온프레미스 DW 마이그레이션을 클라우드로"라는 수요를 타고 빠르게 성장했다. PostgreSQL 쿼리 언어 호환이 초기 채택을 크게 낮췄다.

## 아키텍처: Leader Node + Compute Nodes

Redshift는 전통적인 **MPP(Massively Parallel Processing)** 아키텍처를 따른다.

![Redshift MPP 아키텍처](/assets/posts/olap-redshift-architecture-mpp.svg)

**Leader Node**는 클라이언트 연결을 받고, SQL을 파싱해 실행 계획을 생성하고, Compute Node에 작업을 분배하고, 최종 결과를 집계해 반환한다. Leader Node는 데이터를 저장하지 않는다.

**Compute Node**는 실제 데이터를 저장하고 쿼리를 실행한다. 각 노드는 여러 **슬라이스**로 나뉘며, 슬라이스마다 독립적으로 쿼리를 처리한다. 슬라이스 수는 노드 타입에 따라 결정된다(예: ra3.4xlarge = 슬라이스 4개).

## DISTSTYLE — 분산 키 전략

Redshift 성능의 핵심은 데이터를 노드 간 어떻게 분산하느냐다. `DISTSTYLE`로 결정한다.

```sql
-- 팩트 테이블: JOIN 컬럼 기준 KEY 분산
CREATE TABLE fact_orders (
  order_id  BIGINT,
  cust_sk   INT,
  order_dt  DATE,
  amount    NUMERIC(18,2)
)
DISTSTYLE KEY
DISTKEY (cust_sk)
SORTKEY (order_dt);

-- 소형 디멘전: ALL 분산 (전체 복사)
CREATE TABLE dim_customer (
  cust_sk  INT NOT NULL,
  name     VARCHAR(200),
  region   VARCHAR(100)
)
DISTSTYLE ALL;
```

- **KEY**: 지정 컬럼의 해시값으로 분산. JOIN 컬럼과 일치하면 노드 간 데이터 이동(Redistribute)이 없어 빠르다.
- **EVEN**: 라운드-로빈으로 균등 분산. JOIN 없이 집계만 하는 테이블에 적합.
- **ALL**: 전체 데이터를 모든 노드에 복사. 소규모 디멘전 테이블에서 Broadcast Join 효과를 낸다.
- **AUTO**: Redshift가 통계 기반으로 자동 결정. 신규 테이블의 기본값.

## SORTKEY — 범위 스캔 최적화

`SORTKEY`는 데이터를 물리적으로 정렬된 순서로 저장한다. 범위 쿼리(`WHERE order_dt BETWEEN ...`)에서 관련 없는 블록을 Zone Map 통계로 건너뛴다(Block Pruning).

```sql
-- Compound Sort Key: 컬럼 순서가 중요
CREATE TABLE fact_sales (...)
SORTKEY (sale_date, region_code);

-- Interleaved Sort Key: 모든 컬럼 동등한 범위 쿼리
CREATE TABLE fact_events (...)
INTERLEAVED SORTKEY (event_type, user_id, event_ts);
```

- **Compound Sort Key**: 첫 번째 컬럼 기준 쿼리에 가장 효과적.
- **Interleaved Sort Key**: 어떤 컬럼으로 필터해도 효과적이지만, VACUUM 비용이 높다. 로드 패턴이 복잡할 때 사용.

## 컬럼 압축 인코딩

Redshift는 열 지향 포맷으로 저장하면서 컬럼별로 압축 방식을 지정할 수 있다.

```sql
-- 인코딩 직접 지정
CREATE TABLE dim_product (
  prod_id    INT        ENCODE az64,   -- 숫자 범위 압축
  prod_name  VARCHAR    ENCODE lzo,    -- 문자열 LZO
  category   VARCHAR(50) ENCODE bytedict, -- 저카디널리티: 사전 압축
  price      NUMERIC    ENCODE delta   -- 연속 수치: 차분 압축
);

-- 또는 ANALYZE COMPRESSION으로 추천 인코딩 확인
ANALYZE COMPRESSION fact_orders;
```

압축률이 높을수록 스캔할 I/O가 줄어 쿼리가 빨라지고 스토리지 비용도 낮아진다.

![Redshift DDL 패턴](/assets/posts/olap-redshift-architecture-sql.svg)

## VACUUM과 ANALYZE

DML이 잦으면 테이블의 Sort 순서가 깨지고 통계가 낡는다. 주기적으로 아래를 실행해야 한다.

```sql
-- 정렬 순서 복구 (SORTKEY 기준)
VACUUM SORT ONLY fact_orders;

-- 삭제 공간 회수
VACUUM DELETE ONLY fact_orders;

-- 통계 갱신 (실행 계획 최적화)
ANALYZE fact_orders;
```

Redshift는 백그라운드 VACUUM을 자동으로 수행하지만, 대규모 로드 후에는 수동 실행을 권장한다.

## Redshift Serverless

2022년 출시된 **Redshift Serverless**는 노드 타입이나 수를 관리하지 않아도 된다. **RPU(Redshift Processing Unit)** 단위로 자동 확장하며, 쿼리가 없을 때는 비용이 발생하지 않는다.

```sql
-- Serverless에서는 기존 SQL 그대로 사용
-- Namespace / Workgroup 설정만 AWS 콘솔에서 처리
SELECT region, SUM(amount)
  FROM fact_orders
 WHERE order_dt >= '2025-01-01'
 GROUP BY region;
```

기존 Provisioned 클러스터 대비 운영 부담이 크게 줄지만, 지속적인 고부하 워크로드에서는 Provisioned가 비용 효율이 높다.

## BigQuery·Snowflake·Redshift 비교

| 항목 | BigQuery | Snowflake | Redshift |
|---|---|---|---|
| 분산 제어 | 자동 | 자동 | 수동 (DISTKEY) |
| 정렬 키 | 없음 (클러스터링) | 없음 (Micro-partition) | SORTKEY |
| 스토리지 분리 | 완전 분리 | 완전 분리 | Serverless만 분리 |
| 클라우드 | GCP | AWS·Azure·GCP | AWS |
| SQL 호환 | 표준+GBQ 확장 | 표준+Snow 확장 | PostgreSQL 호환 |

## 정리

Redshift는 AWS 인프라와의 긴밀한 통합(S3, Glue, QuickSight), PostgreSQL 호환 SQL, 세밀한 분산 제어가 강점이다. `DISTKEY`를 잘못 설계하면 특정 노드에 데이터가 쏠리는 **Data Skew**가 발생해 성능이 크게 저하된다. 테이블 설계 전에 `SELECT tbl_id, name, unsorted, stats_off FROM SVV_TABLE_INFO`로 현재 상태를 항상 모니터링하는 습관이 중요하다.

---

**지난 글:** [Snowflake 아키텍처 — 스토리지·컴퓨팅 분리](/posts/olap-snowflake-architecture/)

**다음 글:** [ClickHouse — 실시간 분석 특화 OLAP](/posts/olap-clickhouse/)

<br>
읽어주셔서 감사합니다. 😊
