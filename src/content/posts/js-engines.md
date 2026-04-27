---
title: "JS 엔진 — V8 · SpiderMonkey · JavaScriptCore"
description: "JavaScript 엔진의 내부 동작 원리(파싱·AST·인터프리터·JIT 컴파일)와 V8·SpiderMonkey·JavaScriptCore 3대 엔진의 특징을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "V8", "엔진", "JIT", "SpiderMonkey", "JavaScriptCore", "성능"]
featured: false
draft: false
---

[지난 글](/posts/js-ecmascript-standard/)에서 ECMAScript 명세가 TC39에 의해 어떻게 만들어지는지 살펴봤습니다. 그렇다면 그 명세를 실제로 실행하는 것은 누구일까요? 바로 **JavaScript 엔진**입니다. 엔진은 당신이 작성한 `.js` 파일을 CPU가 이해할 수 있는 기계어로 바꿔 실행합니다.

## JavaScript 엔진이란

엔진은 JavaScript 소스 코드를 받아 실행 결과를 내놓는 프로그램입니다. C++로 작성되어 있으며, 각 브라우저와 런타임은 자체 엔진을 내장합니다.

현재 널리 사용되는 3대 엔진:
- **V8** — Google (Chrome, Node.js, Deno, Bun, Edge)
- **SpiderMonkey** — Mozilla (Firefox)
- **JavaScriptCore** — Apple (Safari, iOS, Bun 내부)

## 코드가 실행되기까지: 파이프라인

![V8 엔진 파이프라인](/assets/posts/js-engines-pipeline.svg)

JavaScript 코드가 실행되는 과정을 V8을 기준으로 살펴보면:

### 1단계: 파싱(Parsing)

엔진이 소스 코드를 읽어 **토큰(token)**으로 분리합니다. `let x = 42;`는 `let`, `x`, `=`, `42`, `;` 다섯 토큰이 됩니다.

이 토큰들로 **AST(Abstract Syntax Tree, 추상 구문 트리)**를 만듭니다. AST는 코드의 구조를 트리 형태로 표현한 것입니다:

```javascript
// 소스 코드
let x = 42;

// AST (개념적 표현)
// VariableDeclaration
//   └─ kind: "let"
//   └─ VariableDeclarator
//        ├─ id: Identifier(x)
//        └─ init: NumericLiteral(42)
```

### 2단계: Ignition — 인터프리터

V8의 인터프리터 **Ignition**이 AST를 **바이트코드(bytecode)**로 변환하고 즉시 실행합니다. 바이트코드는 기계어보다 추상적이지만, 소스 코드보다 훨씬 빠르게 해석할 수 있습니다.

Ignition은 코드를 실행하면서 동시에 **프로파일링 데이터**를 수집합니다. "이 함수는 몇 번이나 호출됐나?", "이 변수는 항상 정수인가?" 같은 정보입니다.

### 3단계: TurboFan — JIT 컴파일러

자주 실행되는 "뜨거운(Hot)" 코드를 발견하면 V8의 JIT 컴파일러 **TurboFan**이 동작합니다.

![JIT 컴파일 원리](/assets/posts/js-engines-jit.svg)

TurboFan은 프로파일링 데이터를 기반으로 **가정(assumption)**을 세우고 최적화된 기계어를 생성합니다. 예를 들어 "이 함수의 인자는 항상 정수"라는 가정 하에 타입 검사를 생략한 빠른 기계어를 만드는 것입니다.

## 역최적화(Deoptimization)

JIT의 약점이 바로 여기에 있습니다. 가정이 깨지면 엔진은 다시 인터프리터 모드로 돌아가야 합니다. 이를 **deoptimization(역최적화)**라고 합니다.

```javascript
function add(a, b) {
  return a + b;
}

// 처음 1000번 — a, b 모두 숫자
add(1, 2);      // TurboFan: "a, b는 정수" 가정 → 최적화

// 갑자기 문자열
add("hello", "world");  // 가정 깨짐 → deopt 발생!
```

이것이 JavaScript에서 일관된 타입을 유지하는 것이 성능에 중요한 이유입니다. TypeScript를 쓰거나, 하나의 함수가 여러 타입을 받지 않도록 하면 엔진이 더 잘 최적화할 수 있습니다.

## Hidden Class — 객체 최적화의 비결

동적 타입 언어인 JavaScript에서 V8이 객체 프로퍼티에 빠르게 접근하는 비결은 **Hidden Class**입니다.

같은 구조의 객체들은 같은 Hidden Class를 공유합니다. 엔진이 "이 객체는 x, y 두 속성을 가지며, x는 오프셋 0에, y는 오프셋 8에 있다"고 기억할 수 있어 정적 언어처럼 빠르게 동작합니다.

```javascript
// 좋은 패턴: 동일한 Hidden Class 공유
const p1 = { x: 1, y: 2 };
const p2 = { x: 3, y: 4 };  // p1과 같은 Hidden Class

// 나쁜 패턴: Hidden Class 전환 발생
const a = { x: 1 };         // Hidden Class A
a.y = 2;                     // Hidden Class B로 전환! (느림)

// 나쁜 패턴: 프로퍼티 순서가 다르면 다른 Hidden Class
const b = { x: 1, y: 2 };   // Hidden Class B
const c = { y: 2, x: 1 };   // Hidden Class C (다름!)
```

## 3대 엔진의 특징

### V8 (Google)

- Chrome, Node.js, Deno, Bun, Microsoft Edge에서 사용
- Ignition(인터프리터) + TurboFan(JIT) 아키텍처
- 가장 넓은 사용 기반 → 가장 많은 최적화 투자
- WebAssembly 지원도 포함

### SpiderMonkey (Mozilla)

- Firefox에서 사용하는 최초의 JavaScript 엔진
- 1995년 Brendan Eich가 처음 작성
- WarpMonkey JIT 컴파일러 + Warp IonMonkey
- 웹 표준 선도에서 역사적으로 중요한 역할

### JavaScriptCore (Apple)

- Safari, iOS WebKit, Bun 내부에서 사용
- LLInt(저수준 인터프리터) → Baseline JIT → DFG JIT → FTL JIT의 4단계 파이프라인
- Bun이 JSC를 선택한 이유: 스타트업 성능과 메모리 효율

## 엔진을 알면 코드가 달라진다

엔진의 동작 원리를 알면 더 나은 코드를 쓸 수 있습니다:

```javascript
// 엔진 친화적 코드
// 1. 생성자에서 모든 프로퍼티 초기화
class Point {
  constructor(x, y) {
    this.x = x;  // Hidden Class 안정화
    this.y = y;
  }
}

// 2. 단형(monomorphic) 함수 선호
function square(n) {   // n이 항상 숫자 → JIT 최적화 효율
  return n * n;
}

// 3. 배열 타입 일관성 유지
const nums = [1, 2, 3];           // SMI(Small Integer) 배열
nums.push(4);                      // 여전히 SMI 배열
nums.push(1.5);                    // 부동소수점 배열로 전환! (내부 재할당)
```

엔진은 우리가 작성하는 JavaScript를 최대한 빠르게 실행하기 위해 정교한 최적화를 수행합니다. 그 원리를 이해하면 성능이 중요한 코드에서 올바른 선택을 할 수 있습니다.

---

**지난 글:** [ECMAScript 표준과 버전 이름](/posts/js-ecmascript-standard/)

**다음 글:** [런타임 환경 — 브라우저 · Node · Deno · Bun](/posts/js-runtimes/)

<br>
읽어주셔서 감사합니다. 😊
