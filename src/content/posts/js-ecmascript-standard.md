---
title: "ECMAScript 표준과 버전 이름 — ES5·ES6·ES2015~ES2024"
description: "ECMAScript 표준화 과정, TC39 제안 프로세스, ES6=ES2015 등 이름 혼용의 이유, 그리고 버전별 주요 기능을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "ecmascript", "tc39", "es6", "es2015", "standard"]
featured: false
draft: false
---

[지난 글](/posts/js-what-is-javascript/)에서 JavaScript가 Netscape의 10일짜리 프로젝트로 탄생해 브라우저 전쟁을 거치며 표준화의 필요성을 갖게 된 배경을 살펴봤습니다. 그렇다면 "ECMAScript 표준"은 정확히 무엇이고, 왜 어떤 개발자는 "ES6"라 하고 어떤 개발자는 "ES2015"라 할까요?

## ECMAScript란 무엇인가

JavaScript와 ECMAScript라는 두 이름을 처음 접하면 혼란스럽습니다. 간단히 정리하면 이렇습니다.

**JavaScript**는 Netscape가 만들고 이후 여러 환경에 구현된 **언어의 상용 이름**입니다. **ECMAScript**는 ECMA International이 정의한 **표준 명세의 이름**입니다. JavaScript(V8, SpiderMonkey, JavaScriptCore 등)는 ECMAScript 명세를 구현한 것이고, TypeScript도 ECMAScript 명세를 기반으로 타입 시스템을 추가한 언어입니다.

비유하자면 ECMAScript가 "레시피"라면, JavaScript 엔진은 그 레시피로 만든 "음식"입니다. 레시피는 하나지만 요리사(브라우저 벤더)마다 세부 구현이 조금씩 다를 수 있습니다.

## ES3 → ES5 → ES6: 긴 침묵과 대격변

ECMAScript의 초기 역사는 급성장 후 긴 정체기로 요약됩니다.

**ES3 (1999)**: 정규표현식, try/catch, 엄격한 비교 연산자 등이 추가되며 사실상 10년 동안 실질적인 표준으로 동작했습니다. 대부분의 브라우저가 ES3 수준을 구현했고, jQuery 같은 라이브러리가 이 위에서 만들어졌습니다.

**ES4 (폐기)**: ES4는 클래스, 모듈, 정적 타입 같은 야심찬 기능을 목표로 했지만, Netscape/Mozilla 진영과 Microsoft 사이의 의견 충돌로 결국 폐기됩니다. 이 사건은 TC39가 점진적 변화를 선호하게 된 중요한 교훈이 됩니다.

**ES5 (2009)**: 10년의 공백 후 등장한 ES5는 `strict mode`, JSON 내장 지원, `Array.prototype.forEach/map/filter`, getter/setter 등을 도입했습니다. 특히 strict mode는 JavaScript의 오래된 함정들을 방지하는 안전장치로, 현대 코드베이스의 기반이 됩니다.

**ES6 / ES2015 (2015)**: 6년의 개발 끝에 나온 이 버전은 JavaScript 역사상 가장 큰 변화를 가져왔습니다. `let/const`, 화살표 함수, 클래스, 모듈, Promise, 템플릿 리터럴, 디스트럭처링, Symbol, Map/Set, 제너레이터... 한마디로 "모던 JavaScript"의 시작입니다.

## 이름 혼용: ES6인가 ES2015인가

"ES6"와 "ES2015"는 같은 것을 가리키는 두 이름입니다. 이 혼용이 생긴 이유는 TC39의 명명 전략 변경 때문입니다.

ES6 이전까지는 **번호 기반** 이름을 썼습니다: ES1, ES2, ES3, ES5. 그러나 ES6 이후부터는 매년 출시하는 방식으로 전환하면서 **연도 기반** 이름을 공식 채택했습니다: ES2015, ES2016, ES2017...

따라서 ES6와 ES2015는 100% 동일한 버전을 가리키며, 둘 다 맞는 표현입니다. 다만 ES7=ES2016, ES8=ES2017 같은 번호 매핑은 공식적이지 않으니, ES2016처럼 연도 이름을 쓰는 것이 더 정확합니다.

![ECMAScript 버전 히스토리](/assets/posts/js-ecmascript-standard-versions.svg)

## TC39 제안 프로세스

ES6 이후 "매년 출시"가 가능해진 것은 TC39가 **Stage 0~4 제안 프로세스**를 도입했기 때문입니다. 큰 덩어리를 한꺼번에 내놓는 대신, 기능 하나하나를 독립적으로 제안하고 단계별로 검토합니다.

**Stage 0 (Strawperson)**: TC39 멤버가 아이디어를 공개 저장소에 올립니다. 아직 공식 심사를 거치지 않은 초안입니다.

