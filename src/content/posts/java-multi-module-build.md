---
title: "멀티 모듈 빌드 — 프로젝트를 모듈로 나누기"
description: "프로젝트가 커지면 하나의 거대한 모듈은 빌드와 유지보수를 어렵게 만듭니다. 멀티 모듈 빌드로 domain·service·web을 분리하고, settings.gradle.kts와 project() 의존으로 모듈을 조립하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "Gradle", "멀티 모듈", "빌드", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/java-gradle-vs-maven/)에서 Maven과 Gradle을 비교하며 Gradle이 대형·멀티 모듈 프로젝트에 강하다는 점을 짚었습니다. 이번 글에서는 그 멀티 모듈 빌드를 실제로 구성해 봅니다. 프로젝트가 커질수록 모든 코드를 하나의 모듈에 몰아넣는 방식은 빌드 시간, 컴파일 의존성, 그리고 무엇보다 **아키텍처 경계**를 흐리게 만듭니다. 모듈로 나누면 빌드가 빨라지고 책임이 명확해집니다.

## 왜 모듈로 나누는가

단일 모듈 프로젝트에서는 컨트롤러가 리포지토리를 직접 호출하고, 도메인 객체가 웹 어노테이션에 의존하는 등 계층 간 경계가 쉽게 무너집니다. 컴파일러는 같은 모듈 안의 어떤 클래스든 참조를 허용하기 때문입니다.

멀티 모듈로 나누면 **모듈 경계가 곧 컴파일 경계**가 됩니다. `domain` 모듈이 `web` 모듈을 의존하지 않도록 빌드 설정으로 강제하면, 도메인 코드에서 실수로 컨트롤러를 참조하는 일 자체가 컴파일 에러가 됩니다. 아키텍처 규칙을 빌드 도구가 지켜 주는 셈입니다. 부수적으로, 변경되지 않은 모듈은 다시 빌드하지 않으므로 빌드 속도도 빨라집니다.

## 전형적인 모듈 구조

![멀티 모듈 구조 — root와 domain·service·web 모듈, 단방향 의존](/assets/posts/java-multi-module-build-structure.svg)

가장 흔한 구성은 계층에 따라 모듈을 나누는 방식입니다.

- **`:domain`**: 엔티티와 순수 비즈니스 규칙. 다른 모듈에 의존하지 않는 가장 안쪽 모듈입니다.
- **`:service`**: 유스케이스와 트랜잭션 경계. `domain`을 의존합니다.
- **`:web`**: 컨트롤러와 애플리케이션 진입점. `service`를 의존합니다.

의존 방향은 항상 **바깥에서 안쪽으로(web → service → domain)** 단방향이어야 합니다. 안쪽 모듈일수록 변하지 않고 안정적이며, 순환 의존(`domain`이 다시 `web`을 참조)은 Gradle이 빌드 시 에러로 차단합니다. 이 단방향 규칙이 멀티 모듈 설계의 핵심입니다.

## settings.gradle.kts로 모듈 포함하기

![멀티 모듈 설정 — settings.gradle.kts의 include와 web 모듈의 project 의존](/assets/posts/java-multi-module-build-config.svg)

루트 프로젝트의 `settings.gradle.kts`가 어떤 모듈이 빌드에 참여하는지 선언합니다.

```kotlin
// settings.gradle.kts
rootProject.name = "shop"

include(
    "domain",
    "service",
    "web"
)
```

`include`에 적은 이름은 디렉터리 이름과 일치해야 하며, Gradle은 각 디렉터리에서 `build.gradle.kts`를 찾아 모듈로 인식합니다. 프로젝트 루트의 디렉터리 구조는 다음과 같습니다.

```text
shop/
├── settings.gradle.kts
├── build.gradle.kts        // 루트 공통 설정
├── domain/
│   └── build.gradle.kts
├── service/
│   └── build.gradle.kts
└── web/
    └── build.gradle.kts
```

## 모듈 간 의존 선언

한 모듈이 다른 모듈을 참조할 때는 `project()`를 사용합니다. `web` 모듈이 `service`를 의존하도록 선언해 봅시다.

```kotlin
// web/build.gradle.kts
dependencies {
    implementation(project(":service"))
}
```

`project(":service")`는 외부 라이브러리가 아니라 **같은 빌드 안의 다른 모듈**을 가리킵니다. `service` 모듈의 코드가 바뀌면 `web`도 함께 재빌드되며, Gradle이 모듈 간 빌드 순서를 자동으로 결정합니다.

## 공통 설정 한 곳에서 관리하기

모든 모듈이 같은 자바 버전, 같은 테스트 라이브러리를 쓴다면 루트 `build.gradle.kts`에서 한 번에 설정할 수 있습니다.

```kotlin
// build.gradle.kts (루트)
subprojects {
    apply(plugin = "java")

    repositories { mavenCentral() }

    dependencies {
        "testImplementation"("org.junit.jupiter:junit-jupiter:5.10.0")
    }
}
```

`subprojects` 블록은 모든 하위 모듈에 동일한 설정을 적용합니다. 다만 이 방식은 모듈 간 결합을 만들기 때문에, 최근 Gradle에서는 **컨벤션 플러그인**(`buildSrc`나 별도 빌드 로직 모듈)으로 공통 설정을 추출하는 방식을 더 권장합니다. 규모가 작다면 `subprojects`로 시작해도 충분합니다.

## 정리

멀티 모듈 빌드는 큰 프로젝트를 책임 단위로 나눠 빌드 속도와 아키텍처 경계를 동시에 챙기는 방법입니다. `settings.gradle.kts`의 `include`로 모듈을 등록하고, `project(":모듈명")`으로 모듈 간 의존을 단방향으로 선언하면 됩니다. 모듈 경계가 컴파일 경계가 되어 잘못된 의존을 빌드 단계에서 막아 준다는 점이 가장 큰 이점입니다. 다음 글에서는 여러 모듈에 흩어진 의존성 버전을 한 곳에서 관리하는 BOM을 다루겠습니다.

---

**지난 글:** [Gradle vs Maven — 무엇을 선택할까](/posts/java-gradle-vs-maven/)

**다음 글:** [BOM — 의존성 버전 한 곳에서 관리하기](/posts/java-bom/)

<br>
읽어주셔서 감사합니다. 😊
