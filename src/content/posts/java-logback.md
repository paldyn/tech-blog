---
title: "Logback — SLF4J의 기본 구현체"
description: "Logback은 SLF4J 제작자가 만든 로깅 구현으로 스프링 부트의 기본값입니다. Logger·Appender·Encoder의 구조, logback.xml 설정, 롤링 파일 정책, 그리고 운영에서 중요한 패턴 레이아웃과 비동기 출력을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-21"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "Logback", "로깅", "Appender", "스프링 부트"]
featured: false
draft: false
---

[지난 글](/posts/java-slf4j/)에서 SLF4J가 파사드로서 어떻게 동작하는지 살펴봤습니다. 이제 그 뒤에 실제로 꽂히는 구현을 볼 차례입니다. 가장 널리 쓰이는 구현이 **Logback**입니다. SLF4J를 만든 같은 개발자(Ceki Gülcü)가 옛 Log4j 1의 후속으로 설계했고, SLF4J와 자연스럽게 맞물리며 별도 바인딩 어댑터 없이 동작합니다. 스프링 부트의 기본 로깅 구현이기도 해서, 대부분의 자바 백엔드 개발자가 알게 모르게 매일 쓰고 있습니다.

## 세 가지 핵심 구성요소

![Logback 핵심 구성요소 — Logger, Appender, Encoder](/assets/posts/java-logback-architecture.svg)

Logback의 설정을 이해하려면 세 가지 개념을 알아야 합니다. **Logger**는 로그를 받아 레벨을 판단하는 주체로, 패키지 이름을 따라 계층(`com.paldyn` → `com.paldyn.shop`)을 이루며 상위 설정을 상속합니다. **Appender**는 로그를 어디로 보낼지 정하는 출력 대상으로, 콘솔·파일·소켓 등이 있습니다. **Encoder**는 로그를 어떤 형식의 문자열(또는 JSON)로 변환할지 정합니다. 하나의 Logger는 여러 Appender에 동시에 출력할 수 있어, 같은 로그를 콘솔과 파일에 함께 남기는 식의 구성이 가능합니다.

## logback.xml 기본 설정

설정은 클래스패스 루트의 `logback.xml`(스프링 부트라면 `logback-spring.xml`)에 작성합니다.

```xml
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <logger name="com.paldyn.shop" level="DEBUG"/>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
    </root>
</configuration>
```

`root` Logger가 기본 레벨을 `INFO`로 잡고, `com.paldyn.shop` 패키지만 `DEBUG`로 낮춰 그 부분만 상세 로그를 켭니다. 패턴의 `%d`는 시각, `%thread`는 스레드, `%-5level`은 5칸 정렬한 레벨, `%logger{36}`은 축약한 로거 이름, `%msg`는 메시지를 의미합니다.

## 롤링 파일 — 디스크 사고 방지

![롤링 파일 정책 — 날짜·크기로 나누고 오래된 것은 삭제](/assets/posts/java-logback-rolling.svg)

운영에서 파일로 로그를 남길 때 가장 중요한 것은 **롤링 정책**입니다. 한 파일에 계속 쓰면 파일이 무한정 커져 디스크를 가득 채웁니다. `RollingFileAppender`는 날짜나 크기 기준으로 파일을 나누고, 오래된 파일을 압축·삭제합니다.

```xml
<appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
    <file>logs/app.log</file>
    <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
        <fileNamePattern>logs/app-%d{yyyy-MM-dd}.%i.gz</fileNamePattern>
        <maxFileSize>100MB</maxFileSize>
        <maxHistory>30</maxHistory>
        <totalSizeCap>3GB</totalSizeCap>
    </rollingPolicy>
    <encoder>
        <pattern>%d %-5level [%thread] %logger - %msg%n</pattern>
    </encoder>
</appender>
```

`maxHistory`로 보관 기간을, `totalSizeCap`으로 전체 용량 상한을 둡니다. 이 두 설정이 "로그 때문에 서버 디스크가 꽉 찼다"는 흔한 운영 사고를 막아 줍니다.

## 비동기 출력으로 지연 줄이기

파일 쓰기는 I/O라서, 로그를 호출한 스레드가 디스크 쓰기를 기다리면 응답이 느려질 수 있습니다. `AsyncAppender`로 감싸면 로그를 큐에 넣고 별도 스레드가 처리하므로, 애플리케이션 스레드는 즉시 반환됩니다.

```xml
<appender name="ASYNC" class="ch.qos.logback.classic.AsyncAppender">
    <appender-ref ref="FILE"/>
    <queueSize>4096</queueSize>
    <discardingThreshold>0</discardingThreshold>
</appender>
```

다만 큐가 가득 차면 기본적으로 낮은 레벨 로그를 버리므로, 모든 로그를 반드시 보존해야 한다면 `discardingThreshold`를 `0`으로 두어 폐기를 막아야 합니다. 더 높은 처리량이 필요하면 다음 글의 Log4j 2가 제공하는 비동기 로깅을 고려할 수 있습니다.

## 정리

Logback은 SLF4J와 매끄럽게 맞물리는 기본 구현으로, Logger·Appender·Encoder의 조합으로 "무엇을, 어디로, 어떤 형식으로" 출력할지 선언합니다. `logback.xml`로 레벨과 출력을 구성하고, 롤링 파일 정책으로 디스크를 보호하며, 비동기 Appender로 I/O 지연을 줄입니다. 스프링 부트의 기본값인 만큼 가장 먼저 익혀 둘 구현입니다. 다음 글에서는 더 높은 성능을 노리는 Log4j 2를 살펴봅니다.

---

**지난 글:** [SLF4J — 로깅 파사드의 표준](/posts/java-slf4j/)

**다음 글:** [Log4j 2 — 비동기 로깅과 고성능](/posts/java-log4j2/)

<br>
읽어주셔서 감사합니다. 😊
