---
title: "DuckDB — 임베디드 OLAP 엔진"
description: "DuckDB의 in-process 아키텍처, 벡터화 실행, Parquet/S3/pandas 직접 쿼리, PIVOT·EXCLUDE 등 Friendly SQL 확장, SQLite와의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["DuckDB", "임베디드", "OLAP", "Parquet", "벡터화실행", "FriendlySQL"]
featured: false
draft: false
---

[지난 글](/posts/olap-clickhouse/)에서 ClickHouse의 MergeTree 엔진과 실시간 분석 패턴을 살펴봤다. 이번에는 완전히 다른 포지션을 가진 **DuckDB**를 다룬다. DuckDB는 2019년 CWI(네덜란드 국립 수학·컴퓨터 과학 연구소)에서 출발해 2022년부터 빠르게 인기를 얻고 있다. "분석용 SQLite"라는 별명처럼, 서버 없이 프로세스 내에서 실행되는 열 지향 OLAP 엔진이다.

## in-process 아키텍처

DuckDB의 가장 큰 특징은 **별도 프로세스나 서버가 없다**는 점이다. Python, R, Node.js, Java 등 다양한 언어에서 라이브러리로 임포트하면 DuckDB 엔진 전체가 애플리케이션 프로세스 안에 로드된다.

![DuckDB 임베디드 아키텍처](/assets/posts/olap-duckdb-arch.svg)

```python
import duckdb

# 연결 — 파일 또는 인메모리
con = duckdb.connect('analytics.duckdb')   # 파일
con = duckdb.connect(':memory:')            # 인메모리
```

의존성이 없고(pip install duckdb 한 줄), 배포가 단순하며, IPC 오버헤드가 없다. 단일 파일(`.duckdb`)에 모든 데이터를 저장하므로 공유와 백업도 간단하다.

## 벡터화 실행과 멀티스레드

DuckDB는 내부적으로 **벡터 단위(기본 2048행)** 처리와 멀티스레드 병렬화를 결합한다. 분석 쿼리 실행 시 사용 가능한 CPU 코어를 자동으로 활용한다.

```sql
-- 멀티스레드 설정 (기본: 모든 코어)
SET threads = 4;

-- 현재 설정 확인
SELECT * FROM duckdb_settings() WHERE name = 'threads';
```

로컬 노트북에서도 수억 행 CSV/Parquet 집계를 수 초 내에 처리할 수 있는 이유다.

## Parquet, S3, pandas 직접 쿼리

DuckDB의 킬러 기능이다. 파일을 DB에 임포트하지 않고도 직접 SQL로 쿼리할 수 있다.

```sql
-- 로컬 Parquet 직접 쿼리
SELECT region, SUM(amount) AS total
  FROM read_parquet('sales/2025/**/*.parquet')
 GROUP BY region;

-- S3 원격 Parquet 쿼리
INSTALL httpfs;
LOAD httpfs;
SET s3_region = 'ap-northeast-2';
SELECT count(*) FROM read_parquet('s3://my-bucket/data/*.parquet');

-- CSV도 동일
SELECT * FROM read_csv_auto('events.csv') LIMIT 10;
```

![DuckDB SQL 패턴](/assets/posts/olap-duckdb-sql.svg)

## pandas/Arrow 제로-카피 통합

Python에서 DuckDB는 pandas DataFrame과 Arrow Table을 복사 없이 직접 쿼리한다.

```python
import duckdb, pandas as pd

df = pd.read_csv('sales.csv')

# df를 복사 없이 SQL 쿼리 (제로-카피)
result = duckdb.sql("""
    SELECT region,
           SUM(amount)  AS total,
           COUNT(*)     AS cnt
      FROM df
     GROUP BY region
     ORDER BY total DESC
""").df()   # pandas DataFrame으로 반환

# Arrow로도 반환 가능
arrow_result = duckdb.sql("SELECT * FROM df").arrow()
```

데이터 과학 워크플로에서 pandas → DuckDB → pandas 변환 비용이 없으므로, 대용량 데이터 가공에서 pandas만 사용할 때보다 훨씬 빠르다.

## Friendly SQL — DuckDB의 문법 확장

DuckDB는 분석 편의를 위한 비표준 SQL 확장을 제공한다.

```sql
-- SELECT * 에서 특정 컬럼 제외
SELECT * EXCLUDE (password, token)
  FROM users;

-- 컬럼 변환 인라인
SELECT * REPLACE (amount * 1.1 AS amount)
  FROM orders;

-- FROM 먼저 쓰기 (Friendly SQL)
FROM orders
SELECT region, SUM(amount) AS total
GROUP BY region;

-- 테이블 요약 통계 (SUMMARIZE)
SUMMARIZE orders;
```

## PIVOT 네이티브 지원

```sql
-- 월별 지역 매출 피벗
PIVOT orders
ON   MONTH(order_dt)
USING SUM(amount)
GROUP BY region;
-- region | 1       | 2       | 3       | ...
-- 서울   | 1000000 | 900000  | 1100000 | ...
```

다른 DB에서는 조건부 집계나 별도 함수가 필요했던 피벗을 한 줄로 처리한다.

## DuckDB vs SQLite vs BigQuery

| 항목 | SQLite | DuckDB | BigQuery |
|---|---|---|---|
| 스토리지 방향 | 행 지향 | 열 지향 | 열 지향 |
| 주 용도 | OLTP (단건 CRUD) | OLAP (집계) | OLAP (대규모) |
| 서버 | 없음 | 없음 | 서버리스(관리형) |
| 최대 규모 | 수십 GB | 수백 GB~수 TB | 페타바이트 |
| 과금 | 없음 | 없음 | TB 스캔/슬롯 |
| JOIN 성능 | 보통 | 빠름 | 빠름 |

## 정리

DuckDB는 "로컬에서 빠르게 분석"하는 모든 상황에 적합하다. Jupyter Notebook 분석, dbt 로컬 테스트, ETL 중간 처리, BI 백엔드 경량 대안으로 활용도가 높다. BigQuery나 Snowflake 같은 관리형 DW가 과한 상황 — 팀 규모가 작거나, 데이터가 TB 이하거나, 클라우드 과금을 피하고 싶을 때 — DuckDB가 최선의 선택이 될 수 있다.

---

**지난 글:** [ClickHouse — 실시간 분석 특화 OLAP](/posts/olap-clickhouse/)

**다음 글:** [Raw SQL vs ORM — 언제 무엇을 쓸까](/posts/orm-raw-sql-vs-orm/)

<br>
읽어주셔서 감사합니다. 😊
