---
title: "JSON.parse 타이핑 — unknown 기반 안전한 파싱"
description: "JSON.parse가 any를 반환해 생기는 타입 구멍을 unknown 래퍼와 런타임 검증으로 막는 법을 정리합니다. as 단언의 위험, 타입 가드 작성, Zod 같은 스키마 검증, parse 결과를 Result로 감싸는 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "JSON", "파싱", "unknown", "타입가드", "스키마검증"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-json/)에서 JSON 값을 정밀하게 표현하는 `JsonValue` 타입을 만들었다. 그런데 정작 외부 데이터를 읽어 오는 표준 함수 `JSON.parse`는 그 안전성을 모두 무너뜨린다. 반환 타입이 `any`이기 때문이다. 이번 글은 시리즈의 한 매듭으로, 신뢰할 수 없는 입력의 관문인 `JSON.parse`를 타입 안전하게 다루는 법을 정리한다.

## 문제: JSON.parse는 any를 반환한다

`JSON.parse`의 표준 타입 시그니처는 `(text: string) => any`다. `any`는 타입 검사를 통째로 꺼 버리므로, 파싱 결과에 무슨 짓을 해도 컴파일러가 침묵한다.

```typescript
const user = JSON.parse(input); // any
console.log(user.naem.toUpperCase()); // 오타·잘못된 형태 모두 통과
// 런타임에서야 TypeError로 터진다
```

여기에 흔히 쓰는 `as` 단언은 상황을 더 악화시킨다. "내가 안다"고 컴파일러를 설득할 뿐, 실제 데이터가 그 형태인지는 아무도 검증하지 않기 때문이다.

```typescript
const user = JSON.parse(input) as User; // 거짓 안심
// input이 실제로 User가 아니어도 컴파일러는 만족한다
```

![JSON.parse는 any를 반환](/assets/posts/ts-json-parse-typing-flow.svg)

## 1단계: unknown으로 좁히는 관문 만들기

첫 번째 개선은 `any`를 `unknown`으로 바꾸는 것이다. `unknown`은 "정체불명"을 뜻하므로, 무언가를 하기 전에 **반드시 형태를 확인**하도록 강제한다. 작은 래퍼 함수로 관문을 만든다.

```typescript
function safeParse(text: string): unknown {
  return JSON.parse(text);
}

const raw = safeParse(input); // unknown
// raw.name; // ❌ unknown에는 접근 불가 — 검증을 강제
```

이 한 줄의 차이가 크다. `any`였다면 그냥 통과했을 잘못된 접근이, `unknown`에서는 검증 코드를 작성하도록 막아선다. 이제 검증을 붙일 차례다.

![안전한 JSON.parse 타이핑](/assets/posts/ts-json-parse-typing-code.svg)

## 2단계: 타입 가드로 검증하기

`unknown` 값이 우리가 기대하는 형태인지 런타임에서 확인하는 **타입 가드**를 작성한다. 반환 타입의 `value is User`가 좁히기를 알려 준다.

```typescript
interface User {
  id: number;
  name: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value && typeof (value as Record<string, unknown>).id === "number" &&
    "name" in value && typeof (value as Record<string, unknown>).name === "string"
  );
}

const raw = safeParse(input);
if (isUser(raw)) {
  console.log(raw.name.toUpperCase()); // ✅ raw: User 로 좁혀짐
} else {
  throw new Error("응답 형태가 User가 아닙니다");
}
```

가드를 통과한 블록 안에서만 `raw`가 `User`로 좁혀진다. 형태가 다르면 분기로 빠지므로, **검증 없이 데이터를 신뢰하는 경로 자체가 사라진다**.

## 3단계: 스키마 검증 라이브러리

필드가 많아지면 손으로 가드를 쓰는 일이 고통스러워진다. Zod·Valibot 같은 스키마 검증 라이브러리는 스키마 하나로 런타임 검증과 타입 추론을 동시에 제공한다.

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
});

type User = z.infer<typeof UserSchema>; // { id: number; name: string }

const user = UserSchema.parse(JSON.parse(input));
// 검증 실패 시 throw, 성공 시 user는 정확히 User 타입
```

스키마가 **단일 진실 공급원**이 된다. `z.infer`로 타입을 자동 도출하므로, 타입과 검증 로직이 어긋날 일이 없다. 실무에서 외부 API·폼 입력을 다룰 때 사실상 표준에 가까운 접근이다.

## 4단계: 예외 대신 Result로 감싸기

`JSON.parse`는 잘못된 문자열에 대해 예외를 던지고, 스키마 검증도 실패 시 throw한다. 이 두 실패를 묶어 **결과 값**으로 돌려주면 호출자가 분기를 강제로 처리하게 된다. 시리즈 앞에서 본 에러 핸들링 패턴과 자연스럽게 이어진다.

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function parseUser(input: string): Result<User> {
  try {
    const data = UserSchema.parse(JSON.parse(input));
    return { ok: true, value: data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "파싱 실패" };
  }
}

const r = parseUser(input);
if (r.ok) use(r.value); // User
else showError(r.error); // 실패 처리를 잊을 수 없음
```

`JSON.parse`의 문법 오류와 스키마 불일치가 하나의 `Result`로 통합된다. 호출부는 `r.ok`를 확인해야만 값에 접근할 수 있으므로, 신뢰할 수 없는 입력이 검증을 건너뛰고 도메인 로직에 침투하는 일이 원천 차단된다.

정리하면, 안전한 파싱의 핵심은 ① `any`를 `unknown`으로 좁히고 ② 타입 가드나 스키마로 런타임 검증을 거쳐 ③ 실패를 명시적으로 다루는 것이다. 외부에서 들어오는 모든 데이터는 "검증 전까지 신뢰하지 않는다"는 원칙 하나로 수많은 런타임 버그를 막을 수 있다. 비동기·에러 처리에서 출발해 타입 레벨 프로그래밍을 거쳐 JSON 안전성까지, 이번 묶음에서 다룬 주제들은 모두 "타입으로 실수를 미리 막는다"는 한 줄로 이어진다.

---

**지난 글:** [JSON 타이핑 — JSON 값을 안전하게 표현하기](/posts/ts-typing-json/)

<br>
읽어주셔서 감사합니다. 😊
