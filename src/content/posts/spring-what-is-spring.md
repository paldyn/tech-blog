---
title: "Spring Framework란 무엇인가 — 탄생 배경부터 핵심 철학까지"
description: "EJB의 복잡성을 해결하기 위해 탄생한 Spring Framework의 정의, POJO 기반 개발 철학, IoC/AOP/PSA 3대 원칙을 체계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "Spring Framework", "IoC", "AOP", "POJO", "Java"]
featured: false
draft: false
---

Java 엔터프라이즈 개발의 역사는 "어떻게 하면 더 단순하게 만들 수 있을까"라는 질문과 함께 흘러왔습니다. Spring Framework는 그 질문에 대한 가장 성공적인 답변 중 하나로, 오늘날 전 세계 수백만 개의 Java 애플리케이션을 지탱하는 기반이 되었습니다. 이 시리즈 첫 글에서는 Spring이 왜 탄생했는지, 어떤 철학으로 설계되었는지를 코드 수준에서 이해합니다.

## Spring Framework란

Spring Framework는 2003년 Rod Johnson이 출판한 저서 *Expert One-on-One J2EE Design and Development*에 포함된 코드에서 시작된 오픈소스 Java 애플리케이션 프레임워크입니다. EJB(Enterprise JavaBeans)가 지배하던 J2EE 생태계의 복잡성과 무거움에 대한 반성에서 출발했습니다.

Spring의 공식 정의는 간결합니다. "Java 플랫폼을 위한 포괄적인 프로그래밍 및 구성 모델(comprehensive programming and configuration model)" — 즉, **어떻게 코드를 구성하고, 객체를 연결하고, 인프라 관심사를 처리할지**에 대한 체계적인 방법론을 제공합니다.

![Spring Framework 개요](/assets/posts/spring-what-is-spring-overview.svg)

## EJB의 문제, Spring의 등장

2000년대 초 J2EE 표준의 핵심이었던 EJB 2.x는 이론적으로는 훌륭했지만 실전에서는 다음과 같은 심각한 문제를 안고 있었습니다.

- **침투적 설계(Invasive Design)**: `EntityBean`, `SessionBean` 등 EJB 특정 클래스를 반드시 상속해야 해서 비즈니스 코드와 프레임워크 코드가 뒤섞임
- **무거운 환경 의존**: WAS(WebLogic, WebSphere 등)를 띄워야만 테스트 가능
- **배포 복잡성**: `ejb-jar.xml` 등 XML 디스크립터를 작성해야 하는 번거로움
- **단위 테스트 불가**: 컨테이너 없이 개별 클래스를 테스트할 방법이 없음

Spring은 이 문제를 **"컨테이너 밖에서도 동작하는 순수 자바 코드"**, 즉 POJO(Plain Old Java Object) 기반 개발로 해결했습니다.

## POJO 기반 개발 철학

POJO는 별다른 마법이 없는 개념입니다. 특정 인터페이스를 구현하거나 특정 클래스를 상속하지 않는, 순수한 자바 객체를 말합니다.

```java
// Spring POJO 서비스 — 프레임워크 코드 전혀 없음
@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public Order createOrder(OrderRequest request) {
        Order order = Order.from(request);
        return orderRepository.save(order);
    }
}
```

이 클래스는 `OrderService`라는 이름의 평범한 자바 클래스입니다. Spring 없이도 `new OrderService(mockRepo)` 형태로 단위 테스트를 작성할 수 있습니다. `@Service` 어노테이션은 Spring에게 "이 클래스를 빈으로 관리해달라"는 힌트이지, 클래스의 동작 자체를 바꾸지는 않습니다.

![POJO vs EJB 코드 비교](/assets/posts/spring-what-is-spring-pojo.svg)

## Spring의 3대 핵심 원칙

Spring의 설계 철학은 세 가지 원칙으로 요약됩니다.

### 1. IoC — 제어의 역전 (Inversion of Control)

전통적인 개발에서는 객체가 자신이 필요한 의존 객체를 직접 생성합니다. IoC는 이 "제어권"을 프레임워크에 넘깁니다.

```java
// IoC 없음 — 직접 생성
public class OrderService {
    private OrderRepository repo = new JpaOrderRepository(); // 강한 결합
}

// IoC 적용 — 외부에서 주입
public class OrderService {
    private final OrderRepository repo; // 인터페이스에 의존
    
    public OrderService(OrderRepository repo) { // 생성자 주입
        this.repo = repo;
    }
}
```

Spring IoC 컨테이너(`ApplicationContext`)가 객체의 생명주기를 관리하고, 필요한 의존성을 자동으로 주입합니다.

### 2. AOP — 관점 지향 프로그래밍 (Aspect-Oriented Programming)

로깅, 트랜잭션 관리, 보안 체크 등은 여러 클래스에 걸쳐 반복되는 "횡단 관심사(Cross-cutting Concern)"입니다. AOP는 이를 별도 모듈(Aspect)로 분리해 핵심 비즈니스 로직을 오염시키지 않습니다.

```java
// @Transactional 하나로 트랜잭션 시작/커밋/롤백 자동 처리
@Transactional
public Order createOrder(OrderRequest request) {
    return orderRepository.save(Order.from(request));
}
```

메서드 앞뒤로 트랜잭션을 열고 닫는 코드는 AOP가 투명하게 처리합니다.

### 3. PSA — 서비스 추상화 (Portable Service Abstraction)

Spring은 JDBC, JMS, 캐시, 트랜잭션 등 다양한 기술에 대한 일관된 추상화 레이어를 제공합니다. 덕분에 특정 기술 구현체를 교체해도 비즈니스 코드는 바뀌지 않습니다.

```java
// PlatformTransactionManager — JDBC/JPA/JMS 모두 동일 인터페이스
@Autowired
private PlatformTransactionManager txManager; // 구현체와 무관하게 사용
```

## Spring은 라이브러리인가, 프레임워크인가

Spring은 엄밀히 말해 **프레임워크**입니다. 라이브러리는 내 코드가 라이브러리를 호출하지만, 프레임워크는 프레임워크가 내 코드를 호출합니다(헐리우드 원칙: "Don't call us, we'll call you"). Spring IoC 컨테이너가 빈을 생성하고 의존성을 주입하며 생명주기를 관리하는 방식이 바로 이 원칙을 따릅니다.

그러나 Spring은 **비침투적(Non-invasive)** 프레임워크로 설계되어, 원하는 모듈만 선택해서 사용할 수 있고, 비즈니스 코드가 Spring에 직접적으로 의존하지 않아도 됩니다.

## 정리

Spring Framework는 단순한 코드 집합이 아니라 **어떻게 객체를 설계하고 연결할지에 대한 철학**입니다. POJO로 비즈니스 로직을 순수하게 유지하고, IoC로 의존성을 관리하고, AOP로 횡단 관심사를 분리하고, PSA로 기술 변경에 유연하게 대응하는 것 — 이 네 가지가 Spring이 20년 넘게 사랑받는 이유입니다.

---

**다음 글:** [Spring의 4대 핵심 특징 — IoC·DI·AOP·PSA 완전 해부](/posts/spring-four-pillars/)

<br>
읽어주셔서 감사합니다. 😊
