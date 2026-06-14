---
title: "리터럴 타입 — 정확한 값으로 타입 좁히기"
description: "TypeScript 리터럴 타입(문자열·숫자·불리언)의 선언 방법, 타입 확장(widening), as const를 통한 리터럴 고정, 유니언과의 조합 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "리터럴타입", "LiteralTypes", "asConst", "타입확장"]
featured: false
draft: false
---

[지난 글](/posts/ts-const-enum/)에서 `const enum`을 살펴봤다. enum을 컴파일 타임 상수로 다루는 방법을 이해했다면, 이번에는 그 기반이 되는 개념인 **리터럴 타입(Literal Types)**을 깊이 살펴볼 차례다. 리터럴 타입은 TypeScript 타입 시스템에서 가장 작은 단위의 타입으로, 정확한 값 자체를 타입으로 표현한다. 유니언, `as const`, 판별 유니언 등 TypeScript의 고급 패턴들이 모두 리터럴 타입을 기반으로 동작한다.

## 리터럴 타입이란

**리터럴 타입**은 특정 값 하나를 타입으로 나타낸 것이다. `string` 타입이 모든 문자열을 허용하는 반면, `"hello"` 리터럴 타입은 정확히 문자열 `"hello"`만 허용한다.

```typescript
// 일반 타입 vs 리터럴 타입
let a: string = "hello";   // 어떤 문자열이든 OK
let b: "hello" = "hello";  // 오직 "hello"만 OK
let c: "hello" = "world";  // 오류: '"world"'는 '"hello"' 타입에 할당 불가
```

TypeScript에는 세 종류의 리터럴 타입이 있다: **문자열 리터럴**, **숫자 리터럴**, **불리언 리터럴**. 그 외에도 `null`, `undefined`, `symbol`, `bigint` 리터럴 타입도 존재하지만 가장 자주 쓰이는 세 가지를 중심으로 살펴본다.

![리터럴 타입 종류](/assets/posts/ts-literal-types-overview.svg)

## 문자열·숫자·불리언 리터럴

**문자열 리터럴 타입**은 특정 문자열 값을 타입으로 사용한다.

```typescript
type YesOrNo = "yes" | "no";
type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

function request(method: HttpVerb, url: string) {
  // method는 반드시 위 다섯 가지 중 하나여야 함
}

request("GET", "/api/users");    // OK
request("FETCH", "/api/users");  // 오류 — "FETCH"는 HttpVerb 아님
```

**숫자 리터럴 타입**은 특정 숫자 값만 허용한다. 주사위 면처럼 취할 수 있는 값이 한정된 경우에 유용하다.

```typescript
type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;
type ZeroOrOne = 0 | 1;    // 플래그 값
type Port = 80 | 443 | 3000 | 8080;

function setFlag(flag: ZeroOrOne) { /* ... */ }
setFlag(1);   // OK
setFlag(0);   // OK
setFlag(2);   // 오류
```

**불리언 리터럴 타입**은 `true` 또는 `false` 값 자체를 타입으로 사용한다. 단독으로 쓰이기보다는 조건부 타입과 함께 자주 등장한다.

```typescript
type True  = true;
type False = false;

// 조건부 타입에서 불리언 리터럴
type IsString<T> = T extends string ? true : false;

type A = IsString<"hello">; // true
type B = IsString<42>;      // false
```

## 리터럴 타입과 유니언

리터럴 타입은 단독으로 쓰이기보다 **유니언 타입**과 결합할 때 진가를 발휘한다. 허용 가능한 값의 집합을 정확히 표현할 수 있다.

```typescript
// 상태 머신 타입
type TrafficLight = "red" | "yellow" | "green";

function nextLight(current: TrafficLight): TrafficLight {
  switch (current) {
    case "red":    return "green";
    case "green":  return "yellow";
    case "yellow": return "red";
  }
}
```

TypeScript는 `switch` 문에서 `current`가 어떤 값인지 각 `case`마다 정확히 알기 때문에 `default` 없이도 반환 타입이 완전히 커버됨을 확인한다.

```typescript
// 이벤트 시스템
type EventName =
  | "click"
  | "focus"
  | "blur"
  | "keydown"
  | "keyup";

function addEventListener(
  event: EventName,
  handler: (e: Event) => void
) { /* ... */ }

addEventListener("click", (e) => { /* ... */ });  // OK
addEventListener("hover", (e) => { /* ... */ });  // 오류
```

유니언 리터럴 타입은 함수 오버로드 없이도 허용 가능한 인자를 정확히 문서화한다.

## 타입 확장(Widening)과 const

TypeScript는 변수를 선언할 때 **타입 확장(widening)**을 수행한다. 리터럴 값으로 초기화된 변수의 타입을 리터럴 타입 그대로 유지하지 않고, 더 넓은 기본 타입으로 확장하는 것이다.

```typescript
let x = "hello";   // 추론된 타입: string (확장됨)
let y = 42;        // 추론된 타입: number (확장됨)
let z = true;      // 추론된 타입: boolean (확장됨)
```

`let`으로 선언하면 나중에 다른 값으로 재할당할 수 있으므로 TypeScript는 넓은 타입을 추론한다. 반면 `const`로 선언하면 재할당이 불가능하므로 리터럴 타입을 그대로 유지한다.

```typescript
const x = "hello";  // 추론된 타입: "hello" (리터럴 유지)
const y = 42;       // 추론된 타입: 42 (리터럴 유지)
const z = true;     // 추론된 타입: true (리터럴 유지)
```

