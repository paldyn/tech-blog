---
title: "GraalVM 트레이드오프 — 언제 쓰고 언제 피할까"
description: "Native Image의 빠른 기동·낮은 RSS 장점과 긴 빌드·리플렉션 제약·낮은 피크 처리량 단점을 정리하고, 서버리스·CLI·장기 실행 API 서버 등 워크로드별로 GraalVM을 언제 쓰고 언제 피해야 하는지 결정 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "GraalVM", "Native Image", "AOT", "JIT", "서버리스", "Quarkus", "Spring Boot"]
featured: false
draft: false
---

[지난 글](/posts/graalvm-polyglot/)에서 Truffle 프레임워크와 Polyglot API를 통해 GraalVM이 여러 언어를 하나의 런타임 위에서 실행하는 원리를 살펴봤습니다. 이번 글은 GraalVM, 특히 **Native Image**를 실제 프로젝트에 도입할지 말지를 결정하는 데 필요한 트레이드오프를 정리합니다. "무조건 빠르다"거나 "무조건 어렵다"는 단편적 평가보다, 워크로드 특성에 따라 어떤 선택이 합리적인지를 따져봅니다.

## Native Image의 장점 — 무엇이 매력인가

Native Image는 AOT 컴파일을 통해 JVM 없이 실행되는 단일 바이너리를 생성합니다. 이때 얻는 이득은 뚜렷합니다.

**기동 시간이 밀리초 단위로 줄어듭니다.** 일반적인 Spring Boot 앱이 JVM 위에서 수 초가 걸리는 데 반해, Native Image로 컴파일하면 수십~수백 밀리초 안에 준비 상태가 됩니다. AWS Lambda나 Google Cloud Run처럼 요청이 없을 때 인스턴스가 내려가는 **서버리스 환경**에서 콜드 스타트 지연을 거의 없앨 수 있습니다.

**RSS(상주 메모리) 사용량이 낮습니다.** JVM 메타스페이스, JIT 코드 캐시, 클래스 로더 구조가 없으므로 같은 애플리케이션도 훨씬 적은 메모리로 뜹니다. 컨테이너 수백 개를 사이드카로 올리는 상황이나, 엣지 노드처럼 메모리가 빡빡한 환경에서 유리합니다.

**배포 단위가 작아집니다.** JDK를 포함한 Docker 이미지 대신 단일 실행 바이너리나 경량 `distroless` 이미지로 배포할 수 있어, 이미지 크기와 보안 공격 면이 동시에 줄어듭니다.

![Native Image vs JIT — 트레이드오프 비교](/assets/posts/graalvm-tradeoffs-comparison.svg)

## Native Image의 단점 — 무엇이 아픈가

장점만큼 뚜렷한 단점도 있습니다.

**빌드 시간이 깁니다.** `native-image` 컴파일은 전체 프로그램 분석(whole-program analysis)을 수행하기 때문에 작은 앱도 몇 분, 대형 앱은 10~20분 이상 걸립니다. CI 파이프라인에서 병렬화나 캐싱을 신경 쓰지 않으면 개발 속도가 눈에 띄게 느려집니다.

**피크 처리량이 JIT보다 낮습니다.** JIT는 런타임에 프로파일 정보를 수집해 "지금 실제로 뜨거운 코드"를 공격적으로 최적화합니다. AOT는 빌드 타임에 보수적으로 최적화하기 때문에 장기 실행 서버처럼 워밍업 후 처리량이 중요한 워크로드에서는 JIT에 밀립니다.

**리플렉션·동적 클래스 로딩에 제약이 있습니다.** Native Image는 **closed-world 가정**으로 동작합니다. 빌드 타임에 도달 가능한 코드만 포함하기 때문에, 런타임에 처음 보이는 클래스 이름을 `Class.forName()`으로 로딩하거나 리플렉션으로 접근하려면 **메타데이터 파일**(`reflect-config.json`, `proxy-config.json` 등)을 미리 등록해야 합니다. 이 작업이 누락되면 런타임에 `MissingReflectionRegistrationError`가 납니다. GraalVM이 제공하는 **Tracing Agent**(`-agentlib:native-image-agent`)로 자동 생성할 수 있지만, 모든 코드 경로를 실행해 수집해야 하므로 커버리지를 맞추는 게 번거롭습니다.

