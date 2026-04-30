---
title: "Spring AOP 용어: Aspect, Advice, JoinPoint, Pointcut 완전 정리"
description: "Spring AOP에서 사용하는 핵심 용어 5가지를 코드 예제와 함께 명확하게 정리합니다. Aspect·JoinPoint·Pointcut·Advice·Weaving의 정의와 관계, 그리고 @Before/@After/@Around 등 Advice 타입별 사용법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "AOP", "Aspect", "Advice", "Pointcut", "JoinPoint"]
featured: false
draft: false
---

[지난 글](/posts/spring-aop-concept/)에서 AOP가 왜 필요한지, 그리고 Spring이 프록시로 어떻게 구현하는지 살펴봤습니다. 이번에는 AOP 코드를 읽고 쓸 때 반드시 알아야 하는 **5가지 핵심 용어**를 정확히 정리합니다. 처음에는 비슷비슷해 보이는 단어들이지만, 각각의 역할이 명확하게 구분됩니다.

## 5가지 핵심 용어

![AOP 핵심 용어 개요](/assets/posts/spring-aop-terms-overview.svg)

### JoinPoint — 개입 가능한 지점

프로그램 실행 중 Advice를 삽입할 수 있는 지점입니다. Spring AOP는 **메서드 실행**만을 JoinPoint로 인식합니다. AspectJ는 필드 접근, 생성자 호출, 예외 처리 등 더 다양한 JoinPoint를 지원하지만 Spring AOP에서는 메서드 실행에만 집중합니다.

```java
@Around("servicePointcut()")
public Object doAround(ProceedingJoinPoint jp) throws Throwable {
    // JoinPoint 정보 접근
    String method = jp.getSignature().getName();       // 메서드 이름
    Object[] args = jp.getArgs();                      // 인자
    Object target = jp.getTarget();                    // 대상 객체
    Class<?> type = jp.getTarget().getClass();         // 대상 클래스
    return jp.proceed();                               // 원본 메서드 실행
}
```

### Pointcut — 어디에 적용할지

JoinPoint 중에서 **어느 것에 Advice를 적용할지** 결정하는 서술 표현식입니다. "com.example 패키지 하위의 모든 public 메서드"처럼 패턴으로 지정합니다.

```java
@Aspect
@Component
public class LoggingAspect {

    // Pointcut 재사용을 위한 선언
    @Pointcut("execution(public * com.example.service.*.*(..))")
    public void serviceLayer() {}

    // 어노테이션으로 매칭
    @Pointcut("@annotation(com.example.annotation.Loggable)")
    public void loggableMethods() {}

    // 두 Pointcut 조합
    @Pointcut("serviceLayer() || loggableMethods()")
    public void logTarget() {}
}
```

자주 쓰는 Pointcut 지시자:
- `execution(...)` — 메서드 실행 패턴
- `@annotation(...)` — 특정 어노테이션이 붙은 메서드
- `within(...)` — 특정 타입/패키지 내 모든 메서드
- `@within(...)` — 특정 어노테이션이 붙은 클래스의 메서드
- `args(...)` — 특정 타입 인자를 받는 메서드

### Advice — 무엇을 실행할지

Pointcut이 매칭한 JoinPoint에서 **실제로 실행되는 코드**입니다. Advice의 종류에 따라 메서드 실행 전, 후, 또는 전후 모두에서 동작합니다.

### Aspect — Pointcut + Advice의 묶음

하나의 횡단 관심사를 표현하는 **모듈**입니다. `@Aspect` 어노테이션을 달고 Pointcut과 Advice를 함께 정의합니다.

```java
@Aspect
@Component
public class ExecutionTimeAspect {  // ← Aspect

    @Pointcut("within(@org.springframework.stereotype.Service *)")
    public void serviceBean() {}     // ← Pointcut

    @Around("serviceBean()")
    public Object measure(ProceedingJoinPoint jp) throws Throwable {
        // ↑ Advice
        long start = System.nanoTime();
        try {
            return jp.proceed();
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            System.out.printf("[%s] %dms%n",
                    jp.getSignature().toShortString(), ms);
        }
    }
}
```

### Weaving — Aspect를 코드에 결합하는 과정

Aspect를 대상 객체에 적용해 프록시를 만드는 행위입니다. Spring AOP는 **런타임 위빙**을 사용합니다. ApplicationContext가 초기화될 때 BeanPostProcessor의 After 단계에서 해당 빈을 프록시 객체로 교체합니다.

## Advice 타입 5가지

![Advice 타입 5가지](/assets/posts/spring-aop-terms-advice-types.svg)

### @Before — 메서드 실행 전

```java
@Before("execution(* com.example.service.*.*(..))")
public void checkAuthentication(JoinPoint jp) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
        throw new AccessDeniedException("인증되지 않은 요청");
    }
}
```

메서드 실행을 막으려면 예외를 던집니다. `JoinPoint`를 통해 인자·대상 객체 정보에 접근할 수 있습니다.

