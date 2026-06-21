---
title: "MDC로 로그 추적하기 — 요청을 처음부터 끝까지 잇는 컨텍스트"
description: "MDC(Mapped Diagnostic Context)는 한 요청에 속한 모든 로그를 같은 식별자로 묶어 분산된 로그 속에서 흐름을 추적하게 해줍니다. ThreadLocal 기반 동작 원리, SLF4J·Logback에서의 설정, 스레드 풀 누수와 비동기 전파 문제까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "MDC", "로깅", "SLF4J", "Logback", "추적"]
featured: false
draft: false
---

[지난 글](/posts/java-jul/)에서 JDK 내장 로깅까지 살펴보며 로깅 프레임워크 묶음을 마무리했습니다. 그런데 로그를 잘 남기는 것과 로그에서 원하는 흐름을 찾아내는 것은 다른 문제입니다. 운영 환경에서는 수십 개의 요청이 동시에 처리되고, 그 로그가 한 파일에 뒤섞여 쌓입니다. 이때 "특정 사용자의 결제 요청이 어디서 실패했는가"를 추적하려면 같은 요청에서 나온 로그를 한 줄기로 묶을 수단이 필요합니다. 그 역할을 하는 것이 **MDC(Mapped Diagnostic Context)** 입니다.

## MDC가 푸는 문제

로그 한 줄에는 보통 시간, 레벨, 클래스 이름, 메시지가 담깁니다. 문제는 이 정보만으로는 "이 로그가 어느 요청에서 나왔는지"를 알 수 없다는 점입니다. 동시에 100개의 요청이 들어오면 100개 요청의 로그가 시간순으로 교차하며 쌓이고, 특정 요청의 로그만 골라내는 것은 거의 불가능에 가깝습니다.

MDC는 요청이 시작될 때 그 요청을 식별하는 값(보통 `traceId`)을 한 번만 넣어두면, 이후 같은 스레드에서 남기는 모든 로그에 그 값이 자동으로 따라붙게 해줍니다. 코드 곳곳에서 매번 `traceId`를 넘기지 않아도 됩니다.

![MDC — 요청 컨텍스트가 모든 로그에 따라붙는다](/assets/posts/java-mdc-tracing-flow.svg)

위 그림처럼 요청 진입 지점에서 `MDC.put`으로 컨텍스트를 한 번 심으면, 그 뒤 `OrderService`·`PaymentService` 어디서 로그를 남기든 같은 `traceId`가 붙습니다. 결과적으로 `[a1b2c3]` 하나로 grep 하면 그 요청의 전체 흐름이 시간순으로 깔끔하게 추출됩니다.

## 기본 사용법

MDC는 SLF4J가 제공하는 `org.slf4j.MDC` 클래스로 다룹니다. API는 `Map`과 거의 같습니다. `put`으로 키-값을 넣고, `remove`나 `clear`로 비웁니다.

```java
import org.slf4j.MDC;

public class TraceFilter implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res,
                         FilterChain chain) throws IOException, ServletException {
        String traceId = UUID.randomUUID().toString().substring(0, 6);
        MDC.put("traceId", traceId);
        try {
            chain.doFilter(req, res);   // 이 안의 모든 로그에 traceId가 붙는다
        } finally {
            MDC.clear();                // 반드시 정리
        }
    }
}
```

핵심은 `try` 블록 안에서 처리를 진행하고, `finally`에서 반드시 `clear`를 호출하는 구조입니다. 왜 `finally`가 필수인지는 잠시 뒤 동작 원리에서 설명합니다.

## 로그 패턴에 컨텍스트 노출하기

`MDC.put`만으로는 로그에 값이 보이지 않습니다. 어떤 키를 출력할지 **로그 패턴**에 명시해야 합니다. Logback에서는 `%X{키}` 형식을 씁니다.

```xml
<pattern>%X{traceId} %-5level %logger{0} - %msg%n</pattern>
```

이 한 줄을 패턴에 추가하면 애플리케이션 코드는 전혀 건드리지 않고도 모든 로그 앞에 `traceId`가 출력됩니다. `%X{traceId}`처럼 특정 키만 찍을 수도 있고, `%X`로 MDC에 담긴 전체 맵을 출력할 수도 있습니다.

## 동작 원리 — 스레드별 ThreadLocal 맵

