---
title: "Java LTS와 릴리즈 사이클"
description: "Java 9부터 도입된 6개월 릴리즈 사이클과 LTS(장기 지원) 버전의 의미, 지원 기간, 벤더별 배포판 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["java", "lts", "release-cycle", "jdk", "openjdk", "java-21", "java-17"]
featured: false
draft: false
---

[지난 글](/posts/java-platform-edition/)에서 Java SE·ME·Jakarta EE 에디션의 역할과 범위를 살펴봤습니다. 이번에는 그 Java SE가 어떤 주기로 버전을 내놓는지, 그리고 수많은 JDK 버전 중에서 어느 것을 선택해야 하는지 이야기합니다. "Java 버전 선택"은 표면적으로 단순해 보이지만, 6개월마다 새 버전이 나오는 지금은 조금 더 체계적으로 이해해야 실수 없이 프로젝트를 운영할 수 있습니다.

---

## Java 9 이전: 3년 주기의 대형 릴리즈

Java 1.0(1996)부터 Java 8(2014)까지는 릴리즈 간격이 2~4년에 달했습니다. 이 방식의 문제는 기능이 오래 기다려야 한다는 것이었습니다. 커뮤니티에서 원하는 기능이 준비되지 않으면 릴리즈 전체가 지연되고, 결국 Java 8 이후 9 출시까지 3년이 걸렸습니다. 이 경험을 통해 OpenJDK 커뮤니티는 릴리즈 방식을 근본적으로 바꾸기로 결정했습니다.

---

## Java 9부터: 6개월 피처 릴리즈

2017년 Java 9부터 **엄격한 6개월 타임박스 모델**이 도입되었습니다. 핵심 원칙은 다음과 같습니다.

- 매년 3월과 9월, 6개월마다 반드시 새 버전을 출시합니다.
- 기능 준비 여부와 관계없이 날짜에 맞춰 릴리즈합니다.
- 준비되지 않은 기능은 다음 버전으로 넘깁니다 (Preview → Standard 두 단계 승격).

이 방식의 장점은 기능이 작은 단위로 빠르게 스탠다드로 승격된다는 점입니다. 예를 들어 Records는 Java 14에서 Preview, 15에서 두 번째 Preview, 16에서 Standard로 정식 도입되었습니다. 사용자는 Preview 단계에서부터 피드백을 줄 수 있습니다.

```java
// Java 14 Preview → Java 16 Standard: Record
// --enable-preview 없이도 Java 16부터 사용 가능
record Point(int x, int y) {}

// Java 17 Preview → Java 21 Standard: Pattern Matching for switch
Object obj = "Hello";
String result = switch (obj) {
    case Integer i -> "정수: " + i;
    case String s  -> "문자열: " + s;
    default        -> "기타";
};
```

---

## LTS(Long-Term Support)란

6개월마다 출시되는 버전 중 일부는 **LTS(Long-Term Support)** 지정을 받습니다. LTS가 아닌 버전은 다음 버전이 출시되면 즉시 지원이 종료됩니다. 즉, 일반 릴리즈의 지원 기간은 **6개월**에 불과합니다.

반면 LTS 버전은 수년간 보안 패치와 버그 수정을 제공받습니다. 이것이 프로덕션 시스템이 LTS를 선호하는 이유입니다.

LTS 지정 주기는 처음에는 3년(8, 11, 17)이었다가, Java 21부터 **2년 주기**(21, 25, 27...)로 변경되었습니다.

| 버전 | 출시 | LTS 여부 | 주요 신기능 |
|---|---|---|---|
| Java 8 | 2014.03 | ✅ LTS | Lambda, Stream, Optional, java.time |
| Java 9 | 2017.09 | ❌ | 모듈 시스템 (Jigsaw) |
| Java 10 | 2018.03 | ❌ | `var` 로컬 변수 타입 추론 |
| Java 11 | 2018.09 | ✅ LTS | HTTP Client, String 메서드, ZGC Preview |
| Java 12–16 | 2019–2021 | ❌ | Records, Text Block, Pattern Matching Preview |
| Java 17 | 2021.09 | ✅ LTS | Sealed Classes, Records 정식, Pattern Matching 정식 |
| Java 18–20 | 2022–2023 | ❌ | Virtual Threads Preview, Structured Concurrency Preview |
| Java 21 | 2023.09 | ✅ LTS | Virtual Threads 정식, Record Patterns, Sequenced Collections |
| Java 25 | 2025.09 예정 | ✅ LTS | (Valhalla 일부, Leyden 등 예상) |

---

## 지원 기간: 배포판별로 다르다

"LTS라서 오래 지원된다"는 말은 맞지만, **누가 지원하느냐**에 따라 기간이 크게 달라집니다.

![LTS vs 일반 릴리즈 지원 기간 비교](/assets/posts/java-lts-release-cycle-support.svg)

### Oracle JDK

