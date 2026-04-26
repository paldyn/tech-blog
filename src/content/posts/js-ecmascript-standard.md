---
title: "ECMAScript 표준과 버전 이름 — ES5·ES6·ES2015~ES2024"
description: "JavaScript의 공식 표준인 ECMAScript가 무엇인지, ES5부터 ES2024까지 각 버전의 핵심 변화를 정리하고 TC39 제안 프로세스를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "ecmascript", "es6", "tc39", "standards", "es2015"]
featured: false
draft: false
---

## JavaScript와 ECMAScript — 같은 듯 다른 이름

지난 글에서 JavaScript가 어떻게 탄생했는지 살펴봤습니다. 그런데 공식 문서나 MDN을 보다 보면 "JavaScript" 대신 "ECMAScript"라는 단어가 자주 등장합니다. 이 둘은 무엇이 다를까요?

**ECMAScript**는 JavaScript의 **표준 명세서**입니다. ECMA International이라는 국제 표준화 기구가 ECMA-262라는 문서로 관리합니다. 마치 HTML의 표준이 W3C(혹은 WHATWG)가 관리하는 것처럼요.

JavaScript(V8, SpiderMonkey), JScript(옛 IE), ActionScript(Flash) — 이것들은 모두 ECMAScript 명세를 구현한 **방언(dialect)**입니다. 브렌던 아이크의 언어가 Microsoft, Adobe 등의 반발을 피해 중립적 이름으로 표준화된 것이 ECMAScript입니다. 오늘날 실무에선 두 이름을 거의 같은 의미로 씁니다.

---

## 버전 이름의 혼란 — ES6인가 ES2015인가

JavaScript를 처음 배울 때 가장 헷갈리는 부분 중 하나가 버전 이름입니다.

| 흔히 부르는 이름 | 공식 이름 | 발표 연도 |
|---|---|---|
| ES5 | ECMAScript 5 | 2009 |
| **ES6** | **ECMAScript 2015** | **2015** |
| ES7 | ECMAScript 2016 | 2016 |
| ES8 | ECMAScript 2017 | 2017 |
| ES9 | ECMAScript 2018 | 2018 |
| ES10 | ECMAScript 2019 | 2019 |
| ... | ECMAScript 20XX | 20XX |

ES6까지는 ES숫자 형식으로 불렸지만, 2015년부터 **매년 출시**하는 방식으로 바뀌면서 공식 이름이 연도 기반(ES2015, ES2016, ...)으로 전환됐습니다. 하지만 개발자들은 여전히 ES6, ES7... 이라는 숫자 이름을 많이 씁니다. 둘 다 같은 것을 가리키니 맥락에 따라 편한 쪽을 쓰면 됩니다.

---

## 주요 버전 살펴보기

![ECMAScript 버전 히스토리](/assets/posts/js-ecmascript-standard-timeline.svg)

### ES3 (1999) — 프로그래밍 언어다운 기초

ES1, ES2는 소소한 교정 수준이었고, **ES3**에서 처음으로 제대로 된 기능들이 추가됐습니다. 정규 표현식, `try/catch` 예외 처리, `do-while`, `switch` 등 오늘날 당연하게 여기는 기능들이 ES3에서 생겼습니다.

### ES5 (2009) — 현대 JavaScript의 출발점

10년의 공백 끝에 나온 **ES5**는 많은 것을 바꿨습니다.

- **Strict Mode** (`'use strict'`): 느슨한 동작을 엄격하게 제한
- **JSON 내장 지원**: `JSON.parse`, `JSON.stringify`
- **Array 고차 메서드**: `forEach`, `map`, `filter`, `reduce`, `every`, `some`
- **`Object.defineProperty`**: 프로퍼티 디스크립터
- **`getter/setter`**: 객체 접근자

ES5는 모든 현대 브라우저에서 안정적으로 지원되기 때문에, Babel 같은 트랜스파일러의 주요 출력 타깃이 됐습니다.

### ES6 / ES2015 (2015) — 패러다임 전환

**ES6**는 JavaScript 역사에서 가장 큰 변화입니다. 추가된 기능만 수십 가지입니다.

```javascript
// let, const
let count = 0;
const MAX = 100;

// 화살표 함수
const double = x => x * 2;

// 구조 분해 할당
const { name, age } = person;
const [first, ...rest] = array;

// 템플릿 리터럴
const msg = `Hello, ${name}! You are ${age}.`;

// 클래스
class Animal {
  constructor(name) {
    this.name = name;
  }
}

// Promise
fetch('/api/data')
  .then(res => res.json())
  .then(data => console.log(data));

// 모듈
import { sum } from './math.js';
export const PI = 3.14159;
```

이외에도 `Symbol`, 제너레이터, `Map/Set`, `WeakMap/WeakSet`, `for...of`, 기본 매개변수, 스프레드 연산자 등이 모두 ES6에서 추가됐습니다.

