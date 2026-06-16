---
title: "동적 프록시 — 런타임에 인터페이스 구현 만들기"
description: "java.lang.reflect.Proxy는 런타임에 인터페이스를 구현하는 객체를 만들고, 모든 메서드 호출을 InvocationHandler 한 곳으로 모읍니다. 로깅·트랜잭션·AOP의 토대가 되는 동적 프록시의 원리와 제약을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "동적 프록시", "Proxy", "InvocationHandler", "AOP", "리플렉션"]
featured: false
draft: false
---

[지난 글](/posts/java-class-method-field/)에서 `Method.invoke`로 메서드를 런타임에 호출하는 법을 봤습니다. 그런데 리플렉션의 활용 중 가장 우아한 것은 따로 있습니다. "어떤 인터페이스든 받아, 그 구현체를 **런타임에 즉석에서 만들어 내는**" 능력입니다. 클래스 파일을 미리 작성하지 않았는데도, 그 인터페이스를 구현하는 객체가 생깁니다. 이것이 `java.lang.reflect.Proxy`의 **동적 프록시(dynamic proxy)** 입니다. 스프링 AOP, 트랜잭션 경계, MyBatis의 매퍼 인터페이스가 모두 이 기술 위에 서 있습니다. 이번 글은 동적 프록시의 원리를 정리합니다.

## 무엇을 푸는가 — 횡단 관심사

로깅을 생각해 봅시다. 서비스의 모든 메서드 앞뒤에 "호출 시작", "호출 끝" 로그를 남기고 싶습니다. 메서드마다 직접 `log.info(...)`를 박으면 코드가 지저분해지고, 메서드가 늘 때마다 빠뜨릴 위험이 있습니다. 트랜잭션 시작/커밋, 권한 검사, 성능 측정도 똑같은 문제입니다. 이런 **횡단 관심사(cross-cutting concern)** 는 한곳에 모으고 싶습니다.

동적 프록시는 정확히 이걸 해 줍니다. 실제 구현 객체를 감싸는 **프록시**를 만들어, 모든 메서드 호출을 단 하나의 메서드로 모읍니다.

![호출자→프록시→핸들러→실제 구현으로 이어지는 위임 흐름](/assets/posts/java-dynamic-proxy-flow.svg)

호출자는 프록시를 진짜 서비스인 줄 알고 `svc.pay()`를 호출합니다. 그 호출은 런타임에 생성된 프록시 클래스(`$Proxy0`)를 거쳐 `InvocationHandler.invoke()` 한 곳으로 들어옵니다. 거기서 로그를 남기고, 실제 구현으로 위임합니다. 모든 메서드가 이 한 지점을 통과하므로, 부가 기능을 한 자리에 끼울 수 있습니다.

## 두 조각 — Proxy와 InvocationHandler

동적 프록시는 두 부품으로 이뤄집니다.

- `InvocationHandler` — 인터페이스. `invoke(proxy, method, args)` 한 메서드만 가집니다. 프록시에 들어온 모든 호출이 여기로 옵니다.
- `Proxy.newProxyInstance(...)` — 인터페이스 목록과 핸들러를 받아, 그 인터페이스들을 구현하는 프록시 인스턴스를 런타임에 만들어 돌려줍니다.

![Proxy.newProxyInstance의 세 인자](/assets/posts/java-dynamic-proxy-code.svg)

```java
interface Service { void pay(int amount); }

Service target = new RealService();   // 실제 구현

Service proxy = (Service) Proxy.newProxyInstance(
    Service.class.getClassLoader(),    // 1) 클래스로더
    new Class[]{ Service.class },      // 2) 구현할 인터페이스 목록
    (p, method, args) -> {             // 3) InvocationHandler
        System.out.println("→ " + method.getName());
        Object result = method.invoke(target, args);  // 실제 구현 위임
        System.out.println("← done");
        return result;
    });

proxy.pay(1000);
// → pay
// ← done
```

