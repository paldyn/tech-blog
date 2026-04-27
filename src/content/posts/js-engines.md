---
title: "JS 엔진 (V8 · SpiderMonkey · JavaScriptCore)"
description: "V8, SpiderMonkey, JavaScriptCore 세 엔진의 구조와 JIT 컴파일 원리를 설명합니다. 왜 JavaScript가 빠른지 그 이유를 파이프라인으로 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "v8", "jit", "엔진", "spidermonkey", "javascriptcore", "컴파일"]
featured: false
draft: false
---

지난 [ECMAScript 표준과 버전 이름](/posts/js-ecmascript-standard/) 글에서 JavaScript의 표준이 어떻게 만들어지고 버전이 어떻게 명명되는지 살펴봤습니다. 이번 글에서는 그 표준을 실제로 실행하는 **JS 엔진**이 무엇이고, 어떻게 코드를 빠르게 처리하는지 파헤칩니다.

## JS 엔진이란

JavaScript 엔진은 `.js` 파일의 텍스트를 받아서 실제로 **실행 가능한 명령어**로 변환하고 실행하는 소프트웨어입니다. 책을 번역해서 독자가 이해할 수 있게 만드는 번역가와 비슷하지만, 엔진은 단순 번역을 넘어 읽는 속도를 분석해서 자주 나오는 문장을 통째로 외워버리는 능력까지 갖추고 있습니다.

3대 메이저 엔진은 다음과 같습니다.

| 엔진 | 개발사 | 사용처 |
|---|---|---|
| **V8** | Google | Chrome, Node.js, Deno, Edge |
| **SpiderMonkey** | Mozilla | Firefox |
| **JavaScriptCore (JSC)** | Apple | Safari, Bun |

## 코드 실행 파이프라인

모든 엔진은 대략 같은 흐름으로 코드를 처리합니다.

![JS 엔진의 코드 실행 파이프라인](/assets/posts/js-engines-architecture.svg)

### 1단계: 파싱 (Parsing)

엔진은 소스 텍스트를 받아 **어휘 분석(Tokenization)**과 **구문 분석(Parsing)**을 거쳐 **AST(Abstract Syntax Tree, 추상 구문 트리)**를 만듭니다. AST는 코드의 구조를 트리 형태로 표현한 내부 데이터입니다.

```javascript
// 이 코드를
const x = 1 + 2;

// 엔진은 대략 이런 트리로 파악합니다
// VariableDeclaration
//   └─ VariableDeclarator (x)
//       └─ BinaryExpression (+)
//           ├─ Literal (1)
//           └─ Literal (2)
```

파싱 단계에서 문법 오류(`SyntaxError`)가 발생합니다. 엔진이 AST를 만들기 전에 코드를 읽다가 이상한 패턴을 발견하면 즉시 오류를 던집니다.

### 2단계: 인터프리터 — 바이트코드 생성

AST를 받은 인터프리터는 이를 **바이트코드(Bytecode)**로 변환합니다. 바이트코드는 CPU가 바로 이해하는 기계어는 아니지만, 소스 텍스트보다 훨씬 빠르게 실행할 수 있는 중간 표현입니다.

V8에서 이 역할을 담당하는 것이 **Ignition**입니다. Ignition은 AST를 바이트코드로 변환하고, 그 바이트코드를 해석하면서 **프로파일링 정보**를 수집합니다. "이 함수는 몇 번 호출됐고, 매개변수로 어떤 타입이 들어왔는가"를 기록하는 것입니다.

### 3단계: JIT 컴파일 — 핫 코드 최적화

특정 코드가 자주 실행되면(**핫 코드, Hot Code**), JIT(Just-In-Time) 컴파일러가 개입합니다. JIT는 수집된 타입 정보를 활용해 해당 코드를 **네이티브 기계어**로 컴파일합니다.

V8에서는 **TurboFan**(고급 최적화), **Maglev**(중간 최적화)가 이 역할을 합니다. 컴파일된 네이티브 코드는 C++로 작성한 코드에 근접하는 속도로 실행됩니다.

