---
title: "JS 엔진 — V8·SpiderMonkey·JavaScriptCore 동작 원리"
description: "JavaScript 코드를 실제로 실행하는 엔진의 내부 동작을 파헤칩니다. 파싱부터 JIT 컴파일, Hidden Class, 인라인 캐싱까지 성능의 비밀을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "v8", "jit", "engine", "performance", "hidden-class", "spidermonkey"]
featured: false
draft: false
---

## 엔진이란 무엇인가

앞선 두 글에서 JavaScript가 무엇인지, ECMAScript 표준이 어떻게 발전했는지 살펴봤습니다. 그런데 JavaScript 코드는 실제로 어떻게 실행될까요? `const x = 1 + 2`라고 쓰면 컴퓨터가 그 의미를 어떻게 파악하고 계산 결과를 낼까요?

이 역할을 하는 것이 **JavaScript 엔진**입니다. 엔진은 JavaScript 소스 코드를 받아 분석하고, 최종적으로는 CPU가 이해할 수 있는 기계어 명령어로 실행합니다.

주요 엔진은 세 가지입니다:
- **V8** — Google 개발, Chrome·Node.js·Deno·Bun에서 사용
- **SpiderMonkey** — Mozilla 개발, Firefox에서 사용 (세계 최초의 JS 엔진)
- **JavaScriptCore(JSC)** — Apple 개발, Safari에서 사용

---

## V8 컴파일 파이프라인 — 소스에서 기계어까지

V8을 기준으로 JavaScript 코드가 어떤 단계를 거치는지 살펴봅니다. SpiderMonkey와 JSC도 세부 구현은 다르지만 큰 흐름은 비슷합니다.

![V8 컴파일 파이프라인](/assets/posts/js-engines-pipeline.svg)

### 1단계: 파싱 (Parsing)

JavaScript 소스 코드는 사람이 읽기 위한 텍스트입니다. 엔진은 이 텍스트를 먼저 **토크나이저(tokenizer)**로 토큰 단위로 잘라냅니다.

```text
function add(a, b) { return a + b; }
    ↓ 토크나이저
[keyword:"function"] [ident:"add"] [punct:"("] [ident:"a"] ...
```

그다음 **파서(parser)**가 토큰 배열을 **AST(Abstract Syntax Tree, 추상 구문 트리)**로 변환합니다. AST는 코드의 구조를 트리 형태로 표현한 것입니다.

```json
{
  "type": "FunctionDeclaration",
  "id": { "name": "add" },
  "params": [{"name": "a"}, {"name": "b"}],
  "body": {
    "type": "ReturnStatement",
    "argument": {
      "type": "BinaryExpression",
      "operator": "+",
      "left": {"name": "a"},
      "right": {"name": "b"}
    }
  }
}
```

V8은 성능을 위해 즉시 실행하지 않아도 되는 함수는 **지연 파싱(lazy parsing)**을 합니다. 필요할 때만 완전한 AST로 변환하는 것이죠.

### 2단계: 인터프리터 실행 — Ignition

V8의 인터프리터 **Ignition**은 AST를 **바이트코드(bytecode)**로 변환하고 즉시 실행합니다. 바이트코드는 기계어보다 추상적이지만, 텍스트 소스보다 훨씬 실행하기 좋은 형태입니다.

`--print-bytecode` 플래그로 V8이 생성하는 바이트코드를 직접 볼 수도 있습니다.

```bash
node --print-bytecode script.js
```

처음에 바이트코드로 실행하는 이유는 **시작 시간을 빠르게 하기 위해서**입니다. JIT 컴파일은 강력하지만 컴파일 자체에 시간이 걸립니다. 짧은 코드나 한 번만 실행되는 코드를 굳이 최적화할 필요가 없습니다.

### 3단계: JIT 컴파일 — TurboFan

Ignition이 코드를 실행하면서 **프로파일링 정보**를 수집합니다. 어떤 함수가 자주 호출되는지, 특정 변수에 항상 같은 타입의 값이 들어오는지 등을 추적합니다.

**"Hot path"**, 즉 자주 실행되는 코드가 감지되면 TurboFan JIT 컴파일러가 그 코드를 **고도로 최적화된 기계어**로 컴파일합니다.

예를 들어 `add(1, 2)`를 수천 번 호출해서 `a`, `b`가 항상 `number`라는 정보가 쌓이면, TurboFan은 "이 함수는 항상 숫자만 받는다"고 가정하고 타입 체크를 생략한 초고속 기계어를 생성합니다.

### 역최적화 (Deoptimization)

JIT 최적화의 함정이 있습니다. `add("hello", " world")`처럼 갑자기 타입이 바뀌면, TurboFan이 만든 최적화 코드는 무효가 됩니다. 이때 V8은 **역최적화(deoptimization)**를 수행해 다시 Ignition 바이트코드로 되돌아갑니다.

이것이 JavaScript에서 **타입을 일관되게 유지하는 것이 성능에 중요한 이유**입니다.

---

## Hidden Class — 객체 성능의 핵심

동적 타입 언어인 JavaScript에서 객체는 언제든 프로퍼티가 추가·삭제될 수 있습니다. 이를 그대로 구현하면 프로퍼티를 찾을 때마다 해시맵을 뒤지는 느린 동작이 됩니다.

