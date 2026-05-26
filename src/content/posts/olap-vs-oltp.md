---
title: "OLAP vs OLTP — 두 워크로드의 근본적 차이"
description: "OLTP와 OLAP의 목적·쿼리 패턴·스토리지 구조·대표 시스템을 비교하고, 행 지향·열 지향 스토리지가 각 워크로드에 유리한 이유와 HTAP 등장 배경을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["OLAP", "OLTP", "열지향", "행지향", "데이터웨어하우스", "HTAP"]
featured: false
draft: false
---

[지난 글](/posts/distsql-vitess/)에서 Vitess의 MySQL 샤딩 미들웨어를 살펴봤다. 이번 글부터는 OLAP(Online Analytical Processing) 시리즈를 시작한다. OLAP를 이해하려면 먼저 OLTP와의 근본적인 차이부터 짚어야 한다. 두 워크로드는 같은 SQL을 사용하지만, 데이터 규모·쿼리 패턴·성능 병목이 완전히 다르다.

## OLTP란

OLTP는 **Online Transactional Processing**의 줄임말로, 실시간으로 빈번한 단건 읽기·쓰기를 처리하는 워크로드다. 쇼핑몰의 주문 처리, 은행의 이체, 앱의 사용자 로그인이 대표 예시다. 특징은 다음과 같다.

- 한 번에 수십~수백 행 처리
- 짧은 트랜잭션(밀리초 단위)
- 높은 동시성(수천~수만 TPS)
- PK 기반 포인트 조회, 단순 JOIN
- ACID 트랜잭션 필수

MySQL, PostgreSQL, Oracle, SQL Server 같은 전통 RDBMS가 이 워크로드에 최적화돼 있다.

## OLAP란

OLAP는 **Online Analytical Processing**의 줄임말로, 대량 데이터를 집계·분석하는 워크로드다. 월별 매출 리포트, 사용자 행동 분석, 재고 예측이 대표 예시다. 특징은 다음과 같다.

- 한 번에 수억 행 스캔
- 복잡한 GROUP BY, WINDOW FUNCTION, 다중 JOIN
- 주로 읽기 전용 (INSERT는 배치성)
- 쿼리 응답 시간이 초~분 단위 허용
- 실시간 일관성보다 최신 데이터 근사치 허용

BigQuery, Snowflake, Amazon Redshift, ClickHouse, DuckDB 같은 데이터 웨어하우스가 이 워크로드에 최적화돼 있다.

![OLTP vs OLAP 근본적 차이](/assets/posts/olap-vs-oltp-comparison.svg)

## 왜 스토리지 구조가 다른가

OLTP와 OLAP가 서로 다른 데이터베이스를 사용하는 가장 큰 이유는 **스토리지 구조**다.

![행 지향 vs 열 지향 스토리지](/assets/posts/olap-vs-oltp-storage.svg)

**행 지향(Row-oriented)**: MySQL, PostgreSQL의 InnoDB, PostgreSQL 힙처럼 한 행의 모든 컬럼을 연속해서 저장한다. `WHERE id = 42` 같은 포인트 조회는 한 페이지만 읽으면 된다. 반면 `SUM(amount) FROM orders`처럼 특정 컬럼만 집계할 때는 모든 행을 읽어야 해서 I/O가 크다.

**열 지향(Column-oriented)**: 같은 컬럼의 값을 연속해서 저장한다. `SUM(amount)`는 amount 컬럼 파일만 읽으면 된다. 나머지 컬럼(name, address 등)은 아예 읽지 않는다. 같은 타입의 값이 연속하므로 압축률도 5~10배 높다. 단, `WHERE id = 42`로 단건 조회 시에는 모든 컬럼 파일에서 해당 행을 찾아야 해서 비효율적이다.

```sql
-- OLAP 전용 데이터베이스에서 집계 (DuckDB 예시)
-- 같은 SQL이지만 내부적으로 열 지향으로 처리

-- 1억 건 주문에서 월별 매출 집계
SELECT
    DATE_TRUNC('month', order_date) AS month,
    region,
    SUM(amount)                     AS revenue,
    COUNT(*)                        AS order_count,
    AVG(amount)                     AS avg_order
FROM orders
WHERE order_date >= '2026-01-01'
GROUP BY 1, 2
ORDER BY month, revenue DESC;

-- OLTP(MySQL)에서는 풀 테이블 스캔으로 수 분
-- OLAP(ClickHouse)에서는 amount 열만 스캔으로 수 초
```

## OLAP 아키텍처의 변화

전통적인 BI 파이프라인은 ETL로 OLTP → 데이터 웨어하우스로 데이터를 이전했다. 야간 배치나 몇 시간 지연이 일반적이었다.

현대 아키텍처는 세 가지 방향으로 진화했다.

**ELT (Extract-Load-Transform)**: BigQuery나 Snowflake처럼 강력한 컴퓨팅 자원을 가진 웨어하우스에 데이터를 먼저 올리고(Load), 그 안에서 SQL로 변환(Transform)한다. dbt가 이 패턴의 대표 도구다.

**스트리밍 OLAP**: Apache Kafka + ClickHouse나 Flink 조합으로 수 초 이내의 준실시간 분석을 구현한다. 재고 모니터링이나 사기 탐지처럼 지연이 짧아야 하는 분석에 사용한다.

**HTAP**: TiDB(TiFlash), SingleStore처럼 하나의 시스템에서 OLTP와 OLAP를 모두 처리한다. 별도 ETL 파이프라인 없이 최신 데이터로 분석할 수 있지만, 전문화된 시스템보다 각 워크로드에서 성능이 낮을 수 있다.

## OLAP에서 SQL의 역할

데이터 웨어하우스가 독자적인 쿼리 언어를 사용하던 시대는 지났다. BigQuery, Snowflake, Redshift, DuckDB 모두 표준 SQL을 지원한다. WINDOW FUNCTION, CTE, 복잡한 집계가 OLAP에서 특히 자주 사용되므로, 이 구문들을 능숙하게 다룰 수 있어야 한다.

```sql
-- OLAP 전형 쿼리: 이동 평균과 누적 합계
SELECT
    order_date,
    daily_revenue,
    AVG(daily_revenue) OVER (
        ORDER BY order_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_7d_avg,
    SUM(daily_revenue) OVER (
        ORDER BY order_date
    ) AS cumulative_revenue
FROM (
    SELECT
        DATE_TRUNC('day', order_date) AS order_date,
        SUM(amount) AS daily_revenue
    FROM orders
    GROUP BY 1
) daily;
```

이어지는 OLAP 시리즈에서는 스타 스키마, SCD, BigQuery, Snowflake, Redshift, ClickHouse, DuckDB를 차례로 다룬다.

---

**지난 글:** [Vitess — MySQL 위에 쌓는 수평 샤딩 미들웨어](/posts/distsql-vitess/)

**다음 글:** [스타 스키마와 스노우플레이크 스키마](/posts/olap-star-snowflake-schema/)

<br>
읽어주셔서 감사합니다. 😊
