---
title: "타입 추론 완전 정리 — TypeScript가 타입을 결정하는 방식"
description: "TypeScript의 타입 추론 규칙(변수, 함수 반환값, 문맥적 타이핑, 최적 공통 타입)을 코드 예제와 함께 완전히 정리하고, 추론을 신뢰할 때와 명시할 때를 가이드합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입추론", "TypeInference", "문맥적타이핑", "ContextualTyping"]
featured: false
draft: false
---

[지난 글](/posts/ts-literal-types/)에서 리터럴 타입을 살펴봤다. 이번에는 TypeScript의 **타입 추론(Type Inference)** 을 다룬다. 타입 추론은 TypeScript가 코드에서 타입을 명시하지 않아도 값의 형태로부터 타입을 자동으로 결정하는 메커니즘이다. 이를 올바르게 이해하면 불필요한 어노테이션을 줄이면서도 완전한 타입 안전성을 유지할 수 있다.

## 타입 추론이란

타입 추론은 컴파일러가 소스 코드를 분석해 **타입 어노테이션 없이도 타입 정보를 결정**하는 기능이다. TypeScript의 설계 원칙 중 하나는 "타입 어노테이션은 코드를 더 명확하게 할 때만 추가하라"는 것이다. 추론이 충분히 정확하다면 어노테이션은 잡음(noise)이 된다.

```typescript
// 어노테이션 없이도 TypeScript가 타입을 안다
const message = "Hello, TypeScript"; // string
const count = 42;                    // number
const active = true;                 // boolean

// 잘못된 할당은 여전히 에러
message.toFixed(); // TS2339: Property 'toFixed' does not exist on type 'string'
```

타입 추론이 작동하는 핵심 원리는 **타입 흐름 분석(control flow analysis)** 이다. 컴파일러는 값이 처음 할당되는 지점, 함수의 반환 경로, 연산자의 의미 등을 종합해 타입을 결정한다.

## 변수 초기화 추론

가장 기본적인 추론은 변수 초기화 시점에 일어난다. 오른쪽 표현식의 타입이 왼쪽 변수의 타입이 된다.

![타입 추론 기본 원리](/assets/posts/ts-type-inference-basics.svg)

```typescript
// 기본 타입 추론
const x = 42;           // number
const s = "hello";      // string
const b = true;         // boolean
const arr = [1, 2, 3];  // number[]

// 객체 리터럴 추론
const user = {
  name: "Alice",
  age: 30,
};
// 추론 결과: { name: string; age: number }

// 중첩 객체도 재귀적으로 추론
const config = {
  server: {
    host: "localhost",
    port: 3000,
  },
  debug: false,
};
// { server: { host: string; port: number }; debug: boolean }
```

`const`와 `let`의 추론 결과가 다르다는 점을 주의해야 한다.

```typescript
const cStr = "hello"; // 타입: "hello" (리터럴 타입, 재할당 불가)
let   lStr = "hello"; // 타입: string  (재할당 가능이므로 더 넓게 추론)

const cNum = 42; // 타입: 42 (리터럴 타입)
let   lNum = 42; // 타입: number
```

`const`는 값을 변경할 수 없으므로 TypeScript가 가장 좁은 타입(리터럴 타입)을 부여한다. 이 동작은 `as const` 어시션(assertion)과 연관이 깊다.

## 함수 반환값 추론

TypeScript는 함수 본문의 `return` 문을 분석해 반환 타입을 추론한다. 모든 반환 경로를 고려하여 최종 타입을 결정한다.

```typescript
// 단순 반환 — number로 추론
function add(a: number, b: number) {
  return a + b;
}
// 추론된 반환 타입: number

// 조건 분기 — 유니언으로 추론
function getValue(flag: boolean) {
  if (flag) {
    return "yes";  // string
  }
  return 42;       // number
}
// 추론된 반환 타입: string | number

// undefined 반환 포함
function maybeGreet(name: string | null) {
  if (name === null) return;  // undefined
  return `Hello, ${name}`;   // string
}
// 추론된 반환 타입: string | undefined
```

파라미터 타입은 추론되지 않는다. 함수 파라미터는 항상 명시적으로 어노테이션을 달아야 한다. 이 부분은 다음 글에서 다시 자세히 설명한다.

```typescript
// 파라미터 타입 생략 → 암묵적 any (strict 모드에서 에러)
function badAdd(a, b) { // TS7006: Parameter 'a' implicitly has an 'any' type
  return a + b;
}
```

## 최적 공통 타입 (Best Common Type)

배열 리터럴이나 유니언 후보가 여럿 있을 때 TypeScript는 **최적 공통 타입(Best Common Type)** 알고리즘을 사용해 모든 후보를 포함할 수 있는 가장 넓은 타입을 결정한다.

```typescript
// 숫자 배열 — number[]
const nums = [1, 2, 3];

// 혼합 배열 — (string | number)[]
const mixed = [1, "two", 3];

// 클래스 계층
class Animal { move() {} }
class Dog extends Animal { bark() {} }
class Cat extends Animal { meow() {} }

const pets = [new Dog(), new Cat()];
// 추론: (Dog | Cat)[]
// Animal[]이 아님 — 공통 타입이지만 후보에 없으면 선택 안 됨

// Animal[]로 추론하려면 명시 필요
const petsAsAnimals: Animal[] = [new Dog(), new Cat()];
```

