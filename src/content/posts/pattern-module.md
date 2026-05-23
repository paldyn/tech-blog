---
title: "모듈 패턴 — 캡슐화와 네임스페이스"
description: "IIFE 기반 고전 모듈 패턴부터 Revealing Module, ES Module까지 JavaScript 모듈 패턴의 진화를 살펴보고, 캡슐화·싱글턴·의존성 주입 전략을 실용 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "디자인패턴", "모듈패턴", "IIFE", "Revealing Module", "ES Module", "캡슐화", "싱글턴"]
featured: false
draft: false
---

[지난 글](/posts/pattern-adapter-facade-proxy/)에서 어댑터·퍼사드·프록시 패턴을 살펴봤습니다. 이번에는 **모듈 패턴(Module Pattern)**을 정리합니다. 모듈 패턴은 JavaScript에서 **캡슐화**, **네임스페이스 오염 방지**, **의존성 관리**를 동시에 해결하기 위해 등장했으며, ES2015 이전과 이후로 구현 방식이 크게 달라졌습니다.

![모듈 패턴의 진화](/assets/posts/pattern-module-concept.svg)

## 왜 모듈 패턴이 필요했나

ES2015 이전 브라우저 JavaScript는 모든 코드가 전역 스코프를 공유했습니다. `var counter = 0;`을 파일 A에 쓰면 파일 B에서도 그 `counter`를 덮어쓸 수 있었습니다. 라이브러리 충돌, 예측 불가 사이드 이펙트가 빈번했습니다. 모듈 패턴은 **IIFE(즉시 실행 함수)**를 사용해 스코프를 격리하는 방법으로 이 문제를 해결했습니다.

---

## IIFE 모듈 패턴

가장 단순한 형태입니다. 함수를 즉시 실행해 내부 변수는 외부에서 접근할 수 없고, 반환 객체만 노출합니다.

```javascript
const Logger = (function () {
  const PREFIX = '[APP]'; // private

  function formatMessage(level, msg) {
    return `${PREFIX} [${level.toUpperCase()}] ${msg}`;
  }

  return {
    info:  (msg) => console.log(formatMessage('info', msg)),
    warn:  (msg) => console.warn(formatMessage('warn', msg)),
    error: (msg) => console.error(formatMessage('error', msg)),
  };
})();

Logger.info('서버 시작');  // [APP] [INFO] 서버 시작
Logger.PREFIX;            // undefined — 접근 불가
```

`PREFIX`와 `formatMessage`는 클로저로 보호되어 외부에서 접근할 수 없습니다.

### 증강 모듈 패턴 (Augmenting)

기존 모듈에 기능을 추가할 때, 모듈 객체를 매개변수로 받아 확장 후 반환합니다.

```javascript
const Logger = (function (mod) {
  mod.debug = (msg) => console.debug(`[DEBUG] ${msg}`);
  return mod;
})(Logger || {});
```

파일 로드 순서에 관계없이 안전하게 모듈을 확장할 수 있습니다.

---

## Revealing Module 패턴

IIFE 모듈의 단점은 반환 객체 안에서 인터페이스를 다시 정의해야 한다는 것입니다. **Revealing Module**은 내부에서 함수를 정의하고, 반환 시 어느 것을 공개할지만 명시합니다.

```javascript
const CartModule = (function () {
  let items = [];

  function add(product) {
    items.push(product);
    _notify();
  }

  function remove(id) {
    items = items.filter(p => p.id !== id);
    _notify();
  }

  function getItems() {
    return [...items]; // 방어적 복사
  }

  function _notify() { // private — 반환 안 함
    console.log('장바구니 업데이트:', items.length);
  }

  // 공개 API만 명시적으로 노출
  return { add, remove, getItems };
})();

CartModule.add({ id: 1, name: '키보드', price: 80000 });
CartModule.getItems(); // [{ id: 1, ... }]
CartModule._notify;    // undefined
```

내부 함수 포인터를 반환하기 때문에 내부 함수끼리 상호 참조 시 public 이름이 아닌 내부 이름을 사용합니다—덕분에 반환 객체 수정 없이 내부 구현을 바꿀 수 있습니다.

