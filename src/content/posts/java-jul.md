---
title: "java.util.logging (JUL) — JDK 내장 로깅"
description: "java.util.logging은 외부 의존성 없이 JDK에 내장된 로깅 API입니다. Logger·Handler·Formatter 구조, 낯선 레벨 체계, logging.properties 설정, SLF4J와의 연결, 그리고 언제 쓰고 언제 피해야 하는지를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-21"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "JUL", "java.util.logging", "로깅", "JDK"]
featured: false
draft: false
---

[지난 글](/posts/java-log4j-vulnerability/)에서 Log4Shell 취약점을 통해 외부 로깅 라이브러리가 가진 위험을 살펴봤습니다. 그렇다면 외부 의존성 자체가 없는 로깅은 어떨까요? **java.util.logging**(흔히 JUL)은 JDK 1.4부터 표준 라이브러리에 포함된 로깅 API입니다. 별도 의존성을 추가할 필요가 없다는 것이 가장 큰 매력이지만, 그만큼 한계도 뚜렷합니다. 이번 글에서는 JUL의 구조와 독특한 레벨 체계, 그리고 현실적인 사용 기준을 정리하며 로깅 묶음을 마무리합니다.

## 구조 — Logger, Handler, Formatter

JUL의 구성은 다른 로깅 프레임워크와 개념적으로 닮았습니다. **Logger**가 로그를 받고, **Handler**가 출력 대상(콘솔·파일)을 담당하며, **Formatter**가 출력 형식을 정합니다. 추가 의존성 없이 바로 쓸 수 있습니다.

```java
import java.util.logging.Logger;

public class OrderService {
    private static final Logger log =
        Logger.getLogger(OrderService.class.getName());

    public void place(long orderId) {
        log.info("주문 처리 시작");
        log.fine("상세 진단 정보");   // DEBUG에 해당
    }
}
```

`Logger.getLogger`로 로거를 얻고, 메서드 이름이 곧 레벨입니다. `import` 한 줄 외에 어떤 라이브러리도 필요 없다는 점이 JUL의 정체성입니다.

## 낯선 레벨 체계

![JUL 레벨과 SLF4J 대응 — 이름과 단계가 다르다](/assets/posts/java-jul-levels.svg)

JUL을 처음 보면 가장 당황스러운 부분이 **레벨 이름**입니다. 다른 프레임워크가 `ERROR`·`WARN`·`INFO`·`DEBUG`·`TRACE`를 쓰는 반면, JUL은 `SEVERE`·`WARNING`·`INFO`·`CONFIG`·`FINE`·`FINER`·`FINEST`라는 독자적인 이름을 씁니다. 대략 `SEVERE`가 `ERROR`, `FINE` 이하가 `DEBUG`/`TRACE`에 해당합니다. 이 불일치 때문에 다른 로깅에 익숙한 사람은 코드를 읽을 때 매번 머릿속에서 변환해야 합니다.

## logging.properties 설정

JUL의 설정은 `logging.properties` 파일이나 코드로 합니다. 보통 JVM 시작 시 시스템 프로퍼티로 파일 위치를 지정합니다.

```properties
# 전역 기본 레벨
.level = INFO

# 콘솔 핸들러
handlers = java.util.logging.ConsoleHandler
java.util.logging.ConsoleHandler.level = ALL
java.util.logging.ConsoleHandler.formatter = java.util.logging.SimpleFormatter

# 특정 패키지만 상세 로그
com.paldyn.shop.level = FINE
```

```bash
java -Djava.util.logging.config.file=logging.properties -jar app.jar
```

XML 기반인 Logback·Log4j 2에 비하면 설정이 단순하지만, 롤링 정책이나 비동기 출력 같은 고급 기능은 빈약하고 표현력도 떨어집니다.

## SLF4J 생태계와 연결하기

대부분의 자바 프로젝트는 SLF4J를 중심에 둡니다. 그런데 일부 라이브러리(특히 JDK 내부나 오래된 라이브러리)는 JUL로 로그를 남깁니다. 이때 지난 글에서 본 **브리지**로 JUL 로그를 SLF4J로 끌어올 수 있습니다.

```text
jul-to-slf4j  : JUL의 로그를 가로채 SLF4J로 전달
```

`SLF4JBridgeHandler.install()`을 호출하면 JUL이 남기는 로그가 모두 SLF4J를 거쳐 Logback 같은 구현으로 모입니다. 덕분에 JUL을 쓰는 라이브러리가 섞여 있어도 출력 형식과 파일을 통일할 수 있습니다.

## 언제 쓰고 언제 피할까

![JUL을 언제 쓰고 언제 피할까 — 의존성 없음의 대가](/assets/posts/java-jul-tradeoff.svg)

JUL의 장점은 명확합니다. **JDK에 내장되어 의존성이 전혀 필요 없습니다.** 외부 라이브러리 사용이 제한된 환경, 아주 작은 유틸리티나 자바 에이전트, 의존성을 최소화하고 싶은 도구에는 JUL이 합리적입니다.

반대로 단점도 분명합니다. 설정과 성능이 빈약하고, 레벨 이름이 낯설며, 생태계 통합이 불편합니다. 그래서 일반적인 백엔드 서비스라면 굳이 JUL을 고르기보다 **SLF4J + Logback** 조합을 쓰는 것이 정석입니다. 정리하면, "의존성 0"이 무엇보다 중요한 특수 상황에서만 JUL을 택하고, 그 외에는 표준 조합을 따르는 것이 좋습니다.

## 정리

java.util.logging은 JDK에 내장되어 의존성 없이 바로 쓸 수 있는 로깅 API로, Logger·Handler·Formatter 구조를 가지지만 `SEVERE`·`FINE` 같은 독자적 레벨 이름과 빈약한 설정·성능이라는 한계가 있습니다. 의존성을 극도로 줄여야 하는 작은 도구에는 유용하고, 일반 서비스에서는 `jul-to-slf4j` 브리지로 SLF4J 생태계에 흡수시키는 편이 낫습니다. 이로써 자바 로깅 생태계 — 개요부터 SLF4J, Logback, Log4j 2, 보안 사고, 그리고 JUL까지 — 를 한 바퀴 돌아봤습니다. 코드는 SLF4J에 의존하고 구현은 상황에 맞게 고르는 것, 이 한 문장이 자바 로깅의 핵심입니다.

---

**지난 글:** [Log4Shell — Log4j 2 원격 코드 실행 취약점](/posts/java-log4j-vulnerability/)

**다음 글:** [MDC로 로그 추적하기 — 요청을 처음부터 끝까지 잇는 컨텍스트](/posts/java-mdc-tracing/)

<br>
읽어주셔서 감사합니다. 😊