Oracle은 Java 11부터 JDK를 **프로덕션 무료** 정책을 바꿨습니다. 현재(Java 17 이후 NFTC 라이선스) Oracle JDK는 프로덕션에서도 무료로 쓸 수 있지만, **기본 무료 지원(Premier)은 5년**, 연장 지원(Extended)은 유료로 3년 추가 제공합니다.

> ⚠️ Oracle JDK 라이선스는 버전마다 조건이 달라져 왔습니다. 사용 전 해당 버전의 라이선스를 반드시 확인하세요. Java 8과 11의 구버전은 유료 라이선스가 적용됩니다.

### OpenJDK (upstream)

OpenJDK.org가 공식 배포하는 빌드는 LTS 버전이라도 **다음 LTS 릴리즈 후 6개월 정도만** 공식 패치를 제공합니다. 이 때문에 실제 프로덕션에서는 OpenJDK 원본보다 벤더 배포판을 쓰는 것이 일반적입니다.

### 벤더 배포판 (권장)

| 배포판 | 주체 | LTS 지원 기간 | 무료 여부 |
|---|---|---|---|
| Eclipse Temurin | Eclipse Adoptium | ~8년 | 무료 |
| Amazon Corretto | Amazon | ~8년 | 무료 |
| Microsoft Build of OpenJDK | Microsoft | ~8년 | 무료 |
| Azul Zulu | Azul | 상업 지원 시 더 길게 | 커뮤니티판 무료 |
| GraalVM CE | Oracle / GraalVM | LTS 기준 | 무료 |

실무에서는 **Eclipse Temurin**(이전 AdoptOpenJDK / Adoptium)과 **Amazon Corretto**가 가장 널리 쓰입니다. 두 배포판 모두 OpenJDK 소스를 그대로 빌드하므로 동작 차이가 없고, 무료로 장기 지원을 받을 수 있습니다.

---

## 릴리즈 타임라인 한눈에

![Java 릴리즈 타임라인](/assets/posts/java-lts-release-cycle-timeline.svg)

---

## 어떤 버전을 써야 하나

### 신규 프로젝트

**Java 21 LTS** 를 기본값으로 선택하십시오. Virtual Threads, Record Patterns, Sequenced Collections 등 현대적인 API가 안정화되어 있고, 주요 프레임워크(Spring Boot 3.x, Quarkus 3.x)가 21을 적극 지원합니다.

```bash
# SDKMAN으로 Java 21 Temurin 설치 예시
sdk install java 21.0.3-tem

# 현재 설치된 Java 버전 확인
java -version
# openjdk version "21.0.3" 2024-04-16 LTS
# OpenJDK Runtime Environment Temurin-21.0.3+9 (...)
```

### 기존 프로젝트 마이그레이션 경로

- **Java 8 사용 중** → Java 17 또는 21로 마이그레이션을 권장합니다. 8→11→17→21 순서로 단계별로 올리거나, 테스트 커버리지가 충분하다면 한 번에 21로 올리는 것도 가능합니다.
- **Java 11 사용 중** → Java 17 혹은 21로 올리세요. 11→17 변경 사항은 대부분 호환되며, `javax.*` → `jakarta.*` 이슈는 Java 버전보다 프레임워크 버전 업그레이드와 더 관련이 있습니다.
- **일반 릴리즈 사용 중** → 프로덕션이라면 즉시 LTS로 전환하세요.

---

## Preview 기능 이해하기

Java는 새 언어 기능을 바로 표준으로 내놓지 않고, 1~3회의 Preview 단계를 거칩니다. Preview 기능을 사용하려면 컴파일과 실행 시 모두 `--enable-preview` 플래그가 필요합니다.

```bash
# Preview 기능 활성화 컴파일 및 실행
javac --enable-preview --release 22 Main.java
java  --enable-preview Main
```

이 플래그 없이는 Preview 기능이 담긴 코드를 컴파일·실행할 수 없습니다. 프로덕션에서 Preview 기능을 쓰는 것은 다음 버전에서 API가 변경될 수 있으므로 권장하지 않습니다.

---

## 정리

- Java 9부터 **6개월 타임박스** 릴리즈 모델로 전환되었습니다.
- 일반 릴리즈는 6개월, **LTS 버전**은 수년간 패치를 받습니다.
- LTS 주기는 처음 3년에서 **2년으로 단축**되었습니다 (Java 21부터).
- 프로덕션에서는 **LTS 버전 + 벤더 배포판(Temurin, Corretto)**을 선택하세요.
- 신규 프로젝트의 기본 선택지는 **Java 21 LTS**입니다.
- Preview 기능은 실험적 단계이며, 프로덕션 사용은 피하는 것이 원칙입니다.

---

**지난 글:** [Java 플랫폼 에디션 — SE · ME · Jakarta EE](/posts/java-platform-edition/)

**다음 글:** [Write Once, Run Anywhere — Java의 플랫폼 독립성](/posts/java-write-once-run-anywhere/)

<br>
읽어주셔서 감사합니다. 😊
