---
title: "스프링의 4대 핵심 — IoC, DI, AOP, PSA"
description: "스프링을 스프링답게 만드는 네 가지 기둥. IoC와 DI의 차이, AOP가 코드를 어떻게 깨끗하게 유지하는지, PSA가 왜 기술 교체를 쉽게 만드는지 구체적인 코드와 함께 살펴본다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["spring", "ioc", "di", "aop", "psa", "core"]
featured: false
draft: false
---

[지난 글](/posts/spring-what-is-spring/)에서 EJB의 한계와 스프링의 POJO 철학을 살펴봤다. "비즈니스 코드는 순수 자바로, 인프라 관심사는 프레임워크가"라는 원칙을 실현하기 위해 스프링은 네 가지 핵심 개념을 설계의 기둥으로 삼았다.

**IoC**, **DI**, **AOP**, **PSA** — 이 네 단어는 스프링 문서 첫 페이지에 등장하지만, 처음 보면 모두 비슷하게 들린다. 이 글에서는 각 개념의 의미, 서로의 관계, 그리고 왜 지금도 중요한지를 코드로 풀어본다.

![스프링의 4대 핵심 개요](/assets/posts/spring-four-pillars-overview.svg)

## 1. IoC — 제어의 역전

**IoC(Inversion of Control)** 는 특정 기술이 아니라 소프트웨어 설계 **원칙**이다.

전통적인 자바 코드에서는 개발자가 객체의 생성과 소멸, 의존 관계를 직접 제어한다.

```java
// 제어가 개발자에게 있는 전통 방식
public class OrderController {

    private OrderService orderService;

    public OrderController() {
        // 개발자가 직접 new
        OrderRepository repo = new OrderRepository();
        this.orderService = new OrderService(repo);
    }
}
```

이 코드의 문제점은 분명하다. `OrderController`가 `OrderService`와 `OrderRepository`를 어떻게 만드는지까지 알아야 한다. 테스트할 때 `OrderService`를 가짜(Mock)로 교체하려면 코드를 수정해야 한다.

IoC는 이 **제어의 방향을 뒤집는다**. 객체 생성과 의존 관계 연결의 책임을 **컨테이너**에게 넘긴다.

```java
// IoC — 제어가 컨테이너에 있는 스프링 방식
@RestController
public class OrderController {

    private final OrderService orderService;

    // 컨테이너가 호출해서 주입해준다
    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }
}
```

`OrderController`는 이제 `OrderService`가 어떻게 만들어지는지, 내부에 어떤 의존성이 있는지 전혀 모른다. "나는 `OrderService`가 필요하다"는 선언만 할 뿐이고, 실제 제공은 스프링 컨테이너가 한다.

마틴 파울러는 이 원칙을 "**헐리우드 원칙**"이라고도 불렀다. "전화하지 마세요, 우리가 전화할게요(Don't call us, we'll call you)".

## 2. DI — IoC를 구현하는 방법

**DI(Dependency Injection, 의존성 주입)** 는 IoC를 달성하는 구체적인 패턴이다. IoC라는 목표를 DI라는 방법으로 달성한다고 이해하면 된다.

스프링에서 DI는 세 가지 방식으로 이뤄진다.

### 생성자 주입 (권장)

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;

    // Spring 4.3+: 생성자가 하나면 @Autowired 생략 가능
    public OrderService(
            OrderRepository orderRepository,
            PaymentGateway paymentGateway) {
        this.orderRepository = orderRepository;
        this.paymentGateway = paymentGateway;
    }
}
```

`final` 필드로 선언되므로 불변성이 보장된다. 필수 의존성이 없으면 객체 자체가 만들어지지 않아 NPE를 원천 차단한다.

### 세터 주입 (선택적 의존성)

```java
@Service
public class NotificationService {

    private EmailSender emailSender;

    // 선택적 의존성: 없어도 동작하되, 있으면 이메일 발송
    @Autowired(required = false)
    public void setEmailSender(EmailSender emailSender) {
        this.emailSender = emailSender;
    }
}
```

### 필드 주입 (테스트·유지보수 불리, 지양)

```java
@Service
public class OrderService {

    @Autowired  // 리플렉션으로 직접 주입 — final 불가, 테스트 어려움
    private OrderRepository orderRepository;
}
```

필드 주입은 코드가 짧아 보이지만, 외부에서 의존성을 교체할 방법이 없어 단위 테스트가 어렵다. 스프링 공식 문서도 생성자 주입을 권장한다.

### DI의 진짜 가치 — 테스트 가능성

```java
// 스프링 없이, JUnit 단독으로 테스트
@Test
void createOrder_deductsInventory() {
    // given
    OrderRepository mockRepo = mock(OrderRepository.class);
    PaymentGateway mockPay = mock(PaymentGateway.class);
    OrderService svc = new OrderService(mockRepo, mockPay);  // new!

    // when
    svc.createOrder(someRequest);

    // then
    verify(mockRepo).save(any());
    verify(mockPay).charge(any());
}
```

WAS도, ApplicationContext도 없이 순수 JVM에서 실행된다. 이것이 POJO + DI 조합이 주는 최대의 이점이다.

## 3. AOP — 횡단 관심사 분리

비즈니스 로직을 작성하다 보면 로직과 직접 관계없는 코드들이 반복되는 것을 느낀다.

```java
// AOP 없이 — 로깅·트랜잭션이 비즈니스 로직과 뒤섞임
public Order createOrder(OrderRequest request) {
    log.info("createOrder 시작: {}", request);  // 로깅
    Transaction tx = txManager.begin();          // 트랜잭션
    try {
        Order order = doCreateOrder(request);    // ← 진짜 로직
        tx.commit();
        log.info("createOrder 완료: {}", order.getId());
        return order;
    } catch (Exception e) {
        tx.rollback();
        log.error("createOrder 실패", e);
        throw e;
    }
}
```

로깅과 트랜잭션 관리가 핵심 로직 `doCreateOrder`를 감싸고 있다. 메서드 100개에 이 패턴을 반복해야 한다면? 그리고 어느 날 로깅 형식을 바꿔야 한다면?

**AOP(Aspect-Oriented Programming)** 는 이런 **횡단 관심사(Cross-Cutting Concern)** 를 별도 모듈(Aspect)로 분리한다.

```java
@Aspect
@Component
public class LoggingAspect {

