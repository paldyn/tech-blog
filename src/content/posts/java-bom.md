---
title: "BOM — 의존성 버전 한 곳에서 관리하기"
description: "여러 라이브러리의 버전을 일일이 맞추다 보면 충돌과 비호환이 생깁니다. BOM(Bill of Materials)으로 호환되는 버전 묶음을 한 번에 선언하고, Maven dependencyManagement와 Gradle platform으로 적용하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "BOM", "의존성 관리", "Maven", "Gradle"]
featured: false
draft: false
---

[지난 글](/posts/java-multi-module-build/)에서 프로젝트를 여러 모듈로 나누는 멀티 모듈 빌드를 다뤘습니다. 모듈이 늘어나고 외부 라이브러리가 쌓이면 새로운 골칫거리가 생깁니다. 바로 **버전 관리**입니다. Jackson 하나만 써도 `jackson-databind`, `jackson-core`, `jackson-annotations` 같은 여러 아티팩트의 버전을 서로 맞춰야 하고, 모듈마다 다른 버전을 쓰면 런타임에서 묘한 오류가 터집니다. 이 문제를 깔끔하게 푸는 도구가 **BOM**입니다.

## BOM이란

BOM은 **Bill of Materials**, 우리말로 "자재 명세서"입니다. 제조업에서 제품 하나를 만드는 데 필요한 부품과 수량을 적은 목록을 뜻하는데, 빌드 도구에서는 **서로 호환되는 라이브러리들의 버전 묶음**을 의미합니다.

BOM은 그 자체로는 코드를 담지 않습니다. 오직 "이 라이브러리는 이 버전을 써야 호환된다"는 버전 정보만 담은 특수한 POM 파일입니다. 라이브러리 제작자가 직접 검증한 호환 조합을 BOM으로 배포하면, 사용자는 개별 버전을 고민할 필요 없이 BOM 하나만 가져오면 됩니다.

## BOM이 해결하는 문제

![BOM 개념 — 개별 의존성의 버전을 생략하면 BOM이 호환 버전을 채움](/assets/posts/java-bom-concept.svg)

BOM 없이 Jackson을 쓴다고 해 봅시다.

```kotlin
implementation("com.fasterxml.jackson.core:jackson-databind:2.17.0")
implementation("com.fasterxml.jackson.core:jackson-core:2.16.1")        // 실수!
implementation("com.fasterxml.jackson.core:jackson-annotations:2.15.0") // 실수!
```

세 아티팩트의 버전이 제각각입니다. 이렇게 섞이면 `NoSuchMethodError` 같은 런타임 오류가 발생할 수 있습니다. BOM을 도입하면 개별 의존성의 **버전을 생략**하고, BOM이 일괄적으로 검증된 버전(`2.17.0`)을 채워 줍니다. 버전 충돌이 원천적으로 사라지고, 전체 업그레이드는 BOM 버전 한 줄만 바꾸면 됩니다.

## Maven에서 BOM 가져오기

![BOM 사용법 — Maven dependencyManagement와 Gradle platform 비교](/assets/posts/java-bom-usage.svg)

Maven에서는 `<dependencyManagement>` 안에서 BOM을 `import` 스코프로 가져옵니다.

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.fasterxml.jackson</groupId>
      <artifactId>jackson-bom</artifactId>
      <version>2.17.0</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
```

`<type>pom</type>`과 `<scope>import</scope>`가 핵심입니다. 이렇게 가져오면 실제 `<dependencies>`에서는 버전 없이 아티팩트만 선언하면 됩니다.

```xml
<dependencies>
  <dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <!-- version 생략 — BOM이 결정 -->
  </dependency>
</dependencies>
```

## Gradle에서 BOM 가져오기

Gradle에서는 `platform()`으로 BOM을 선언합니다.

```kotlin
dependencies {
    // BOM 가져오기
    implementation(platform("com.fasterxml.jackson:jackson-bom:2.17.0"))

    // 버전 생략 — BOM이 채움
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.core:jackson-annotations")
}
```

`platform()`으로 가져온 BOM은 버전을 강제하지 않고 **권장**합니다. 만약 다른 의존성이 더 높은 버전을 요구하면 Gradle의 버전 충돌 해소 규칙에 따라 조정됩니다. 버전을 강하게 고정하고 싶다면 `enforcedPlatform()`을 쓰면 됩니다.

## Spring Boot BOM — 가장 친숙한 사례

많은 개발자가 자기도 모르게 BOM을 쓰고 있습니다. **Spring Boot**가 대표적입니다. `spring-boot-dependencies` BOM은 Spring, Jackson, Hibernate, 로깅 라이브러리 등 수백 개 의존성의 호환 버전을 관리합니다. Spring Boot 프로젝트에서 라이브러리 버전을 적지 않아도 잘 동작하는 이유가 바로 이 BOM 덕분입니다.

```kotlin
dependencies {
    implementation(platform("org.springframework.boot:spring-boot-dependencies:3.3.0"))
    implementation("org.springframework.boot:spring-boot-starter-web") // 버전 없음
}
```

Spring Boot를 업그레이드할 때 BOM 버전 하나만 올리면 수백 개 의존성이 검증된 조합으로 함께 올라가는 것이 BOM의 진가입니다.

## 정리

BOM은 호환되는 라이브러리 버전 묶음을 한 곳에서 선언해, 버전 충돌과 비호환 조합을 막아 주는 도구입니다. Maven은 `dependencyManagement`의 `import` 스코프로, Gradle은 `platform()`으로 BOM을 가져오며, 개별 의존성에서는 버전을 생략합니다. Spring Boot BOM처럼 잘 만들어진 BOM은 대규모 의존성 관리의 복잡함을 한 줄로 줄여 줍니다. 다음 글부터는 빌드된 코드를 검증하는 테스트의 세계로 넘어가, JUnit 5부터 시작하겠습니다.

---

**지난 글:** [멀티 모듈 빌드 — 프로젝트를 모듈로 나누기](/posts/java-multi-module-build/)

**다음 글:** [JUnit 5 입문 — 현대 자바 테스트의 표준](/posts/java-junit5-basics/)

<br>
읽어주셔서 감사합니다. 😊
