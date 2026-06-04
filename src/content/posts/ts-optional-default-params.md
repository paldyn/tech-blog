---
title: "선택적 매개변수와 기본값 — 유연한 함수 시그니처 설계"
description: "TypeScript 선택적 매개변수(?), 기본값 매개변수(= value)의 차이, 타입 추론 규칙, 객체 구조분해와의 조합, Options Object 패턴까지 실전 가이드를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "선택적매개변수", "기본값매개변수", "OptionalParams", "DefaultParams"]
featured: false
draft: false
---

[지난 글](/posts/ts-function-overloads/)에서 함수 오버로드를 살펴봤다. 이번에는 **선택적 매개변수(Optional Parameter)** 와 **기본값 매개변수(Default Parameter)** 를 다룬다. 두 기능 모두 함수 호출을 유연하게 만들지만 동작 방식과 타입 처리 방식이 다르다.

## 선택적 매개변수 (`?`)

`?`를 매개변수 이름 뒤에 붙이면 해당 매개변수를 생략할 수 있다. TypeScript는 그 타입을 `T | undefined`로 처리한다.

```typescript
function greet(name: string, title?: string): string {
  if (title) {
    return `${title} ${name}`;
  }
  return name;
}

greet("Alice");           // "Alice"
greet("Alice", "Dr.");    // "Dr. Alice"
greet("Alice", undefined); // "Alice" — 명시적 undefined도 허용
```

`title?: string`은 사실 `title: string | undefined`와 동일하다. 두 표현 모두 같은 타입이지만, `?` 표기는 "생략 가능"이라는 의도를 명확히 드러내므로 선호된다.

```typescript
// 동일한 타입
function f1(x?: number): void {} // x: number | undefined
function f2(x: number | undefined): void {} // x: number | undefined

// 차이: f1은 인수 생략 가능, f2는 인수가 필수(undefined 전달 필요)
f1();        // OK
f2();        // ❌ 인수가 없음
f2(undefined); // OK
```

![선택적 매개변수와 기본값 문법](/assets/posts/ts-optional-default-params-syntax.svg)

## 기본값 매개변수 (`= 값`)

`= 기본값` 문법은 JavaScript의 기본값 매개변수를 그대로 활용한다. TypeScript는 기본값에서 타입을 추론하므로 별도 어노테이션이 필요 없다.

```typescript
function greet(name: string, title = "Mr."): string {
  return `${title} ${name}`;
}

// title의 타입: string (undefined가 아님!)
greet("Alice");           // "Mr. Alice"
greet("Alice", "Dr.");    // "Dr. Alice"
greet("Alice", undefined); // "Mr. Alice" — undefined 전달 시 기본값 사용
```

기본값 매개변수의 핵심 차이는 **타입에서 `undefined`가 제거**된다는 점이다. `title = "Mr."`의 타입은 `string`이지 `string | undefined`가 아니다. 함수 본문에서 `undefined` 체크 없이 바로 사용할 수 있다.

## 선택적 vs 기본값 — 타입 차이 비교

```typescript
function withOptional(value?: string) {
  // value: string | undefined
  console.log(value?.toUpperCase()); // 옵셔널 체이닝 필요
}

function withDefault(value = "default") {
  // value: string (undefined 없음)
  console.log(value.toUpperCase()); // 직접 사용 가능
}

// 함수 타입 시그니처 차이
type F1 = (value?: string) => void;    // (value?: string) => void
type F2 = (value?: string) => void;    // 기본값 파라미터도 외부에서는 선택적

// 주의: 기본값 파라미터는 타입 시그니처에서 ? 로 표시됨
declare function g(x?: number): void;
declare function h(x = 0): void;
// g와 h의 외부 타입 시그니처는 동일: (x?: number) => void
```

중요한 점은 기본값 매개변수도 외부에서는 선택적(`?`)으로 보인다는 것이다. 차이는 내부 타입뿐이다.

## 순서 제약

선택적 매개변수와 기본값 매개변수는 반드시 필수 매개변수 **뒤에** 위치해야 한다.

```typescript
// ❌ 컴파일 에러 — 선택적 매개변수 뒤에 필수 매개변수 불가
function bad(a?: string, b: number): void {} // TS1016

// ✅ 올바른 순서 — 필수, 선택적
function ok1(a: number, b?: string): void {}

// ✅ 올바른 순서 — 필수, 기본값
function ok2(a: number, b = "default"): void {}

// ✅ 여러 선택적 — 모두 뒤에
function ok3(req: string, opt1?: number, opt2?: boolean): void {}
```

이 제약은 JavaScript의 함수 호출 방식에서 비롯된다. 생략된 매개변수가 중간에 있으면 어떤 매개변수를 생략했는지 알 수 없기 때문이다.

## 기본값 표현식

