---
title: "Spring Boot 트랜잭션 베스트 프랙티스 — @Transactional 실전 가이드"
description: "Spring Boot에서 @Transactional을 올바르게 사용하는 방법을 다룹니다. readOnly 기본값 전략, 자기 호출 문제, Checked Exception 롤백 규칙, 트랜잭션 안에서의 외부 I/O 금지 등 실전에서 흔히 마주치는 함정과 해법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["SpringBoot", "Transactional", "Transaction", "BestPractice", "JPA", "Spring"]
featured: false
draft: false
---

[지난 글](/posts/springboot-query-logging/)에서 쿼리 로깅으로 실행 SQL을 추적하는 방법을 살펴봤습니다. 쿼리가 의도대로 실행되더라도, 트랜잭션 경계를 잘못 설정하면 데이터 정합성이 깨집니다. `@Transactional`은 쉬워 보이지만 프록시 기반 AOP 특성 때문에 생각지 못한 함정이 여럿 있습니다. 이 글에서는 실제 장애로 이어진 세 가지 함정과 그 해법, 그리고 팀에서 바로 적용할 수 있는 베스트 프랙티스를 정리합니다.

## @Transactional 동작 원리 복습

`@Transactional`은 스프링 AOP 프록시로 동작합니다. 빈을 주입받을 때 실제 객체 대신 프록시 객체가 주입되고, 프록시가 트랜잭션 시작·커밋·롤백을 처리합니다.

```java
// 호출 흐름 (단순화)
// proxy.save() → 트랜잭션 시작 → target.save() → 커밋/롤백
OrderService proxy = applicationContext.getBean(OrderService.class);
proxy.save(request);   // proxy 경유 → 트랜잭션 적용됨
```

이 구조에서 세 가지 함정이 발생합니다.

## 함정 1 — 자기 호출 (Self-invocation)

같은 클래스의 메서드를 `this.inner()`로 호출하면 프록시를 우회합니다. `@Transactional`이 붙어 있어도 트랜잭션이 시작되지 않습니다.

```java
@Service
public class OrderService {

    // outer()는 @Transactional 없음
    public void processOrder(Long orderId) {
        // 자기 호출: this.placeInShipping() → 프록시 미경유
        placeInShipping(orderId);    // ← 트랜잭션 적용 안 됨!
    }

    @Transactional
    public void placeInShipping(Long orderId) {
        // DB 변경 작업
    }
}
```

### 해법: 별도 Bean 분리

```java
@Service
public class OrderService {

    private final ShippingService shippingService;

    public void processOrder(Long orderId) {
        // 다른 빈을 통해 호출 → 프록시 경유 → @Transactional 적용
        shippingService.placeInShipping(orderId);
    }
}

@Service
public class ShippingService {

    @Transactional
    public void placeInShipping(Long orderId) {
        // 정상적으로 트랜잭션 적용
    }
}
```

또는 같은 클래스 내에 유지해야 한다면 `ApplicationContext`에서 빈을 꺼내 호출하거나, `@Lazy` 자기 주입 패턴을 씁니다. 하지만 코드 냄새가 강하므로 Bean 분리를 권장합니다.

## 함정 2 — Checked Exception 롤백 누락

`@Transactional`의 기본 롤백 규칙은 **`RuntimeException`과 `Error`만** 롤백입니다. `IOException`·`SQLException` 같은 Checked Exception은 기본적으로 커밋됩니다.

```java
@Transactional
public void saveFile(MultipartFile file) throws IOException {
    Order order = orderRepository.save(Order.create());
    fileStorage.upload(file);    // IOException 발생
    // IOException은 Checked → @Transactional 기본값으로는 커밋!
    // order는 DB에 저장된 채로 남음 → 데이터 정합성 깨짐
}
```

### 해법: rollbackFor 명시 또는 예외 변환

```java
// 방법 1: rollbackFor로 명시적 지정
@Transactional(rollbackFor = Exception.class)
public void saveFile(MultipartFile file) throws IOException {
    // 이제 IOException도 롤백됨
}

// 방법 2: Checked → Unchecked 변환
@Transactional
public void saveFile(MultipartFile file) {
    try {
        Order order = orderRepository.save(Order.create());
        fileStorage.upload(file);
    } catch (IOException e) {
        throw new FileUploadException("파일 업로드 실패", e);
        // FileUploadException extends RuntimeException → 롤백됨
    }
}
```

팀 표준으로 **모든 `@Transactional`에 `rollbackFor = Exception.class`를 붙이는 규칙**을 정하면 실수를 원천 차단할 수 있습니다.

## 함정 3 — readOnly=true 오해

`readOnly = true`는 DB에 쓰기를 막는 게 아닙니다. Hibernate에 flush를 하지 않아도 된다는 **힌트**를 줄 뿐입니다. 실수로 엔티티를 수정해도 DB에 반영됩니다.

```java
@Transactional(readOnly = true)
public List<User> findAllUsers() {
    List<User> users = userRepository.findAll();
    users.forEach(u -> u.setName("수정"));   // 실수!
    // flush 최적화가 비활성화되지만, flush가 일어나면 반영됨
    return users;
}
```

