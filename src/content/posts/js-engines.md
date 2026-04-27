---
title: "JS 엔진 — V8 · SpiderMonkey · JavaScriptCore"
description: "JavaScript 엔진이 소스 코드를 어떻게 기계어로 변환하는지, V8의 Ignition·TurboFan 파이프라인, 히든 클래스 최적화, 그리고 3대 엔진의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "engine", "v8", "spidermonkey", "jit", "optimization"]
featured: false
draft: false
---

[지난 글](/posts/js-ecmascript-standard/)에서 ECMAScript 표준이 TC39의 제안 프로세스를 통해 매년 발전하는 과정을 살펴봤습니다. 그런데 브라우저나 Node.js는 이 명세를 어떻게 실제로 실행할까요? 그 역할을 담당하는 것이 바로 **JavaScript 엔진**입니다.

## JS 엔진이란 무엇인가

JavaScript 엔진은 JavaScript 소스 코드를 읽고, 분석하고, 실행하는 프로그램입니다. 텍스트로 작성된 JS 코드를 CPU가 이해할 수 있는 기계어로 변환하는 것이 핵심 역할입니다.

초기 엔진들은 단순히 코드를 한 줄씩 해석해서 실행하는 **인터프리터** 방식이었습니다. 그러나 이 방식은 같은 코드를 반복 실행할 때마다 매번 해석해야 해서 느렸습니다. 현대 엔진은 인터프리터와 **JIT(Just-In-Time) 컴파일러**를 결합해, 자주 실행되는 코드는 미리 최적화된 기계어로 컴파일해두는 전략을 씁니다.

## V8: 가장 널리 쓰이는 엔진

V8은 Google이 2008년 Chrome 브라우저와 함께 공개한 오픈소스 엔진입니다. C++로 구현됐으며, Node.js, Deno, Bun(일부), Electron, Figma 등 수많은 환경의 기반이 됩니다. 오늘날 웹 트래픽의 상당수가 V8 위에서 처리된다고 해도 과언이 아닙니다.

### V8의 컴파일 파이프라인

V8이 소스 코드를 실행하는 과정을 단계별로 살펴보겠습니다.

**1. 파싱(Parsing)**: 텍스트 소스 코드를 토큰화하고, 문법 분석을 거쳐 **AST(추상 구문 트리)**를 생성합니다. AST는 코드의 논리적 구조를 트리 형태로 표현한 것입니다.

**2. Ignition(인터프리터)**: AST를 **바이트코드**로 변환하고 즉시 실행합니다. 바이트코드는 기계어보다 추상적이지만 파싱 없이 빠르게 실행할 수 있습니다. 동시에 어떤 코드가 얼마나 자주 실행되는지 **프로파일링** 정보를 수집합니다.

**3. TurboFan(JIT 컴파일러)**: 프로파일링 결과로 "핫스팟(hot spot)"—자주 실행되는 코드—이 식별되면, TurboFan이 해당 코드를 최적화된 **기계어**로 컴파일합니다. 이 최적화 과정에서 타입 정보를 활용합니다.

**4. 역최적화(Deoptimization)**: TurboFan은 "이 변수는 항상 숫자일 것"이라고 가정하고 최적화합니다. 그런데 나중에 문자열이 들어오면 가정이 깨지므로, 최적화된 코드를 버리고 Ignition 바이트코드로 되돌아갑니다. 이를 **Deopt**라고 합니다.

![V8 컴파일 파이프라인과 히든 클래스](/assets/posts/js-engines-pipeline.svg)

### 히든 클래스 (Hidden Class)

V8의 핵심 최적화 중 하나는 **히든 클래스**입니다. JavaScript 객체는 런타임에 자유롭게 프로퍼티를 추가하거나 제거할 수 있어서, 정적 언어처럼 메모리 레이아웃을 미리 결정하기 어렵습니다.

V8은 이 문제를 해결하기 위해 객체의 구조(프로퍼티 이름과 순서)가 같으면 동일한 "히든 클래스"를 공유하게 합니다. 히든 클래스가 같은 객체들은 **인라인 캐시(Inline Cache)**를 통해 프로퍼티 접근을 매우 빠르게 처리합니다.

```javascript
// 좋은 패턴: 동일한 구조
const a = { x: 1, y: 2 };
const b = { x: 3, y: 4 }; // a, b가 같은 히든 클래스 공유

// 나쁜 패턴: 구조가 달라짐
const c = {};
c.x = 1; c.y = 2; // 히든 클래스 변환 2회 발생

const d = {};
d.y = 2; d.x = 1; // c와 다른 히든 클래스
```