## JIT의 핵심 — 타입 가정

JavaScript는 **동적 타입 언어**입니다. 변수의 타입이 런타임에 결정되기 때문에, 정적 분석만으로는 최적화하기 어렵습니다.

![JIT 컴파일의 핵심 — 왜 JavaScript가 빠른가](/assets/posts/js-engines-jit.svg)

JIT 컴파일러는 이 문제를 "**타입이 바뀌지 않을 것이라 가정하고 최적화**"하는 방식으로 해결합니다.

```javascript
function add(a, b) {
  return a + b;
}

// 처음 몇 번은 인터프리터가 실행하며 타입을 기록
add(1, 2);   // a=number, b=number
add(3, 4);   // a=number, b=number
// ...수백 번 반복

// 이후 JIT가 "a와 b는 항상 number"라고 가정하고
// 정수 덧셈 기계어로 직접 컴파일
add(5, 6);   // 매우 빠름

// 하지만...
add('hello', 'world');  // 타입이 바뀜!
// → 역최적화(Deoptimization)
// → 인터프리터 모드로 복귀, 재프로파일링
```

이 때문에 **타입을 일관되게 유지하는 코드가 성능상 유리**합니다. 같은 함수에 숫자와 문자열을 번갈아 넣으면 JIT 최적화가 계속 무효화됩니다.

## V8의 세대별 컴파일러

V8은 실행 빈도에 따라 3단계 컴파일 전략을 씁니다.

1. **Ignition (인터프리터)**: 처음 실행, 빠르게 시작
2. **Maglev (중간 JIT)**: 어느 정도 핫해진 코드, 적당한 최적화
3. **TurboFan (고급 JIT)**: 매우 자주 실행되는 핫 코드, 최대 최적화

이 계층적 구조 덕분에 V8은 콜드 스타트 속도(Ignition)와 최고 성능(TurboFan)을 함께 달성합니다.

## SpiderMonkey와 JavaScriptCore

**SpiderMonkey**는 역사상 최초의 JavaScript 엔진입니다. Brendan Eich가 1995년 처음 만들었고, 이후 Mozilla에서 C++과 일부 Rust로 지속 개발하고 있습니다. Firefox 외에도 GNOME Shell의 스크립팅, MongoDB의 쿼리 엔진으로도 쓰입니다.

**JavaScriptCore(JSC)**는 Apple의 WebKit 프레임워크에 포함된 엔진으로, Safari와 iOS의 모든 브라우저(App Store 규정상 iOS에서는 다른 엔진 사용 불가)가 이를 씁니다. 최근에는 **Bun** 런타임이 JSC를 선택해 Node.js 대비 빠른 시작 속도를 달성하기도 했습니다. JSC는 LLInt(저수준 인터프리터) → DFG(데이터 흐름 그래프 JIT) → FTL(Faster Than Light, LLVM 기반 최적화)의 3단계 구조를 가집니다.

## 엔진 성능 비교

세 엔진 모두 JIT 기반으로 상당히 빠르며, 특정 벤치마크에서는 우위가 엇갈립니다. 실무적으로 엔진을 직접 선택할 일은 거의 없습니다. 브라우저를 배포 타겟으로 삼는다면 모든 엔진을 지원해야 하고, 서버 측이라면 Node.js(V8), Deno(V8), Bun(JSC) 중 하나를 선택하면 됩니다.

다음 글에서는 이 엔진들을 감싸고 있는 **런타임 환경**을 살펴봅니다. 브라우저, Node.js, Deno, Bun이 엔진 외에 어떤 것들을 제공하고, 어떻게 다른지 비교합니다.

---

**지난 글:** [ECMAScript 표준과 버전 이름](/posts/js-ecmascript-standard/)

**다음 글:** [런타임 환경 (브라우저 · Node · Deno · Bun)](/posts/js-runtimes/)

<br>
읽어주셔서 감사합니다. 😊
