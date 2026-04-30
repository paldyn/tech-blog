---
title: "구조 분해 할당 완전 정복"
description: "JavaScript 배열·객체 구조 분해 할당의 문법부터 중첩 분해, 기본값, 이름 변경, 함수 파라미터 분해, 이터러블 활용까지 실전 패턴을 총망라합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 12
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "구조분해", "destructuring", "배열분해", "객체분해", "ES6", "함수파라미터"]
featured: false
draft: false
---

[지난 글](/posts/js-spread-rest/)에서 `...` 스프레드와 나머지 파라미터를 살펴봤습니다. 구조 분해 할당(destructuring assignment)은 같은 ES2015 물결에서 나온 문법으로, 배열이나 객체의 값을 패턴 매칭으로 변수에 바인딩합니다. React props 분해, API 응답 처리, 함수 파라미터 명명 등 현대 JavaScript 코드에서 가장 빈번하게 쓰이는 문법입니다.

## 배열 구조 분해

배열 리터럴 형태의 패턴으로 왼쪽에서 오른쪽으로 순서대로 바인딩합니다.

```javascript
const [a, b, c] = [10, 20, 30];   // a=10, b=20, c=30

// 일부만 추출 — 쉼표로 건너뜀
const [,, third] = [1, 2, 3];     // third=3

// 나머지 수집 (스프레드와 결합)
const [head, ...tail] = [1, 2, 3, 4];
// head=1, tail=[2,3,4]

// 변수 스왑 — 임시 변수 불필요
let x = 1, y = 2;
[x, y] = [y, x];                  // x=2, y=1
```

패턴 위치가 중요합니다. 나머지(`...rest`)는 반드시 마지막에 와야 하며, 추출된 값이 없으면 `undefined`가 됩니다.

## 객체 구조 분해

중괄호 패턴으로 속성 이름 기준으로 바인딩합니다. 순서는 무관합니다.

```javascript
const user = { name: 'Kim', age: 30, role: 'admin' };

// 기본 — 속성명 = 변수명
const { name, age } = user;

// 이름 변경 (콜론 뒤가 새 변수명)
const { name: userName } = user;   // userName = 'Kim'

// 기본값 (값이 undefined일 때만 적용)
const { role = 'guest' } = user;   // role = 'admin' (있으므로 무시)
const { score = 0 } = user;        // score = 0 (없으므로 기본값)

// 이름 변경 + 기본값 동시
const { role: r = 'guest' } = user; // r = 'admin'

// 나머지
const { name: _, ...rest } = user;
// rest = { age: 30, role: 'admin' }
```

![구조 분해 기본 문법](/assets/posts/js-destructuring-basics.svg)

## 기본값의 동작 원칙

기본값은 분해된 값이 **정확히 `undefined`일 때만** 적용됩니다. `null`은 `null`로 바인딩됩니다.

```javascript
const { a = 1 } = { a: null };    // a = null (기본값 무시)
const { b = 1 } = { b: undefined };// b = 1 (기본값 적용)
const { c = 1 } = {};             // c = 1 (없으면 undefined → 기본값)
```

## 중첩 구조 분해

중첩된 배열·객체도 패턴을 중첩시켜 한 번에 분해할 수 있습니다.

```javascript
// 중첩 객체
const { user: { addr: { city } } } = {
  user: { addr: { city: 'Seoul' } }
};
// city = 'Seoul'

// 중첩 배열
const [[r, g], b] = [[255, 128], 0];

// 혼합
const { data: [first] } = { data: [42, 43] };
// first = 42
```

중첩이 깊어질수록 가독성이 떨어집니다. 3단계 이상이라면 단계별로 분리하는 편이 낫습니다.

## 함수 파라미터 구조 분해

가장 자주 쓰이는 패턴입니다. 함수에 객체를 넘기면서 내부에서 즉시 분해합니다.

```javascript
function render({ title, body, footer = '' }) {
  return `<article><h1>${title}</h1>${body}${footer}</article>`;
}

render({ title: '제목', body: '내용' });
```

파라미터 자체에 기본값을 줘서 인수 없이 호출해도 안전하게 만들 수 있습니다.

```javascript
function connect({ host = 'localhost', port = 3000 } = {}) {
  return `${host}:${port}`;
}
connect();              // 'localhost:3000'
connect({ port: 8080 });// 'localhost:8080'
```

`= {}` 부분이 없으면 `connect()`는 `undefined`를 분해하려다 TypeError가 납니다.

## 이터러블 구조 분해

배열 구조 분해는 이터러블 프로토콜을 따르므로 배열 외 이터러블에도 동작합니다.

```javascript
// Set
const [first, second] = new Set([10, 20, 30]);  // 10, 20

// Map 엔트리 순회
for (const [key, value] of map.entries()) {
  console.log(key, value);
}

// 제너레이터
function* gen() { yield 1; yield 2; yield 3; }
const [a, b] = gen();  // a=1, b=2
```

![구조 분해 실전 패턴](/assets/posts/js-destructuring-patterns.svg)

## import 구문의 구조 분해

ES 모듈 named import는 구조 분해 할당과 유사하게 보이지만, 실제로는 별개의 언어 구문입니다. `import { useState } from 'react'`에서 `useState`는 실시간 바인딩(live binding)이며 재할당도 불가합니다. 구조 분해처럼 이름을 바꾸려면 `as` 키워드를 씁니다.

```javascript
import { useState as useLocalState } from 'react';
```

## null·undefined 안전 분해

분해 대상이 `null` 또는 `undefined`이면 TypeError가 발생합니다. null 병합 연산자와 조합해 방어합니다.

```javascript
const { name } = apiResponse ?? {};   // apiResponse가 null이어도 안전
const [first] = maybeArray ?? [];
```

## 선언 없는 객체 분해 주의

`let` 없이 이미 선언된 변수에 재할당할 때, 중괄호로 시작하면 블록으로 파싱됩니다.

```javascript
let a, b;
{ a, b } = { a: 1, b: 2 };    // SyntaxError — 블록 + 레이블로 해석
({ a, b } = { a: 1, b: 2 }); // ✓ 괄호로 감싸야 함
```

---

**지난 글:** [스프레드와 나머지 파라미터 완전 정복](/posts/js-spread-rest/)

**다음 글:** [템플릿 리터럴 완전 정복](/posts/js-template-literals/)

<br>
읽어주셔서 감사합니다. 😊
