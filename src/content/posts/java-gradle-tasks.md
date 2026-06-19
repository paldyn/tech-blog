---
title: "Gradle Task — 빌드의 최소 실행 단위"
description: "Gradle 빌드는 Task의 모임입니다. 초기화·구성·실행 3단계, Task의 입출력 선언과 증분 빌드, doLast와 dependsOn으로 커스텀 Task를 만드는 방법까지 Gradle Task의 작동 원리를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "Gradle", "Task", "빌드", "증분 빌드"]
featured: false
draft: false
---

[지난 글](/posts/java-build-gradle/)에서 Gradle의 전체 구조와 Kotlin DSL, 빌드 캐시를 살펴봤습니다. Gradle을 한 단계 더 깊이 이해하려면 결국 **Task**를 알아야 합니다. `compileJava`, `test`, `jar`, `build` — 우리가 실행하는 모든 명령은 사실 Task이며, Gradle 빌드는 이 Task들이 의존 관계로 엮인 그래프를 실행하는 것에 지나지 않습니다. Task가 무엇이고 어떻게 실행되는지 이해하면 빌드를 내 마음대로 확장할 수 있습니다.

## Task란 무엇인가

Task는 Gradle이 수행하는 **작업의 최소 단위**입니다. 소스를 컴파일하는 일, 테스트를 돌리는 일, JAR를 만드는 일이 각각 하나의 Task입니다. 각 Task는 하나 이상의 **Action**(실제로 실행되는 코드 블록)을 가지며, 다른 Task에 대한 의존성과 입력·출력을 선언할 수 있습니다.

현재 프로젝트에서 사용 가능한 Task 목록은 다음 명령으로 확인할 수 있습니다.

```bash
./gradlew tasks          # 주요 Task 그룹 목록
./gradlew tasks --all    # 숨겨진 Task까지 전부
```

## 3단계 실행 흐름

![Gradle Task 실행 흐름 — 초기화·구성·실행](/assets/posts/java-gradle-tasks-lifecycle.svg)

Gradle은 빌드를 항상 세 단계로 처리합니다.

1. **초기화(Initialization)**: `settings.gradle.kts`를 평가해 어떤 프로젝트가 빌드에 참여하는지 결정합니다. 멀티 모듈 프로젝트라면 여기서 모듈 구성이 정해집니다.
2. **구성(Configuration)**: 모든 프로젝트의 `build.gradle.kts`를 평가해 Task 객체를 생성하고, Task 간 의존 관계를 **DAG(방향성 비순환 그래프)** 로 구성합니다. 이 단계에서는 Task의 Action을 실행하지 않고 "준비"만 합니다.
3. **실행(Execution)**: 사용자가 요청한 Task와 그 의존 Task들을 위상 정렬한 순서대로 실행합니다. 이때 비로소 각 Task의 Action이 동작합니다.

여기서 중요한 구분이 하나 있습니다. 구성 단계의 코드는 **빌드할 때마다 항상 실행**되고, 실행 단계의 코드(`doLast`/`doFirst` 안)는 **해당 Task가 실제로 실행될 때만** 동작합니다. 무거운 로직을 구성 단계에 두면 빌드 전체가 느려지므로, 가능하면 실행 단계 Action 안에 넣는 것이 좋습니다.

## Task 상태와 증분 빌드

실행 단계에서 각 Task는 여러 상태 중 하나를 가집니다. `EXECUTED`는 Action이 실제로 실행됐다는 뜻이고, `UP-TO-DATE`는 입력과 출력이 이전과 동일해 Gradle이 실행을 건너뛰었다는 뜻입니다. 캐시가 적중하면 `FROM-CACHE`, `onlyIf` 조건이 거짓이면 `SKIPPED`가 됩니다.

이 증분 빌드가 가능한 이유는 Task가 자신의 **입력(inputs)과 출력(outputs)을 선언**하기 때문입니다. Gradle은 입력 파일의 해시와 출력 상태를 비교해 변경이 없으면 Task를 통째로 건너뜁니다. 빌드 로그에 `UP-TO-DATE`가 많이 보일수록 빌드가 빠르다는 신호입니다.

## 커스텀 Task 만들기

![커스텀 Task 정의 — register, doLast, dependsOn](/assets/posts/java-gradle-tasks-code.svg)

직접 Task를 정의해 빌드를 확장해 봅시다. `tasks.register`로 새 Task를 만들고, `doLast` 블록 안에 실행할 코드를 작성합니다.

```kotlin
// build.gradle.kts
tasks.register("greet") {
    group = "custom"
    description = "인사를 출력한다"

    doLast {                       // 실행 단계 Action
        println("Hello, Gradle!")
    }
}

tasks.named("build") {
    dependsOn("greet")             // build 전에 greet 실행
}
```

`group`과 `description`을 지정하면 `./gradlew tasks` 목록에 보기 좋게 노출됩니다. `dependsOn`으로 다른 Task와의 의존 관계를 선언하면, 해당 Task가 실행될 때 우리 Task가 먼저 실행되도록 DAG에 끼어들 수 있습니다.

`doFirst`와 `doLast`는 각각 Task의 기존 Action **앞과 뒤**에 동작을 추가합니다. 예를 들어 `test` Task에 `doFirst`를 붙이면 테스트 직전에 환경을 점검하는 코드를 넣을 수 있습니다.

```kotlin
tasks.named("test") {
    doFirst { println("테스트 시작 — DB 연결 확인") }
    doLast { println("테스트 완료") }
}
```

## 입출력을 선언해 증분 빌드 활용하기

직접 만든 Task도 입력과 출력을 선언하면 증분 빌드의 혜택을 받습니다. 파일을 생성하는 Task라면 다음처럼 작성합니다.

```kotlin
tasks.register("generateVersion") {
    val outFile = layout.buildDirectory.file("version.txt")
    inputs.property("version", project.version)   // 입력 선언
    outputs.file(outFile)                          // 출력 선언

    doLast {
        outFile.get().asFile.writeText("v${project.version}")
    }
}
```

이렇게 하면 `project.version`이 바뀌지 않는 한 두 번째 실행부터는 `UP-TO-DATE`로 스킵됩니다. 입출력 선언은 단순한 최적화를 넘어, 빌드의 재현성과 캐시 가능성을 보장하는 Gradle의 핵심 설계입니다.

## 정리

Gradle Task는 빌드의 최소 실행 단위이며, 초기화·구성·실행의 3단계를 거쳐 동작합니다. 구성 단계에서 Task DAG가 만들어지고 실행 단계에서 Action이 동작한다는 구분을 이해하면, `doFirst`/`doLast`로 기존 빌드에 자연스럽게 끼어들 수 있습니다. 무엇보다 입력과 출력을 선언해 두면 Gradle이 변경을 추적해 불필요한 작업을 건너뛰므로, 큰 프로젝트일수록 빌드 속도에서 큰 차이가 납니다. 다음 글에서는 지금까지 본 Gradle과 Maven을 정면으로 비교해 보겠습니다.

---

**지난 글:** [Gradle 입문 — 유연한 빌드 자동화](/posts/java-build-gradle/)

**다음 글:** [Gradle vs Maven — 무엇을 선택할까](/posts/java-gradle-vs-maven/)

<br>
읽어주셔서 감사합니다. 😊
