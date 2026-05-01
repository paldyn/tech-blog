---
title: "Spring AOP 프록시: JDK 동적 프록시 vs CGLIB 완전 정리"
description: "Spring AOP가 내부적으로 사용하는 두 가지 프록시 구현체—JDK 동적 프록시와 CGLIB—의 동작 원리, 생성 조건, 주의사항을 코드와 함께 깊이 있게 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "AOP", "Proxy", "CGLIB", "JDK Dynamic Proxy", "BeanPostProcessor"]
featured: false
draft: false
---

[지난 글](/posts/spring-aop-terms/)에서 Aspect, Advice, Pointcut 같은 AOP 핵심 용어를 정리했습니다. 이번에는 Spring AOP가 **실제로 어떻게** 동작하는지, 즉 프록시 객체가 어떻게 만들어지고 호출 스택에 끼어드는지를 살펴봅니다. 원리를 모르면 `@Transactional`이나 `@Async`가 왜 자기 클래스 내부 호출에서는 동작하지 않는지 이해할 수 없습니다.

## 프록시란 무엇인가

프록시(Proxy)는 원본 객체 앞에 위치해 호출을 가로채는 대리 객체입니다. Spring AOP의 프록시는 다음 역할을 합니다.

1. 호출자가 빈을 요청하면 원본 빈 대신 **프록시 빈**을 돌려줌
2. 메서드 호출이 프록시에 도착하면 등록된 Advice들을 순서대로 실행
3. 모든 Advice 처리 후 원본 메서드(`target.method()`)를 위임 호출

호출자 입장에서는 프록시가 있는지 없는지 알 수 없고, 타입 체계도 그대로 유지됩니다.

## Spring이 지원하는 두 가지 프록시 방식

![JDK 동적 프록시 vs CGLIB](/assets/posts/spring-aop-proxy-comparison.svg)

### JDK 동적 프록시 (java.lang.reflect.Proxy)

JDK 표준 라이브러리가 제공하는 방식입니다. 대상 클래스가 **인터페이스를 하나 이상 구현**해야 합니다. 런타임에 `java.lang.reflect.Proxy.newProxyInstance()`로 인터페이스를 구현하는 프록시 클래스를 동적으로 생성합니다.

```java
// JDK 동적 프록시 동작 원리 (이해용 직접 구현)
public class JdkProxyDemo {

    interface UserService {
        User findById(Long id);
    }

    static class UserServiceImpl implements UserService {
        @Override
        public User findById(Long id) { /* 실제 구현 */ return new User(id); }
    }

    public static void main(String[] args) {
        UserService target = new UserServiceImpl();

        UserService proxy = (UserService) Proxy.newProxyInstance(
            target.getClass().getClassLoader(),
            new Class[]{UserService.class},           // 구현할 인터페이스
            (proxyObj, method, methodArgs) -> {       // InvocationHandler
                System.out.println("Before: " + method.getName());
                Object result = method.invoke(target, methodArgs);
                System.out.println("After: " + method.getName());
                return result;
            }
        );

        proxy.findById(1L);
    }
}
```

`proxy`는 `UserService` 타입이지만 `UserServiceImpl`의 서브클래스는 아닙니다. 따라서 `UserServiceImpl proxy = context.getBean(UserServiceImpl.class);` 로 주입받으면 `ClassCastException`이 발생합니다.

### CGLIB (Code Generation Library)

CGLIB는 **바이트코드를 조작**해 대상 클래스의 서브클래스를 런타임에 생성합니다. 인터페이스 없이도 동작하고, 구체 클래스 타입으로 그대로 주입할 수 있습니다. Spring 3.2부터 spring-core에 번들링되어 별도 의존성이 필요 없습니다.

```java
// CGLIB 동작 원리 (이해용 직접 구현)
public class CglibProxyDemo {

    static class OrderService {          // 인터페이스 없음
        public Order place(OrderRequest req) {
            return new Order(req);
        }
    }

    public static void main(String[] args) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(OrderService.class);   // 서브클래스 생성 대상
        enhancer.setCallback((MethodInterceptor) (obj, method, methodArgs, proxy) -> {
            System.out.println("Before: " + method.getName());
            Object result = proxy.invokeSuper(obj, methodArgs);  // super 호출
            System.out.println("After: " + method.getName());
            return result;
        });

        OrderService proxy = (OrderService) enhancer.create();
        proxy.place(new OrderRequest());
    }
}
```

서브클래스이므로 `OrderService proxy = context.getBean(OrderService.class);` 주입이 정상 동작합니다. 단, `final` 클래스나 `final` 메서드는 상속/오버라이드 자체가 불가능해 프록시를 만들 수 없습니다.

## 프록시 생성 흐름

![Spring AOP 프록시 생성 흐름](/assets/posts/spring-aop-proxy-flow.svg)

Spring이 빈을 생성하는 과정에서 AOP 프록시는 `BeanPostProcessor`의 `postProcessAfterInitialization` 단계에서 만들어집니다. 이 역할을 하는 구현체가 `AnnotationAwareAspectJAutoProxyCreator`입니다.

