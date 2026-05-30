---
title: "BigQuery 입문: 서버리스 열 지향 DW"
description: "Google BigQuery의 Dremel 쿼리 엔진·Colossus 스토리지·슬롯 과금 모델 등 핵심 아키텍처와 파티션·클러스터링·ARRAY/STRUCT 등 비용 절감 설계 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["BigQuery", "서버리스", "데이터웨어하우스", "Dremel", "Colossus", "파티션", "클러스터링"]
featured: false
draft: false
---

[지난 글](/posts/olap-scd-types/)에서 SCD 유형을 통해 디멘전 데이터의 변경 이력을 어떻게 저장할지 살펴봤다. 이번에는 클라우드 OLAP 플랫폼의 선두 주자인 **BigQuery**를 다룬다. BigQuery는 2010년 Google이 공개한 이후 "서버리스 데이터 웨어하우스"라는 개념을 업계에 정착시킨 제품이다. 클러스터를 직접 프로비저닝하지 않고도 페타바이트 규모의 데이터를 SQL 한 줄로 분석할 수 있다는 점이 핵심이다.

## BigQuery의 핵심 아키텍처

BigQuery는 **컴퓨팅과 스토리지가 완전히 분리**된 구조다. 전통적인 MPP DW(Teradata, Greenplum)가 노드마다 데이터를 할당해 컴퓨팅과 스토리지를 결합했다면, BigQuery는 두 레이어를 독립적으로 확장한다.

![BigQuery 아키텍처](/assets/posts/olap-bigquery-intro-arch.svg)

**Dremel 쿼리 엔진**: SQL을 받아 분산 실행 트리로 변환하고, 가용한 슬롯(컴퓨팅 단위)에 동적으로 작업을 분배한다. 쿼리 하나에 수천 개의 슬롯이 동시에 붙었다 떨어진다.

**Jupiter 네트워크**: 스토리지와 컴퓨팅 사이를 연결하는 Google 내부 고속 네트워크다. Petabit/s 대역폭 덕분에 데이터를 컴퓨팅 노드로 이동시키는 비용이 사실상 무시할 수 있는 수준이다.

**Colossus 분산 파일시스템**: 데이터를 `Capacitor`라는 열 지향 포맷으로 저장한다. 열 단위 압축(Dictionary, RLE, Bit-packing)이 기본 적용되며, 복제·암호화가 자동 처리된다. Parquet과 구조적으로 유사하다.

## 슬롯 과금 모델

BigQuery의 과금에는 두 가지 방식이 있다.

- **On-demand**: 쿼리가 스캔한 데이터 TB당 과금($6.25/TB 기준). 처음 매월 1TB 무료. `SELECT *`처럼 열 전체를 읽으면 비용이 폭발한다.
- **Editions (예약 슬롯)**: 필요한 슬롯 수를 예약해 정액 결제. 대규모 팀이 규칙적으로 사용하는 경우 총비용이 낮아진다.

## 파티션과 클러스터링 — 비용 절감의 핵심

On-demand 모델에서 비용을 줄이는 가장 강력한 수단이 **파티션**과 **클러스터링**이다.

```sql
CREATE TABLE `project.dataset.sales`
(
  order_id  INT64,
  order_dt  DATE,
  region    STRING,
  amount    NUMERIC
)
PARTITION BY order_dt          -- 날짜 파티션: order_dt로만 스캔 대상 제한
CLUSTER BY region;             -- 클러스터: region 블록 Pruning
```

파티션은 스캔 파일 자체를 걸러내고, 클러스터링은 파티션 내 블록을 추가로 Pruning한다. `WHERE order_dt = '2025-01-15' AND region = '서울'` 조건이라면, 파티션 필터로 해당 날짜 파일만, 클러스터 통계로 서울 블록만 읽는다.

![BigQuery SQL 패턴](/assets/posts/olap-bigquery-intro-sql.svg)

## ARRAY와 STRUCT — BigQuery의 비정규화

전통 정규화 설계는 `JOIN`을 전제로 한다. BigQuery는 JOIN이 비싸기 때문에 대신 **중첩(nested) 구조**를 적극 활용한다.

```sql
-- ARRAY를 포함한 비정규화 테이블
CREATE TABLE `project.dataset.orders` (
  order_id  INT64,
  customer  STRUCT<id INT64, name STRING, region STRING>,
  items     ARRAY<STRUCT<sku STRING, qty INT64, price NUMERIC>>
);

-- UNNEST로 배열 행 펼치기
SELECT o.order_id,
       i.sku,
       i.qty * i.price AS line_total
  FROM `project.dataset.orders` o,
       UNNEST(o.items) AS i
 WHERE o.customer.region = '서울';
```

중첩 구조를 쓰면 JOIN 없이 단일 테이블 스캔으로 복잡한 1:N 관계를 처리할 수 있다. 스토리지 비용이 다소 늘지만, 쿼리 속도와 슬롯 효율이 크게 개선된다.

## BigQuery ML

BigQuery는 SQL 문법 안에서 머신러닝 모델을 학습·예측하는 **BQML**을 지원한다.

```sql
-- 선형 회귀 모델 학습
CREATE MODEL `project.dataset.sales_forecast`
OPTIONS (model_type = 'linear_reg',
         input_label_cols = ['amount'])
AS
SELECT region, month, amount
  FROM `project.dataset.sales`
 WHERE order_dt < '2025-01-01';

-- 예측
SELECT *
  FROM ML.PREDICT(MODEL `project.dataset.sales_forecast`,
       (SELECT region, month FROM `project.dataset.sales_test`));
```

데이터 이동 없이 DW 안에서 ML 파이프라인을 완성할 수 있다는 점이 강점이다.

## 비용 관리 팁

| 나쁜 패턴 | 좋은 패턴 |
|---|---|
| `SELECT *` | 필요 컬럼만 명시 |
| 파티션 필터 없는 전체 스캔 | `WHERE order_dt BETWEEN ...` |
| 중간 결과 반복 계산 | `Materialized View` 활용 |
| 개발 중 대용량 테이블 쿼리 | `LIMIT` + `TABLESAMPLE SYSTEM (1 PERCENT)` |

## 정리

BigQuery는 "인프라를 생각하지 않고 SQL로 분석"하는 경험을 제공한다. 그 이면에는 Dremel·Jupiter·Colossus라는 Google의 독자 기술 스택이 있다. 비용 최적화의 핵심은 파티션 필터로 스캔 범위를 좁히고, 클러스터링으로 블록을 추가 Pruning하는 것이다. Snowflake, Redshift와 함께 클라우드 DW 3대장으로 꼽히지만, 서버리스 모델과 Google 생태계(Looker, Vertex AI) 연동은 BigQuery만의 강점이다.

---

**지난 글:** [SCD (천천히 변하는 차원) 유형: Type 1·2·3](/posts/olap-scd-types/)

**다음 글:** [Snowflake 아키텍처 — 스토리지·컴퓨팅 분리](/posts/olap-snowflake-architecture/)

<br>
읽어주셔서 감사합니다. 😊