MDC가 "코드를 안 건드려도 알아서 따라붙는" 마법처럼 보이는 이유는 내부 구현이 **ThreadLocal**이기 때문입니다. MDC가 보관하는 맵은 전역 변수가 아니라 각 스레드가 따로 가지는 저장소입니다.

![MDC의 정체 — 스레드별 ThreadLocal 맵](/assets/posts/java-mdc-tracing-threadlocal.svg)

`MDC.put`은 현재 요청을 처리 중인 스레드의 맵에만 값을 넣고, 로그를 출력할 때도 그 스레드의 맵을 읽습니다. 그래서 동시에 들어온 두 요청이 서로 다른 스레드에서 처리되면 `traceId`가 섞이지 않습니다. 별도의 동기화 없이도 요청별 격리가 자연스럽게 이루어지는 것입니다.

## 가장 흔한 함정 — 스레드 풀 누수

ThreadLocal 기반이라는 점은 동시에 가장 큰 함정의 원인이기도 합니다. 웹 서버는 스레드를 매 요청마다 새로 만들지 않고 **스레드 풀에서 재사용**합니다. 만약 요청이 끝날 때 MDC를 비우지 않으면, 그 스레드가 다음 요청을 처리할 때 이전 요청의 `traceId`가 그대로 남아 있게 됩니다.

```java
// 잘못된 코드 — clear가 없다
MDC.put("traceId", traceId);
chain.doFilter(req, res);
// 처리 후 정리 안 함 → 같은 스레드의 다음 요청에 traceId 누수
```

그 결과 사용자 A의 요청 로그에 사용자 B의 `traceId`가 찍히는, 추적을 위해 도입한 도구가 오히려 추적을 망가뜨리는 상황이 벌어집니다. 그래서 MDC는 **반드시 `finally`에서 `clear` 또는 `remove`** 해야 한다는 원칙이 따라옵니다. 직접 필터를 짜기보다 검증된 프레임워크 인터셉터를 쓰는 편이 안전한 이유이기도 합니다.

## 비동기·다른 스레드로 넘어갈 때

또 하나 주의할 점은 MDC가 **스레드에 묶여 있다**는 사실입니다. 작업을 다른 스레드로 넘기면(`@Async`, `ExecutorService`, 병렬 스트림 등) 새 스레드에는 부모 스레드의 MDC가 따라가지 않습니다. 컨텍스트를 명시적으로 복사해 넘겨야 합니다.

```java
Map<String, String> context = MDC.getCopyOfContextMap();
executor.submit(() -> {
    if (context != null) MDC.setContextMap(context);
    try {
        log.info("비동기 작업 처리");   // 부모의 traceId가 그대로 붙는다
    } finally {
        MDC.clear();
    }
});
```

`getCopyOfContextMap`으로 현재 컨텍스트를 복사해두고, 작업 스레드 시작 지점에서 `setContextMap`으로 복원하는 패턴입니다. 많은 프레임워크가 이 작업을 감싸주는 데코레이터(예: Spring의 `TaskDecorator`)를 제공하므로, 비동기 처리가 많은 코드라면 그런 장치를 활용하는 것이 좋습니다.

## 정리

MDC는 요청 시작 시점에 `traceId` 같은 식별자를 한 번만 넣어두면 이후 모든 로그에 자동으로 붙여주어, 뒤섞인 운영 로그에서 한 요청의 흐름을 한 줄기로 추적하게 해주는 도구입니다. 내부는 스레드별 ThreadLocal 맵이라 요청 간 격리가 자연스럽지만, 같은 이유로 스레드 풀에서는 `finally`의 `clear`가 필수이고, 다른 스레드로 작업을 넘길 때는 컨텍스트를 직접 복사해야 합니다. 로그를 잘 남기는 것을 넘어 잘 찾는 단계로 가는 첫 도구가 MDC이며, 다음 글부터는 애플리케이션이 데이터와 만나는 지점인 데이터베이스 접근으로 넘어갑니다.

---

**지난 글:** [java.util.logging (JUL) — JDK 내장 로깅](/posts/java-jul/)

**다음 글:** [JDBC 기초 — 자바와 데이터베이스를 잇는 표준](/posts/java-jdbc-basics/)

<br>
읽어주셔서 감사합니다. 😊