V8은 이 문제를 **Hidden Class(숨겨진 클래스)**로 해결합니다. 객체에 프로퍼티가 추가될 때마다 새로운 Hidden Class가 만들어지고, 같은 구조의 객체들은 Hidden Class를 공유합니다.

```javascript
function Point(x, y) {
  this.x = x;  // Hidden Class C1 생성: {x: number}
  this.y = y;  // Hidden Class C2 생성: {x: number, y: number}
}

const p1 = new Point(1, 2); // C2 사용
const p2 = new Point(3, 4); // C2 공유 → 빠른 접근
```

`p1.x`에 접근할 때 V8은 "C2 클래스의 x는 오프셋 0에 있다"는 것을 알기 때문에 해시맵 조회 없이 직접 접근합니다.

반면 같은 프로퍼티를 다른 순서로 추가하면 Hidden Class가 달라져서 공유가 깨집니다.

```javascript
const a = {};
a.x = 1;  // C1: {x}
a.y = 2;  // C2: {x, y}

const b = {};
b.y = 9;  // C1': {y} — 다른 Hidden Class!
b.x = 8;  // C2': {y, x} — C2와 다름
```

---

## 인라인 캐싱 (Inline Caching)

Hidden Class 위에서 동작하는 또 다른 최적화입니다. 특정 프로퍼티 접근이 반복되면 V8은 "이 코드는 항상 C2 클래스의 객체를 받는다"고 캐싱합니다. 다음에 같은 Hidden Class의 객체가 오면 오프셋을 바로 사용합니다.

함수 인수로 항상 같은 구조의 객체가 오면 이 최적화가 제대로 동작합니다. 여러 구조의 객체가 섞이면 **Polymorphic IC**로 전환되고, 더 많이 섞이면 **Megamorphic IC**가 되어 최적화 이점이 사라집니다.

---

## 3대 엔진 비교

![3대 JavaScript 엔진 비교](/assets/posts/js-engines-comparison.svg)

세 엔진 모두 ECMAScript 표준을 구현하므로 동일한 코드가 같은 결과를 냅니다. 하지만 내부 구현은 상당히 다릅니다.

**V8**의 TurboFan은 매우 공격적인 최적화로 알려져 있습니다. Node.js 생태계 덕분에 서버 사이드 벤치마크 데이터가 풍부하고 지속적으로 개선되고 있습니다.

**SpiderMonkey**는 세계 최초의 JS 엔진입니다. 브렌던 아이크가 1995년에 작성한 코드에서 시작됐으며, WarpMonkey JIT 컴파일러로 꾸준히 성능을 개선하고 있습니다. Firefox의 개인정보 보호 철학처럼 메모리 안전성에도 투자해 일부 컴포넌트를 Rust로 재작성했습니다.

**JavaScriptCore**는 계층적 JIT 아키텍처가 특징입니다. LLInt → Baseline JIT → DFG(Data Flow Graph) JIT → FTL(Fourth Tier LLVM) JIT로 단계적으로 최적화 수준을 올립니다. iOS 환경에서는 JIT 실행이 제한되어 인터프리터 모드 성능이 중요합니다.

---

## 실무에서 엔진을 신경써야 할 때

대부분의 애플리케이션 코드에서 특정 엔진의 내부 동작을 고려할 필요는 없습니다. 하지만 다음 상황에서는 알아두면 좋습니다.

**성능 크리티컬한 코드를 작성할 때**:
- 루프 안의 객체는 구조를 일관되게 유지하세요. 루프 내에서 프로퍼티를 추가·삭제하면 Hidden Class가 반복적으로 바뀝니다.
- 배열에는 동일한 타입의 값만 넣으면 더 효율적인 내부 표현을 사용합니다. `[1, 2, 3]`은 SMI(Small Integer) 배열로 최적화됩니다.
- 함수에 항상 같은 타입의 인수를 전달하면 IC 최적화가 제대로 동작합니다.

**Node.js 서버 성능을 튜닝할 때**:
- `node --prof`로 CPU 프로파일링을 실행하면 V8이 어느 함수를 얼마나 최적화했는지 볼 수 있습니다.
- Chrome DevTools의 Performance 탭은 V8 내부의 Ignition/TurboFan 레이어 정보를 표시합니다.

---

## 정리

JavaScript 엔진은 단순한 인터프리터가 아닙니다. 파싱 → 바이트코드 실행 → JIT 최적화라는 파이프라인을 통해 동적 타입 언어임에도 높은 성능을 달성합니다. Hidden Class와 인라인 캐싱은 이 최적화의 핵심 메커니즘입니다.

다음 글에서는 이 엔진들이 돌아가는 **런타임 환경** — 브라우저, Node.js, Deno, Bun — 의 차이를 살펴봅니다.

---

**지난 글:** [ECMAScript 표준과 버전 이름 — ES5·ES6·ES2015~ES2024](/posts/js-ecmascript-standard/)

**다음 글:** [런타임 환경 — 브라우저·Node·Deno·Bun의 차이](/posts/js-runtimes/)

<br>
읽어주셔서 감사합니다. 😊
