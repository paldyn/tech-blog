---
title: "IoC 컨테이너 — BeanFactory와 ApplicationContext"
description: "스프링 핵심인 IoC 컨테이너의 구조를 이해합니다. BeanFactory와 ApplicationContext의 차이, 주요 구현체, 부트스트랩 과정을 단계별로 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["spring", "ioc", "container", "beanfactory", "applicationcontext", "di"]
featured: false
draft: false
---

[지난 글](/posts/spring-dependency-management/)에서 Maven과 Gradle의 의존성 관리 전략을 살펴봤습니다. 이제부터는 스프링이 실제로 객체를 어떻게 생성하고 연결하는지, 그 중심에 있는 **IoC 컨테이너**를 파헤칩니다. 빈(Bean)을 이야기하기 전에 컨테이너를 먼저 이해해야 나머지가 자연스럽게 연결됩니다.

## IoC란 무엇인가

전통적인 자바 프로그램에서는 객체가 자신의 의존성을 `new` 키워드로 직접 생성했습니다.

```java
// 전통적인 방식: OrderService가 직접 의존성을 만든다
public class OrderService {
    private final DiscountPolicy policy = new RateDiscountPolicy(); // 강결합
    private final OrderRepository repo  = new JdbcOrderRepository(); // 강결합
}
```

이 방식의 문제는 `OrderService`가 `RateDiscountPolicy`와 `JdbcOrderRepository`에 **컴파일 타임**에 강하게 결합된다는 것입니다. 정책이나 저장소를 바꾸려면 `OrderService` 코드를 직접 수정해야 합니다.

**제어의 역전(Inversion of Control, IoC)**은 이 역할을 외부로 넘깁니다. 객체는 자신의 의존성을 요청하거나 만들지 않고, 외부(컨테이너)가 필요한 객체를 주입해 줍니다.

```java
// IoC 방식: 의존성을 생성자로 받는다 (DI)
public class OrderService {
    private final DiscountPolicy policy;
    private final OrderRepository repo;

    public OrderService(DiscountPolicy policy, OrderRepository repo) {
        this.policy = policy;
        this.repo   = repo;
    }
}
```

`OrderService`는 이제 구체 클래스를 전혀 모릅니다. 어떤 구현체를 넣을지 결정하는 것은 외부 컨테이너의 책임입니다.

## 스프링 IoC 컨테이너의 두 축

스프링은 IoC 컨테이너를 두 인터페이스 계층으로 설계했습니다.

![IoC 컨테이너 인터페이스 계층 구조](/assets/posts/spring-ioc-container-architecture.svg)

### BeanFactory

`org.springframework.beans.factory.BeanFactory`는 컨테이너 계층의 최상위 인터페이스입니다. 핵심 메서드는 다음과 같습니다.

| 메서드 | 설명 |
|--------|------|
| `getBean(String name)` | 이름으로 빈 조회 |
| `getBean(Class<T> type)` | 타입으로 빈 조회 |
| `containsBean(String name)` | 빈 존재 여부 확인 |
| `isSingleton(String name)` | 싱글톤 여부 확인 |

`BeanFactory`는 **지연 초기화(Lazy Initialization)**를 기본으로 합니다. `getBean()`을 호출하는 시점에 비로소 빈이 생성됩니다. 메모리가 극도로 제한된 임베디드 환경 외에는 직접 사용할 일이 거의 없습니다.

### ApplicationContext

`org.springframework.context.ApplicationContext`는 `BeanFactory`를 확장하여 실무에 필요한 기능을 더한 인터페이스입니다.

- **Eager Initialization**: 컨테이너 시작 시 모든 싱글톤 빈을 미리 인스턴스화합니다. 기동 오류를 즉시 발견할 수 있습니다.
- **ApplicationEvent**: 이벤트 발행·구독 메커니즘을 제공합니다.
- **MessageSource**: 다국어(i18n) 메시지 리소스를 처리합니다.
- **Environment**: 프로파일과 프로퍼티 소스를 통합 관리합니다.
- **Resource**: classpath, 파일 시스템, URL 등 다양한 소스에서 리소스를 로드합니다.

실무에서는 항상 `ApplicationContext`를 사용합니다. `BeanFactory`를 직접 다루는 경우는 프레임워크 내부 구현이나 극히 특수한 시나리오에 한정됩니다.

## 주요 구현체

