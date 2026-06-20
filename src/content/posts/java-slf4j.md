---
title: "SLF4J — 로깅 파사드의 표준"
description: "SLF4J는 자바 로깅의 사실상 표준 파사드입니다. 컴파일타임 API와 런타임 바인딩의 구조, 중괄호 플레이스홀더의 성능 이점, 브리지로 레거시 로그를 모으는 법, 그리고 흔한 바인딩 충돌 문제를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-21"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "SLF4J", "로깅", "파사드", "바인딩"]
featured: false
draft: false
---

[지난 글](/posts/java-logging-overview/)에서 자바 로깅이 파사드와 구현의 분리로 이뤄진다는 큰 그림을 그렸습니다. 그 파사드의 사실상 표준이 **SLF4J**(Simple Logging Facade for Java)입니다. 거의 모든 자바 라이브러리가 SLF4J에 로그를 남기고, 애플리케이션은 그 뒤에 어떤 구현을 꽂을지만 결정합니다. 이번 글에서는 SLF4J가 컴파일타임과 런타임을 어떻게 가르는지, 왜 중괄호 플레이스홀더가 중요한지, 레거시 로그를 어떻게 한데 모으는지 살펴봅니다.

## API와 바인딩의 분리

![SLF4J 바인딩 구조 — 컴파일타임 API와 런타임 바인딩](/assets/posts/java-slf4j-binding.svg)

SLF4J의 핵심은 **컴파일타임 의존성과 런타임 의존성을 가르는 것**입니다. 코드는 `slf4j-api`의 `Logger` 인터페이스에만 컴파일타임에 의존합니다. 실제로 로그를 출력하는 구현(바인딩)은 런타임에 클래스패스에서 발견됩니다. SLF4J 2.x부터는 `ServiceLoader` 메커니즘으로 `SLF4JServiceProvider` 구현을 찾습니다.

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class OrderService {
    private static final Logger log =
        LoggerFactory.getLogger(OrderService.class);

    public void place(long orderId) {
        log.info("주문 {} 처리 시작", orderId);
    }
}
```

이 코드는 Logback이든 Log4j 2든 동일합니다. 의존성만 바꾸면 출력 엔진이 교체됩니다. 다만 **클래스패스에 바인딩이 하나도 없으면** SLF4J는 아무것도 출력하지 않는 NOP 모드로 동작하며 경고만 띄웁니다. "분명 로그를 찍었는데 안 나온다"의 흔한 원인이 바로 이 바인딩 누락입니다.

## 플레이스홀더의 성능 이점

![파라미터화 로깅의 이점 — 문자열 연결 vs 플레이스홀더](/assets/posts/java-slf4j-placeholder.svg)

SLF4J가 권장하는 가장 중요한 관습은 **중괄호 플레이스홀더**입니다. 문자열을 `+`로 직접 연결하는 대신 `{}`를 쓰고 인자를 따로 넘깁니다.

```java
// 피해야 할 방식
log.debug("user " + id + " 결과 " + result);

// 권장 방식
log.debug("user {} 결과 {}", id, result);
```

차이는 성능입니다. 문자열 연결 방식은 `log.debug` 호출 전에 자바가 먼저 문자열을 합칩니다. `DEBUG` 레벨이 꺼져 있어 메시지가 버려질 상황에도 연결 비용은 이미 발생합니다. 플레이스홀더 방식은 레벨이 활성화된 경우에만 실제 포맷팅을 수행하므로, 꺼진 레벨의 로그가 거의 공짜가 됩니다.

다만 인자로 넘긴 메서드 호출(`heavyCount()` 같은)은 자바의 평가 규칙상 호출 시점에 실행되므로, 정말 비싼 계산이라면 `log.isDebugEnabled()`로 감싸거나 SLF4J 2.x의 `Supplier` 기반 fluent API를 쓰는 것이 좋습니다.

```java
log.atDebug()
   .addArgument(() -> heavyCount())   // 필요할 때만 평가
   .log("결과 {}");
```

## 레거시 로그를 한데 모으기 — 브리지

현실의 프로젝트에는 SLF4J를 안 쓰는 라이브러리도 섞여 있습니다. 어떤 라이브러리는 JUL을, 어떤 라이브러리는 옛 Apache Commons Logging을 씁니다. SLF4J는 이들을 가로채 자신의 출력으로 돌려보내는 **브리지** 모듈을 제공합니다.

```text
jul-to-slf4j        : java.util.logging  → SLF4J
log4j-over-slf4j    : Log4j 1.x API      → SLF4J
jcl-over-slf4j      : Commons Logging    → SLF4J
```

브리지를 클래스패스에 넣으면 제각각이던 라이브러리 로그가 모두 SLF4J를 거쳐 하나의 구현으로 모입니다. 출력 형식과 파일이 통일되어 운영이 훨씬 수월해집니다.

## 흔한 함정 — 바인딩 충돌

SLF4J에서 가장 자주 겪는 문제는 **바인딩이 여러 개** 잡히는 것입니다. 라이브러리들이 각자 Logback과 Log4j 2 바인딩을 끌고 오면 SLF4J가 경고를 띄웁니다.

```text
SLF4J: Class path contains multiple SLF4J providers.
```

이때는 어떤 구현을 쓸지 정하고 나머지 바인딩 의존성을 빌드 도구의 `exclude`로 제거해야 합니다. 또한 브리지와 바인딩이 순환하지 않도록 주의해야 합니다. 예를 들어 `log4j-over-slf4j`(Log4j→SLF4J)와 Log4j 바인딩을 동시에 넣으면 로그가 무한 루프에 빠질 수 있습니다.

## 정리

SLF4J는 컴파일타임 API(`slf4j-api`)와 런타임 바인딩을 분리해, 코드를 건드리지 않고 로그 구현을 교체하게 해 주는 표준 파사드입니다. 중괄호 플레이스홀더로 꺼진 레벨의 로그 비용을 없애고, 브리지로 레거시 로그까지 한 출력으로 모읍니다. 다만 바인딩이 없거나 중복되면 로그가 사라지거나 충돌하므로 의존성 관리가 중요합니다. 다음 글에서는 SLF4J의 기본 짝꿍이자 스프링 부트 기본 구현인 Logback을 살펴봅니다.

---

**지난 글:** [자바 로깅 개요 — 파편화된 생태계 이해하기](/posts/java-logging-overview/)

**다음 글:** [Logback — SLF4J의 기본 구현체](/posts/java-logback/)

<br>
읽어주셔서 감사합니다. 😊
