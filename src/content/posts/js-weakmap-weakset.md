---
title: "WeakMap과 WeakSet"
description: "약한 참조로 동작하는 WeakMap과 WeakSet의 GC 연동 메커니즘과 private 데이터 저장·순환 참조 감지·DOM 메타데이터 등 실용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 38
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "WeakMap", "WeakSet", "약한 참조", "메모리", "GC", "private"]
featured: false
draft: false
---

[지난 글](/posts/js-map-set/)에서 Map과 Set을 살펴봤습니다. 이번 글에서는 이 두 컬렉션의 "약한" 버전인 **WeakMap**과 **WeakSet**을 다룹니다. 이름에서 알 수 있듯 키(WeakMap) 또는 원소(WeakSet)에 대한 **약한 참조(weak reference)**를 유지해 가비지 컬렉터가 자유롭게 수거할 수 있도록 허용합니다.

## 강한 참조 vs 약한 참조

일반 `Map`은 키 객체에 대한 **강한 참조**를 유지합니다. 다른 코드에서 해당 객체를 더 이상 참조하지 않더라도 `Map`이 살아있는 한 객체는 GC되지 않습니다.

```javascript
const map = new Map();
let el = document.querySelector('#btn');
map.set(el, { clicks: 0 });

el = null; // DOM 참조 해제
// 하지만 map이 el을 강하게 잡고 있으므로 GC 불가 → 메모리 누수!
```

`WeakMap`은 키에 대한 **약한 참조**만 유지합니다. 키 객체가 다른 곳에서 더 이상 참조되지 않으면 GC가 수거할 수 있고, 항목도 자동으로 제거됩니다.

```javascript
const weakMap = new WeakMap();
let el = document.querySelector('#btn');
weakMap.set(el, { clicks: 0 });

el = null; // 약한 참조이므로 GC가 수거 가능
// 수거 후 weakMap 항목도 자동 제거
```

![WeakMap과 GC 동작 방식](/assets/posts/js-weakmap-weakset-gc.svg)

## WeakMap API

WeakMap은 Map에 비해 제한적인 API를 제공합니다. **순회가 불가능**합니다 — 약한 참조 특성상 언제 항목이 사라질지 예측할 수 없기 때문입니다.

```javascript
const wm = new WeakMap();
const key = {};

wm.set(key, 'value');
wm.get(key);     // 'value'
wm.has(key);     // true
wm.delete(key);  // true

// 불가능한 작업
// wm.size  — 없음
// wm.forEach — 없음
// for...of wm — TypeError
```

키는 반드시 **객체 또는 등록된 Symbol**이어야 합니다.

```javascript
const wm = new WeakMap();
wm.set(42, 'x');    // TypeError: Invalid value used as weak map key
wm.set('str', 'x'); // TypeError
```

## WeakSet API

`WeakSet`은 객체만 원소로 가질 수 있는 `Set`입니다. 마찬가지로 순회 불가능합니다.

```javascript
const ws = new WeakSet();
const obj = {};

ws.add(obj);
ws.has(obj);    // true
ws.delete(obj); // true
```

## 실용 패턴

![WeakMap과 WeakSet 실용 패턴](/assets/posts/js-weakmap-weakset-patterns.svg)

### 1. WeakMap으로 private 데이터 저장

ES2020+ 클래스 private 필드(`#`)가 도입되기 전에 WeakMap으로 클래스 내부 데이터를 숨기는 패턴이 널리 쓰였습니다.

```javascript
const _private = new WeakMap();

class BankAccount {
  constructor(owner, balance) {
    _private.set(this, { owner, balance });
  }

  deposit(amount) {
    const data = _private.get(this);
    data.balance += amount;
  }

  get balance() {
    return _private.get(this).balance;
  }
}

const acc = new BankAccount('Alice', 1000);
acc.balance; // 1000
// acc._private — undefined, 외부 접근 불가
```

인스턴스가 GC되면 WeakMap 항목도 함께 정리됩니다.

### 2. WeakSet으로 순환 참조 감지

깊은 복사(deep clone)나 직렬화 시 순환 참조를 감지하는 데 유용합니다.

```javascript
function safeStringify(obj, visited = new WeakSet()) {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (visited.has(obj)) return '"[Circular]"';

  visited.add(obj);
  const pairs = Object.entries(obj).map(
    ([k, v]) => `"${k}":${safeStringify(v, visited)}`
  );
  return `{${pairs.join(',')}}`;
}

const a = { x: 1 };
a.self = a; // 순환 참조
safeStringify(a); // '{"x":1,"self":"[Circular]"}'
```

### 3. DOM 노드에 메타데이터 연결

DOM 노드의 라이프사이클에 자동으로 연동되는 메타데이터 저장소를 만들 수 있습니다.

```javascript
const nodeData = new WeakMap();

function registerNode(el, meta) {
  nodeData.set(el, meta);
}

function getNodeMeta(el) {
  return nodeData.get(el);
}

// DOM에서 노드가 제거되고 참조가 없어지면
// nodeData 항목도 자동으로 정리됨
```

### 4. 메모이제이션 (WeakMap 기반)

객체 인자를 캐시 키로 사용하는 안전한 메모이제이션입니다.

```javascript
const cache = new WeakMap();

function memoize(fn) {
  return function (obj) {
    if (!cache.has(obj)) cache.set(obj, fn(obj));
    return cache.get(obj);
  };
}

const processUser = memoize(user => {
  // 비용이 큰 계산...
  return { ...user, processed: true };
});
```

## WeakRef와의 차이

`WeakRef`(ES2021)는 약한 참조를 명시적으로 다루지만, WeakMap/WeakSet은 약한 참조를 **내부적으로** 관리합니다. 대부분의 사용 사례에서는 WeakMap/WeakSet으로 충분합니다.

## 언제 Map 대신 WeakMap을 쓸까?

- 키가 **외부 객체**(DOM 노드, 클래스 인스턴스)이고
- 그 객체의 라이프사이클에 데이터를 **자동으로 연동**시키고 싶을 때

반면 키를 직접 관리하거나, 컬렉션을 순회하거나, 크기를 알아야 한다면 `Map`을 사용합니다.

다음 글에서는 `Symbol`을 실제 코드에 활용하는 패턴 — well-known Symbol, 커스텀 Symbol, 태깅 등을 다룹니다.

---

**지난 글:** [Map과 Set](/posts/js-map-set/)

**다음 글:** [Symbol 활용 패턴](/posts/js-symbol-applications/)

<br>
읽어주셔서 감사합니다. 😊