---

## ES Module — 현대 표준

ES2015부터 언어 수준에서 모듈을 지원합니다. 파일 자체가 모듈 스코프를 가지므로 IIFE가 불필요합니다.

![Revealing Module vs ES Module 코드 비교](/assets/posts/pattern-module-revealing.svg)

### Named Export와 Default Export

```javascript
// math.js
export const PI = 3.14159;

export function add(a, b) { return a + b; }

export function multiply(a, b) { return a * b; }

export default class MathHelper {
  square(n) { return n * n; }
}
```

```javascript
// main.js
import MathHelper, { PI, add, multiply } from './math.js';

console.log(PI);               // 3.14159
console.log(add(2, 3));        // 5

const helper = new MathHelper();
console.log(helper.square(4)); // 16
```

### Live Binding — ES Module의 핵심

ES Module의 `import`는 값 복사가 아닌 **라이브 바인딩**입니다.

```javascript
// counter.js
export let count = 0;
export function increment() { count++; }

// main.js
import { count, increment } from './counter.js';

console.log(count); // 0
increment();
console.log(count); // 1 — 원본 변경이 반영됨!
```

CommonJS(`require`)는 값을 복사하지만, ES Module은 원본 변수의 참조를 유지합니다.

---

## 모듈 패턴 — 실용 전략

### 싱글턴 모듈

ES Module은 같은 경로를 여러 번 `import`해도 모듈 평가는 한 번만 실행됩니다. 이 특성을 이용해 싱글턴을 자연스럽게 구현합니다.

```javascript
// store.js — 싱글턴 상태 관리
const state = { user: null, theme: 'dark' };
const listeners = new Set();

export function getState() { return { ...state }; }

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn); // unsubscribe 반환
}
```

`store.js`는 앱 전체에서 딱 한 번 초기화되고, 어디서 `import`해도 같은 `state` 객체를 공유합니다.

### 의존성 주입과 팩토리 모듈

테스트 가능성을 높이려면 의존성을 하드코딩하지 않고 주입합니다.

```javascript
// userService.js
export function createUserService({ httpClient, logger }) {
  return {
    async getUser(id) {
      logger.info(`getUser(${id})`);
      return httpClient.get(`/users/${id}`);
    },
    async createUser(data) {
      logger.info('createUser');
      return httpClient.post('/users', data);
    },
  };
}

// 프로덕션
const userService = createUserService({ httpClient, logger });

// 테스트
const mockService = createUserService({
  httpClient: { get: async () => ({ id: 1 }) },
  logger:     { info: () => {} },
});
```

### 네임스페이스 배럴(Barrel) 패턴

기능별 디렉토리의 진입점 `index.js`에서 하위 모듈을 모아 다시 내보냅니다.

```javascript
// services/index.js — 배럴
export { UserService } from './user.js';
export { AuthService } from './auth.js';
export { PaymentService } from './payment.js';

// 사용처
import { UserService, AuthService } from './services';
```

개별 파일 구조를 외부에 노출하지 않고, 진입점 하나로 API를 통일합니다.

---

## IIFE vs Revealing vs ES Module 선택 기준

| 상황 | 추천 |
|---|---|
| 레거시 브라우저, 번들러 없음 | IIFE / Revealing Module |
| 공개 API가 명확한 라이브러리 | Revealing Module |
| 현대 프로젝트 (Node.js, 번들러) | ES Module |
| 트리쉐이킹이 중요한 라이브러리 | ES Module (Named Export 선호) |

ES Module은 정적 분석이 가능하기 때문에 번들러가 사용하지 않는 export를 제거(트리쉐이킹)할 수 있습니다. 새 프로젝트라면 항상 ES Module을 선택하세요.

---

**지난 글:** [어댑터·퍼사드·프록시 패턴 — 구조 패턴의 세 가지 얼굴](/posts/pattern-adapter-facade-proxy/)

**다음 글:** [미디에이터·믹스인 패턴 — 협력과 조합](/posts/pattern-mediator-mixin/)

<br>
읽어주셔서 감사합니다. 😊
