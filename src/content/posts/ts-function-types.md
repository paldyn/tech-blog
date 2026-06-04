---
title: "함수 타입 — TypeScript에서 함수를 타입으로 표현하는 방법"
description: "TypeScript 함수 타입 시그니처, 함수 타입 별칭, 인터페이스 콜 시그니처, 고차 함수와 제네릭 함수 타입까지 함수를 타입으로 다루는 핵심 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "함수타입", "FunctionType", "콜시그니처", "고차함수"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-assertions/)에서 타입 단언을 살펴봤다. 이번에는 **함수 타입(Function Type)** 을 다룬다. TypeScript에서 함수는 값이면서 동시에 타입이 될 수 있다. 함수를 매개변수로 전달하거나 반환값으로 사용할 때, 그 구조를 정확히 타입으로 표현하는 방법을 체계적으로 정리한다.

## 함수 타입 기본 표현식

가장 기본적인 함수 타입은 화살표 표기법으로 작성한다. `(파라미터: 타입, ...) => 반환타입` 형식이다.

```typescript
// 함수 타입 기본 형태
let greet: (name: string) => string;
greet = (n) => `Hello, ${n}`;

// 파라미터 없는 함수
let printHello: () => void;
printHello = () => console.log("Hello");

// 여러 파라미터
let add: (a: number, b: number) => number;
add = (a, b) => a + b;

// 변수 선언과 동시에 할당 — 문맥적 타이핑 적용
const multiply: (x: number, y: number) => number = (x, y) => x * y;
```

함수 타입을 변수에 명시하면 **문맥적 타이핑(Contextual Typing)** 이 적용된다. 오른쪽 화살표 함수의 파라미터 타입을 별도로 선언하지 않아도 왼쪽에서 지정한 타입으로 자동 추론된다.

![함수 타입 시그니처](/assets/posts/ts-function-types-signature.svg)

## 타입 별칭으로 함수 타입 재사용

함수 타입이 여러 곳에서 사용된다면 `type` 별칭으로 추출해 재사용한다.

```typescript
// 타입 별칭
type Predicate = (value: unknown) => boolean;
type Transformer<T, U> = (input: T) => U;
type Comparator<T> = (a: T, b: T) => number;

// 재사용
const isString: Predicate = (v) => typeof v === "string";
const isNumber: Predicate = (v) => typeof v === "number";

const toUpperCase: Transformer<string, string> = (s) => s.toUpperCase();
const toString: Transformer<number, string> = (n) => String(n);

// 정렬에서 활용
const numbers = [3, 1, 4, 1, 5];
const byValue: Comparator<number> = (a, b) => a - b;
numbers.sort(byValue);
```

`Transformer<T, U>`처럼 제네릭을 함수 타입 별칭에 활용하면 타입 안전한 범용 변환 함수를 표현할 수 있다.

## 인터페이스의 콜 시그니처

인터페이스에서 함수 타입을 표현할 때는 **콜 시그니처(Call Signature)** 를 사용한다. 화살표 대신 콜론으로 반환 타입을 구분한다는 점이 타입 별칭과 다르다.

```typescript
// 인터페이스 콜 시그니처
interface Formatter {
  (value: number): string;
}

const currency: Formatter = (v) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(v);

// 함수이면서 프로퍼티도 갖는 객체
interface LogFunction {
  (message: string): void;
  level: "info" | "warn" | "error";
  timestamp: boolean;
}

const log: LogFunction = (msg) => console.log(msg);
log.level = "info";
log.timestamp = true;
```

`LogFunction`처럼 호출 가능하면서 동시에 프로퍼티를 갖는 구조는 `type`으로도 표현할 수 있지만, 인터페이스의 콜 시그니처가 의도를 더 명확히 드러낸다.

## 고차 함수 타입

함수를 인수로 받거나 반환하는 고차 함수(Higher-Order Function)는 TypeScript에서 매우 자주 사용된다.

```typescript
// 함수를 받는 함수
function pipe<T>(value: T, fn: (input: T) => T): T {
  return fn(value);
}

pipe(5, (n) => n * 2);  // 10 — n: number 자동 추론

// 함수를 반환하는 함수
function multiplier(factor: number): (n: number) => number {
  return (n) => n * factor;
}

const double = multiplier(2);
const triple = multiplier(3);
double(5); // 10
triple(5); // 15

// 함수를 받고 반환하는 함수 (데코레이터 패턴)
function memoize<T extends unknown[], R>(
  fn: (...args: T) => R,
): (...args: T) => R {
  const cache = new Map<string, R>();
  return (...args: T) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = memoize((n: number) => {
  return n * n; // 캐싱됨
});
```

