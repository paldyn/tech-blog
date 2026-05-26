---
title: "TiDB — TiKV와 TiFlash로 구현하는 HTAP"
description: "TiDB의 HTAP 아키텍처를 핵심 구성요소(TiDB SQL 노드, TiKV 행 스토리지, TiFlash 열 스토리지, PD 조율자)별로 설명하고, OLTP와 OLAP 쿼리를 같은 데이터베이스에서 처리하는 방식을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["TiDB", "TiKV", "TiFlash", "HTAP", "분산SQL", "Raft", "NewSQL"]
featured: false
draft: false
---

[지난 글](/posts/distsql-cockroachdb/)에서 CockroachDB의 Raft 기반 분산 아키텍처를 살펴봤다. 이번에는 다른 접근 방식을 택한 분산 SQL, TiDB를 다룬다. TiDB의 핵심 차별점은 **HTAP(Hybrid Transactional and Analytical Processing)**이다. 같은 데이터에 대해 OLTP와 OLAP 쿼리를 별도 데이터 이동 없이 동시에 처리한다.

## TiDB 핵심 구성요소

TiDB 클러스터는 크게 세 가지 역할로 나뉜다.

![TiDB HTAP 아키텍처](/assets/posts/distsql-tidb-tikv-tiflash-arch.svg)

**TiDB SQL 노드**: MySQL 5.7 프로토콜과 호환되는 SQL 레이어다. Stateless 설계라 수평 확장이 자유롭고, 실패 시 다른 TiDB 노드가 즉시 대체한다. 쿼리 파싱, 최적화, 실행 계획 생성을 담당한다.

**PD (Placement Driver)**: 클러스터 메타데이터를 관리하고, 글로벌 트랜잭션 타임스탬프(TSO)를 발급한다. TiKV의 Region(데이터 조각) 스케줄링과 부하 분산도 PD가 담당한다.

**TiKV**: 행 기반(row-oriented) 분산 키-값 스토리지다. 데이터를 96MB 크기의 Region으로 나눠 클러스터에 분산하고, 각 Region마다 Raft 그룹으로 복제한다. OLTP 쿼리의 기본 스토리지다.

**TiFlash**: 열 기반(columnar) 스토리지로, TiKV의 Raft Learner로 동작한다. TiKV에 쓰인 데이터를 비동기적으로 복제받아 열 형식으로 저장한다. 대규모 집계와 범위 스캔에 최적화돼 있다.

## HTAP: 같은 데이터, 두 가지 엔진

전통적인 OLTP + OLAP 아키텍처는 ETL로 분리된 데이터 웨어하우스가 필요하다. TiDB는 TiFlash가 TiKV의 Raft Learner로서 실시간으로 복제를 받기 때문에, 추가 파이프라인 없이 분석 쿼리를 신선한 데이터로 실행할 수 있다.

![TiDB OLTP vs OLAP 실행](/assets/posts/distsql-tidb-tikv-tiflash-htap.svg)

```sql
-- TiFlash 활성화 (테이블별 설정)
ALTER TABLE orders SET TIFLASH REPLICA 2;

-- 복제 상태 확인
SELECT TABLE_NAME, REPLICA_COUNT, AVAILABLE
FROM information_schema.tiflash_replica
WHERE TABLE_NAME = 'orders';

-- 옵티마이저가 자동으로 TiFlash 선택 (분석 쿼리)
SELECT product_id, SUM(amount) AS revenue
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY product_id
ORDER BY revenue DESC
LIMIT 20;
-- EXPLAIN 출력에 "cop[tiflash]" 확인
```

옵티마이저는 쿼리 패턴을 분석해 포인트 조회는 TiKV, 집계·범위 스캔은 TiFlash로 자동 라우팅한다. 힌트(`READ_FROM_STORAGE`)로 명시적으로 지정할 수도 있다.

## Percolator 기반 분산 트랜잭션

TiDB는 Google Percolator 논문을 기반으로 한 **낙관적 트랜잭션 모델**을 사용한다. 모든 읽기는 TSO에서 받은 타임스탬프 기준의 스냅샷을 읽는다. 쓰기는 Two-Phase Lock 방식으로 진행되지만, TiKV 내에서 분산 처리된다.

```sql
-- TiDB 트랜잭션 (MySQL 호환)
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
UPDATE accounts SET balance = balance + 500 WHERE id = 2;
COMMIT;

-- 비관적 잠금 모드 (MySQL과 동일한 동작)
SET tidb_txn_mode = 'pessimistic';
BEGIN;
-- FOR UPDATE 즉시 락 획득
SELECT * FROM inventory WHERE id = 100 FOR UPDATE;
UPDATE inventory SET qty = qty - 1 WHERE id = 100;
COMMIT;
```

기본값은 낙관적 모드지만, 쓰기 충돌이 많은 워크로드에는 비관적 모드가 성능상 유리할 수 있다.

## Region과 핫스팟 문제

TiKV의 Region은 기본 96MB이며, 크기 초과 시 자동 분할된다. 순차 INSERT가 많으면 마지막 Region에 쓰기가 집중되는 핫스팟이 발생한다. TiDB는 이를 해결하기 위해 `AUTO_RANDOM` PK를 제공한다.

```sql
-- 핫스팟 방지: AUTO_RANDOM (내부적으로 값 샤딩)
CREATE TABLE orders (
    id      BIGINT      AUTO_RANDOM PRIMARY KEY,
    user_id BIGINT      NOT NULL,
    amount  DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AUTO_RANDOM은 값을 랜덤하게 배분해 쓰기가 여러 Region에 분산됨
-- AUTO_INCREMENT와 달리 last_insert_id()가 다를 수 있음에 주의
```

## TiDB vs CockroachDB 선택 기준

**TiDB를 선택할 때**: MySQL을 사용하고 있고 분산 확장이 필요한 경우, 별도 데이터 파이프라인 없이 OLTP+OLAP를 함께 처리해야 하는 경우, 중국·아시아 기업 생태계와 연동이 필요한 경우.

**CockroachDB를 선택할 때**: PostgreSQL 생태계를 선호하는 경우, 글로벌 멀티 리전 배포에서 행 단위 지역 핀닝이 필요한 경우, 강한 일관성(Serializable)이 기본값으로 필요한 경우.

두 시스템 모두 Raft를 사용하는 분산 SQL이지만, TiDB는 HTAP과 MySQL 호환성, CockroachDB는 멀티 리전과 PostgreSQL 호환성에서 강점을 보인다.

---

**지난 글:** [CockroachDB — 분산 SQL의 실전 구현](/posts/distsql-cockroachdb/)

**다음 글:** [YugabyteDB — PostgreSQL과 Cassandra의 분산 결합](/posts/distsql-yugabytedb/)

<br>
읽어주셔서 감사합니다. 😊
