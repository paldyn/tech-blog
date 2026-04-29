---
title: "WeakRef와 FinalizationRegistry"
description: "ES2021 WeakRef로 약한 참조를 만들고, FinalizationRegistry로 객체 GC 시점에 정리 콜백을 등록하는 방법과 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2021", "WeakRef", "FinalizationRegistry", "GC", "메모리", "약한 참조"]
featured: false
draft: false
---

[지난 글](/posts/js-top-level-await/)에서 최상위 await를 살펴봤습니다. 이번에는 ES2021에서 함께 등장한 **WeakRef**와 **FinalizationRegistry**를 다룹니다. 이 두 API는 JavaScript의 가비지 컬렉터(GC)와 상호작용하는 저수준 도구로, 메모리에 민감한 캐시나 리소스 관리에서 유용합니다.

## WeakRef — 약한 참조

`WeakRef`는 객체에 대한 **약한 참조(weak reference)**를 만듭니다. 강한 참조(`let obj = target`)와 달리, `WeakRef`가 가리키는 객체는 다른 강한 참조가 없으면 GC가 회수할 수 있습니다.

![WeakRef 강한 참조 vs 약한 참조](/assets/posts/js-weakref-finalization-memory.svg)

```javascript
let target = { name: 'cache data', size: 1024 };
const wr = new WeakRef(target);

// 강한 참조를 제거
target = null;

// deref()로 접근 — GC 전이라면 객체 반환
const obj = wr.deref();
if (obj) {
  console.log(obj.name); // 'cache data'
} else {
  console.log('이미 GC됨');
}
```

## deref()의 의미

`wr.deref()`는 객체가 아직 살아있으면 그 객체를 반환하고, GC가 회수한 뒤라면 `undefined`를 반환합니다. 반환값이 `undefined`인지 항상 확인해야 합니다.

같은 `deref()` 호출도 GC 타이밍에 따라 결과가 달라질 수 있으므로, **한 이벤트 루프 틱 안에서 얻은 참조는 해당 틱 내에서만 사용**하는 것이 안전합니다.

```javascript
function processIfAlive(weakRef) {
  const obj = weakRef.deref();
  if (!obj) return; // GC됐으면 종료
  // 이 함수 실행 중에는 obj가 살아있음이 보장됨
  process(obj);
}
```

## FinalizationRegistry — GC 후 정리 콜백

`FinalizationRegistry`는 특정 객체가 GC될 때 **정리 콜백**을 호출하도록 등록할 수 있습니다.

![FinalizationRegistry 활용 패턴](/assets/posts/js-weakref-finalization-registry.svg)

```javascript
// 등록
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`정리: ${heldValue}`);
});

let obj = { id: 42 };
registry.register(obj, 'object-42'); // heldValue = 'object-42'

// obj의 강한 참조 제거
obj = null;
// 이후 GC가 발생하면 콜백 실행
// → '정리: object-42'
```

두 번째 인자 `heldValue`는 콜백에 전달할 임의의 값입니다. 정리 대상 객체 자체를 전달하면 안 됩니다(강한 참조가 생겨 GC가 막힘).

## WeakRef + FinalizationRegistry 조합

두 API를 함께 사용하면 **자동 정리되는 캐시**를 구현할 수 있습니다.

```javascript
const cache = new Map();

const registry = new FinalizationRegistry((key) => {
  cache.delete(key);
  console.log(`캐시 제거: ${key}`);
});

function cacheSet(key, value) {
  cache.set(key, new WeakRef(value));
  registry.register(value, key);
}

function cacheGet(key) {
  const ref = cache.get(key);
  return ref?.deref(); // undefined면 캐시 미스
}
```

## 주의사항과 한계

1. **GC 타이밍 비결정적**: 콜백이 언제 호출되는지 엔진이 결정합니다. Node.js에서는 `--expose-gc`로 수동 GC를 강제할 수 있지만, 프로덕션 코드에서는 사용하면 안 됩니다.

2. **콜백 미실행 가능성**: 프로그램이 종료되거나 엔진이 GC를 실행하지 않은 경우 콜백이 호출되지 않을 수 있습니다.

3. **테스트 어려움**: GC 의존적 동작은 단위 테스트로 검증하기 매우 어렵습니다.

4. **용도 제한**: 이 API들은 **일반적인 캐싱 로직의 보완**으로 사용해야 하며, 핵심 비즈니스 로직의 기반으로 삼아서는 안 됩니다.

대부분의 경우 `WeakMap`이나 명시적 정리 로직이 더 예측 가능하고 테스트 가능한 대안입니다.

---

**지난 글:** [최상위 await (Top-level await)](/posts/js-top-level-await/)

**다음 글:** [배열과 문자열의 .at() 메서드](/posts/js-array-string-at/)

<br>
읽어주셔서 감사합니다. 😊
