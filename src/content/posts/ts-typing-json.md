---
title: "JSON 타이핑 — JSON 값을 안전하게 표현하기"
description: "임의의 JSON 값을 표현하는 재귀적 JsonValue 타입을 정의하고, JsonObject·JsonArray 구조, 직렬화 가능한 타입만 허용하는 제약, 그리고 객체 타입이 JSON 호환인지 검증하는 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 9
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "JSON", "재귀타입", "직렬화", "타입안전", "유니온"]
featured: false
draft: false
---

[지난 글](/posts/ts-phantom-types/)에서 타입으로 상태를 추적하는 Phantom 타입을 다뤘다. 이번에는 거의 모든 웹 애플리케이션이 다루는 데이터 형식, **JSON**을 타입으로 표현하는 법을 본다. "그냥 `any`나 `object`로 받으면 되지 않나?" 싶지만, JSON이 표현할 수 있는 값의 범위를 정확한 타입으로 정의해 두면 직렬화 안전성과 자동완성을 한꺼번에 얻을 수 있다.

## JSON이 표현할 수 있는 값

JSON의 값은 정확히 여섯 가지뿐이다. 문자열, 숫자, 불리언, `null`, 그리고 이들을 담는 배열과 객체다. `undefined`, 함수, `Date`, `Map`, `Symbol` 같은 것은 JSON에 들어갈 수 없다. 이 정의를 타입으로 그대로 옮긴다.

```typescript
type JsonPrimitive = string | number | boolean | null;

type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
```

`JsonValue`는 **자기 자신을 참조하는 재귀 타입**이다. 배열의 요소도 `JsonValue`이고, 객체의 값도 `JsonValue`이므로, 임의의 깊이로 중첩된 JSON 구조를 모두 표현한다.

![JSON 값의 재귀적 타입](/assets/posts/ts-typing-json-flow.svg)

## 구조를 분리해 명확히 하기

배열과 객체 부분을 별도 별칭으로 떼어 두면 재사용과 가독성이 좋아진다. API 응답 헬퍼나 직렬화 유틸리티의 시그니처에서 이 이름들을 쓰면 의도가 분명해진다.

```typescript
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type JsonValue =
  | JsonPrimitive
  | JsonObject
  | JsonArray;

function deepClone(value: JsonValue): JsonValue {
  return JSON.parse(JSON.stringify(value));
}
```

`deepClone`은 `JsonValue`만 받으므로, 함수나 `Date`처럼 직렬화하면 손실되는 값을 넘기면 컴파일 단계에서 막힌다. JSON 왕복(round-trip)이 안전하다는 것이 타입으로 보장된다.

![JsonValue 재귀 타입](/assets/posts/ts-typing-json-code.svg)

## 직렬화 가능한 타입만 허용하기

내 객체 타입이 "정말 JSON으로 안전하게 직렬화되는가?"를 컴파일 타임에 검증하고 싶을 때가 있다. 매핑 타입과 조건부 타입으로 직렬화 불가능한 값을 걸러내는 `Jsonify`/`Serializable` 패턴을 쓸 수 있다.

```typescript
type Serializable<T> =
  T extends JsonPrimitive ? T
  : T extends Array<infer U> ? Serializable<U>[]
  : T extends object
    ? { [K in keyof T]: Serializable<T[K]> }
    : never; // 함수·symbol 등은 never로 배제

interface Event {
  name: string;
  at: number;
  handler: () => void; // 직렬화 불가
}

type SafeEvent = Serializable<Event>;
// handler 가 never 가 되어 사용 시 문제를 드러냄
```

이 패턴은 캐시 저장, 메시지 전송, `localStorage` 같은 직렬화 경계에서 "넘기면 안 되는 값"을 타입으로 차단하는 데 유용하다.

## undefined 처리에 주의

`JSON.stringify`는 객체 속성의 `undefined`를 **조용히 누락**시킨다. 따라서 엄밀한 JSON 타입에는 `undefined`를 포함하지 않는 것이 정확하다. 선택적 필드가 필요하면 `null`을 명시적으로 쓰는 편이 왕복 안전하다.

```typescript
// ❌ undefined는 직렬화 시 사라져 왕복이 깨질 수 있음
type Loose = { nickname?: string };

// ✅ 부재를 null로 표현 — 직렬화 후에도 보존
type Strict = { nickname: string | null };

const before: Strict = { nickname: null };
const after = JSON.parse(JSON.stringify(before)); // { nickname: null }
```

`undefined`를 허용하면 직렬화 전후의 객체 형태가 달라질 수 있다. 데이터 일관성이 중요한 곳에서는 `null`로 부재를 표현하는 규칙을 두는 것이 좋다.

## 도메인 타입과의 경계

`JsonValue`는 "구조를 모르는 임의의 JSON"을 다룰 때 쓰는 타입이다. 반대로 응답 형태를 아는 경우에는 `interface User { ... }`처럼 구체적인 도메인 타입을 정의하는 것이 맞다. `JsonValue`는 직렬화 유틸리티·로깅·범용 캐시처럼 **형태를 특정할 수 없는 경계**에서 빛을 발한다.

```typescript
// 형태를 아는 경우 — 구체 타입
async function getUser(): Promise<User> { /* ... */ }

// 형태를 모르는 경우 — JsonValue
function logEvent(payload: JsonValue) { /* ... */ }
```

요약하면 `JsonValue`는 여섯 가지 JSON 값을 재귀 유니온으로 정밀하게 표현한 타입이다. 그런데 정작 외부에서 데이터를 받아 올 때 쓰는 `JSON.parse`는 이 안전성을 무시하고 `any`를 돌려준다. 다음 글에서는 바로 그 `JSON.parse`의 타이핑을 `unknown` 기반으로 안전하게 다루는 법을 마지막으로 살펴본다.

---

**지난 글:** [Phantom 타입 — 타입으로만 상태를 추적하기](/posts/ts-phantom-types/)

**다음 글:** [JSON.parse 타이핑 — unknown 기반 안전한 파싱](/posts/ts-json-parse-typing/)

<br>
읽어주셔서 감사합니다. 😊
