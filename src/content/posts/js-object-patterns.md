---
title: "객체 패턴 — 단축 프로퍼티부터 프로퍼티 디스크립터까지"
description: "JavaScript 객체를 다루는 핵심 패턴들을 정리합니다. 단축 프로퍼티, 계산 프로퍼티명, Object.entries/fromEntries 변환 패턴, 객체 불변성, 게터/세터, 프로퍼티 디스크립터까지."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "객체", "Object", "프로퍼티디스크립터", "게터세터", "freeze", "entries", "fromEntries"]
featured: false
draft: false
---

[지난 글](/posts/js-array-methods/)에서 배열 메서드로 데이터를 선언적으로 다루는 방법을 살펴봤습니다. 이번에는 배열과 함께 JavaScript의 핵심 자료구조인 **객체(Object)**를 다루는 패턴들을 정리합니다. 단순히 `{}`를 만들고 점 표기법으로 접근하는 것을 넘어, 객체를 더 정밀하게 제어하고 변환하는 방법들입니다.

---

## 단축 프로퍼티와 메서드 단축

ES6에서 도입된 단축 문법은 매일 쓰게 됩니다.

```js
const name = '지수';
const age = 28;

// 이전: 키와 변수명이 같으면 중복 작성
const user = { name: name, age: age };

// 이후: 단축 프로퍼티
const user = { name, age };

// 메서드 단축
const api = {
  // 이전
  fetch: function(url) { ... },

  // 이후 — function 키워드 생략
  fetch(url) { ... },

  // 게터
  get baseUrl() { return 'https://api.example.com'; }
};
```

---

## 계산 프로퍼티명

객체 키를 동적으로 지정해야 할 때 대괄호(`[]`)를 씁니다.

```js
const key = 'theme';
const prefix = 'user';

// 이전: 객체 생성 후 별도 할당
const settings = {};
settings[key] = 'dark';

// 이후: 리터럴 안에서 바로
const settings = {
  [key]: 'dark',
  [`${prefix}Name`]: '지수',
  [`on${eventName}`]: handler,
};
```

계산 프로퍼티명은 Redux의 액션 타입에 따른 상태 업데이트나, 폼 필드명으로 상태를 동적으로 갱신할 때 자주 씁니다.

```js
// 폼 핸들러
function handleChange(field, value) {
  setForm(prev => ({ ...prev, [field]: value }));
}
```

---

## 객체 스프레드와 불변 업데이트

ES2018의 객체 스프레드(`...`)는 객체 복사와 병합의 표준이 되었습니다.

```js
const defaults = { theme: 'light', lang: 'ko', pageSize: 20 };
const userPrefs = { theme: 'dark', pageSize: 50 };

// 병합 — 나중 것이 이전 것을 덮어씀
const config = { ...defaults, ...userPrefs };
// { theme: 'dark', lang: 'ko', pageSize: 50 }
```

불변 상태 업데이트 패턴:

```js
// 특정 필드만 변경
const updated = { ...state, count: state.count + 1, updatedAt: Date.now() };

// 중첩 객체 업데이트 — 각 단계를 스프레드
const updated = {
  ...state,
  user: {
    ...state.user,
    address: {
      ...state.user.address,
      city: '부산',
    },
  },
};
```

중첩이 깊어질수록 번거롭습니다. 이 경우 Immer 라이브러리를 쓰면 불변성을 유지하면서 직접 수정하는 문법으로 작성할 수 있습니다.

---

## Object.keys / values / entries / fromEntries

객체를 순회하거나 변환할 때 핵심 도구입니다.

![객체 유틸리티 메서드 — 순회와 변환](/assets/posts/js-object-patterns-spread.svg)

세 메서드는 **자체 소유(own) + 열거 가능(enumerable) 프로퍼티**만 다룹니다. 프로토타입 체인의 프로퍼티는 포함되지 않습니다.

```js
const user = { name: '지수', age: 28, role: 'dev' };

Object.keys(user)     // ['name', 'age', 'role']
Object.values(user)   // ['지수', 28, 'dev']
Object.entries(user)  // [['name', '지수'], ['age', 28], ['role', 'dev']]
```

**Object.fromEntries** — `entries`와 반대 방향입니다. `[key, value]` 쌍의 이터러블을 객체로 만듭니다.

```js
// 가장 유용한 패턴: entries → 변환 → fromEntries
const prices = { apple: 1000, banana: 500, cherry: 2000 };

// 모든 가격 10% 할인
const discounted = Object.fromEntries(
  Object.entries(prices).map(([item, price]) => [item, price * 0.9])
);
// { apple: 900, banana: 450, cherry: 1800 }

// 특정 키만 필터링
const cheap = Object.fromEntries(
  Object.entries(prices).filter(([, price]) => price < 1500)
);
// { apple: 900, banana: 450 }
```

`Map`에서 객체로, 혹은 URL 쿼리 파라미터에서 객체로 변환할 때도 씁니다.

```js
const params = Object.fromEntries(new URLSearchParams(location.search));
```

---

## 게터와 세터

프로퍼티에 읽기/쓰기 로직을 덧붙이는 방법입니다. 마치 일반 프로퍼티처럼 보이지만 실제로는 함수입니다.

