---
title: "Object.hasOwn()"
description: "ES2022 Object.hasOwn()이 기존 hasOwnProperty()보다 안전한 이유와 null 프로토타입 객체, 메서드 재정의 공격을 방어하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2022", "Object.hasOwn", "hasOwnProperty", "프로토타입", "보안"]
featured: false
draft: false
---

[지난 글](/posts/js-array-string-at/)에서 `.at()` 메서드를 살펴봤습니다. 이번에는 ES2022에서 추가된 `Object.hasOwn()`을 다룹니다. 오랜 관용구였던 `Object.prototype.hasOwnProperty.call()`을 대체하는 더 안전하고 간결한 정적 메서드입니다.

## 자체 속성(own property)이란?

JavaScript 객체는 자체 속성과 프로토타입 체인에서 상속된 속성을 모두 가질 수 있습니다.

```javascript
const user = { name: 'Alice' };

'name' in user;       // true (자체 속성)
'toString' in user;   // true (상속 속성)

user.hasOwnProperty('name');    // true
user.hasOwnProperty('toString'); // false
```

`in` 연산자는 프로토타입 체인을 따라 올라가며 찾지만, `hasOwnProperty`는 해당 객체에 직접 정의된 속성만 확인합니다.

## hasOwnProperty의 문제점

![프로토타입 체인과 hasOwnProperty 위험성](/assets/posts/js-object-hasown-prototype.svg)

`hasOwnProperty`는 `Object.prototype`의 메서드이기 때문에 두 가지 문제가 있습니다.

**1. 재정의 가능**

```javascript
const obj = {
  hasOwnProperty: () => true, // 재정의!
};
obj.hasOwnProperty('anything'); // 항상 true (잘못된 결과)
```

사용자 입력에서 비롯된 객체(`JSON.parse()` 결과 등)라면 이런 재정의 공격(프로토타입 오염의 일종)이 가능합니다.

**2. null 프로토타입 객체에서 에러**

```javascript
const map = Object.create(null); // 프로토타입 없음
map.key = 'value';
map.hasOwnProperty('key');
// TypeError: map.hasOwnProperty is not a function
```

딕셔너리로 자주 쓰이는 `Object.create(null)` 객체에서 `hasOwnProperty`를 직접 호출하면 TypeError가 발생합니다.

기존 우회 방법은 장황합니다.

```javascript
Object.prototype.hasOwnProperty.call(map, 'key'); // 동작하지만 verbose
```

## Object.hasOwn() — 해결책

![Object.hasOwn vs hasOwnProperty 비교](/assets/posts/js-object-hasown-comparison.svg)

ES2022의 `Object.hasOwn(obj, key)`는 두 문제를 모두 해결합니다.

```javascript
// null 프로토타입 객체에서도 OK
const dict = Object.create(null);
dict.foo = 'bar';
Object.hasOwn(dict, 'foo'); // true — 에러 없음

// 재정의 공격 방어
const evil = { hasOwnProperty: () => true };
Object.hasOwn(evil, 'x'); // false — 정적 메서드라 재정의 불가
```

`Object.hasOwn`은 정적 메서드이므로 인스턴스의 `hasOwnProperty`를 전혀 참조하지 않습니다.

## 실전 사용 예

### 안전한 JSON 파싱 결과 검증

```javascript
function getField(json, key) {
  const obj = JSON.parse(json);
  if (Object.hasOwn(obj, key)) {
    return obj[key];
  }
  throw new Error(`필드 없음: ${key}`);
}
```

### for...in 루프에서 필터링

```javascript
for (const key in obj) {
  if (Object.hasOwn(obj, key)) {
    // 상속 속성 제외한 자체 속성만 처리
    process(key, obj[key]);
  }
}
```

### 옵셔널 속성 체크

```javascript
function configure(options) {
  const debug = Object.hasOwn(options, 'debug')
    ? options.debug
    : false;
  // ...
}
```

## ESLint 권고사항

ESLint의 `no-prototype-builtins` 규칙은 `obj.hasOwnProperty()` 직접 호출을 경고합니다. `Object.hasOwn()`으로 마이그레이션하면 이 경고를 없애면서 코드를 더 안전하게 만들 수 있습니다.

---

**지난 글:** [배열과 문자열의 .at() 메서드](/posts/js-array-string-at/)

**다음 글:** [findLast와 findLastIndex](/posts/js-find-last/)

<br>
읽어주셔서 감사합니다. 😊
