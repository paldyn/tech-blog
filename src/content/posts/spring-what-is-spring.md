---
title: "스프링이란 무엇인가 — EJB의 한계와 POJO 철학"
description: "EJB가 왜 실패했는지, 스프링이 어떤 철학으로 그 빈자리를 채웠는지 이해한다. 비침투적 컨테이너와 POJO 철학이 스프링의 모든 것을 설명한다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["spring", "pojo", "ejb", "ioc", "philosophy"]
featured: false
draft: false
---

자바 엔터프라이즈 개발의 역사를 이야기할 때 **EJB(Enterprise JavaBeans)** 와 **스프링(Spring Framework)** 은 피할 수 없는 두 키워드다. 하나는 "왜 이렇게 복잡한가"의 상징이 됐고, 다른 하나는 그 고통에 대한 응답으로 탄생했다. 스프링이 무엇인지 알려면 먼저 EJB가 무엇이었는지, 왜 문제가 됐는지를 이해해야 한다.

## EJB — 좋은 의도, 처참한 경험

1998년 Sun Microsystems는 자바 엔터프라이즈 애플리케이션의 표준화를 위해 **EJB 스펙**을 발표했다. 트랜잭션 관리, 보안, 분산 컴포넌트 등 복잡한 인프라 관심사를 컨테이너가 책임지고, 개발자는 비즈니스 로직에만 집중한다는 아이디어는 훌륭했다.

현실은 달랐다.

### EJB의 세 가지 치명적 문제

**1. 과도한 결합도**

Session Bean 하나를 만들려면 최소 세 개의 파일이 필요했다. 컴포넌트 인터페이스(`EJBLocalObject` 또는 `EJBObject`), 홈 인터페이스(`EJBLocalHome` 또는 `EJBHome`), 그리고 구현 클래스. 순수한 비즈니스 로직 100줄을 짜기 위해 500줄짜리 보일러플레이트를 써야 했다.

**2. 테스트 불가**

EJB 컴포넌트는 EJB 컨테이너(WebLogic, JBoss, WebSphere 등) 위에서만 동작했다. "주문 금액을 계산한다"는 로직을 단위 테스트하려면 무거운 WAS를 기동해야 했다. CI 파이프라인이 존재했다면 매 커밋마다 수분이 걸리는 빌드를 견뎌야 했을 것이다.

**3. 벤더 종속**

표준 스펙이라고 했지만, WAS 벤더마다 구현 방식과 배포 서술자(deployment descriptor) XML 방언이 달랐다. WebLogic에서 JBoss로 이전하는 일은 단순한 설정 변경이 아니라 사실상 재작성에 가까웠다.

![EJB vs Spring POJO 비교](/assets/posts/spring-what-is-spring-ejb-vs-pojo.svg)

## 로드 존슨의 반격 — 《Expert One-on-One J2EE Design and Development》

2002년, 호주 출신 개발자 **Rod Johnson**은 두꺼운 책 한 권을 출판했다. 책의 핵심 주장은 단순했다.

> "J2EE 애플리케이션의 대부분은 EJB 없이도, 심지어 J2EE 컨테이너 없이도 만들 수 있다."

그리고 그는 주장만 하지 않았다. 책과 함께 3만 줄의 예제 코드를 공개했다. 그 코드가 스프링 프레임워크의 씨앗이 됐다. 2003년 오픈소스로 공개된 Spring 1.0은 EJB 없이도 트랜잭션, DI, AOP를 제공했다.

## POJO 철학 — 스프링의 DNA

스프링이 가져온 가장 중요한 개념은 **POJO(Plain Old Java Object)** 다. 마틴 파울러(Martin Fowler)가 명명한 이 용어는 말 그대로 "평범한 자바 객체"를 뜻한다.

```java
// POJO — 어떤 프레임워크도 상속하지 않는 순수한 클래스
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public Order createOrder(OrderRequest request) {
        // 순수 비즈니스 로직
        Order order = new Order(request.getCustomerId(), request.getItems());
        return orderRepository.save(order);
    }
}
```

