---
title: "PostgreSQL 논리 복제 — 선택적 복제와 버전 업그레이드"
description: "물리 복제와 달리 테이블 단위로 복제할 수 있는 논리 복제(Logical Replication)의 동작 원리, Publication·Subscription 설정, DDL 복제 제한, 그리고 무중단 버전 업그레이드 활용법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["postgresql", "logical-replication", "논리복제", "publication", "subscription", "버전업그레이드"]
featured: false
draft: false
---

[지난 글](/posts/pg-streaming-replication/)에서 WAL 스트림으로 전체 데이터베이스를 복제하는 스트리밍 복제를 살펴봤습니다. 이번에는 더 유연한 복제 방식인 **논리 복제(Logical Replication)** 를 다룹니다. 특정 테이블만 복제하거나, 서로 다른 PostgreSQL 버전 간에 데이터를 동기화할 수 있습니다.

## 논리 복제 vs 물리 복제

![논리 복제 vs 물리(스트리밍) 복제](/assets/posts/pg-logical-replication-arch.svg)

물리 복제는 WAL 바이트를 그대로 전송합니다. 전체 클러스터가 복제되고, 같은 버전이어야 하며, Standby는 읽기 전용입니다.

논리 복제는 WAL에서 **행 단위 변경 이벤트**를 디코딩해 전송합니다. 테이블을 골라 복제할 수 있고, 구독자 서버에서 해당 테이블에 쓰기도 가능합니다. 다른 메이저 버전 간 복제도 지원합니다.

## 핵심 개념: Publication과 Subscription

논리 복제는 게시-구독(Pub/Sub) 모델로 동작합니다.

- **Publication**: 게시자(Publisher) 서버가 복제할 테이블과 이벤트(INSERT/UPDATE/DELETE/TRUNCATE)를 정의
- **Subscription**: 구독자(Subscriber) 서버가 특정 Publication에 연결해 변경을 수신·적용

## 설정 방법

![논리 복제 설정 — Publication / Subscription](/assets/posts/pg-logical-replication-setup.svg)

### Publisher 설정

```sql
-- 1. postgresql.conf: wal_level = logical (재시작 필요)

-- 2. 특정 테이블만 발행
CREATE PUBLICATION pub_orders
FOR TABLE orders, order_items;

-- 3. INSERT만 복제하려면
CREATE PUBLICATION pub_insert_only
FOR TABLE events
WITH (publish = 'insert');
```

### Subscriber 설정

```sql
-- Subscriber 서버에서 실행
-- (대상 테이블이 Subscriber에 미리 존재해야 함)
CREATE SUBSCRIPTION sub_orders
CONNECTION 'host=pub_host port=5432 dbname=mydb user=replicator password=...'
PUBLICATION pub_orders;

-- 복제 상태 확인
SELECT subname, pid, received_lsn, latest_end_lsn, last_msg_receipt_time
FROM   pg_stat_subscription;
```

구독 생성 시 초기 데이터 스냅샷을 가져온 후 이후 변경분을 스트리밍합니다.

## 무중단 메이저 버전 업그레이드

논리 복제의 가장 강력한 활용 사례는 **무중단 메이저 버전 업그레이드**입니다.

```
[PG 15 구버전]  --논리 복제-->  [PG 17 신버전]
   Publication                    Subscription
```

1. PG 17 신버전 서버를 준비하고 동일 스키마를 생성합니다 (DDL은 자동 복제 안 됨).
2. PG 15에 Publication, PG 17에 Subscription을 만들어 복제를 시작합니다.
3. 복제 지연이 0에 수렴하면 애플리케이션 트래픽을 PG 17로 전환합니다.
4. PG 15를 종료합니다.

```sql
-- 복제 지연 모니터링 (PG 17 구독자에서)
SELECT subname,
       extract(epoch FROM (NOW() - last_msg_receipt_time)) AS lag_seconds
FROM   pg_stat_subscription;
```

지연이 1초 미만으로 안정되면 전환 타이밍입니다.

## DDL 복제 제한

논리 복제는 **DML(INSERT/UPDATE/DELETE)만 자동으로 복제**합니다. DDL(ALTER TABLE, CREATE INDEX 등)은 복제되지 않습니다. 스키마 변경 시 Publisher와 Subscriber 양쪽에 수동으로 적용해야 합니다.

```sql
-- Publisher와 Subscriber 양쪽에 동일하게 적용
ALTER TABLE orders ADD COLUMN notes TEXT;
```

이 제한을 우회하려면 pglogical 같은 서드파티 익스텐션을 사용하거나, 배포 파이프라인에서 DDL을 양쪽에 동시 적용하는 절차를 명시적으로 관리합니다.

## 주의사항

- 복제 대상 테이블에 **PRIMARY KEY 또는 UNIQUE NOT NULL 컬럼**이 있어야 UPDATE/DELETE 복제가 가능합니다.
- `TRUNCATE`는 PostgreSQL 11+에서 복제 가능하지만, Foreign Key 참조가 있는 테이블에서는 주의가 필요합니다.
- Replication Slot이 쌓이면 Publisher의 WAL 디스크가 증가하므로 `pg_stat_replication_slots`를 모니터링합니다.

---

**지난 글:** [PostgreSQL 스트리밍 복제 — WAL 기반 고가용성](/posts/pg-streaming-replication/)

**다음 글:** [PostgreSQL PITR과 베이스 백업 — 복구 시점 제어](/posts/pg-pitr-base-backup/)

<br>
읽어주셔서 감사합니다. 😊
