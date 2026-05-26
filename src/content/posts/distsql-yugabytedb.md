---
title: "YugabyteDB — PostgreSQL과 Cassandra의 분산 결합"
description: "YugabyteDB의 이중 API 아키텍처(YSQL·YCQL), DocDB 분산 스토리지, 지오-분산 Tablespace, 팔로워 읽기, Serializable 격리를 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["YugabyteDB", "YSQL", "YCQL", "DocDB", "분산SQL", "지오분산", "Raft"]
featured: false
draft: false
---

[지난 글](/posts/distsql-tidb-tikv-tiflash/)에서 TiDB의 HTAP 아키텍처를 살펴봤다. 이번에는 또 다른 접근 방식의 분산 SQL인 YugabyteDB를 다룬다. YugabyteDB의 가장 독특한 점은 **두 가지 API를 동시에 제공한다**는 것이다. PostgreSQL 호환 SQL과 Apache Cassandra 호환 NoSQL을 같은 분산 스토리지 엔진 위에서 운영할 수 있다.

## 이중 API 아키텍처

YugabyteDB는 하나의 분산 스토리지 엔진(DocDB) 위에 두 개의 API 레이어를 쌓는 구조다.

![YugabyteDB 이중 API 아키텍처](/assets/posts/distsql-yugabytedb-arch.svg)

**YSQL**: PostgreSQL 13의 쿼리 엔진을 직접 가져와 분산 스토리지에 연결한 API다. PostgreSQL의 시스템 카탈로그, 확장(extension), 타입 시스템, 함수를 그대로 사용할 수 있다. 포트 5433에서 동작하며 표준 psql이나 pgAdmin으로 접속한다.

**YCQL**: Cassandra CQL과 호환되는 NoSQL API다. 포트 9042에서 동작하며, 기존 Cassandra 드라이버와 앱을 그대로 연결할 수 있다. YSQL보다 단순한 쿼리 모델이지만 초고속 키-값 조회에 유리하다.

**DocDB**: 두 API가 공유하는 분산 스토리지 레이어다. 데이터를 64MB Tablet으로 분할하고, 각 Tablet마다 Raft 그룹으로 복제한다. 내부 스토리지는 RocksDB(LSM-Tree) 기반이다.

## YB-TServer와 YB-Master

모든 노드는 **YB-TServer** 역할을 수행한다. TServer는 실제 데이터(Tablet)를 저장하고 Raft로 복제하는 역할이다. 각 TServer는 여러 Tablet의 리더 또는 팔로워가 된다. 특정 노드가 Tablet 리더를 많이 가지면 YB-Master가 자동으로 재균형한다.

**YB-Master**는 클러스터 메타데이터와 카탈로그를 관리하며, Tablet 위치 정보를 클라이언트에 제공한다. YB-Master 자체도 Raft 그룹으로 고가용성을 보장한다.

## 지오-분산: Tablespace 핀닝

YugabyteDB의 지오-분산 방식은 PostgreSQL의 Tablespace 개념을 확장한다. 특정 Tablespace를 특정 리전의 노드에 매핑하면, 해당 Tablespace에 배치된 테이블의 데이터가 해당 리전에 저장된다.

![YSQL 지오분산과 팔로워 읽기](/assets/posts/distsql-yugabytedb-sql.svg)

```sql
-- 여러 리전에 Tablespace 생성
CREATE TABLESPACE us_east_ts WITH (
  replica_placement = '{"num_replicas": 3, "placement_blocks": [
    {"cloud":"aws","region":"us-east-1","zone":"us-east-1a","min_num_replicas":1},
    {"cloud":"aws","region":"us-east-1","zone":"us-east-1b","min_num_replicas":1},
    {"cloud":"aws","region":"us-east-1","zone":"us-east-1c","min_num_replicas":1}
  ]}'
);

-- 테이블을 특정 Tablespace에 배치
CREATE TABLE us_orders (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    amount      NUMERIC(12,2),
    created_at  TIMESTAMPTZ DEFAULT NOW()
) TABLESPACE us_east_ts;
```

같은 스키마의 테이블을 리전별로 나눠 배치하고, 뷰나 파티셔닝으로 통합 조회하는 패턴을 사용한다.

## 팔로워 읽기

Raft 리더에서만 읽으면 WAN 환경에서 지연이 크다. YugabyteDB는 **팔로워 읽기(follower reads)**를 지원한다. 허용 가능한 오래된 데이터(staleness) 범위 내에서 가장 가까운 팔로워에서 읽는다. 읽기 지연을 크게 줄이면서도 일관성의 정도를 staleness로 제어할 수 있다.

```sql
-- 글로벌 팔로워 읽기 설정
SET yb_read_from_followers = TRUE;
SET yb_follower_read_staleness_ms = 10000;  -- 10초 오래된 데이터 허용

-- 세션별 설정도 가능
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ
  READ ONLY
  AS OF SYSTEM TIME '-10s';

SELECT COUNT(*) FROM orders WHERE status = 'COMPLETED';
COMMIT;
```

## YSQL Serializable 격리

YSQL의 기본 격리 수준은 Read Committed이지만, Serializable을 완전히 지원한다. 내부적으로는 PostgreSQL의 SSI(Serializable Snapshot Isolation)을 분산 환경에 적용한다.

```sql
-- Serializable 트랜잭션
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT qty FROM inventory WHERE product_id = 100;
-- qty = 5 읽음

UPDATE inventory SET qty = qty - 2 WHERE product_id = 100;
COMMIT;
-- 커밋 시점에 다른 트랜잭션이 같은 행을 읽거나 수정했으면 직렬화 오류 발생
-- ERROR: could not serialize access due to concurrent update
```

## YCQL로 Cassandra 워크로드 이전

Cassandra에서 YugabyteDB로 이전할 때 YCQL API를 사용하면 코드 변경을 최소화할 수 있다. 단, YugabyteDB는 Cassandra와 달리 다중 파티션 트랜잭션과 보조 인덱스를 완전히 지원하므로, Cassandra의 설계 제약(단일 파티션 중심)을 그대로 적용할 필요가 없다.

CockroachDB, TiDB, YugabyteDB는 모두 Raft 기반 분산 SQL이지만 강조점이 다르다. CockroachDB는 멀티 리전 PostgreSQL, TiDB는 HTAP, YugabyteDB는 이중 API와 Cassandra 이전 경로가 강점이다.

---

**지난 글:** [TiDB — TiKV와 TiFlash로 구현하는 HTAP](/posts/distsql-tidb-tikv-tiflash/)

**다음 글:** [Google Spanner — TrueTime과 글로벌 일관성](/posts/distsql-spanner-truetime/)

<br>
읽어주셔서 감사합니다. 😊
