---
title: "BeanPostProcessor: Spring 확장 포인트의 핵심"
description: "BeanPostProcessor가 빈 생명주기 어느 지점에 끼어드는지, Spring이 내부적으로 어떻게 활용하는지, 그리고 커스텀 BPP를 직접 작성하는 방법을 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "BeanPostProcessor", "AOP", "Proxy", "Extension"]
featured: false
draft: false
---

[지난 글](/posts/spring-bean-lifecycle/)에서 빈이 태어나고 사라지는 7단계 생명주기를 살펴봤습니다. 그 과정의 3번째와 5번째 자리에 조용히 앉아 있는 존재가 바로 `BeanPostProcessor`입니다. Spring AOP, `@Autowired`, `@PostConstruct` 지원이 모두 이 인터페이스를 통해 구현되어 있기 때문에, BPP를 이해하면 Spring 내부가 어떻게 돌아가는지 절반은 파악한 셈입니다.

## BeanPostProcessor 인터페이스

인터페이스 자체는 단 두 개의 메서드로 이루어져 있습니다.

```java
public interface BeanPostProcessor {

    // 초기화 콜백(@PostConstruct 등) 실행 전
    default Object postProcessBeforeInitialization(
            Object bean, String beanName) {
        return bean;
    }

    // 초기화 콜백 실행 후 (AOP 프록시 생성 지점)
    default Object postProcessAfterInitialization(
            Object bean, String beanName) {
        return bean;
    }
}
```

두 메서드 모두 `default` 구현이 있어서 필요한 쪽만 오버라이드해도 됩니다. **반환값은 반드시 null이 아닌 객체**여야 합니다. null을 반환하면 컨테이너가 해당 빈을 제거합니다.

## 생명주기 속 BPP 위치

![BeanPostProcessor의 위치 — 빈 생명주기 7단계](/assets/posts/spring-bean-postprocessor-lifecycle.svg)

두 콜백이 정확히 어디에 위치하는지 보면 전략이 명확해집니다.

- **Before**: 인스턴스화·주입이 끝난 뒤, 초기화 콜백이 실행되기 **전**. 어노테이션 등록, 필드 검증에 적합합니다.
- **After**: 초기화 콜백이 모두 완료된 **후**. AOP 프록시 생성처럼 빈을 다른 객체로 교체해야 할 때 사용합니다.

## Spring이 사용하는 내장 BPP

`spring-context` 모듈만 임포트해도 아래 BPP들이 자동 등록됩니다.

| 내장 BPP | 하는 일 |
|---|---|
| `AutowiredAnnotationBeanPostProcessor` | `@Autowired`, `@Value`, `@Inject` 처리 |
| `CommonAnnotationBeanPostProcessor` | `@PostConstruct`, `@PreDestroy`, `@Resource` 처리 |
| `AbstractAutoProxyCreator` (서브클래스) | AOP 어드바이스 적용 → 프록시 객체로 빈 교체 |
| `PersistenceAnnotationBeanPostProcessor` | `@PersistenceContext`, `@PersistenceUnit` 처리 |

`@Autowired`가 "그냥 되는" 이유는 `AutowiredAnnotationBeanPostProcessor`가 **Before** 단계에서 필드를 스캔해 의존성을 주입해주기 때문입니다.

## 커스텀 BPP 작성

![BPP 처리 흐름과 구현 규칙](/assets/posts/spring-bean-postprocessor-chain.svg)

### 빈 초기화 시간 측정 BPP

```java
@Component
public class TimingBeanPostProcessor
        implements BeanPostProcessor {

    private final Map<String, Long> starts =
            new ConcurrentHashMap<>();

    @Override
    public Object postProcessBeforeInitialization(
            Object bean, String beanName) {
        starts.put(beanName, System.nanoTime());
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(
            Object bean, String beanName) {
        Long start = starts.remove(beanName);
        if (start != null) {
            long ms = (System.nanoTime() - start) / 1_000_000;
            if (ms > 100) {
                System.out.printf("[SLOW INIT] %s took %dms%n",
                        beanName, ms);
            }
        }
        return bean;
    }
}
```

BPP를 빈으로 등록하기만 하면(`@Component` 또는 `@Bean`) Spring이 자동으로 찾아 체인에 추가합니다. 별도 등록 코드가 필요 없습니다.

### 특정 인터페이스에 자동으로 래퍼 적용

