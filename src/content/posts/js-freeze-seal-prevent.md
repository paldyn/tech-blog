---
title: "freeze · seal · preventExtensions — 객체 불변성 3단계"
description: "Object.freeze, Object.seal, Object.preventExtensions의 차이, 얕은 동결의 한계, deepFreeze 구현, 그리고 실무에서 언제 어느 것을 선택해야 하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 14
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "freeze", "seal", "preventExtensions", "immutability", "object", "deepFreeze"]
featured: false
draft: false
---

[지난 글](/posts/js-define-property/)에서 `Object.defineProperty`로 개별 프로퍼티의 동작을 제어하는 방법을 살펴봤습니다. 이번에는 객체 전체를 한꺼번에 잠그는 세 가지 메서드를 비교합니다. 잠금 강도가 다르므로 상황에 맞는 선택이 필요합니다.

---

## 세 가지 메서드 개요

| 메서드 | 새 프로퍼티 추가 | 삭제 | 값 수정 | 디스크립터 변경 |
|--------|:-:|:-:|:-:|:-:|
| `preventExtensions` | ✗ | ✓ | ✓ | ✓ |
| `seal` | ✗ | ✗ | ✓ | ✗ |
| `freeze` | ✗ | ✗ | ✗ | ✗ |

세 가지 모두 **프로토타입 변경은 차단**하지만, 중첩 객체(nested object)는 영향받지 않는 **얕은(shallow) 잠금**입니다.

---

## Object.preventExtensions — 새 프로퍼티 추가만 금지

```javascript
const obj = { x: 1 };
Object.preventExtensions(obj);

obj.y = 2;        // 무시 (strict: TypeError)
delete obj.x;     // 가능 — 삭제는 허용됨
obj.x = 99;       // 가능 — 값 수정도 허용됨

Object.isExtensible(obj); // false
```

가장 가벼운 잠금입니다. 기존 프로퍼티는 자유롭게 변경하거나 삭제할 수 있습니다.

---

## Object.seal — 구조 고정, 값 수정 허용

```javascript
const config = Object.seal({
  host: 'localhost',
  port: 3000
});

config.port = 8080;  // OK — 값 수정 가능
config.db = 'mongo'; // 무시 (strict: TypeError) — 새 프로퍼티 추가 불가
delete config.host;  // 무시 (strict: TypeError) — 삭제 불가

Object.isSealed(config); // true
```

`seal`은 내부적으로 모든 프로퍼티를 `configurable: false`로 만들고 객체를 non-extensible로 만듭니다. 값 수정(`writable`이 `true`인 경우)은 여전히 허용됩니다.

**실무 사용**: 키 집합이 고정된 설정 객체. 오타로 인한 새 키 추가를 방지합니다.

```javascript
// 잘못된 키 추가를 방지하는 설정 객체
const appConfig = Object.seal({
  apiUrl: '',
  timeout: 5000,
  retries: 3
});

appConfig.apiURl = '...'; // 오타 — 무시됨 (strict: TypeError)
appConfig.apiUrl = '...'; // OK
```

---

## Object.freeze — 완전 불변

```javascript
const point = Object.freeze({ x: 1, y: 2 });

point.x = 99;      // 무시 (strict: TypeError)
point.z = 3;       // 무시 (strict: TypeError)
delete point.x;    // 무시 (strict: TypeError)

Object.isFrozen(point); // true
Object.isSealed(point); // true (freeze ⊃ seal)
```

`freeze`는 모든 프로퍼티를 `writable: false, configurable: false`로 만들고 객체를 non-extensible로 만듭니다.

![객체 잠금 3단계 비교](/assets/posts/js-freeze-seal-prevent-compare.svg)

---

## 얕은 동결의 한계

세 메서드 모두 중첩 객체를 재귀적으로 처리하지 않습니다.

```javascript
const state = Object.freeze({
  user: { name: 'Alice' },  // 이 객체는 동결 안됨!
  count: 0
});

state.count = 1;         // 무시 — freeze됨
state.user.name = 'Bob'; // 변경됨! — nested는 freeze 안됨
```

---

## deepFreeze 구현

```javascript
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;

  // 자기 자신 먼저 동결
  Object.freeze(obj);

  // 모든 프로퍼티 재귀 처리
  Object.getOwnPropertyNames(obj).forEach(name => {
    deepFreeze(obj[name]);
  });

  return obj;
}

const config = deepFreeze({
  db: { host: 'localhost', port: 5432 },
  api: { url: 'https://api.example.com' }
});

config.db.host = 'remote'; // 무시 (strict: TypeError)
```

순환 참조가 있는 객체에는 `WeakSet`으로 방문 여부를 추적해야 합니다.

```javascript
function deepFreeze(obj, visited = new WeakSet()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (visited.has(obj)) return obj; // 순환 참조 방지

  visited.add(obj);
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(name => {
    deepFreeze(obj[name], visited);
  });
  return obj;
}
```

![깊은 동결 패턴과 seal 활용](/assets/posts/js-freeze-seal-prevent-deep.svg)

---

## const vs freeze

자주 혼동하는 개념입니다.

```javascript
const obj = { x: 1 };
obj.x = 99;   // 가능 — const는 재할당만 막음
obj = {};     // TypeError — 변수 재할당 불가

const frozen = Object.freeze({ x: 1 });
frozen.x = 99; // 무시 — 값 변경 불가
```

- `const`: **변수 바인딩**을 불변으로 만듦 (참조 자체를 바꿀 수 없음)
- `freeze`: **객체 내용**을 불변으로 만듦

완전한 불변 상수를 만들려면 `const` + `Object.freeze`를 함께 사용합니다.

---

## 성능 고려사항

`freeze`된 객체는 일부 JavaScript 엔진에서 최적화에 유리합니다. V8은 frozen 객체를 히든 클래스 변경 없이 다룰 수 있어 프로퍼티 접근이 빠를 수 있습니다. 그러나 `deepFreeze`는 재귀 순회 비용이 있으므로 대형 객체에 무분별하게 적용하지 않아야 합니다.

**실무 권장사항**:
- Redux 상태 → `freeze` (개발 모드에서 실수 방지)
- 설정 객체 → `seal` (키 집합 고정, 값 업데이트 허용)
- API 응답 → `freeze` + 타입스크립트 `Readonly<T>` 병행
- 대용량 불변 데이터 → Immer, Immutable.js 고려

다음 글에서는 JavaScript 객체가 연결되는 핵심 메커니즘인 프로토타입 체인을 살펴봅니다.

---

**지난 글:** [Object.defineProperty 완전 해부 — 프로퍼티를 코드로 조각하기](/posts/js-define-property/)

**다음 글:** [프로토타입 체인 — 상속의 실제 동작 원리](/posts/js-prototype-chain/)

<br>
읽어주셔서 감사합니다. 😊
