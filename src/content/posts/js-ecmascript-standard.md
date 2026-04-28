---
title: "ECMAScript 표준과 TC39 프로세스 — 기능이 언어에 들어오기까지"
description: "ECMAScript와 JavaScript의 관계, TC39가 새로운 기능을 Stage 0부터 Stage 4까지 표준화하는 과정, 그리고 주요 버전별 변화를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["ECMAScript", "TC39", "표준", "ES2015", "ES6"]
featured: false
draft: false
---

[지난 글](/posts/js-what-is-javascript/)에서 JavaScript가 1995년 탄생해 어떻게 세계에서 가장 널리 쓰이는 언어가 되었는지 살펴보았습니다. 그런데 뉴스나 문서에서 "ES2015", "ES6", "ECMAScript 2020" 같은 표현을 접하면 정확히 무엇을 뜻하는지 헷갈릴 수 있습니다. 이번 글에서는 ECMAScript 표준이 어떻게 관리되고, 새 기능이 언어에 공식 채택되기까지 어떤 과정을 거치는지 정리합니다.

## ECMAScript vs JavaScript — 명칭 정리

![ECMAScript vs JavaScript — 명칭 혼란 정리](/assets/posts/js-ecmascript-standard-versions.svg)

**ECMAScript**는 ECMA International이 관리하는 공식 언어 표준의 이름입니다. 공식 문서 번호는 *ECMA-262*입니다. **JavaScript**는 이 표준을 구현한 언어로, 브라우저와 런타임이 ECMAScript 스펙을 따라 구현합니다.

중요한 점은 JavaScript = ECMAScript + 런타임 API라는 것입니다. `Array`, `Promise`, `Map` 같은 내장 객체는 ECMAScript 표준에 정의되어 있습니다. 반면 `document.getElementById()`는 DOM API(브라우저), `fs.readFile()`은 Node.js API입니다. 이들은 ECMAScript 표준이 아니라 각 런타임 환경에서 정의합니다.

## TC39 — 표준을 만드는 위원회

**TC39(Technical Committee 39)**는 ECMAScript 표준을 관리하는 기술 위원회입니다. Mozilla, Google, Apple, Microsoft, Meta, Igalia 등 주요 기술 회사의 엔지니어와 독립 개발자들로 구성됩니다. 위원회는 2개월에 한 번씩 대면 회의를 열고 온라인으로도 지속적으로 논의합니다.

## Stage 0부터 Stage 4까지 — 제안 프로세스

새로운 기능 아이디어는 다섯 단계를 거쳐 표준이 됩니다.

![TC39 제안 프로세스 — Stage 0에서 Stage 4까지](/assets/posts/js-ecmascript-standard-tc39.svg)

**Stage 0 (Strawperson)** — 아직 공식 제안이 아닙니다. TC39 멤버나 기여자가 아이디어를 GitHub 이슈나 문서 형태로 올린 상태입니다.

**Stage 1 (Proposal)** — TC39 멤버 중 한 명이 *챔피언(champion)*으로 나서서 제안을 공식화합니다. 문제를 정의하고 해결책의 윤곽을 잡는 단계입니다. 위원회가 이 제안을 탐구할 가치가 있다고 동의한 상태입니다.

**Stage 2 (Draft)** — 기능의 문법과 의미론을 담은 공식 스펙 초안이 작성됩니다. 구체적인 API 설계가 결정되기 시작합니다.

**Stage 2.7 (추가됨)** — 스펙 텍스트가 완성되어 승인 대기 중인 상태. 2023년부터 추가된 단계입니다.

**Stage 3 (Candidate)** — 스펙이 거의 완성되고 브라우저/런타임이 실험적 구현을 시작합니다. 실제 사용자 피드백을 수집해 최종 조율을 합니다. Stage 3 제안은 이미 Babel이나 TypeScript에서 사용 가능한 경우가 많습니다.

**Stage 4 (Finished)** — 두 개 이상의 독립적인 구현체(예: V8과 SpiderMonkey)에서 테스트를 통과하고 스펙이 최종 확정됩니다. 다음 연간 ECMAScript 버전에 포함됩니다.

```javascript
// Stage 3 제안을 미리 사용하는 예시
// (Babel 또는 최신 Node.js/브라우저에서 실행 가능)

// Array Grouping — Object.groupBy (ES2024)
const items = [
  { type: 'fruit', name: 'apple' },
  { type: 'veggie', name: 'carrot' },
  { type: 'fruit', name: 'banana' },
];
const grouped = Object.groupBy(items, item => item.type);
// { fruit: [{…}, {…}], veggie: [{…}] }

// Array 불변 메서드 (ES2023)
const arr = [3, 1, 2];
const sorted = arr.toSorted(); // [1, 2, 3] — 원본 불변
console.log(arr); // [3, 1, 2] — 변경 없음
```

## 연간 릴리즈 체계

ES6(ES2015) 이전에는 몇 년에 한 번 큰 버전을 출시했습니다. ES2015가 6년 만의 대규모 업데이트였던 탓에 너무 많은 변화가 한꺼번에 쏟아졌습니다. 이후 TC39는 **매년 6월에 새 버전을 출시**하는 체계로 전환했습니다. 덕분에 개발자는 언어 변화를 더 예측 가능하게 따라갈 수 있고, 브라우저는 더 빠르게 구현할 수 있습니다.

버전 명칭도 ES6, ES7 같은 숫자에서 **ES2015, ES2016** 같은 연도 기반으로 바뀌었습니다. 다만 ES6와 ES2015는 같은 버전을 가리킵니다.

## 주요 버전 변화 한눈에

| 버전 | 연도 | 대표 기능 |
|------|------|-----------|
| ES5 | 2009 | strict mode, JSON, Array 고차 메서드 |
| ES2015 (ES6) | 2015 | let/const, 화살표 함수, 클래스, 모듈, 프로미스 |
| ES2017 | 2017 | async/await, Object.values/entries |
| ES2020 | 2020 | BigInt, 옵셔널 체이닝, nullish 병합 |
| ES2022 | 2022 | 클래스 private 필드, Array.at(), Object.hasOwn() |
| ES2024 | 2024 | Object.groupBy(), Promise.withResolvers() |

## 브라우저 지원 — Can I Use와 호환 테이블

표준이 확정되어도 모든 브라우저가 바로 구현하지는 않습니다. [caniuse.com](https://caniuse.com)이나 [MDN 호환성 테이블](https://developer.mozilla.org)에서 각 기능의 브라우저별 지원 현황을 확인할 수 있습니다. 레거시 환경을 지원해야 한다면 Babel이나 TypeScript를 통해 최신 문법을 구형 코드로 트랜스파일합니다.

TC39의 현재 진행 중인 제안 목록은 [github.com/tc39/proposals](https://github.com/tc39/proposals)에서 확인할 수 있습니다.

---

**지난 글:** [JavaScript란 무엇인가?](/posts/js-what-is-javascript/)

**다음 글:** [JavaScript 엔진 — V8은 코드를 어떻게 실행하는가](/posts/js-engines/)

<br>
읽어주셔서 감사합니다. 😊
