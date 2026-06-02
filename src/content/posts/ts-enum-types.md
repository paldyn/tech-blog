---
title: "열거형 완전 정리 — 숫자·문자열·이종 enum 사용 가이드"
description: "TypeScript enum의 숫자 열거형, 문자열 열거형, 이종 열거형, 역방향 매핑, 상수 멤버를 코드 예제와 함께 완전히 정리하고 언제 enum을 쓸지 가이드합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "enum", "열거형", "StringEnum", "NumericEnum"]
featured: false
draft: false
---

[지난 글](/posts/ts-object-types/)에서 객체 타입을 살펴봤다. 이번 글에서는 TypeScript의 **열거형(enum)**을 완전히 정리한다. 숫자 열거형, 문자열 열거형, 이종 열거형, 역방향 매핑, `const enum`까지 다루고, 마지막으로 언제 `enum`을 사용할지, 언제 유니언 타입이 더 나은지 기준을 제시한다.

## 열거형이란

열거형(enum)은 이름이 있는 상수 집합을 정의하는 TypeScript 고유 기능이다. 순수 타입 레벨 구성이 아니라 **컴파일 시 실제 JavaScript 객체로 변환**된다.

```typescript
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// 컴파일 결과 (JavaScript)
// var Direction;
// (function (Direction) {
//   Direction[Direction["Up"] = 0] = "Up";
//   Direction[Direction["Down"] = 1] = "Down";
//   Direction[Direction["Left"] = 2] = "Left";
//   Direction[Direction["Right"] = 3] = "Right";
// })(Direction || (Direction = {}));
```

`Direction.Up`은 값 `0`이 되고, `Direction[0]`은 문자열 `"Up"`이 된다. 이것이 **역방향 매핑**이다.

## 숫자 열거형과 역방향 매핑

![숫자 열거형 (Numeric Enum)](/assets/posts/ts-enum-types-numeric.svg)

숫자 열거형은 첫 번째 멤버부터 0으로 시작해 자동으로 1씩 증가한다. 초기값을 직접 지정할 수도 있다.

```typescript
enum HttpStatus {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  NotFound = 404,
  InternalServerError = 500,
}

function handleResponse(status: HttpStatus): string {
  switch (status) {
    case HttpStatus.OK:
      return "요청 성공";
    case HttpStatus.NotFound:
      return "리소스를 찾을 수 없음";
    case HttpStatus.InternalServerError:
      return "서버 오류 — 나중에 다시 시도하세요";
    default:
      return `알 수 없는 상태: ${status}`;
  }
}
```

역방향 매핑 덕분에 숫자 값에서 이름을 얻을 수 있다.

```typescript
console.log(HttpStatus[200]);   // "OK"
console.log(HttpStatus[404]);   // "NotFound"
console.log(HttpStatus.OK);     // 200
```

하지만 이 역방향 매핑은 **숫자 열거형에만** 적용된다. 문자열 열거형은 지원하지 않는다.

## 문자열 열거형

![문자열 열거형 (String Enum)](/assets/posts/ts-enum-types-string.svg)

문자열 열거형은 각 멤버에 명시적인 문자열 값을 할당한다. 자동 증가가 없으므로 모든 멤버에 값을 지정해야 한다.

```typescript
enum ApiEndpoint {
  Users = "/api/users",
  Posts = "/api/posts",
  Comments = "/api/comments",
}

async function fetchData(endpoint: ApiEndpoint): Promise<unknown> {
  const response = await fetch(endpoint);
  return response.json();
}

// 사용 예
fetchData(ApiEndpoint.Users);
// fetchData("/api/users"); // 오류: string은 ApiEndpoint에 할당 불가
```

문자열 enum의 장점:
- 런타임에 의미 있는 값을 유지해 디버깅이 쉽다.
- 역직렬화(JSON 파싱 등) 시 예측 가능한 값이 나온다.
- IDE 자동 완성과 리팩토링이 안전하다.

## 이종 열거형 (주의 필요)

숫자와 문자열을 섞은 **이종 열거형(Heterogeneous Enum)**은 TypeScript에서 허용하지만 실제로는 사용을 강력히 피해야 한다.

```typescript
// 이종 열거형 — 실무에서 사용 금지
enum BoolLike {
  No = 0,
  Yes = "YES",
}
```

