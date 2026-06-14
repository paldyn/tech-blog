---
title: "const enum — 컴파일 타임 인라인과 트레이드오프"
description: "TypeScript const enum이 일반 enum과 어떻게 다르게 컴파일되는지, isolatedModules 환경에서의 제약, 실무에서 const enum을 써야 할 때와 피해야 할 때를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "const enum", "컴파일최적화", "isolatedModules", "enum"]
featured: false
draft: false
---

[지난 글](/posts/ts-enum-types/)에서 TypeScript enum의 기본을 살펴봤다. 숫자 enum, 문자열 enum, 이종 enum의 동작 방식을 이해했다면, 이번에는 `const enum`을 살펴볼 차례다. `const enum`은 일반 enum과 문법은 거의 동일하지만 컴파일 결과가 완전히 다르다. 번들 크기를 줄이는 강력한 최적화 도구이지만, 그만큼 제약도 뚜렷하다.

## const enum이란

`const enum`은 TypeScript가 컴파일 타임에 enum 멤버의 값을 **사용 지점에 직접 인라인**하는 특수한 enum이다. 런타임에 enum 객체가 생성되지 않는다.

```typescript
// const enum 선언
const enum Direction {
  Up    = 0,
  Down  = 1,
  Left  = 2,
  Right = 3,
}

// 사용
const move = Direction.Up;
```

위 코드를 컴파일하면 `Direction` 객체는 생성되지 않고, `Direction.Up` 자리에 리터럴 `0`이 그대로 삽입된다.

```javascript
// 컴파일 결과
const move = 0; /* Direction.Up */
```

일반 enum과 달리 JavaScript 런타임에 `Direction`이라는 변수 자체가 존재하지 않는다.

![const enum 컴파일 결과 비교](/assets/posts/ts-const-enum-compile.svg)

## 컴파일 결과 차이

일반 enum은 JavaScript로 컴파일될 때 **즉시 실행 함수(IIFE)**를 이용해 객체를 생성한다.

```typescript
// TypeScript — 일반 enum
enum Status {
  Pending  = "PENDING",
  Active   = "ACTIVE",
  Inactive = "INACTIVE",
}
```

```javascript
// 컴파일된 JavaScript
var Status;
(function (Status) {
  Status["Pending"]  = "PENDING";
  Status["Active"]   = "ACTIVE";
  Status["Inactive"] = "INACTIVE";
})(Status || (Status = {}));
```

번들에 이 IIFE 코드가 그대로 포함된다. 멤버 수가 많아질수록 코드도 증가한다.

반면 `const enum`은 사용된 자리마다 값이 인라인되고 enum 선언 자체는 완전히 사라진다.

```typescript
// TypeScript — const enum
const enum Status {
  Pending  = "PENDING",
  Active   = "ACTIVE",
  Inactive = "INACTIVE",
}

const s1 = Status.Pending;
const s2 = Status.Active;
```

```javascript
// 컴파일된 JavaScript
const s1 = "PENDING";  /* Status.Pending */
const s2 = "ACTIVE";   /* Status.Active  */
```

enum 객체를 초기화하는 코드가 번들에서 완전히 사라진다.

## 성능 이점: 번들 크기 최적화

`const enum`의 가장 큰 장점은 번들 크기다. 특히 멤버 수가 많거나 같은 enum을 여러 파일에서 import하는 경우 효과가 크다.

```typescript
// 큰 enum 예시 — HTTP 상태 코드
const enum HttpStatus {
  Ok                  = 200,
  Created             = 201,
  NoContent           = 204,
  BadRequest          = 400,
  Unauthorized        = 401,
  Forbidden           = 403,
  NotFound            = 404,
  InternalServerError = 500,
}

function handleResponse(status: HttpStatus) {
  if (status === HttpStatus.Ok) return "success";
  if (status === HttpStatus.NotFound) return "not found";
  return "other";
}
```

컴파일하면 `HttpStatus` 객체 생성 코드 없이 각 참조 위치에 숫자 리터럴만 남는다.

```javascript
function handleResponse(status) {
  if (status === 200) return "success";
  if (status === 404) return "not found";
  return "other";
}
```

minifier가 숫자 리터럴을 추가로 최적화할 수 있으므로 트리 쉐이킹 효과도 극대화된다.

## isolatedModules 환경에서의 제약

`const enum`의 결정적인 약점은 **`isolatedModules: true` 환경과 호환되지 않는다**는 것이다.

`isolatedModules`는 각 파일을 독립적으로 트랜스파일한다. Babel, esbuild, SWC 등 TypeScript를 직접 파싱하지 않고 단순히 타입만 제거하는 트랜스파일러들이 모두 이 방식을 사용한다.

```json
// tsconfig.json
{
  "compilerOptions": {
    "isolatedModules": true
  }
}
```

문제는 `const enum`이 선언된 파일과 그것을 사용하는 파일이 다를 때 발생한다.

