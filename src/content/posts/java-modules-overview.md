---
title: "Java 모듈 시스템 개요 — JPMS란 무엇인가"
description: "Java 9의 모듈 시스템(JPMS, Project Jigsaw)은 classpath의 한계를 해결합니다. 강한 캡슐화로 internal 패키지를 숨기고, requires/exports로 의존성을 명시하며, 빠진 의존성을 시작 시점에 잡아냅니다. JPMS가 푸는 문제와 핵심 개념을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "모듈", "JPMS", "Jigsaw", "캡슐화", "module", "classpath"]
featured: false
draft: false
---

[지난 글](/posts/jvm-mission-control/)까지 JVM의 동작과 진단 도구를 다뤘습니다. 이번 글부터는 Java 9가 도입한 가장 큰 구조적 변화 — **모듈 시스템(JPMS, Java Platform Module System)** — 을 봅니다. 코드명 Project Jigsaw로 개발된 이 기능은 그동안 Java 개발자를 괴롭혀 온 classpath의 근본 문제들을 정면으로 해결합니다. 이번 글은 JPMS가 *왜* 필요했는지, 그리고 *무엇을* 바꿨는지 큰 그림을 잡습니다. 구체적인 문법은 다음 글들에서 다룹니다.

## classpath의 오래된 문제들

Java 8까지 애플리케이션은 모든 JAR을 **classpath**라는 평평한 한 줄에 늘어놓고 실행했습니다. JVM은 클래스를 찾을 때 이 목록을 처음부터 훑습니다. 단순하지만, 규모가 커지면 세 가지 고질병이 드러납니다.

![Classpath와 Module Path의 차이](/assets/posts/java-modules-overview-classpath-vs-module.svg)

- **캡슐화 부재**: JAR 안의 `public` 클래스는 누구에게나 보입니다. 라이브러리 제작자가 "이건 내부 구현이니 쓰지 마"라고 의도한 `internal` 패키지도, `public`이면 외부에서 그냥 import해서 씁니다. 그러다 내부 구현이 바뀌면 그걸 의존하던 코드가 깨집니다.
- **의존성이 런타임에야 터짐**: classpath에는 "이 라이브러리가 무엇을 필요로 하는지"가 적혀 있지 않습니다. 그래서 의존 JAR을 빼먹어도 시작은 됩니다. 그러다 한참 뒤 그 클래스를 처음 로드하는 순간 `NoClassDefFoundError`로 폭발합니다 — 이른바 JAR Hell입니다.
- **split package**: 같은 패키지가 여러 JAR에 쪼개져 있으면 어느 쪽이 로드될지 불안정합니다.

## JPMS의 해법 — 모듈이라는 1급 경계

JPMS는 JAR보다 한 단계 위의 단위인 **모듈(module)** 을 도입합니다. 모듈은 "패키지들의 묶음 + 그 묶음에 대한 메타데이터"입니다. 메타데이터는 `module-info.java`라는 선언 파일에 담기며, 두 가지를 명시합니다. **무엇을 필요로 하는지(`requires`)** 와 **무엇을 공개하는지(`exports`)** 입니다.

```java
// module-info.java — 모듈의 선언
module com.app.service {
    requires com.app.util;        // 이 모듈이 의존하는 모듈
    exports com.app.service.api;  // 외부에 공개하는 패키지
    // service.internal 은 exports 안 함 → 외부에서 접근 불가
}
```

이 선언 덕분에 두 가지가 근본적으로 달라집니다.

## 강한 캡슐화 — exports한 것만 공개

모듈 안의 패키지는 기본적으로 **모듈 내부 전용**입니다. `exports`로 명시한 패키지만 외부 모듈이 접근할 수 있습니다. `public` 클래스라도 그 패키지가 exports되지 않았다면, 다른 모듈에서는 컴파일도 안 되고 리플렉션 접근도 막힙니다.

![모듈 캡슐화 — exports한 패키지만 외부 접근 가능](/assets/posts/java-modules-overview-encapsulation.svg)

이것이 **강한 캡슐화(strong encapsulation)** 입니다. `public`이 더 이상 "전 세계 공개"를 뜻하지 않게 됐습니다. 이제 접근성은 `public/private` 같은 클래스 수준 제어자 위에, 모듈 수준의 `exports`가 한 겹 더 얹힌 2단 구조가 됩니다. 라이브러리 제작자는 진짜 공개 API와 내부 구현을 코드 구조로 강제할 수 있게 됐습니다.

## 신뢰할 수 있는 구성 — 의존성을 시작 시점에 검증

`requires`로 의존성을 명시하면, JVM(과 컴파일러)은 모듈 그래프를 구성하면서 **필요한 모듈이 다 있는지를 시작 시점에 검사**합니다. 빠진 모듈이 있으면 애플리케이션이 한참 돌다가 터지는 게 아니라 시작하자마자 명확한 에러로 알려 줍니다. 런타임 한복판에서 `NoClassDefFoundError`로 터지던 JAR Hell이, 시작 시점의 예측 가능한 실패로 바뀐 것입니다. 이를 "신뢰할 수 있는 구성(reliable configuration)"이라 부릅니다.

> JDK 자체도 모듈로 쪼개졌습니다(`java.base`, `java.sql`, `java.xml` 등). 그래서 `jlink`로 내 애플리케이션이 실제로 쓰는 모듈만 골라 작은 커스텀 런타임을 만들 수 있습니다. 모듈화의 실질적 이득 중 하나입니다.

## 그런데 왜 아직도 classpath를 쓸까

JPMS는 강력하지만 **강제는 아닙니다**. `module-info.java` 없이 평소처럼 classpath로 빌드·실행하면, 모든 코드는 자동으로 이름 없는 모듈(unnamed module)에 들어가 예전처럼 동작합니다. 모듈화는 점진적으로 도입할 수 있도록 설계됐습니다. 그 결과 많은 애플리케이션이 여전히 classpath를 쓰고, 라이브러리·플랫폼·대규모 코드베이스에서 모듈의 가치가 특히 빛납니다.

## 정리

- JPMS(Java 9, Project Jigsaw)는 classpath의 고질병 — 캡슐화 부재, 런타임에 터지는 의존성(JAR Hell), split package — 를 해결한다.
- 핵심 단위는 **모듈**이고, 선언은 `module-info.java`에 `requires`(의존)와 `exports`(공개)로 적는다.
- **강한 캡슐화**: exports한 패키지만 외부 접근 가능. `public`이 더 이상 무조건 공개를 뜻하지 않는다.
- **신뢰할 수 있는 구성**: requires로 의존성을 시작 시점에 검증해, JAR Hell을 예측 가능한 실패로 바꾼다.
- 모듈화는 강제가 아니라 점진 도입이 가능하다 — 그래서 classpath도 여전히 유효하다.
- 다음 글에서는 `module-info.java`의 문법을 본격적으로 본다.

---

**지난 글:** [JDK Mission Control — JFR 기록 분석](/posts/jvm-mission-control/)

**다음 글:** [module-info.java — 모듈 선언 파일 작성하기](/posts/java-module-info/)

<br>
읽어주셔서 감사합니다. 😊
