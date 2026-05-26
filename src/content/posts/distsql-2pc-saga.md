---
title: "분산 트랜잭션의 두 축: 2PC와 SAGA 패턴"
description: "2단계 커밋(2PC)과 SAGA 패턴의 동작 원리, 장단점, 구현 방식을 비교하고 분산 트랜잭션 설계에서 어떤 방식을 선택해야 하는지 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["분산트랜잭션", "2PC", "SAGA", "보상트랜잭션", "마이크로서비스", "분산SQL"]
featured: false
draft: false
---

[지난 글](/posts/distsql-cap-sql-position/)에서 CAP 이론과 분산 SQL 시스템의 설계 트레이드오프를 살펴봤다. 이번에는 한 걸음 더 들어가서, 분산 환경에서 여러 노드에 걸친 트랜잭션을 어떻게 처리하는지를 다룬다. 핵심 주제는 **2PC(Two-Phase Commit)**와 **SAGA** 패턴이다. 두 방식은 일관성 보장 방법이 근본적으로 다르고, 선택 기준도 명확히 다르다.

## 왜 분산 트랜잭션이 어려운가

단일 데이터베이스에서는 트랜잭션이 간단하다. ACID 보장은 DB 엔진이 전담한다. 하지만 주문 서비스와 재고 서비스가 각기 다른 DB를 쓰는 마이크로서비스 환경, 또는 CockroachDB처럼 데이터가 수십 개 노드에 분산된 환경에서는 사정이 달라진다. "주문 삽입"과 "재고 차감"이 서로 다른 노드에 있을 때, 하나는 성공하고 하나는 실패하면 데이터 정합성이 깨진다. 이 문제를 해결하는 전통적인 방법이 2PC, 그리고 이를 대체하는 현대적 패턴이 SAGA다.

## 2PC (Two-Phase Commit)

2PC는 모든 참여자(Participant)가 동시에 커밋하거나 동시에 롤백하도록 강제하는 프로토콜이다. 이름처럼 두 단계로 나뉜다.

![2PC 프로토콜 흐름](/assets/posts/distsql-2pc-saga-flow.svg)

### Phase 1 — Prepare

Coordinator(트랜잭션 관리자)가 모든 Participant에게 `PREPARE` 메시지를 보낸다. 각 Participant는 자신의 작업을 수행하고 WAL(Write-Ahead Log)에 기록한 뒤, 커밋 가능하면 `VOTE YES`, 불가능하면 `VOTE NO`를 응답한다. 이 시점에 각 Participant는 아직 커밋하지 않았지만 리소스(락)는 점유하고 있다.

### Phase 2 — Commit or Rollback

모든 Participant가 `VOTE YES`를 반환했다면 Coordinator가 `COMMIT` 메시지를 보낸다. 하나라도 `VOTE NO`이면 전체에게 `ROLLBACK`을 보낸다.

```sql
-- XA 트랜잭션 (MySQL 기준 2PC)
XA START 'order-tx-001';
INSERT INTO orders (id, user_id, amount) VALUES (1, 42, 9900);
XA END 'order-tx-001';
XA PREPARE 'order-tx-001';    -- Phase 1: 준비 완료, 락 점유

-- 모든 참여자 PREPARE 성공 확인 후
XA COMMIT 'order-tx-001';     -- Phase 2: 실제 커밋
-- 실패 시: XA ROLLBACK 'order-tx-001';
```

### 2PC의 문제점

**블로킹 프로토콜**이 핵심 약점이다. Phase 1과 2 사이에 Coordinator가 다운되면, Participant들은 PREPARE 상태로 락을 쥔 채 Coordinator가 살아날 때까지 기다려야 한다. 이 구간이 **인-더블트 기간(in-doubt period)**이다. 장애가 길어지면 시스템 전체가 멈춘다.

또한 2PC는 동기 통신이므로 지연이 높은 네트워크에서 성능이 크게 저하된다. Spanner는 TrueTime으로 이 문제를 일부 완화하지만, 모든 분산 DB가 그 수준의 시계 정밀도를 갖추진 못한다.

## SAGA 패턴

