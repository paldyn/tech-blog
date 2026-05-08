---
title: "Oracle Reverse Key 인덱스"
description: "RAC 환경의 right-growing 인덱스 경합을 해소하는 Reverse Key 인덱스의 원리와 적용 사례, Range Scan 불가 트레이드오프를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["oracle", "reverse-key-index", "rac", "index", "buffer-busy-waits", "gc-buffer-busy", "right-growing", "insert-contention", "cache-fusion"]
featured: false
draft: false
---

[지난 글](/posts/oracle-bitmap-index/)에서 저카디널리티 컬럼에 최적화된 비트맵 인덱스를 다뤘다. 이번에는 Oracle RAC(Real Application Clusters) 환경에서 단조 증가 시퀀스 PK의 인덱스 경합을 해결하는 **Reverse Key 인덱스**를 다룬다.

## 문제: Right-Growing 인덱스와 RAC 경합

시퀀스를 PK로 사용하는 테이블에 여러 세션이 동시에 INSERT하면 어떻게 될까. 시퀀스는 단조 증가하므로 새 값은 항상 B-Tree의 **가장 오른쪽 Leaf 블록**에 삽입된다.

단일 인스턴스에서는 이 패턴이 크게 문제되지 않는다. 하지만 **RAC(Real Application Clusters)** 환경에서는 여러 노드가 **동일한 오른쪽 Leaf 블록**을 서로 경쟁해 획득하려 한다.

이 경합의 증상:

- `buffer busy waits`: 한 노드가 블록을 이미 읽는 중 다른 노드가 대기
- `gc buffer busy acquire`: RAC 인스턴스 간 블록 소유권 경쟁
- `gc cr block 2-way`: 블록의 CR 버전을 다른 인스턴스에서 가져오는 대기

```sql
-- RAC buffer busy 경합 현황
SELECT event, count(*) cnt, AVG(seconds_in_wait) avg_wait
FROM   v$session_wait
WHERE  event IN ('buffer busy waits',
                 'gc buffer busy acquire',
                 'gc cr block 2-way',
                 'gc buffer busy release')
GROUP  BY event
ORDER  BY cnt DESC;
```

---

## 해법: Reverse Key 인덱스의 원리

Reverse Key 인덱스는 인덱스 키의 **바이트 순서를 역전**해 저장한다.

예: `order_id = 1004` → 바이트 순서를 뒤집어 저장

```
일반 B-Tree: 1001, 1002, 1003, 1004 (우측 집중)
Reverse Key: 1001→1001, 1002→2001, 1003→3001, 1004→4001 (분산)
```

연속된 시퀀스 값이 역전 후 트리에서 서로 멀리 떨어진 위치에 저장된다. INSERT가 여러 Leaf 블록에 **분산**되어 경합이 사라진다.

![Reverse Key 인덱스: 문제와 해법](/assets/posts/oracle-reverse-key-index-concept.svg)

---

## 생성과 전환

```sql
-- Reverse Key 인덱스 생성
CREATE INDEX idx_orders_id_rev
ON     orders (order_id)
REVERSE;

-- 기존 B-Tree → Reverse Key 온라인 전환
ALTER INDEX idx_orders_id REBUILD REVERSE;

-- 인덱스 유형 확인
SELECT index_name, index_type, reverse
FROM   dba_indexes
WHERE  table_name = 'ORDERS';
-- REVERSE 컬럼이 'YES'이면 Reverse Key
```

`REBUILD REVERSE`는 서비스 중단 없이(ONLINE 옵션 추가 가능) 전환할 수 있다.

![Reverse Key 인덱스 생성 및 경합 진단](/assets/posts/oracle-reverse-key-index-sql.svg)

---

## 핵심 트레이드오프: Range Scan 불가

Reverse Key 인덱스의 가장 큰 단점은 **Index Range Scan이 불가능**하다는 것이다.

```sql
-- 등치 검색: Reverse Key 사용 가능 (Index Unique/Range Scan)
SELECT * FROM orders WHERE order_id = 1004;

-- 범위 검색: Reverse Key 사용 불가 (Full Scan 발생)
SELECT * FROM orders WHERE order_id BETWEEN 1000 AND 2000;
SELECT * FROM orders WHERE order_id > 5000;
SELECT * FROM orders ORDER BY order_id;
```

바이트 역전 후 인접한 값들이 트리에서 멀리 떨어지므로, 범위 기반 순차 검색이 의미 없어진다.

따라서 Reverse Key 인덱스는 **등치 조건(=)으로만 접근하는 PK 또는 FK**에 적합하다.

---

## 적용 결정 기준

| 조건 | 권장 |
|------|------|
| RAC 환경 + 시퀀스 PK + 고동시 INSERT | Reverse Key 인덱스 ✓ |
| 단일 인스턴스 | 일반 B-Tree (굳이 불필요) |
| PK로 범위 검색 빈번 | 일반 B-Tree (Reverse 부적합) |
| 해시 파티셔닝 사용 가능 | 해시 파티셔닝이 더 나은 대안 |

```sql
-- 대안: 해시 파티셔닝으로 분산
CREATE TABLE orders (
    order_id NUMBER PRIMARY KEY,
    ...
)
PARTITION BY HASH (order_id)
PARTITIONS 16;

-- 파티션별 로컬 인덱스 (분산 효과)
CREATE INDEX idx_orders_id_local
ON orders (order_id) LOCAL;
```

해시 파티셔닝은 Range Scan 제한 없이 삽입 분산을 달성할 수 있어, Reverse Key 인덱스의 우아한 대안이 될 수 있다.

---

## AWR에서 경합 이력 확인

```sql
-- AWR에서 gc buffer busy 이력 조회
SELECT snap_id, event_name, total_waits, time_waited_micro
FROM   dba_hist_system_event
WHERE  event_name LIKE 'gc%buffer%'
ORDER  BY snap_id DESC, time_waited_micro DESC
FETCH FIRST 20 ROWS ONLY;
```

---

**지난 글:** [Oracle 비트맵 인덱스](/posts/oracle-bitmap-index/)

<br>
읽어주셔서 감사합니다. 😊
