---
title: "module-info.java — 모듈 선언 파일 작성하기"
description: "module-info.java는 모듈의 정체를 선언하는 특별한 소스 파일입니다. 모듈 루트에 두는 위치 규칙, 모듈 이름 짓는 관례, requires·exports·opens·uses·provides 지시어의 역할, 그리고 컴파일과 실행 방법까지 모듈 선언의 기본기를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "module-info", "모듈", "JPMS", "module 선언", "exports", "requires"]
featured: false
draft: false
---

[지난 글](/posts/java-modules-overview/)에서 JPMS가 강한 캡슐화와 신뢰할 수 있는 구성을 제공한다는 큰 그림을 봤습니다. 그 모든 것이 시작되는 곳이 바로 **`module-info.java`** 입니다. 이 파일 하나가 "이 코드 묶음은 하나의 모듈이고, 이름은 무엇이며, 무엇에 의존하고, 무엇을 공개한다"를 선언합니다. 이번 글은 이 특별한 파일을 어디에 두고, 어떻게 이름 짓고, 어떤 지시어를 쓰며, 어떻게 컴파일·실행하는지 — 모듈 선언의 기본기를 정리합니다.

## 특별한 소스 파일

`module-info.java`는 보통의 `.java` 파일과 다릅니다. 클래스나 인터페이스를 담지 않고, `module` 선언만 담습니다. 그리고 위치가 정해져 있습니다 — **모듈의 소스 루트(최상위)** 에 두어야 합니다.

![module-info.java의 위치와 패키지 구조](/assets/posts/java-module-info-layout.svg)

위 구조에서 `com.app.service/`가 모듈 디렉터리이고, 그 바로 아래에 `module-info.java`가, 그 아래로 실제 패키지 트리(`com/app/service/...`)가 놓입니다. 한 모듈에는 `module-info.java`가 **정확히 하나** 있습니다. 컴파일하면 `module-info.class`가 되어 모듈의 메타데이터로 런타임에 읽힙니다.

## 모듈 이름 짓기

모듈 이름은 전역에서 유일해야 하므로, 패키지처럼 **역도메인(reverse-DNS) 표기**를 권장합니다(`com.app.service`처럼). 이름은 `_`나 키워드 같은 제약만 지키면 자유지만, 실무에서는 그 모듈의 대표 패키지 이름과 맞추는 게 일반적입니다. 모듈 이름은 단순한 라벨이 아니라 — 다른 모듈이 `requires`로 참조하는 **공개 식별자**이므로, 한번 정하면 바꾸기 어렵다는 점을 염두에 두고 신중히 짓습니다.

```java
// 모듈 선언의 기본 형태 — 클래스가 아니라 module 블록만 담는다
module com.app.service {
    requires com.app.util;        // 의존
    exports com.app.service.api;  // 공개
}
```

## 다섯 가지 핵심 지시어

`module { }` 블록 안에는 몇 가지 지시어(directive)를 적습니다. 각각 역할이 분명합니다.

![module-info.java의 주요 지시어](/assets/posts/java-module-info-directives.svg)

- **`requires`**: 이 모듈이 의존하는 다른 모듈. 여기 적은 모듈만 사용할 수 있습니다. `requires transitive`로 적으면, 이 모듈을 쓰는 쪽도 그 의존을 자동으로 함께 보게 됩니다(전이 의존).
- **`exports`**: 외부 모듈에 공개할 패키지. 컴파일과 런타임 모두에서 접근이 열립니다. 적지 않은 패키지는 모듈 내부 전용입니다.
- **`opens`**: 리플렉션 접근을 허용할 패키지. JSON 매핑·DI·ORM처럼 리플렉션으로 private 멤버에 접근하는 프레임워크를 위해 따로 엽니다(`exports`와 구분되는 개념).
- **`uses` / `provides ... with`**: 서비스 로딩 메커니즘과 연결됩니다. `uses`는 "이 서비스 인터페이스를 소비한다", `provides ... with`는 "이 인터페이스의 구현을 제공한다"를 선언합니다.

이 글에서는 각 지시어가 *무엇인지*만 짚습니다. `requires`와 `exports`의 세부(전이 의존, qualified exports 등)는 다음 글에서, 서비스(`uses`/`provides`)는 그다음 글에서 자세히 다룹니다.

## 컴파일과 실행

모듈을 컴파일·실행할 때는 classpath 대신 **module path(`--module-path` 또는 `-p`)** 를 씁니다.

```bash
# 컴파일 — module-info.java를 포함해 모듈 단위로 빌드
javac -d out/com.app.service \
      $(find src/com.app.service -name "*.java")

# 실행 — module path에서 모듈/메인클래스를 지정 (-m 모듈명/클래스)
java --module-path out \
     -m com.app.service/com.app.service.api.Main
```

핵심 차이는 `-cp`(classpath)가 아니라 `-p`(module path)를 쓰고, 실행 대상을 `모듈이름/메인클래스` 형식으로 지정한다는 점입니다. JVM은 이 module path에서 모듈 그래프를 구성하고, `requires`가 만족되는지 시작 시점에 검증한 뒤 실행합니다.

> 모듈 그래프가 의도대로 짜였는지 확인하려면 `java --describe-module com.app.service`로 그 모듈의 선언을 출력해 보거나, `jdeps` 도구로 의존성을 분석할 수 있습니다. 마이그레이션 초기에 특히 유용합니다.

## 정리

- `module-info.java`는 클래스가 아니라 `module` 선언만 담는 특별한 파일로, **모듈 소스 루트에 정확히 하나** 둔다.
- 모듈 이름은 역도메인 표기를 권장하며, 다른 모듈이 `requires`로 참조하는 공개 식별자다.
- 핵심 지시어: `requires`(의존)·`exports`(공개)·`opens`(리플렉션 허용)·`uses`/`provides`(서비스).
- 컴파일·실행은 classpath(`-cp`)가 아니라 **module path(`-p`)** 로 하고, `-m 모듈/메인클래스`로 실행한다.
- `--describe-module`·`jdeps`로 모듈 구성을 점검할 수 있다.
- 다음 글에서는 가장 자주 쓰는 `requires`와 `exports`를 깊이 본다.

---

**지난 글:** [Java 모듈 시스템 개요 — JPMS란 무엇인가](/posts/java-modules-overview/)

**다음 글:** [requires와 exports — 모듈 의존과 공개 제어](/posts/java-requires-exports/)

<br>
읽어주셔서 감사합니다. 😊