SAGA는 1987년 Hector Garcia-Molina가 제안했다. 핵심 아이디어는 단순하다. **하나의 큰 트랜잭션을 여러 개의 작은 로컬 트랜잭션으로 분해하고, 실패 시 이미 완료된 단계를 역순으로 취소(보상 트랜잭션)하는 것**이다.

![2PC vs SAGA 비교](/assets/posts/distsql-2pc-saga-comparison.svg)

SAGA는 두 가지 구현 방식이 있다.

### Choreography (코레오그래피)

각 서비스가 이벤트를 발행하고, 다음 서비스가 그 이벤트를 구독해 자신의 작업을 수행한다. 중앙 조율자가 없다. 서비스 수가 적고 흐름이 단순할 때 적합하다.

```sql
-- 주문 서비스: 주문 완료 후 이벤트 발행
INSERT INTO outbox (event_type, payload, status)
VALUES ('ORDER_PLACED', '{"order_id":1,"qty":2}', 'PENDING');

-- 재고 서비스: ORDER_PLACED 이벤트 수신 후 재고 차감
UPDATE inventory SET qty = qty - 2
WHERE product_id = :product_id AND qty >= 2;

-- 재고 부족 시 보상 이벤트 발행
INSERT INTO outbox (event_type, payload, status)
VALUES ('INVENTORY_FAILED', '{"order_id":1}', 'PENDING');
```

### Orchestration (오케스트레이션)

중앙 오케스트레이터(Saga Orchestrator)가 각 단계를 직접 호출하고 성공·실패에 따라 흐름을 제어한다. 흐름이 복잡하거나 단계가 많을 때 추적과 디버깅이 쉽다.

```sql
-- saga_execution 테이블로 상태 추적
CREATE TABLE saga_execution (
    saga_id     UUID PRIMARY KEY,
    step_name   VARCHAR(100),
    status      VARCHAR(20),  -- RUNNING, COMPLETED, COMPENSATING, FAILED
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 보상 트랜잭션: 주문 취소
UPDATE orders SET status = 'CANCELLED' WHERE id = :order_id;
UPDATE inventory SET qty = qty + :restore_qty WHERE product_id = :product_id;
```

## SAGA의 약점: 중간 상태 노출

SAGA는 원자성을 포기한 대가로 **중간 상태**가 외부에 노출된다. 주문은 "결제 완료"인데 재고 차감이 아직 진행 중인 상태를 다른 트랜잭션이 볼 수 있다. 이를 **더티 리드(dirty read)**라고는 부르지 않지만, 비즈니스 입장에서는 불일관성처럼 보일 수 있다. 이 문제를 해결하기 위해 SAGA 스텝마다 상태를 명시적으로 관리하거나, 외부 노출 전 "예약(pending)" 상태를 두는 방식을 사용한다.

## 언제 무엇을 선택할까

**2PC를 선택할 때**: 짧은 트랜잭션, 동기 처리가 필요한 금융/정산 시스템, 네트워크가 안정적인 단일 데이터센터 환경. CockroachDB, Spanner처럼 2PC를 내장한 NewSQL을 사용할 때는 자동으로 2PC가 처리되므로 개발자가 직접 다룰 일이 줄어든다.

**SAGA를 선택할 때**: 마이크로서비스 아키텍처, 서비스간 네트워크 지연이 큰 환경, 장기 실행 트랜잭션(예: 여행 예약처럼 여러 단계가 수 초 이상 소요되는 경우). 최종 일관성(eventual consistency)을 비즈니스 규칙으로 수용할 수 있을 때 선택한다.

실무에서는 두 패턴을 혼합하기도 한다. 단일 서비스 내에서는 2PC(또는 로컬 ACID 트랜잭션), 서비스 경계를 넘는 흐름은 SAGA로 처리하는 방식이다.

---

**지난 글:** [분산 SQL에서 CAP 이론의 위치 — NewSQL은 어디에 있는가](/posts/distsql-cap-sql-position/)

**다음 글:** [분산 트랜잭션의 한계와 실무 대응 전략](/posts/distsql-distributed-transaction-limits/)

<br>
읽어주셔서 감사합니다. 😊
