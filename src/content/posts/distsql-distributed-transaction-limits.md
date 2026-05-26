---
title: "분산 트랜잭션의 한계와 실무 대응 전략"
description: "2PC와 SAGA가 가진 구조적 한계(네트워크 지연, Coordinator 장애, 부분 실패, 확장성)를 분석하고, Outbox 패턴·멱등 키·최종 일관성 수용 등 실무 대응 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["분산트랜잭션", "한계", "OutboxPattern", "멱등키", "최종일관성", "분산SQL"]
featured: false
draft: false
---

[지난 글](/posts/distsql-2pc-saga/)에서 2PC와 SAGA 패턴의 동작 원리를 살펴봤다. 두 방식 모두 분산 트랜잭션 문제를 해결하려는 시도지만, 각각 고유한 한계가 있다. 이번 글에서는 그 한계를 구체적으로 짚고, 실무에서 어떻게 대응하는지를 다룬다.

## 분산 트랜잭션의 구조적 한계

단일 DB 트랜잭션이 가진 편리함은 분산 환경에서 대가를 치른다. 아래 네 가지가 대표적인 한계다.

![분산 트랜잭션 4가지 핵심 한계](/assets/posts/distsql-distributed-transaction-limits-problems.svg)

### ① 네트워크 지연 증폭

2PC는 최소 2번의 네트워크 라운드트립이 필요하다. 같은 데이터센터라면 RTT가 0.5ms 이하라 큰 문제가 없지만, WAN(광역 네트워크) 환경에서는 RTT가 수십~수백 ms에 달한다. Prepare → VoteYes → Commit 각 단계가 순차적으로 진행되므로, 한 트랜잭션에 200~400ms가 쉽게 소요된다. 이는 초당 처리 가능한 트랜잭션 수를 수천에서 수백으로 떨어뜨린다.

```sql
-- 지연 측정 예시 (PostgreSQL)
EXPLAIN (ANALYZE, BUFFERS)
SELECT pg_sleep(0); -- 로컬: 0.1ms vs WAN Coordinator: 150ms+
```

### ② Coordinator 단일 장애점

2PC의 Phase 1과 Phase 2 사이에 Coordinator가 다운되면, Participant들은 락을 쥔 채로 Coordinator가 복구될 때까지 기다린다. 이 **in-doubt 기간** 동안 해당 레코드를 건드리는 모든 트랜잭션이 블로킹된다. 고가용성을 위해 Coordinator를 이중화해도, 페일오버 과정에서 in-doubt 상태를 정확히 복원하는 것은 매우 복잡하다.

### ③ 부분 실패의 모호함

노드 A에 Commit 메시지를 보내고 성공했지만, 노드 B에 보내기 직전 네트워크가 끊겼다면? Coordinator는 재시도해야 할지, 전체를 롤백해야 할지 알 수 없다. 노드 B가 실제로 커밋했지만 ACK만 못 보낸 상황일 수도 있기 때문이다. 이런 모호한 상태를 해결하려면 멱등 재시도와 상태 로그가 필수다.

### ④ 수평 확장의 비용

참여 노드가 늘어날수록 Coordinator가 관리해야 할 연결과 락이 늘어난다. 10개 노드 2PC는 10번의 메시지 교환이지만, 100개 노드면 200번이다. 뿐만 아니라 모든 참여자의 응답을 기다려야 하므로, 가장 느린 노드가 전체 성능을 결정한다(슬로우 레인 문제).

## 실무 대응 전략 1: Outbox 패턴

가장 널리 쓰이는 해법이다. 핵심 아이디어는 비즈니스 데이터와 발행할 이벤트를 **같은 로컬 트랜잭션**에서 기록하는 것이다. 그러면 서비스 로직 자체는 로컬 ACID 트랜잭션으로만 동작하고, 분산 전파는 별도 CDC(Change Data Capture)나 Relay가 담당한다.

![Outbox 패턴 흐름](/assets/posts/distsql-distributed-transaction-limits-patterns.svg)

```sql
-- 주문 서비스 로컬 트랜잭션
BEGIN;

INSERT INTO orders (id, user_id, amount, status)
VALUES ('ord-001', 42, 9900, 'PENDING');

-- 이벤트를 같은 트랜잭션에서 outbox에 기록
INSERT INTO outbox (id, event_type, payload, created_at)
VALUES (
    gen_random_uuid(),
    'ORDER_PLACED',
    '{"order_id":"ord-001","user_id":42,"amount":9900}',
    NOW()
);

COMMIT;
-- 이후 CDC가 outbox 행을 감지해 Kafka 등으로 발행
```

orders와 outbox가 같은 COMMIT에 묶이므로, 둘 중 하나만 성공하는 불일관 상태가 발생하지 않는다. Relay가 실패해도 outbox 레코드가 남아 있으므로 재시도가 가능하다.

## 실무 대응 전략 2: 멱등 키

이벤트 전파와 소비 과정에서 중복 처리는 피할 수 없다. 네트워크 재시도, 컨슈머 재시작 등으로 같은 이벤트가 두 번 소비될 수 있다. **멱등 키(idempotency key)**는 이를 방지한다.

```sql
-- 소비자 측: 처리된 이벤트 ID를 기록
CREATE TABLE processed_events (
    event_id    UUID        PRIMARY KEY,
    processed_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP
);

-- 이벤트 소비 시
INSERT INTO processed_events (event_id)
VALUES (:event_id)
ON CONFLICT (event_id) DO NOTHING;

-- 영향 행이 0이면 이미 처리된 이벤트 → 스킵
-- 1이면 처음 처리 → 비즈니스 로직 실행
```

## 실무 대응 전략 3: 최종 일관성 설계

비즈니스 도메인 자체가 즉각적인 일관성을 요구하지 않는다면, **최종 일관성(eventual consistency)**을 명시적으로 수용하는 것이 가장 현실적인 해법이다. 예를 들어 재고 차감이 주문 직후 몇 초 내에 이뤄지면 비즈니스상 문제없다면, 이 불일치 창을 SLA로 정의하고 모니터링한다.

```sql
-- 중간 상태를 명시적으로 모델링
CREATE TABLE orders (
    id          UUID PRIMARY KEY,
    status      VARCHAR(20) NOT NULL,  -- PENDING, CONFIRMED, FAILED
    confirmed_at TIMESTAMP,
    CHECK (status IN ('PENDING','CONFIRMED','FAILED'))
);

-- PENDING 주문이 일정 시간 후에도 CONFIRMED 안 되면 알림
SELECT id, created_at
FROM orders
WHERE status = 'PENDING'
  AND created_at < NOW() - INTERVAL '5 minutes';
```

## 언제 분산 트랜잭션을 피해야 하는가

실무 지침을 단순하게 정리하면: **"분산 트랜잭션이 필요하다고 느껴지면, 먼저 도메인 경계를 재검토하라."** 두 엔티티가 반드시 같은 트랜잭션에 있어야 한다면, 그 둘은 사실 같은 서비스·같은 DB에 있어야 하는 데이터일 가능성이 높다. 도메인 모델을 재설계해서 로컬 트랜잭션만으로 정합성을 유지하는 구조가 장기적으로 훨씬 안정적이다.

---

**지난 글:** [분산 트랜잭션의 두 축: 2PC와 SAGA 패턴](/posts/distsql-2pc-saga/)

**다음 글:** [CockroachDB — 분산 SQL의 실전 구현](/posts/distsql-cockroachdb/)

<br>
읽어주셔서 감사합니다. 😊
