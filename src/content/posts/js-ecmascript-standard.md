---
title: "ECMAScript 표준과 버전 이름 — ES5·ES6·ES2015~ES2024"
description: "JavaScript의 공식 명세인 ECMAScript의 탄생부터 TC39 제안 프로세스, ES5/ES6/ES2015~ES2024 각 버전의 핵심 기능까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "ECMAScript", "ES6", "ES2015", "TC39", "버전"]
featured: false
draft: false
---

[지난 글](/posts/js-what-is-javascript/)에서 JavaScript가 10일 만에 탄생하고 브라우저를 넘어 범용 언어로 성장한 역사를 살펴봤습니다. 이번 글에서는 JavaScript의 공식 명세인 **ECMAScript**가 어떻게 만들어지고, ES5·ES6·ES2015 같은 버전명이 무엇을 의미하는지 정리합니다.

## ECMAScript란 무엇인가

JavaScript는 구현체이고, **ECMAScript**는 그 구현이 따라야 할 **명세(specification)**입니다. 비유하자면 ECMAScript는 건축 도면이고, Chrome의 V8, Firefox의 SpiderMonkey, Safari의 JavaScriptCore가 각각 그 도면을 보고 지은 건물입니다.

1996년 Netscape는 JavaScript를 표준화하기 위해 ECMA International(유럽 컴퓨터 제조업체 협회)에 명세 작성을 의뢰합니다. Sun Microsystems가 "JavaScript"라는 이름에 상표권을 가지고 있었기 때문에, 표준 이름은 **ECMAScript**가 됩니다.

TC39(Technical Committee 39)가 이 명세를 관리합니다. Google, Mozilla, Apple, Microsoft, Igalia 등의 엔지니어들이 참여하며, 매년 새로운 기능을 추가한 버전을 발표합니다.

## 버전명 혼란 정리

ECMAScript 버전명은 두 가지 표기 방식이 혼재합니다:

```text
ES1   → 1997 (초판)
ES2   → 1998
ES3   → 1999
ES5   → 2009  (ES4는 취소됨)
ES6   → 2015  ← 가장 중요, ES2015라고도 함
ES7   → 2016 = ES2016
ES8   → 2017 = ES2017
ES2018, ES2019, ES2020 ...  (이후 연도 표기 정착)
```

**ES2015부터 연도 기반 표기가 공식**이 됐습니다. ES6와 ES2015는 완전히 같은 버전입니다. ES7/ES8 같은 숫자 표기는 비공식이지만 여전히 커뮤니티에서 많이 쓰입니다.

![ECMAScript 버전 타임라인](/assets/posts/js-ecmascript-standard-timeline.svg)

## TC39 제안 프로세스 — Stage 0에서 Stage 4까지

새 기능이 ECMAScript 명세에 포함되려면 TC39의 공식 5단계 프로세스를 통과해야 합니다.

![TC39 제안 프로세스](/assets/posts/js-ecmascript-standard-tc39.svg)

- **Stage 0 (Strawperson)**: TC39 멤버가 아이디어를 제안하는 단계. 아직 명세가 없습니다.
- **Stage 1 (Proposal)**: 챔피언(담당 TC39 멤버)이 지정되고 문제와 해법을 구체적으로 기술합니다.
- **Stage 2 (Draft)**: 정식 명세 초안이 작성됩니다. 실험적 폴리필이 등장하기 시작합니다.
- **Stage 3 (Candidate)**: 명세가 확정되고 엔진 구현이 시작됩니다. 대부분의 엔진이 플래그와 함께 지원합니다.
- **Stage 4 (Finished)**: 2개 이상의 독립 구현이 존재하고, 다음 연간 ECMAScript에 포함됩니다.

Stage 3에 도달한 기능은 대체로 표준에 포함될 것이 확실시됩니다. Decorators가 Stage 3에 수년째 머물고 있는 것처럼, 복잡한 기능은 Stage 3에서도 오래 걸릴 수 있습니다.

## ES5 — 안정화의 시대 (2009)

ES3(1999) 이후 10년 만에 나온 ES5는 현대 JavaScript의 기반을 다집니다:

