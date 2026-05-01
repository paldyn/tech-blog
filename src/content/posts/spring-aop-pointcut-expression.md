---
title: "Spring AOP Pointcut 표현식 심화: execution·within·@annotation 완전 정복"
description: "Spring AOP Pointcut의 6가지 지시자—execution, within, @annotation, @within, args, bean—의 문법과 와일드카드 규칙, 파라미터 바인딩, 조합 방법을 실전 예제로 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "AOP", "Pointcut", "execution", "within", "annotation", "AspectJ"]
featured: false
draft: false
---

[지난 글](/posts/spring-aop-aspect-practice/)에서 `@Aspect` 클래스를 실전 패턴으로 작성하는 방법을 익혔습니다. 이번에는 Advice가 어느 메서드에 적용될지 결정하는 **Pointcut 표현식**을 깊이 다룹니다. 표현식을 정확히 쓸 줄 알아야 의도하지 않은 메서드에 Aspect가 걸리거나, 반대로 걸려야 할 메서드가 빠지는 사고를 막을 수 있습니다.

## execution() — 가장 범용적인 지시자

![execution() 표현식 문법](/assets/posts/spring-aop-pointcut-expression-syntax.svg)

`execution`은 Spring AOP에서 가장 많이 쓰는 지시자입니다. 메서드 실행 시그니처 전체를 대상으로 매칭합니다.

```
execution([수식어] 반환타입 [클래스.]메서드명(파라미터))
```

수식어(`public`, `protected` 등)와 클래스는 생략 가능합니다. 반환타입과 메서드명·파라미터는 필수입니다.

```java
// 와일드카드 실전 예시
@Pointcut("execution(public * *(..))")
void allPublicMethods() {}               // 모든 public 메서드

@Pointcut("execution(* com.example..*.*(..))")
void inExample() {}                      // com.example 하위 모든 패키지·클래스

@Pointcut("execution(* *Service.find*(..))")
void findInService() {}                  // *Service 클래스의 find로 시작하는 메서드

@Pointcut("execution(* *(Long, ..))")
void firstArgLong() {}                   // 첫 인자가 Long인 메서드

@Pointcut("execution(List<*> get*(..))")
void listReturning() {}                  // List<?>를 반환하는 get* 메서드

// 제외 패턴 (toString, equals, hashCode)
@Pointcut("execution(* com.example..*.*(..)) "
        + "&& !execution(* Object.*(..))")
void businessMethods() {}
```

### 파라미터 와일드카드 정리

| 패턴 | 의미 |
|------|------|
| `()` | 파라미터 없음 |
| `(*)` | 정확히 1개, 타입 무관 |
| `(..)` | 0개 이상, 타입 무관 |
| `(String, ..)` | 첫 인자 String, 나머지 무관 |
| `(*, String)` | 2개, 마지막이 String |

## Pointcut 지시자 전체 비교

![Pointcut 지시자 비교](/assets/posts/spring-aop-pointcut-expression-designators.svg)

## within() — 타입 단위 일괄 적용

특정 패키지나 클래스 내 **모든 메서드**를 대상으로 할 때 `within`이 더 간결합니다.

```java
// 패키지 단위
@Pointcut("within(com.example.service.*)")
void servicePackage() {}              // service 패키지 바로 아래만

@Pointcut("within(com.example.service..*)")
void serviceSubpackages() {}          // service 하위 패키지 모두 포함

// 특정 클래스 (+ 는 서브타입 포함)
@Pointcut("within(com.example.service.OrderService+)")
void orderServiceAndSubtypes() {}

// execution vs within 차이
// execution — 메서드 단위 세밀 제어
// within — 타입 단위 일괄 적용 (더 간결, 성능 약간 유리)
```

## @annotation() — 어노테이션으로 매칭 + 바인딩

메서드에 붙은 어노테이션으로 매칭하고, 어노테이션 **인스턴스 자체**를 Advice 파라미터로 받을 수 있습니다.

