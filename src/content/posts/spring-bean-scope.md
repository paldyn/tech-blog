---
title: "Spring Bean Scope: 싱글톤부터 Request·Session까지"
description: "Spring 빈 스코프 5가지(singleton·prototype·request·session·application)의 동작 원리를 이해하고, 싱글톤에 프로토타입을 안전하게 주입하는 ObjectProvider·scoped-proxy 패턴을 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "BeanScope", "Singleton", "Prototype", "WebScope"]
featured: false
draft: false
---

[지난 글](/posts/spring-autowired-qualifier/)에서는 여러 구현체 중 하나를 선택하는 `@Qualifier`와 `@Primary` 전략을 살펴봤습니다. 이번에는 한 걸음 더 나아가, 빈이 **몇 개나 만들어지는가**를 결정하는 **스코프(Scope)** 개념을 파고듭니다.

Spring은 기본적으로 모든 빈을 **싱글톤**으로 관리합니다. 하지만 상황에 따라 요청마다, 혹은 세션마다 새 인스턴스가 필요한 경우가 있습니다. 스코프를 이해하면 메모리 사용, 스레드 안전성, 상태 격리 문제를 올바르게 설계할 수 있습니다.

## 스코프 종류 한눈에 보기

![Spring Bean Scope 한눈에 보기](/assets/posts/spring-bean-scope-overview.svg)

Spring은 크게 다섯 가지 스코프를 제공합니다.

| 스코프 | 범위 | 비고 |
|---|---|---|
| `singleton` | ApplicationContext당 1개 | 기본값 |
| `prototype` | getBean 또는 주입 요청마다 새 인스턴스 | 소멸 콜백 없음 |
| `request` | HTTP 요청 1건 | 웹 전용 |
| `session` | HTTP 세션 | 웹 전용 |
| `application` | ServletContext 생애 | 사실상 싱글톤 |

## Singleton — 기본값, 상태 없는 서비스에 최적

```java
@Service
// @Scope("singleton") — 기본값이므로 생략 가능
public class OrderService {
    // 상태 없음 → 스레드 안전
}
```

싱글톤 빈은 **컨테이너 시작 시 한 번 생성**되고 컨테이너가 종료될 때까지 유지됩니다. 모든 요청 스레드가 동일 인스턴스를 공유하기 때문에 **인스턴스 변수에 요청별 상태를 저장하면 레이스 컨디션**이 발생합니다.

```java
@Service
public class BadService {
    private String currentUser; // ← 절대 금지: 요청 간 공유됨

    public void setUser(String user) { this.currentUser = user; }
    public void doWork() { System.out.println(currentUser + " 처리"); }
}
```

싱글톤은 **의존성 주입된 참조**를 보관하는 것이지 **요청 데이터**를 보관해서는 안 됩니다.

## Prototype — 매 요청마다 새 인스턴스

```java
@Component
@Scope("prototype")
public class ReportBuilder {
    private final List<String> lines = new ArrayList<>();

    public void addLine(String line) { lines.add(line); }
    public String build() { return String.join("\n", lines); }
}
```

`getBean(ReportBuilder.class)` 또는 주입이 일어날 때마다 새 인스턴스가 만들어집니다. **상태가 있는(stateful) 빈**에 적합합니다.

중요한 차이가 하나 있습니다. Spring은 프로토타입 빈의 **생성과 의존성 주입까지만 관여**하고, 이후 **소멸 관리는 하지 않습니다.** `@PreDestroy`가 호출되지 않으므로, 리소스 해제가 필요하다면 직접 처리해야 합니다.

## 싱글톤에 Prototype 주입 — 함정과 해결

![Singleton에 Prototype 주입 함정과 해결](/assets/posts/spring-bean-scope-prototype-problem.svg)

싱글톤 빈이 프로토타입 빈을 일반 생성자 주입으로 받으면 문제가 생깁니다.

```java
@Service                          // singleton
public class SingletonService {
    private final PrototypeBean pb;

    public SingletonService(PrototypeBean pb) {
        this.pb = pb;             // 컨테이너 시작 시 1회 주입, 이후 고정
    }

    public void doWork() {
        pb.reset();               // 항상 같은 pb → prototype의 의미 없음
    }
}
```

`SingletonService`는 한 번 생성될 때 `PrototypeBean` 인스턴스를 주입받고 그걸 계속 씁니다. 매 호출마다 새 인스턴스를 원하는 목적이 달성되지 않습니다.

### 해결 1: `ObjectProvider`

Spring이 제공하는 `ObjectProvider<T>`를 주입받아 메서드 호출 시점마다 새 인스턴스를 요청합니다.