`invoke`의 세 인자를 보면, `method`는 호출된 메서드의 `Method` 객체(지난 글의 그것), `args`는 인자 배열입니다. 우리가 직접 하는 일은 "호출 전후에 무엇을 할지"와 "실제 구현에 어떻게 위임할지"를 정하는 것뿐입니다. 프록시 클래스 자체는 JVM이 런타임에 바이트코드로 만들어 줍니다.

## 결정적 제약 — 인터페이스만 구현한다

동적 프록시의 가장 중요한 한계는 이것입니다. **JDK 동적 프록시는 인터페이스만 구현할 수 있습니다.** 구체 클래스를 상속하는 프록시는 만들지 못합니다.

```java
// OK — 인터페이스
Proxy.newProxyInstance(cl, new Class[]{ Service.class }, handler);

// 불가 — 구체 클래스 RealService를 직접 프록시할 수 없다
```

그래서 대상이 인터페이스를 구현하지 않은 평범한 클래스라면, JDK 프록시로는 감쌀 수 없습니다. 이 경우 CGLIB나 ByteBuddy 같은 바이트코드 조작 라이브러리가 클래스를 상속하는 서브클래스 프록시를 만들어 해결합니다. 스프링은 대상이 인터페이스를 가지면 JDK 프록시를, 아니면 CGLIB를 자동으로 골라 씁니다.

## 실전 — 로깅 프록시를 일반화

핸들러를 클래스로 빼면, 어떤 인터페이스에도 적용 가능한 재사용 프록시가 됩니다.

```java
class LoggingHandler implements InvocationHandler {
    private final Object target;
    LoggingHandler(Object target) { this.target = target; }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args)
            throws Throwable {
        long start = System.nanoTime();
        try {
            return method.invoke(target, args);
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            System.out.printf("%s took %dms%n", method.getName(), ms);
        }
    }
}

@SuppressWarnings("unchecked")
static <T> T wrap(T target, Class<T> iface) {
    return (T) Proxy.newProxyInstance(
        iface.getClassLoader(),
        new Class[]{ iface },
        new LoggingHandler(target));
}

Service svc = wrap(new RealService(), Service.class);
svc.pay(1000);  // pay took 3ms
```

`method.invoke(target, args)`에서 예외가 나면 `InvocationTargetException`으로 감싸여 던져진다는 점에 주의해야 합니다. 원래 예외는 `getCause()`로 꺼냅니다. 또 `equals`, `hashCode`, `toString` 호출도 모두 `invoke`로 들어오므로, 필요하면 이들을 별도로 처리해야 합니다.

## 정리

- 동적 프록시는 인터페이스를 받아 그 구현체를 **런타임에 생성**해, 모든 메서드 호출을 한 지점으로 모으는 리플렉션 기술이다.
- `InvocationHandler.invoke(proxy, method, args)`가 그 한 지점이며, 여기서 부가 기능을 끼우고 실제 구현으로 위임한다.
- `Proxy.newProxyInstance(클래스로더, 인터페이스배열, 핸들러)`로 프록시 인스턴스를 만든다.
- 핵심 제약: JDK 동적 프록시는 **인터페이스만** 구현하며, 구체 클래스 프록시는 CGLIB/ByteBuddy가 필요하다.
- 로깅·트랜잭션·보안·성능 측정 같은 횡단 관심사를 한 자리에 모으는 토대이며, 스프링 AOP와 MyBatis 매퍼가 이 위에 서 있다.
- `invoke` 안에서 발생한 예외는 `InvocationTargetException`으로 감싸지므로 `getCause()`로 원인을 꺼낸다.

---

**지난 글:** [Class·Method·Field — 리플렉션 핵심 객체 다루기](/posts/java-class-method-field/)

**다음 글:** [MethodHandles — 리플렉션보다 빠른 메서드 핸들](/posts/java-method-handles/)

<br>
읽어주셔서 감사합니다. 😊