```java
// AnnotationAwareAspectJAutoProxyCreator 내부 흐름 (의사코드)
public Object postProcessAfterInitialization(Object bean, String beanName) {
    // 이 빈에 적용할 Advisor(=Aspect)가 있는지 검사
    List<Advisor> advisors = findEligibleAdvisors(bean.getClass());
    if (advisors.isEmpty()) {
        return bean;                        // Advisor 없으면 원본 반환
    }

    // proxyTargetClass 설정 또는 인터페이스 유무로 방식 결정
    if (shouldProxyTargetClass(bean)) {
        return createCglibProxy(bean, advisors);
    } else {
        return createJdkProxy(bean, advisors);
    }
}
```

`@EnableAspectJAutoProxy`(또는 `spring-boot-autoconfigure`)가 이 BeanPostProcessor를 컨테이너에 등록합니다.

## 어떤 방식이 사용되는지 결정 규칙

```properties
# application.properties
# true → 항상 CGLIB (Spring Boot 기본값)
spring.aop.proxy-target-class=true

# false → 인터페이스가 있으면 JDK, 없으면 CGLIB
spring.aop.proxy-target-class=false
```

Spring Boot 2.0부터 `proxyTargetClass=true`가 기본값입니다. 이전에는 인터페이스가 있으면 JDK 프록시를 사용했지만, 구체 클래스로 주입하는 코드에서 ClassCastException이 빈번히 발생해 기본값이 변경되었습니다.

## 셀프 호출(Self-invocation) 문제

프록시의 가장 흔한 함정입니다.

```java
@Service
public class PaymentService {

    @Transactional
    public void process(PaymentRequest req) {
        validate(req);        // 내부 호출 — 프록시 거치지 않음!
        charge(req);
    }

    @Transactional(propagation = REQUIRES_NEW)
    public void validate(PaymentRequest req) {
        // 이 @Transactional은 process()에서 호출하면 무시됨
    }
}
```

`PaymentService`의 빈은 프록시지만, 프록시 안에서 `this.validate()`를 호출하면 프록시가 아닌 **원본 객체의 메서드**를 직접 호출합니다. 프록시를 거치지 않으므로 `@Transactional`이 적용되지 않습니다.

해결 방법은 두 가지입니다.

```java
// 방법 1: ApplicationContext에서 프록시를 다시 꺼내 호출
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final ApplicationContext ctx;

    @Transactional
    public void process(PaymentRequest req) {
        // 자기 자신의 프록시를 꺼내 호출
        ctx.getBean(PaymentService.class).validate(req);
        charge(req);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void validate(PaymentRequest req) { ... }
}

// 방법 2: 책임을 별도 빈으로 분리 (권장)
@Service
public class PaymentValidator {

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void validate(PaymentRequest req) { ... }
}
```

방법 2처럼 책임을 분리하는 것이 더 명확하고 테스트하기도 쉽습니다.

## CGLIB final 제약 해결 방법

```java
// 문제: final 클래스는 CGLIB 프록시 불가
@Service
public final class ReportService {       // ← final 때문에 오류 발생
    @Transactional
    public Report generate() { ... }
}

// 해결: final 제거
@Service
public class ReportService {
    @Transactional
    public Report generate() { ... }
}

// 또는 인터페이스 도입 + proxyTargetClass=false
public interface ReportService { Report generate(); }

@Service
public class ReportServiceImpl implements ReportService {
    @Override
    @Transactional
    public Report generate() { ... }
}
```

Spring Boot의 Kotlin 지원에서도 같은 문제가 생겼는데, Kotlin 클래스가 기본으로 `final`이기 때문입니다. `kotlin-spring` Gradle 플러그인이 AOP 대상 클래스를 자동으로 `open`으로 만들어 이를 해결합니다.

## 프록시 디버깅: 어떤 프록시가 사용됐는지 확인

```java
@RestController
@RequiredArgsConstructor
public class DebugController {

    private final UserService userService;

    @GetMapping("/debug/proxy")
    public String checkProxy() {
        // 실제 빈 클래스명에 "$$EnhancerBySpringCGLIB" 또는 "$Proxy" 포함
        return userService.getClass().getName();
        // CGLIB: com.example.UserServiceImpl$$EnhancerBySpringCGLIB$$...
        // JDK:  com.sun.proxy.$Proxy42
    }
}
```

## 핵심 정리

- Spring AOP 프록시는 `BeanPostProcessor`(정확히는 `AnnotationAwareAspectJAutoProxyCreator`)가 초기화 이후 단계에서 생성
- **JDK 동적 프록시**: 인터페이스 필요, 구체 클래스 타입 주입 불가
- **CGLIB**: 서브클래스 생성 방식, `final` 불가, Spring Boot 기본값
- **셀프 호출**: `this.method()` 형태로는 프록시를 거치지 않아 AOP가 무효화됨
- `proxyTargetClass=true`(CGLIB 강제)가 Spring Boot 2.0 이후 기본값

---

**지난 글:** [Spring AOP 용어: Aspect, Advice, JoinPoint, Pointcut 완전 정리](/posts/spring-aop-terms/)

**다음 글:** [Spring AOP @Aspect 실전: Logging·성능·보안 Aspect 작성하기](/posts/spring-aop-aspect-practice/)

<br>
읽어주셔서 감사합니다. 😊
