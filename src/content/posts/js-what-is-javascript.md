---
title: "JavaScript란 무엇인가 — 브라우저 스크립팅에서 범용 언어로"
description: "1995년 10일 만에 탄생한 언어가 어떻게 세계에서 가장 널리 쓰이는 프로그래밍 언어가 됐는지, JavaScript의 본질과 역사를 깊이 있게 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "history", "web", "nodejs", "ecmascript"]
featured: false
draft: false
---

## 10일 만에 탄생한 언어의 30년

1995년 넷스케이프의 엔지니어 브렌던 아이크(Brendan Eich)는 단 10일 만에 새 언어를 만들어냈습니다. 처음 이름은 **Mocha**, 그다음은 **LiveScript**, 마케팅 전략으로 최종 이름은 **JavaScript**가 됐습니다. Java의 인기에 편승하려는 의도였지만, 이 두 언어는 설계 철학부터 전혀 다릅니다.

당시 목표는 단순했습니다. HTML 폼이 서버로 전송되기 전에 "이메일 형식이 맞는지" 정도를 브라우저 안에서 검사할 수 있는 가벼운 스크립트 언어. 아무도 이 언어가 30년 뒤 전 세계 개발자의 절반 이상이 매일 쓰는 도구가 되리라 예상하지 못했습니다.

---

## JavaScript의 본질 — 네 가지 핵심 특성

JavaScript를 이해하는 첫걸음은 이 언어가 어떤 설계 원칙 위에 세워졌는지 파악하는 것입니다.

### 1. 동적 타입 언어

Java나 C++처럼 변수를 선언할 때 타입을 명시하지 않습니다. 런타임에 값이 할당될 때 타입이 결정됩니다.

```javascript
let x = 42;       // number
x = "hello";      // 이제 string — 오류 없음
x = [1, 2, 3];    // 이제 array — 여전히 오류 없음
```

유연함의 대가로 예상치 못한 타입 변환이 일어나기도 합니다. 이 특성이 JavaScript를 처음엔 쉽게 배울 수 있게 하면서도, 대규모 코드에서 TypeScript가 필요한 이유가 됩니다.

### 2. 인터프리터 언어 — 하지만 JIT이 있다

JavaScript는 인터프리터 언어로 분류되지만, 현대 엔진(V8, SpiderMonkey 등)은 **JIT(Just-In-Time) 컴파일**을 사용합니다. 처음엔 바이트코드로 빠르게 실행하고, 자주 호출되는 코드는 기계어로 최적화 컴파일합니다.

덕분에 한때 "느린 스크립트 언어"였던 JavaScript가 오늘날 서버 사이드 고성능 처리에도 쓰이게 됐습니다.

### 3. 프로토타입 기반 객체지향

Java의 클래스 상속과 달리, JavaScript는 **프로토타입 체인**을 통해 객체가 다른 객체를 직접 상속합니다. ES6에서 `class` 문법이 추가됐지만, 이는 프로토타입을 감싸는 문법적 설탕(syntactic sugar)일 뿐입니다.

```javascript
const animal = { breathes: true };
const dog = Object.create(animal);
dog.barks = true;

console.log(dog.breathes); // true — 프로토타입 체인으로 접근
```

### 4. 일급 함수 (First-class Functions)

JavaScript에서 함수는 값입니다. 변수에 담을 수 있고, 다른 함수의 인자로 전달하거나 반환값으로 쓸 수 있습니다. 이 특성이 콜백 패턴, 클로저, 고차 함수 같은 JavaScript의 핵심 패러다임을 가능하게 합니다.

```javascript
const greet = (name) => `Hello, ${name}!`;
const apply = (fn, value) => fn(value);

console.log(apply(greet, "World")); // "Hello, World!"
```

---

## 역사의 궤적 — 어떻게 범용 언어가 됐나

![JavaScript의 진화](/assets/posts/js-what-is-javascript-evolution.svg)

### 1995~2004: 브라우저 전쟁 속 혼돈

초기 JavaScript는 넷스케이프와 인터넷 익스플로러의 **브라우저 전쟁** 속에서 파편화됐습니다. 넷스케이프의 JavaScript와 Microsoft의 JScript는 미묘하게 달랐고, 개발자들은 두 브라우저에서 각각 동작하는 코드를 따로 작성해야 했습니다.

이 혼돈을 해결하려는 노력이 1997년 **ECMAScript** 표준으로 이어집니다. 하지만 표준화가 진행되는 동안에도 브라우저 간 불일치는 계속됐고, JavaScript는 "장난감 언어"라는 오명을 벗지 못했습니다.

### 2005: AJAX가 바꾼 모든 것

2005년 제시 제임스 가렛(Jesse James Garrett)이 **AJAX(Asynchronous JavaScript and XML)**라는 개념을 소개합니다. 페이지 전체를 새로고침하지 않고 서버와 데이터를 교환하는 방식입니다.

