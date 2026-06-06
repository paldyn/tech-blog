---
title: "제네릭 함수 — 타입 안전한 재사용"
description: "TypeScript 제네릭 함수의 타입 파라미터 선언, 타입 추론, 다중 타입 파라미터, 제약 조건(extends), 화살표 함수 제네릭을 실무 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "제네릭", "generic", "타입파라미터", "T", "extends", "함수"]
featured: false
draft: false
---

[지난 글](/posts/ts-generic-constraints/)에서 제네릭 제약 조건을 살펴봤다. 이번에는 **제네릭 함수**에 집중해서 타입 파라미터를 선언하고 추론하는 전 과정을 정리한다. 제네릭 함수는 "타입을 파라미터로 받아서 타입 안전한 코드를 재사용하는" 가장 기본적인 제네릭 패턴이다.

## 제네릭 함수의 기본 형태

`<T>`가 타입 파라미터 선언이다. 함수 이름 뒤, 일반 파라미터 목록 앞에 온다.

```typescript
function identity<T>(x: T): T {
  return x;
}

// 타입 추론 — T를 명시하지 않아도 OK
const s = identity("hello"); // s: string
const n = identity(42);      // n: number

// 명시적 타입 인수 전달
const b = identity<boolean>(true); // b: boolean
```

`any`와 달리 입력 타입이 출력 타입에 그대로 흐른다. `identity("hello")`의 반환값이 `string`으로 추론되므로, 이후 코드에서 string 메서드를 안전하게 쓸 수 있다.

## 타입 파라미터 흐름

![제네릭 함수 — 타입 파라미터 T의 흐름](/assets/posts/ts-generic-functions-concept.svg)

컴파일러는 인수에서 `T`를 추론(inference)한다. 인수가 `"hello"`(string)이면 T=string, 인수가 `42`(number)이면 T=number로 자동 결정된다.

## 실전 패턴 3가지

![제네릭 함수 실전 패턴](/assets/posts/ts-generic-functions-patterns.svg)

### 1. 배열 첫 번째 요소

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const n = first([1, 2, 3]); // n: number | undefined
const s = first(["a"]);     // s: string | undefined
```

### 2. 다중 타입 파라미터

```typescript
function zip<A, B>(a: A[], b: B[]): [A, B][] {
  return a.map((item, i) => [item, b[i]]);
}

const pairs = zip([1, 2], ["a", "b"]);
// pairs: [number, string][]
```

### 3. 제약 조건(extends)

```typescript
function getLength<T extends { length: number }>(x: T): number {
  return x.length;
}

getLength("hello");     // 5
getLength([1, 2, 3]);   // 3
getLength({ length: 7 }); // 7
// getLength(42);        // Error ❌ — number에는 length 없음
```

## 화살표 함수에서의 제네릭

TSX(React) 파일에서는 `<T>`가 JSX 태그로 오해될 수 있어 `<T,>`처럼 쉼표를 넣거나 `<T extends unknown>`을 사용한다.

```typescript
// 일반 .ts 파일
const wrap = <T>(x: T): { value: T } => ({ value: x });

// .tsx 파일 (JSX 충돌 방지)
const wrap = <T,>(x: T): { value: T } => ({ value: x });
// 또는
const wrap = <T extends unknown>(x: T) => ({ value: x });
```

## 여러 위치에서 T 참조

`T`는 파라미터 타입뿐 아니라 반환 타입, 함수 내부 변수 타입 등 어디서나 참조할 수 있다.

```typescript
function mapOptional<T, U>(
  value: T | undefined,
  fn: (x: T) => U
): U | undefined {
  if (value === undefined) return undefined;
  return fn(value);
}

const doubled = mapOptional(5, x => x * 2);         // 10 | undefined
const upper   = mapOptional("hello", s => s.toUpperCase()); // string | undefined
const nothing = mapOptional(undefined, x => x);     // undefined
```

## 제네릭 함수 타입 별칭

함수 타입에도 제네릭을 붙일 수 있다.

```typescript
type Transformer<T, U> = (input: T) => U;

const toStr: Transformer<number, string> = n => n.toString();
const toLen: Transformer<string, number> = s => s.length;

console.log(toStr(42));      // "42"
console.log(toLen("hello")); // 5
```

## any와 비교

```typescript
// any — 타입 정보 소실
function identity_any(x: any): any { return x; }
const s1 = identity_any("hello");
s1.toUpperCase(); // OK — 하지만 타입 체커 포기
s1.notExist();   // 런타임 오류인데 컴파일 오류 없음 ⚠

// generic — 타입 정보 보존
function identity_g<T>(x: T): T { return x; }
const s2 = identity_g("hello"); // s2: string
s2.toUpperCase(); // OK ✅
s2.notExist();    // Error ❌ — 컴파일 타임에 잡힘
```

## 핵심 정리

제네릭 함수는 타입 파라미터 `T`로 입력과 출력 타입의 관계를 표현한다. `any`와 달리 타입 안전성을 유지하면서 코드를 재사용한다. 타입 추론 덕분에 대부분의 경우 `T`를 직접 지정할 필요 없이 컴파일러가 알아서 결정한다. 다음 글에서는 제네릭 타입 파라미터를 가진 **제네릭 클래스**를 살펴본다.

---

**지난 글:** [정적 멤버 — 클래스 레벨의 공유 상태](/posts/ts-static-members/)

**다음 글:** [제네릭 클래스 — 타입 파라미터를 가진 클래스](/posts/ts-generic-classes/)

<br>
읽어주셔서 감사합니다. 😊
