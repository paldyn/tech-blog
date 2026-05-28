---
title: "Spring RabbitMQ — AMQP 메시지 발행·소비·오류 처리"
description: "spring-amqp와 spring-rabbit을 사용해 RabbitMQ 메시지를 발행하고 소비하는 방법을 설명합니다. Exchange·Queue·Binding 선언, RabbitTemplate 발행, @RabbitListener 소비, Dead Letter Queue, Retry 전략까지 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "RabbitMQ", "AMQP", "spring-amqp", "@RabbitListener", "Dead Letter Queue", "메시지큐"]
featured: false
draft: false
---

[지난 글](/posts/spring-kafka-basics/)에서는 Apache Kafka와 `spring-kafka`를 통해 높은 처리량의 이벤트 스트리밍을 다뤘습니다. 이번에는 유연한 **라우팅**과 **신뢰성 있는 메시지 전달**에 강점이 있는 RabbitMQ와 AMQP 프로토콜을 Spring에서 사용하는 방법을 살펴보겠습니다.

## AMQP vs Kafka — 언제 RabbitMQ를 선택하나?

Kafka는 순서 보장과 리플레이가 필요한 이벤트 스트리밍에 강합니다. 반면 RabbitMQ(AMQP)는 메시지를 **즉시 라우팅·소비하고 ACK 후 삭제**하는 패턴에 적합합니다. 마이크로서비스 간 RPC·Command·Notification 패턴, TTL이 있는 메시지, 복잡한 라우팅 규칙이 필요한 경우 RabbitMQ가 더 나은 선택입니다.

## 의존성 추가

```xml
<!-- pom.xml -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

`spring-boot-starter-amqp`는 `spring-amqp`, `spring-rabbit`, 자동 구성을 모두 포함합니다.

## RabbitMQ 핵심 개념

![RabbitMQ 메시지 흐름 아키텍처](/assets/posts/spring-rabbitmq-amqp-architecture.svg)

RabbitMQ의 메시지 흐름은 **Producer → Exchange → Queue → Consumer** 4단계입니다.

| 개념 | 역할 |
|---|---|
| Exchange | 메시지를 받아 Binding 규칙으로 Queue에 라우팅 |
| Binding | Exchange와 Queue를 연결하는 규칙 (routingKey 포함) |
| Queue | 메시지를 소비될 때까지 보관 |
| routingKey | Exchange가 Queue를 선택할 때 사용하는 문자열 |

### Exchange 타입

- **direct** — routingKey가 정확히 일치하는 Queue로 전달
- **topic** — 와일드카드(`*`, `#`) 패턴으로 여러 Queue에 라우팅
- **fanout** — routingKey 무시, 바인딩된 모든 Queue에 브로드캐스트
- **headers** — 메시지 헤더 기반 라우팅

## application.yml 설정

```yaml
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    listener:
      simple:
        acknowledge-mode: manual   # ACK 수동 처리
        retry:
          enabled: true
          max-attempts: 3
          initial-interval: 1000ms
          multiplier: 2.0
```

## Queue · Exchange · Binding Bean 선언

```java
@Configuration
public class RabbitConfig {

    public static final String QUEUE    = "order.queue";
    public static final String EXCHANGE = "orders";
    public static final String KEY      = "order.#";

    @Bean
    Queue orderQueue() {
        return QueueBuilder.durable(QUEUE)
            .withArgument("x-dead-letter-exchange", "orders.dlx")
            .build();
    }

    @Bean
    TopicExchange ordersExchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    Binding binding(Queue orderQueue, TopicExchange ordersExchange) {
        return BindingBuilder
            .bind(orderQueue)
            .to(ordersExchange)
            .with(KEY);
    }

    // Dead Letter 설정
    @Bean Queue dlq()      { return QueueBuilder.durable("order.dlq").build(); }
    @Bean DirectExchange dlx() { return new DirectExchange("orders.dlx"); }
    @Bean Binding dlqBinding() {
        return BindingBuilder.bind(dlq()).to(dlx()).with(QUEUE);
    }
}
```

`x-dead-letter-exchange` 인수를 Queue에 설정해 두면, nack되거나 TTL이 만료된 메시지가 자동으로 DLX로 이동합니다.

## 메시지 발행 — RabbitTemplate

![spring-amqp 핵심 코드 패턴](/assets/posts/spring-rabbitmq-amqp-code.svg)

```java
@Service
@RequiredArgsConstructor
public class OrderEventProducer {

    private final RabbitTemplate rabbitTemplate;

    public void publishOrderCreated(OrderEvent event) {
        rabbitTemplate.convertAndSend(
            RabbitConfig.EXCHANGE,
            "order.created",   // routingKey
            event
        );
    }

    public void publishWithDelay(OrderEvent event, long delayMs) {
        rabbitTemplate.convertAndSend(
            RabbitConfig.EXCHANGE, "order.created", event,
            msg -> {
                msg.getMessageProperties().setDelay((int) delayMs);
                return msg;
            }
        );
    }
}
```

