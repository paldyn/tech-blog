---
title: "TypeScript 기본 타입 완전 정리"
description: "TypeScript의 모든 기본 타입을 원시 타입, 특수 타입으로 분류해 설명합니다. const/let 타입 추론 차이, 대문자 래퍼 타입 주의사항, void/never 구분까지 코드 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "기본타입", "string", "number", "boolean", "never", "unknown"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-vs-value-space/)에서 타입 공간과 값 공간의 구분을 이해했다. 이번에는 TypeScript의 기본 타입 전체를 체계적으로 정리한다. 여기서 다루는 타입들이 TypeScript 타입 시스템의 기반이 된다.

## 원시(Primitive) 타입

JavaScript의 원시 값 7가지가 그대로 TypeScript 타입이 된다. 모두 **소문자** 로 표기한다.

```typescript
// string
const name: string = "TypeScript";
const greeting: string = `Hello, ${name}`;

// number — 정수와 부동소수점 구분 없음
const age: number = 30;
const pi: number = 3.14;
const notANumber: number = NaN;

// bigint — ES2020 이상
const big: bigint = 9007199254740993n;

// boolean
const isActive: boolean = true;

// symbol
const uniqueKey: symbol = Symbol("key");

// null과 undefined
const nothing: null = null;
let notDefined: undefined = undefined;
```

![TypeScript 기본 타입 분류](/assets/posts/ts-basic-types-overview.svg)

### ⚠ 대문자 타입(String, Number, Boolean)은 사용하지 않는다

`String`, `Number`, `Boolean` 은 JavaScript의 래퍼 객체(wrapper object) 타입이다. TypeScript에서는 소문자 원시 타입 대신 이것을 쓰면 예상치 못한 동작이 생긴다.

```typescript
// 잘못된 예
const a: String = "hello"; // 래퍼 객체 타입 — 피해야 함
const b: Number = 42;

// 올바른 예
const c: string = "hello";
const d: number = 42;
```

## const와 let의 타입 추론 차이

명시적으로 타입을 쓰지 않아도 TypeScript는 할당된 값에서 타입을 추론한다. 이때 `const` 와 `let` 은 다르게 추론된다.

![const vs let 타입 추론](/assets/posts/ts-basic-types-inference.svg)

`const` 로 선언된 변수는 재할당이 불가능하므로 TypeScript가 **리터럴 타입** 으로 좁게 추론한다. `let` 은 재할당 가능하므로 더 넓은 타입으로 추론한다.

```typescript
const lang = "TypeScript"; // lang: "TypeScript" (리터럴 타입)
let lang2 = "TypeScript";  // lang2: string (넓힘)

// const를 쓰면 더 정확한 타입 정보가 유지됨
function setLang(l: "TypeScript" | "JavaScript") { }
setLang(lang);   // OK — "TypeScript" 리터럴 타입이 일치
setLang(lang2);  // 오류 — string은 넓어서 안전하지 않음
```

## 특수 타입

### any — 타입 검사 탈출구

`any` 는 모든 타입 검사를 비활성화한다. TypeScript의 장점을 포기하는 것이므로 최후 수단으로만 사용한다.

```typescript
let value: any = "hello";
value = 42;         // OK
value = true;       // OK
value.anything();   // OK — 런타임 오류 가능
```

### unknown — 안전한 any

`unknown` 은 `any` 처럼 모든 타입을 대입할 수 있지만, 사용 전에 반드시 타입을 좁혀야 한다.

```typescript
function processInput(input: unknown): string {
  if (typeof input === "string") {
    return input.toUpperCase(); // 좁힌 후 사용 — OK
  }
  if (typeof input === "number") {
    return input.toString();
  }
  return String(input);
}
```

외부 API 응답, JSON 파싱 결과 등 타입을 알 수 없는 데이터에는 `any` 대신 `unknown` 을 쓰자.

### void — 반환값 없는 함수

`void` 는 함수가 의미 있는 값을 반환하지 않음을 표현한다. 대부분 함수 반환 타입으로 사용한다.

```typescript
function log(message: string): void {
  console.log(message);
  // 명시적으로 아무것도 return하지 않음
}
```

### never — 도달할 수 없는 코드

`never` 는 절대 발생하지 않는 값의 타입이다. 두 가지 상황에서 나타난다.

```typescript
// 1. 항상 예외를 던지는 함수
function fail(message: string): never {
  throw new Error(message);
}

// 2. 무한 루프
function loop(): never {
  while (true) {}
}

// 3. 타입 좁히기가 완전히 소진된 경우
function handleStatus(status: "ok" | "error") {
  if (status === "ok") {
    return "성공";
  } else if (status === "error") {
    return "실패";
  }
  // 여기서 status는 never — 모든 경우를 처리했으므로
  const _exhaustive: never = status;
}
```

### object — 원시 타입이 아닌 모든 것

```typescript
let obj: object = { key: "value" };
obj = [1, 2, 3];   // 배열도 object
obj = () => {};    // 함수도 object
obj = 42;          // 오류: number는 원시 타입
```

실제로는 구체적인 `interface` 나 `type` 을 쓰는 것이 권장된다.

## 배열과 튜플

```typescript
// 배열 — 두 가지 문법
const nums: number[] = [1, 2, 3];
const strs: Array<string> = ["a", "b", "c"];

// 튜플 — 각 위치의 타입이 고정
const pair: [string, number] = ["Alice", 30];
const rgb: [number, number, number] = [255, 128, 0];
```

## 함수 반환 타입

함수 반환 타입도 명시할 수 있고, 타입 추론에 맡길 수도 있다.

```typescript
// 반환 타입 명시
function add(a: number, b: number): number {
  return a + b;
}

// 반환 타입 추론 (number로 자동 추론)
function multiply(a: number, b: number) {
  return a * b;
}

// 비동기 함수
async function fetchData(url: string): Promise<string> {
  const response = await fetch(url);
  return response.text();
}
```

다음 글에서는 원시 타입들을 더 깊이 파고들어 각 타입의 세부 동작과 주의사항을 살펴본다.

---

**지난 글:** [타입 공간과 값 공간 — TypeScript의 두 세계](/posts/ts-type-vs-value-space/)

<br>
읽어주셔서 감사합니다. 😊
