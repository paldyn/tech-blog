---
title: "모듈 서비스 — provides/uses와 ServiceLoader"
description: "JPMS의 서비스 메커니즘은 인터페이스를 사이에 두고 구현 제공자(provides)와 소비자(uses)를 느슨하게 묶습니다. ServiceLoader가 런타임에 구현을 찾아 주입하는 원리와, 플러그인 구조를 모듈로 구현하는 법을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 10
type: "knowledge"
category: "Java"
tags: ["Java", "서비스", "ServiceLoader", "provides", "uses", "JPMS", "플러그인"]
featured: false
draft: false
---

[지난 글](/posts/java-requires-exports/)에서 `requires`와 `exports`로 모듈 사이의 의존과 공개를 제어했습니다. 그런데 이 방식은 소비자가 구현 모듈을 직접 `requires`해야 한다는 한계가 있습니다. "구현이 무엇인지 컴파일 시점엔 모르고, 런타임에 결정하고 싶다" — 즉 플러그인 구조가 필요할 때는 다른 메커니즘이 필요합니다. 그것이 JPMS의 **서비스(service)** 입니다. `provides`/`uses` 지시어와 `ServiceLoader`를 조합하면, 인터페이스를 사이에 두고 제공자와 소비자를 완전히 분리할 수 있습니다. 이번 글은 그 구조와 원리를 정리합니다.

## 문제 — 소비자가 구현을 알면 안 된다

플러그인 아키텍처를 생각해 봅시다. 핵심 애플리케이션은 `Plugin`이라는 인터페이스만 알고, 실제 구현(`PdfPlugin`, `CsvPlugin` 등)은 나중에 끼워 넣고 싶습니다. 구현을 추가·교체해도 핵심 코드는 손대지 않아야 합니다. 만약 소비자가 `requires com.app.pdf-plugin`처럼 구현 모듈을 직접 의존하면, 구현을 바꿀 때마다 소비자 코드와 선언을 고쳐야 합니다 — 결합이 너무 강합니다.

![서비스로 제공자와 소비자를 인터페이스로 분리](/assets/posts/java-services-modules-architecture.svg)

서비스 메커니즘은 이 결합을 끊습니다. 소비자는 인터페이스(`Plugin`)와 "이 서비스를 쓴다(`uses`)"는 선언만 가지고, 구현 모듈은 전혀 모릅니다. 구현 모듈은 "이 인터페이스의 구현을 제공한다(`provides ... with`)"고 선언합니다. 둘을 런타임에 이어 주는 것이 `ServiceLoader`입니다.

## 세 조각 — 인터페이스 · 제공자 · 소비자

서비스는 보통 세 모듈로 나뉩니다. 인터페이스 모듈, 그것을 구현하는 제공자 모듈, 그리고 사용하는 소비자 모듈입니다.

먼저 **인터페이스**(api 모듈)입니다. 평범한 인터페이스이고, 그 패키지를 `exports`합니다.

```java
// com.app.api 모듈
package com.app.api;

public interface Plugin {
    String name();
    void run();
}
```

다음은 **제공자**입니다. 인터페이스를 구현하고, `module-info.java`에서 `provides ... with`로 "이 인터페이스의 구현은 이 클래스다"라고 선언합니다.

```java
// com.app.pdf 모듈의 module-info.java
module com.app.pdf {
    requires com.app.api;
    provides com.app.api.Plugin
        with com.app.pdf.PdfPlugin;   // 구현 등록
}
```

마지막으로 **소비자**입니다. `uses`로 "이 서비스를 소비한다"고 선언하고, 코드에서는 `ServiceLoader`로 구현들을 받아 옵니다.

```java
// com.app.host 모듈의 module-info.java
module com.app.host {
    requires com.app.api;
    uses com.app.api.Plugin;   // 소비 선언
}
```

```java
// 소비자 코드 — 구현 클래스 이름이 전혀 등장하지 않는다
ServiceLoader<Plugin> loader = ServiceLoader.load(Plugin.class);
for (Plugin p : loader) {
    System.out.println("loaded: " + p.name());
    p.run();
}
```

소비자 코드 어디에도 `PdfPlugin`이라는 이름이 없다는 점이 핵심입니다. 소비자는 인터페이스만 알고, 구현은 module path에 어떤 제공자가 있느냐에 따라 런타임에 결정됩니다.

## ServiceLoader가 하는 일

`ServiceLoader.load(Plugin.class)`를 호출하면 내부적으로 다음이 일어납니다.

![ServiceLoader.load의 런타임 동작 흐름](/assets/posts/java-services-modules-serviceloader.svg)

`ServiceLoader`는 모듈 그래프 전체를 훑어 `provides com.app.api.Plugin with ...`을 선언한 모듈들을 모으고, 그 구현 클래스들을 (실제로 순회할 때) **지연 생성(lazy)** 합니다. 결과는 `Iterable<Plugin>`이라 `for` 루프로 모든 구현을 순회할 수 있습니다. 제공자 모듈을 module path에 추가하기만 하면 새 구현이 자동으로 잡히고, 빼면 사라집니다 — 소비자 코드는 그대로입니다. 이것이 플러그인 구조의 토대입니다.

> 서비스는 모듈 시스템 전용이 아닙니다. classpath 환경에서도 `META-INF/services/` 디렉터리에 제공자를 등록하는 전통적인 방식이 `ServiceLoader`와 함께 오래전부터 쓰였습니다(JDBC 드라이버 로딩이 대표적). JPMS는 이 메커니즘을 `module-info.java`의 `provides`/`uses` 선언으로 격상시켜, 모듈 그래프 안에서 1급으로 다루게 한 것입니다.

## 정리

- JPMS 서비스는 인터페이스를 사이에 두고 **제공자(`provides`)** 와 **소비자(`uses`)** 를 분리하는 메커니즘이다.
- 소비자는 구현 모듈을 `requires`하지 않고, 인터페이스와 `uses` 선언만 가진다 — 구현 이름이 코드에 등장하지 않는다.
- 제공자는 `provides 인터페이스 with 구현클래스`로 구현을 등록한다.
- `ServiceLoader.load(...)`가 런타임에 모듈 그래프에서 제공자를 찾아 구현을 지연 생성해 `Iterable`로 돌려준다.
- 제공자를 module path에 넣고 빼는 것만으로 구현을 교체할 수 있어, 플러그인·확장 구조의 토대가 된다.
- classpath의 `META-INF/services` 방식을 모듈 선언으로 격상한 것이 JPMS 서비스다.

---

**지난 글:** [requires와 exports — 모듈 의존과 공개 제어](/posts/java-requires-exports/)

**다음 글:** [jlink — 모듈로 맞춤형 런타임 이미지 만들기](/posts/java-jlink/)

<br>
읽어주셔서 감사합니다. 😊
