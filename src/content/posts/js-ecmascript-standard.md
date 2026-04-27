---
title: "ECMAScript 표준과 버전 이름 (ES5·ES6·ES2015~ES2024)"
description: "ES5, ES6, ES2015 — 같은 듯 다른 이름들의 관계를 정리하고, ECMAScript 버전별 주요 변경과 TC39 프로세스를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "ecmascript", "tc39", "es6", "es2015", "버전"]
featured: false
draft: false
---

지난 [JavaScript란 무엇인가](/posts/js-what-is-javascript/) 글에서 JavaScript가 탄생하고 Node.js를 통해 서버로 확장된 역사를 살펴봤습니다. 이번 글에서는 그 역사의 뼈대가 된 **ECMAScript 표준**과 여전히 혼용되는 버전 이름들을 명확하게 정리합니다.

## ECMAScript란 무엇인가

JavaScript를 공부하다 보면 "ES6를 쓰세요", "ES2015 문법이에요", "ECMAScript 2022에서 추가됐어요" 같은 표현을 자주 접합니다. 같은 것 같기도 하고, 다른 것 같기도 한 이 이름들은 실제로 어떻게 연결되어 있을까요?

**ECMAScript**는 ECMA International이 정의한 스크립트 언어 표준 명세의 이름입니다. JavaScript는 이 명세를 구현한 언어 중 가장 대표적인 것이고, V8·SpiderMonkey·JavaScriptCore 같은 엔진들이 이 명세에 따라 동작합니다.

즉, **ECMAScript = 규칙서**, **JavaScript = 그 규칙을 따르는 실제 언어**라고 이해하면 됩니다.

## 버전 이름의 혼란 — ES6 vs ES2015

버전 명명 방식이 도중에 바뀌었기 때문에 혼란이 생겼습니다.

- **ES1~ES6**: 순서 번호 방식. "제6판"을 ES6이라고 불렀습니다.
- **ES2015~**: 연도 방식. ES6이 2015년에 출판되었기 때문에 ES2015라고도 합니다.

따라서 **ES6 = ES2015**는 완전히 동일한 버전을 가리킵니다. 비슷하게 ES7 = ES2016, ES8 = ES2017이지만, ES2015 이후로는 번호 방식보다 연도 방식이 공식적으로 사용됩니다.

## 버전별 주요 변경 사항

![ECMAScript 버전 역사](/assets/posts/js-ecmascript-standard-versions.svg)

### ES3 (1999) — 최초의 "완성형" JavaScript

정규식, `try/catch/finally`, 배열 메서드(`push`, `pop`, `shift` 등), 더 나은 문자열 처리가 추가됐습니다. 지금도 레거시 환경 호환성을 이야기할 때 "ES3 수준"을 기준점으로 삼는 경우가 있습니다.

### ES5 (2009) — 현대화의 시작

- **Strict mode**: `"use strict"` 선언으로 위험한 문법을 차단
- **JSON 내장**: `JSON.parse()`, `JSON.stringify()` 표준 지원
- **Array 고차 함수**: `forEach`, `map`, `filter`, `reduce`, `every`, `some`
- **Object 메서드**: `Object.create()`, `Object.defineProperty()`, `Object.keys()`

브라우저 지원이 매우 넓고, 많은 트랜스파일러가 ES5를 출력 타겟으로 사용합니다.

### ES6 / ES2015 — 언어의 대전환

2015년에 출판된 ES6는 이전 버전들과 차원이 다른 변화를 담았습니다. 거의 새 언어라고 부를 수 있을 만큼 많은 기능이 한꺼번에 추가됐습니다.

```javascript
// ES5 방식
var add = function(a, b) { return a + b; };

// ES6 방식
const add = (a, b) => a + b;

// 클래스, 구조 분해, 템플릿 리터럴
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name}이(가) 소리를 냈습니다.`;
  }
}

