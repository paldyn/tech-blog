---
title: "Object 정적 메서드 총정리"
description: "Object.keys/values/entries, assign, create, freeze, hasOwn, fromEntries 등 JavaScript Object 정적 메서드를 역할별로 분류하고 실무 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Object", "Object.keys", "Object.assign", "Object.freeze", "Object.entries", "정적메서드"]
featured: false
draft: false
---

[지난 글](/posts/js-string-methods-regex/)에서 문자열 메서드와 정규식 활용을 살펴봤습니다. 이번에는 `Object` 생성자가 제공하는 정적 메서드들을 역할별로 정리합니다. 이 메서드들은 객체 복사, 열거, 변환, 동결 등 일상적인 작업에 자주 등장합니다.

---

## 열거 메서드

![Object 정적 메서드 분류](/assets/posts/js-object-static-methods-overview.svg)

`Object.keys`, `Object.values`, `Object.entries`는 가장 자주 사용되는 세 가지입니다. 모두 **자체 속성(own property)** 중 열거 가능한 것만 대상으로 합니다.

```javascript
const obj = { a: 1, b: 2, c: 3 };

Object.keys(obj);    // ['a', 'b', 'c']
Object.values(obj);  // [1, 2, 3]
Object.entries(obj); // [['a', 1], ['b', 2], ['c', 3]]

// 반복에 활용
for (const [key, val] of Object.entries(obj)) {
  console.log(`${key}: ${val}`);
}

// 정렬된 키로 순회
Object.keys(obj).sort().forEach(k => console.log(k, obj[k]));
```

상속된 속성이나 열거 불가 속성은 포함되지 않습니다. 모든 자체 속성 이름이 필요하다면 `Object.getOwnPropertyNames()`를 씁니다.

---

## 복사와 병합: assign

`Object.assign`은 하나 이상의 소스 객체로부터 열거 가능한 자체 속성을 타겟에 복사합니다.

```javascript
const defaults = { theme: 'light', lang: 'ko', debug: false };
const userPrefs = { theme: 'dark' };

// 얕은 병합
const config = Object.assign({}, defaults, userPrefs);
// { theme: 'dark', lang: 'ko', debug: false }

// 스프레드 문법이 더 간결 (동작 유사)
const config2 = { ...defaults, ...userPrefs };

// 주의: 얕은 복사 — 중첩 객체는 참조 공유
const a = { nested: { x: 1 } };
const b = Object.assign({}, a);
b.nested.x = 99;
a.nested.x; // 99 — 같은 참조
```

깊은 복사가 필요하다면 `structuredClone()`이나 JSON 직렬화를 씁니다.

---

## fromEntries와 entries 조합

`Object.fromEntries`는 `[key, value]` 쌍의 이터러블을 객체로 변환합니다. `entries + map/filter + fromEntries` 패턴은 객체 값 변환의 표준 관용구입니다.

![entries / fromEntries 변환 패턴](/assets/posts/js-object-static-methods-patterns.svg)

```javascript
// URLSearchParams도 이터러블
const params = new URLSearchParams('a=1&b=2&c=3');
Object.fromEntries(params); // { a: '1', b: '2', c: '3' }

// 키를 변환
const snakified = Object.fromEntries(
  Object.entries({ firstName: 'Alice', lastName: 'Kim' })
    .map(([k, v]) => [k.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`), v])
);
// { first_name: 'Alice', last_name: 'Kim' }

// 특정 키만 추출 (pick)
const pick = (obj, keys) =>
  Object.fromEntries(keys.map(k => [k, obj[k]]));

pick({ a: 1, b: 2, c: 3 }, ['a', 'c']); // { a: 1, c: 3 }
```

---

## 동결과 봉인

```javascript
const point = Object.freeze({ x: 0, y: 0 });

point.x = 99;         // 무시됨 (strict mode: TypeError)
delete point.x;       // 무시됨
point.z = 1;          // 무시됨
point;                // { x: 0, y: 0 }

Object.isFrozen(point); // true

// seal — 추가·삭제 불가, 기존 값 변경은 가능
const config = Object.seal({ host: 'localhost', port: 3000 });
config.port = 8080;   // 가능
config.timeout = 30;  // 무시됨 (새 속성 추가 불가)
delete config.host;   // 무시됨
```

`freeze`는 얕습니다. 중첩 객체는 동결되지 않습니다.

```javascript
const obj = Object.freeze({ inner: { x: 1 } });
obj.inner.x = 99; // 동작함 — inner는 동결 안 됨
```

깊은 동결이 필요하다면 재귀적으로 `freeze`를 호출하거나, `Immer` 같은 라이브러리를 사용합니다.

---

## hasOwn과 hasOwnProperty

속성이 자체 속성인지 확인할 때 전통적으로 `obj.hasOwnProperty('key')`를 썼지만, ES2022에서 `Object.hasOwn()`이 추가되었습니다.

```javascript
const obj = { a: 1 };

// 전통 방법 — 프로토타입 오염에 취약
obj.hasOwnProperty('a');        // true
obj.hasOwnProperty('toString'); // false

// 권장 (ES2022)
Object.hasOwn(obj, 'a');        // true
Object.hasOwn(obj, 'toString'); // false

// Object.create(null)로 만든 순수 딕셔너리는 hasOwnProperty 없음
const dict = Object.create(null);
dict.key = 'val';
// dict.hasOwnProperty('key'); // TypeError!
Object.hasOwn(dict, 'key');   // true ✓
```

---

## groupBy (ES2024)

```javascript
const items = [
  { name: 'apple', type: 'fruit' },
  { name: 'carrot', type: 'vegetable' },
  { name: 'banana', type: 'fruit' },
];

// Object.groupBy — 일반 객체로 그룹핑
const grouped = Object.groupBy(items, ({ type }) => type);
// {
//   fruit: [{ name:'apple',...}, { name:'banana',...}],
//   vegetable: [{ name:'carrot',...}]
// }

// Map.groupBy — 임의 키(객체 포함)로 그룹핑
const mapGrouped = Map.groupBy(items, ({ type }) => type);
```

이전에 `Array.prototype.group`으로 제안되었다가 `Object.groupBy`로 최종 확정되었습니다. Node.js 21+, Chrome 117+에서 사용 가능합니다.

---

## Object.create와 프로토타입

```javascript
// null 프로토타입 순수 딕셔너리
const dict = Object.create(null);
dict.key = 'value';
// toString, hasOwnProperty 등 프로토타입 메서드 없음 — 키 충돌 위험 없음

// 프로토타입 설정
const animal = { speak() { return 'Generic sound'; } };
const dog = Object.create(animal);
dog.name = 'Rex';
dog.speak(); // 'Generic sound' (프로토타입 체인으로 접근)
```

---

## 요약

| 메서드 | 용도 |
|--------|------|
| `Object.keys/values/entries` | 열거 가능한 자체 속성 열거 |
| `Object.assign` | 얕은 복사·병합 |
| `Object.fromEntries` | `[k,v]` 쌍 → 객체 |
| `Object.freeze/seal` | 불변성 강제 |
| `Object.hasOwn` | 자체 속성 여부 (ES2022) |
| `Object.create` | 지정 프로토타입 객체 생성 |
| `Object.is` | SameValue 비교 |
| `Object.groupBy` | 배열 그룹핑 → 객체 (ES2024) |

---

**지난 글:** [문자열 메서드와 정규식 활용](/posts/js-string-methods-regex/)

**다음 글:** [Number와 Math — 수치 연산 완전 정복](/posts/js-number-math/)

<br>
읽어주셔서 감사합니다. 😊
