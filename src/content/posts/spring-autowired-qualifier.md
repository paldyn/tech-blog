---
title: "@Autowired와 @Qualifier: 빈 선택 전략 완전 정리"
description: "같은 타입의 빈이 여러 개일 때 Spring이 어떻게 하나를 고르는지, @Primary·@Qualifier·커스텀 qualifier 어노테이션의 동작 원리와 실전 활용 전략을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "Autowired", "Qualifier", "Primary", "DI"]
featured: false
draft: false
---

[지난 글](/posts/spring-di-three-ways/)에서는 생성자·세터·필드 주입 방식을 비교했습니다. 한 타입의 빈이 컨테이너에 하나뿐이라면 Spring은 별다른 힌트 없이 자동으로 주입합니다. 하지만 **같은 인터페이스를 구현한 클래스가 두 개 이상 등록**되어 있다면 어떻게 될까요? 이번 글에서는 `@Primary`, `@Qualifier`, 그리고 커스텀 qualifier 어노테이션을 사용해 빈을 정확히 선택하는 방법을 다룹니다.

## `NoUniqueBeanDefinitionException` — 왜 발생하는가

간단한 예를 보겠습니다.

```java
public interface PaymentGateway {
    void pay(long amount);
}

@Component
public class KakaoPay implements PaymentGateway { /* ... */ }

@Component
public class TossPay implements PaymentGateway { /* ... */ }
```

이제 `PaymentGateway`를 주입받는 서비스를 만들면:

```java
@Service
public class OrderService {

    private final PaymentGateway paymentGateway;

    public OrderService(PaymentGateway paymentGateway) { // 어느 것?
        this.paymentGateway = paymentGateway;
    }
}
```

Spring은 `PaymentGateway` 타입의 후보 빈이 두 개(`kakaoPay`, `tossPay`)라는 것을 알지만 어느 쪽을 선택해야 할지 모릅니다. 결과는:

```
NoUniqueBeanDefinitionException:
  No qualifying bean of type 'PaymentGateway' available:
  expected single matching bean but found 2: kakaoPay, tossPay
```

## Spring의 빈 선택 우선순위

![@Autowired 빈 선택 우선순위](/assets/posts/spring-autowired-qualifier-resolution.svg)

Spring은 다음 순서로 하나의 빈을 선택합니다.

1. **타입 매칭** — 해당 타입의 빈을 모두 수집
2. 후보가 1개 → 바로 주입
3. 후보가 2개 이상 → `@Primary` 빈이 있으면 선택
4. `@Primary` 없으면 → `@Qualifier` 값으로 매칭
5. `@Qualifier` 없으면 → 파라미터·필드 이름과 빈 이름 비교
6. 여기서도 매칭 실패 → `NoUniqueBeanDefinitionException`

## `@Primary` — 기본 구현체 지정

가장 자주 사용하는 구현체를 기본값으로 지정하고 싶을 때 사용합니다.

```java
@Component
@Primary                              // 타입 충돌 시 우선 선택
public class KakaoPay implements PaymentGateway {

    @Override
    public void pay(long amount) {
        System.out.println("카카오페이 결제: " + amount);
    }
}
```

이제 `OrderService`는 `PaymentGateway`를 주입받을 때 자동으로 `KakaoPay`를 받습니다. 별도 힌트가 없어도 됩니다.

`@Primary`는 **서비스 전체의 기본 전략**을 지정할 때 좋습니다. 예를 들어 PG사가 카카오페이이고 일부 플로우만 토스페이를 쓴다면, 카카오페이에 `@Primary`를 붙이는 패턴이 자연스럽습니다.

## `@Qualifier` — 명시적 지정

특정 구현체를 명시적으로 선택해야 할 때 사용합니다.

```java
@Component
@Qualifier("tossPay")
public class TossPay implements PaymentGateway {

    @Override
    public void pay(long amount) {
        System.out.println("토스페이 결제: " + amount);
    }
}
```

주입받는 쪽에서:

```java
@Service
public class RefundService {

    private final PaymentGateway paymentGateway;

    public RefundService(@Qualifier("tossPay") PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }
}
```

`@Qualifier`의 값은 **문자열**이기 때문에 오타가 있어도 컴파일 타임에 오류가 발생하지 않습니다. 런타임에야 `NoSuchBeanDefinitionException`이 발생합니다.

## 커스텀 Qualifier 어노테이션 — 타입 안전한 방법