이종 열거형은 역방향 매핑이 일부에만 적용되고, 타입 안전성도 불분명해진다. 숫자 부분에만 역방향 매핑이 동작하므로 예상과 다른 결과가 발생하기 쉽다. 문자열 enum이나 숫자 enum 중 하나를 일관되게 사용하는 것이 올바른 선택이다.

## const 멤버와 계산된 멤버

enum 멤버는 **상수 멤버**와 **계산된 멤버**로 나뉜다.

```typescript
// 상수 멤버 (컴파일 타임에 값이 결정됨)
enum FileAccess {
  None,           // 0
  Read = 1 << 1,  // 2 (비트 시프트)
  Write = 1 << 2, // 4
  ReadWrite = Read | Write, // 6 (비트 OR)
}

// 계산된 멤버 (런타임에 값이 결정됨)
enum StringLength {
  Hello = "hello".length,  // 5 — 계산된 멤버
  World = "world".length,  // 5 — 계산된 멤버
}
```

계산된 멤버를 포함한 enum은 `const enum`으로 선언할 수 없다는 제약이 있다.

### const enum: 인라인 최적화

`const enum`은 컴파일 시 enum 객체를 생성하지 않고 사용 지점에 직접 값을 인라인한다.

```typescript
const enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

const move = Direction.Up;
// 컴파일 결과: const move = "UP";
// Direction 객체 자체는 JavaScript에 남지 않음
```

번들 크기를 줄일 수 있지만 트레이드오프가 있다. Babel, esbuild, SWC 같은 일부 트랜스파일러는 `const enum`을 올바르게 처리하지 못한다. `isolatedModules: true` 설정에서도 사용이 제한된다.

## enum vs 유니언 타입 선택 기준

TypeScript에는 enum 대신 **유니언 타입**을 사용하는 패턴이 있다. 두 방식을 비교해보자.

```typescript
// enum 방식
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

function moveEnum(dir: Direction) {
  console.log(dir); // "UP", "DOWN" 등 출력
}

// 유니언 타입 방식
type Direction2 = "UP" | "DOWN" | "LEFT" | "RIGHT";

function moveUnion(dir: Direction2) {
  console.log(dir);
}

// 호출 비교
moveEnum(Direction.Up);          // 반드시 enum 멤버 사용
moveUnion("UP");                  // 리터럴 문자열 직접 사용 가능
```

**enum을 선택하는 경우:**
- 멤버 집합이 크고 이름이 의미를 명확히 표현할 때
- 코드에서 반복적으로 참조하며 자동완성이 중요할 때
- 컴파일된 JavaScript에서도 이름을 유지해야 할 때(로깅, 직렬화 등)

**유니언 타입을 선택하는 경우:**
- 값이 문자열 리터럴이고 외부에서 직접 문자열을 넘기는 경우가 많을 때
- 번들 크기나 트리 쉐이킹이 중요한 경우
- Babel, esbuild 등 TypeScript가 아닌 트랜스파일러를 사용하는 경우
- 간결함을 선호하고 enum의 런타임 동작이 필요 없을 때

현대 TypeScript 프로젝트에서는 **유니언 타입** 쪽을 선호하는 추세가 강하지만, 팀 컨벤션과 도구 환경에 따라 enum도 충분히 유효한 선택이다.

## 정리

TypeScript enum의 핵심을 정리하면:

- 숫자 enum은 역방향 매핑을 지원하여 값에서 이름을 얻을 수 있다.
- 문자열 enum은 런타임에 의미 있는 값을 유지해 디버깅이 편하다.
- 이종 enum은 문법상 허용되지만 실무에서는 피해야 한다.
- `const enum`은 번들 최적화에 유리하지만 일부 트랜스파일러와 호환성 문제가 있다.
- 유니언 타입 리터럴이 더 간결하고 트리 쉐이킹 친화적이므로 두 방식을 비교해 선택한다.

---

**지난 글:** [객체 타입 완전 정리 — 프로퍼티·옵셔널·인덱스 시그니처](/posts/ts-object-types/)

**다음 글:** [const enum — 컴파일 타임 인라인과 트레이드오프](/posts/ts-const-enum/)

<br>
읽어주셔서 감사합니다. 😊
