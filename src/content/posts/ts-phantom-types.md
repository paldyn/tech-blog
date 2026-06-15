---
title: "Phantom 타입 — 타입으로만 상태를 추적하기"
description: "값에는 존재하지 않고 타입 매개변수로만 상태를 표현하는 Phantom 타입을 설명합니다. Connection<open/closed> 상태 머신, 빌더의 필수 단계 강제, 컴파일 타임에 잘못된 호출을 막는 패턴을 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 8
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "Phantom", "팬텀타입", "상태머신", "타입안전", "제네릭"]
featured: false
draft: false
---

[지난 글](/posts/ts-opaque-types/)에서 brand로 타입을 구분하는 Opaque 타입을 다뤘다. Phantom 타입은 그 아이디어를 한 걸음 더 밀어붙인다. 브랜드는 "이 값이 무엇인지"를 표시했다면, Phantom 타입은 **"이 값이 지금 어떤 상태인지"**를 타입 매개변수로 추적한다. 그 매개변수는 런타임 값에는 전혀 등장하지 않는, 말 그대로 "유령(phantom)" 정보다.

## Phantom 타입이란

제네릭 타입 `Foo<S>`에서 타입 매개변수 `S`가 실제 데이터(프로퍼티 타입)에는 쓰이지 않고, 오직 컴파일 타임의 구분 용도로만 존재할 때 이를 phantom 타입 매개변수라고 부른다. 값은 동일해도 타입 수준의 `S`가 다르면 서로 다른 타입으로 취급된다.

```typescript
declare const tag: unique symbol;

type Tagged<T, S> = T & { readonly [tag]?: S };
// S는 어디에도 실제로 저장되지 않는다 (optional, 런타임 부재)
```

`[tag]?: S`는 선택적 속성이라 런타임 객체에는 존재하지 않는다. 그러나 타입 검사기는 `S`를 기억하므로, 같은 모양이라도 `S`가 다르면 할당을 거부한다. 이 점이 상태 추적의 토대가 된다.

![Phantom 타입으로 상태 추적](/assets/posts/ts-phantom-types-flow.svg)

## 예제: 연결 상태 머신

데이터베이스 커넥션처럼 "열림/닫힘" 상태가 있는 자원을 생각해 보자. 닫힌 커넥션에 쿼리를 보내면 런타임 오류가 난다. 이 실수를 **컴파일 타임에** 막을 수 있다.

```typescript
type State = "open" | "closed";

interface Conn<S extends State> {
  readonly id: string;
  readonly __state?: S; // phantom: 런타임에는 없음
}

declare function connect(): Conn<"open">;
declare function query(c: Conn<"open">, sql: string): void;
declare function close(c: Conn<"open">): Conn<"closed">;
```

`query`는 `Conn<"open">`만 받는다. `close`는 열린 커넥션을 받아 `Conn<"closed">`를 돌려준다. 상태 전이가 타입에 그대로 새겨진다.

```typescript
const c = connect();        // Conn<"open">
query(c, "SELECT 1");       // ✅ 열려 있으니 허용
const closed = close(c);    // Conn<"closed">
query(closed, "SELECT 2");  // ❌ closed는 open이 아님 — 차단!
```

`closed`에 쿼리를 시도하면 컴파일러가 막는다. 런타임 검사 한 줄 없이도 "닫힌 커넥션 사용"이라는 버그 부류 전체가 사라진다.

![Phantom 타입 상태 머신](/assets/posts/ts-phantom-types-code.svg)

## 예제: 빌더의 필수 단계 강제

빌더 패턴에서 "필수 필드를 채우기 전에 `build()`를 호출하는" 실수도 phantom 타입으로 막을 수 있다. 어떤 필드가 설정됐는지를 타입에 누적한다.

```typescript
interface Builder<Set extends string> {
  host(v: string): Builder<Set | "host">;
  port(v: number): Builder<Set | "port">;
  build(this: Builder<"host" | "port">): Config;
}

declare function builder(): Builder<never>;
```

`build`의 `this` 타입은 `Builder<"host" | "port">`로 제한된다. 즉 `host`와 `port`가 모두 설정된 빌더에서만 호출할 수 있다.

```typescript
builder().host("localhost").port(5432).build(); // ✅ 둘 다 설정됨

builder().host("localhost").build();
// ❌ "port"가 빠져 build의 this 제약 위반
```

설정 메서드를 호출할 때마다 `Set` 유니온에 키가 누적되고, `build`는 필요한 키가 모두 모였을 때만 허용된다. 호출 순서나 누락 실수를 IDE가 즉시 잡아 준다.

## Opaque와 무엇이 다른가

둘 다 phantom 정보를 쓰지만 목적이 다르다. Opaque 타입은 **"이 값의 종류"**(UserId vs PostId)를 고정적으로 표시하고, Phantom 타입은 **"이 값의 상태"**(open vs closed)가 연산에 따라 **변해 가는 것**을 추적한다. Phantom은 상태 전이를 타입 시그니처로 모델링한다는 점에서 더 동적이다.

```typescript
// Opaque: 종류가 고정 — 값 만들고 끝
type UserId = Brand<string, "UserId">;

// Phantom: 상태가 전이 — 연산이 타입을 바꿈
type Conn<S extends State> = { id: string; __state?: S };
// connect → open, close → closed 로 상태가 흐른다
```

## 비용과 한계

Phantom 타입의 가장 큰 장점은 **런타임 비용이 0**이라는 것이다. `__state` 같은 속성은 컴파일 후 사라지므로 번들 크기에 영향이 없다. 다만 단언(`as`)으로 강제로 상태를 위조할 수 있으니, 상태 전이 함수(`connect`/`close`)를 한곳에 모아 캡슐화하고 그 밖에서는 직접 단언하지 않는 규율이 필요하다. 또 과하게 쓰면 타입 시그니처가 복잡해지므로, "잘못 쓰면 피해가 큰" 자원과 워크플로에 한정하는 것이 좋다.

타입만으로 상태 머신을 표현하면, 잘못된 상태 전이를 아예 작성할 수 없는 코드가 된다. 다음 글에서는 다시 실무로 돌아와, 외부에서 들어오는 데이터의 대표 격인 **JSON**을 안전하게 타이핑하는 법을 살펴본다.

---

**지난 글:** [Opaque 타입 — 구조적 타이핑에 명목성 부여하기](/posts/ts-opaque-types/)

**다음 글:** [JSON 타이핑 — JSON 값을 안전하게 표현하기](/posts/ts-typing-json/)

<br>
읽어주셔서 감사합니다. 😊
