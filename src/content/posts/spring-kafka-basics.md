---
title: "Spring Kafka 기초 — KafkaTemplate 발행과 @KafkaListener 소비"
description: "spring-kafka를 사용해 Apache Kafka 메시지를 발행하고 소비하는 방법을 설명합니다. KafkaTemplate 설정, @KafkaListener 리스너 구성, 수동/자동 오프셋 커밋, 오류 처리와 Dead Letter Topic까지 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "Kafka", "KafkaTemplate", "@KafkaListener", "메시지큐", "Spring Boot", "Dead Letter Topic"]
featured: false
draft: false
---

[지난 글](/posts/spring-transactional-event-listener/)에서는 트랜잭션 완료 시점과 이벤트 처리를 연동하는 `@TransactionalEventListener`를 살펴봤습니다. 이번에는 프로세스 경계를 넘어 서로 다른 서비스 간에 메시지를 주고받는 **Apache Kafka**와 Spring의 통합 라이브러리인 `spring-kafka`를 다룹니다.

## Kafka가 필요한 이유

`ApplicationEvent`와 `@EventListener`는 같은 JVM 안에서만 동작합니다. 서로 다른 마이크로서비스가 느슨하게 결합되어야 하는 경우, 또는 이벤트를 지속적으로 저장하고 재처리해야 하는 경우에는 외부 메시지 브로커가 필요합니다. Kafka는 다음과 같은 특성으로 이 역할을 수행합니다.

- **내구성**: 메시지가 디스크에 기록되어 설정된 보존 기간 동안 유지됨
- **재생 가능성**: 오프셋을 되감아 과거 메시지를 다시 처리할 수 있음
- **고처리량**: 파티션 기반 병렬 처리로 수백만 TPS 달성 가능
- **비동기 분리**: 발행자와 소비자의 처리 속도가 달라도 됨

![Spring Kafka 기본 아키텍처](/assets/posts/spring-kafka-basics-architecture.svg)

## 의존성 추가

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>
```

Spring Boot Starter가 아닌 `spring-kafka`를 직접 추가합니다. Spring Boot 자동 구성이 `KafkaAutoConfiguration`을 통해 대부분의 빈을 자동 등록합니다.

## application.yml 기본 설정

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      acks: all          # 모든 레플리카 확인 후 응답 (강한 내구성)
      retries: 3
    consumer:
      group-id: order-svc
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      auto-offset-reset: earliest   # 새 그룹은 처음부터
      enable-auto-commit: false     # 수동 커밋 사용
    listener:
      ack-mode: manual_immediate
      type: single                  # 메시지 1개씩 처리 (batch도 가능)
    properties:
      spring.json.trusted.packages: "com.example.events"
```

`enable-auto-commit: false` + `ack-mode: manual_immediate` 조합으로 수동 커밋을 사용하면 처리 성공 후에만 오프셋이 커밋되어 메시지 유실을 방지할 수 있습니다.

## KafkaTemplate으로 메시지 발행

`KafkaTemplate`은 Spring이 자동 등록하는 발행자 빈입니다. 제네릭 타입은 `<키, 값>` 형태입니다.

```java
@Service
@RequiredArgsConstructor
public class OrderProducer {

    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;

    public void publish(OrderEvent event) {
        // 토픽명, 키(파티션 분배 기준), 메시지 값
        kafkaTemplate.send("orders", event.orderId().toString(), event)
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Kafka 발행 실패: topic=orders, key={}", event.orderId(), ex);
                } else {
                    log.debug("Kafka 발행 성공: partition={}, offset={}",
                            result.getRecordMetadata().partition(),
                            result.getRecordMetadata().offset());
                }
            });
    }
}
```

`send()` 메서드는 `CompletableFuture<SendResult<K, V>>`를 반환합니다. `.whenComplete()`으로 발행 결과를 비동기로 확인할 수 있습니다. 키를 `orderId`로 지정하면 같은 주문 ID의 메시지는 항상 같은 파티션으로 라우팅되어 순서가 보장됩니다.

## @KafkaListener로 메시지 소비

```java
@Component
@RequiredArgsConstructor
public class OrderConsumer {

    private final OrderService orderService;

    @KafkaListener(
        topics = "orders",
        groupId = "order-svc",
        concurrency = "3"   // 파티션 수만큼 동시 처리
    )
    public void consume(OrderEvent event, Acknowledgment ack) {
        try {
            orderService.process(event);
            ack.acknowledge(); // 처리 성공 후 오프셋 커밋
        } catch (Exception e) {
            log.error("메시지 처리 실패: {}", event.orderId(), e);
            throw e; // 재시도 or DLT 이동
        }
    }
}
```

