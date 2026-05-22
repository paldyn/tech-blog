---
title: "전략·데코레이터 패턴 — 행위의 교체와 확장"
description: "전략 패턴으로 알고리즘을 런타임에 교체하는 설계, 데코레이터 패턴으로 함수·클래스에 캐시·재시도·로깅을 조합하는 방법, JavaScript의 고차 함수를 활용한 함수형 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "디자인패턴", "전략패턴", "데코레이터", "고차함수", "GoF", "행위패턴"]
featured: false
draft: false
---

[지난 글](/posts/pattern-singleton-factory/)에서 싱글턴·팩토리 패턴을 살펴봤습니다. 이번에는 **행위 패턴(Behavioral Pattern)** 의 두 가지, **전략(Strategy)** 과 **데코레이터(Decorator)** 를 다룹니다.

## 전략 패턴

전략 패턴은 **알고리즘을 별도 객체(전략)로 분리**해 런타임에 교체할 수 있게 합니다. `if/else`나 `switch`로 분기 처리하는 대신, 각 경우를 독립된 전략 객체로 만들고 컨텍스트에 주입합니다.

![전략 패턴 — 알고리즘 교체 가능하게](/assets/posts/pattern-strategy-decorator-strategy.svg)

### JavaScript에서의 전략 패턴

JavaScript에서는 **함수 자체가 전략**입니다. 클래스를 만들 필요 없이 함수를 전략으로 사용할 수 있습니다.

```js
// 결제 처리 전략
const paymentStrategies = {
  creditCard: async (amount, cardInfo) => {
    const charge = await creditCardApi.charge(cardInfo, amount);
    return { method: 'credit', transactionId: charge.id };
  },

  paypal: async (amount, email) => {
    const payment = await paypalApi.pay(email, amount);
    return { method: 'paypal', transactionId: payment.paymentId };
  },

  kakaoPayl: async (amount, userId) => {
    const result = await kakaoApi.pay(userId, amount);
    return { method: 'kakaopay', transactionId: result.tid };
  },
};

// 컨텍스트 — 전략을 모르고 인터페이스만 사용
async function processPayment(method, amount, paymentInfo) {
  const strategy = paymentStrategies[method];
  if (!strategy) throw new Error(`지원하지 않는 결제 방법: ${method}`);
  return strategy(amount, paymentInfo);
}

// 런타임에 전략 교체
const result = await processPayment('paypal', 10000, user.email);
```

### 폼 유효성 검사 전략

```js
// 유효성 검사 규칙을 전략으로
const validators = {
  required: value => (value ? null : '필수 항목입니다'),
  email: value => (/^\S+@\S+$/.test(value) ? null : '이메일 형식이 아닙니다'),
  minLength: min => value =>
    (value.length >= min ? null : `최소 ${min}자 이상 입력하세요`),
  maxLength: max => value =>
    (value.length <= max ? null : `최대 ${max}자까지 입력 가능합니다`),
  pattern: (regex, msg) => value =>
    (regex.test(value) ? null : msg),
};

// 필드별 전략 조합
const signupRules = {
  name: [validators.required, validators.minLength(2), validators.maxLength(50)],
  email: [validators.required, validators.email],
  password: [
    validators.required,
    validators.minLength(8),
    validators.pattern(/[A-Z]/, '대문자를 포함해야 합니다'),
    validators.pattern(/[0-9]/, '숫자를 포함해야 합니다'),
  ],
};

function validateField(value, rules) {
  return rules.reduce((errors, rule) => {
    const error = rule(value);
    return error ? [...errors, error] : errors;
  }, []);
}

const errors = validateField('abc', signupRules.password);
// ['최소 8자 이상 입력하세요', '대문자를 포함해야 합니다', '숫자를 포함해야 합니다']
```

## 데코레이터 패턴

데코레이터는 **기존 객체나 함수를 감싸서 기능을 추가**합니다. 원본을 수정하지 않고, 감싸는 방식으로 기능을 확장합니다.

![데코레이터 패턴 — 기능을 동적으로 추가](/assets/posts/pattern-strategy-decorator-decorator.svg)

### 함수 데코레이터

```js
// 캐시 데코레이터
function withCache(fn, ttl = 60_000) {
  const cache = new Map();

  return async function (...args) {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value;
    }

    const result = await fn(...args);
    cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  };
}

// 재시도 데코레이터
function withRetry(fn, maxRetries = 3, delay = 1000) {
  return async function (...args) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn(...args);
      } catch (e) {
        lastError = e;
        if (i < maxRetries) {
          await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
      }
    }
    throw lastError;
  };
}

// 로깅 데코레이터
function withLog(fn, label = fn.name) {
  return async function (...args) {
    console.time(label);
    try {
      const result = await fn(...args);
      console.timeEnd(label);
      return result;
    } catch (e) {
      console.timeEnd(label);
      console.error(`[${label}] 실패:`, e.message);
      throw e;
    }
  };
}

// 데코레이터 조합
async function fetchUser(id) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

const robustFetchUser = withLog(
  withRetry(
    withCache(fetchUser, 5 * 60_000),
    3, 500
  ),
  'fetchUser'
);

// 실행 시: 캐시 확인 → 없으면 재시도로 API 호출 → 로그 출력
const user = await robustFetchUser(1);
```

### pipe로 데코레이터 조합 개선

중첩이 깊어지면 `pipe`로 가독성을 높일 수 있습니다.

```js
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

const robustFetch = pipe(
  fn => withCache(fn, 5 * 60_000),
  fn => withRetry(fn, 3, 500),
  fn => withLog(fn, 'fetch')
)(fetchUser);
```

### 클래스 데코레이터 (Stage 3 제안)

TypeScript와 최신 JavaScript에서는 `@decorator` 문법을 사용할 수 있습니다.

```ts
// TypeScript 5.x / Stage 3 Decorators
function log(target: any, name: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    console.log(`[${name}] 호출:`, args);
    const result = await original.apply(this, args);
    console.log(`[${name}] 완료:`, result);
    return result;
  };
  return descriptor;
}

class UserService {
  @log
  async findById(id: number) {
    return db.users.find(id);
  }
}
```

## 전략 vs 데코레이터 비교

| 항목 | 전략 패턴 | 데코레이터 패턴 |
|---|---|---|
| 목적 | 알고리즘 교체 | 기능 추가 (래핑) |
| 구조 | Context + 교환 가능한 전략 | 원본 + 래퍼 체인 |
| 예시 | 정렬 방법, 결제 수단 | 캐시, 재시도, 로그 |
| 원본 수정 | 불필요 | 불필요 |
| 결합 방식 | 주입(injection) | 합성(composition) |

## 정리

전략 패턴은 `if/else` 분기를 제거하고 알고리즘을 교체 가능하게 만듭니다. 데코레이터 패턴은 원본을 수정하지 않고 기능을 추가합니다. JavaScript에서는 두 패턴 모두 **고차 함수**로 간결하게 구현할 수 있습니다.

---

**지난 글:** [싱글턴·팩토리 패턴 — 객체 생성의 제어와 추상화](/posts/pattern-singleton-factory/)

**다음 글:** [어댑터·파사드·프록시 패턴 — 구조적 인터페이스 설계](/posts/pattern-adapter-facade-proxy/)

<br>
읽어주셔서 감사합니다. 😊
