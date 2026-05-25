---
title: "Spring의 4대 특성 — IoC·DI·AOP·PSA 완전 정복"
description: "Spring Framework를 이해하는 핵심 키워드인 IoC, DI, AOP, PSA의 개념과 동작 원리를 코드 예제와 함께 깊이 있게 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "IoC", "DI", "AOP", "PSA", "의존성 주입", "관점 지향 프로그래밍"]
featured: false
draft: false
---

[지난 글](/posts/spring-what-is-spring/)에서 Spring이 Java 엔터프라이즈 개발의 고통을 어떻게 해소했는지 살펴봤다. 이번에는 Spring이 그 목표를 달성하는 네 가지 핵심 메커니즘인 **IoC, DI, AOP, PSA**를 하나씩 분해해 보겠다. 이 네 가지를 이해하면 Spring의 동작 방식과 설계 철학 전체가 맞물려 보이기 시작한다.

## 전체 개요

![Spring 4대 특성](/assets/posts/spring-four-pillars-concepts.svg)

4대 특성은 각각 독립된 개념이지만 실제로는 서로를 보완하며 동작한다. IoC가 제어의 흐름을 뒤집으면, DI가 그 흐름 위에서 의존성을 공급한다. AOP는 그 객체들이 실행될 때 관심사를 분리하고, PSA는 하부 구현이 교체되어도 코드가 흔들리지 않도록 추상화를 제공한다.

## 1. IoC — 제어 역전

**IoC(Inversion of Control)**는 객체의 생성과 생명주기 관리를 개발자 코드에서 프레임워크로 옮기는 원칙이다. "제어를 역전한다"는 표현은 다소 추상적이지만, 아래 비교를 보면 바로 명확해진다.

```java
// IoC 없음: 개발자가 직접 생성·조립
UserRepository repo = new JpaUserRepository(dataSource);
UserService service = new UserServiceImpl(repo);
service.doSomething();

// IoC: Spring 컨테이너에서 꺼내 쓰기
ApplicationContext ctx =
    new AnnotationConfigApplicationContext(AppConfig.class);
UserService service = ctx.getBean(UserService.class);
service.doSomething();
```

IoC 방식에서는 `UserService`가 어떻게 만들어지는지, 어떤 `UserRepository` 구현체가 주입되는지 호출 코드는 알 필요가 없다. 이를 위한 IoC 컨테이너의 대표 구현이 `ApplicationContext`다. Spring은 설정(`@Configuration`, XML 등)을 읽어 Bean(관리 객체)을 생성·등록·연결하고, 애플리케이션 종료 시 소멸 콜백도 호출한다.

```java
@Configuration
public class AppConfig {

    @Bean
    public UserRepository userRepository(DataSource ds) {
        return new JpaUserRepository(ds);  // 구현체 결정
    }

    @Bean
    public UserService userService(UserRepository repo) {
        return new UserServiceImpl(repo);  // IoC 컨테이너가 조립
    }
}
```

`@Bean` 메서드를 통해 컨테이너가 생성할 객체와 그 의존성을 선언적으로 정의한다.

## 2. DI — 의존성 주입

**DI(Dependency Injection)**는 IoC를 구현하는 구체적인 방법이다. 객체가 필요한 의존성을 스스로 찾는(pull) 대신, 외부에서 밀어 넣어(push) 준다. Spring에서 DI 방식은 세 가지다.

### 생성자 주입 (권장)

```java
@Service
public class OrderService {

    private final PaymentClient paymentClient;
    private final OrderRepository orderRepository;

    // @Autowired 없어도 생성자가 하나면 자동 주입
    public OrderService(PaymentClient paymentClient,
                        OrderRepository orderRepository) {
        this.paymentClient = paymentClient;
        this.orderRepository = orderRepository;
    }
}
```

`final` 필드를 사용할 수 있어 불변성이 보장되고, 테스트 시 `new OrderService(mockPayment, mockRepo)` 형태로 Mock 주입이 간단하다. Spring 공식 문서도 생성자 주입을 권장한다.

### 세터 주입 (선택적 의존성)

```java
@Service
public class NotificationService {

    private EmailSender emailSender;

    @Autowired(required = false)  // 없어도 동작 가능
    public void setEmailSender(EmailSender emailSender) {
        this.emailSender = emailSender;
    }
}
```

### 필드 주입 (테스트에서 불편, 지양)

```java
@Service
public class UserService {
    @Autowired  // 리플렉션으로 주입 — 테스트 어려움
    private UserRepository userRepository;
}
```

필드 주입은 코드가 짧아 보이지만 `final`을 쓸 수 없고, 컨테이너 없이 인스턴스화가 불가능해 단위 테스트가 복잡해진다.

## 3. AOP — 관점 지향 프로그래밍

**AOP(Aspect-Oriented Programming)**는 여러 클래스에 걸쳐 반복되는 로직(횡단 관심사, Cross-cutting Concern)을 별도의 모듈(Aspect)로 분리하는 기법이다. 대표적인 횡단 관심사는 로깅, 보안 검사, 트랜잭션, 캐싱이다.