프로퍼티를 항상 **같은 순서로, 객체 리터럴에서 한번에** 초기화하는 것이 V8 최적화에 유리합니다.

### 가비지 컬렉션

V8의 GC는 **Orinoco**라는 이름의 시스템으로, 힙을 Young Generation(단수명 객체)과 Old Generation(장수명 객체)으로 나눕니다. Young Gen의 GC(Scavenger)는 매우 빠르고, Old Gen의 GC는 Mark-and-Sweep 방식으로 더 느리지만 덜 자주 실행됩니다. 메인 스레드를 최대한 멈추지 않도록(incremental, concurrent GC) 설계되어 있습니다.

## SpiderMonkey: 최초의 JS 엔진

SpiderMonkey는 1995년 Brendan Eich가 Netscape를 위해 만든 세계 **최초의 JavaScript 엔진**입니다. 현재는 Mozilla가 Firefox에서 사용하며 C++과 Rust 혼합으로 구현되어 있습니다.

SpiderMonkey의 JIT 파이프라인은 **Baseline JIT**(빠른 컴파일, 기초 최적화)와 **IonMonkey**(고수준 최적화, 타입 특화)로 구성됩니다. Mozilla는 오픈소스 철학 아래 표준 준수에 엄격하며, 새로운 ECMAScript 기능의 실험적 구현을 선도하는 경우가 많습니다.

SpiderMonkey는 Firefox 외에도 Servo 프로젝트, Meta의 Hermes(React Native용 엔진)에도 영향을 미쳤습니다.

## JavaScriptCore: Apple의 선택

JavaScriptCore(JSC)는 Apple이 Safari와 WebKit을 위해 개발한 엔진입니다. **iOS에서는 Apple의 정책상 다른 엔진을 사용할 수 없기** 때문에, iPhone/iPad의 모든 브라우저(Chrome iOS, Firefox iOS 포함)는 내부적으로 JSC를 사용합니다.

JSC의 JIT 파이프라인은 4단계로 더 세분화되어 있습니다: **LLInt**(Low-Level Interpreter), **Baseline JIT**, **DFG**(Data Flow Graph) JIT, **FTL**(Fourth-Tier LLVM) JIT. 각 단계로 올라갈수록 컴파일 시간은 늘지만 실행 속도가 빨라집니다.

Apple은 배터리 수명을 중시해, 에너지 효율에 특히 집중한 최적화를 진행합니다.

![3대 JS 엔진 비교](/assets/posts/js-engines-comparison.svg)

## 엔진이 개발자에게 주는 시사점

엔진 내부를 이해하면 성능 최적화에 도움이 됩니다.

**타입 일관성 유지**: 함수에 항상 같은 타입의 인자를 전달하면 JIT 최적화가 더 잘 동작합니다. `add(1, 2)`, `add('a', 'b')`를 같은 함수로 처리하면 엔진이 최적화를 포기합니다.

**객체 구조 안정화**: 객체 생성 후 프로퍼티를 동적으로 추가/삭제하는 것보다, 처음부터 필요한 모든 프로퍼티를 초기화하는 것이 좋습니다.

**배열 타입 통일**: 숫자만 담긴 배열은 내부적으로 compact한 표현을 사용합니다. 배열에 다양한 타입을 섞으면 최적화 혜택이 사라집니다.

```javascript
// 최적화 유리: 단일 타입
const nums = [1, 2, 3, 4, 5];

// 최적화 불리: 혼합 타입
const mixed = [1, 'two', { three: 3 }];
```

물론 이런 마이크로 최적화를 맹목적으로 추구하는 것보다는, 먼저 코드의 로직과 알고리즘 수준에서 성능을 개선하는 것이 훨씬 효과적입니다. 엔진은 이미 충분히 똑똑하게 최적화를 수행하니까요.

## Hermes: React Native 전용 엔진

Hermes는 Meta(Facebook)가 React Native를 위해 만든 JS 엔진입니다. 모바일 환경의 제약(느린 CPU, 적은 메모리)에 맞춰 설계됐으며, **앱 빌드 타임에 바이트코드로 미리 컴파일**하는 AOT(Ahead-of-Time) 전략을 사용합니다. 덕분에 앱 시작 시간이 크게 단축됩니다.

---

**지난 글:** [ECMAScript 표준과 버전 이름](/posts/js-ecmascript-standard/)

**다음 글:** [런타임 환경 — 브라우저 · Node · Deno · Bun](/posts/js-runtimes/)

<br>
읽어주셔서 감사합니다. 😊
