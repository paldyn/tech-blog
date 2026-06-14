---
title: "Deep Readonly 패턴 완전 정복"
description: "TypeScript의 Readonly<T>가 얕은(shallow) 불변성만 제공하는 한계를 설명하고, 재귀 Mapped Type으로 구현하는 DeepReadonly<T>를 완전히 정리합니다. Redux 상태 불변성, 설정 객체 보호, DeepPartial, DeepMutable 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "유틸리티 타입", "DeepReadonly", "불변성", "재귀 타입", "Mapped Type"]
featured: false
draft: false
---

[지난 글](/posts/ts-thistype-omitthisparameter/)에서 `this` 컨텍스트를 타입 레벨에서 다루는 방법을 살펴봤습니다. 이번 글은 유틸리티 타입 시리즈의 마지막 편으로, TypeScript 표준 라이브러리에 없지만 실무에서 자주 필요한 **DeepReadonly** 패턴을 완전히 정리합니다.

![Readonly vs Deep Readonly 깊이 비교](/assets/posts/ts-deep-readonly-overview.svg)

## Readonly의 한계: 얕은 불변성

표준 `Readonly<T>`는 최상위 프로퍼티만 `readonly`로 만듭니다.

```typescript
interface Config {
  host: string;
  db: {
    url: string;
    pool: number;
  };
}

const config: Readonly<Config> = {
  host: "localhost",
  db: { url: "postgres://...", pool: 5 },
};

config.host = "example.com"; // Error: readonly
config.db = { url: "...", pool: 10 }; // Error: readonly

// 하지만 중첩 객체 내부는 보호되지 않음!
config.db.url = "mysql://..."; // OK — 수정 가능!
config.db.pool = 100;          // OK — 수정 가능!
```

이는 `Readonly`가 `{ readonly [P in keyof T]: T[P] }`로 정의되기 때문입니다. `db` 프로퍼티 자체는 readonly가 되지만, `db`가 가리키는 객체는 그대로 가변 상태입니다.

## DeepReadonly 구현

재귀 Mapped Type으로 모든 깊이의 프로퍼티를 readonly로 만듭니다.

```typescript
type DeepReadonly<T> =
  T extends (infer I)[]
    ? ReadonlyArray<DeepReadonly<I>>       // 배열 → ReadonlyArray
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> } // 객체 → 재귀
      : T;                                  // primitive → 그대로
```

세 가지 경우를 처리합니다:
1. **배열**: `ReadonlyArray<DeepReadonly<원소>>` — 배열 자체와 원소 모두 보호
2. **객체**: 각 프로퍼티를 `readonly`로 + 재귀 적용
3. **primitive**: `string`, `number`, `boolean` 등 — 변환 없이 반환

```typescript
const config: DeepReadonly<Config> = {
  host: "localhost",
  db: { url: "postgres://...", pool: 5 },
};

config.host = "x";     // Error
config.db.url = "x";   // Error — 중첩도 보호됨!
config.db.pool = 100;  // Error
```

## ReadonlyArray vs readonly 배열

```typescript
// ReadonlyArray<T>: push/pop 등 변경 메서드 없음
const arr: ReadonlyArray<number> = [1, 2, 3];
arr.push(4);   // Error
arr[0] = 99;   // Error

// readonly T[]: 동일한 의미
const arr2: readonly number[] = [1, 2, 3];
arr2.push(4);  // Error
```

`DeepReadonly`에서 배열을 `ReadonlyArray<DeepReadonly<I>>`로 처리하면 배열 자체의 불변성과 원소의 불변성을 동시에 보장합니다.

## 실전 패턴

![DeepReadonly · DeepPartial 실전 패턴](/assets/posts/ts-deep-readonly-patterns.svg)

### Redux 불변 상태

```typescript
interface UserState {
  current: { id: number; name: string; roles: string[] } | null;
  list: { id: number; name: string }[];
  loading: boolean;
}

// Redux state는 reducer 외부에서 절대 수정되면 안 됨
type RootState = DeepReadonly<{
  user: UserState;
  cart: CartState;
  ui: UIState;
}>;

function UserCard({ userId }: { userId: number }) {
  const user = useSelector((state: RootState) => state.user.current);
  // user.name = "x"; // Error — DeepReadonly가 보호
  return <div>{user?.name}</div>;
}
```

### 설정 객체 보호

```typescript
function createApp(config: AppConfig) {
  // 설정을 내부에서 변경 불가로 만들기
  const frozenConfig = Object.freeze(config) as DeepReadonly<AppConfig>;

  return {
    start() {
      console.log(`Starting on ${frozenConfig.server.host}:${frozenConfig.server.port}`);
      // frozenConfig.server.port = 9000; // 컴파일 에러 + 런타임 에러
    }
  };
}
```

## DeepPartial: 역방향 패턴

같은 원리로 모든 레벨을 optional로 만드는 `DeepPartial`도 유용합니다.

```typescript
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// 중첩 설정의 일부만 오버라이드
function mergeConfig(base: AppConfig, override: DeepPartial<AppConfig>): AppConfig {
  return deepMerge(base, override);
}

mergeConfig(defaultConfig, {
  server: { port: 9000 }, // host는 base 유지
});
```

## DeepMutable: readonly 제거

`-readonly` minus modifier로 역방향 변환도 가능합니다.

```typescript
type DeepMutable<T> = T extends object
  ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
  : T;

// 불변 타입을 받아서 수정 가능한 복사본 생성
function cloneAndModify<T>(frozen: DeepReadonly<T>): DeepMutable<T> {
  return JSON.parse(JSON.stringify(frozen)) as DeepMutable<T>;
}
```

## type-fest 라이브러리

매번 직접 구현하는 대신 [`type-fest`](https://github.com/sindresorhus/type-fest) 라이브러리를 사용하면 검증된 구현을 바로 쓸 수 있습니다.

```bash
npm install type-fest
```

```typescript
import type { ReadonlyDeep, PartialDeep, Mutable } from "type-fest";

type SafeConfig = ReadonlyDeep<AppConfig>;
type DraftConfig = PartialDeep<AppConfig>;
type EditableConfig = Mutable<AppConfig>;
```

`type-fest`는 `ReadonlyDeep`, `PartialDeep`, `RequiredDeep`, `Mutable` 등 다양한 재귀 유틸리티를 제공하며, 순환 참조, 함수 타입, Map/Set 등 엣지 케이스도 처리합니다.

## 주의: 성능 고려

재귀 Mapped Type은 매우 깊은 중첩 구조에서 TypeScript 컴파일러의 타입 체크 성능에 영향을 줄 수 있습니다. 실제로 문제가 되면 재귀 깊이를 제한하거나 특정 레벨까지만 적용하는 변형 버전을 사용하세요.

```typescript
// 최대 3단계까지만 재귀
type DeepReadonly3<T, Depth extends 0[] = []> =
  Depth["length"] extends 3
    ? Readonly<T>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly3<T[K], [...Depth, 0]> }
      : T;
```

---

**지난 글:** [ThisType과 OmitThisParameter 완전 정복](/posts/ts-thistype-omitthisparameter/)

<br>
읽어주셔서 감사합니다. 😊