`memoize` 함수는 임의의 함수를 받아 동일한 시그니처를 가진 메모이즈된 버전을 반환한다. `T extends unknown[]`로 나머지 매개변수를 캡처하면 원래 함수와 동일한 타입을 유지할 수 있다.

## 오버로드 없는 유니언 타입 활용

단순한 경우에는 오버로드 대신 유니언 타입으로 함수 타입을 표현할 수 있다.

```typescript
// 유니언 파라미터 — 단순한 경우
type StringOrNumberFn = (value: string | number) => string;

const format: StringOrNumberFn = (v) => String(v);

// 반환 타입이 입력에 따라 다를 때 — 오버로드 필요
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number {
  return typeof input === "string" ? Number(input) : String(input);
}
```

입력 타입과 출력 타입이 서로 연동되는 경우(string 입력 → number 반환, number 입력 → string 반환)는 유니언으로 표현하면 호출자에게 정확한 타입 정보를 전달할 수 없다. 이런 경우는 함수 오버로드를 사용하며, 다음 글에서 자세히 다룬다.

![함수 타입 패턴](/assets/posts/ts-function-types-patterns.svg)

## 파라미터 이름과 구조분해

함수 타입에서 파라미터 이름은 문서화 목적이며 타입 호환성에 영향을 주지 않는다.

```typescript
// 파라미터 이름이 달라도 호환
type Handler = (event: MouseEvent) => void;

const onClick: Handler = (e) => console.log(e.clientX);  // e, e.clientX — OK
const onMove: Handler = (evt) => evt.preventDefault();   // evt — OK

// 구조분해 파라미터
type Config = { host: string; port: number };
type StartFn = (config: Config) => void;

const start: StartFn = ({ host, port }) => {
  console.log(`${host}:${port}`);
};
```

구조분해 파라미터는 함수 시그니처를 단순하게 유지하면서 내부에서 개별 필드에 직접 접근할 수 있어 React 컴포넌트나 설정 기반 함수에서 자주 활용된다.

## 메서드 시그니처 vs 함수 프로퍼티

인터페이스에서 메서드를 표현하는 방법은 두 가지가 있으며 미묘한 차이가 있다.

```typescript
interface WithMethodSig {
  // 메서드 시그니처 — strictFunctionTypes 하에서 공변적(covariant)
  greet(name: string): string;
}

interface WithFunctionProp {
  // 함수 프로퍼티 — strictFunctionTypes 하에서 반공변적(contravariant)
  greet: (name: string) => string;
}
```

`strict` 모드에서 함수 프로퍼티 형태(`greet: (name: string) => string`)는 파라미터 타입에 대해 더 엄격한 검사를 받는다. TypeScript 팀은 새로운 코드에서 함수 프로퍼티 형태를 권장한다.

## void vs never 반환 타입

`void`와 `never`는 언뜻 비슷해 보이지만 의미가 다르다.

```typescript
// void — 반환값을 사용하지 않음 (undefined 반환 가능)
function log(message: string): void {
  console.log(message);
  // return undefined; — 허용
}

// never — 함수가 정상 종료되지 않음
function fail(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {
    // ...
  }
}

// 콜백에서 void — 반환값 무시
const nums = [1, 2, 3];
nums.forEach((n): void => {
  console.log(n);
  // 반환값이 있어도 forEach는 무시
});
```

콜백 위치에서 `void` 반환 타입은 "반환값이 무시된다"는 의미이므로, `void` 반환 타입의 함수 타입에 실제로 값을 반환하는 함수를 할당할 수 있다.

```typescript
type VoidFn = () => void;

// 실제로 number를 반환해도 void 타입에 할당 가능
const fn: VoidFn = () => 42;  // OK — 반환값은 무시됨
```

이는 배열 메서드 체인에서 의도치 않은 타입 오류를 방지하는 설계이다.

---

**지난 글:** [타입 단언 — as, !, as const 완전 정복](/posts/ts-type-assertions/)

**다음 글:** [함수 오버로드 — 여러 시그니처로 정밀한 타입 표현](/posts/ts-function-overloads/)

<br>
읽어주셔서 감사합니다. 😊