```java
@Aspect
@Component
public class AuditAspect {

    // service 패키지 모든 public 메서드 실행 전/후에 적용
    @Around("execution(public * com.example.service.*.*(..))")
    public Object audit(ProceedingJoinPoint pjp) throws Throwable {
        String method = pjp.getSignature().toShortString();
        System.out.println("[AUDIT] 시작: " + method);
        try {
            Object result = pjp.proceed();  // 실제 메서드 실행
            System.out.println("[AUDIT] 완료: " + method);
            return result;
        } catch (Exception e) {
            System.out.println("[AUDIT] 실패: " + method + " — " + e.getMessage());
            throw e;
        }
    }
}
```

Spring AOP는 **프록시(Proxy)** 기반으로 동작한다. 컨테이너가 Bean을 반환할 때 실제 객체 대신 Aspect 로직이 포함된 프록시 객체를 반환하고, 메서드 호출이 프록시를 통해 전달된다. 개발자는 비즈니스 로직 코드에 로깅 코드 한 줄 없이도, Aspect 설정 하나로 모든 서비스 메서드에 감사 로그를 추가할 수 있다.

## 4. PSA — 일관된 서비스 추상화

**PSA(Portable Service Abstraction)**는 특정 기술에 종속되지 않는 추상화 계층을 제공하는 개념이다. 구현체(JPA, MyBatis, Hibernate)가 무엇이든 개발자는 동일한 Spring API로 사용하며, 나중에 구현체를 교체해도 비즈니스 코드는 수정하지 않아도 된다.

![IoC/DI vs AOP/PSA 코드 예시](/assets/posts/spring-four-pillars-code.svg)

대표적인 PSA 사례는 `@Transactional`이다.

```java
@Service
public class TransferService {

    private final AccountRepository accountRepository;

    public TransferService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    // JDBC든 JPA든 관계없이 선언 한 줄로 트랜잭션 관리
    @Transactional
    public void transfer(Long fromId, Long toId, BigDecimal amount) {
        Account from = accountRepository.findById(fromId)
                .orElseThrow();
        Account to = accountRepository.findById(toId)
                .orElseThrow();
        from.debit(amount);
        to.credit(amount);
        // 예외 발생 시 자동 rollback, 정상 완료 시 commit
    }
}
```

`@Transactional`은 내부적으로 AOP 프록시로 구현된다. 메서드 호출 전에 트랜잭션을 시작하고, 예외 없이 반환되면 커밋, `RuntimeException` 발생 시 롤백한다. 이 처리는 완전히 Spring이 담당하며 개발자 코드에는 트랜잭션 관련 코드가 전혀 없다.

PSA가 적용된 또 다른 예로는 `JdbcTemplate`(JDBC 추상화), `CacheManager`(Caffeine/Redis 교체), `PlatformTransactionManager`(JPA/Hibernate/JDBC 교체) 등이 있다.

## 4대 특성의 상호 작용

실제 Spring 애플리케이션에서 4대 특성은 다음과 같이 한꺼번에 작동한다.

1. **IoC**: `ApplicationContext`가 `OrderService`, `OrderRepository` 등을 Bean으로 생성
2. **DI**: `OrderService` 생성자에 `OrderRepository` 인스턴스를 주입
3. **AOP**: `@Transactional`이 붙은 메서드에 프록시를 씌워 트랜잭션 경계를 처리
4. **PSA**: `@Transactional`은 JPA이든 JDBC이든 동일하게 동작 — 구현체 변경해도 코드 수정 없음

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;  // DI

    public OrderService(OrderRepository orderRepository) {  // IoC
        this.orderRepository = orderRepository;
    }

    @Transactional          // AOP(프록시) + PSA(트랜잭션 추상화)
    public Order placeOrder(OrderRequest request) {
        Order order = Order.from(request);
        return orderRepository.save(order);
    }
}
```

이 단순해 보이는 클래스 뒤에서 Spring은 Bean 생성(IoC), 의존성 연결(DI), 트랜잭션 프록시 적용(AOP), 추상화된 트랜잭션 처리(PSA)를 모두 처리한다. 개발자는 오직 비즈니스 로직(`Order.from`, `orderRepository.save`)에만 집중할 수 있다.

## 핵심 정리

| 특성 | 한 줄 요약 | 대표 구현 |
|---|---|---|
| IoC | 객체 제어권을 컨테이너에 위임 | `ApplicationContext` |
| DI | 의존성을 외부에서 주입 | 생성자 주입, `@Autowired` |
| AOP | 횡단 관심사를 Aspect로 분리 | `@Aspect`, `@Transactional` |
| PSA | 구현 독립적 추상화 계층 | `JdbcTemplate`, `@Transactional` |

다음 글에서는 Spring이 제공하는 프로젝트들의 전체 지형도인 **Spring 생태계 맵**을 살펴보고, 어떤 상황에서 어떤 Spring 프로젝트를 선택해야 하는지 알아본다.

---

**지난 글:** [Spring이란 무엇인가](/posts/spring-what-is-spring/)

**다음 글:** [Spring 생태계 맵 — 프로젝트 전체 지형도](/posts/spring-ecosystem-map/)

<br>
읽어주셔서 감사합니다. 😊
