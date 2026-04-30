---
title: "Proxy와 Reflect"
description: "JavaScript Proxy의 13가지 트랩으로 객체 동작을 가로채고 커스터마이징하는 방법과, 기본 동작을 안전하게 위임하는 Reflect API를 실용 패턴과 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 40
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Proxy", "Reflect", "메타프로그래밍", "트랩", "유효성 검사", "옵저버"]
featured: false
draft: false
---

[지난 글](/posts/js-symbol-applications/)에서 Symbol의 다양한 활용 패턴을 살펴봤습니다. 이번 글에서는 JavaScript 메타프로그래밍의 핵심인 **Proxy**와 **Reflect**를 다룹니다. Proxy는 객체의 근본적인 동작(속성 읽기·쓰기·삭제·함수 호출 등)을 가로채고 재정의할 수 있는 강력한 도구입니다.

## Proxy 기본 구조

```javascript
const proxy = new Proxy(target, handler);
```

- `target`: 감쌀 대상 객체(또는 함수)
- `handler`: 가로챌 동작(트랩)을 정의하는 객체

핸들러가 비어 있으면 모든 동작이 target에 그대로 전달됩니다.

```javascript
const target = { name: 'Alice' };
const proxy = new Proxy(target, {});

proxy.name;      // 'Alice' — target에 그대로 전달
proxy.age = 30;  // target.age = 30
```

## 트랩(Trap) 종류

![Proxy 트랩 목록](/assets/posts/js-proxy-reflect-traps.svg)

가장 자주 쓰이는 트랩은 `get`과 `set`입니다.

## get 트랩 — 속성 읽기 가로채기

```javascript
const handler = {
  get(target, prop, receiver) {
    console.log(`[get] ${String(prop)}`);
    return Reflect.get(target, prop, receiver);
  },
};

const proxy = new Proxy({ x: 1, y: 2 }, handler);
proxy.x; // [get] x → 1
```

존재하지 않는 속성에 기본값을 제공하는 패턴입니다.

```javascript
const withDefaults = new Proxy({}, {
  get(target, prop) {
    return prop in target ? target[prop] : `[${String(prop)} 없음]`;
  },
});

withDefaults.name;    // '[name 없음]'
withDefaults.age = 25;
withDefaults.age;     // 25
```

## set 트랩 — 유효성 검사

```javascript
function createValidated(schema) {
  return new Proxy({}, {
    set(target, prop, value, receiver) {
      const validator = schema[prop];
      if (validator && !validator(value)) {
        throw new TypeError(`유효하지 않은 값: ${String(prop)} = ${value}`);
      }
      return Reflect.set(target, prop, value, receiver);
    },
  });
}

const user = createValidated({
  age: v => Number.isInteger(v) && v >= 0 && v <= 150,
  name: v => typeof v === 'string' && v.length > 0,
});

user.name = 'Alice';  // OK
user.age = 30;        // OK
user.age = -1;        // TypeError: 유효하지 않은 값: age = -1
```

![Proxy 패턴과 Reflect API](/assets/posts/js-proxy-reflect-patterns.svg)

## apply 트랩 — 함수 호출 가로채기

`apply` 트랩은 함수에 Proxy를 적용할 때 사용합니다.

```javascript
function sum(a, b) { return a + b; }

const timedSum = new Proxy(sum, {
  apply(target, thisArg, args) {
    const start = performance.now();
    const result = Reflect.apply(target, thisArg, args);
    console.log(`실행 시간: ${performance.now() - start}ms`);
    return result;
  },
});

timedSum(1, 2); // 실행 시간: 0.02ms → 3
```

## Reflect API

`Reflect`는 Proxy 트랩과 **1:1 대응**하는 정적 메서드 모음입니다. 트랩 내부에서 기본 동작을 수행할 때 `Reflect`를 사용합니다. `Object.*` 메서드의 함수형 대안이기도 합니다.

```javascript
const obj = { a: 1 };

// Object 메서드 vs Reflect
Object.defineProperty(obj, 'b', { value: 2, writable: false });
Reflect.defineProperty(obj, 'c', { value: 3, writable: false }); // true/false 반환 (예외 없음)

Reflect.has(obj, 'a');       // true (in 연산자)
Reflect.ownKeys(obj);        // ['a', 'b', 'c']
Reflect.deleteProperty(obj, 'a'); // true
```

`Reflect.set`과 `Reflect.get`은 `receiver` 매개변수로 `this`를 정확히 바인딩해 getter/setter 체인에서 발생하는 문제를 방지합니다.

## 반응형 데이터 시스템 (간단 구현)

Proxy의 `get`/`set` 트랩으로 의존성 추적과 알림을 구현할 수 있습니다.

```javascript
function reactive(obj, onChange) {
  return new Proxy(obj, {
    set(target, prop, value, receiver) {
      const oldValue = target[prop];
      const result = Reflect.set(target, prop, value, receiver);
      if (oldValue !== value) onChange(prop, oldValue, value);
      return result;
    },
  });
}

const state = reactive({ count: 0 }, (prop, old, next) => {
  console.log(`${prop}: ${old} → ${next}`);
});

state.count++;   // count: 0 → 1
state.count++;   // count: 1 → 2
```

Vue 3는 이 패턴을 기반으로 반응형 시스템을 구현합니다.

## has 트랩 — in 연산자 재정의

```javascript
const range = new Proxy({ min: 1, max: 10 }, {
  has(target, prop) {
    const n = Number(prop);
    return n >= target.min && n <= target.max;
  },
});

5 in range;  // true
11 in range; // false
```

## Proxy의 한계와 주의사항

1. **성능**: 모든 접근에 트랩을 통과하므로 Hot Path에서 남용하면 성능 저하.
2. **`===` 비교**: `proxy !== target`. 동일성 비교가 필요하면 원본 참조를 별도로 유지.
3. **내부 슬롯**: `Map`, `Set` 같은 내장 타입은 내부 슬롯([[MapData]] 등)에 직접 접근하므로 단순 래핑이 작동하지 않음. `bind(target)` 등 우회 필요.
4. **취소 가능 Proxy**: `Proxy.revocable(target, handler)`로 생성하고 `revoke()`를 호출하면 이후 접근이 `TypeError`를 던짐.

```javascript
const { proxy, revoke } = Proxy.revocable({ secret: 42 }, {});
proxy.secret; // 42
revoke();
proxy.secret; // TypeError: Cannot perform 'get' on a proxy that has been revoked
```

다음 글에서는 논리 할당 연산자(`??=`, `&&=`, `||=`)와 숫자 구분자를 포함한 최신 JavaScript 편의 문법을 살펴봅니다.

---

**지난 글:** [Symbol 활용 패턴](/posts/js-symbol-applications/)

**다음 글:** [논리 할당 연산자](/posts/js-logical-assignment/)

<br>
읽어주셔서 감사합니다. 😊
