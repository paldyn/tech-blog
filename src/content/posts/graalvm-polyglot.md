---
title: "GraalVM 폴리글랏 — 하나의 런타임, 여러 언어"
description: "Truffle 프레임워크와 Polyglot API를 중심으로 GraalVM이 어떻게 JS·Python·Ruby를 JVM 위에서 실행하는지, 언어 간 객체를 직렬화 없이 공유하는 원리와 실제 Java 임베딩 코드를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "GraalVM", "Truffle", "폴리글랏", "JVM", "JavaScript", "Python"]
featured: false
draft: false
---

[지난 글](/posts/graalvm-aot-compilation/)에서 GraalVM의 AOT 컴파일, 즉 바이트코드를 미리 네이티브로 변환하는 Native Image 기술을 살펴봤습니다. GraalVM은 그것만이 아닙니다. 같은 런타임 위에서 Java·JavaScript·Python·Ruby를 동시에 실행하고, 각 언어의 객체를 복사나 직렬화 없이 직접 건네받을 수 있습니다. 이 기능을 **폴리글랏(Polyglot)** 이라 부르며, 핵심 엔진은 **Truffle** 프레임워크입니다.

## Truffle — "언어 구현체를 인터프리터로만 작성하라"

Truffle의 핵심 아이디어는 단순합니다. 언어 개발자는 소스코드를 **AST(추상 구문 트리)** 로 파싱한 뒤, 각 노드를 해석하는 인터프리터만 작성합니다. JIT 컴파일은 Truffle이 자동으로 처리해 줍니다.

![Truffle 프레임워크 &amp; GraalVM 폴리글랏 아키텍처](/assets/posts/graalvm-polyglot-truffle-arch.svg)

작동 원리는 **부분 평가(Partial Evaluation)** 와 **푸타무라 사영(Futamura Projection)** 에서 나옵니다. Truffle 인터프리터를 특정 입력 프로그램에 대해 부분 평가하면, 그 인터프리터가 해당 프로그램을 실행하는 전용 머신 코드가 생성됩니다. 즉, 인터프리터를 짜면 자동으로 JIT 컴파일러가 공짜로 따라오는 셈입니다. GraalJS(JavaScript), GraalPy(Python), TruffleRuby(Ruby), Sulong(LLVM IR 경유의 C/C++/Rust)이 모두 이 원리로 구현되어 있고, 동일한 Graal JIT 백엔드를 공유합니다.

### 특수화(Specialization) — 핫패스 추론

Truffle은 **특수화(Specialization)** 라는 기법을 씁니다. 처음에는 범용 타입으로 코드를 실행하다가, 실제로 어떤 타입의 값이 흐르는지를 관찰한 뒤 가장 좁은 타입에 맞는 고속 경로로 재컴파일합니다. 예컨대 덧셈 연산이 항상 `int`만 받는다면, `int` 전용 기계어를 생성해 박싱 비용을 없앱니다. 동적 언어에서도 JVM 수준의 성능을 낼 수 있는 이유가 여기에 있습니다.

## Polyglot API — Java에서 JavaScript 호출하기

GraalVM JDK 환경이라면 표준 `org.graalvm.polyglot` 패키지만으로 다른 언어를 임베딩할 수 있습니다. 의존성이나 별도 런타임 없이 Java 코드에서 바로 JS를 실행하고 결과를 받아올 수 있습니다.

```java
import org.graalvm.polyglot.*;
import java.util.List;

var myList = List.of(1, 2, 3, 4, 5);

try (var ctx = Context.newBuilder("js")
        .allowAllAccess(true)
        .build()) {

    // Java 객체를 JS 전역 스코프에 바인딩
    ctx.getBindings("js").putMember("data", myList);

    // JS 코드 실행 — 직렬화 없이 data 참조
    Value result = ctx.eval("js",
        "data.reduce((a, b) => a + b, 0)");

    // Value를 Java 타입으로 꺼냄
    long sum = result.asLong(); // 15
}
// try-with-resources → ctx.close() 자동 호출
```

