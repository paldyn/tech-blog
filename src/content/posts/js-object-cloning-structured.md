---
title: "객체 복사 완전 가이드 — 얕은 복사부터 structuredClone까지"
description: "JavaScript 객체 복사의 모든 방법(스프레드, Object.assign, JSON, structuredClone)의 차이, 얕은 복사와 깊은 복사의 의미, structuredClone이 지원하는 타입을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 20
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "structuredClone", "shallow-copy", "deep-copy", "Object.assign", "spread", "JSON", "cloning"]
featured: false
draft: false
---

[지난 글](/posts/js-prototype-methods/)에서 객체를 탐색하는 다양한 메서드를 살펴봤습니다. 실무에서 상태 관리, 불변 업데이트, 캐싱 등 수없이 만나는 작업이 바로 **객체 복사**입니다. 어떤 방법을 쓰느냐에 따라 중첩 객체가 공유되거나, getter가 사라지거나, 함수가 복사 불가능 오류를 일으킬 수 있습니다.

---

## 얕은 복사 vs 깊은 복사

**얕은 복사**: 최상위 프로퍼티만 복사. 중첩 객체는 참조를 공유.

```javascript
const original = { name: 'Alice', addr: { city: 'Seoul' } };
const shallow = { ...original };

shallow.name = 'Bob';         // original.name 영향 없음 (기본 타입)
shallow.addr.city = 'Busan'; // original.addr.city도 변경됨! (공유)

original.addr.city; // 'Busan' — 예상치 못한 변경
```

**깊은 복사**: 모든 중첩 레벨까지 독립적으로 복사.

```javascript
const deep = structuredClone(original);
deep.addr.city = 'Busan';
original.addr.city; // 'Seoul' — 영향 없음
```

---

## 방법 1: 스프레드와 Object.assign — 얕은 복사

```javascript
const obj = { x: 1, y: { z: 2 } };

// 스프레드
const copy1 = { ...obj };

// Object.assign
const copy2 = Object.assign({}, obj);

// 두 방법 모두:
// - 최상위 프로퍼티는 독립적으로 복사
// - getter는 실행된 값으로 변환 (getter 사라짐)
// - non-enumerable 프로퍼티 복사 안됨
// - prototype 정보 복사 안됨
```

프로퍼티를 병합할 때는 두 방법 모두 유용합니다.

```javascript
const defaults = { color: 'red', size: 'M' };
const custom = { color: 'blue' };
const merged = { ...defaults, ...custom };
// { color: 'blue', size: 'M' }
```

---

## 방법 2: JSON 왕복 — 깊은 복사 (제한 있음)

```javascript
const deep = JSON.parse(JSON.stringify(obj));
```

**한계**:
- `undefined` 값은 제거됨
- `Date`는 문자열로 변환됨 (Date 객체 복구 안됨)
- 함수는 제거됨
- 순환 참조 시 오류 발생
- `Symbol` 키 무시됨
- `Map`, `Set`은 `{}`, `{}` 로 변환됨

```javascript
const tricky = {
  fn: () => 'hello',    // 제거됨
  date: new Date(),     // 문자열로 변환
  map: new Map([['k', 1]]) // {} 로 변환
};

const copy = JSON.parse(JSON.stringify(tricky));
// { date: '2026-04-29T...', map: {} }
```

단순 객체와 배열만 다루고 위 제한이 없다면 여전히 간편하게 사용할 수 있습니다.

---

## 방법 3: structuredClone — 표준 깊은 복사 (ES2022)

`structuredClone`은 HTML 명세의 구조화 복제 알고리즘을 사용합니다.

```javascript
const state = {
  users: [{ id: 1, name: 'Alice' }],
  meta: { date: new Date(), count: 5 }
};

const copy = structuredClone(state);
copy.users[0].name = 'Bob';
copy.meta.date.setFullYear(2020);

state.users[0].name; // 'Alice' — 영향 없음
state.meta.date.getFullYear(); // 2026 — 영향 없음
```

**순환 참조 지원**:
```javascript
const a = { self: null };
a.self = a; // 순환 참조

const b = structuredClone(a);
b.self === b; // true — 순환 참조도 올바르게 복제
// JSON.stringify(a); // TypeError: cyclic object value
```

![객체 복사 방법 비교](/assets/posts/js-object-cloning-methods.svg)

---

## structuredClone 지원/불가 타입

지원: Object, Array, Map, Set, Date, RegExp, Error, ArrayBuffer, TypedArray, BigInt, 순환 참조

**불가 타입 (DataCloneError)**:
```javascript
// 함수 — 복사 불가
structuredClone(() => {}); // DataCloneError

// DOM 노드 — 복사 불가
structuredClone(document.body); // DataCloneError

// prototype 정보 — 유실
class User { greet() {} }
const alice = new User();
const clone = structuredClone(alice);
clone instanceof User; // false — 일반 Object로 변환
clone.greet;           // undefined — prototype 메서드 없음
```

![structuredClone 지원 타입](/assets/posts/js-object-cloning-structured-clone.svg)

---

## 방법 4: getter 보존 — 디스크립터 기반 복사

```javascript
const src = {
  _val: 10,
  get double() { return this._val * 2; }
};

// getter 보존 복사
const copy = Object.create(
  Object.getPrototypeOf(src),
  Object.getOwnPropertyDescriptors(src)
);

copy._val = 5;
copy.double; // 10 — getter가 살아있음
```

---

## 방법 5: 전이 가능(Transferable) — 복사 없이 이전

`structuredClone`에 `transfer` 옵션을 주면 ArrayBuffer 같은 전이 가능 객체를 복사하지 않고 소유권 이전합니다.

```javascript
const buf = new ArrayBuffer(1024);
const clone = structuredClone(buf, { transfer: [buf] });

// 원본은 사용 불가 (detached)
buf.byteLength; // 0
clone.byteLength; // 1024
```

Web Worker와 메인 스레드 간에 대용량 데이터를 효율적으로 전달할 때 사용합니다.

---

## 방법 선택 가이드

| 상황 | 권장 방법 |
|------|-----------|
| 단순 최상위 병합 | 스프레드 `{...a, ...b}` |
| 얕은 복사 (다수 소스) | `Object.assign` |
| 순수 JSON 데이터 깊은 복사 | `JSON.parse(JSON.stringify())` |
| 표준 깊은 복사 (Date, Map, Set 포함) | `structuredClone` |
| getter/setter 보존 | `Object.create` + `getOwnPropertyDescriptors` |
| class 인스턴스 복사 | 직접 clone 메서드 구현 또는 Immer |
| 불변 업데이트 (React 상태) | Immer의 `produce` |

---

## Immer로 불변 업데이트

깊이 중첩된 객체를 불변으로 업데이트할 때는 `structuredClone`보다 Immer가 편리합니다.

```javascript
import { produce } from 'immer';

const state = { users: [{ name: 'Alice', score: 0 }] };

const next = produce(state, draft => {
  draft.users[0].score += 10; // 마치 직접 변경하는 것처럼
});

// state는 변경되지 않음
state.users[0].score; // 0
next.users[0].score;  // 10
```

이 시리즈의 객체 관련 주제가 여기서 마무리됩니다. 다음 글부터는 클래스 문법의 세부 기능(constructor, static, private, getter/setter, extends, instanceof)을 하나씩 깊이 살펴봅니다.

---

**지난 글:** [프로토타입 메서드 총정리 — 객체 탐색과 복제 도구](/posts/js-prototype-methods/)

<br>
읽어주셔서 감사합니다. 😊
