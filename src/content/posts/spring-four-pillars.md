---
title: "Spring 4대 핵심 특징 — IoC·DI·AOP·PSA 완전 해부"
description: "Spring Framework의 핵심을 이루는 IoC, DI, AOP, PSA 개념을 코드 예제와 함께 깊이 있게 설명합니다. DI 3가지 주입 방식 비교와 생성자 주입 권장 이유도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "IoC", "DI", "AOP", "PSA", "의존성 주입"]
featured: false
draft: false
---

[지난 글](/posts/spring-what-is-spring/)에서 Spring Framework가 왜 등장했는지, POJO 기반 개발이 무엇인지 살펴봤습니다. 이번 글에서는 Spring을 Spring답게 만드는 4가지 핵심 특징 — IoC, DI, AOP, PSA — 을 각각 코드 수준에서 분해합니다. 특히 DI의 3가지 주입 방식과 그 장단점을 명확히 이해하면 Spring 개발의 80%는 자연스럽게 따라옵니다.

![Spring 4대 핵심 특징 관계도](/assets/posts/spring-four-pillars-diagram.svg)

## 1. IoC — 제어의 역전 (Inversion of Control)

IoC는 "제어권이 누구에게 있는가"의 문제입니다. 전통적인 프로그래밍에서는 내 코드가 모든 것을 제어합니다. 필요한 객체를 `new`로 생성하고, 순서를 결정하고, 라이프사이클을 관리합니다.

IoC가 적용된 세계에서는 반대입니다. 내 코드는 할 일만 정의하고, **프레임워크가 내 코드를 필요한 시점에 호출**합니다.

```java
// IoC 없음 — 내 코드가 모든 것을 제어
public class App {
    public static void main(String[] args) {
        DataSource ds = new HikariDataSource(config);
        OrderRepository repo = new JpaOrderRepository(ds);
        OrderService service = new OrderService(repo);
        service.createOrder(request);
    }
}

// IoC 있음 — 컨테이너가 제어, 내 코드는 로직만
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
        // 빈 생성, 의존 주입, 초기화 — 모두 Spring이 처리
    }
}
```

Spring IoC 컨테이너(`ApplicationContext`)는 클래스패스를 스캔하거나 설정 파일을 읽어 빈(Bean) 객체를 생성하고, 서로의 의존 관계를 파악해 연결하며, 싱글톤으로 관리합니다.

## 2. DI — 의존성 주입 (Dependency Injection)

DI는 IoC를 구현하는 가장 핵심적인 기법입니다. 객체가 자신이 필요한 의존 객체를 직접 만들지 않고, **외부(컨테이너)로부터 받는 것**을 의존성 주입이라 합니다.

Spring은 3가지 주입 방식을 지원합니다.

![DI 3가지 주입 방식 비교](/assets/posts/spring-four-pillars-di-types.svg)

### 생성자 주입 (권장)

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentService paymentService;

    // @Autowired 생략 가능 (생성자 1개면 자동 적용)
    public OrderService(OrderRepository orderRepository,
                        PaymentService paymentService) {
        this.orderRepository = orderRepository;
        this.paymentService = paymentService;
    }
}
```

**권장 이유**: `final` 키워드로 불변성 보장, 테스트 시 `new OrderService(mockRepo, mockPayment)` 형태로 주입, 순환 의존이 있으면 컨테이너 시작 시 즉시 오류 발생.

### 세터 주입

```java
@Service
public class NotificationService {

    private EmailSender emailSender;

    @Autowired(required = false) // 선택적 의존
    public void setEmailSender(EmailSender emailSender) {
        this.emailSender = emailSender;
    }
}
```

이메일 발송 기능이 없는 환경에서도 서비스가 동작해야 할 때 등 **선택적 의존**에 적합합니다.

### 필드 주입 (지양)

```java
@Service
public class OrderService {
    @Autowired
    private OrderRepository orderRepository; // final 불가, 테스트 어려움
}
```

코드는 간결하지만 리플렉션으로 주입되어 `final` 불가, 단위 테스트 시 주입 방법이 없고, 숨겨진 의존 관계를 파악하기 어렵습니다. Spring 공식 가이드도 필드 주입을 피하도록 권장합니다.

## 3. AOP — 관점 지향 프로그래밍 (Aspect-Oriented Programming)

비즈니스 로직을 작성하다 보면 특정 관심사가 여러 클래스에 걸쳐 반복되는 것을 느낍니다. 로깅, 트랜잭션, 보안 체크, 성능 측정 — 이런 **횡단 관심사(Cross-cutting Concern)** 는 핵심 로직과 뒤섞이면 코드를 오염시킵니다.

```java
// AOP 없이 모든 서비스에 트랜잭션, 로깅을 직접 작성하면?
public Order createOrder(OrderRequest request) {
    log.info("createOrder 시작: {}", request);
    txManager.begin();
    try {
        Order order = orderRepository.save(Order.from(request));
        txManager.commit();
        log.info("createOrder 완료: {}", order.getId());
        return order;
    } catch (Exception e) {
        txManager.rollback();
        throw e;
    }
}
```

AOP를 사용하면 이 반복 코드를 Aspect로 분리합니다.

```java
// AOP 적용 후 — 비즈니스 로직만 남음
@Transactional
public Order createOrder(OrderRequest request) {
    return orderRepository.save(Order.from(request));
}
```

`@Transactional`이 붙은 메서드 호출 전후로 Spring AOP가 트랜잭션 시작/커밋/롤백을 자동 처리합니다. AOP는 **프록시 패턴**으로 구현되며, 실제 빈 대신 프록시 객체가 메서드 호출을 가로채 부가 기능을 수행합니다.

## 4. PSA — 서비스 추상화 (Portable Service Abstraction)

PSA는 기술 구현체가 달라져도 동일한 인터페이스로 사용할 수 있게 하는 추상화 레이어입니다.

```java
// PlatformTransactionManager: JDBC/JPA/JTA 모두 동일 인터페이스
@Bean
public PlatformTransactionManager transactionManager(DataSource ds) {
    return new DataSourceTransactionManager(ds); // JPA로 교체해도 코드 무변경
}

// CacheManager: Caffeine/Redis/EhCache 모두 동일 인터페이스
@Cacheable("products")
public Product findById(Long id) {
    return productRepository.findById(id).orElseThrow();
}
```

`@Cacheable`을 쓰는 코드는 실제 캐시 구현이 Caffeine이든 Redis든 전혀 알 필요가 없습니다. 설정 파일에서 `CacheManager` 빈만 교체하면 됩니다. 이것이 PSA의 핵심 — **기술 변경으로부터 비즈니스 코드를 보호**합니다.

## 4가지 특징의 관계

IoC → DI → AOP → PSA는 독립적인 개념이 아니라 서로를 보완합니다.

- **IoC**가 전체 제어권 역전이라는 철학이라면
- **DI**는 그 철학을 구현하는 기술
- **AOP**는 DI로 연결된 빈들 사이에서 횡단 관심사를 처리하는 방법
- **PSA**는 DI로 주입되는 기술 구현체를 교체 가능하게 하는 추상화

모든 특징의 중심에는 **POJO**가 있습니다. Spring의 모든 메커니즘은 순수 자바 객체가 비즈니스 로직에만 집중할 수 있도록 주변을 정리해주는 역할을 합니다.

---

**지난 글:** [Spring Framework란 무엇인가](/posts/spring-what-is-spring/)

**다음 글:** [Spring 생태계 지도 — 프로젝트 전체 구조 한눈에 보기](/posts/spring-ecosystem-map/)

<br>
읽어주셔서 감사합니다. 😊