```java
@Service
public class SingletonService {

    private final ObjectProvider<PrototypeBean> pbProvider;

    public SingletonService(ObjectProvider<PrototypeBean> pbProvider) {
        this.pbProvider = pbProvider;
    }

    public void doWork() {
        PrototypeBean pb = pbProvider.getObject(); // 매번 새 인스턴스
        pb.reset();
        pb.process();
    }
}
```

### 해결 2: `@Scope`의 `proxyMode`

```java
@Component
@Scope(value = "prototype", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class PrototypeBean { /* ... */ }
```

`ScopedProxyMode.TARGET_CLASS`를 설정하면 Spring은 `PrototypeBean`을 감싸는 CGLIB 프록시를 생성합니다. 싱글톤이 프록시를 보유하고, 프록시에 메서드가 호출될 때마다 실제 프로토타입 인스턴스를 컨테이너에서 새로 꺼냅니다.

```java
@Service
public class SingletonService {
    private final PrototypeBean pb; // 실제론 프록시

    public SingletonService(PrototypeBean pb) { this.pb = pb; }

    public void doWork() {
        pb.reset();   // 내부적으로 새 인스턴스에 위임
    }
}
```

코드가 더 깔끔하지만, 프록시 생성을 위해 CGLIB 의존성이 필요하며 인터페이스 기반이면 `ScopedProxyMode.INTERFACES`를 씁니다.

## 웹 스코프 — request·session·application

웹 스코프는 `WebApplicationContext`에서만 동작합니다. Spring MVC 환경에서 자동 활성화되며, 스프링 부트는 별도 설정 없이 사용 가능합니다.

### Request Scope

```java
@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST,
       proxyMode = ScopedProxyMode.TARGET_CLASS)
public class RequestContext {

    private String traceId = UUID.randomUUID().toString();
    private long   startTime = System.currentTimeMillis();

    public String getTraceId() { return traceId; }
    public long   elapsed()    { return System.currentTimeMillis() - startTime; }
}
```

HTTP 요청마다 새 `RequestContext` 인스턴스가 생성됩니다. `proxyMode`를 설정하면 싱글톤 서비스에 주입해도 요청별 인스턴스를 사용합니다. 분산 트레이싱 ID, 요청 로깅에 유용합니다.

### Session Scope

```java
@Component
@Scope(value = WebApplicationContext.SCOPE_SESSION,
       proxyMode = ScopedProxyMode.TARGET_CLASS)
public class ShoppingCart implements Serializable {

    private final List<CartItem> items = new ArrayList<>();

    public void add(CartItem item) { items.add(item); }
    public List<CartItem> getItems() { return Collections.unmodifiableList(items); }
    public int size() { return items.size(); }
}
```

HTTP 세션 하나당 `ShoppingCart` 인스턴스 하나가 유지됩니다. `Serializable`을 구현하면 세션 클러스터링(Redis 등)에서도 직렬화가 가능합니다.

## `@RequestScope` / `@SessionScope` 단축 어노테이션

Spring 4.3부터 웹 스코프 선언을 단축할 수 있습니다.

```java
@Component
@RequestScope                   // proxyMode=TARGET_CLASS 자동 포함
public class RequestLogger { /* ... */ }

@Component
@SessionScope
public class UserPreference { /* ... */ }
```

`proxyMode`를 `TARGET_CLASS`로 자동 설정해 주기 때문에 별도 지정이 필요 없습니다.

## 실전 선택 기준

```
상태 없는 서비스·리포지터리    → singleton (기본)
호출마다 새 상태가 필요한 빌더  → prototype + ObjectProvider
요청별 로깅·트레이싱 컨텍스트  → @RequestScope
로그인 사용자 정보·장바구니     → @SessionScope
```

싱글톤이 압도적으로 많이 쓰이고, 나머지 스코프는 **상태 격리가 명확히 필요한 곳**에만 사용합니다. 잘못 사용하면 메모리 낭비(prototype 리소스 미해제)나 스레드 안전성 문제로 이어집니다.

## 정리

- `singleton`: 기본값, 상태 없는 서비스에 적합
- `prototype`: 상태 있는 빈, `ObjectProvider`로 매번 새 인스턴스 획득
- 웹 스코프(`request`·`session`): 싱글톤에 주입 시 `proxyMode` 필수
- `@RequestScope`·`@SessionScope`: 단축 어노테이션, proxyMode 자동 포함

다음 글에서는 빈의 **생명주기(Lifecycle)**를 살펴봅니다. 빈이 생성되고 초기화 콜백이 호출되며 소멸하는 전 과정을 추적하고, `@PostConstruct`·`@PreDestroy`·`InitializingBean` 등의 차이를 설명합니다.

---

**지난 글:** [@Autowired와 @Qualifier: 빈 선택 전략 완전 정리](/posts/spring-autowired-qualifier/)

**다음 글:** [Spring Bean 생명주기: 초기화부터 소멸까지 완전 분석](/posts/spring-bean-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