`concurrency = "3"`은 3개의 컨슈머 스레드를 생성합니다. 파티션 수보다 많은 컨슈머를 설정하면 여분의 컨슈머는 대기 상태가 되므로, **컨슈머 수는 파티션 수 이하**로 설정하는 게 원칙입니다.

![Spring Kafka Producer & Consumer 코드](/assets/posts/spring-kafka-basics-code.svg)

## 토픽 자동 생성

```java
@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic ordersTopic() {
        return TopicBuilder.name("orders")
                .partitions(3)
                .replicas(1)    // 개발 환경: 1, 프로덕션: 3 이상
                .build();
    }

    @Bean
    public NewTopic ordersDeadLetterTopic() {
        return TopicBuilder.name("orders.DLT").partitions(1).replicas(1).build();
    }
}
```

`KafkaAdmin` 빈이 자동 등록되면 애플리케이션 시작 시 토픽이 없으면 자동 생성합니다.

## 오류 처리와 Dead Letter Topic (DLT)

메시지 처리 중 예외가 발생하면 재시도하고, 재시도 한도 초과 시 Dead Letter Topic으로 이동하는 패턴이 일반적입니다.

```java
@Bean
public DefaultErrorHandler errorHandler(
        KafkaTemplate<String, Object> template) {
    // 최대 3회 재시도, 지수 백오프: 1s → 2s → 4s
    var backoff = new ExponentialBackOffWithMaxRetries(3);
    backoff.setInitialInterval(1_000);
    backoff.setMultiplier(2.0);

    var dlt = new DeadLetterPublishingRecoverer(template);
    return new DefaultErrorHandler(dlt, backoff);
}
```

`DeadLetterPublishingRecoverer`는 재시도 소진 후 `{원본토픽}.DLT` 토픽으로 자동 이동시킵니다. 실패 원인은 메시지 헤더에 기록됩니다.

## Consumer Factory와 Deserializer 신뢰 설정

JSON 역직렬화에는 `JsonDeserializer`를 사용하는데, 악의적인 클래스 역직렬화를 방지하기 위해 신뢰할 패키지를 명시해야 합니다.

```java
@Bean
public ConsumerFactory<String, OrderEvent> consumerFactory() {
    var props = new HashMap<String, Object>();
    props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
    props.put(ConsumerConfig.GROUP_ID_CONFIG, "order-svc");
    props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
    props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);

    var deserializer = new JsonDeserializer<>(OrderEvent.class);
    deserializer.addTrustedPackages("com.example.events");

    return new DefaultKafkaConsumerFactory<>(
            props, new StringDeserializer(), deserializer);
}
```

application.yml의 `spring.json.trusted.packages` 속성을 사용하면 코드 없이도 신뢰 패키지를 설정할 수 있습니다.

## 트랜잭션 연동 — Exactly-Once

Kafka 트랜잭션과 DB 트랜잭션을 연동하면 exactly-once 처리가 가능하지만 설정이 복잡합니다. 일반적인 패턴은 **Outbox Pattern**으로, DB 트랜잭션 안에 Outbox 테이블에 메시지를 기록하고 별도 폴러(Debezium CDC 등)가 Kafka로 발행합니다.

```java
@Transactional
public Order createOrder(OrderRequest req) {
    Order order = orderRepo.save(req.toEntity());
    // DB와 같은 트랜잭션에 기록
    outboxRepo.save(OutboxMessage.of("orders", new OrderCreatedEvent(order.getId())));
    return order;
}
```

## 로컬 개발 환경

```yaml
# docker-compose.yml 스니펫
services:
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    ports: ["9092:9092"]
    environment:
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_NODE_ID: 1
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      CLUSTER_ID: MkU3OEVBNTcwNTJENDM2Qk
```

KRaft 모드(ZooKeeper 없음)로 Kafka 단일 노드를 실행하는 가장 간단한 설정입니다.

## 핵심 설정 체크리스트

- `enable-auto-commit: false` + `ack-mode: manual_immediate` → 수동 커밋으로 유실 방지
- `acks: all` → 강한 내구성 보장 (성능 트레이드오프)
- `concurrency` ≤ 파티션 수 → 유휴 컨슈머 방지
- 키 기반 파티셔닝 → 같은 엔티티의 순서 보장 필요 시
- `DefaultErrorHandler` + `DeadLetterPublishingRecoverer` → 실패 메시지 보존

---

**지난 글:** [@TransactionalEventListener — 트랜잭션 완료 후 이벤트 처리](/posts/spring-transactional-event-listener/)

<br>
읽어주셔서 감사합니다. 😊
