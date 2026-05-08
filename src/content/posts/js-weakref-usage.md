---
title: "WeakRef 활용 — 캐시와 파이널라이저 패턴"
description: "ES2021에 도입된 WeakRef와 FinalizationRegistry를 사용해 GC를 방해하지 않는 캐시를 구현하는 방법과 실제 활용 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "WeakRef", "FinalizationRegistry", "메모리", "캐시", "GC", "ES2021"]
featured: false
draft: false
---

[지난 글](/posts/js-memory-leak-patterns/)에서 메모리 누수의 근본 원인이 "의도치 않은 강한 참조"임을 확인했습니다. 이번에는 ES2021에 도입된 `WeakRef`와 `FinalizationRegistry`를 사용해 **GC를 방해하지 않으면서 캐시를 유지하는** 패턴을 살펴봅니다.

## WeakRef란?

`WeakRef`는 객체에 대한 **약한 참조(weak reference)** 를 만듭니다. 강한 참조와 달리 WeakRef만 남아있는 객체는 GC가 수거할 수 있습니다.

```js
let obj = { data: new Array(100_000).fill(0) };

// 강한 참조: GC 방지
const strong = obj;

// 약한 참조: GC 허용
const weak = new WeakRef(obj);

obj = null;    // 강한 참조 제거
strong = null; // 남은 강한 참조도 제거

// 이제 GC가 수거 가능
// weak.deref()는 이후 undefined를 반환할 수 있음
const alive = weak.deref();
if (alive) {
  console.log(alive.data.length); // 아직 살아있으면 출력
} else {
  console.log('이미 수거됨');
}
```

`deref()`는 객체가 살아있으면 반환, 수거됐으면 `undefined`를 반환합니다. **언제 수거될지는 엔진이 결정**하므로 WeakRef에 의존하는 로직은 항상 `undefined` 케이스를 처리해야 합니다.

![강한 참조 vs WeakRef — GC 허용 여부](/assets/posts/js-weakref-usage-comparison.svg)

## WeakRef 기반 캐시 구현

WeakRef의 가장 적합한 사용처는 **선택적 캐시**입니다. 캐시 히트 시 연산을 건너뛰되, 메모리가 부족하면 GC가 알아서 정리하게 합니다.

```js
// WeakRef 캐시: GC가 필요하면 값을 내보낼 수 있음
function makeWeakCache(compute) {
  const cache = new Map(); // key → WeakRef

  return function (key) {
    const cached = cache.get(key)?.deref();
    if (cached !== undefined) return cached;

    const value = compute(key); // 무거운 계산
    cache.set(key, new WeakRef(value));
    return value;
  };
}

const expensiveFn = makeWeakCache((n) =>
  new Array(n).fill(0).map((_, i) => i * i)
);

const r1 = expensiveFn(10_000); // 계산 실행
const r2 = expensiveFn(10_000); // 캐시 히트 (살아있다면)
```

캐시에서 `deref()`가 `undefined`를 반환하면 자동으로 재계산합니다. 메모리 부족 시 GC가 캐시 항목을 수거해도 프로그램은 정상 동작합니다.

## FinalizationRegistry — GC 후 정리 작업

`FinalizationRegistry`는 객체가 GC된 **이후** 콜백을 등록하는 메커니즘입니다. WeakRef와 함께 쓰면 Map에서 죽은 WeakRef 엔트리를 자동으로 정리할 수 있습니다.

```js
const cache = new Map();

const registry = new FinalizationRegistry((key) => {
  // value가 GC된 후 실행됨 (타이밍 비보장)
  cache.delete(key);
});

function cacheSet(key, value) {
  cache.set(key, new WeakRef(value));
  registry.register(value, key); // value 수거 시 key로 콜백
}

function cacheGet(key) {
  return cache.get(key)?.deref(); // undefined면 캐시 미스
}
```

![WeakRef + FinalizationRegistry — 캐시 패턴](/assets/posts/js-weakref-usage-pattern.svg)

### FinalizationRegistry 주의사항

```js
// ⚠ 콜백 타이밍 보장 안 됨 — 동기 코드처럼 쓰면 안 됨
const registry = new FinalizationRegistry((heldValue) => {
  // GC 이후 언제든지 실행될 수 있음
  // 심지어 프로그램 종료 전에 실행 안 될 수도 있음
  console.log(`${heldValue} was collected`);
});

// heldValue(두 번째 인자)는 수거 대상이 아님 — 원시값 권장
const obj = { name: 'temp' };
registry.register(obj, 'temp-id'); // 'temp-id'는 문자열(원시값)

// unregister로 등록 취소 가능
const token = {}; // 토큰 객체
registry.register(obj, 'temp-id', token);
registry.unregister(token);
```

## WeakMap vs WeakRef

`WeakMap`도 약한 참조를 사용합니다만, 용도가 다릅니다.

```js
// WeakMap: 키가 객체일 때, 키 수거 시 자동 제거
// 키를 열거할 수 없음 — DOM → 부가 데이터 연결에 적합
const extra = new WeakMap();
function attachData(domEl, data) {
  extra.set(domEl, data); // domEl이 GC되면 data도 제거
}

// WeakRef: 값이 객체일 때, 언제든 수거 허용
// 수동으로 deref() 호출 필요
// 캐시, 메모이제이션에 적합
const cache = new Map();
cache.set('key', new WeakRef(heavyObj));
```

| | WeakMap | WeakRef |
|--|---------|---------|
| 약한 참조 위치 | 키 | 값 |
| 자동 삭제 | 키 수거 시 | 직접 deref() 확인 필요 |
| 적합한 용도 | DOM 부가 데이터 | 캐시·메모이제이션 |

## 실무 적용 시 주의

```js
// ❌ 핵심 로직에 WeakRef 사용 — 예측 불가
class Service {
  constructor(dep) {
    this.dep = new WeakRef(dep); // 의존성이 갑자기 사라질 수 있음
  }
  run() {
    const d = this.dep.deref();
    if (!d) throw new Error('dep was GC'd!'); // 언제든 발생 가능
  }
}

// ✅ 선택적 캐시에만 사용
class ImageCache {
  #cache = new Map();

  get(src) {
    const img = this.#cache.get(src)?.deref();
    if (!img) this.#cache.delete(src); // 죽은 항목 정리
    return img; // undefined면 호출자가 재로드
  }
}
```

## 정리

- `WeakRef`는 강한 참조 없이 객체를 "가볍게" 참조 → GC 허용
- `deref()`는 살아있으면 객체, 수거됐으면 `undefined` 반환
- `FinalizationRegistry`는 객체 수거 후 정리 콜백 등록 (타이밍 비보장)
- WeakRef는 **선택적 캐시**에만 사용. 핵심 로직 의존성에는 금지
- WeakMap: 키 약한참조(자동 삭제) / WeakRef: 값 약한참조(수동 확인)

---

**지난 글:** [메모리 누수 패턴 — 원인 분석과 탐지](/posts/js-memory-leak-patterns/)

**다음 글:** [클로저와 메모리 — 스코프가 메모리를 어떻게 붙잡는가](/posts/js-closure-and-memory/)

<br>
읽어주셔서 감사합니다. 😊
