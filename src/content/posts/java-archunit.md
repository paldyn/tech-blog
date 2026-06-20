---
title: "ArchUnit — 아키텍처를 테스트로 강제하기"
description: "레이어 의존성 규칙은 문서에만 적어 두면 시간이 지나며 무너집니다. ArchUnit으로 패키지 의존 방향, 네이밍 규칙, 순환 참조 금지를 단위 테스트처럼 검증하고 CI에서 자동으로 강제하는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-21"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "ArchUnit", "아키텍처", "테스트", "의존성"]
featured: false
draft: false
---

[지난 글](/posts/java-testcontainers/)에서 진짜 의존성을 상대로 통합 테스트하는 법을 살펴봤습니다. 테스트가 동작을 검증한다면, **아키텍처 규칙**은 어떻게 지킬까요? "컨트롤러는 리포지토리를 직접 호출하지 않는다", "도메인 패키지는 인프라 패키지에 의존하지 않는다" 같은 규칙은 보통 위키 문서나 코드 리뷰어의 기억에만 존재합니다. 사람이 지키는 규칙은 새 팀원이 들어오고 마감이 닥치면 슬그머니 무너집니다. **ArchUnit**은 이런 아키텍처 규칙을 단위 테스트처럼 코드로 작성해, CI가 매번 자동으로 강제하게 해 줍니다.

## ArchUnit은 어떻게 동작하는가

![ArchUnit 동작 방식 — 바이트코드를 읽어 규칙으로 검사](/assets/posts/java-archunit-flow.svg)

ArchUnit은 컴파일된 `.class` 파일의 바이트코드를 읽어 클래스 간 의존성 그래프를 `JavaClasses`라는 모델로 만듭니다. 그 위에 "어떤 클래스는 어떤 클래스에 의존해야/하지 말아야 한다" 같은 규칙(`ArchRule`)을 선언하고 `check`를 호출하면, 규칙을 위반하는 의존성이 있을 때 테스트가 실패합니다. 소스 코드가 아니라 바이트코드를 보기 때문에 리플렉션이나 어노테이션 기반 의존성도 정확히 잡아냅니다.

## 의존성과 첫 규칙

JUnit 5 통합 모듈을 추가합니다.

```groovy
testImplementation "com.tngtech.archunit:archunit-junit5:1.3.0"
```

가장 흔한 규칙은 레이어 간 의존 방향입니다. 컨트롤러는 서비스를, 서비스는 리포지토리를 호출하지만, 그 반대 방향은 금지해야 합니다.

![ArchUnit이 강제하는 레이어 규칙](/assets/posts/java-archunit-layers.svg)

```java
@AnalyzeClasses(packages = "com.paldyn.shop")
class ArchitectureTest {

    @ArchTest
    static final ArchRule 레이어_의존_방향 =
        classes().that().resideInAPackage("..repository..")
            .should().onlyBeAccessed()
            .byAnyPackage("..repository..", "..service..");
}
```

`@AnalyzeClasses`가 분석 대상 패키지를 지정하고, `@ArchTest`가 붙은 `ArchRule` 필드가 각각 하나의 검사가 됩니다. 위 규칙은 "리포지토리 패키지는 리포지토리 자신과 서비스에서만 접근될 수 있다"는 의미라, 컨트롤러가 리포지토리를 직접 호출하면 위반으로 잡힙니다.

## 레이어 규칙을 더 선언적으로

`layeredArchitecture`를 쓰면 레이어 구조 전체를 한 번에 선언할 수 있습니다.

```java
@ArchTest
static final ArchRule 레이어_아키텍처 =
    layeredArchitecture().consideringAllDependencies()
        .layer("Controller").definedBy("..controller..")
        .layer("Service").definedBy("..service..")
        .layer("Repository").definedBy("..repository..")
        .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
        .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller")
        .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service");
}
```

이 한 덩어리가 "컨트롤러는 누구에게도 접근되지 않고, 서비스는 컨트롤러만, 리포지토리는 서비스만 접근한다"는 레이어드 아키텍처 전체를 표현합니다.

## 네이밍·순환 참조 규칙

ArchUnit은 의존 방향 외에도 다양한 관습을 강제할 수 있습니다.

```java
@ArchTest
static final ArchRule 서비스_네이밍 =
    classes().that().resideInAPackage("..service..")
        .should().haveSimpleNameEndingWith("Service");

@ArchTest
static final ArchRule 순환_참조_금지 =
    slices().matching("com.paldyn.shop.(*)..")
        .should().beFreeOfCycles();
```

첫 규칙은 서비스 패키지의 클래스가 모두 `Service`로 끝나야 한다고 강제하고, 둘째 규칙은 패키지 간 순환 의존성을 금지합니다. 순환 참조는 모듈 분리를 가로막는 대표적 냄새인데, ArchUnit이 자동으로 탐지해 줍니다.

## 점진적 도입과 동결

이미 규칙 위반이 쌓인 레거시에 ArchUnit을 도입하면 수백 개의 실패가 쏟아질 수 있습니다. 이때 `FreezingArchRule`로 현재 위반을 "동결"하면, 기존 위반은 통과시키되 **새로운 위반만** 실패로 잡습니다. 동결된 목록을 점차 줄여 가며 아키텍처를 단계적으로 정리할 수 있어, 멈춰 있는 시스템에도 안전하게 적용됩니다.

## 정리

ArchUnit은 바이트코드의 의존성 그래프 위에 규칙을 선언해, 레이어 의존 방향·네이밍·순환 참조 금지 같은 아키텍처 약속을 단위 테스트처럼 자동으로 검증합니다. `layeredArchitecture`로 레이어 구조를 선언하고, `slices`로 순환을 막으며, `FreezingArchRule`로 레거시에 점진 도입할 수 있습니다. 문서에만 적힌 규칙은 잊히지만, 테스트로 박제된 규칙은 CI가 매번 지켜 줍니다. 다음 글에서는 테스트가 코드를 얼마나 검증하는지 측정하는 커버리지를 다룹니다.

---

**지난 글:** [Testcontainers — 진짜 의존성으로 통합 테스트하기](/posts/java-testcontainers/)

**다음 글:** [테스트 커버리지 — JaCoCo로 측정하고 해석하기](/posts/java-test-coverage/)

<br>
읽어주셔서 감사합니다. 😊
