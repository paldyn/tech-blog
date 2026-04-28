---
title: "컴포넌트 스캔 — @ComponentScan과 스테레오타입 어노테이션"
description: "스프링 컴포넌트 스캔의 동작 원리를 이해합니다. @ComponentScan의 basePackages 설정, 스테레오타입 어노테이션(@Service/@Repository/@Controller), includeFilters/excludeFilters 필터 옵션을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["spring", "component-scan", "component", "service", "repository", "controller", "stereotype"]
featured: false
draft: false
---

[지난 글](/posts/spring-bean-java-config/)에서 `@Configuration`과 `@Bean`으로 자바 코드로 빈을 명시적으로 등록하는 방법을 배웠습니다. 빈이 수십, 수백 개가 되면 매번 `@Bean` 메서드를 작성하는 것은 번거롭습니다. 스프링의 **컴포넌트 스캔**은 특정 어노테이션이 붙은 클래스를 자동으로 찾아 빈으로 등록해 이 문제를 해결합니다.

## 컴포넌트 스캔이란

`@ComponentScan`을 선언하면 스프링은 지정한 패키지와 그 하위 패키지를 탐색하여 `@Component` 계열 어노테이션이 붙은 클래스를 모두 찾아 BeanDefinition으로 등록합니다.

![컴포넌트 스캔 동작 과정](/assets/posts/spring-component-scan-flow.svg)

```java
@Configuration
@ComponentScan(basePackages = "com.example")
public class AppConfig {
    // @Bean 메서드 없이 스캔으로 빈 자동 등록
}
```

`basePackages`를 생략하면 `@ComponentScan`이 선언된 클래스의 패키지를 기준으로 스캔합니다. Spring Boot에서 `@SpringBootApplication`이 바로 이 방식을 쓰기 때문에, 메인 클래스를 루트 패키지에 두는 것이 관례입니다.

## 스테레오타입 어노테이션

`@Component`는 모든 스캔 대상의 부모 어노테이션입니다. 레이어 역할을 표현하는 세 가지 특화 어노테이션이 있습니다.

| 어노테이션 | 레이어 | 추가 기능 |
|------------|--------|----------|
| `@Component` | 범용 | 없음 |
| `@Service` | 비즈니스 로직 | `@Component` 확장 (기능 동일) |
| `@Repository` | 데이터 접근 | `PersistenceExceptionTranslationPostProcessor`와 연동해 DB 예외를 스프링 `DataAccessException`으로 변환 |
| `@Controller` | 웹 요청 처리 | `DispatcherServlet`이 요청 매핑 후보로 인식 |
| `@RestController` | REST API | `@Controller` + `@ResponseBody` 합성 |

어노테이션 내부를 보면 `@Service`, `@Repository`, `@Controller` 모두 `@Component`를 메타 어노테이션으로 갖고 있습니다. 기능적으로는 동일하게 빈으로 등록되지만, 레이어 의도를 명시적으로 표현하고 AOP 포인트컷 등에서 구분 근거가 됩니다.

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final DiscountPolicy discountPolicy;

    // 생성자가 하나면 @Autowired 생략 가능 (Spring 4.3+)
    public OrderService(
            OrderRepository orderRepository,
            DiscountPolicy discountPolicy) {
        this.orderRepository = orderRepository;
        this.discountPolicy  = discountPolicy;
    }

    public Order createOrder(String itemId, int price) {
        int discountedPrice = discountPolicy.discount(price);
        return orderRepository.save(
            new Order(itemId, discountedPrice));
    }
}
```

```java
@Repository
public class JdbcOrderRepository implements OrderRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcOrderRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Order save(Order order) {
        // JDBC 예외 → DataAccessException 자동 변환
        jdbcTemplate.update("INSERT INTO orders ...", order.getItemId());
        return order;
    }
}
```

## 빈 이름 자동 결정

클래스 이름의 첫 글자를 소문자로 바꾼 것이 기본 빈 이름입니다.

```
OrderService    → orderService
JdbcOrderRepository → jdbcOrderRepository
RateDiscountPolicy  → rateDiscountPolicy
```

이름을 직접 지정하려면 어노테이션에 값을 넣습니다.

```java
@Service("paymentService")   // 이름: paymentService
public class PaymentServiceImpl implements PaymentService { ... }
```

## basePackages vs basePackageClasses

```java
// 문자열 방식 — 리팩터링 시 누락 위험
@ComponentScan(basePackages = "com.example.order")