```javascript
// strict mode — ES5의 핵심 기능
"use strict";

// Array 메서드
[1, 2, 3].forEach(n => console.log(n));
[1, 2, 3].map(n => n * 2);   // [2, 4, 6]
[1, 2, 3].filter(n => n > 1); // [2, 3]

// JSON 내장
const obj = JSON.parse('{"name":"JS"}');
JSON.stringify(obj);  // '{"name":"JS"}'

// Object.create, defineProperty
Object.keys({ a: 1, b: 2 }); // ['a', 'b']
```

ES5는 현재도 구형 브라우저 지원을 위한 Babel 컴파일 타깃으로 자주 사용됩니다.

## ES6 / ES2015 — 가장 중요한 버전

ES2015는 JavaScript를 현대적인 언어로 탈바꿈시킨 역사적인 업데이트입니다. 추가된 기능이 너무 많아서 "JavaScript 2.0"으로 불리기도 합니다:

```javascript
// let · const — 블록 스코프 변수
let count = 0;
const MAX = 100;

// 화살표 함수
const double = x => x * 2;

// 템플릿 리터럴
const name = "World";
console.log(`Hello, ${name}!`);

// 디스트럭처링
const { a, b } = { a: 1, b: 2 };
const [first, ...rest] = [1, 2, 3];

// 클래스
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} speaks`;
  }
}

// 모듈
import { something } from './module.js';
export const value = 42;

// Promise
fetch('/api/data')
  .then(res => res.json())
  .then(data => console.log(data));

// 제너레이터
function* gen() {
  yield 1;
  yield 2;
}
```

## ES2016 ~ ES2020 — 점진적 개선

ES2015 이후부터는 매년 작은 단위로 기능이 추가됩니다:

```javascript
// ES2016: 지수 연산자, Array.includes
2 ** 10;                   // 1024
[1, 2, 3].includes(2);    // true

// ES2017: async/await
async function fetchData() {
  const res = await fetch('/api/data');
  return res.json();
}

// ES2018: 객체 스프레드, Promise.finally
const merged = { ...obj1, ...obj2 };

// ES2019: Array.flat, Object.fromEntries
[[1, 2], [3, 4]].flat();                    // [1, 2, 3, 4]
Object.fromEntries([['a', 1], ['b', 2]]);   // {a: 1, b: 2}

// ES2020: Optional chaining, Nullish coalescing, BigInt
const city = user?.address?.city;
const name = input ?? "기본값";
const big = 9007199254740993n;
```

## ES2021 ~ ES2024 — 최신 기능

```javascript
// ES2021: 논리 할당
x ||= "default";   // x가 falsy면 할당
x ??= "default";   // x가 null/undefined면 할당

// ES2022: Array.at, Object.hasOwn, Error cause
[1, 2, 3].at(-1);  // 3 (마지막 요소)
Object.hasOwn(obj, 'key');
throw new Error("실패", { cause: originalError });

// ES2023: Array.findLast, toSorted/toReversed
[1, 2, 3].findLast(n => n < 3);  // 2
[3, 1, 2].toSorted();             // [1, 2, 3] (원본 유지)

// ES2024: Object.groupBy, Promise.withResolvers
const groups = Object.groupBy([1, 2, 3, 4], n => n % 2 === 0 ? 'even' : 'odd');
const { promise, resolve, reject } = Promise.withResolvers();
```

## 호환성 확인 방법

새 기능을 사용하기 전에 브라우저/Node 지원 여부를 확인해야 합니다:

- **[MDN Web Docs](https://developer.mozilla.org)**: 각 API의 "Browser compatibility" 표
- **[Can I use](https://caniuse.com)**: 브라우저별 지원 현황 시각화
- **Babel**: 최신 문법을 구형 환경용으로 트랜스파일
- **Node.js 릴리스 노트**: Node 버전별 V8 지원 기능

TypeScript를 사용한다면 `tsconfig.json`의 `target` 옵션으로 컴파일 대상 ES 버전을 지정할 수 있습니다.

---

**지난 글:** [JavaScript란 무엇인가](/posts/js-what-is-javascript/)

**다음 글:** [JS 엔진 — V8 · SpiderMonkey · JavaScriptCore](/posts/js-engines/)

<br>
읽어주셔서 감사합니다. 😊