### @AfterReturning — 정상 반환 후

```java
@AfterReturning(
    pointcut = "execution(* com.example.service.OrderService.place*(..))",
    returning = "result")
public void auditOrder(Object result) {
    if (result instanceof Order order) {
        auditLog.record("ORDER_PLACED", order.getId());
    }
}
```

`returning` 속성으로 반환값을 파라미터로 받을 수 있습니다. 반환값을 **변경할 수는 없습니다**. 변경이 필요하면 `@Around`를 씁니다.

### @AfterThrowing — 예외 발생 후

```java
@AfterThrowing(
    pointcut = "execution(* com.example..*.*(..))",
    throwing = "ex")
public void handleException(JoinPoint jp, RuntimeException ex) {
    String method = jp.getSignature().toShortString();
    alertService.send(method + " 오류: " + ex.getMessage());
}
```

`throwing` 속성의 타입을 좁히면 해당 타입의 예외만 매칭됩니다. 예외를 삼킬 수는 없고 다른 예외로 교체하려면 `@Around`가 필요합니다.

### @After — 항상 실행 (finally)

```java
@After("serviceLayer()")
public void releaseResource(JoinPoint jp) {
    // 정상 반환이든 예외든 반드시 실행
    // try-finally와 동일한 의미
    threadLocalStore.remove();
}
```

정상 종료와 예외 종료 모두에서 실행됩니다. Java의 `finally` 블록과 같습니다.

### @Around — 가장 강력한 Advice

```java
@Around("@annotation(com.example.annotation.Retry)")
public Object retry(ProceedingJoinPoint jp) throws Throwable {
    int maxAttempts = 3;
    Throwable lastError = null;
    for (int i = 0; i < maxAttempts; i++) {
        try {
            return jp.proceed();    // 원본 메서드 실행
        } catch (TransientException e) {
            lastError = e;
            Thread.sleep(100L * (i + 1));
        }
    }
    throw lastError;
}
```

`ProceedingJoinPoint.proceed()`를 호출해야 원본 메서드가 실행됩니다. 호출하지 않으면 원본 메서드가 **실행되지 않으므로** 주의가 필요합니다. 반환값을 변경하거나, 인자를 수정한 뒤 `proceed(newArgs)`를 호출하는 것도 가능합니다.

## Pointcut 표현식 상세

```java
// execution 지시자 구조
// execution([수식어] 반환타입 [클래스.]메서드명(인자) [throws 예외])

execution(public * *(..))            // 모든 public 메서드
execution(* com.example..*.*(..))    // com.example 하위 모든 메서드
execution(* *Service.find*(..))      // Service로 끝나는 클래스의 find로 시작하는 메서드
execution(* *(String, ..))           // 첫 번째 인자가 String인 메서드

// @annotation: 어노테이션 매칭
@annotation(org.springframework.transaction.annotation.Transactional)

// within: 타입 내 메서드
within(com.example.service.*)        // service 패키지 내 모든 타입
within(com.example..*)               // example 하위 모든 패키지

// 논리 연산자
execution(* place*(..)) && within(com.example.service.*)
execution(* delete*(..)) || execution(* remove*(..))
!@within(org.springframework.stereotype.Repository)
```

## @Pointcut 재사용과 조합

Pointcut 표현식을 메서드로 선언하면 여러 Advice에서 재사용할 수 있습니다.

```java
@Aspect
@Component
public class CommonPointcuts {

    @Pointcut("within(com.example.web..*)")
    public void inWebLayer() {}

    @Pointcut("within(com.example.service..*)")
    public void inServiceLayer() {}

    @Pointcut("within(com.example.repository..*)")
    public void inDataLayer() {}
}

@Aspect
@Component
public class TransactionAspect {

    @Around("com.example.aop.CommonPointcuts.inServiceLayer()")
    public Object manageTransaction(ProceedingJoinPoint jp) throws Throwable {
        // 서비스 레이어 전체에 트랜잭션 적용
        return jp.proceed();
    }
}
```

공통 Pointcut을 별도 클래스(`CommonPointcuts`)에 모아두면 전체 AOP 구성을 한 눈에 파악할 수 있습니다.

## 핵심 정리

- **JoinPoint**: Advice가 실행될 수 있는 시점 (Spring AOP = 메서드 실행)
- **Pointcut**: 어느 JoinPoint에 적용할지 결정하는 표현식
- **Advice**: 실제 실행되는 코드. 5가지 타입 (`@Before`, `@After`, `@AfterReturning`, `@AfterThrowing`, `@Around`)
- **Aspect**: Pointcut + Advice를 묶은 모듈 (`@Aspect`)
- **Weaving**: Aspect를 대상 빈에 결합하는 과정 (Spring = 런타임 프록시)
- **@Around 주의**: `proceed()` 누락 시 원본 메서드 미실행

---

**지난 글:** [Spring AOP 개념: 횡단 관심사를 분리하는 방법](/posts/spring-aop-concept/)

<br>
읽어주셔서 감사합니다. 😊