이 차이가 실무에서 문제가 되는 경우는 함수 인자를 전달할 때다.

```typescript
type Direction = "north" | "south" | "east" | "west";

function move(dir: Direction) { /* ... */ }

let dir = "north";   // 타입: string
move(dir);           // 오류! string은 Direction에 할당 불가

const dir2 = "north"; // 타입: "north"
move(dir2);           // OK — "north"는 Direction의 멤버
```

`let`으로 선언된 `dir`은 타입이 `string`으로 확장되어 있으므로, `Direction` 타입을 기대하는 함수에 전달할 수 없다.

![리터럴 타입 확장 (Widening)](/assets/posts/ts-literal-types-widening.svg)

## as const로 리터럴 고정

객체나 배열에서 `let`과 `const`의 동작은 다르다. `const`로 객체를 선언해도 속성은 여전히 변경 가능하므로, 속성 타입은 넓은 타입으로 추론된다.

```typescript
const config = {
  env:  "production",
  port: 3000,
};
// 추론된 타입: { env: string; port: number }
// 속성이 리터럴이 아닌 이유: config.env = "development" 가 가능하기 때문
```

모든 속성을 리터럴 타입으로 고정하려면 `as const`를 사용한다.

```typescript
const config = {
  env:  "production",
  port: 3000,
} as const;
// 추론된 타입: { readonly env: "production"; readonly port: 3000 }
```

`as const`는 두 가지 효과를 동시에 가져온다. 첫째, 모든 속성이 리터럴 타입으로 좁혀진다. 둘째, 모든 속성이 `readonly`가 되어 재할당이 불가능해진다.

배열에도 동일하게 적용된다.

```typescript
const colors = ["red", "green", "blue"];
// 타입: string[]

const colors2 = ["red", "green", "blue"] as const;
// 타입: readonly ["red", "green", "blue"]
// — 리터럴 튜플 타입으로 고정됨
```

`as const` 배열은 단순한 `string[]`이 아니라 세 원소의 정확한 리터럴 타입을 가진 읽기 전용 튜플이 된다.

## 실전 패턴: 설정 객체, 상태 열거

**패턴 1: 설정 객체로 enum 대체하기**

```typescript
const Role = {
  Admin:   "ADMIN",
  User:    "USER",
  Guest:   "GUEST",
} as const;

type Role = typeof Role[keyof typeof Role];
// "ADMIN" | "USER" | "GUEST"

function checkAccess(userRole: Role, required: Role) {
  return userRole === required;
}

checkAccess(Role.Admin, Role.User);   // OK
checkAccess("ADMIN",    "USER");      // OK — 리터럴 직접 전달도 OK
checkAccess("SUPERUSER", Role.User);  // 오류
```

이 패턴은 `isolatedModules` 환경에서도 안전하게 동작하며, 런타임에 객체 순회도 가능하다.

**패턴 2: 판별 유니언의 판별자로 사용**

```typescript
type LoadingState = { status: "loading" };
type SuccessState = { status: "success"; data: string[] };
type ErrorState   = { status: "error";   message: string };

type State = LoadingState | SuccessState | ErrorState;

function render(state: State) {
  switch (state.status) {
    case "loading": return "로딩 중...";
    case "success": return state.data.join(", ");  // state: SuccessState
    case "error":   return `오류: ${state.message}`; // state: ErrorState
  }
}
```

리터럴 타입이 판별자 역할을 하여 TypeScript가 각 `case`에서 정확한 타입을 알 수 있다.

**패턴 3: 함수 오버로드를 대체하는 조건부 반환 타입**

```typescript
function createElement(tag: "div"): HTMLDivElement;
function createElement(tag: "input"): HTMLInputElement;
function createElement(tag: "button"): HTMLButtonElement;
function createElement(tag: string): HTMLElement {
  return document.createElement(tag);
}

const div    = createElement("div");    // HTMLDivElement
const input  = createElement("input"); // HTMLInputElement
```

문자열 리터럴 타입을 오버로드 서명의 인자로 사용하면 반환 타입도 정확하게 좁힐 수 있다.

**패턴 4: 경로 타입 안전성**

```typescript
const routes = {
  home:    "/",
  about:   "/about",
  contact: "/contact",
  profile: "/profile",
} as const;

type AppRoute = typeof routes[keyof typeof routes];
// "/" | "/about" | "/contact" | "/profile"

function navigate(path: AppRoute) {
  window.location.href = path;
}

navigate(routes.home);   // OK
navigate("/about");      // OK
navigate("/settings");   // 오류 — 정의되지 않은 경로
```

`as const`와 리터럴 타입으로 라우트 경로를 타입 안전하게 관리할 수 있다. 경로를 추가하거나 변경할 때 사용 지점에서 즉시 오류를 확인할 수 있어 리팩터링이 안전해진다.

리터럴 타입은 TypeScript 타입 시스템의 핵심 구성 요소다. 단순한 값 제한을 넘어 판별 유니언, 조건부 타입, 템플릿 리터럴 타입 등 고급 기능들의 토대가 된다. 변수 선언 시 `const`를 적극적으로 활용하고, 객체와 배열에는 `as const`를 적용하는 습관을 들이면 TypeScript의 타입 추론 품질이 크게 향상된다.

---

**지난 글:** [const enum — 컴파일 타임 인라인과 트레이드오프](/posts/ts-const-enum/)

**다음 글:** [타입 추론 완전 정리 — TypeScript가 타입을 결정하는 방식](/posts/ts-type-inference/)

<br>
읽어주셔서 감사합니다. 😊
