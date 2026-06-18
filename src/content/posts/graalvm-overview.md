---
title: "GraalVM 개요 — 고성능 폴리글랏 런타임"
description: "GraalVM이 무엇인지, Graal JIT 컴파일러가 HotSpot C2를 어떻게 대체하는지, JVMCI·Truffle 프레임워크·Native Image의 관계, Community/Oracle/Mandrel 배포판 차이, 그리고 언제 GraalVM을 선택해야 하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "GraalVM", "Graal JIT", "Native Image", "Truffle", "폴리글랏", "성능"]
featured: false
draft: false
---

[지난 글](/posts/java-startup-time-optimization/)에서 JVM 기동 시간을 단축하는 여러 기법을 살펴봤고, 가장 극적인 방법으로 GraalVM Native Image를 언급했습니다. GraalVM은 단순히 "빨리 시작하는 JVM"이 아닙니다. Oracle이 주도하는 오픈소스 프로젝트로, 자바 생태계의 컴파일러와 런타임 자체를 재설계한 플랫폼입니다. JIT 컴파일러부터 다국어 지원, 네이티브 바이너리 생성까지 세 축을 하나의 프레임 안에 묶어 놓았습니다. 이 글에서는 각 축이 무엇을 하는지, 왜 그것이 의미 있는지, 그리고 어떤 상황에서 GraalVM을 도입할지 구체적으로 짚어 보겠습니다.

## GraalVM이란

GraalVM은 Oracle Labs가 개발한 **고성능 폴리글랏 런타임(high-performance polyglot runtime)** 입니다. JDK를 기반으로 하되, 핵심 JIT 컴파일러(C2)를 **Graal** 이라는 새로운 컴파일러로 교체하고, 여기에 다국어 실행 프레임워크(Truffle)와 AOT 컴파일(Native Image)을 결합했습니다.

![GraalVM 아키텍처 개요](/assets/posts/graalvm-overview-architecture.svg)

이름에서 알 수 있듯 핵심 특징 두 가지가 있습니다. 첫째, **고성능** — Graal JIT는 HotSpot C2보다 고급 최적화(특히 부분 탈출 분석)를 적용해 일부 워크로드에서 더 나은 피크 성능을 냅니다. 둘째, **폴리글랏** — 한 JVM 위에서 자바뿐 아니라 JavaScript·Python·Ruby·WebAssembly 등을 실행할 수 있습니다.

## JVMCI — 컴파일러를 교체하는 인터페이스

Graal이 HotSpot 안으로 들어올 수 있는 것은 **JVMCI(JVM Compiler Interface)** 덕분입니다. JVMCI는 JDK 9(JEP 243)에 표준화된 인터페이스로, 외부에서 구현한 JIT 컴파일러를 JVM에 플러그인할 수 있게 합니다. 기존에는 C2가 JVM 내부에 C++로 고정 탑재돼 있었지만, JVMCI 덕분에 "컴파일러를 교체"하는 것이 공식 지원됩니다.

```bash
# JVMCI + Graal JIT 활성화 (표준 JDK 21+)
java -XX:+UnlockExperimentalVMOptions \
     -XX:+UseJVMCICompiler \
     -jar app.jar

# GraalVM JDK는 UseJVMCICompiler가 기본 ON
```

Graal 컴파일러 자체가 **자바로 작성**됐다는 점이 흥미롭습니다. C++로 짜인 C2와 달리 Graal은 자바 코드이므로, Graal 자신을 Graal로 컴파일하는 "자기 참조" 부트스트랩도 가능합니다. 이는 컴파일러에 기여하거나 연구하기 훨씬 쉽다는 의미이기도 합니다.

## Graal JIT vs HotSpot C2

![Graal JIT vs HotSpot C2 & Truffle 동작 원리](/assets/posts/graalvm-overview-jit-compare.svg)

C2와 비교할 때 Graal이 앞서는 영역은 **부분 탈출 분석(Partial Escape Analysis, PEA)** 입니다. 일반 탈출 분석은 객체가 메서드 밖으로 나가지 않으면 스택에 할당합니다. PEA는 한 걸음 더 나아가, 객체가 **일부 실행 경로에서만** 탈출할 때 탈출하지 않는 경로에서는 힙 할당을 생략합니다. 단기 객체가 많은 워크로드에서 GC 압력을 낮추는 데 효과적입니다.

반면 C2는 수십 년간 HotSpot 팀이 다듬어 온 검증된 컴파일러입니다. 대부분의 일반 서버 애플리케이션에서는 C2와 Graal의 성능 차이가 미미하거나 워크로드에 따라 엇갈립니다. Graal JIT만을 위해 GraalVM으로 마이그레이션하는 결정은 신중하게 벤치마킹한 후에 내려야 합니다.

## Truffle — 폴리글랏의 핵심

Truffle은 **언어 인터프리터를 AST(Abstract Syntax Tree) 형태로 구현하면 Graal JIT가 자동으로 고성능 JIT 컴파일을 해 주는** 프레임워크입니다.

언어 구현자 관점에서는 인터프리터만 작성하면 됩니다. Truffle이 런타임 프로파일 정보를 바탕으로 핫 AST 노드를 특수화(specialization)하고, Graal이 이를 최적화된 네이티브 코드로 컴파일합니다. Truffle 위에 구현된 언어들은 다음과 같습니다.