```java
// 커스텀 어노테이션 정의
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
    int requestsPerSecond() default 10;
    String key() default "";
}

// @annotation + 파라미터 바인딩
@Aspect
@Component
public class RateLimitAspect {

    private final Map<String, RateLimiter> limiters = new ConcurrentHashMap<>();

    // 어노테이션 인스턴스를 파라미터로 받으려면 표현식에 바인딩 이름 사용
    @Around("@annotation(rateLimit)")
    public Object enforce(ProceedingJoinPoint jp,
                          RateLimit rateLimit) throws Throwable {
        String key = rateLimit.key().isEmpty()
                ? jp.getSignature().toShortString()
                : rateLimit.key();

        RateLimiter limiter = limiters.computeIfAbsent(key,
                k -> RateLimiter.create(rateLimit.requestsPerSecond()));

        if (!limiter.tryAcquire()) {
            throw new TooManyRequestsException("Rate limit exceeded: " + key);
        }
        return jp.proceed();
    }
}

// 사용
@Service
public class ProductService {

    @RateLimit(requestsPerSecond = 20, key = "product.search")
    public List<Product> search(String keyword) { ... }
}
```

## @within() — 클래스 레벨 어노테이션으로 매칭

`@annotation`이 **메서드**에 붙은 어노테이션을 보는 반면, `@within`은 **클래스**에 붙은 어노테이션을 봅니다.

```java
// @Service가 붙은 클래스의 모든 메서드
@Pointcut("@within(org.springframework.stereotype.Service)")
void allServiceMethods() {}

// 커스텀 마커 어노테이션 + @within
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Monitored {}

@Aspect @Component
public class MonitorAspect {

    // @Monitored 클래스의 모든 public 메서드를 모니터링
    @Around("@within(com.example.annotation.Monitored) "
          + "&& execution(public * *(..))")
    public Object monitor(ProceedingJoinPoint jp) throws Throwable {
        // ...
    }
}

@Service
@Monitored       // 클래스 전체를 모니터링 대상으로 지정
public class CheckoutService { ... }
```

## args() — 런타임 파라미터 바인딩

`args`는 런타임에 실제 전달된 인자의 타입을 검사하고, 해당 인자를 Advice로 직접 바인딩합니다.

```java
@Aspect @Component
public class DomainEventAspect {

    // Long 타입 첫 인자를 'entityId'로 바인딩
    @Before("execution(* com.example.service.*.*(Long, ..)) "
          + "&& args(entityId, ..)")
    public void beforeWithLongId(Long entityId) {
        AuditContext.setCurrentEntityId(entityId);
    }

    // Command 타입 바인딩
    @AfterReturning(
        pointcut = "execution(* com.example..*.handle(..)) "
                 + "&& args(command)",
        returning = "result"
    )
    public void publishEvent(Object command, Object result) {
        if (command instanceof CreateOrderCommand c && result instanceof Order o) {
            eventBus.publish(new OrderCreatedEvent(o.getId(), c.getCustomerId()));
        }
    }
}
```

## bean() — Spring 전용 빈 이름 매칭

AspectJ에는 없는 Spring AOP 전용 지시자입니다. 빈 이름을 패턴으로 매칭합니다.

```java
// 특정 빈에만 적용
@Pointcut("bean(orderService)")
void orderServiceBean() {}

// 와일드카드 — 이름이 *Service로 끝나는 빈
@Pointcut("bean(*Service)")
void serviceNamedBeans() {}

// 제외: legacyOrderService 빈은 Aspect 미적용
@Pointcut("bean(*Service) && !bean(legacyOrderService)")
void modernServices() {}
```

## Pointcut 조합과 성능 최적화

복잡한 표현식은 단계적으로 좁혀가면 불필요한 프록시 호출을 줄일 수 있습니다.