구글 지도와 Gmail이 이 기술의 가능성을 세상에 보여줬습니다. 지도를 드래그하면 새 영역이 로드되고, 메일함은 새로고침 없이 업데이트됩니다. 개발자들은 "JavaScript로 이런 것도 만들 수 있구나"를 처음 실감했습니다.

같은 해 jQuery가 등장하면서 크로스 브라우저 DOM 조작이 쉬워졌고, JavaScript 생산성이 급격히 높아졌습니다.

### 2009: Node.js — 브라우저 밖으로

2009년 라이언 달(Ryan Dahl)이 **Node.js**를 공개했습니다. V8 엔진을 서버에서 실행할 수 있게 한 것입니다. 이제 JavaScript는 브라우저에만 갇혀 있지 않았습니다.

비동기 I/O 모델과 npm 패키지 생태계가 폭발적으로 성장하면서, 프론트엔드 개발자가 같은 언어로 백엔드까지 작성하는 **풀스택** 개발이 가능해졌습니다. JavaScript는 처음으로 "범용 언어" 가능성을 보였습니다.

### 2015~현재: ES6와 새로운 시대

2015년 ECMAScript 2015(ES6)는 JavaScript를 완전히 다른 언어로 탈바꿈시켰습니다. 화살표 함수, 클래스, 모듈 시스템, Promise, 제너레이터 등 수십 가지 현대적 기능이 한꺼번에 추가됐습니다.

이후 매년 새 버전이 출시되는 체계가 정착됐고, TypeScript가 대형 프로젝트에서 사실상 표준으로 자리 잡았습니다. React, Vue, Svelte 같은 프레임워크가 UI 개발 방식을 혁신했고, Next.js·Nuxt·SvelteKit 같은 메타 프레임워크가 풀스택 개발을 더욱 쉽게 만들었습니다.

---

## JavaScript가 동작하는 곳

오늘날 JavaScript는 단순한 브라우저 언어가 아닙니다.

![JavaScript가 동작하는 곳](/assets/posts/js-what-is-javascript-roles.svg)

**프론트엔드 웹**은 여전히 JavaScript의 독점 영역입니다. HTML·CSS와 함께 웹의 3대 언어로, 브라우저에서 돌아가는 유일한 프로그래밍 언어입니다.

**서버 백엔드**에서는 Node.js, Deno, Bun이 각자의 영역을 구축했습니다. Netflix, LinkedIn, PayPal 같은 대기업이 Node.js 기반 마이크로서비스를 운영합니다.

**모바일 앱**은 React Native와 Ionic이 iOS·Android 앱을 JavaScript로 만들 수 있게 합니다. 완전한 네이티브 성능은 아니지만, 코드 재사용성과 개발 속도에서 장점이 큽니다.

**데스크톱 앱**은 Electron이 열었습니다. VS Code, Slack, Figma의 데스크톱 앱이 모두 Electron 기반입니다. Tauri는 더 가벼운 대안으로 주목받고 있습니다.

**Edge 컴퓨팅**에서는 Cloudflare Workers가 사용자 근처에서 JavaScript를 실행해 레이턴시를 줄입니다.

---

## "왜 JavaScript인가"에 대한 솔직한 답

JavaScript가 모든 면에서 훌륭한 언어는 아닙니다. 역사적 우연과 레거시가 뒤섞여 있고, 초기 설계 결정 중 일부는 오늘날에도 혼란을 일으킵니다(`typeof null === 'object'`, `0.1 + 0.2 !== 0.3` 등).

하지만 JavaScript가 이토록 널리 쓰이는 이유는 분명합니다:

1. **브라우저에서 실행되는 유일한 언어** — 웹 개발을 한다면 JavaScript는 선택이 아닌 필수입니다.
2. **거대한 생태계** — npm에는 200만 개 이상의 패키지가 있습니다.
3. **낮은 진입 장벽** — `<script>` 태그 하나로 시작할 수 있습니다.
4. **지속적인 진화** — TC39 위원회가 매년 언어를 개선합니다.

이 시리즈에서는 JavaScript의 겉모습이 아니라 작동 원리를 깊이 파고듭니다. 엔진이 코드를 어떻게 실행하는지, 타입 시스템이 어떻게 동작하는지, 비동기가 실제로 어떤 메커니즘인지 — 이 모든 것을 처음부터 차근차근 쌓아 올립니다.

---

**지난 글:** [모던 문법 — ES2018 이후 필수 문법 정리](/posts/js-modern-syntax/)

**다음 글:** [ECMAScript 표준과 버전 이름 — ES5·ES6·ES2015~ES2024](/posts/js-ecmascript-standard/)

<br>
읽어주셔서 감사합니다. 😊