오타 위험을 없애고 싶다면 `@Qualifier`를 메타 어노테이션으로 활용한 커스텀 qualifier를 만듭니다.

```java
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Qualifier                          // 메타 어노테이션
public @interface TossPayQualifier {}
```

구현체에:

```java
@Component
@TossPayQualifier
public class TossPay implements PaymentGateway { /* ... */ }
```

주입받는 쪽에:

```java
@Service
public class RefundService {

    private final PaymentGateway paymentGateway;

    public RefundService(@TossPayQualifier PaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }
}
```

이제 `@TossPayQualifier`는 코드에서 직접 참조되므로 **이름을 바꾸거나 삭제하면 컴파일 오류**가 발생합니다. 리팩터링 도구도 제대로 인식합니다.

![Primary·Qualifier·커스텀 어노테이션 비교](/assets/posts/spring-autowired-qualifier-custom.svg)

## `List`·`Map`으로 모든 구현체 주입

경우에 따라 특정 하나가 아니라 **해당 타입의 모든 빈을 컬렉션으로 받아야** 할 때도 있습니다.

```java
@Service
public class PaymentRouter {

    private final List<PaymentGateway> gateways;
    private final Map<String, PaymentGateway> gatewayMap;

    public PaymentRouter(
        List<PaymentGateway> gateways,               // [kakaoPay, tossPay]
        Map<String, PaymentGateway> gatewayMap        // {"kakaoPay": ..., "tossPay": ...}
    ) {
        this.gateways = gateways;
        this.gatewayMap = gatewayMap;
    }

    public void route(String provider, long amount) {
        PaymentGateway gw = gatewayMap.get(provider);
        if (gw == null) throw new IllegalArgumentException("Unknown provider: " + provider);
        gw.pay(amount);
    }
}
```

`Map<String, T>` 형태로 주입하면 **빈 이름이 키**, **인스턴스가 값**이 됩니다. 문자열로 구현체를 선택하는 전략 패턴을 구현할 때 매우 유용합니다.

## `@Autowired(required = false)` — 없어도 괜찮다

의존 빈이 없을 때 예외를 던지지 않고 `null`로 두고 싶다면 `required = false`를 사용합니다.

```java
@Service
public class NotificationService {

    @Autowired(required = false)
    private SlackNotifier slackNotifier;   // Slack 빈이 없으면 null

    public void sendAlert(String msg) {
        if (slackNotifier != null) {
            slackNotifier.notify(msg);
        }
    }
}
```

`Optional<T>`로도 표현 가능합니다.

```java
@Autowired
private Optional<SlackNotifier> slackNotifier;
```

`Optional`을 사용하면 `null` 체크 대신 `isPresent()`를 쓸 수 있어 의도가 더 명확합니다.

## 실전 선택 가이드

| 상황 | 권장 전략 |
|---|---|
| 구현체 하나가 거의 항상 쓰인다 | `@Primary` |
| 특정 지점만 다른 구현체 필요 | `@Qualifier` 또는 커스텀 qualifier |
| 여러 구현체 순서 처리 | `List<T>` + `@Order` |
| 이름 기반 동적 선택 | `Map<String, T>` |
| 빈이 없어도 되는 선택적 의존 | `@Autowired(required=false)` / `Optional<T>` |

`@Primary`와 `@Qualifier`를 동시에 사용하면 `@Qualifier`가 우선합니다. 즉, `@Primary`는 전역 기본값이고 `@Qualifier`는 로컬 오버라이드입니다.

## 정리

- `@Primary` — 전역 기본 구현체 지정, 코드 간결
- `@Qualifier` — 특정 위치에 특정 구현체 명시, 문자열 오타 주의
- 커스텀 qualifier 어노테이션 — 타입 안전, 리팩터링 친화적 → 규모 있는 프로젝트에서 권장
- `List<T>` / `Map<String,T>` — 모든 구현체를 컬렉션으로 받는 전략 패턴

다음 글에서는 빈의 생명 범위(scope)를 다룹니다. 싱글톤으로만 쓰는 게 능사가 아닌 이유, 프로토타입·리퀘스트·세션 스코프의 실전 활용법을 살펴봅니다.

---

**지난 글:** [Spring DI 세 가지 방식: 생성자·세터·필드 주입 완전 비교](/posts/spring-di-three-ways/)

**다음 글:** [Spring Bean Scope: 싱글톤부터 Request·Session까지](/posts/spring-bean-scope/)

<br>
읽어주셔서 감사합니다. 😊
