---
title: "Advanced Queuing (AQ)"
description: "Oracle Advanced Queuing의 구조, 트랜잭션 보장 메커니즘, Pub/Sub 패턴, ENQUEUE/DEQUEUE API, 그리고 실무에서 AQ를 선택하는 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["oracle", "advanced-queuing", "aq", "message-queue", "pub-sub", "dbms-aq", "dbms-aqadm", "transactional-messaging", "jms"]
featured: false
draft: false
---

[지난 글](/posts/oracle-database-link/)에서 DB Link로 원격 데이터베이스에 투명하게 접근하는 방법을 다뤘다. 이번에는 Oracle DB 안에 내장된 메시지 큐 시스템인 **Advanced Queuing(AQ)**을 살펴본다.

## AQ가 필요한 이유

주문 처리 시스템에서 주문 INSERT와 재고 차감, 알림 발송이 한 트랜잭션에 묶여 있다고 가정하자. 알림 발송 서비스가 일시적으로 다운되면 트랜잭션 전체가 실패한다. 이 결합도를 낮추는 전통적인 해결책은 외부 메시지 큐(Kafka, RabbitMQ 등)다.

그런데 외부 MQ를 쓰면 "DB에 Insert는 됐는데 MQ에 메시지가 안 들어간" 상황이 생길 수 있다. DB 트랜잭션과 MQ 작업이 원자적으로 묶이지 않기 때문이다. **AQ는 메시지 큐가 Oracle 테이블 위에 구현되기 때문에 트랜잭션이 완전히 일치한다.** 롤백하면 메시지도 롤백된다.

![Oracle Advanced Queuing 아키텍처](/assets/posts/oracle-advanced-queueing-arch.svg)

## 큐 생성

AQ는 두 객체로 이루어진다. **Queue Table**은 실제 메시지를 저장하는 Oracle 테이블이고, **Queue**는 그 테이블 위에 논리적으로 정의된 채널이다.

```sql
BEGIN
  -- 1. Queue Table 생성 (페이로드 타입: RAW or 객체 타입)
  DBMS_AQADM.CREATE_QUEUE_TABLE(
    queue_table        => 'order_qtab',
    queue_payload_type => 'RAW',
    sort_list          => 'PRIORITY,ENQ_TIME',  -- 우선순위 → 시간 순
    multiple_consumers => FALSE                  -- 단일 소비자
  );

  -- 2. Queue 생성
  DBMS_AQADM.CREATE_QUEUE(
    queue_name      => 'order_queue',
    queue_table     => 'order_qtab',
    max_retries     => 3,               -- 최대 재시도 횟수
    retry_delay     => 60,              -- 재시도 간격(초)
    retention_time  => 86400            -- 처리 후 보존 시간(초)
  );

  -- 3. 큐 시작
  DBMS_AQADM.START_QUEUE(
    queue_name => 'order_queue'
  );
END;
/
```

`sort_list => 'PRIORITY,ENQ_TIME'`을 지정하면 우선순위가 높은(숫자 낮은) 메시지를 먼저 꺼내고, 같은 우선순위면 먼저 들어온 메시지를 먼저 꺼낸다.

![AQ 메시지 라이프사이클 & 코드](/assets/posts/oracle-advanced-queueing-lifecycle.svg)

## ENQUEUE — 메시지 삽입

```sql
DECLARE
  v_enq_opt  DBMS_AQ.ENQUEUE_OPTIONS_T;
  v_msg_prop DBMS_AQ.MESSAGE_PROPERTIES_T;
  v_msg_id   RAW(16);
  v_payload  RAW(4000);
BEGIN
  -- 페이로드: JSON 문자열을 RAW로 변환
  v_payload := UTL_RAW.CAST_TO_RAW(
    '{"order_id":1001,"cust_id":555,"amount":99000}'
  );

  -- 메시지 속성 설정
  v_msg_prop.priority   := 1;          -- 높은 우선순위
  v_msg_prop.delay      := 0;          -- 즉시 READY
  v_msg_prop.expiration := 3600;       -- 1시간 내 처리 안 되면 만료

  DBMS_AQ.ENQUEUE(
    queue_name         => 'order_queue',
    enqueue_options    => v_enq_opt,
    message_properties => v_msg_prop,
    payload            => v_payload,
    msgid              => v_msg_id
  );

  COMMIT;  -- 커밋해야 메시지가 READY 상태로 전환
END;
/
```

`delay`를 설정하면 지정한 초 수가 지나야 메시지가 READY 상태로 전환된다. 예를 들어 "5분 후에 리마인드 알림 발송" 같은 지연 전달 시나리오에 유용하다.