`MessagePostProcessor`를 통해 메시지별 헤더 조작이 가능합니다. 지연 발행은 `rabbitmq-delayed-message-exchange` 플러그인이 필요합니다.

## 메시지 소비 — @RabbitListener

```java
@Component
@RequiredArgsConstructor
public class OrderConsumer {

    private final OrderService orderService;

    @RabbitListener(queues = RabbitConfig.QUEUE)
    public void handle(
            OrderEvent event,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long tag) throws IOException {
        try {
            orderService.processOrder(event);
            channel.basicAck(tag, false);          // 처리 완료
        } catch (RecoverableException e) {
            channel.basicNack(tag, false, true);   // 재큐 (requeue=true)
        } catch (Exception e) {
            channel.basicNack(tag, false, false);  // DLQ로 이동 (requeue=false)
        }
    }
}
```

`acknowledge-mode: manual`로 설정하면 `channel.basicAck()` 또는 `basicNack()`을 직접 호출해야 합니다. 처리에 성공하면 `basicAck`, 재시도 가능한 오류는 `basicNack(requeue=true)`, 영구 오류는 `basicNack(requeue=false)`로 DLQ에 보냅니다.

### @RabbitListener 고급 옵션

```java
// 여러 Queue 동시 리스닝
@RabbitListener(queues = {"queue.a", "queue.b"})

// concurrency (스레드 수)
@RabbitListener(queues = "order.queue", concurrency = "3-10")

// 선언과 동시에 Binding
@RabbitListener(bindings = @QueueBinding(
    value    = @Queue("order.queue"),
    exchange = @Exchange(value="orders", type="topic"),
    key      = "order.#"
))
```

## Dead Letter Queue 처리

```java
@RabbitListener(queues = "order.dlq")
public void handleDlq(
        OrderEvent event,
        @Header(AmqpHeaders.DELIVERY_TAG) long tag,
        Channel channel) throws IOException {

    log.error("DLQ 수신: {}", event);
    // 슬랙 알림, 별도 DB 기록 등
    channel.basicAck(tag, false);   // DLQ에서도 ACK 필수
}
```

DLQ 소비자는 실패한 메시지를 로깅·알림 처리하거나, 일정 시간 후 원래 Queue에 재발행하는 **리드라이브(re-drive)** 전략을 사용합니다.

## Jackson 메시지 변환기 설정

```java
@Bean
Jackson2JsonMessageConverter messageConverter() {
    return new Jackson2JsonMessageConverter();
}

@Bean
RabbitTemplate rabbitTemplate(ConnectionFactory cf,
                               Jackson2JsonMessageConverter conv) {
    RabbitTemplate tpl = new RabbitTemplate(cf);
    tpl.setMessageConverter(conv);
    return tpl;
}
```

기본 변환기는 Java 직렬화를 사용합니다. `Jackson2JsonMessageConverter`로 교체하면 JSON으로 주고받을 수 있어 다른 언어의 소비자와도 호환됩니다.

## 테스트 — Testcontainers

```java
@SpringBootTest
@Testcontainers
class OrderConsumerTest {

    @Container
    static RabbitMQContainer rabbit =
        new RabbitMQContainer("rabbitmq:3.12-management");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.rabbitmq.host", rabbit::getHost);
        r.add("spring.rabbitmq.port", rabbit::getAmqpPort);
    }

    @Autowired RabbitTemplate template;

    @Test
    void orderCreatedEventIsProcessed() throws Exception {
        template.convertAndSend(EXCHANGE, "order.created",
                                new OrderEvent(1L, "CREATED"));
        await().atMost(5, SECONDS)
               .untilAsserted(() -> verify(orderService).processOrder(any()));
    }
}
```

## 주요 모니터링 포인트

| 지표 | 의미 | 기준값 |
|---|---|---|
| Queue depth | 처리되지 않은 메시지 수 | 지속 증가 → 소비자 스케일아웃 |
| Consumer count | 큐당 활성 소비자 수 | 0이면 알림 |
| nack rate | 처리 실패 비율 | 급증 → DLQ 확인 |
| Publish rate | 초당 발행 수 | 소비 속도와 비교 |

RabbitMQ Management UI(`http://localhost:15672`)에서 실시간 확인이 가능하며, Spring Actuator에 micrometer-registry-prometheus를 추가하면 `rabbitmq.*` 메트릭을 Prometheus/Grafana로 수집할 수 있습니다.

---

**지난 글:** [Spring Kafka 기초 — KafkaTemplate 발행과 @KafkaListener 소비](/posts/spring-kafka-basics/)

**다음 글:** [이벤트 기반 아키텍처 — Spring으로 구현하는 EDA 패턴](/posts/spring-event-driven-architecture/)

<br>
읽어주셔서 감사합니다. 😊
