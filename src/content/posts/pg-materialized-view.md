---
title: "PostgreSQL 구체화 뷰 — REFRESH 전략과 쿼리 최적화"
description: "뷰와 달리 결과를 디스크에 물리적으로 저장하는 구체화 뷰의 생성, 갱신(REFRESH) 전략, CONCURRENTLY 옵션, 인덱싱 패턴, 그리고 쿼리 플래너가 구체화 뷰를 활용하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["postgresql", "materialized-view", "구체화뷰", "refresh", "성능최적화", "인덱스"]
featured: false
draft: false
---

[지난 글](/posts/pg-declarative-partitioning/)에서 파티셔닝으로 대형 테이블을 물리적으로 분할하는 방법을 살펴봤습니다. 오늘 다룰 구체화 뷰(Materialized View)는 반대 방향의 최적화입니다. 복잡한 집계 쿼리의 **결과 자체를 저장**해 두고, 필요할 때 미리 계산된 값을 바로 반환합니다.

## 뷰와 구체화 뷰의 차이

![뷰 vs 구체화 뷰 비교](/assets/posts/pg-materialized-view-concept.svg)

일반 뷰(VIEW)는 SQL 정의만 저장합니다. 뷰를 조회할 때마다 내부 SQL이 실행되어 베이스 테이블을 스캔합니다. 데이터는 항상 최신이지만, 무거운 집계 쿼리라면 조회마다 동일한 비용이 발생합니다.

구체화 뷰(MATERIALIZED VIEW)는 SQL의 **결과 집합을 디스크에 물리적으로 기록**합니다. SELECT 요청이 오면 저장된 결과를 바로 반환하므로 응답이 매우 빠릅니다. 단, 베이스 테이블이 바뀌어도 자동으로 갱신되지 않아 명시적으로 `REFRESH`를 실행해야 합니다.

## 구체화 뷰 생성

![구체화 뷰 생성과 REFRESH 패턴](/assets/posts/pg-materialized-view-refresh.svg)

```sql
-- WITH NO DATA: 스키마만 생성, 데이터는 아직 채우지 않음
CREATE MATERIALIZED VIEW mv_daily_sales AS
    SELECT
        DATE(created_at)  AS sale_date,
        SUM(amount)       AS daily_total,
        COUNT(*)          AS order_cnt
    FROM  orders
    GROUP BY DATE(created_at)
WITH NO DATA;

-- 초기 데이터 채우기
REFRESH MATERIALIZED VIEW mv_daily_sales;
```

`WITH NO DATA`를 지정하면 뷰 구조만 만들고 데이터는 채우지 않습니다. 배포 단계에서 스키마를 먼저 구성하고 데이터는 나중에 로드할 때 유용합니다.

## REFRESH 전략

구체화 뷰의 핵심 과제는 **언제, 어떻게 갱신**하느냐입니다.

### 전체 갱신 vs CONCURRENTLY

```sql
-- 전체 갱신: ExclusiveLock, 갱신 중 조회 차단됨
REFRESH MATERIALIZED VIEW mv_daily_sales;

-- CONCURRENTLY: AccessShareLock만 획득, 조회 차단 없음
-- 단, 유니크 인덱스가 반드시 존재해야 함
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales;
```

`CONCURRENTLY` 없이 REFRESH하면 테이블 수준의 ExclusiveLock이 걸려 조회가 블로킹됩니다. 운영 중인 시스템에서는 `CONCURRENTLY`를 기본으로 사용해야 하며, 이를 위해 유니크 인덱스가 필요합니다.

```sql
-- CONCURRENTLY를 위한 유니크 인덱스
CREATE UNIQUE INDEX ON mv_daily_sales (sale_date);
```

### 갱신 스케줄

PostgreSQL 자체에는 자동 REFRESH 기능이 없습니다. 외부 스케줄러를 이용합니다.

```sql
-- pg_cron 익스텐션 사용 예 (매일 새벽 1시)
SELECT cron.schedule(
    'refresh-daily-sales',
    '0 1 * * *',
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales$$
);
```

매 분·매 시간 갱신이 필요하다면 pg_cron, 매일 1회라면 cron job이나 Kubernetes CronJob으로 처리합니다.

## 구체화 뷰에 인덱스 추가

구체화 뷰는 물리적 테이블이므로 일반 인덱스를 추가할 수 있습니다.

```sql
-- 날짜 범위 조회 가속화
CREATE INDEX idx_mv_ds_date ON mv_daily_sales (sale_date);

-- 조회 패턴: 특정 날짜의 매출 합산
SELECT SUM(daily_total)
FROM   mv_daily_sales
WHERE  sale_date BETWEEN '2026-01-01' AND '2026-01-31';
```

베이스 테이블의 인덱스와 독립적으로 구성할 수 있어, 보고서 전용 액세스 패턴에 최적화된 인덱스를 자유롭게 설계할 수 있습니다.

## 적합한 사용 사례

| 사용 사례 | 적합 여부 | 이유 |
|-----------|-----------|------|
| 일별 매출 집계 보고서 | ✅ 적합 | 새벽 1회 REFRESH로 충분 |
| 실시간 재고 현황 | ❌ 부적합 | 데이터 최신성 요구 |
| OLAP 대시보드 (1시간 지연 허용) | ✅ 적합 | 복잡 집계 사전 계산 |
| 사용자별 피드 집계 | 조건부 | 사용자 수에 따라 갱신 부하 검토 |

구체화 뷰는 "약간 오래된 데이터여도 괜찮으니 빠르게 응답해 달라"는 요구사항에 가장 잘 맞습니다. 절대적인 최신성이 필요한 잔액·재고 조회에는 적합하지 않습니다.

## 뷰 정의 확인

```sql
-- 구체화 뷰 정보 조회
SELECT schemaname, matviewname, definition, ispopulated
FROM   pg_matviews
WHERE  matviewname = 'mv_daily_sales';
```

`ispopulated`가 `false`이면 아직 REFRESH가 실행되지 않은 상태입니다.

---

**지난 글:** [PostgreSQL 선언적 파티셔닝 — RANGE·LIST·HASH](/posts/pg-declarative-partitioning/)

**다음 글:** [PostgreSQL 스트리밍 복제 — WAL 기반 고가용성](/posts/pg-streaming-replication/)

<br>
읽어주셔서 감사합니다. 😊
