---
title: "스프링이란 무엇인가 — EJB의 한계와 POJO 철학"
description: "자바 엔터프라이즈 개발의 복잡도를 낮춘 스프링의 탄생 배경과 POJO 철학을 깊이 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["spring", "pojo", "ejb", "ioc", "di"]
featured: false
draft: false
---

자바로 엔터프라이즈 애플리케이션을 처음 만들던 시절, 개발자들은 공통된 고통을 겪었습니다. 트랜잭션 관리, 보안, 원격 호출 같은 기반 기술을 직접 구현해야 했고, Sun Microsystems가 제시한 해답인 **EJB(Enterprise JavaBeans)** 는 오히려 복잡성을 극한으로 끌어올렸습니다. 이번 글에서는 그 배경을 살펴보고, 스프링이 어떤 철학으로 그 문제를 해결했는지 알아봅니다.

## EJB가 약속한 것과 현실

1990년대 후반, 자바 엔터프라이즈 세계에는 큰 기대가 있었습니다. EJB는 "선언적 트랜잭션", "분산 컴포넌트", "컨테이너 관리 보안"을 약속했습니다. 이론상으로는 개발자가 비즈니스 로직만 작성하면 컨테이너가 알아서 처리해 주는 세상이었습니다.

그러나 현실은 달랐습니다. EJB 2.x 기준으로 하나의 비즈니스 컴포넌트를 만들려면 다음이 필요했습니다.

```java
// EJB 2.x — 주문 서비스 하나를 만들기 위한 코드
public interface OrderHome extends EJBHome {
    Order create() throws CreateException, RemoteException;
}

public interface Order extends EJBObject {
    void place(Long itemId) throws RemoteException;
}

public class OrderBean implements SessionBean {
    private SessionContext ctx;

    public void ejbCreate() {}
    public void ejbRemove() {}
    public void ejbActivate() {}
    public void ejbPassivate() {}
    public void setSessionContext(SessionContext ctx) {
        this.ctx = ctx;
    }

    // 실제 비즈니스 로직은 이 메서드 하나
    public void place(Long itemId) {
        // ...
    }
}
```

이 코드 전체에서 **비즈니스 로직은 `place()` 메서드 단 하나**입니다. 나머지는 모두 EJB 컨테이너를 만족시키기 위한 의식(ceremony)입니다. 게다가 EJB 컴포넌트는 컨테이너 없이 테스트조차 할 수 없었습니다. 로컬 환경에서 테스트하려면 무거운 WAS를 항상 띄워야 했습니다.

![EJB의 한계와 스프링의 POJO 철학 비교](/assets/posts/spring-what-is-spring-ejb-vs-spring.svg)

## 로드 존슨의 질문

2002년, 로드 존슨(Rod Johnson)은 저서 *Expert One-on-One J2EE Design and Development*에서 이런 질문을 던졌습니다.

> "J2EE 명세서에 있는 것이 항상 해결책일까? 아니면 단순한 자바 객체로도 충분하지 않을까?"

그는 약 3만 줄의 예제 코드와 함께 EJB 없이도 엔터프라이즈 수준의 애플리케이션을 구축할 수 있음을 보여줬습니다. 이 코드베이스가 스프링 프레임워크의 원형이 됩니다.

핵심 주장은 간단했습니다. **기반 기술(트랜잭션, 보안, 원격 호출)은 프레임워크가 처리하고, 개발자는 순수한 자바 객체(POJO)에 비즈니스 로직만 작성하면 된다.**

## POJO — Plain Old Java Object

**POJO**라는 용어 자체는 마틴 파울러, 레베카 파슨스, 조시 맥켄지가 2000년에 만들었습니다. "왜 사람들이 시스템에 일반 객체를 사용하지 않는지 의아했다. 그래서 멋진 이름을 붙여줬더니 잘 팔렸다"라고 파울러는 회고했습니다.

POJO의 조건은 단순합니다.

- 특정 인터페이스를 구현할 필요 없음
- 특정 클래스를 상속할 필요 없음
- 특정 어노테이션이 없어도 동작

```java
// 이것이 POJO입니다 — 어떤 프레임워크에도 종속되지 않음
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public Order placeOrder(Long itemId, int quantity) {
        Item item = orderRepository.findItem(itemId);
        return new Order(item, quantity);
    }
}
```

