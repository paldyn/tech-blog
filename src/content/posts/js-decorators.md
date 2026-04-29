---
title: "데코레이터 — @syntax로 클래스와 메서드 꾸미기"
description: "JavaScript TC39 Stage 3 데코레이터 표준의 동작 원리, 메서드/클래스/필드 데코레이터 구현, TypeScript decorators와의 차이, 실무 활용 패턴(로깅, 메모이제이션, 검증)을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "decorators", "TC39", "metaprogramming", "class", "method-decorator", "TypeScript"]
featured: false
draft: false
---

[지난 글](/posts/js-mixins-pattern/)에서 믹스인으로 기능을 합성하는 방법을 살펴봤습니다. 클래스와 메서드에 기능을 주입하는 또 다른 강력한 도구가 **데코레이터**입니다. `@logged`, `@memoize`, `@readonly`처럼 선언적으로 기능을 붙일 수 있어 관심사를 분리하는 데 탁월합니다. TC39 Stage 3에 안착한 새 표준 데코레이터와 기존 TypeScript/Babel 실험적 데코레이터의 차이를 이해하는 것이 핵심입니다.

![데코레이터 래핑 메커니즘 다이어그램](/assets/posts/js-decorators-diagram.svg)

## 데코레이터란

데코레이터는 **클래스, 메서드, 필드, 접근자에 메타데이터나 기능을 추가하는 함수**입니다. `@`로 시작하는 선언적 문법으로 적용합니다.

```javascript
// TC39 Stage 3 메서드 데코레이터
function logged(fn, ctx) {
  return function(...args) {
    console.log(`→ ${ctx.name}`);
    const r = fn.apply(this, args);
    console.log(`← ${ctx.name}`);
    return r;
  };
}
class Calc {
  @logged
  add(a, b) { return a + b; }
}
```

![TC39 Stage 3 데코레이터 코드](/assets/posts/js-decorators-code.svg)

`new Calc().add(2, 3)`을 호출하면 `→ add`, 계산, `← add` 순으로 출력됩니다. `add` 메서드 자체는 변경되지 않고, 래퍼 함수로 교체됩니다.

## TC39 Stage 3 vs 레거시 데코레이터

현재 생태계에는 두 가지 종류의 데코레이터가 혼재합니다.

| 항목 | TC39 Stage 3 (새 표준) | 레거시(experimentalDecorators) |
|---|---|---|
| TypeScript 설정 | `"experimentalDecorators": false` (기본) | `"experimentalDecorators": true` |
| Babel 플러그인 | `@babel/plugin-proposal-decorators` (version: "2023-11") | 구 플러그인 |
| 메서드 데코레이터 시그니처 | `(fn, context)` | `(target, key, descriptor)` |
| 필드 초기화 | `context.addInitializer` 사용 | 직접 접근 |
| 표준화 상태 | Stage 3 (안정) | 비표준, deprecated |

새 프로젝트에서는 TC39 Stage 3 표준을 사용하는 것이 권장됩니다.

## 메서드 데코레이터

새 표준에서 메서드 데코레이터는 `(originalMethod, context)` 두 인수를 받습니다.

```javascript
function memoize(fn, ctx) {
  const cache = new Map();
  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

class Calculator {
  @memoize
  fibonacci(n) {
    if (n <= 1) return n;
    return this.fibonacci(n - 1) + this.fibonacci(n - 2);
  }
}
```

`context` 객체에는 `name`(메서드 이름), `kind`('method'), `static`, `private` 등의 메타데이터가 있습니다.

## 클래스 데코레이터

클래스 데코레이터는 클래스 자체를 교체하거나 감쌀 수 있습니다.

```javascript
function sealed(cls, ctx) {
  Object.seal(cls);
  Object.seal(cls.prototype);
  return cls;
}

function singleton(cls, ctx) {
  let instance = null;
  return class extends cls {
    constructor(...args) {
      if (instance) return instance;
      super(...args);
      instance = this;
    }
  };
}

@sealed
@singleton
class Database {
  constructor(url) { this.url = url; }
}
```

데코레이터는 **아래에서 위로** 적용됩니다. 먼저 `@singleton`이 클래스를 수정하고, 그 결과에 `@sealed`가 적용됩니다.

## 필드 데코레이터

필드 데코레이터는 `context.addInitializer`로 인스턴스 생성 시 추가 초기화 작업을 등록합니다.

```javascript
function observable(_, ctx) {
  ctx.addInitializer(function () {
    const key = ctx.name;
    let value = this[key];
    Object.defineProperty(this, key, {
      get() { return value; },
      set(v) {
        console.log(`${key}: ${value} → ${v}`);
        value = v;
      },
    });
  });
}

class Store {
  @observable
  count = 0;
}

const s = new Store();
s.count = 5; // 'count: 0 → 5'
s.count = 10; // 'count: 5 → 10'
```

## 접근자(getter/setter) 데코레이터

```javascript
function readonly(fn, ctx) {
  return {
    get: fn,
    set() {
      throw new TypeError(`${ctx.name} is read-only`);
    },
  };
}

class Config {
  #data = { env: 'production' };

  @readonly
  get env() { return this.#data.env; }
}

const c = new Config();
console.log(c.env); // 'production'
c.env = 'dev'; // TypeError: env is read-only
```

## 실무 활용 패턴

### 유효성 검사

```javascript
function validate(rules) {
  return (fn, ctx) => function(...args) {
    for (const [i, rule] of rules.entries()) {
      if (!rule(args[i])) {
        throw new TypeError(
          `${ctx.name} 인수 ${i} 유효성 검사 실패`
        );
      }
    }
    return fn.apply(this, args);
  };
}

class UserService {
  @validate([
    (v) => typeof v === 'string' && v.length > 0,
    (v) => typeof v === 'number' && v >= 0,
  ])
  createUser(name, age) {
    return { name, age };
  }
}
```

### 디버깅 — 실행 시간 측정

```javascript
function timed(fn, ctx) {
  return function(...args) {
    const start = performance.now();
    const result = fn.apply(this, args);
    const elapsed = (performance.now() - start).toFixed(2);
    console.log(`${ctx.name}: ${elapsed}ms`);
    return result;
  };
}
```

## 데코레이터 합성 순서

여러 데코레이터를 쌓으면 **안쪽(아래)부터 바깥쪽(위) 순서**로 적용됩니다.

```javascript
class MyClass {
  @logged   // 2번째 적용 (바깥)
  @memoize  // 1번째 적용 (안쪽)
  compute(n) { return n * 2; }
}
// compute = logged(memoize(원본))
```

결과적으로 호출 시 `logged → memoize → 원본` 순서로 실행됩니다.

## 현재 지원 환경

TC39 Stage 3 데코레이터는 2024년 기준 아직 V8/SpiderMonkey 등에서 네이티브 지원이 완전하지 않습니다. 실무에서는 다음 도구를 사용합니다.

- **Babel**: `@babel/plugin-proposal-decorators` (version: "2023-11")
- **TypeScript 5.0+**: `"experimentalDecorators": false` (기본값이 새 표준)
- **Rollup/Vite**: Babel 플러그인 통해 번들 단계에서 변환

---

**지난 글:** [믹스인 패턴 — 다중 상속 없이 기능 합성하기](/posts/js-mixins-pattern/)

**다음 글:** [for 루프 완전 정복 — 6가지 반복문 비교](/posts/js-for-loops/)

<br>
읽어주셔서 감사합니다. 😊
