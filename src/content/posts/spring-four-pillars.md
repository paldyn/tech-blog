---
title: "스프링의 4대 핵심 — IoC, DI, AOP, PSA"
description: "스프링을 지탱하는 네 가지 핵심 개념 IoC, DI, AOP, PSA를 코드 예시와 함께 명확하게 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["spring", "ioc", "di", "aop", "psa"]
featured: false
draft: false
---

[지난 글](/posts/spring-what-is-spring/)에서 EJB의 한계와 스프링이 POJO 철학으로 그것을 어떻게 극복했는지 살펴봤습니다. 그렇다면 스프링은 구체적으로 어떤 메커니즘으로 동작할까요? 스프링의 모든 기능은 네 가지 핵심 개념 위에 세워져 있습니다. IoC, DI, AOP, PSA — 이 네 가지를 제대로 이해하면 스프링의 나머지 모든 것이 자연스럽게 보입니다.

## IoC — 제어의 역전

**IoC(Inversion of Control, 제어의 역전)** 는 스프링의 가장 근본적인 원칙입니다. 이름이 조금 거창하지만 개념 자체는 단순합니다.

전통적인 프로그래밍에서는 개발자 코드가 라이브러리를 호출합니다. 내가 주도권을 가집니다.

```java
// 전통 방식 — 개발자가 직접 제어
OrderRepository repo = new JdbcOrderRepository("jdbc:mysql://...");
OrderService service = new OrderService(repo);
service.placeOrder(itemId, quantity);
```

IoC에서는 반대입니다. 개발자는 컴포넌트를 등록하고, **프레임워크(컨테이너)가 컴포넌트를 호출**합니다. 마치 식당에서 셰프(개발자)는 요리만 하고, 홀 매니저(스프링)가 알아서 주문을 받아 적절한 요리를 내어주는 것과 같습니다.

```java
// IoC 방식 — 스프링이 제어
// 개발자는 컴포넌트를 선언만 한다
@Service
public class OrderService { ... }

@Repository
public class JdbcOrderRepository { ... }

// 어플리케이션 시작시 스프링이 알아서 객체를 만들고 연결
```

이 "컨테이너"가 바로 스프링의 **ApplicationContext**입니다. 모든 빈(Bean)의 생성, 의존성 연결, 소멸을 컨테이너가 책임집니다.

![스프링 4대 핵심 개념 구조도](/assets/posts/spring-four-pillars-overview.svg)

## DI — 의존성 주입

**DI(Dependency Injection, 의존성 주입)** 는 IoC를 구현하는 구체적인 방법입니다. IoC가 "무엇을 역전시키는가"에 대한 원칙이라면, DI는 "어떻게 역전시키는가"에 대한 패턴입니다.

A 객체가 B 객체를 필요로 할 때, A가 B를 직접 만드는 것이 아니라 **외부(컨테이너)에서 B를 만들어 A에게 넣어줍니다**. 이것이 주입(Injection)입니다.

![DI 전·후 비교](/assets/posts/spring-four-pillars-di-code.svg)

DI의 가장 큰 가치는 **교체 가능성**과 **테스트 용이성**입니다.

```java
// OrderRepository 인터페이스
public interface OrderRepository {
    void save(Order order);
}

// 실제 운영 구현체
@Repository
public class JpaOrderRepository implements OrderRepository {
    public void save(Order order) { /* DB 저장 */ }
}

// 테스트용 Mock 구현체
public class FakeOrderRepository implements OrderRepository {
    private List<Order> orders = new ArrayList<>();
    public void save(Order order) { orders.add(order); }
}

// OrderService는 어떤 구현체가 오는지 모른다
@Service
public class OrderService {
    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }
}
```

운영 환경에서는 스프링이 `JpaOrderRepository`를 주입하고, 테스트에서는 `FakeOrderRepository`를 주입합니다. `OrderService` 코드는 한 줄도 바뀌지 않습니다.

DI 방식은 세 가지가 있습니다. 스프링 팀이 권장하는 방식은 **생성자 주입**입니다.

```java
// 1. 생성자 주입 (권장) — 불변성 보장, null 방지
@Service
public class PaymentService {
    private final OrderRepository repo;
    private final NotificationService notifier;

    public PaymentService(OrderRepository repo,
                          NotificationService notifier) {
        this.repo = repo;
        this.notifier = notifier;
    }
}

// 2. 세터 주입 — 선택적 의존성에 사용
@Service
public class ReportService {
    private EmailSender emailSender;

    @Autowired(required = false)
    public void setEmailSender(EmailSender emailSender) {
        this.emailSender = emailSender;
    }
}

// 3. 필드 주입 — 간결하지만 테스트 어려움 (비권장)
@Service
public class UserService {
    @Autowired
    private UserRepository userRepository; // 비권장
}
```

## AOP — 관점 지향 프로그래밍

**AOP(Aspect-Oriented Programming, 관점 지향 프로그래밍)** 는 "여러 곳에 반복되는 관심사"를 한 곳으로 모으는 기법입니다.

예를 들어, 메서드 실행 시간을 로깅하고 싶다고 생각해 봅시다. AOP 없이는 모든 서비스 메서드마다 똑같은 코드를 넣어야 합니다.

```java
// AOP 없이 — 모든 메서드에 중복 코드
public Order placeOrder(Long itemId) {
    long start = System.currentTimeMillis();
    try {
        Order order = orderRepo.findAndCreate(itemId);
        return order;
    } finally {
        long elapsed = System.currentTimeMillis() - start;
        log.info("placeOrder took {}ms", elapsed);
    }
}
```