// 클래스 방식 — 타입 안전, 리팩터링 추적 가능 (권장)
@ComponentScan(basePackageClasses = OrderService.class)
```

`basePackageClasses`에 마커 인터페이스나 마커 클래스를 별도로 만들어 두는 패턴도 있습니다.

```java
// 마커 클래스 패턴
package com.example.order;
public final class OrderPackageMarker { private OrderPackageMarker() {} }

@ComponentScan(basePackageClasses = OrderPackageMarker.class)
```

## includeFilters / excludeFilters

기본 스캔 동작을 필터로 세밀하게 조정할 수 있습니다.

![@ComponentScan 필터 옵션](/assets/posts/spring-component-scan-filters.svg)

### 자주 쓰는 패턴

```java
@ComponentScan(
    basePackages = "com.example",
    // 기본 @Component 계열 비활성화 후 수동으로만 포함
    useDefaultFilters = false,
    includeFilters = @Filter(
        type    = FilterType.ANNOTATION,
        classes = MyCustomAnnotation.class
    ),
    excludeFilters = {
        // 테스트 전용 클래스 제외
        @Filter(type = FilterType.REGEX,
                pattern = ".*Test.*"),
        // 특정 설정 클래스 제외
        @Filter(type = FilterType.ASSIGNABLE_TYPE,
                classes = LegacyConfig.class)
    }
)
```

Spring Boot 테스트에서 `@SpringBootApplication`의 컴포넌트 스캔에서 특정 설정을 제외할 때 `excludeFilters`가 유용합니다.

## @ComponentScan 없이 빈 등록

XML 설정에서도 컴포넌트 스캔을 켤 수 있습니다.

```xml
<context:component-scan base-package="com.example"/>
```

이 태그는 `<context:annotation-config/>`도 내포하므로, `@Autowired`, `@PostConstruct` 등 어노테이션 처리기를 별도로 선언할 필요가 없습니다.

## 스캔 범위와 성능

스캔 범위가 넓을수록 기동 시간이 늘어납니다. 루트 패키지를 지정하면 불필요한 서드파티 라이브러리까지 탐색할 수 있습니다.

```java
// 너무 넓음 — 기동 느려질 수 있음
@ComponentScan("com")

// 적절한 범위
@ComponentScan("com.example.myapp")
```

Spring Boot에서는 메인 클래스를 `com.example.myapp` 루트에 두면 그 하위만 스캔됩니다. 외부 라이브러리 빈은 `@Bean`이나 `@Import`로 명시적으로 등록합니다.

## 정리

- `@ComponentScan`은 패키지를 탐색해 `@Component` 계열 클래스를 자동으로 빈으로 등록합니다.
- `@Service`, `@Repository`, `@Controller`는 레이어 의도를 표현하는 `@Component` 확장 어노테이션입니다. `@Repository`는 DB 예외 변환 기능이 추가됩니다.
- 빈 이름은 클래스명 첫 글자 소문자 변환이 기본이며, 어노테이션 값으로 직접 지정할 수 있습니다.
- `includeFilters`/`excludeFilters`로 스캔 대상을 세밀하게 제어합니다.
- Spring Boot의 `@SpringBootApplication`에는 `@ComponentScan`이 내포돼 있어 별도 선언이 필요 없습니다.

---

**지난 글:** [자바로 빈 설정하기 — @Configuration과 @Bean](/posts/spring-bean-java-config/)

<br>
읽어주셔서 감사합니다. 😊