```js
const temperature = {
  _celsius: 20,

  get celsius() {
    return this._celsius;
  },

  set celsius(value) {
    if (value < -273.15) throw new RangeError('절대 영도 아래로 설정 불가');
    this._celsius = value;
  },

  get fahrenheit() {
    return this._celsius * 9 / 5 + 32;
  },
};

temperature.celsius = 100;
console.log(temperature.fahrenheit);   // 212 — 계산된 프로퍼티
```

게터는 **계산된 값**을 프로퍼티처럼 노출할 때, 세터는 **유효성 검사**나 **부수 효과**(로깅, 의존 값 갱신)를 동반한 쓰기에 씁니다. 클래스에서도 동일하게 사용합니다.

---

## 프로퍼티 디스크립터

JavaScript의 모든 프로퍼티는 내부적으로 **디스크립터(descriptor)**라는 속성 집합으로 제어됩니다.

![프로퍼티 디스크립터 & 객체 불변성](/assets/posts/js-object-patterns-descriptors.svg)

```js
const obj = { x: 1 };

Object.getOwnPropertyDescriptor(obj, 'x');
// { value: 1, writable: true, enumerable: true, configurable: true }

// 직접 정의/재정의
Object.defineProperty(obj, 'PI', {
  value: 3.14159,
  writable: false,      // 재할당 불가
  enumerable: true,
  configurable: false,  // 삭제·재정의 불가
});
```

`enumerable: false`로 설정한 프로퍼티는 `for...in`, `Object.keys()`, 스프레드, `JSON.stringify()`에서 보이지 않습니다. 내부용 메타데이터를 숨길 때 씁니다.

실제로 자주 쓰이는 경우는 직접 `defineProperty`를 쓰기보다, 동작 방식을 이해해서 라이브러리 코드나 프레임워크 내부를 읽을 때입니다. Vue 2의 반응성 시스템이 `defineProperty`의 게터/세터를 이용해 구현된 대표적인 예입니다.

---

## 객체 불변성: freeze · seal

객체의 변경 가능성을 제한하는 두 가지 메서드입니다.

```js
// Object.seal: 프로퍼티 추가/삭제 불가, 값 변경은 가능
const settings = Object.seal({ theme: 'dark', lang: 'ko' });
settings.theme = 'light';   // ✓ 가능
settings.fontSize = 14;     // 무시됨 (strict mode: TypeError)
delete settings.theme;      // 무시됨

// Object.freeze: 프로퍼티 추가/삭제/변경 모두 불가
const COLORS = Object.freeze({
  PRIMARY: '#5b9bd5',
  DANGER: '#f87171',
  SUCCESS: '#86efac',
});
COLORS.PRIMARY = 'red';     // 무시됨 (strict mode: TypeError)
```

`freeze`는 **얕은 동결**입니다. 중첩 객체는 별도로 freeze해야 합니다.

```js
const config = Object.freeze({
  server: Object.freeze({ host: 'api.dev', port: 443 }),
  timeout: 5000,
});
```

상수 집합을 표현할 때 TypeScript의 `enum` 대신 `Object.freeze`를 쓰는 패턴이 있습니다. 런타임에서도 변경이 막히기 때문입니다.

---

## Object.hasOwn · structuredClone

**Object.hasOwn(obj, key)** — ES2022. 객체가 특정 키를 자체 소유하는지 안전하게 확인합니다.

```js
// 이전: hasOwnProperty가 오버라이드될 수 있음
if (obj.hasOwnProperty('key')) { ... }

// 이후: 항상 Object.prototype의 것을 사용
if (Object.hasOwn(obj, 'key')) { ... }
```

**structuredClone(value)** — ES2022. 깊은 복사를 내장 API로 처리합니다.

```js
// 이전: JSON 왕복(함수, Date, 순환참조 미지원), 서드파티 라이브러리
const deep = JSON.parse(JSON.stringify(obj));

// 이후: Date, Map, Set, ArrayBuffer, 순환참조 지원
const deep = structuredClone(obj);
```

함수, Symbol, DOM 노드는 복사되지 않지만, 일반 데이터 구조의 깊은 복사에는 충분합니다.

---

## 객체 패턴 정리

객체를 다루는 패턴을 상황에 맞게 선택하는 기준:

- 객체 **순회 + 변환**이 필요하다 → `Object.entries` + `fromEntries`
- 특정 키만 **추출**하고 싶다 → 구조 분해
- **불변 업데이트** → 스프레드 (`{ ...obj, key: value }`)
- **완전 불변**으로 만들고 싶다 → `Object.freeze()`
- **계산 프로퍼티**나 **유효성 검사** 쓰기 → getter/setter
- 프로퍼티의 **열거/변경 가능성** 제어 → `defineProperty`
- **깊은 복사**가 필요하다 → `structuredClone()`

---

배열 메서드와 객체 패턴을 자유롭게 조합하면 데이터 조작 코드의 표현력이 크게 높아집니다. 다음 글에서는 피할 수 없는 주제인 **에러 핸들링**을 다룹니다. `try/catch`, 커스텀 에러 클래스, 비동기 에러 처리, 그리고 예외를 어디서 잡아야 하는지까지 정리합니다.

---

**지난 글:** [배열 메서드 — map·filter·reduce부터 불변 메서드까지](/posts/js-array-methods/)

<br>
읽어주셔서 감사합니다. 😊