// 모듈
import { something } from './module.js';
export const value = 42;
```

ES6에서 추가된 주요 기능들은 이 시리즈 전체에서 자세히 다룰 예정입니다.

### ES2017 — async/await

비동기 코드를 동기 코드처럼 읽을 수 있게 해주는 `async/await`가 ES2017에서 정식 표준이 됐습니다. 이는 이전의 콜백 중첩(콜백 지옥)과 Promise 체이닝 방식을 대체하는 큰 패러다임 전환이었습니다.

### ES2020 — 실용적인 연산자들

- **Nullish Coalescing (`??`)**: `null`이나 `undefined`일 때만 대체값 반환
- **옵셔널 체이닝 (`?.`)**: 중첩된 객체 접근 시 `null`/`undefined` 안전하게 처리
- **BigInt**: 53비트 한계를 넘는 정수 처리

### ES2022 — 클래스 완성

클래스의 `private` 필드(`#field`)가 정식 표준이 되었고, Top-level `await`(모듈 최상위에서 `await` 사용)와 `Error.cause` 옵션도 추가됐습니다.

## TC39 — 표준을 만드는 과정

ECMAScript는 **TC39(Technical Committee 39)**라는 위원회가 관리합니다. 구글, Mozilla, Apple, Microsoft, Meta 등 주요 기술 회사들이 참여합니다. 새 기능이 표준에 포함되려면 다음 5단계를 통과해야 합니다.

![TC39 제안 프로세스](/assets/posts/js-ecmascript-standard-tc39.svg)

- **Stage 0 (Strawperson)**: 아이디어 수준. TC39 멤버라면 누구나 제안 가능
- **Stage 1 (Proposal)**: 공식 제안. Champion이 지정되어 사용 사례와 API를 정의
- **Stage 2 (Draft)**: 명세 언어로 초안을 기술. 실험적 구현 가능
- **Stage 3 (Candidate)**: 엔진에 실제로 구현, 리뷰어와 편집자의 서명 필요
- **Stage 4 (Finished)**: Test262 테스트 통과, 2개 이상의 엔진 구현 완료 → 표준 채택

이 프로세스는 [proposals.tc39.es](https://tc39.es/proposals/)에서 현재 진행 중인 모든 제안의 단계를 실시간으로 확인할 수 있습니다.

## 버전 호환성 확인 방법

실무에서는 어떤 브라우저나 Node.js 버전이 어떤 ES 기능을 지원하는지 확인해야 합니다.

- **[kangax.github.io/compat-table](https://kangax.github.io/compat-table/es6/)**: 엔진별 ES 기능 지원 현황
- **[node.green](https://node.green/)**: Node.js 버전별 ECMAScript 지원 현황
- **[caniuse.com](https://caniuse.com/)**: 브라우저별 웹 API·JS 기능 지원 현황

코드를 구 환경에서도 실행해야 한다면 **Babel** 같은 트랜스파일러를 사용해 최신 문법을 하위 버전으로 변환합니다. 이 내용은 Part XXV 빌드 편에서 자세히 다룹니다.

## 요약

| 표현 | 의미 |
|---|---|
| JavaScript | ECMAScript를 구현한 언어 |
| ECMAScript | ECMA International의 표준 명세 |
| ES6 = ES2015 | 같은 버전, 이름만 다름 |
| ES2016 이후 | 매년 연도 방식으로 릴리스 |
| TC39 | 표준을 관리하는 위원회 |
| Stage 4 | 표준에 포함된 안전한 기능 |

버전 이름의 혼란은 이 정도로 정리하면 충분합니다. 다음 글에서는 이 ECMAScript 코드를 실제로 실행하는 **JS 엔진**(V8, SpiderMonkey, JavaScriptCore)의 내부 구조를 살펴봅니다.

---

**지난 글:** [JavaScript란 무엇인가](/posts/js-what-is-javascript/)

**다음 글:** [JS 엔진 (V8 · SpiderMonkey · JavaScriptCore)](/posts/js-engines/)

<br>
읽어주셔서 감사합니다. 😊