```java
@Aspect @Component
public class CachingAspect {

    // 단계적 좁히기: 패키지 → 클래스 → 어노테이션
    // Spring은 왼쪽부터 평가하므로 빠른 조건을 앞에 배치
    @Pointcut(
        "within(com.example.service..*) "          // 1차: 패키지
        + "&& execution(public * *(..)) "          // 2차: 수식어
        + "&& @annotation(com.example.Cacheable)"  // 3차: 어노테이션
    )
    public void cacheableServiceMethod() {}

    // NOT 조합으로 특정 메서드 제외
    @Pointcut(
        "within(com.example.service..*) "
        + "&& !execution(* *internal*(..)) "    // internal 포함 메서드 제외
        + "&& !@annotation(com.example.NoCache)"
    )
    public void cachingTarget() {}
}
```

## 표현식 테스트: AspectJExpressionPointcut 직접 검증

```java
// 단위 테스트에서 표현식이 의도한 메서드를 매칭하는지 검증
@Test
void pointcutMatchesServiceMethods() throws Exception {
    AspectJExpressionPointcut pointcut = new AspectJExpressionPointcut();
    pointcut.setExpression(
        "execution(public * com.example.service..*.*(..))"
    );

    Method findAll = UserService.class.getMethod("findAll");
    Method hashCode = Object.class.getMethod("hashCode");

    assertThat(pointcut.matches(findAll, UserService.class)).isTrue();
    assertThat(pointcut.matches(hashCode, UserService.class)).isFalse();
}

// 특정 클래스 전체 메서드 확인
@Test
void withinMatchesAllMethodsInService() throws Exception {
    AspectJExpressionPointcut pc = new AspectJExpressionPointcut();
    pc.setExpression("within(com.example.service.OrderService)");

    for (Method method : OrderService.class.getDeclaredMethods()) {
        assertThat(pc.matches(method, OrderService.class)).isTrue();
    }
}
```

## 흔한 실수 모음

```java
// ❌ 잘못된 패키지 패턴 (com.example 직계 자식만 매칭, 하위 패키지 제외)
"within(com.example.service.*)"   // service.order.OrderService → 미매칭

// ✅ 하위 패키지 포함하려면 ..
"within(com.example.service..*)"

// ❌ private 메서드는 Spring AOP 프록시로 가로챌 수 없음
"execution(private * com.example..*.*(..))"  // 동작하지 않음

// ✅ public (또는 수식어 생략 = 모든 가시성, 단 프록시는 public만)
"execution(* com.example..*.*(..))"

// ❌ @annotation은 메서드 레벨만. 클래스 레벨 어노테이션을 보려면 @within
"@annotation(Service)"  // 의도: @Service 붙은 클래스 전체 → 동작 안 함

// ✅
"@within(org.springframework.stereotype.Service)"
```

## 핵심 정리

- `execution` — 가장 범용. 수식어·반환타입·클래스·메서드·파라미터 모두 제어
- `within` — 타입/패키지 단위 일괄 적용. `..`로 하위 패키지 포함
- `@annotation` — 메서드 어노테이션 매칭. 어노테이션 인스턴스를 파라미터로 바인딩
- `@within` — 클래스 어노테이션 매칭. `@annotation`의 클래스 버전
- `args` — 런타임 인자 타입 검사 + 파라미터 바인딩
- `bean` — Spring 전용. 빈 이름 와일드카드 매칭
- 조합 시 빠른 조건을 `&&` 왼쪽에 배치해 불필요한 평가 최소화
- `private` 메서드는 Spring AOP(프록시 기반)로 가로챌 수 없음

---

**지난 글:** [Spring AOP @Aspect 실전: Logging·성능·보안 Aspect 작성하기](/posts/spring-aop-aspect-practice/)

**다음 글:** [Spring AOP 실전 활용 사례: 로깅·트랜잭션·캐싱·보안을 AOP로 분리하기](/posts/spring-aop-usecases/)

<br>
읽어주셔서 감사합니다. 😊