**Stage 1 (Proposal)**: TC39가 해결할 가치가 있는 문제임을 인정한 상태입니다. API 스케치와 예시 코드가 포함된 공식 제안서가 작성됩니다. 챔피언(champion)이라 불리는 담당 TC39 멤버가 지정됩니다.

**Stage 2 (Draft)**: 공식 명세 텍스트의 초안이 작성됩니다. 문법과 의미론이 명확히 정의되기 시작하지만, 아직 변경될 수 있습니다.

**Stage 3 (Candidate)**: 명세가 거의 완성된 상태입니다. 브라우저 벤더들이 실험적으로 구현을 시작하며, 실사용 피드백을 바탕으로 작은 수정만 허용됩니다. 이 단계에 들어온 기능은 Babel/polyfill 없이 최신 브라우저에서 쓸 수 있는 경우가 많습니다.

**Stage 4 (Finished)**: 두 개 이상의 독립적인 구현체가 존재하고, Test262(공식 테스트 스위트)를 통과한 상태입니다. 다음 연도 ECMAScript 명세에 공식 포함됩니다.

![TC39 제안 프로세스](/assets/posts/js-ecmascript-standard-tc39.svg)

## 주요 버전별 핵심 기능

**ES2016**: `Array.prototype.includes`와 지수 연산자(`**`). 소규모지만 실용적인 추가였습니다.

**ES2017**: `async/await`가 등장했습니다. Promise 체이닝의 복잡함을 해소하고 비동기 코드를 동기 코드처럼 읽을 수 있게 해준 혁명적 기능입니다.

**ES2018**: `for await...of`(비동기 이터레이션), `Promise.finally`, 정규식에 lookbehind와 named capture group이 추가됐습니다.

**ES2019**: `Array.prototype.flat/flatMap`, `Object.fromEntries`, optional catch binding(`catch {}`처럼 매개변수 생략 가능).

**ES2020**: `BigInt`(정수 임의 정밀도), `??`(nullish coalescing), `?.`(optional chaining), `globalThis`.

**ES2021**: 논리 할당 연산자(`&&=`, `||=`, `??=`), `String.prototype.replaceAll`, `WeakRef`.

**ES2022**: 클래스 private 필드(`#field`), `Array.prototype.at()`, `Object.hasOwn`, Error cause 옵션, top-level await.

**ES2023~**: `Array.prototype.toSorted`, `toReversed`, `findLast`, `Object.groupBy`, `Promise.withResolvers` 등이 추가되며 계속 발전 중입니다.

## 브라우저 호환성과 트랜스파일

새 ECMAScript 기능이 Stage 4에 도달해도 모든 사용자의 브라우저가 즉시 지원하지는 않습니다. 이를 해결하는 방법이 두 가지입니다.

**Babel 트랜스파일**: 최신 문법으로 작성한 코드를 구형 브라우저가 이해할 수 있는 ES5 코드로 변환합니다. 예를 들어 화살표 함수를 일반 함수로, `const`를 `var`로 바꿉니다.

**Polyfill**: 새 API(예: `Array.prototype.includes`)가 없는 환경에 직접 구현체를 주입합니다. core-js가 대표적인 폴리필 라이브러리입니다.

```javascript
// 작성 코드 (ES2020)
const user = data?.profile?.name ?? '익명';

// Babel 변환 후 (ES5 호환)
var user = (_data$profile = data === null || data === void 0
  ? void 0 : data.profile) === null || _data$profile === void 0
  ? void 0 : _data$profile.name) !== null && _data$profile !== void 0
  ? _data$profile : '익명';
```

최신 브라우저만 대상으로 한다면 트랜스파일 없이 최신 문법을 바로 쓸 수 있습니다. `browserslist` 설정으로 지원할 브라우저 범위를 지정하면, 번들러가 필요한 변환만 자동으로 처리해줍니다.

## 앞으로의 ECMAScript

TC39는 현재 Temporal(Date 객체 대체), Pattern Matching(switch의 강력한 대안), Explicit Resource Management(`using` 키워드) 같은 기능을 논의 중입니다. [tc39.es](https://tc39.es) 사이트에서 모든 제안의 현재 Stage를 실시간으로 확인할 수 있습니다.

ECMAScript는 특정 회사가 독점적으로 방향을 정하는 것이 아니라, 다양한 이해관계자들이 합의를 통해 발전시킵니다. 이 느리지만 안정적인 프로세스가 JavaScript가 30년 가까이 하위 호환성을 유지하면서도 계속 현대적으로 진화할 수 있게 해주는 비결입니다.

---

**지난 글:** [JavaScript란 무엇인가](/posts/js-what-is-javascript/)

**다음 글:** [JS 엔진 — V8 · SpiderMonkey · JavaScriptCore](/posts/js-engines/)

<br>
읽어주셔서 감사합니다. 😊
