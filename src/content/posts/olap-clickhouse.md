---
title: "ClickHouse — 실시간 분석 특화 OLAP"
description: "ClickHouse의 MergeTree 엔진 구조, Sparse Primary Index, 열 지향 압축, LowCardinality 타입, 실시간 집계 쿼리 패턴과 적합한 사용 사례를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["ClickHouse", "MergeTree", "OLAP", "열지향", "실시간분석", "SparseIndex"]
featured: false
draft: false
---

[지난 글](/posts/olap-redshift-architecture/)에서 Redshift의 MPP 아키텍처와 DISTKEY 설계를 살펴봤다. 이번에는 클라우드 3사 DW와는 결이 다른 **ClickHouse**를 다룬다. ClickHouse는 2016년 Yandex가 오픈소스로 공개한 열 지향 OLAP 데이터베이스다. "1억 행 집계를 1초 이내에"라는 벤치마크 수치로 유명하며, 실시간 분석·로그 집계·이벤트 스트림 분석에 특화된 설계를 갖고 있다.

## MergeTree 엔진 — ClickHouse의 핵심

ClickHouse의 스토리지 엔진 계열 이름이 **MergeTree**다. 이름 그대로 LSM(Log-Structured Merge) 트리 아이디어에서 영감을 받았다.

INSERT가 발생하면 **파트(Part)**라는 독립된 파일 집합이 생성된다. 파트는 `ORDER BY` 기준으로 정렬된 열 파일(`.bin`), 스파스 인덱스(`.idx`), 마크 파일(`.mrk`)로 구성된다. 백그라운드 Merge 프로세스가 여러 파트를 하나로 합치며 정렬 상태를 유지한다.

![MergeTree 엔진 구조](/assets/posts/olap-clickhouse-mergetree.svg)

```sql
CREATE TABLE events
(
  event_ts  DateTime,
  user_id   UInt64,
  action    LowCardinality(String),
  cnt       UInt32
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_ts)
ORDER BY (user_id, event_ts)
SETTINGS index_granularity = 8192;
```

- `ENGINE = MergeTree`: 가장 기본적인 엔진. ReplicatedMergeTree를 쓰면 자동 복제된다.
- `PARTITION BY`: 파티션 키. 오래된 파티션 전체를 `DROP PARTITION`으로 빠르게 제거할 수 있다.
- `ORDER BY`: 데이터 정렬 키이자 스파스 인덱스의 기준. 자주 필터링하는 컬럼을 앞에 배치한다.
- `index_granularity`: 스파스 인덱스 1개당 행 수. 기본 8192.

## Sparse Primary Index — B-Tree 없는 인덱스

ClickHouse는 B-Tree 인덱스를 사용하지 않는다. 대신 **Granule** 단위(기본 8192행)마다 `ORDER BY` 컬럼의 첫 행 값을 인덱스로 저장한다. 인덱스가 매우 작아 메모리에 상주할 수 있다.

쿼리 실행 시 스파스 인덱스를 이진 탐색해 관련 Granule 범위를 파악하고, 해당 범위의 열 블록만 읽는다. 이 방식이 수십억 행 테이블에서도 빠른 응답을 가능하게 한다.

```sql
-- ORDER BY (user_id, event_ts)로 설계된 경우
-- 아래 쿼리: user_id 필터로 Granule Pruning → 빠름
SELECT count() FROM events WHERE user_id = 12345;

-- user_id 없이 event_ts만 필터: 첫 번째 컬럼이 아니므로 Pruning 미작동
SELECT count() FROM events WHERE event_ts >= '2025-01-01';
-- → Skipping Index 또는 파티션으로 보완 필요
```

## LowCardinality 타입

반복값이 많은 문자열 컬럼(`status`, `country`, `action` 등)에 `LowCardinality(String)`을 사용하면 내부적으로 사전 인코딩이 적용된다. 압축률이 높아지고 GROUP BY 속도가 크게 개선된다.

```sql
-- LowCardinality 적용 전후 비교 (예시)
-- 일반: country VARCHAR → 문자열 자체 저장
-- LowCardinality: UInt16 인덱스 + 사전 → ~10x 압축, GROUP BY 3x 빠름

ALTER TABLE events
  MODIFY COLUMN action LowCardinality(String);
```

## MergeTree 계열 특수 엔진

| 엔진 | 용도 |
|---|---|
| `ReplacingMergeTree` | Merge 시 동일 키의 최신 행만 보존 (중복 제거) |
| `SummingMergeTree` | Merge 시 숫자 컬럼 자동 합산 |
| `AggregatingMergeTree` | 집계 상태(AggregateState)를 파트에 저장 |
| `CollapsingMergeTree` | sign=-1 행으로 기존 행 논리적 삭제 |
| `ReplicatedMergeTree` | ZooKeeper/Keeper 기반 자동 복제 |

![ClickHouse SQL 패턴](/assets/posts/olap-clickhouse-sql.svg)

## 분산 처리 — Distributed 엔진

단일 서버로 부족하면 `Distributed` 엔진으로 샤딩한다.

```sql
-- 클러스터의 각 샤드에 로컬 테이블 생성
CREATE TABLE events_local ON CLUSTER my_cluster (...) ENGINE = MergeTree ...;

-- 분산 테이블 (쿼리 진입점)
CREATE TABLE events ON CLUSTER my_cluster AS events_local
ENGINE = Distributed(my_cluster, default, events_local, user_id);
```

`Distributed` 엔진은 각 샤드의 로컬 테이블로 쿼리를 분산하고 결과를 집계한다. 샤딩 키(`user_id`)로 데이터를 분산해 JOIN·집계 시 노드 간 이동을 최소화한다.

## ClickHouse의 적합한 사례

- **로그/이벤트 분석**: 클릭로그, 서버 로그, IoT 센서 데이터 등 단방향 대량 INSERT + 집계 쿼리
- **실시간 대시보드**: Grafana, Superset 등과 연동해 초 단위 지표 갱신
- **광고 분석**: 노출/클릭 수 집계, 퍼널 분석
- **부적합한 사례**: 단건 CRUD가 잦은 OLTP, 복잡한 다중 테이블 JOIN이 핵심인 워크로드

## 정리

ClickHouse의 속도 비결은 세 가지다. ① 열 지향 저장으로 집계에 필요한 컬럼만 읽는다. ② 벡터화 실행으로 SIMD 연산을 활용한다. ③ 스파스 인덱스로 관련 Granule만 읽는다. 단건 업데이트가 느리고 트랜잭션 지원이 제한적이므로 OLTP와 혼용하지 않고, 분석 전용 사이드카 DB로 활용하는 패턴이 가장 효과적이다.

---

**지난 글:** [Redshift 아키텍처 — MPP 열 지향 DW](/posts/olap-redshift-architecture/)

**다음 글:** [DuckDB — 임베디드 OLAP 엔진](/posts/olap-duckdb/)

<br>
읽어주셔서 감사합니다. 😊
