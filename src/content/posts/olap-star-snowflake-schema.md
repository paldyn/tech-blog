---
title: "스타 스키마와 스노우플레이크 스키마"
description: "데이터 웨어하우스 설계의 핵심인 스타 스키마(팩트 테이블·디멘전 테이블)와 스노우플레이크 스키마의 구조·장단점·선택 기준을 DDL과 분석 쿼리 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["스타스키마", "스노우플레이크스키마", "데이터웨어하우스", "팩트테이블", "디멘전테이블", "OLAP"]
featured: false
draft: false
---

[지난 글](/posts/olap-vs-oltp/)에서 OLTP와 OLAP의 근본 차이를 살펴봤다. 이번에는 OLAP 데이터 웨어하우스 설계의 표준인 **스타 스키마**와 **스노우플레이크 스키마**를 다룬다. 이 두 스키마는 데이터 웨어하우스의 기본 어휘로, BigQuery·Snowflake·Redshift 등 어떤 플랫폼을 쓰든 반드시 알아야 한다.

## 팩트 테이블과 디멘전 테이블

데이터 웨어하우스 설계의 출발점은 두 종류의 테이블을 구분하는 것이다.

**팩트 테이블(Fact Table)**: 측정 가능한 비즈니스 이벤트를 기록한다. 판매 금액, 주문 수량, 웹페이지 방문 횟수 같은 **숫자 지표(metrics)**가 담긴다. 또한 각 디멘전 테이블을 가리키는 외래키를 가진다. 행 수가 매우 많고 빠르게 늘어난다.

**디멘전 테이블(Dimension Table)**: 팩트의 맥락(context)을 설명하는 속성을 담는다. 제품 카테고리, 고객 지역, 날짜 정보 같은 **설명적 속성(attributes)**이다. 행 수가 상대적으로 적고, 자주 바뀌지 않는다.

## 스타 스키마

스타 스키마는 가장 단순하고 가장 널리 쓰이는 데이터 웨어하우스 설계다. 중앙의 팩트 테이블 하나를 여러 디멘전 테이블이 둘러싸는 모양이 별처럼 보여서 스타 스키마다.

![스타 스키마 구조](/assets/posts/olap-star-snowflake-schema-star.svg)

디멘전 테이블은 **비정규화(denormalized)**되어 있다. 제품 테이블에 카테고리 이름, 브랜드 이름이 직접 저장된다. 별도 카테고리 테이블이나 브랜드 테이블로 나눠지지 않는다. 이 덕분에 JOIN이 단순해져 쿼리 성능이 좋다.

![스타 스키마 DDL과 분석 쿼리](/assets/posts/olap-star-snowflake-schema-code.svg)

```sql
-- dim_date: 날짜 디멘전 (미리 채워두는 lookup 테이블)
CREATE TABLE dim_date (
    date_key    INT         PRIMARY KEY,  -- 20260101 형식
    full_date   DATE        NOT NULL,
    year        INT,
    quarter     INT,
    month       INT,
    month_name  VARCHAR(20),
    week        INT,
    day_of_week VARCHAR(10),
    is_weekend  BOOLEAN,
    is_holiday  BOOLEAN
);

-- dim_product: 제품 디멘전 (비정규화 - 카테고리명 직접 포함)
CREATE TABLE dim_product (
    product_key   INT         PRIMARY KEY,
    product_name  VARCHAR(200),
    category      VARCHAR(100),  -- 정규화했다면 FK
    subcategory   VARCHAR(100),
    brand         VARCHAR(100),
    unit_price    DECIMAL(10,2)
);
```

## 스노우플레이크 스키마

스노우플레이크 스키마는 디멘전 테이블을 더 분해한다. 스타 스키마에서 `dim_product.category`를 `dim_category` 테이블로 분리하고, FK로 연결한다. 디멘전 테이블들이 서로 연결되어 눈송이(snowflake) 모양이 된다.

```sql
-- 스노우플레이크: 카테고리를 별도 테이블로 분리
CREATE TABLE dim_category (
    category_key    INT PRIMARY KEY,
    category_name   VARCHAR(100),
    department      VARCHAR(100)
);

CREATE TABLE dim_product (
    product_key   INT         PRIMARY KEY,
    product_name  VARCHAR(200),
    category_key  INT         REFERENCES dim_category(category_key),  -- FK
    brand         VARCHAR(100),
    unit_price    DECIMAL(10,2)
);

-- 스노우플레이크 쿼리: JOIN이 하나 더 필요
SELECT c.department, p.brand, SUM(f.amount) AS revenue
FROM   fact_sales f
JOIN   dim_product  p ON f.product_key = p.product_key
JOIN   dim_category c ON p.category_key = c.category_key  -- 추가 JOIN
WHERE  f.date_key BETWEEN 20260101 AND 20261231
GROUP BY 1, 2
ORDER BY revenue DESC;
```

스노우플레이크 스키마의 장점은 저장 공간 절약(중복 없음)과 디멘전 데이터 일관성이다. 카테고리 이름을 바꿀 때 한 곳만 수정하면 된다. 단점은 쿼리에 JOIN이 늘어나 복잡해지고, 현대 컬럼 스토리지에서는 JOIN 비용이 의미 있게 증가할 수 있다.

## 어떤 스키마를 선택할까

실무에서는 **스타 스키마가 대부분의 상황에서 더 낫다**. 이유는 세 가지다.

첫째, BigQuery·Snowflake·Redshift 같은 컬럼 스토리지는 JOIN보다 스캔 비용이 더 크다. 비정규화로 JOIN을 줄이는 것이 성능상 유리하다.

둘째, 데이터 웨어하우스의 디멘전 데이터는 ETL 단계에서 이미 정제돼 들어온다. OLTP 수준의 정규화 필요성이 낮다.

셋째, SQL 쿼리가 단순해서 비기술직 분석가도 이해하기 쉽다.

스노우플레이크 스키마는 디멘전 테이블이 수백만 행 이상으로 커지거나, 디멘전 간 계층 관계가 복잡할 때 적합하다.

## Grain: 팩트 테이블 설계의 핵심

팩트 테이블 설계에서 가장 먼저 결정해야 할 것은 **Grain**이다. "팩트 테이블의 한 행이 무엇을 의미하는가?"다.

- **트랜잭션 Grain**: 주문 1건 = 1행. 가장 세밀한 수준
- **라인 아이템 Grain**: 주문 내 제품 1개 = 1행. 더 세밀
- **주기적 스냅샷 Grain**: 매일 말 재고 현황 = 1행

Grain이 결정되면 어떤 팩트와 어떤 디멘전이 필요한지 자연스럽게 도출된다. Grain을 처음에 잘못 선택하면 나중에 수정하기 매우 어렵다. 가능한 한 세밀한 Grain(트랜잭션 수준)으로 시작하는 것이 대부분의 경우 더 유연하다.

---

**지난 글:** [OLAP vs OLTP — 두 워크로드의 근본적 차이](/posts/olap-vs-oltp/)

**다음 글:** [SCD(Slowly Changing Dimension) — 디멘전 변경 이력 처리](/posts/olap-scd-types/)

<br>
읽어주셔서 감사합니다. 😊