이 클래스에는 `import org.springframework.*`가 없다. 스프링을 전혀 모른다. 그런데도 스프링이 관리하는 빈(Bean)이 될 수 있다. 이것이 **비침투적(Non-invasive)** 설계다.

비교를 위해 EJB 시절 같은 역할을 하는 코드를 보면:

```java
// EJB — 프레임워크에 오염된 코드
import javax.ejb.SessionBean;
import javax.ejb.SessionContext;

public class OrderEJB implements SessionBean {

    private SessionContext ctx;  // 컨테이너 콜백 강제

    @Override
    public void setSessionContext(SessionContext ctx) {
        this.ctx = ctx;
    }

    @Override
    public void ejbCreate() {}

    @Override
    public void ejbRemove() {}

    @Override
    public void ejbActivate() {}

    @Override
    public void ejbPassivate() {}

    // 비즈니스 로직은 여기 딸려 있음
    public Order createOrder(OrderRequest request) {
        // ...
    }
}
```

`SessionBean` 인터페이스를 구현하는 순간 코드는 EJB 컨테이너에 영구적으로 묶인다. 단위 테스트? `SessionContext`를 어떻게 주입하겠는가.

## 비침투적 컨테이너 — 스프링의 동작 방식

스프링은 **IoC(Inversion of Control) 컨테이너**다. 개발자가 객체의 생명주기와 의존성을 직접 관리하는 대신, 컨테이너에게 그 제어권을 역전시킨다.

![스프링 비침투적 컨테이너](/assets/posts/spring-what-is-spring-core-concept.svg)

비즈니스 코드(POJO)는 스프링을 모른다. 스프링 컨테이너가 바깥에서 그들을 관리하며 필요한 의존성을 주입하고, 트랜잭션·AOP·보안 같은 인프라 서비스를 **코드 변경 없이** 가로채어 적용한다.

이 구조 덕분에:

```java
// 스프링 없이 순수 JUnit에서 테스트
@Test
void createOrder_givenValidRequest_savesOrder() {
    OrderRepository mockRepo = mock(OrderRepository.class);
    OrderService service = new OrderService(mockRepo);  // new로 직접 생성

    OrderRequest req = new OrderRequest(1L, List.of(item));
    service.createOrder(req);

    verify(mockRepo).save(any(Order.class));
}
```

WAS도, 컨테이너도, 네트워크도 필요 없다. 밀리초 안에 테스트가 끝난다.

## 스프링의 정의

이제 스프링을 한 문장으로 정의할 수 있다.

> **스프링은 POJO 기반의 비침투적 IoC/DI 컨테이너로, 엔터프라이즈 애플리케이션의 인프라 관심사를 비즈니스 로직과 분리하여 관리한다.**

현대에는 Spring Boot가 스프링 위에 자동 구성(Auto-Configuration)과 임베디드 서버를 얹어 훨씬 빠르게 시작할 수 있게 해준다. 하지만 그 철학적 뿌리는 2003년 Rod Johnson이 심어놓은 "순수한 자바 객체를 오염시키지 말자"는 씨앗에서 변하지 않았다.

## 왜 지금도 중요한가

마이크로서비스, 클라우드 네이티브, 리액티브 — 트렌드는 계속 바뀐다. 그러나 다음 질문들은 영원히 유효하다.

- 이 코드를 컨테이너 없이 테스트할 수 있는가?
- 이 코드는 특정 프레임워크에 의존하고 있는가?
- 인프라 관심사가 비즈니스 로직을 오염시키고 있지는 않은가?

스프링을 배우는 진짜 이유는 특정 API를 외우기 위해서가 아니다. 이 질문들에 "그렇지 않다"고 자신 있게 답할 수 있는 코드를 작성하는 방법을 익히기 위해서다.

---

**다음 글:** [스프링의 4대 핵심 — IoC, DI, AOP, PSA](/posts/spring-four-pillars/)

<br>
읽어주셔서 감사합니다. 😊
