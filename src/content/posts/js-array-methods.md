---
title: "배열 메서드 — map·filter·reduce부터 불변 메서드까지"
description: "JavaScript 배열을 선언적으로 다루는 핵심 메서드들을 정리합니다. map, filter, reduce 삼총사부터 flatMap, find, some, every, 그리고 ES2023의 toSorted·toReversed·with까지."
author: "PALDYN Team"
pubDate: "2026-04-25"
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "배열", "map", "filter", "reduce", "flatMap", "toSorted", "ES2023", "배열메서드"]
featured: false
draft: false
---

모듈 시스템으로 코드 구조를 잡는 방법을 살펴봤습니다. 이번에는 실제 데이터를 다루는 일상적인 작업, 즉 **배열 조작**을 살펴봅니다. JavaScript의 배열 메서드는 `for` 루프를 대신해 선언적으로 데이터를 변환, 탐색, 집계하는 방법을 제공합니다. 어떤 메서드가 있고, 각각 언제 쓰는지를 정리합니다.

---

## 명령형 vs 선언형

먼저 왜 배열 메서드를 쓰는지부터 짚어봅니다. 같은 로직을 두 가지 방식으로 쓸 수 있습니다.

```js
// 명령형 — "어떻게"를 지시
const activeUsers = [];
for (let i = 0; i < users.length; i++) {
  if (users[i].active) {
    activeUsers.push(users[i]);
  }
}

// 선언형 — "무엇"을 원하는지 표현
const activeUsers = users.filter(u => u.active);
```

선언형 코드는 의도가 명확합니다. `filter`라는 단어 자체가 "조건에 맞는 것만 남긴다"는 의미를 전달합니다. `for` 루프에서는 변수 초기화, 경계 조건, 인덱스 관리 같은 부수적인 코드가 핵심 로직을 가립니다.

---

## 변환의 삼총사: map · filter · reduce

세 메서드는 배열 작업의 90%를 담당합니다.

![배열 메서드 분류](/assets/posts/js-array-methods-overview.svg)

**map** — 각 요소를 변환해 같은 길이의 새 배열을 만듭니다.

```js
const names = users.map(u => u.name);
const doubled = [1, 2, 3].map(n => n * 2);   // [2, 4, 6]

// 인덱스도 받을 수 있음
const numbered = items.map((item, i) => ({ ...item, rank: i + 1 }));
```

**filter** — 조건을 만족하는 요소만 모아 새 배열을 만듭니다. 원본 길이보다 짧거나 같습니다.

```js
const adults = users.filter(u => u.age >= 18);
const nonNull = values.filter(Boolean);   // null, undefined, 0, '' 제거
```

**reduce** — 배열을 하나의 값으로 줄입니다. "합계", "평균", "그룹핑", "객체 변환" 등 다양하게 씁니다.

```js
const total = prices.reduce((sum, price) => sum + price, 0);

// 배열 → 객체 (가장 강력한 활용)
const byId = users.reduce((acc, user) => {
  acc[user.id] = user;
  return acc;
}, {});
```

`reduce`는 초기값(`0`, `{}`, `[]`)을 반드시 명시하는 습관이 좋습니다. 빈 배열에서 초기값 없이 호출하면 TypeError가 발생합니다.

---

## 체이닝 — 데이터 파이프라인

세 메서드 모두 새 배열(또는 값)을 반환하기 때문에 연결할 수 있습니다.

![메서드 체이닝 — 데이터 파이프라인](/assets/posts/js-array-methods-chaining.svg)

```js
const topScores = users
  .filter(u => u.active)
  .map(u => ({ name: u.name, score: u.score * (u.premium ? 1.5 : 1) }))
  .toSorted((a, b) => b.score - a.score)
  .slice(0, 10);
```

체이닝은 데이터가 단계별로 변환되는 파이프라인입니다. 각 단계는 독립적이어서 테스트하기 쉽고, 단계를 추가하거나 제거하기도 용이합니다.

주의할 점은 **성능**입니다. `filter → map → reduce` 체인은 배열을 세 번 순회합니다. 수십만 개 이상의 요소를 다룬다면 하나의 `reduce`로 합치는 것이 낫습니다. 하지만 대부분의 UI 데이터는 수백~수천 개 수준이라 문제가 없습니다.

---

## 탐색: find · findIndex · some · every

배열에서 특정 요소를 찾거나 조건을 검사합니다.

```js
// 조건에 맞는 첫 요소 반환 (없으면 undefined)
const admin = users.find(u => u.role === 'admin');

// 조건에 맞는 첫 요소의 인덱스 반환 (없으면 -1)
const idx = users.findIndex(u => u.id === targetId);

// 하나라도 조건을 충족하면 true
const hasAdmin = users.some(u => u.role === 'admin');

// 모두 조건을 충족해야 true
const allActive = users.every(u => u.active);

// 값이 포함되는지 (참조가 아닌 값 비교)
const hasNull = values.includes(null);
```

`find`와 `filter`의 차이는 **하나 vs 전부**입니다. 한 명의 사용자를 id로 찾을 때는 `find`, 조건에 맞는 목록 전체가 필요할 때는 `filter`를 씁니다.