| 구현체 | 설명 |
|--------|------|
| `ClassPathXmlApplicationContext` | classpath의 XML 파일로 컨테이너 구성 |
| `FileSystemXmlApplicationContext` | 파일 시스템 경로의 XML 파일로 컨테이너 구성 |
| `AnnotationConfigApplicationContext` | `@Configuration` 자바 클래스로 컨테이너 구성 |
| `AnnotationConfigWebApplicationContext` | 웹 환경에서 자바 설정 사용 |
| `AnnotationConfigServletWebServerApplicationContext` | Spring Boot 내장 서버 환경에서 사용 |

Spring Boot를 사용한다면 `SpringApplication.run()`이 내부적으로 적절한 구현체를 자동 선택합니다. 직접 구현체를 생성할 필요가 없습니다.

## 컨테이너 부트스트랩 — refresh()

ApplicationContext를 생성하거나 `refresh()`를 호출하면 컨테이너는 다음 다섯 단계를 순서대로 실행합니다.

![ApplicationContext 부트스트랩 단계](/assets/posts/spring-ioc-container-bootstrap.svg)

1. **설정 소스 로드**: XML 파일, `@Configuration` 클래스, 컴포넌트 스캔 결과를 수집합니다.
2. **BeanDefinition 파싱·등록**: 수집한 설정을 `BeanDefinition` 객체로 변환해 `BeanDefinitionRegistry`에 등록합니다.
3. **BeanFactoryPostProcessor 실행**: `PropertySourcesPlaceholderConfigurer` 등이 `${...}` 플레이스홀더를 실제 값으로 치환합니다.
4. **싱글톤 빈 인스턴스화 & DI**: 빈을 인스턴스화하고 의존성을 주입합니다. `BeanPostProcessor`와 `@PostConstruct`가 이 시점에 실행됩니다.
5. **ApplicationContext Ready**: `ContextRefreshedEvent`를 발행하고 컨테이너가 사용 가능한 상태가 됩니다.

## ApplicationContext 생성과 빈 조회

```java
// XML 설정으로 컨테이너 생성
ApplicationContext ctx =
    new ClassPathXmlApplicationContext("applicationContext.xml");

// Java Config으로 컨테이너 생성 (현대적 방식)
ApplicationContext ctx =
    new AnnotationConfigApplicationContext(AppConfig.class);

// 타입으로 빈 조회 — 가장 안전한 방법
OrderService orderService = ctx.getBean(OrderService.class);

// 이름 + 타입으로 조회 — 동일 타입 빈이 여러 개일 때 사용
OrderService orderService =
    ctx.getBean("orderService", OrderService.class);

// 컨테이너 닫기 (destroy 메서드, @PreDestroy 실행)
((ConfigurableApplicationContext) ctx).close();
```

`getBean()`은 타입을 지정하는 단일 인수 버전이 가장 깔끔합니다. 같은 타입의 빈이 두 개 이상 등록됐을 때만 이름을 추가로 지정합니다.

## 계층 컨테이너 — parent/child

Spring MVC 환경에서는 루트 컨테이너(서비스·리포지토리)와 DispatcherServlet 컨테이너(컨트롤러)가 **부모-자식 관계**로 구성됩니다. 자식 컨테이너는 부모 빈을 참조할 수 있지만, 부모는 자식 빈을 볼 수 없습니다.

```java
// 자식 컨테이너에 부모 지정
AnnotationConfigApplicationContext child =
    new AnnotationConfigApplicationContext();
child.setParent(parentCtx);
child.register(WebConfig.class);
child.refresh();
```

Spring Boot는 단일 컨테이너로 구성되므로 이 패턴을 직접 다룰 일은 드뭅니다.

## 정리

- `BeanFactory`는 기본 DI 컨테이너, `ApplicationContext`는 엔터프라이즈 기능을 더한 확장판입니다.
- 실무에서는 항상 `ApplicationContext`를 사용합니다.
- `refresh()`가 호출될 때 5단계 부트스트랩이 실행되며, 이 과정에서 빈 정의 파싱 → BeanFactoryPostProcessor → 빈 인스턴스화 순서로 진행됩니다.
- Spring Boot는 구현체 선택과 `refresh()` 호출을 자동으로 처리합니다.

---

**다음 글:** [XML로 빈 설정하기 — \<bean\> 태그 완전 정복](/posts/spring-bean-xml-config/)

<br>
읽어주셔서 감사합니다. 😊
