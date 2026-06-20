---
title: "Log4j 2 — 비동기 로깅과 고성능"
description: "Log4j 2는 Disruptor 기반 비동기 로깅과 가비지 프리 모드로 높은 처리량을 제공하는 로깅 구현입니다. 아키텍처, log4j2.xml 설정, 비동기 로깅 원리, Logback과의 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-21"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Log4j2", "로깅", "비동기", "성능"]
featured: false
draft: false
---

[지난 글](/posts/java-logback/)에서 Logback의 구조와 설정을 살펴봤습니다. Logback이 비동기 Appender로 I/O 지연을 줄였지만, 더 극단적인 처리량이 필요한 환경에서는 한 발 더 나아간 구현이 있습니다. **Log4j 2**입니다. 옛 Log4j 1을 완전히 새로 설계한 것으로, LMAX Disruptor를 활용한 비동기 로깅과 가비지 프리 모드로 높은 성능을 자랑합니다. 이번 글에서는 Log4j 2가 어떻게 성능을 끌어올리는지, 그리고 언제 Logback 대신 이것을 택해야 하는지 정리합니다.

## 아키텍처 — 익숙한 개념, 다른 엔진

Log4j 2의 구성요소는 Logback과 개념적으로 비슷합니다. `Logger`가 로그를 받고, `Appender`가 출력하며, `Layout`(Logback의 Encoder에 해당)이 포맷합니다. 다만 내부 구현이 훨씬 성능 지향적입니다. 설정 파일은 `log4j2.xml`을 사용합니다.

```xml
<Configuration status="WARN">
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d{HH:mm:ss.SSS} [%t] %-5level %logger{36} - %msg%n"/>
        </Console>
    </Appenders>
    <Loggers>
        <Logger name="com.paldyn.shop" level="debug"/>
        <Root level="info">
            <AppenderRef ref="Console"/>
        </Root>
    </Loggers>
</Configuration>
```

SLF4J를 파사드로 쓴다면 코드는 그대로 두고 `log4j-slf4j2-impl` 바인딩만 클래스패스에 넣으면 됩니다. 즉 애플리케이션 코드는 Logback을 쓸 때와 한 줄도 다르지 않습니다.

## 비동기 로깅의 핵심 — Disruptor

![Log4j 2 비동기 로깅 — Disruptor 기반 무잠금 큐](/assets/posts/java-log4j2-async.svg)

Log4j 2의 가장 큰 차별점은 **비동기 로깅**입니다. Logback의 `AsyncAppender`가 일반 블로킹 큐를 쓰는 반면, Log4j 2는 LMAX **Disruptor**라는 무잠금(lock-free) 링버퍼를 사용합니다. 애플리케이션 스레드는 로그 이벤트를 링버퍼에 넣고 즉시 반환하며, 별도의 로깅 스레드가 그것을 소비해 실제로 출력합니다. 잠금 경합이 거의 없어, 여러 스레드가 동시에 로그를 쏟아 내는 고부하 환경에서 처리량이 크게 오릅니다.

전체 로거를 비동기로 만들려면 시스템 프로퍼티 하나로 켭니다.

```properties
-Dlog4j2.contextSelector=org.apache.logging.log4j.core.async.AsyncLoggerContextSelector
```

이 모드에서는 모든 로깅 호출이 비동기로 처리되어, 동기 로깅 대비 수 배의 처리량을 보이는 벤치마크도 있습니다.

## 가비지 프리 모드

고성능 환경에서 또 하나의 적은 **GC**입니다. 로그를 남길 때마다 임시 객체가 생기면 가비지 컬렉션 압박이 커지고, 이는 지연 스파이크로 이어집니다. Log4j 2의 가비지 프리 모드는 로그 이벤트를 처리하며 객체를 재사용해, 정상 동작 중 거의 새 객체를 만들지 않습니다. 지연에 극도로 민감한 시스템(금융 거래, 실시간 처리)에서 의미 있는 차이를 만듭니다.

## Logback과의 선택 기준

![Log4j 2 vs Logback — 언제 무엇을 택할까](/assets/posts/java-log4j2-vs-logback.svg)

그렇다면 항상 Log4j 2를 써야 할까요? 아닙니다. 대부분의 일반적인 웹 서비스에서는 Logback으로 충분하고, 스프링 부트의 기본값이라 설정도 익숙합니다. Log4j 2의 비동기·가비지 프리 이점은 **로그량이 매우 많거나 지연에 민감한** 특수한 환경에서 빛을 발합니다.

선택 기준을 정리하면, 평범한 서비스라면 Logback의 단순함과 기본 통합을 누리고, 초당 수십만 건의 로그를 다루거나 지연 스파이크를 극도로 줄여야 한다면 Log4j 2의 비동기 로깅을 검토하는 것이 합리적입니다. 둘 다 SLF4J 뒤에 꽂히므로, 나중에 바꾸더라도 애플리케이션 코드는 건드릴 필요가 없습니다.

## 정리

Log4j 2는 Logback과 같은 개념(Logger·Appender·Layout)을 쓰면서도, Disruptor 기반 무잠금 비동기 로깅과 가비지 프리 모드로 높은 처리량과 낮은 지연을 제공합니다. SLF4J 바인딩만 교체하면 코드 변경 없이 도입할 수 있습니다. 다만 대부분의 서비스에는 Logback으로 충분하므로, 성능이 정말 병목일 때 선택지로 고려하면 됩니다. 그런데 이 강력한 Log4j 2가 한때 인터넷 전체를 뒤흔든 보안 사고의 진원지이기도 했습니다. 다음 글에서 그 Log4Shell 취약점을 다룹니다.

---

**지난 글:** [Logback — SLF4J의 기본 구현체](/posts/java-logback/)

**다음 글:** [Log4Shell — Log4j 2 원격 코드 실행 취약점](/posts/java-log4j-vulnerability/)

<br>
읽어주셔서 감사합니다. 😊