이 클래스는 `main()` 메서드에서도, JUnit 테스트에서도, 스프링 컨텍스트에서도 동일하게 동작합니다. 특정 환경에 묶이지 않습니다.

## 스프링이 실제로 하는 일

스프링은 POJO 객체들을 모아 애플리케이션을 조립하는 **조립 공장**입니다. 개발자가 어떤 객체가 어떤 객체를 필요로 하는지 선언해 두면, 스프링이 그 객체들을 만들고 연결해 줍니다. 이것이 IoC(Inversion of Control)입니다.

```java
// 스프링이 관리하는 POJO — 어노테이션은 "나를 스프링이 관리해줘"라는 표시
@Service
public class OrderService {

    private final OrderRepository orderRepository;

    // 스프링이 OrderRepository 구현체를 자동으로 주입
    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public Order placeOrder(Long itemId, int quantity) {
        Item item = orderRepository.findItem(itemId);
        return new Order(item, quantity);
    }
}
```

`@Service` 어노테이션이 없어도 이 클래스는 순수한 자바 코드로 동작합니다. 어노테이션은 스프링에게 "이 객체를 관리해달라"고 알리는 힌트일 뿐, 비즈니스 로직 자체를 오염시키지 않습니다.

![스프링 POJO 철학 — 스프링이 제공하는 것](/assets/posts/spring-what-is-spring-pojo-philosophy.svg)

## 스프링의 핵심 가치: 비침투성(Non-Invasiveness)

스프링 설계 철학의 핵심은 **비침투성**입니다. 프레임워크가 도메인 코드에 흔적을 남기지 않는다는 의미입니다.

| 구분 | EJB 2.x | 스프링 |
|------|---------|--------|
| 상속 강제 | `SessionBean` 구현 필수 | 없음 |
| 예외 처리 | `RemoteException` 강제 | 선택 |
| 테스트 | WAS 필요 | JUnit 직접 실행 |
| 설정 | XML 수백 줄 | 어노테이션 또는 간결한 Java Config |
| 특정 WAS 종속 | 높음 | 없음 |

스프링을 걷어내도 비즈니스 로직 코드는 그대로 살아남습니다. 이것이 스프링이 2003년 등장 이후 20년 넘게 자바 생태계의 표준이 된 이유입니다.

## 의존성 역전 — 제어의 주도권

전통적인 프로그래밍에서는 개발자 코드가 프레임워크를 호출합니다. 스프링은 이를 뒤집습니다. 개발자는 컴포넌트를 작성하고, **스프링 컨테이너가 그 컴포넌트를 호출**합니다. 할리우드 원칙("Don't call us, we'll call you")과 같습니다.

```java
// 개발자는 서비스를 등록만 한다
@Component
public class EmailNotificationService implements NotificationService {
    public void notify(String message) {
        // 이메일 발송 로직
    }
}

// 스프링이 알아서 주입해서 호출한다
@Service
public class OrderProcessor {
    // 구현체가 바뀌어도 이 코드는 변경 불필요
    private final NotificationService notificationService;

    public OrderProcessor(NotificationService notificationService) {
        this.notificationService = notificationService;
    }
}
```

`OrderProcessor`는 `EmailNotificationService`를 직접 알지 못합니다. `NotificationService`라는 추상화만 알고 있습니다. 구현체를 `SmsNotificationService`로 바꿔도 `OrderProcessor` 코드는 한 줄도 변경할 필요가 없습니다.

## 정리

스프링이 해결하려 했던 문제는 단순합니다. **"개발자가 자신의 문제에 집중할 수 있게 하자."** EJB가 강요하는 의식적인 코드(ceremony code), 특정 환경 종속, 테스트 불가능한 구조를 제거하고, 순수한 자바 객체로 엔터프라이즈 수준의 기능을 누릴 수 있게 했습니다.

이 POJO 철학은 스프링의 모든 기능을 관통하는 원칙입니다. 다음 글에서는 이 철학을 구체화하는 스프링의 4대 핵심 개념인 IoC, DI, AOP, PSA를 살펴봅니다.

---

**다음 글:** [스프링의 4대 핵심 — IoC, DI, AOP, PSA](/posts/spring-four-pillars/)

<br>
읽어주셔서 감사합니다. 😊