## DEQUEUE — 메시지 소비

```sql
DECLARE
  v_deq_opt  DBMS_AQ.DEQUEUE_OPTIONS_T;
  v_msg_prop DBMS_AQ.MESSAGE_PROPERTIES_T;
  v_msg_id   RAW(16);
  v_payload  RAW(4000);
BEGIN
  -- 대기 시간 설정 (FOREVER = 무한 대기)
  v_deq_opt.wait := DBMS_AQ.FOREVER;

  DBMS_AQ.DEQUEUE(
    queue_name         => 'order_queue',
    dequeue_options    => v_deq_opt,
    message_properties => v_msg_prop,
    payload            => v_payload,
    msgid              => v_msg_id
  );

  -- 페이로드 처리
  DBMS_OUTPUT.PUT_LINE(
    UTL_RAW.CAST_TO_VARCHAR2(v_payload)
  );

  COMMIT;  -- 커밋해야 메시지가 PROCESSED로 전환
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;  -- 롤백 → 메시지 READY로 돌아감 (재처리)
END;
/
```

DEQUEUE 후 ROLLBACK하면 메시지가 다시 READY 상태로 돌아간다. `max_retries`를 초과하면 Exception Queue로 이동한다.

## Pub/Sub 패턴

여러 소비자가 동일 메시지를 받아야 한다면 `multiple_consumers => TRUE`로 Queue Table을 만들고 구독자를 등록한다.

```sql
BEGIN
  DBMS_AQADM.CREATE_QUEUE_TABLE(
    queue_table        => 'event_qtab',
    queue_payload_type => 'RAW',
    multiple_consumers => TRUE   -- 복수 구독자
  );

  DBMS_AQADM.CREATE_QUEUE(
    queue_name  => 'event_queue',
    queue_table => 'event_qtab'
  );

  DBMS_AQADM.START_QUEUE('event_queue');

  -- 구독자 등록
  DBMS_AQADM.ADD_SUBSCRIBER(
    queue_name => 'event_queue',
    subscriber => SYS.AQ$_AGENT('inventory_svc', NULL, NULL)
  );
  DBMS_AQADM.ADD_SUBSCRIBER(
    queue_name => 'event_queue',
    subscriber => SYS.AQ$_AGENT('notify_svc', NULL, NULL)
  );
END;
/
```

이후 각 구독자가 자신의 이름으로 DEQUEUE하면 독립적으로 메시지를 받는다. 한 구독자가 처리했다고 다른 구독자의 메시지가 삭제되지 않는다.

## AQ vs 외부 MQ 비교

| 항목 | Oracle AQ | 외부 MQ (Kafka 등) |
|---|---|---|
| 트랜잭션 통합 | DB 트랜잭션과 동일 | 별도 설계 필요 (2PC 또는 Outbox) |
| 운영 복잡도 | DB 관리로 통합 | 별도 클러스터 운영 |
| 처리량 | 수천 TPS 수준 | 수백만 TPS 가능 |
| 영속성 | Oracle 테이블 (REDO/UNDO 보호) | 브로커 파티션 |
| JMS 지원 | 있음 (Oracle JMS) | 있음 (별도 라이브러리) |
| 적합 시나리오 | DB 중심 워크플로우, 낮은 볼륨 | 고처리량, 마이크로서비스 |

## 실무 팁

**Exception Queue 모니터링**: 처리 실패 메시지는 Exception Queue에 쌓인다. 주기적으로 확인해 수동 재처리하거나 알림을 발송해야 한다.

```sql
SELECT qt.msgid,
       qt.msg_state,
       qt.enq_time,
       UTL_RAW.CAST_TO_VARCHAR2(qt.user_data) AS payload
FROM   aq$order_qtab qt
WHERE  qt.msg_state = 'EXPIRED';
```

**DBMS_AQ.LISTEN**: 여러 큐를 동시에 모니터링하다가 메시지가 들어오면 깨어나는 방식으로 폴링 없이 이벤트 기반 처리가 가능하다.

## 정리

- AQ = Oracle 테이블 기반 메시지 큐, 트랜잭션과 완전 통합
- ENQUEUE/DEQUEUE가 같은 트랜잭션 안에 있으면 원자성 보장
- `delay`로 지연 전달, `expiration`으로 메시지 유효기간 설정
- `multiple_consumers = TRUE`로 Pub/Sub 구현
- 고처리량보다 **트랜잭션 안전성**이 중요한 시나리오에 최적

---

**지난 글:** [Database Link](/posts/oracle-database-link/)

**다음 글:** [Oracle RAC 개요](/posts/oracle-rac-overview/)

<br>
읽어주셔서 감사합니다. 😊