| 언어 | 구현체 |
|---|---|
| JavaScript / Node.js | GraalJS (GraalVM 기본 포함) |
| Python | GraalPy |
| Ruby | TruffleRuby |
| R | FastR |
| LLVM bitcode (C/C++) | Sulong |

이들 언어는 같은 JVM 위에서 실행되므로 자바 객체를 직접 공유할 수 있고, 언어 간 호출 오버헤드가 매우 낮습니다.

```java
// 자바 코드에서 JavaScript 실행 예
import org.graalvm.polyglot.*;

try (Context ctx = Context.create()) {
    Value result = ctx.eval("js",
        "Math.sqrt(2) + ' is sqrt of 2'");
    System.out.println(result.asString());
}
```

## 배포판: Community · Oracle · Mandrel

GraalVM은 세 가지 주요 배포판이 있으며 목적에 따라 선택이 달라집니다.

**GraalVM Community Edition** 은 GPL 라이선스 오픈소스로, GitHub에서 무료로 받을 수 있습니다. Graal JIT·Truffle·Native Image 모두 포함되지만, Oracle 전용 최적화 및 일부 엔터프라이즈 기능은 없습니다.

**Oracle GraalVM** (구 Enterprise Edition)은 Oracle JDK처럼 Oracle 기술 지원과 라이선스 조건이 따릅니다. 추가 최적화와 G1·ZGC 연계 개선이 포함됩니다.

**Mandrel** 은 Red Hat이 Quarkus 프로젝트를 위해 관리하는 GraalVM Community 기반 배포판입니다. Native Image 생성에 필요한 최소 컴포넌트만 포함하고 Truffle은 제외해 컨테이너 이미지를 가볍게 유지합니다. Quarkus 또는 OpenShift 환경에서 Native Image를 쓸 때 권장됩니다.

```bash
# SDKMAN으로 설치 예
sdk install java 21.0.3-graalce   # Community
sdk install java 21.0.3-graal     # Oracle
```

## Native Image — 두 번째 주역

Native Image는 자바 애플리케이션을 **빌드 타임에 AOT 컴파일**해 JVM 없이 실행되는 네이티브 바이너리를 만드는 도구입니다. 기동 시 클래스 로딩·JIT 워밍업 단계가 없으므로 수십 밀리초 수준으로 기동하고, 메모리 발자국도 대폭 줄어듭니다.

```bash
# Maven 프로젝트에서 Native Image 빌드 (Spring Boot 3.x)
./mvnw -Pnative native:compile

# 생성된 바이너리 실행
./target/my-app
# Started MyApp in 0.054 seconds
```

트레이드오프가 있습니다. 빌드 시간이 수분 이상으로 길고, 리플렉션·동적 클래스 로딩·JNI 사용에는 사전 힌트(reflect-config.json 등)가 필요합니다. GraalVM Reachability Metadata Repository 프로젝트가 주요 라이브러리의 힌트를 모아 두고 있어 상황이 계속 나아지고 있습니다. Native Image의 상세 내용은 다음 글에서 다룹니다.

## 언제 GraalVM을 선택할까

GraalVM이 항상 정답은 아닙니다. 아래 기준으로 판단하면 됩니다.

**Graal JIT만 교체** — 장기 실행 서비스에서 PEA 최적화가 필요한 워크로드, 또는 컴파일러 연구·커스터마이징이 목적일 때. 표준 JDK에 JVMCI 플래그만 켜면 돼 마이그레이션 리스크가 낮습니다.

**Native Image** — 컨테이너·서버리스처럼 빠른 기동과 낮은 메모리가 중요한 환경. Quarkus·Micronaut·Spring Boot 3.x 가 Native Image 지원을 갖추고 있어 진입 장벽이 낮아졌습니다. 단, 동적 기능을 많이 쓰는 레거시 코드베이스는 힌트 파일 작성 비용이 큽니다.

**Truffle 폴리글랏** — JVM 위에서 JavaScript·Python을 고성능으로 실행해야 하거나, 도메인 특화 언어(DSL)를 만들어야 할 때. 단순 스크립팅 용도라면 표준 스크립팅 엔진으로 충분합니다.

## 정리

GraalVM은 Graal JIT(C2 대체)·Truffle(폴리글랏)·Native Image(AOT) 세 축으로 구성된 플랫폼입니다. JVMCI를 통해 JVM에 플러그인되며, 언어를 자바로 구현함으로써 컴파일러 연구와 기여 접근성을 높였습니다. Community·Oracle·Mandrel 배포판은 용도에 따라 선택하고, 도입 전에 반드시 대상 워크로드로 벤치마킹해 실제 이득을 확인해야 합니다. 다음 글에서는 Native Image를 중심으로 실제 빌드 절차와 제약 사항을 자세히 살펴보겠습니다.

---

**지난 글:** [자바 기동 시간 최적화 — 빠르게 시작하는 JVM](/posts/java-startup-time-optimization/)

**다음 글:** [GraalVM Native Image — 네이티브 실행 파일 만들기](/posts/graalvm-native-image/)

<br>
읽어주셔서 감사합니다. 😊