AOP를 사용하면 이 "횡단 관심사(cross-cutting concern)"를 **Aspect**라는 별도 클래스에 한 번만 정의하면 됩니다.

```java
// AOP 적용 — 한 곳에서 모든 서비스 메서드에 적용
@Aspect
@Component
public class PerformanceLoggingAspect {

    @Around("execution(* com.example.service.*.*(..))")
    public Object logExecutionTime(ProceedingJoinPoint pjp)
            throws Throwable {
        long start = System.currentTimeMillis();
        Object result = pjp.proceed();
        long elapsed = System.currentTimeMillis() - start;
        log.info("{} took {}ms",
            pjp.getSignature().getName(), elapsed);
        return result;
    }
}
```

이 Aspect 하나가 `service` 패키지의 모든 메서드에 자동으로 적용됩니다. 서비스 코드는 아무것도 바꾸지 않아도 됩니다.

AOP의 핵심 용어를 간략히 정리하면:

| 용어 | 의미 |
|------|------|
| **Aspect** | 횡단 관심사 모듈 (예: 로깅 Aspect) |
| **Advice** | 실제로 실행될 코드 (`@Around`, `@Before` 등) |
| **Pointcut** | Advice가 적용될 위치 지정 표현식 |
| **JoinPoint** | Advice가 끼어들 수 있는 실행 시점 |
| **Weaving** | Aspect를 대상 코드에 엮는 과정 |

스프링 AOP는 **프록시 패턴** 기반으로 동작합니다. 스프링이 빈 사이에 프록시 객체를 심어 Aspect가 실행되게 합니다. 코드 수정 없이 동작이 추가되는 마법처럼 보이지만, 내부적으로는 명확한 메커니즘입니다. AOP에 대한 자세한 내용은 Chapter 4에서 깊이 다룹니다.

## PSA — 이식 가능한 서비스 추상화

**PSA(Portable Service Abstraction, 이식 가능한 서비스 추상화)** 는 스프링이 제공하는 일관된 인터페이스를 통해 다양한 기술을 동일한 방식으로 사용하게 해주는 원칙입니다.

```java
// PSA 예시: 캐시 기술이 Caffeine이든 Redis든
// 개발자 코드는 동일
@Service
public class ProductService {

    @Cacheable("products")
    public Product findById(Long id) {
        return productRepository.findById(id).orElseThrow();
    }
}
```

`@Cacheable` 어노테이션 아래에는 Caffeine, Redis, EhCache 등 어떤 캐시 구현체가 와도 됩니다. 스프링이 중간에서 추상화 계층을 제공하므로 코드는 바뀌지 않습니다.

PSA가 빛나는 곳은 트랜잭션 처리입니다.

```java
// @Transactional — JPA든, JDBC든, JTA든 동일하게 동작
@Service
public class TransferService {

    @Transactional
    public void transfer(Long fromId, Long toId, int amount) {
        Account from = accountRepo.findById(fromId).orElseThrow();
        Account to = accountRepo.findById(toId).orElseThrow();
        from.deduct(amount);
        to.add(amount);
        // 예외 발생 시 자동 롤백
    }
}
```

`@Transactional`은 내부적으로 `PlatformTransactionManager` 인터페이스를 사용합니다. JPA를 쓰면 `JpaTransactionManager`가, 단순 JDBC면 `DataSourceTransactionManager`가 동작합니다. 개발자는 어떤 구현체를 쓰는지 신경 쓸 필요가 없습니다.

## 네 가지가 함께 만드는 시너지

이 네 가지 개념은 독립적이 아니라 서로 맞물려 동작합니다.

```
IoC 컨테이너가 빈을 관리한다
      ↓
DI로 빈들 사이의 의존성을 연결한다
      ↓
AOP로 빈 사이에 횡단 관심사를 투명하게 추가한다
      ↓
PSA로 어떤 기술 스택을 써도 동일한 코드로 동작한다
```

실제 스프링 애플리케이션에서 하나의 요청이 처리되는 흐름을 보면:

1. `@Controller` 빈이 IoC 컨테이너에 등록된다 (IoC)
2. `@Service` 의존성이 생성자로 주입된다 (DI)
3. 컨트롤러 메서드 호출 전후로 트랜잭션이 자동으로 시작·종료된다 (AOP)
4. JPA든 JDBC든 동일한 `@Transactional`로 처리된다 (PSA)

이 구조가 스프링 코드를 단순하게 유지하면서도 강력하게 만드는 비결입니다.

## 정리

스프링의 네 기둥은 단순히 기술 용어가 아닙니다. 각각은 소프트웨어 설계의 오랜 원칙(결합도 감소, 단일 책임, 의존성 역전)을 실용적으로 구현한 것입니다. 이 개념들을 머릿속에 넣어 두고 이후 챕터를 읽으면, 각 기능이 왜 그런 방식으로 설계됐는지 자연스럽게 이해됩니다.

---

**지난 글:** [스프링이란 무엇인가 — EJB의 한계와 POJO 철학](/posts/spring-what-is-spring/)

**다음 글:** [스프링 생태계 지도 — Framework, Boot, Data, Security, Cloud](/posts/spring-ecosystem-map/)

<br>
읽어주셔서 감사합니다. 😊
