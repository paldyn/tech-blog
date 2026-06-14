---
title: "TypeScript 완전 정복: 타입 단언(Type Assertion) 완전 이해"
description: "TypeScript의 타입 단언(as, !, double assertion)의 문법과 동작 원리, 타입 가드와의 차이, 안전하게 사용하는 기준을 코드 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "타입단언", "TypeAssertion", "as", "NonNull", "타입가드"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-annotations/)에서 타입 어노테이션과 타입 추론을 살펴봤다. 때로는 TypeScript 컴파일러가 추론한 타입보다 개발자가 더 정확한 정보를 갖고 있는 경우가 있다. 이럴 때 사용하는 것이 **타입 단언(Type Assertion)**이다. 타입 단언은 강력하지만 잘못 사용하면 TypeScript의 안전망을 뚫는 구멍이 된다.

## 타입 단언이란

타입 단언은 TypeScript에게 "나는 이 값의 타입이 X임을 알고 있다"고 선언하는 문법이다. 런타임에 아무 영향이 없으며, 컴파일러의 타입 추론을 덮어쓴다.

![타입 단언 문법](/assets/posts/ts-type-assertions-syntax.svg)

## as 문법

가장 기본적인 형태는 `value as Type`이다.

```typescript
// DOM API — getElementById는 HTMLElement | null 반환
const input = document.getElementById("myInput") as HTMLInputElement;
input.value; // OK — HTMLInputElement.value 접근 가능

// JSON.parse — 반환 타입이 any
const config = JSON.parse(rawString) as AppConfig;
config.port; // OK — AppConfig 타입으로 단언

// unknown → 구체 타입
function processInput(val: unknown): string {
  return (val as string).toUpperCase(); // 위험: val이 string이 아닐 수 있음
}
```

JSX 파일에서는 `<Type>value` 형태의 각괄호 문법이 JSX 태그와 충돌하므로 `as` 문법만 사용할 수 있다.

## Non-Null 단언 (!)

`!` 연산자는 값이 `null` 또는 `undefined`가 아님을 단언한다.

```typescript
// getElementById는 HTMLElement | null
const el = document.getElementById("app"); // HTMLElement | null
el!.classList.add("active"); // el이 null이 아님을 단언

// 체이닝에서도 사용 가능
const value = map.get("key")!.toString();
```

`!`는 런타임에 아무것도 하지 않는다. 값이 실제로 null이면 런타임 에러가 발생한다. null 체크가 확실할 때만 사용해야 한다.

## Double Assertion (이중 단언)

두 타입이 서로 호환되지 않을 때 `as unknown as TargetType`처럼 `unknown`을 거쳐 단언한다.

```typescript
// 서로 무관한 타입 간 단언
const handler = eventHandler as unknown as ClickHandler;
```

이중 단언은 TypeScript의 타입 안전성을 완전히 우회하는 것이므로 **최후의 수단**으로만 사용한다.

## 타입 단언 vs 타입 가드

![타입 단언 vs 타입 가드](/assets/posts/ts-type-assertions-vs-guards.svg)

타입 단언과 타입 가드의 핵심 차이는 **런타임 검사 여부**다.

```typescript
// 타입 단언 — 컴파일 타임에만 동작, 런타임 위험
function assertProcess(val: unknown): string {
  return (val as string).toUpperCase(); // val이 42면 런타임 에러
}

// 타입 가드 — 런타임에 실제 확인
function safeProcess(val: unknown): string {
  if (typeof val === "string") {
    return val.toUpperCase(); // 완전히 안전
  }
  throw new Error("Expected string");
}
```

## 올바른 사용 시나리오

### 1. DOM API — 구체적인 HTML 요소 타입

```typescript
// getElementById는 HTMLElement | null — 너무 넓음
const form = document.getElementById("signup") as HTMLFormElement;
form.submit();

// querySelector도 마찬가지
const canvas = document.querySelector("#chart") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
```

### 2. JSON.parse 결과

```typescript
interface ServerConfig {
  host: string;
  port: number;
  debug: boolean;
}

const raw = localStorage.getItem("config") ?? "{}";
const config = JSON.parse(raw) as ServerConfig;
// 주의: JSON.parse는 any를 반환하므로 실제 데이터와 타입이 다를 수 있음
// 중요한 데이터는 Zod 같은 파싱 라이브러리로 검증할 것
```

### 3. 외부 라이브러리 반환값

```typescript
// 라이브러리 타입 정의가 부정확할 때
const result = thirdPartyLib.getValue() as MyExpectedType;
```

## 피해야 할 패턴

```typescript
// ❌ 타입 에러를 덮으려는 단언
const count: number = "hello" as unknown as number; // 명백한 잘못

// ❌ 타입 가드로 해결 가능한 것을 단언으로 처리
function process(val: string | number) {
  return (val as string).toUpperCase(); // typeof 체크가 더 안전
}

// ✅ 올바른 접근
function processCorrect(val: string | number): string {
  if (typeof val === "string") return val.toUpperCase();
  return val.toString();
}
```

## as const — 상수 단언

`as const`는 특별한 단언으로, 값을 가능한 가장 좁은(리터럴) 타입으로 만든다.

```typescript
const config = {
  url: "https://api.example.com",
  timeout: 3000,
} as const;

// config.url: "https://api.example.com" (리터럴 타입)
// config.timeout: 3000 (리터럴 타입)
// config 전체가 readonly — 수정 불가
```

## 마치며

타입 단언은 TypeScript의 타입 추론이 부족한 부분을 개발자의 지식으로 보완하는 도구다. `as`, `!`, `as const`는 각각 다른 목적으로 사용된다. 핵심 원칙은 **타입 에러를 덮기 위해서가 아니라 컴파일러보다 더 많이 알 때만 사용**하는 것이다. 다음 글에서는 TypeScript에서 함수 타입을 정의하는 다양한 방법을 살펴본다.

---

**지난 글:** [타입 어노테이션 — 언제 명시하고 언제 생략할까](/posts/ts-type-annotations/)

**다음 글:** [TypeScript 함수 타입 완전 정리](/posts/ts-function-types/)

<br>
읽어주셔서 감사합니다. 😊
