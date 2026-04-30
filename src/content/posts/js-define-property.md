---
title: "Object.defineProperty 완전 해부 — 프로퍼티를 코드로 조각하기"
description: "Object.defineProperty와 Object.defineProperties를 사용해 프로퍼티 디스크립터를 직접 제어하는 방법, configurable 잠금 규칙, 반응형 시스템 구현 예시를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 13
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "defineProperty", "defineProperties", "property-descriptor", "reactive", "writable", "enumerable", "configurable"]
featured: false
draft: false
---

[지난 글](/posts/js-getter-setter/)에서 getter와 setter의 선언 문법과 활용 패턴을 살펴봤습니다. getter/setter를 객체 리터럴이나 클래스 문법 없이 **프로그래밍 방식으로 동적 추가**해야 할 때 `Object.defineProperty`를 사용합니다. 이 API는 모든 프로퍼티 디스크립터 속성을 명시적으로 제어할 수 있는 로우레벨 인터페이스입니다.

---

## API 시그니처

```javascript
Object.defineProperty(obj, propName, descriptor);
// 반환값: obj (원본 객체 자체)
```

`Object.defineProperties`는 여러 프로퍼티를 한 번에 정의합니다.

```javascript
Object.defineProperties(obj, {
  x: { value: 1, writable: true, enumerable: true, configurable: true },
  y: { get() { return this.x * 2; }, enumerable: true }
});
```

![Object.defineProperty API](/assets/posts/js-define-property-api.svg)

---

## 새 프로퍼티 추가 vs 기존 프로퍼티 수정

새 프로퍼티를 추가할 때 명시하지 않은 속성은 모두 기본값(`false` 또는 `undefined`)이 됩니다.

```javascript
const obj = {};

// 새 프로퍼티 — 누락된 속성은 false
Object.defineProperty(obj, 'secret', { value: 42 });
// { value: 42, writable: false, enumerable: false, configurable: false }

// 기존 프로퍼티 수정 — 누락된 속성은 현재 값 유지
Object.defineProperty(obj, 'secret', { writable: true });
// { value: 42, writable: true, enumerable: false, configurable: false }
```

---

## configurable: false 잠금 규칙

`configurable`을 `false`로 설정한 뒤 변경을 시도하면 어떤 일이 일어나는지 정리합니다.

```javascript
const obj = {};
Object.defineProperty(obj, 'x', {
  value: 10,
  writable: true,
  configurable: false
});

// writable: true → false 는 허용 (한 방향만)
Object.defineProperty(obj, 'x', { writable: false }); // OK

// writable: false → true 는 TypeError
Object.defineProperty(obj, 'x', { writable: true }); // TypeError

// enumerable, configurable 변경은 TypeError
Object.defineProperty(obj, 'x', { enumerable: true }); // TypeError

// delete는 sloppy mode에서 무시, strict mode에서 TypeError
delete obj.x; // false (삭제 안됨)
```

한 번 잠그면 되돌릴 수 없으므로 신중하게 사용해야 합니다.

---

## 클래스 prototype에 메서드 추가

`class` 문법으로 정의된 메서드는 자동으로 `enumerable: false`가 됩니다. 그러나 prototype에 직접 할당하면 `enumerable: true`가 됩니다.

```javascript
class Foo {
  bar() {}    // enumerable: false (for..in에서 보이지 않음)
}

// 직접 할당 — enumerable: true
Foo.prototype.baz = function() {};

// defineProperty로 동일하게 숨기기
Object.defineProperty(Foo.prototype, 'baz', {
  value: function() {},
  enumerable: false,
  writable: true,
  configurable: true
});
```

라이브러리에서 prototype을 확장할 때 `enumerable: false`로 설정하는 이유입니다.

---

## 반응형 시스템 구현 (Vue 2 방식)

`Object.defineProperty`의 대표적인 실전 활용은 반응형 데이터 시스템입니다. 값을 저장할 내부 변수를 클로저로 캡처하고, getter/setter를 통해 변화를 감지합니다.

```javascript
function makeReactive(obj, key, onChange) {
  let internalVal = obj[key];

  Object.defineProperty(obj, key, {
    get() {
      return internalVal;
    },
    set(newVal) {
      if (newVal !== internalVal) {
        const oldVal = internalVal;
        internalVal = newVal;
        onChange(key, oldVal, newVal); // 변화 알림
      }
    },
    enumerable: true,
    configurable: true
  });
}

const state = { count: 0 };
makeReactive(state, 'count', (k, old, next) => {
  console.log(`${k}: ${old} → ${next}`);
});

state.count = 1; // "count: 0 → 1"
state.count = 1; // 동일한 값 — 알림 없음
state.count = 5; // "count: 1 → 5"
```

Vue 3와 MobX 최신 버전은 `Proxy`로 이전했지만, 배열 변이 메서드 감지 등의 한계로 넘어간 것이고 원리는 동일합니다.

![defineProperty 실전 활용](/assets/posts/js-define-property-usecase.svg)

---

## Object.getOwnPropertyDescriptor로 검증

변경 후 의도대로 설정됐는지 확인합니다.

```javascript
const cfg = {};
Object.defineProperty(cfg, 'ENV', {
  value: 'production',
  writable: false,
  enumerable: false,
  configurable: false
});

Object.getOwnPropertyDescriptor(cfg, 'ENV');
// { value: 'production', writable: false,
//   enumerable: false, configurable: false }

Object.keys(cfg);           // [] — enumerable: false
JSON.stringify(cfg);        // '{}' — enumerable: false
cfg.ENV;                    // 'production' — 직접 접근은 가능
cfg.ENV = 'dev';            // 무시 (strict: TypeError)
```

---

## Symbol 키 프로퍼티

`defineProperty`는 Symbol 키도 지원합니다.

```javascript
const id = Symbol('id');
Object.defineProperty(obj, id, {
  value: 'abc123',
  writable: false,
  enumerable: false,
  configurable: false
});

obj[id]; // 'abc123'
Object.getOwnPropertySymbols(obj); // [Symbol(id)]
```

다음 글에서는 `Object.freeze`, `Object.seal`, `Object.preventExtensions`를 통해 객체 자체를 잠그는 방법을 살펴봅니다.

---

**지난 글:** [getter와 setter — 프로퍼티 접근을 함수로 위장하기](/posts/js-getter-setter/)

**다음 글:** [freeze · seal · preventExtensions — 객체 불변성 3단계](/posts/js-freeze-seal-prevent/)

<br>
읽어주셔서 감사합니다. 😊
