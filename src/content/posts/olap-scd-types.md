---
title: "SCD (천천히 변하는 차원) 유형: Type 1·2·3"
description: "데이터 웨어하우스 디멘전 테이블의 핵심 개념인 SCD Type 1(덮어쓰기)·Type 2(이력 보존)·Type 3(이전값 컬럼)의 구조와 선택 기준, Type 2 SQL 구현 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["SCD", "천천히변하는차원", "SlowlyChangingDimension", "데이터웨어하우스", "Type2", "ETL"]
featured: false
draft: false
---

[지난 글](/posts/olap-star-snowflake-schema/)에서 스타 스키마와 스노우플레이크 스키마를 통해 팩트 테이블과 디멘전 테이블의 관계를 살펴봤다. 이번에는 디멘전 테이블 설계에서 가장 까다로운 문제인 **SCD(Slowly Changing Dimension, 천천히 변하는 차원)**를 다룬다. 고객 주소가 바뀌거나 영업사원의 소속 부서가 바뀔 때 이 변경을 어떻게 저장할지가 SCD의 핵심이다. 선택에 따라 분석 쿼리가 과거 시점 기준으로 정확하게 동작하거나, 이력이 영구 손실되거나, 구조가 복잡해진다.

## SCD란 무엇인가

디멘전 테이블의 속성은 완전히 고정되지 않는다. 고객이 이사를 가고, 제품 카테고리가 재분류되고, 직원이 부서를 이동한다. 이 변경 빈도가 트랜잭션 데이터만큼 잦지는 않지만 — 그래서 **Slowly Changing** — 분석 측면에서 매우 중요하다. "2024년 1분기 매출은 고객이 당시 어느 지역에 있었는지 기준으로 집계해야 한다"는 요구가 생기는 순간, SCD를 어떻게 설계했느냐가 쿼리 가능 여부를 결정한다.

Ralph Kimball이 정의한 SCD 유형은 Type 1부터 Type 7까지 다양하지만, 실무에서는 **Type 1, 2, 3** 세 가지가 대부분을 차지한다.

![SCD 유형 비교](/assets/posts/olap-scd-types-compare.svg)

## Type 1 — 덮어쓰기 (Overwrite)

가장 단순한 방법이다. 변경이 발생하면 기존 행을 `UPDATE`로 바꾼다. 이전 값은 사라진다.

```sql
-- 고객 지역 수정 (이전 값 '서울'은 영구 소실)
UPDATE dim_customer
   SET region = '부산'
 WHERE cust_id = 1001;
```

이력이 필요 없는 속성 — 오탈자 수정, 전화번호 포맷 정규화, 이름 표기 통일 — 에 적합하다. 구현이 가장 단순하고 쿼리 성능도 유리하지만, 변경 이전 시점 기준 분석은 원천적으로 불가능하다.

## Type 2 — 이력 보존 (Add New Row)

변경이 생기면 기존 행을 만료(close)하고 새 행을 삽입한다. **서로게이트 키(Surrogate Key)**가 필수다. 비즈니스 키(`cust_id`)는 동일하지만 서로게이트 키(`cust_sk`)가 다른 여러 행이 하나의 고객 이력을 나타낸다.

![Type 2 구현 패턴](/assets/posts/olap-scd-types-type2-sql.svg)

```sql
-- Type 2 변경 처리 (트랜잭션으로 묶기)
BEGIN;

-- 1) 기존 현재 행 만료
UPDATE dim_customer
   SET eff_to      = '2025-03-14',
       is_current  = FALSE
 WHERE cust_id     = 1001
   AND is_current  = TRUE;

-- 2) 신규 행 삽입
INSERT INTO dim_customer
       (cust_sk, cust_id, region, eff_from,     eff_to,       is_current)
VALUES (nextval('dim_customer_sk_seq'),
        1001,   '부산', '2025-03-15', '9999-12-31', TRUE);

COMMIT;
```

유효 기간(`eff_from`, `eff_to`)을 기반으로 **점-인-타임(Point-in-Time)** 쿼리가 가능하다. 팩트 테이블은 이벤트 발생 시점의 `cust_sk`를 FK로 보유하므로, `JOIN` 후 집계하면 "그 당시 지역 기준" 결과가 자동으로 정확해진다.

### 설계 포인트

- `eff_to = '9999-12-31'` 컨벤션: NULL 대신 미래 최대 날짜를 쓰면 `BETWEEN` 조건이 간단해진다.
- `is_current` 인덱스: `WHERE is_current = TRUE` 필터를 자주 쓰므로 부분 인덱스 또는 단일 컬럼 인덱스를 추가한다.
- 테이블 크기: 변경이 잦은 속성에 Type 2를 남용하면 행 수가 폭발한다. 변경 빈도를 사전에 산정하고 파티션 전략을 함께 세울 것.

## Type 3 — 이전값 컬럼 (Add New Column)

새 컬럼(`prev_region`)을 추가해 직전 값 하나를 보존한다. 행 수는 늘지 않지만 DDL 변경이 필요하고, 두 번 이상의 변경 이력은 추적할 수 없다.

```sql
-- Type 3: 컬럼 추가 후 UPDATE
ALTER TABLE dim_customer
  ADD COLUMN prev_region VARCHAR(100);

UPDATE dim_customer
   SET prev_region = region,
       region      = '부산'
 WHERE cust_id = 1001;
```

직전 값 하나만 비교하는 분석("이전 지역 vs 현재 지역 매출 차이")에 최적이다. 컬럼 수가 늘어나는 대신 조인 없이 단일 행에서 비교를 끝낼 수 있다.

## 유형별 선택 기준

| 기준 | Type 1 | Type 2 | Type 3 |
|---|---|---|---|
| 이력 보존 | 불가 | 전체 | 직전 1개 |
| 행 수 증가 | 없음 | 변경마다 | 없음 |
| 점-인-타임 분석 | 불가 | 가능 | 부분 |
| 구현 복잡도 | 낮음 | 중간 | 낮음 |
| 대표 사용 사례 | 오탈자 수정 | 고객 세그먼트·조직도 | 재분류 전/후 비교 |

실무 DW 프로젝트에서는 Type 2가 기본이고, 이력이 전혀 불필요한 속성에 한해 Type 1을 혼용하는 패턴이 일반적이다.

## Type 4, 6, 7 간략 소개

- **Type 4(Mini-Dimension)**: 변경이 잦은 일부 속성만 별도 테이블로 분리해 메인 디멘전 크기를 통제한다.
- **Type 6(Hybrid)**: Type 1 + 2 + 3을 결합해 현재값·이전값·전체 이력을 동시에 보존한다. 구현 복잡도가 높아 대형 DW 프레임워크에서 주로 사용.
- **Type 7**: 현재 행과 이력 행을 분리된 뷰로 제공해 쿼리 단순화에 집중한다.

## 정리

SCD는 "변경이 생겼을 때 이 데이터를 어떤 용도로 사용할 것인지"를 먼저 결정하고 유형을 선택하는 것이 순서다. 분석 요건 정의 단계에서 각 디멘전 속성의 변경 빈도와 이력 필요 여부를 스프레드시트로 정리하고, 그 결과를 DDL 설계에 반영하면 나중에 생기는 "과거 기준 집계가 틀리다"는 디버깅 시간을 크게 줄일 수 있다.

---

**지난 글:** [스타 스키마와 스노우플레이크 스키마](/posts/olap-star-snowflake-schema/)

**다음 글:** [BigQuery 입문: 서버리스 열 지향 DW](/posts/olap-bigquery-intro/)

<br>
읽어주셔서 감사합니다. 😊