기본값은 리터럴뿐 아니라 표현식도 사용할 수 있다. 표현식은 함수가 **호출될 때마다** 평가된다.

```typescript
// 리터럴 기본값
function createUser(name: string, role = "user") {
  return { name, role };
}

// 표현식 기본값 — 호출 시마다 평가
function createId(prefix = "id", timestamp = Date.now()) {
  return `${prefix}-${timestamp}`;
}

createId();       // "id-1717300000000"
createId();       // "id-1717300001234" — 매번 다름

// 앞 매개변수를 참조하는 기본값도 가능
function createRange(start: number, end = start + 10) {
  return { start, end };
}

createRange(0);      // { start: 0, end: 10 }
createRange(5);      // { start: 5, end: 15 }
createRange(5, 20);  // { start: 5, end: 20 }
```

`end = start + 10`처럼 앞 매개변수를 참조하는 기본값은 TypeScript에서 완벽히 타입 안전하다.

## 제네릭과 기본값

제네릭 타입 매개변수에도 기본값을 지정할 수 있다.

```typescript
// 타입 매개변수 기본값 (TypeScript 2.3+)
interface Container<T = string> {
  value: T;
}

const c1: Container = { value: "hello" };         // Container<string>
const c2: Container<number> = { value: 42 };      // Container<number>

// 함수 타입 매개변수 기본값
function wrap<T = string>(value: T): { data: T } {
  return { data: value };
}

wrap("text");     // { data: string }
wrap(42);         // { data: number }
wrap();           // { data: string } — T defaults to string, but value is required
```

## Options Object 패턴

매개변수가 많거나 선택적 매개변수가 여러 개인 경우 Options Object 패턴이 유용하다.

```typescript
// ❌ 너무 많은 선택적 매개변수
function connect(
  host: string,
  port?: number,
  tls?: boolean,
  timeout?: number,
  retries?: number,
): void {}

// 호출 시 위치 파악이 어려움
connect("localhost", undefined, true, undefined, 3);

// ✅ Options Object 패턴
interface ConnectOptions {
  host: string;
  port?: number;
  tls?: boolean;
  timeout?: number;
  retries?: number;
}

function connect({ host, port = 3000, tls = false, timeout = 5000, retries = 3 }: ConnectOptions): void {
  console.log(`${tls ? "wss" : "ws"}://${host}:${port}`);
}

// 명확하고 순서 무관
connect({ host: "localhost", tls: true, retries: 5 });
connect({ host: "api.example.com", port: 443, tls: true });
```

Options Object는 필드명이 문서 역할을 하여 가독성이 높고, 새로운 옵션을 추가해도 기존 호출 코드에 영향을 주지 않아 유지보수가 쉽다.

![선택적/기본값 매개변수 패턴](/assets/posts/ts-optional-default-params-patterns.svg)

## 구조분해와 기본값 조합

객체 구조분해 문법과 기본값을 함께 사용하면 더욱 깔끔한 코드가 된다.

```typescript
interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  order?: "asc" | "desc";
}

function paginate({
  page = 1,
  pageSize = 20,
  sortBy = "id",
  order = "asc",
}: PaginationOptions = {}) {
  return {
    offset: (page - 1) * pageSize,
    limit: pageSize,
    orderBy: `${sortBy} ${order}`,
  };
}

paginate();                           // 기본값 모두 사용
paginate({ page: 2 });               // page만 변경
paginate({ pageSize: 50, order: "desc" }); // 일부만 변경
```

`= {}` 부분은 Options 객체 자체의 기본값이다. 이를 통해 인수 없이 함수를 호출할 수 있으면서도 각 필드에도 기본값이 적용된다.

## `strictNullChecks`와의 관계

`strictNullChecks`가 활성화된 상태에서 선택적 매개변수를 다룰 때 주의해야 할 점이 있다.

```typescript
function process(value?: string) {
  // ❌ 직접 사용 불가 — value: string | undefined
  value.toUpperCase(); // TS18048: 'value' is possibly 'undefined'

  // ✅ 옵셔널 체이닝
  value?.toUpperCase();

  // ✅ 기본값 병합
  const v = value ?? "default";
  v.toUpperCase();

  // ✅ 조건 검사
  if (value !== undefined) {
    value.toUpperCase(); // 이 블록에서 value: string
  }
}
```

기본값 매개변수를 사용하면 이런 방어 코드가 필요 없다. 가능하다면 기본값 매개변수를 선택적 매개변수보다 선호하는 것이 코드를 더 깔끔하게 만든다.

---

**지난 글:** [함수 오버로드 — 여러 시그니처로 정밀한 타입 표현](/posts/ts-function-overloads/)

**다음 글:** [나머지 매개변수와 스프레드 — 가변 인수 처리](/posts/ts-rest-parameters/)

<br>
읽어주셔서 감사합니다. 😊
