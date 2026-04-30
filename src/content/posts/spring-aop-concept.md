---
title: "Spring AOP 개념: 횡단 관심사를 분리하는 방법"
description: "AOP(Aspect-Oriented Programming)가 해결하는 문제와 Spring이 프록시 기반으로 구현하는 방식을 설명합니다. 로깅·보안·트랜잭션 같은 횡단 관심사가 왜 OOP만으로 분리되지 않는지, AOP가 어떻게 이 한계를 극복하는지 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "AOP", "Proxy", "CrossCuttingConcern", "Aspect"]
featured: false
draft: false
---

[지난 글](/posts/spring-property-externalization/)에서는 설정 값을 코드 밖으로 꺼내는 방법을 살펴봤습니다. 이번에는 Spring의 두 번째 핵심 기술인 **AOP(Aspect-Oriented Programming)**입니다. AOP는 처음 접하면 개념이 낯설지만, "반복되는 부가 코드를 한 곳에 모아 자동으로 끼워 넣는다"는 한 문장으로 요약할 수 있습니다.

## 문제: 횡단 관심사(Cross-Cutting Concern)

기능 개발을 하다 보면 비즈니스 로직과 직접 관계없는 코드가 여러 클래스에 반복적으로 등장합니다.

```java
@Service
public class OrderService {

    public Order placeOrder(OrderRequest req) {
        log.info("[START] placeOrder: {}", req);  // 로깅
        checkPermission("ORDER_WRITE");           // 보안
        // 트랜잭션 시작                          // 트랜잭션
        try {
            Order order = createOrder(req);
            notifyUser(order);
            return order;
        } catch (Exception e) {
            // 트랜잭션 롤백
            throw e;
        } finally {
            log.info("[END] placeOrder");          // 로깅
        }
    }
}
```

`UserService`, `ProductService`, `PaymentService`에도 동일한 로깅·보안·트랜잭션 코드가 복사됩니다. 이처럼 **여러 모듈에 걸쳐 공통으로 나타나는 관심사**를 횡단 관심사(Cross-Cutting Concern)라고 합니다.

## OOP만으로는 분리가 어렵다

OOP로 중복을 제거하려면 상속이나 컴포지션을 쓰는 게 일반적입니다. 그런데 로깅·보안·트랜잭션은 특정 클래스 계층에 속하지 않습니다. 이들은 **수직 계층(클래스 상속)을 수평으로 가로지르는** 관심사입니다.

```java
// 상속으로 해결하려는 시도 — 잘 동작하지 않음
public abstract class LoggingService {
    protected abstract Object execute();
    public Object run() {
        log.info("start");
        Object result = execute();
        log.info("end");
        return result;
    }
}
```

`OrderService`가 `LoggingService`를 상속하면 이번엔 `SecurityService`를 상속할 수 없습니다. Java는 단일 상속이라 하나만 선택해야 합니다. 컴포지션으로 해결해도 각 서비스마다 위임 코드가 생겨 여전히 중복입니다.

## AOP: 횡단 관심사를 모듈화

![AOP 없이 vs AOP 적용 후](/assets/posts/spring-aop-concept-crosscutting.svg)

AOP는 횡단 관심사를 **Aspect**라는 독립 모듈로 추출합니다. 비즈니스 로직 코드를 전혀 수정하지 않고, Aspect가 지정한 지점(Pointcut)에 자동으로 실행됩니다.

```java
// AOP 적용 후 OrderService — 부가 코드 없음
@Service
public class OrderService {

    public Order placeOrder(OrderRequest req) {
        Order order = createOrder(req);
        notifyUser(order);
        return order;  // 비즈니스 로직만 남음
    }
}
```

로깅·보안·트랜잭션은 각각의 Aspect로 분리되어, 매칭되는 모든 메서드에 자동으로 적용됩니다.

## Spring AOP의 구현 방식: 프록시

![Spring AOP 동작 원리 — 프록시 기반](/assets/posts/spring-aop-concept-weaving.svg)

Spring AOP는 **런타임 프록시**를 사용합니다. `ApplicationContext`가 빈을 생성할 때, AOP 대상 빈을 원본 대신 프록시 객체로 교체합니다. 호출자는 프록시를 받지만 인터페이스가 같으므로 차이를 느끼지 못합니다.