```java
@Component
public class AuditProxyBeanPostProcessor
        implements BeanPostProcessor {

    @Override
    public Object postProcessAfterInitialization(
            Object bean, String beanName) {
        if (bean instanceof AuditTarget target) {
            return new AuditingWrapper(target); // 프록시로 교체
        }
        return bean;
    }
}
```

반환 타입이 달라질 수 있으므로 주입 받는 쪽이 인터페이스 타입으로 선언되어 있어야 합니다.

## BPP 순서 제어

여러 BPP가 등록된 경우 `@Order` 또는 `Ordered` 인터페이스로 실행 순서를 지정합니다.

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE) // 가장 먼저 실행
public class FirstBPP implements BeanPostProcessor {
    // ...
}

@Component
@Order(100)
public class SecondBPP implements BeanPostProcessor {
    // ...
}
```

Before 체인은 Order 오름차순, After 체인도 동일한 오름차순으로 실행됩니다. 숫자가 낮을수록 먼저 실행됩니다.

## BPP 자신은 BPP의 영향을 받지 않는다

중요한 함정이 하나 있습니다. BPP 빈 자체는 다른 BPP의 After 단계를 거치지 않고 **일찍 초기화**됩니다.

```
ApplicationContext 초기화 순서:
1. BeanPostProcessor 빈들을 먼저 모두 생성 (BPP 체인 없이)
2. 일반 빈들을 생성하면서 BPP 체인 적용
```

따라서 BPP 클래스에 `@Transactional`, `@Async`, `@Cacheable` 같은 AOP 어노테이션을 달아도 효과가 없습니다. Spring이 경고 로그를 남기기도 합니다.

## InstantiationAwareBeanPostProcessor

`BeanPostProcessor`를 확장한 서브 인터페이스로, **인스턴스화 이전**에도 개입할 수 있습니다.

```java
public interface InstantiationAwareBeanPostProcessor
        extends BeanPostProcessor {

    // 인스턴스화 전 — null 반환 시 생성 건너뜀
    Object postProcessBeforeInstantiation(
            Class<?> beanClass, String beanName);

    // 인스턴스화 후, 의존성 주입 전
    boolean postProcessAfterInstantiation(
            Object bean, String beanName);

    // 프로퍼티 주입 처리
    PropertyValues postProcessProperties(
            PropertyValues pvs, Object bean, String beanName);
}
```

`AbstractAutoProxyCreator`가 이 인터페이스를 구현합니다. 일반 커스텀 BPP는 대부분 `BeanPostProcessor` 만으로 충분합니다.

## 실무 활용 사례

BPP가 실제 프로덕션 코드에서 쓰이는 대표 상황입니다.

```java
// 커스텀 어노테이션 처리기
@Component
public class RetryAnnotationBPP implements BeanPostProcessor {

    @Override
    public Object postProcessAfterInitialization(
            Object bean, String beanName) {
        // 클래스 또는 메서드에 @Retry가 있으면 프록시 적용
        if (hasRetryAnnotation(bean.getClass())) {
            return RetryProxyFactory.wrap(bean);
        }
        return bean;
    }

    private boolean hasRetryAnnotation(Class<?> clazz) {
        return clazz.isAnnotationPresent(Retry.class) ||
               Arrays.stream(clazz.getMethods())
                     .anyMatch(m -> m.isAnnotationPresent(Retry.class));
    }
}
```

이 패턴은 Spring Retry, Spring Cache, Spring Transaction 모두가 사용하는 표준 방식입니다.

## 핵심 정리

- **Before 콜백**: 초기화 이전에 어노테이션 처리, 검증, 설정에 사용
- **After 콜백**: 초기화 이후에 프록시 교체, 래퍼 적용에 사용
- **null 반환 금지**: 컨테이너에서 빈이 삭제되는 치명적 버그
- **BPP 자신은 AOP 대상 외**: `@Transactional`·`@Async` 적용 불가
- **@Order**: 여러 BPP의 실행 순서를 명시적으로 제어

---

**지난 글:** [Spring Bean 생명주기: 초기화부터 소멸까지 완전 분석](/posts/spring-bean-lifecycle/)

**다음 글:** [Spring Property 외부화: @Value부터 Environment까지](/posts/spring-property-externalization/)

<br>
읽어주셔서 감사합니다. 😊
