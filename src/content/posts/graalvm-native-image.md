---
title: "GraalVM Native Image — 네이티브 실행 파일 만들기"
description: "native-image 도구가 바이트코드를 독립 실행 파일로 변환하는 원리를 살펴봅니다. 폐쇄 세계 가정, 포인트-투 분석, 힙 스냅샷, AOT 컴파일 단계와 리플렉션·JNI·리소스를 위한 도달 가능성 메타데이터 등록 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "GraalVM", "Native Image", "AOT", "네이티브", "클라우드 네이티브"]
featured: false
draft: false
---

[지난 글](/posts/graalvm-overview/)에서 GraalVM이 고성능 폴리글랏 런타임으로서 JIT 컴파일러와 Truffle 인터프리터 프레임워크를 어떻게 통합하는지 살펴봤습니다. 이번 글에서는 GraalVM의 킬러 피처라 불리는 **Native Image** — 자바 바이트코드를 JVM 없이 바로 실행되는 네이티브 실행 파일로 변환하는 도구 — 를 깊이 파헤칩니다. 컨테이너 환경에서 기동 시간과 메모리가 곧 비용인 오늘날, Native Image는 자바를 클라우드 네이티브 언어로 탈바꿈시키는 핵심 기술입니다.

## Native Image란 무엇인가

`native-image`는 GraalVM에 포함된 빌드 타임 도구입니다. JVM이 런타임에 클래스를 로드하고 JIT 컴파일하는 것과 달리, `native-image`는 빌드 시점에 전체 프로그램을 분석하고 기계어로 직접 컴파일합니다. 결과물은 특정 OS/아키텍처를 위한 **독립 실행 파일(standalone executable)** 로, 실행 시 JVM이 전혀 필요 없습니다.

가장 눈에 띄는 특징은 **즉시 기동(instant startup)** 입니다. 일반 JVM 애플리케이션은 클래스 로딩, JIT 워밍업, 클래스패스 스캔 등으로 수 초가 걸리지만, Native Image 실행 파일은 보통 수십 밀리초 안에 기동합니다. 메모리 사용량도 JVM 오버헤드가 없어 훨씬 낮습니다.

## 빌드 파이프라인 — 네 단계

![Native Image 빌드 파이프라인](/assets/posts/graalvm-native-image-build-pipeline.svg)

`native-image`의 빌드는 크게 네 단계로 진행됩니다.

**1단계 — 입력 수집**: JAR 파일 또는 클래스 파일들이 입력으로 들어옵니다. 리플렉션·JNI·리소스처럼 정적 분석으로 추적하기 어려운 동적 기능을 위한 메타데이터 JSON 파일도 함께 읽습니다.

**2단계 — 포인트-투 분석(points-to analysis)**: 이 단계가 Native Image의 핵심입니다. 프로그램의 진입점(`main` 메서드)에서 시작해 어떤 클래스·메서드·필드가 실제로 도달 가능한지(reachable)를 정적으로 추적합니다. 도달 불가능한 코드는 최종 이미지에서 제외됩니다. 이 원리 때문에 최종 실행 파일은 원본 JAR보다 훨씬 작아질 수 있습니다.

**3단계 — 힙 스냅샷(heap snapshotting)**: 빌드 시점에 초기화된 객체들을 직렬화하여 이미지에 내장합니다. 런타임에 `static` 초기화를 다시 실행하는 비용이 없어지는 것이죠. 단, 이 초기화는 빌드 머신의 환경에 종속될 수 있으므로 주의가 필요합니다.

**4단계 — AOT 컴파일 및 링킹**: 분석된 코드가 기계어로 컴파일되고, 서브스트레이트 VM(Substrate VM)의 런타임 컴포넌트(GC, 스레드 관리 등)와 링킹되어 단일 실행 파일이 만들어집니다.

## 폐쇄 세계 가정

Native Image의 동작 원리는 **폐쇄 세계 가정(closed-world assumption)** 에 기반합니다. 빌드 시점에 전체 프로그램의 코드가 확정되어 있다는 전제입니다. JVM의 동적 클래스 로딩처럼 런타임에 새로운 코드가 들어오는 것은 허용하지 않습니다.

이 가정 때문에 리플렉션, JNI, 동적 프록시, 리소스 로딩처럼 **빌드 시점에 추적하기 어려운 동적 기능**은 별도 메타데이터 파일로 명시해야 합니다. 이 파일들이 없으면 런타임에 `ClassNotFoundException`이나 `NoSuchMethodException`이 발생합니다.

## CLI 사용법