ES2023에서 `findLast`와 `findLastIndex`가 추가되었습니다. 배열 끝에서부터 검색합니다.

```js
const lastError = logs.findLast(log => log.type === 'error');
```

---

## 평탄화: flat · flatMap

중첩 배열을 다룰 때 씁니다.

**flat(depth)** — 중첩 배열을 지정한 깊이만큼 평탄화합니다.

```js
[1, [2, 3], [4, [5, 6]]].flat()     // [1, 2, 3, 4, [5, 6]]  (기본 depth 1)
[1, [2, 3], [4, [5, 6]]].flat(2)    // [1, 2, 3, 4, 5, 6]
[1, [2, [3, [4]]]].flat(Infinity)   // 완전히 평탄화
```

**flatMap(fn)** — `map` 후 `flat(1)`과 같습니다. 하나의 요소를 여러 요소로 "펼치는" 변환에 씁니다.

```js
// 각 문장을 단어로 분리
const words = sentences.flatMap(s => s.split(' '));

// 홀수만 두 배로 — map + filter 조합을 하나로
const result = [1, 2, 3, 4].flatMap(n => n % 2 !== 0 ? [n * 2] : []);
// [2, 6]
```

`flatMap`에서 빈 배열 `[]`을 반환하면 그 요소는 결과에서 제외됩니다. `filter + map`을 합친 것처럼 쓸 수 있습니다.

---

## 생성: Array.from · Array.of

**Array.from** — 이터러블이나 유사 배열(NodeList, Set, Map, 문자열)을 실제 배열로 변환합니다.

```js
// DOM NodeList → 배열
const buttons = Array.from(document.querySelectorAll('button'));
buttons.forEach(btn => btn.disabled = true);   // forEach 사용 가능

// Set 중복 제거
const unique = Array.from(new Set([1, 1, 2, 3, 2]));   // [1, 2, 3]

// 두 번째 인자로 변환 함수
const squares = Array.from({ length: 5 }, (_, i) => i ** 2);
// [0, 1, 4, 9, 16]
```

`Array.from({ length: n }, fn)` 패턴은 특정 크기의 배열을 초기값과 함께 만드는 관용구입니다. `[...Array(n).keys()]`와 같은 목적이지만 더 읽기 쉽습니다.

---

## ES2022: at() 메서드

음수 인덱스로 배열 끝에서부터 접근합니다.

```js
const arr = [1, 2, 3, 4, 5];

arr.at(-1)   // 5  (마지막)
arr.at(-2)   // 4  (끝에서 두 번째)

// 이전 방식
arr[arr.length - 1]   // 반복적, 실수하기 쉬움
```

`at()`은 문자열과 TypedArray에도 동일하게 작동합니다. `arr.at(0)`은 `arr[0]`과 같습니다.

---

## ES2023: 불변 배열 메서드

`sort()`, `reverse()`, `splice()`는 **원본 배열을 변경**합니다. 이것이 의도치 않은 버그의 원인이 됩니다.

```js
const scores = [3, 1, 4, 1, 5];
const sorted = scores.sort((a, b) => a - b);
// scores도 정렬됨! — 같은 참조
```

ES2023에서는 원본을 보존하는 대응 메서드가 추가되었습니다.

```js
const scores = [3, 1, 4, 1, 5];

// 원본 보존
const sorted = scores.toSorted((a, b) => a - b);    // scores는 그대로
const reversed = scores.toReversed();                 // scores는 그대로
const spliced = scores.toSpliced(1, 2, 9, 9);       // [3, 9, 9, 1, 5]

// with: 특정 인덱스의 값만 교체
const updated = scores.with(2, 99);   // [3, 1, 99, 1, 5]
```

React, Zustand, Redux 같은 불변성 기반 상태 관리에서 특히 유용합니다. `.slice()` 복사 후 조작하던 패턴을 대체합니다.

---

## 어떤 메서드를 고를까

간단한 판단 기준:

- 각 요소를 **변환**해야 한다 → `map`
- 조건에 맞는 것만 **필터링**해야 한다 → `filter`
- 하나의 **합산/집계** 값이 필요하다 → `reduce`
- **첫 번째** 매칭 요소만 필요하다 → `find`
- 조건을 충족하는 것이 **있는지/전부인지** 확인 → `some` / `every`
- 중첩 배열을 **평탄화**해야 한다 → `flat` / `flatMap`
- 원본을 **변경하지 않고** 정렬/역순/수정 → `toSorted` / `toReversed` / `with`

`reduce`는 만능이지만 의도가 불분명해질 수 있습니다. `filter`와 `map`으로 표현 가능한 것은 그렇게 쓰는 것이 더 읽기 좋습니다.

---

배열 메서드를 자유롭게 다루면 데이터 처리 코드가 훨씬 간결해집니다. 다음 글에서는 배열의 짝인 **객체(Object)**를 다루는 패턴들을 정리합니다. 단축 프로퍼티, 계산 프로퍼티명, `Object.entries`/`fromEntries`, 불변 패턴, 프로퍼티 디스크립터까지 살펴봅니다.

---

**다음 글:** 객체 패턴 — 단축 프로퍼티부터 프로퍼티 디스크립터까지

<br>
읽어주셔서 감사합니다. 😊
