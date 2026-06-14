---
title: "Partial · Required · Readonly 완전 정복"
description: "TypeScript 3대 객체 변환 유틸리티 타입을 깊이 파헤칩니다. Partial로 부분 업데이트를 안전하게, Required로 검증 완료 타입을 명시하고, Readonly로 불변 객체를 선언하는 방법과 내부 Mapped Type 구현 원리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "유틸리티 타입", "Partial", "Required", "Readonly", "Mapped Type"]
featured: false
draft: false
---

[지난 글](/posts/ts-utility-types-overview/)에서 TypeScript 내장 유틸리티 타입 전체를 조감도로 살펴봤습니다. 이번 글부터는 각 유틸리티 타입을 하나씩 깊이 파고듭니다. 첫 번째 주제는 객체 프로퍼티의 **선택성(optionality)** 과 **불변성(immutability)** 을 조작하는 `Partial<T>`, `Required<T>`, `Readonly<T>` 세 가지입니다.

![Partial · Required · Readonly 변환 원리](/assets/posts/ts-partial-required-readonly-overview.svg)

## 내부 구현: Mapped Type 수식어

세 유틸리티 타입은 모두 **Mapped Type 수식어**를 이용해 단 한 줄로 구현됩니다.

```typescript
// TypeScript 표준 라이브러리 lib.es5.d.ts
type Partial<T> = {
  [P in keyof T]?: T[P];       // ? 수식어 추가
};

type Required<T> = {
  [P in keyof T]-?: T[P];      // ? 수식어 제거 (-?)
};

type Readonly<T> = {
  readonly [P in keyof T]: T[P]; // readonly 수식어 추가
};
```

`-?`는 기존 `?` 수식어를 **제거**하는 minus modifier입니다. `+?`와 `+readonly`는 수식어를 명시적으로 추가하는 표기지만 보통 생략합니다.

## Partial\<T\>: 부분 업데이트의 표준 패턴

`Partial<T>`는 타입 `T`의 모든 프로퍼티를 선택적(`?`)으로 만듭니다. 가장 흔한 사용 사례는 PATCH 스타일의 **부분 업데이트 함수**입니다.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

// 수정할 필드만 전달 가능
function updateUser(id: number, patch: Partial<User>): User {
  const existing = getUserById(id);
  return { ...existing, ...patch };
}

updateUser(1, { name: "Alice" });          // OK
updateUser(1, { email: "a@b.com", age: 30 }); // OK
updateUser(1, { unknown: "x" });           // Error: unknown 프로퍼티 없음
```

`Partial`을 쓰지 않으면 수정 가능한 모든 조합마다 오버로드를 선언해야 합니다. `Partial`은 이를 하나의 타입으로 통합합니다.

### useState와 Partial의 조합

React에서 상태 객체를 부분적으로 갱신할 때도 유용합니다.

```typescript
interface AppState {
  user: User | null;
  theme: "light" | "dark";
  language: string;
}

function useAppState() {
  const [state, setState] = useState<AppState>({
    user: null,
    theme: "light",
    language: "ko",
  });

  // 원하는 필드만 업데이트
  const update = (patch: Partial<AppState>) =>
    setState(prev => ({ ...prev, ...patch }));

  return { state, update };
}
```

## Required\<T\>: 검증 완료 타입 표현

`Required<T>`는 모든 선택적 프로퍼티를 필수로 만듭니다. 폼 입력처럼 **"아직 미완성"** 상태와 **"검증 완료"** 상태를 타입으로 구분할 때 강력합니다.

```typescript
// 입력 중인 미완성 폼 (모두 선택적)
interface FormDraft {
  name?: string;
  email?: string;
  birthDate?: Date;
}

// 검증 완료 → 모두 필수
type ValidForm = Required<FormDraft>;

function submitForm(draft: FormDraft): void {
  if (!draft.name || !draft.email || !draft.birthDate) {
    throw new Error("필수 항목 누락");
  }
  // 이 아래에서는 타입 단언 없이 ValidForm으로 취급하고 싶다면:
  const validated = draft as ValidForm;
  sendToServer(validated);
}

function sendToServer(form: ValidForm): void {
  console.log(form.name.toUpperCase()); // 안전 — null 없음
}
```

`Required`를 사용하면 런타임 null 체크를 통과한 이후의 코드에서 별도 단언 없이 타입 안전성을 표현할 수 있습니다.

## Readonly\<T\>: 불변 객체 선언

`Readonly<T>`는 모든 프로퍼티에 `readonly` 수식어를 추가합니다. 런타임에는 아무런 영향이 없고, 컴파일 타임에 재할당을 막는 **타입 레벨 불변성**을 제공합니다.

```typescript
const config: Readonly<{
  apiUrl: string;
  timeout: number;
}> = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
};

config.timeout = 3000; // Error: 읽기 전용 프로퍼티
```

```typescript
// 배열을 반환하되 수정 불가로 만들기
function getPermissions(): Readonly<string[]> {
  return ["read", "write"];
}

const perms = getPermissions();
perms.push("admin"); // Error: readonly 배열
```

`Object.freeze()`와 달리 `Readonly`는 **얕은(shallow)** 불변성만 보장합니다. 중첩 객체까지 보호하려면 재귀 타입이 필요합니다(이후 `ts-deep-readonly` 글에서 다룹니다).

## 세 타입의 조합 패턴

![실전 활용 패턴](/assets/posts/ts-partial-required-readonly-code.svg)

유틸리티 타입은 중첩해서 조합할 수 있습니다.

```typescript
// 모든 필드가 선택적이면서 불변인 타입
type PartialReadonly<T> = Readonly<Partial<T>>;

// 필수화 후 다시 선택적으로 — "Draft" 패턴
type Draft<T> = Partial<Required<T>>;

// 실전: 불변 설정 객체 빌더
type ConfigBuilder<T> = {
  [K in keyof Required<T>]: (val: Required<T>[K]) => ConfigBuilder<T>;
} & { build(): Readonly<Required<T>> };
```

`Readonly<Partial<T>>`는 Redux 스타일 state처럼 값은 선택적이되 직접 수정을 금지할 때 쓰입니다. `Partial<Required<T>>`는 모든 optional을 일단 필수화한 뒤 부분 업데이트를 허용할 때 활용됩니다.

## 주의사항: 얕은 변환

세 유틸리티 모두 **1단계 깊이**만 변환합니다.

```typescript
interface Nested {
  inner: {
    value: string;
    count: number;
  };
}

type P = Partial<Nested>;
// P.inner는 optional이지만
// P.inner.value 는 여전히 필수 string!

const p: P = { inner: { value: "x" } }; // Error: count 없음
```

중첩 객체까지 재귀적으로 변환하려면 커스텀 재귀 유틸리티 타입이 필요합니다. 이 부분은 시리즈 후반부에서 다룹니다.

---

**지난 글:** [유틸리티 타입 총정리 — Partial에서 Awaited까지](/posts/ts-utility-types-overview/)

**다음 글:** [Pick과 Omit으로 타입 조각내기](/posts/ts-pick-omit/)

<br>
읽어주셔서 감사합니다. 😊