**디버깅·관찰성이 제한됩니다.** JVM 위에서 당연히 쓰던 JMX, JFR, Java 에이전트 기반 APM(Datadog, New Relic 등)이 Native Image에서는 제한적으로만 동작하거나 아예 작동하지 않습니다. `jstack`, `jmap` 같은 진단 도구도 사용할 수 없습니다. Native Image 전용 디버그 심볼 빌드와 GDB/LLDB를 써야 하는데, 이 생태계는 아직 성숙 중입니다.

**바이너리 크기가 기대보다 클 수 있습니다.** 기동 시간은 줄지만 바이너리에 런타임 라이브러리와 GC 코드가 포함되어 단순 Go나 Rust 바이너리보다 훨씬 크게 나오는 경우가 많습니다.

## 결정 기준 — 언제 무엇을 선택할까

![GraalVM 사용 결정 트리](/assets/posts/graalvm-tradeoffs-decision.svg)

정리하면 다음 기준으로 선택합니다.

```text
기동 시간 ≤ 수백 ms가 필수 (서버리스, CLI, 스케일-아웃 컨테이너)
    → Native Image
    → Quarkus / Micronaut / Spring Boot 3 AOT 중 택일

장기 실행 서버 + 최고 처리량이 목표 (배치, 대용량 API, 스트리밍)
    → 표준 JIT / HotSpot OpenJDK
    → GraalVM JIT (폴리글랏 필요 시만 추가 고려)

폴리글랏 임베딩 또는 Truffle 언어 실행이 핵심 요구사항
    → GraalVM JIT 모드 (Native Image + Polyglot도 가능하나 제약 더 많음)
```

### 프레임워크 생태계 현황

Spring Boot 3는 AOT 처리와 GraalVM Native Image를 공식 지원합니다. `spring-aot-maven-plugin`이 컴파일 타임에 리플렉션 힌트를 자동 생성해 주기 때문에, 순수 Spring 스택이라면 메타데이터 작업이 상당 부분 자동화됩니다. 다만 서드파티 라이브러리가 아직 힌트를 제공하지 않는 경우 수동 보완이 필요합니다.

Quarkus는 처음부터 Native Image와 Kubernetes를 염두에 두고 설계되었고, 확장(Extension) 시스템이 각 라이브러리의 Native Image 메타데이터를 미리 포함합니다. 에코시스템 커버리지가 Spring Boot AOT보다 넓고, 개발 모드의 핫리로드도 빠릅니다.

Micronaut은 컴파일 타임 DI를 기본으로 하기 때문에 리플렉션 의존성이 원천적으로 적습니다. 리플렉션 설정 부담이 가장 적은 대신 Spring보다 학습 곡선이 있습니다.

### 혼합 전략

한 팀이 서비스 성격에 따라 두 모드를 병행하는 것도 현실적입니다. Lambda 핸들러나 CLI 도구는 Native Image로, 주 API 서버는 HotSpot JIT로 운영하고, 공유 라이브러리는 두 모드 모두에서 테스트하는 방식입니다. 이 경우 Native Image 빌드를 CI에서만 돌리고 로컬 개발은 JVM 모드로 진행하면 개발 속도와 배포 이점을 동시에 누릴 수 있습니다.

## 정리

Native Image는 기동 속도와 낮은 RSS가 결정적인 환경, 즉 서버리스·CLI·컨테이너 스케일-아웃에 강점이 있습니다. 반면 장기 실행 서버에서 최고 처리량이 목표라면 JIT HotSpot이 여전히 우월합니다. 리플렉션 메타데이터 관리와 느린 빌드는 현실적인 운영 부담이므로, Spring Boot AOT·Quarkus·Micronaut 중 메타데이터 지원이 잘 되는 프레임워크를 선택해 부담을 줄이는 것이 실용적입니다. GraalVM을 쓴다는 결정보다 **어느 모드**로 쓸지가 훨씬 중요한 선택입니다.

---

**지난 글:** [GraalVM 폴리글랏 — 하나의 런타임, 여러 언어](/posts/graalvm-polyglot/)

**다음 글:** [Maven 입문 — 자바 빌드 도구의 표준](/posts/java-build-maven/)

<br>
읽어주셔서 감사합니다. 😊