```bash
# native-image 기본 실행
native-image -jar myapp.jar -o myapp

# 리플렉션 설정 파일 지정
native-image -jar myapp.jar \
  -H:ReflectionConfigurationFiles=reflect-config.json \
  -o myapp

# Tracing Agent로 메타데이터 자동 수집
java -agentlib:native-image-agent=\
config-output-dir=src/main/resources/META-INF/native-image \
  -jar myapp.jar
```

빌드 시간은 일반 JAR 빌드보다 훨씬 길 수 있습니다(프로젝트에 따라 수 분). 이것은 철저한 정적 분석에 드는 비용으로, 한 번 빌드하고 여러 번(빠르게) 실행하는 서버리스·컨테이너 환경에서는 충분히 감수할 만합니다.

## 도달 가능성 메타데이터

![Reachability Metadata 구조](/assets/posts/graalvm-native-image-reachability.svg)

`native-image`가 자동으로 탐지하지 못하는 동적 기능을 알려주는 JSON 파일들을 **도달 가능성 메타데이터(reachability metadata)** 라고 합니다.

- **reflect-config.json**: 리플렉션으로 접근할 클래스·메서드·필드를 등록합니다. Spring, Hibernate 같은 프레임워크가 리플렉션을 많이 쓰기 때문에 이 파일이 가장 많이 필요합니다.
- **jni-config.json**: JNI를 통해 접근할 자바 요소를 등록합니다.
- **resource-config.json**: `getResourceAsStream()`으로 읽을 리소스 파일 패턴을 등록합니다.
- **proxy-config.json**: `java.lang.reflect.Proxy`로 생성할 인터페이스 조합을 등록합니다.

이 파일들을 손으로 작성하는 것은 번거롭습니다. GraalVM은 **Tracing Agent** 를 제공하는데, 일반 JVM 위에서 `-agentlib:native-image-agent`를 붙여 앱을 실행하면 동적 기능 사용을 추적해 JSON 파일을 자동으로 생성해 줍니다. 생성된 파일은 `META-INF/native-image/` 아래에 놓으면 `native-image`가 자동으로 읽습니다.

또한 주요 오픈소스 라이브러리를 위한 메타데이터를 커뮤니티가 관리하는 **[GraalVM Reachability Metadata Repository](https://github.com/oracle/graalvm-reachability-metadata)** 도 있습니다. GraalVM Native Build Tools(Maven/Gradle 플러그인)는 이 저장소를 자동으로 참조합니다.

## 주요 제약

Native Image가 모든 상황에 적합한 것은 아닙니다. 다음 제약을 이해하고 적용 여부를 판단해야 합니다.

- **동적 클래스 로딩 불가**: 런타임에 새로운 클래스를 로드할 수 없습니다. 플러그인 아키텍처처럼 런타임에 코드를 추가하는 패턴은 지원하지 않습니다.
- **리플렉션 수동 등록**: 리플렉션으로 접근하는 요소는 모두 메타데이터에 명시해야 합니다. 등록 누락은 런타임 예외로 이어집니다.
- **일부 JDK 기능 제한**: 동적 언어 기능, 특정 암호화 알고리즘 제공자 등이 제한될 수 있습니다.
- **피크 처리량**: JIT의 동적 최적화가 없으므로 장시간 실행되는 서버 워크로드에서는 JVM보다 피크 처리량이 낮을 수 있습니다(PGO로 일부 보완 가능 — 다음 글에서 다룹니다).

기동 시간과 메모리가 중요한 **서버리스, CLI 도구, 마이크로서비스** 환경에서 Native Image의 가치는 압도적입니다. 반면 오래 실행되며 JIT 워밍업 이후 성능이 중요한 배치 처리 서버에서는 전통적인 JVM이 더 나을 수 있습니다.

## 정리

`native-image`는 폐쇄 세계 가정 하에 포인트-투 분석 → 힙 스냅샷 → AOT 컴파일 순서로 JVM 없이 동작하는 네이티브 실행 파일을 만들어 냅니다. 즉시 기동과 낮은 메모리가 강점이지만, 동적 기능은 메타데이터로 명시해야 한다는 제약이 있습니다. Tracing Agent와 Reachability Metadata Repository를 활용하면 이 부담을 상당히 줄일 수 있습니다. 다음 글에서는 Native Image의 근간인 AOT 컴파일을 JIT와 비교해 더 깊이 살펴봅니다.

---

**지난 글:** [GraalVM 개요 — 고성능 폴리글랏 런타임](/posts/graalvm-overview/)

**다음 글:** [GraalVM AOT 컴파일 — 미리 컴파일하는 자바](/posts/graalvm-aot-compilation/)

<br>
읽어주셔서 감사합니다. 😊