### 해법: DTO 반환

```java
@Transactional(readOnly = true)
public List<UserResponse> findAllUsers() {
    return userRepository.findAll()
        .stream()
        .map(UserResponse::from)   // Entity → DTO 변환
        .collect(toList());
    // DTO는 영속성 컨텍스트 밖 → dirty checking 대상 아님
}
```

`readOnly = true`의 실질적 이점은 두 가지입니다.

- Hibernate가 dirty checking 스냅샷을 생성하지 않아 메모리 절약
- `AbstractRoutingDataSource` 패턴에서 Replica DB로 자동 라우팅 (이전 글 참고)

## 베스트 프랙티스 — readOnly 기본값 전략

![Service 레이어 readOnly 기본값 전략](/assets/posts/springboot-transaction-best-practice-pattern.svg)

클래스 레벨에 `@Transactional(readOnly = true)`를 붙이고, 쓰기 메서드에만 `@Transactional`을 오버라이드합니다.

```java
@Service
@Transactional(readOnly = true)   // ← 클래스 기본값: 읽기
public class OrderService {

    private final OrderRepository orderRepository;

    // 조회: 클래스 기본값 readOnly 상속
    public List<Order> findAll() {
        return orderRepository.findAll();
    }

    public Order findById(Long id) {
        return orderRepository.findById(id)
            .orElseThrow(OrderNotFoundException::new);
    }

    // 쓰기: 메서드 수준에서 readOnly=false로 오버라이드
    @Transactional
    public Order create(OrderRequest request) {
        return orderRepository.save(Order.from(request));
    }

    @Transactional(rollbackFor = Exception.class)
    public void cancelOrder(Long id) throws OrderCancelException {
        Order order = findById(id);
        order.cancel();   // 상태 변경
    }
}
```

조회 메서드가 압도적으로 많은 서비스 클래스에서 매 메서드마다 `readOnly = true`를 붙이는 것보다 훨씬 간결합니다.

## 트랜잭션 안에서 외부 I/O 금지

```java
// ❌ 위험 패턴
@Transactional
public Order createOrder(OrderRequest request) {
    Order order = orderRepository.save(Order.from(request));

    // 외부 API 호출 (평균 200ms) — DB 커넥션 점유 중!
    paymentClient.charge(order.getId(), request.getAmount());

    return order;
}
```

트랜잭션이 열려 있는 동안 DB 커넥션이 풀에서 빠져나와 있습니다. 외부 API가 느리거나 타임아웃이 나면 커넥션 풀이 고갈되어 전체 서비스 장애로 이어집니다.

```java
// ✓ 올바른 패턴: 트랜잭션 밖에서 외부 I/O
public Order createOrder(OrderRequest request) {
    // 1. 트랜잭션 내 DB 작업만
    Order order = orderWriter.saveOrder(request);

    // 2. 트랜잭션 종료 후 외부 API 호출
    paymentClient.charge(order.getId(), request.getAmount());

    return order;
}

@Service
public class OrderWriter {
    @Transactional
    public Order saveOrder(OrderRequest request) {
        return orderRepository.save(Order.from(request));
    }
}
```

## @Transactional과 @Async 조합 주의

```java
@Transactional
@Async
public CompletableFuture<Void> asyncUpdate(Long id) {
    // 별도 스레드에서 실행 → 별도 트랜잭션
    // 호출자 트랜잭션과 무관한 새 트랜잭션 시작
}
```

`@Async`는 별도 스레드에서 실행되므로 호출자의 트랜잭션을 공유하지 않습니다. 의도적이라면 문제없지만, 실수로 호출자 트랜잭션의 변경사항을 기대하면 기대와 다르게 동작합니다.

## 정리 체크리스트

![@Transactional 3대 함정과 해법](/assets/posts/springboot-transaction-best-practice-pitfalls.svg)

실전에서 바로 적용할 체크리스트입니다.

| 항목 | 규칙 |
|------|------|
| 트랜잭션 경계 | Service 레이어에서만 열기 |
| 기본값 전략 | 클래스: `readOnly=true`, 쓰기 메서드: `@Transactional` 오버라이드 |
| Checked Exception | `rollbackFor = Exception.class` 명시 또는 RuntimeException 변환 |
| 자기 호출 | 별도 Bean 분리 |
| 외부 I/O | 트랜잭션 종료 후 호출 |
| 조회 결과 반환 | DTO 반환으로 dirty checking 방지 |

`@Transactional`은 선언적으로 사용하기 쉬운 만큼 프록시 메커니즘을 이해하지 못한 채 쓰면 조용한 버그를 만듭니다. 위 체크리스트를 코드 리뷰 기준으로 사용하면 팀 전체가 일관된 트랜잭션 전략을 유지할 수 있습니다.

---

**지난 글:** [Spring Boot 쿼리 로깅 — SQL·파라미터·성능 측정](/posts/springboot-query-logging/)

**다음 글:** [REST API 설계 원칙 — URI·메서드·표현의 일관성](/posts/spring-rest-principles/)

<br>
읽어주셔서 감사합니다. 😊