```java
// 호출자 입장에서는 평범한 스프링 빈
@Service
public class CheckoutController {

    private final OrderService orderService; // 사실 프록시

    public void checkout(OrderRequest req) {
        orderService.placeOrder(req); // 프록시가 Aspect 실행 후 위임
    }
}
```

### JDK Dynamic Proxy vs CGLIB

Spring은 두 가지 프록시 방식을 사용합니다.

| 방식 | 조건 | 특징 |
|---|---|---|
| JDK Dynamic Proxy | 대상 클래스가 인터페이스 구현 | `java.lang.reflect.Proxy` 사용 |
| CGLIB | 인터페이스 없는 클래스 | 바이트코드 조작으로 서브클래스 생성 |

Spring Boot 2.0부터는 인터페이스가 있어도 **CGLIB를 기본으로 사용**합니다. `spring.aop.proxy-target-class=false`로 JDK 프록시로 전환할 수 있습니다.

## Spring AOP vs AspectJ

AOP 프레임워크는 Spring AOP 외에도 AspectJ가 있습니다.

```
Spring AOP:
- 런타임 프록시 기반
- 스프링 빈에만 적용 가능
- 메서드 실행 JoinPoint만 지원
- 설정이 간단, 별도 컴파일 불필요

AspectJ:
- 컴파일 타임 / 로드 타임 위빙
- 모든 Java 객체에 적용 가능
- 필드 접근, 생성자 호출 등 다양한 JoinPoint
- 별도 컴파일러(ajc) 또는 LTW 에이전트 필요
```

실무에서는 대부분 Spring AOP로 충분합니다. `@Transactional`, `@Cacheable`, `@Async`도 모두 Spring AOP 프록시로 구현되어 있습니다.

## Spring AOP의 한계

프록시 방식이기 때문에 중요한 제약이 있습니다.

```java
@Service
public class OrderService {

    public void processOrder(Order order) {
        validate(order);     // ← 내부 호출
    }

    @Transactional          // 이 어노테이션은 무시됨!
    public void validate(Order order) {
        // ...
    }
}
```

`processOrder()`가 같은 클래스 내의 `validate()`를 직접 호출하면 **프록시를 거치지 않습니다**. 따라서 `@Transactional`이 동작하지 않습니다. 이를 **self-invocation 문제**라고 합니다. AOP를 사용할 때 가장 자주 겪는 함정입니다.

해결책은 `validate()`를 별도 빈으로 분리하거나, `ApplicationContext`에서 자신의 프록시를 가져오는 방법이 있습니다.

## AOP를 쓰는 주요 상황

- **로깅**: 메서드 진입/종료, 실행 시간 측정
- **보안**: 권한 검사 (`@PreAuthorize`)
- **트랜잭션**: `@Transactional` 처리
- **캐싱**: `@Cacheable`, `@CachePut`
- **재시도**: `@Retryable`
- **성능 모니터링**: Micrometer, OpenTelemetry 연동

이 모든 기능이 Spring 내부적으로는 BeanPostProcessor(After 단계에서 프록시 생성)와 AOP Aspect의 조합으로 구현되어 있습니다.

## 핵심 정리

- **횡단 관심사**: 여러 클래스에 반복되는 부가 로직 (로깅, 보안, 트랜잭션)
- **OOP의 한계**: 상속·컴포지션으로는 수평적 중복 제거 어려움
- **AOP**: Aspect 모듈로 분리 → 지정 지점에 자동 적용
- **Spring AOP**: 런타임 프록시 방식 (JDK Dynamic Proxy 또는 CGLIB)
- **Self-invocation**: 같은 클래스 내 메서드 호출 시 프록시 우회 → AOP 미적용

---

**지난 글:** [Spring Property 외부화: @Value부터 Environment까지](/posts/spring-property-externalization/)

**다음 글:** [Spring AOP 용어: Aspect, Advice, JoinPoint, Pointcut 완전 정리](/posts/spring-aop-terms/)

<br>
읽어주셔서 감사합니다. 😊