```typescript
// direction.ts
export const enum Direction { Up = 0, Down = 1 }

// app.ts
import { Direction } from "./direction";
const d = Direction.Up;  // isolatedModules 환경에서 오류!
```

`isolatedModules` 트랜스파일러는 `direction.ts`를 독립적으로 처리하므로, `app.ts`를 컴파일할 때 `Direction.Up`의 값이 `0`임을 알 수 없다. 결과적으로 인라인이 불가능하고 런타임 오류가 발생한다.

TypeScript 컴파일러도 `isolatedModules: true`일 때 다른 파일에서 `const enum`을 import하면 오류를 표시한다.

```
error TS2748: Cannot access ambient const enums when
'isolatedModules' is enabled.
```

단, **같은 파일 내에서만 사용하는 `const enum`은 `isolatedModules` 환경에서도 동작한다.**

```typescript
// 같은 파일 내에서만 사용 — OK
const enum LocalStatus { Ok = 200, Error = 500 }
const code = LocalStatus.Ok; // → 200 으로 인라인됨
```

## const enum vs 일반 enum 선택 기준

두 가지 핵심 질문으로 판단한다.

**1. 런타임에 enum 객체가 필요한가?**

```typescript
// 역방향 매핑 — 값으로 이름을 조회
enum Dir { Up = 0, Down = 1 }

const name = Dir[0]; // "Up" — 일반 enum만 가능
```

`const enum`은 컴파일 후 enum 객체가 사라지므로 역방향 매핑이 불가능하다.

```typescript
// 객체 순회 — 일반 enum만 가능
Object.keys(Dir).forEach(key => console.log(key));
Object.values(Dir).forEach(val => console.log(val));
```

런타임에 enum 멤버를 순회하거나 값으로 이름을 조회해야 한다면 일반 enum을 사용해야 한다.

**2. Babel, esbuild, SWC 등 isolatedModules 빌드 환경인가?**

Vite, Next.js(SWC 기본), Create React App(Babel 기본) 등 현대적인 빌드 도구는 대부분 `isolatedModules: true`를 전제한다. 이 환경에서 여러 파일에 걸쳐 `const enum`을 사용하면 오류가 발생한다.

## 실무 권장 사항

![const enum 트레이드오프](/assets/posts/ts-const-enum-tradeoffs.svg)

실무에서의 권장 방향은 다음과 같다.

**`const enum`을 사용해도 좋은 경우:**
- `tsc`로만 컴파일하는 프로젝트 (Babel/SWC 미사용)
- 런타임 enum 객체가 전혀 필요 없는 경우
- 같은 파일 내에서만 사용하는 로컬 상수

**`const enum`을 피해야 하는 경우:**
- `isolatedModules: true` 환경 (Vite, Next.js, CRA 등)
- enum 값을 런타임에 순회하거나 역방향 조회하는 경우
- 라이브러리 제공자 — 소비자가 어떤 환경인지 알 수 없음
- 선언 파일(`.d.ts`)에서 `const enum`을 export하는 경우

**대안으로 고려할 수 있는 패턴:**

`const enum` 대신 `as const` 객체를 사용하면 번들 크기를 줄이면서 런타임 접근도 유지할 수 있다.

```typescript
// const enum 대신 as const 객체
const Direction = {
  Up:    0,
  Down:  1,
  Left:  2,
  Right: 3,
} as const;

type Direction = typeof Direction[keyof typeof Direction]; // 0 | 1 | 2 | 3

const d: Direction = Direction.Up; // OK
```

`as const` 패턴은 `isolatedModules`와 완벽히 호환되며, 런타임에 객체 참조도 가능하다. 타입 이름과 값 이름이 동일하므로 사용 측 코드도 enum과 거의 동일하게 작성할 수 있다.

```typescript
// 문자열 상수 집합 — as const 패턴
const HttpMethod = {
  Get:    "GET",
  Post:   "POST",
  Put:    "PUT",
  Delete: "DELETE",
} as const;

type HttpMethod = typeof HttpMethod[keyof typeof HttpMethod];
// "GET" | "POST" | "PUT" | "DELETE"

function request(url: string, method: HttpMethod) { /* ... */ }

request("/api/users", HttpMethod.Get);  // OK
request("/api/users", "GET");           // OK — 리터럴도 허용
request("/api/users", "PATCH");         // 오류
```

`const enum`은 강력한 최적화 도구지만, 빌드 환경과 사용 패턴을 신중하게 고려해야 한다. 현대 프로젝트에서는 `as const` 패턴이 더 안전하고 유연한 대안이다.

---

**지난 글:** [열거형 완전 정리 — 숫자·문자열·이종 enum 사용 가이드](/posts/ts-enum-types/)

**다음 글:** [리터럴 타입 — 정확한 값으로 타입 좁히기](/posts/ts-literal-types/)

<br>
읽어주셔서 감사합니다. 😊