![Polyglot Context / Value API — Java에서 JS 실행](/assets/posts/graalvm-polyglot-context-api.svg)

세 가지 핵심 개념만 이해하면 됩니다.

- **Context**: 언어 런타임의 격리 실행 단위. 스레드 하나를 점유하며 동기 실행합니다. `try-with-resources`로 반드시 닫아야 합니다.
- **Value**: 언어 경계를 넘어 전달되는 폴리글랏 참조. 복사나 JSON 직렬화 없이 원본 객체를 가리킵니다. `asLong()`, `asString()`, `as(Class<T>)` 등으로 Java 타입으로 꺼낼 수 있습니다.
- **Bindings**: 언어의 전역 스코프. `putMember("name", obj)`로 Java 객체를 해당 이름으로 노출하면 JS(또는 Python·Ruby) 코드가 그대로 접근합니다.

### Interop 프로토콜 — 언어 중립 메시지

`Value`가 언어 경계를 넘을 때 내부적으로는 **Interop 프로토콜**이 동작합니다. 배열인지, 맵인지, 함수인지, 예외인지를 언어 중립적인 메시지 기반으로 판별하고, 각 언어의 Truffle 구현체가 적절히 응답합니다. 예를 들어 Java의 `List`를 JS에 전달하면 JS 입장에서 `Array`처럼 인덱스 접근이 됩니다. Python에 전달하면 시퀀스처럼 쓸 수 있습니다. 데이터를 한 번만 메모리에 올려두고 여러 언어가 공유하는 것이 가능한 이유입니다.

## 언어별 현황과 현실적 기대치

2025년 기준으로 공식 지원 언어의 상태는 다음과 같습니다.

| 언어 | 구현체 | 상태 |
|---|---|---|
| JavaScript / Node.js | GraalJS | 안정 (Oracle 공식 유지) |
| Python | GraalPy | 실험적 / 빠르게 개선 중 |
| Ruby | TruffleRuby | 안정 (Shopify 기여) |
| R | FastR | 개발 중단 (deprecated) |
| C/C++/Rust (LLVM) | Sulong | 실험적 |

GraalJS는 Node.js 호환성이 높아 실무에서 쓸 만하고, TruffleRuby도 Rails 위주 벤치마크에서 MRI(표준 CRuby)보다 빠른 결과를 보이기도 합니다. 반면 R(FastR)은 공식 지원이 종료됐습니다.

한 가지 현실적인 주의사항이 있습니다. `Context`는 기본적으로 스레드 하나에 묶여 있습니다. 멀티스레드 환경에서 Context를 공유하려면 별도 설정이 필요하며, 안전하지 않은 접근은 예외를 냅니다. 또한 폴리글랏 임베딩 자체에 초기화 비용이 있으므로, Context를 매 요청마다 생성하는 것은 피해야 합니다. 풀(Pool)로 재사용하거나, 장수하는 Context에서 함수만 교체하는 패턴이 권장됩니다.

## 정리

Truffle 프레임워크 덕분에 언어 구현자는 인터프리터만 작성하고 JIT 컴파일은 Graal에 위임할 수 있습니다. 부분 평가와 특수화가 맞물려 동적 언어도 정적 언어에 근접하는 성능을 냅니다. 폴리글랏 API는 Context·Value·Bindings 세 축으로 동작하며, 직렬화 없이 언어 경계를 넘는 객체 공유가 가능합니다. 언어별 성숙도 차이는 있지만, GraalJS와 TruffleRuby는 이미 실무 투입이 가능한 수준입니다.

---

**지난 글:** [GraalVM AOT 컴파일 — 미리 컴파일하는 자바](/posts/graalvm-aot-compilation/)

**다음 글:** [GraalVM 트레이드오프 — 언제 쓰고 언제 피할까](/posts/graalvm-tradeoffs/)

<br>
읽어주셔서 감사합니다. 😊