최적 공통 타입은 후보 타입들 중에서만 선택하기 때문에, 원하는 타입이 후보에 없다면 명시적 어노테이션이 필요하다.

```typescript
// null 포함 — 추론이 너무 넓어질 수 있음
const maybeNum = Math.random() > 0.5 ? 42 : null;
// 추론: number | null — 의도한 타입이면 OK, 아니면 명시

// 의도가 다를 경우 명시
const alwaysNum: number = Math.random() > 0.5 ? 42 : 0;
```

## 문맥적 타이핑

문맥적 타이핑(Contextual Typing)은 표현식이 **사용되는 위치의 문맥**에서 타입이 결정되는 방식이다. 콜백 함수의 파라미터 타입이 가장 대표적인 예다.

![문맥적 타이핑](/assets/posts/ts-type-inference-contextual.svg)

```typescript
// forEach의 콜백 — n의 타입이 number로 추론됨
const nums = [1, 2, 3];
nums.forEach((n) => {
  console.log(n.toFixed(2)); // n: number — 어노테이션 없음
});

// map의 콜백 — 반환 타입도 문맥에서 결정
const doubled = nums.map((n) => n * 2);
// doubled: number[]

// 이벤트 핸들러 — e의 타입이 MouseEvent로 추론됨
document.addEventListener("click", (e) => {
  console.log(e.clientX, e.clientY); // e: MouseEvent
});

// keydown 이벤트 — e: KeyboardEvent
document.addEventListener("keydown", (e) => {
  console.log(e.key); // e: KeyboardEvent
});
```

타입이 먼저 알려진 곳에 표현식을 배치할 때 문맥적 타이핑이 적용된다.

```typescript
// 타입 별칭에 할당
type Comparator = (a: number, b: number) => number;

const compare: Comparator = (a, b) => a - b;
// a, b의 타입이 number로 추론됨 — 어노테이션 불필요

// 객체 메서드
const handlers: Record<string, (s: string) => void> = {
  greet: (s) => console.log(`Hello, ${s}`), // s: string 추론
  shout: (s) => console.log(s.toUpperCase()), // s: string 추론
};
```

문맥적 타이핑이 작동하지 않는 경우도 있다. 함수를 별도 변수에 먼저 저장하면 문맥 정보가 사라진다.

```typescript
// 문맥 없음 — n의 타입 불명확
const logItem = (n) => console.log(n); // TS7006: 암묵적 any
nums.forEach(logItem); // 이미 늦음

// 해결: 타입 어노테이션을 직접 달거나 인라인으로 사용
const logItem2 = (n: number) => console.log(n); // 명시
nums.forEach((n) => console.log(n));             // 인라인 — 문맥 유지
```

## 추론 한계와 명시적 어노테이션이 필요한 경우

타입 추론이 강력하지만 모든 상황을 완벽히 처리하지는 못한다. 다음 상황에서는 명시적 어노테이션이 필요하거나 권장된다.

**1. 빈 배열 초기화**

```typescript
const items = [];        // never[] — 쓸 수 없는 타입
items.push("hello");     // TS2345 에러!

const items2: string[] = []; // 올바른 방법
```

**2. null / undefined 초기화**

```typescript
let current = null;      // null — 나중에 string을 담을 수 없음
current = "active";      // TS2322 에러!

let current2: string | null = null; // 올바른 방법
```

**3. 클래스 속성 선언**

```typescript
class Counter {
  count;      // any — strict 모드에서 에러

  count2 = 0; // number로 추론 (초기값 있음)
  count3: number; // 명시 — 생성자에서 초기화
}
```

**4. 재할당이 있는 변수**

```typescript
let result; // any
if (Math.random() > 0.5) {
  result = "yes";
} else {
  result = 42;
}
// result: any — 추론 실패

// 명시 필요
let result2: string | number;
```

**5. 복잡한 표현식 — 가독성을 위해 명시**

```typescript
// 추론은 정확하지만 타입이 복잡해 읽기 어려움
const fn = (arr: string[]) =>
  arr.reduce((acc, cur) => ({ ...acc, [cur]: cur.length }), {} as Record<string, number>);

// 반환 타입을 명시하면 의도가 명확해짐
const fn2 = (arr: string[]): Record<string, number> =>
  arr.reduce((acc, cur) => ({ ...acc, [cur]: cur.length }), {});
```

TypeScript 컴파일러의 추론 능력을 활용하되, 추론이 불가능하거나 결과가 `any`가 되는 경우, 그리고 코드의 의도를 명확히 해야 하는 공개 API에서는 명시적 어노테이션을 사용하는 것이 좋은 습관이다.

---

**지난 글:** [리터럴 타입 — 정확한 값으로 타입 좁히기](/posts/ts-literal-types/)

**다음 글:** [타입 어노테이션 — 언제 명시하고 언제 생략할까](/posts/ts-type-annotations/)

<br>
읽어주셔서 감사합니다. 😊