    private static final Logger log = LoggerFactory.getLogger(LoggingAspect.class);

    @Around("execution(* com.example.service.*.*(..))")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        long start = System.currentTimeMillis();
        String method = joinPoint.getSignature().toShortString();

        try {
            Object result = joinPoint.proceed();  // 실제 메서드 호출
            log.info("{} 완료 ({}ms)", method, System.currentTimeMillis() - start);
            return result;
        } catch (Exception e) {
            log.error("{} 실패: {}", method, e.getMessage());
            throw e;
        }
    }
}
```

이제 `OrderService`의 모든 메서드에 로깅이 자동 적용된다. 비즈니스 코드 한 줄도 건드리지 않고.

```java
// AOP 적용 후 — 순수 비즈니스 로직만 남음
@Transactional  // AOP가 트랜잭션 처리
public Order createOrder(OrderRequest request) {
    Order order = new Order(request.getCustomerId(), request.getItems());
    return orderRepository.save(order);
}
```

`@Transactional`도 AOP로 동작한다. 메서드 진입 시 트랜잭션을 시작하고, 정상 종료 시 커밋, 예외 시 롤백하는 `@Around` Advice가 스프링 내부에 구현되어 있다.

![DI 흐름과 AOP 레이어](/assets/posts/spring-four-pillars-di-flow.svg)

## 4. PSA — 이식 가능한 서비스 추상화

**PSA(Portable Service Abstraction)** 는 스프링이 제공하는 다양한 기술 추상화 계층이다. 특정 구현 기술에 의존하지 않고 일관된 인터페이스로 다양한 기술을 다룰 수 있게 한다.

대표적인 예: 트랜잭션 관리

```java
// JPA를 쓰든, JDBC를 쓰든, JTA를 쓰든 — 같은 애노테이션
@Transactional
public void transferMoney(Long fromId, Long toId, BigDecimal amount) {
    Account from = accountRepository.findById(fromId).orElseThrow();
    Account to = accountRepository.findById(toId).orElseThrow();
    from.withdraw(amount);
    to.deposit(amount);
}
```

내부적으로 스프링은 `PlatformTransactionManager` 인터페이스를 통해 트랜잭션을 관리한다. JPA를 쓰면 `JpaTransactionManager`가, JDBC를 쓰면 `DataSourceTransactionManager`가 주입된다. 코드는 바뀌지 않는다.

캐시 추상화 역시 마찬가지다.

```java
// 로컬 캐시(Caffeine)에서 Redis로 바꿔도 코드 그대로
@Cacheable(value = "products", key = "#productId")
public Product findProduct(Long productId) {
    return productRepository.findById(productId).orElseThrow();
}
```

`application.yml` 설정 한 줄로 캐시 구현체를 바꿀 수 있다.

```yaml
spring:
  cache:
    type: redis   # caffeine → redis로 교체. 비즈니스 코드 무변경
```

## 네 기둥의 관계

```text
IoC  ←  "객체 제어를 컨테이너에게"  (원칙)
 └─ DI  ← IoC를 구현하는 패턴
 └─ AOP ← IoC 컨테이너가 가로채서 적용하는 기술
 └─ PSA ← IoC 컨테이너 위에서 통일된 인터페이스 제공
```

IoC가 가장 상위 개념이고, DI·AOP·PSA는 IoC 컨테이너가 있기에 가능한 기법들이다. DI 덕분에 AOP 프록시를 투명하게 주입할 수 있고, PSA의 구현체 교체도 DI로 이뤄진다.

## 정리

| 개념 | 핵심 질문 | 이점 |
|------|-----------|------|
| IoC | "누가 객체를 관리하는가?" | 결합도 감소, 테스트 용이 |
| DI | "의존성을 어떻게 공급하는가?" | 교체 가능, 불변성, 명시적 의존 |
| AOP | "횡단 관심사를 어디에 두는가?" | 비즈니스 코드 순수성 유지 |
| PSA | "기술을 어떻게 추상화하는가?" | 벤더 독립, 이식성 |

이 네 가지를 이해하고 나면 스프링의 수많은 기능들 — `@Transactional`, `@Cacheable`, `@Async`, `@Scheduled` — 이 모두 같은 원칙 위에 서 있음을 알게 된다. 스프링을 외우는 것이 아니라 **이해하게 되는** 순간이 온다.

---

**지난 글:** [스프링이란 무엇인가 — EJB의 한계와 POJO 철학](/posts/spring-what-is-spring/)

**다음 글:** [스프링 생태계 지도 — Framework, Boot, Data, Security, Cloud](/posts/spring-ecosystem-map/)

<br>
읽어주셔서 감사합니다. 😊
