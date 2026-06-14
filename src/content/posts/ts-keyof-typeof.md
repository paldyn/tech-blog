---
title: "keyof와 typeof — 타입에서 키를 추출하다"
description: "TypeScript keyof 연산자로 타입의 키 유니언 추출, typeof 연산자로 값에서 타입 추론, 두 연산자 조합 패턴을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "keyof", "typeof", "타입연산자", "키추출", "타입추론"]
featured: false
draft: false
---

[지난 글](/posts/ts-readonly-const-assertions/)에서 readonly와 as const를 살펴봤다. 이번에는 TypeScript의 두 가지 핵심 타입 연산자 **`keyof`와 `typeof`**를 다룬다. 기존 타입이나 값에서 새로운 타입을 파생시키는 강력한 도구다.

## keyof 연산자

`keyof`는 타입의 모든 **알려진 키를 리터럴 유니언 타입**으로 추출한다.

```typescript
interface User {
  id:    number;
  name:  string;
  email: string;
}

type UserKey = keyof User; // "id" | "name" | "email"
```

![keyof 연산자](/assets/posts/ts-keyof-typeof-keyof.svg)

## keyof의 실용적 활용

`keyof`가 빛나는 곳은 제네릭 함수와 결합할 때다.

```typescript
// K extends keyof T — T의 키만 허용
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: "Alice", email: "a@b.com" };
getProperty(user, "name");  // string ✅
getProperty(user, "age");   // TS2345 ❌ 'age'는 UserKey에 없음
```

`K extends keyof T`는 "T의 키 중 하나"라는 제약을 만든다. 반환 타입 `T[K]`는 실제 키에 따라 정확한 타입을 반환한다.

## typeof 연산자

JavaScript의 `typeof`는 런타임 타입을 문자열로 반환한다. TypeScript의 `typeof`는 **값의 타입을 추론**하는 타입 수준 연산자다.

```typescript
const config = {
  host:    "localhost",
  port:    3000,
  ssl:     false,
};

type Config = typeof config;
// { host: string; port: number; ssl: boolean }
```

![typeof 연산자](/assets/posts/ts-keyof-typeof-typeof.svg)

## keyof typeof 조합

`as const`와 `keyof typeof`를 함께 쓰면 객체의 키를 리터럴 유니언으로 추출할 수 있다.

```typescript
const ROUTES = {
  home:    "/",
  about:   "/about",
  contact: "/contact",
} as const;

type RouteKey  = keyof typeof ROUTES;   // "home" | "about" | "contact"
type RouteVal  = typeof ROUTES[RouteKey]; // "/" | "/about" | "/contact"

function navigate(route: RouteKey) {
  window.location.href = ROUTES[route];
}

navigate("home");    // OK ✅
navigate("profile"); // TS2345 ❌
```

## ReturnType과 Parameters — 함수 타입 추출

`typeof`는 함수 타입을 추출할 때도 쓰인다.

```typescript
function fetchUser(id: string) {
  return { id, name: "Alice", createdAt: new Date() };
}

type UserResult  = ReturnType<typeof fetchUser>;
// { id: string; name: string; createdAt: Date }

type FetchParams = Parameters<typeof fetchUser>;
// [id: string]
```

함수 시그니처를 직접 참조하므로 함수가 바뀌면 타입도 자동으로 따라온다.

## 클래스 인스턴스 타입

```typescript
class EventEmitter {
  on(event: string, handler: () => void): void { /* ... */ }
  off(event: string): void { /* ... */ }
}

type Emitter = InstanceType<typeof EventEmitter>;
// EventEmitter 인스턴스 타입
```

`InstanceType<typeof Class>`는 클래스 인스턴스의 타입을 반환한다. 팩토리 함수 반환 타입을 선언할 때 유용하다.

---

**지난 글:** [readonly와 const 단언 — 불변 타입 설계](/posts/ts-readonly-const-assertions/)

**다음 글:** [인덱스 접근 타입 — T[K]로 타입 추출](/posts/ts-indexed-access-types/)

<br>
읽어주셔서 감사합니다. 😊
