---
title: "JavaScript 엔진 — V8은 코드를 어떻게 실행하는가"
description: "V8, SpiderMonkey, JavaScriptCore 등 주요 JS 엔진의 구조와 JIT 컴파일, Hidden Class, Inline Cache 등 핵심 최적화 기법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["V8", "엔진", "JIT", "최적화", "가비지컬렉션"]
featured: false
draft: false
---

[지난 글](/posts/js-ecmascript-standard/)에서 ECMAScript 표준과 TC39 프로세스를 살펴보았습니다. 표준은 "무엇을" 해야 하는지를 정의하고, 엔진은 그것을 "어떻게" 실행할지를 결정합니다. JavaScript 엔진을 이해하면 코드 성능 병목이 어디서 오는지, 왜 타입을 일관되게 쓰는 것이 중요한지, 메모리 누수가 어떻게 발생하는지를 훨씬 직관적으로 파악할 수 있습니다.

## 엔진이란 무엇인가

JavaScript 엔진은 JS 소스 코드를 받아 실행하는 프로그램입니다. 브라우저의 핵심 구성 요소이자, Node.js처럼 서버 환경에서도 사용됩니다. 엔진은 순수 인터프리터처럼 한 줄씩 해석해 실행하기도 하고, JIT(Just-In-Time) 컴파일러를 통해 자주 실행되는 코드를 기계어로 최적화하기도 합니다.

![주요 JavaScript 엔진 비교](/assets/posts/js-engines-comparison.svg)

현재 세 개의 주요 엔진이 웹 생태계를 지배합니다. **V8**(Google)은 Chrome, Node.js, Deno, Edge에서 사용됩니다. **SpiderMonkey**(Mozilla)는 Firefox에, **JavaScriptCore**(Apple/WebKit)는 Safari와 iOS 환경에서 사용됩니다.

## V8의 실행 파이프라인

V8을 예로 들어 엔진이 코드를 어떻게 처리하는지 단계별로 살펴봅니다.

![V8 엔진의 코드 실행 파이프라인](/assets/posts/js-engines-pipeline.svg)

**1. 파싱(Parsing)** — 소스 코드를 토큰으로 분리하는 어휘 분석(lexing)과 문법 규칙에 따라 트리 구조로 변환하는 구문 분석(parsing)을 거쳐 **AST(Abstract Syntax Tree)**를 생성합니다.

**2. Ignition (인터프리터)** — AST를 받아 **바이트코드(bytecode)**를 생성하고 실행합니다. 컴파일보다 빠르게 시작할 수 있고, 실행 중 프로파일링 정보를 수집합니다.

**3. TurboFan (JIT 컴파일러)** — Ignition이 특정 코드 경로가 "핫(hot)"하다고 판단하면(즉, 자주 실행될 때) TurboFan이 해당 코드를 **최적화된 기계어**로 컴파일합니다. 이 과정에서 타입 추론, 함수 인라이닝 등 고급 최적화가 적용됩니다.

**4. 탈최적화(Deoptimization)** — TurboFan은 타입 정보를 가정하고 최적화합니다. 예를 들어 항상 숫자를 받던 함수에 문자열이 들어오면 가정이 깨져 바이트코드 실행으로 되돌아갑니다(deopt). 이 비용이 크기 때문에 타입 일관성이 성능에 중요합니다.

2021년부터 V8은 Ignition과 TurboFan 사이에 **Maglev**라는 중간 단계 컴파일러를 추가했습니다. 더 빠른 최적화로 시작 성능을 개선합니다.

## Hidden Class — 객체 구조 최적화

JavaScript는 동적 언어라 객체에 언제든 속성을 추가·삭제할 수 있습니다. V8은 이를 효율적으로 처리하기 위해 **Hidden Class(숨겨진 클래스)**라는 내부 구조를 사용합니다.

```javascript
// 같은 형태로 생성 → 같은 Hidden Class 공유 → 최적화
function Point(x, y) {
  this.x = x;
  this.y = y;
}
const p1 = new Point(1, 2);
const p2 = new Point(3, 4); // p1과 같은 Hidden Class

// 다른 순서로 속성 추가 → 다른 Hidden Class → 최적화 방해
const a = {};
a.x = 1; a.y = 2; // Hidden Class C0 → C1 → C2

const b = {};
b.y = 2; b.x = 1; // Hidden Class D0 → D1 → D2 (C와 다름!)
```

생성자 함수나 클래스를 사용해 항상 같은 순서로 속성을 초기화하면 Hidden Class를 공유해 메모리 효율과 속성 접근 속도가 개선됩니다.

## Inline Cache (IC) — 반복 접근 캐싱

엔진은 같은 위치에서 같은 타입의 값에 반복 접근할 때, 그 결과를 캐시합니다. 이를 **Inline Cache**라고 합니다.

```javascript
function getX(point) {
  return point.x; // IC가 'x의 오프셋'을 캐시
}

getX({ x: 1, y: 2 }); // 첫 호출: IC 초기화
getX({ x: 3, y: 4 }); // 같은 Hidden Class → IC 히트 → 빠름
getX({ x: 5, z: 6 }); // 다른 Hidden Class → IC 미스 → 느림
```

## 가비지 컬렉터 — Orinoco

V8의 GC 시스템 Orinoco는 힙을 **Young 세대**와 **Old 세대**로 나눕니다.

- **Minor GC(Scavenger)**: Young 세대에서 빠르게 실행. 대부분의 단명(short-lived) 객체를 처리합니다.
- **Major GC(Mark-Compact)**: Old 세대를 순회하며 참조가 없는 객체를 회수합니다. 메인 스레드 중단(stop-the-world)이 발생할 수 있어 Incremental, Concurrent 방식으로 분산 처리합니다.

```javascript
// 클로저로 인한 의도치 않은 메모리 유지
function heavyTask() {
  const largeArray = new Array(1_000_000).fill(0);
  return function smallClosure() {
    return 42; // largeArray를 참조하지 않아도
               // 같은 스코프라 GC가 수집 못할 수 있음
  };
}
const fn = heavyTask(); // largeArray가 메모리에 남을 수 있음
```

## 엔진 지식을 코드에 적용하기

엔진 내부를 이해하면 몇 가지 실용적인 지침을 도출할 수 있습니다.

1. **타입을 일관되게** — 함수는 항상 같은 타입의 인수를 받도록 설계합니다. 타입이 섞이면 TurboFan이 deopt합니다.
2. **객체 형태 통일** — 생성자나 클래스를 사용해 같은 구조의 객체를 만듭니다.
3. **속성 삭제 지양** — `delete obj.prop`은 Hidden Class를 변경해 최적화를 방해합니다. 대신 `null`이나 `undefined`를 할당합니다.
4. **배열 타입 통일** — 배열에 다양한 타입을 섞으면 SMI(Small Integer) 최적화를 잃습니다.

---

**지난 글:** [ECMAScript 표준과 TC39 프로세스](/posts/js-ecmascript-standard/)

**다음 글:** [JavaScript 런타임 — Node.js, Deno, Bun 비교](/posts/js-runtimes/)

<br>
읽어주셔서 감사합니다. 😊