### ES2017 — async/await

**async/await**는 Promise의 사용성을 혁신했습니다. 비동기 코드를 동기 코드처럼 읽기 쉽게 만들었습니다.

```javascript
// Promise 체인 방식
function loadUser(id) {
  return fetch(`/users/${id}`)
    .then(res => res.json())
    .then(user => loadPosts(user.id))
    .catch(err => console.error(err));
}

// async/await 방식
async function loadUser(id) {
  const res = await fetch(`/users/${id}`);
  const user = await res.json();
  return loadPosts(user.id);
}
```

`Object.entries()`, `Object.values()`도 이때 추가됐습니다.

### ES2020 — 실용적인 편의 기능

개발자들이 오랫동안 원했던 기능들이 드디어 표준에 들어왔습니다.

```javascript
// Optional chaining — TypeError 없이 안전하게 접근
const city = user?.address?.city;

// Nullish coalescing — null/undefined일 때만 기본값
const name = user.name ?? '익명';

// BigInt — 큰 정수 처리
const big = 9007199254740991n + 1n;
```

### ES2021~ES2024 — 작지만 강한 개선들

```javascript
// ES2021: 논리 할당
x ||= defaultValue;  // x가 falsy면 defaultValue 할당
x ??= defaultValue;  // x가 null/undefined면 할당

// ES2022: Array.at() — 음수 인덱스 지원
const last = arr.at(-1);

// ES2022: Error cause
throw new Error('fetch 실패', { cause: originalError });

// ES2024: Object.groupBy()
const grouped = Object.groupBy(items, item => item.category);

// ES2024: Promise.withResolvers()
const { promise, resolve, reject } = Promise.withResolvers();
```

---

## TC39 — 표준을 만드는 사람들

ECMAScript는 어떻게 발전하는 걸까요? ECMA International의 **TC39(Technical Committee 39)**가 이 과정을 주관합니다.

![TC39 제안 프로세스](/assets/posts/js-ecmascript-standard-tc39.svg)

TC39에는 Google(V8), Mozilla(SpiderMonkey), Apple(JavaScriptCore), Microsoft, Meta, Bloomberg 등의 엔지니어들이 참여합니다. 약 2개월마다 회의를 열어 새 제안을 검토합니다.

새 기능은 **Stage 0에서 Stage 4**까지 단계적으로 검증받습니다.

- **Stage 0 (Strawperson)**: 아이디어 수준. TC39 멤버라면 누구나 제출 가능
- **Stage 1 (Proposal)**: 공식 제안. 챔피언(담당 엔지니어)이 배정되고 문제와 해결책을 정의
- **Stage 2 (Draft)**: 명세 초안 작성. 문법과 의미론이 구체화되고 실험적 구현 시작
- **Stage 3 (Candidate)**: 명세 완성. 여러 JavaScript 엔진이 구현하고 실사용 피드백 수집
- **Stage 4 (Finished)**: 표준 편입. 다음 연간 릴리스에 포함

일반적으로 Stage 3에 오른 기능은 사실상 표준화될 것으로 봅니다. Babel, TypeScript 같은 도구들도 Stage 3 기능을 일찍 지원하기 시작합니다.

---

## 버전보다 중요한 것 — 브라우저 지원

ECMAScript 버전이 나왔다고 해서 모든 환경에서 즉시 쓸 수 있는 건 아닙니다. 브라우저와 Node.js 각각의 **구현 속도**가 다르기 때문입니다.

실무에서는 [Can I use](https://caniuse.com)나 [node.green](https://node.green) 같은 사이트로 지원 현황을 확인합니다. 그리고 지원하지 않는 환경을 위해 **Babel** 같은 트랜스파일러로 구형 문법으로 변환(transpile)합니다.

```text
소스 코드 (ES2024)
    ↓ Babel / SWC / esbuild
출력 코드 (ES5 또는 ES2015 타겟)
    ↓
구형 브라우저에서도 실행 가능
```

TypeScript도 마찬가지입니다. `tsconfig.json`의 `target` 옵션으로 출력 ECMAScript 버전을 지정합니다.

---

## 정리

ECMAScript는 JavaScript의 표준이고, TC39가 매년 새 버전을 발표합니다. ES5는 현대 JS의 기초를 닦았고, ES6/ES2015는 언어 전체를 뒤흔드는 대변화였습니다. 이후 매년 작지만 실용적인 기능들이 꾸준히 추가되고 있습니다.

다음 글에서는 JavaScript 코드를 실제로 실행하는 **엔진**—V8, SpiderMonkey, JavaScriptCore—이 어떻게 동작하는지 살펴봅니다.

---

**다음 글:** JS 엔진 — V8·SpiderMonkey·JavaScriptCore 동작 원리

<br>
읽어주셔서 감사합니다. 😊
