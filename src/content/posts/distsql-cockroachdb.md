---
title: "CockroachDB — 분산 SQL의 실전 구현"
description: "CockroachDB의 계층형 아키텍처(SQL·트랜잭션·분산·복제·스토리지), Raft 합의, HLC 기반 Serializable 격리, 멀티 리전 테이블을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["CockroachDB", "분산SQL", "Raft", "HLC", "멀티리전", "Serializable"]
featured: false
draft: false
---

[지난 글](/posts/distsql-distributed-transaction-limits/)에서 분산 트랜잭션의 한계와 실무 대응 전략을 살펴봤다. 이제 실제 분산 SQL 데이터베이스가 그 한계를 어떻게 구조적으로 극복하는지 살펴볼 차례다. CockroachDB는 Google Spanner의 아이디어를 오픈소스로 구현한 대표적인 NewSQL이다. PostgreSQL 와이어 프로토콜과 호환되면서도 단일 장애점 없이 글로벌 분산을 지원한다.

## CockroachDB 아키텍처 개요

CockroachDB는 5개 계층으로 구성되며, 모든 노드가 동일한 코드를 실행하는 **대칭 아키텍처(symmetric architecture)**가 특징이다. 특정 노드가 장애를 일으켜도 다른 노드가 즉시 대신할 수 있다.

![CockroachDB 계층 아키텍처](/assets/posts/distsql-cockroachdb-architecture.svg)

**SQL Layer**: PostgreSQL 호환 SQL 파서와 비용 기반 옵티마이저가 있다. `psql`, `libpq`, JDBC, SQLAlchemy 등 PostgreSQL 드라이버를 그대로 사용할 수 있다.

**Transaction Layer**: HLC(Hybrid Logical Clock)를 이용해 모든 트랜잭션에 타임스탬프를 부여하고, Serializable 격리를 기본으로 제공한다. 별도 잠금 없이 MVCC로 읽기와 쓰기를 분리한다.

**Distribution Layer**: 데이터를 64MB 단위의 **Range**로 분할해 클러스터 전체에 분산한다. 노드가 추가되거나 특정 Range에 쓰기가 집중되면 자동으로 재균형(rebalance)한다.

**Replication Layer**: 각 Range마다 독립적인 **Raft 그룹**을 구성한다. 쓰기는 Raft 리더를 통해 과반수 노드에 복제된 후 커밋된다. 리더 장애 시 과반수가 새 리더를 자동 선출한다.

**Storage Layer**: RocksDB(또는 자체 개발한 Pebble) LSM-Tree 스토리지를 사용한다. 각 노드의 로컬 SSD에 데이터를 저장하며, 복제는 Raft가 담당한다.

## HLC — Spanner TrueTime의 오픈소스 대안

Google Spanner는 GPS와 원자시계로 구현한 TrueTime API로 글로벌 트랜잭션 순서를 보장한다. CockroachDB는 이를 **HLC(Hybrid Logical Clock)**로 대체한다. HLC는 NTP 시간(물리 시계)과 논리 카운터를 결합해, 원자시계 없이도 분산 노드 간 이벤트 순서를 결정한다.

```sql
-- HLC 타임스탬프 확인 (CRDB 전용)
SELECT cluster_logical_timestamp();
-- 예: 1685000000000000000.0000000000

-- 트랜잭션 타임스탬프 기반 읽기 (AS OF SYSTEM TIME)
SELECT * FROM orders
AS OF SYSTEM TIME '-5s';  -- 5초 전 스냅샷 읽기
```

HLC의 한계는 시계 오차(clock skew)가 크면 커밋 지연이 길어진다는 점이다. CockroachDB는 노드 간 최대 허용 clock skew(기본 500ms)를 초과하면 오류를 반환해 데이터 일관성을 보호한다.

## Serializable 격리와 SSI

CockroachDB의 기본 격리 수준은 **Serializable**이다. MySQL의 기본 Repeatable Read, PostgreSQL의 기본 Read Committed보다 강력하다. 내부적으로 **SSI(Serializable Snapshot Isolation)**를 사용해 팬텀 읽기와 쓰기 스큐(write skew)까지 방지한다.

```sql
-- Serializable 트랜잭션 (기본값)
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- snapshot 읽기
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- 커밋 시점에 충돌 감지 → 충돌 시 자동 재시도(RETRY) 오류
COMMIT;

-- 재시도 루프 패턴 (드라이버가 자동 처리하거나 직접 구현)
-- SQLSTATE 40001 → 재시도
```

SSI에서는 커밋 시 다른 트랜잭션의 쓰기와 충돌 여부를 검사한다. 충돌이 감지되면 `RETRY_WRITE_TOO_OLD` 오류를 반환하고, 애플리케이션이 재시도한다. CRDB 드라이버들은 이 재시도 루프를 자동으로 처리한다.

## 멀티 리전 테이블

CockroachDB의 가장 독특한 기능 중 하나는 **행 단위 리전 핀닝(Regional by Row)**이다. 같은 테이블의 행이라도 region 컬럼 값에 따라 데이터를 해당 리전의 노드에 물리적으로 배치한다. 한국 사용자의 데이터는 서울 리전에, 미국 사용자 데이터는 버지니아 리전에 저장하면서 동일한 테이블로 통합 조회할 수 있다.

![CockroachDB SQL 특징과 멀티 리전](/assets/posts/distsql-cockroachdb-sql.svg)

```sql
-- 데이터베이스에 리전 추가
ALTER DATABASE globalapp ADD REGION 'us-east1';
ALTER DATABASE globalapp ADD REGION 'eu-west1';
ALTER DATABASE globalapp ADD REGION 'ap-northeast1';
ALTER DATABASE globalapp SET PRIMARY REGION 'us-east1';

-- 행 단위 리전 핀닝 테이블
CREATE TABLE users (
    id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name      STRING        NOT NULL,
    email     STRING        UNIQUE,
    region    crdb_internal_region  -- 자동 생성 컬럼
) LOCALITY REGIONAL BY ROW;

-- 행 삽입 시 리전 지정
INSERT INTO users (name, email, region)
VALUES ('김철수', 'kim@example.com', 'ap-northeast1');
-- 이 행의 Raft 리더가 ap-northeast1에 배치됨
```

`LOCALITY GLOBAL`로 전체 리전에 동기 복제되는 테이블을 만들 수도 있다. 이는 설정 테이블처럼 모든 리전에서 빠르게 읽어야 하지만 쓰기가 적은 경우에 적합하다.

## CockroachDB의 한계

모든 것을 해결하지는 않는다. **쓰기 핫스팟**은 여전히 주의해야 한다. 순차 증가하는 INT PK를 사용하면 모든 INSERT가 마지막 Range 하나에 집중된다. UUID 또는 ULID를 PK로 사용해 쓰기를 여러 Range에 분산해야 한다. 또한 Serializable 격리 기본값은 강력하지만, 쓰기 충돌이 많은 워크로드에서는 재시도 오버헤드가 늘어날 수 있다. 이 경우 Read Committed로 낮추거나 애플리케이션 레벨에서 충돌 회피 설계가 필요하다.

---

**지난 글:** [분산 트랜잭션의 한계와 실무 대응 전략](/posts/distsql-distributed-transaction-limits/)

**다음 글:** [TiDB — TiKV와 TiFlash로 구현하는 HTAP](/posts/distsql-tidb-tikv-tiflash/)

<br>
읽어주셔서 감사합니다. 😊
