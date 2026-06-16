---
title: "상태 머신 타이핑 — 불가능한 상태를 제거하기"
description: "판별 유니온으로 상태 머신을 타이핑해 \"불가능한 상태를 표현 불가능하게\" 만드는 법을 다룹니다. 플래그 조합의 모순, 상태별 데이터 결합, 전이 함수 타이핑, exhaustiveness 검사까지 실무 비동기 UI 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 3
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "상태머신", "판별유니온", "불가능한상태", "타입설계"]
featured: false
draft: false
---

[지난 글](/posts/ts-builder-pattern-typing/)에서 빌더의 "조립 중"과 "완성" 상태를 타입으로 구분했다. 그 발상을 일반화하면 상태 머신 타이핑이 된다. UI 비동기 흐름이든 결제 처리든, 시스템은 정해진 상태들 사이를 오간다. 이때 흔한 실수는 여러 불리언 플래그로 상태를 표현하는 것이다. 이번 글은 판별 유니온을 써서 "불가능한 상태를 아예 표현할 수 없게" 만드는, Richard Feldman이 널리 알린 그 원칙을 TypeScript로 구현한다.

## 플래그 조합의 함정

데이터를 불러오는 화면을 불리언 플래그로 모델링한다고 해 보자. 얼핏 자연스럽지만, 곧 모순된 조합이 가능해진다.

```typescript
interface ScreenState {
  isLoading: boolean;
  data: User[] | null;
  error: string | null;
}

// 가능한 조합 2³ = 8가지 — 그중 다수가 모순이다
// isLoading: true 인데 data 와 error 가 둘 다 있다?
// isLoading: false 인데 data·error 둘 다 null 이면 무슨 상태?
```

세 개의 불리언/널 필드는 8가지 조합을 만든다. 그중 의미 있는 건 서너 개뿐이고 나머지는 모순이다. 코드 곳곳에서 `if (isLoading && data)` 같은 "있을 수 없는" 분기를 방어적으로 처리하게 되고, 정작 진짜 버그는 그 틈에 숨는다.

![상태 전이 타이핑](/assets/posts/ts-state-machine-typing-flow.svg)

## 판별 유니온으로 상태를 분리

해법은 각 상태를 독립된 객체 타입으로 정의하고, 공통 `tag` 필드로 구분하는 것이다. 그리고 **데이터는 그것이 존재하는 상태에만** 둔다.

```typescript
type ScreenState =
  | { tag: "idle" }
  | { tag: "loading" }
  | { tag: "success"; data: User[] }
  | { tag: "error"; message: string };
```

이제 `data`는 오직 `success` 상태에만, `message`는 오직 `error` 상태에만 존재한다. "로딩 중인데 데이터가 있다"거나 "성공인데 에러 메시지도 있다" 같은 모순은 타입 정의 단계에서 **표현 자체가 불가능**하다. 8가지 조합이 정확히 4가지 유효 상태로 줄었다.

![판별 유니온으로 상태 표현](/assets/posts/ts-state-machine-typing-code.svg)

## 상태별 안전한 접근

`tag`로 좁히고 나면 그 상태에만 있는 필드에 안전하게 접근할 수 있다. 다른 상태에서 `data`를 읽으려 하면 컴파일 에러다.

```typescript
function render(state: ScreenState): string {
  switch (state.tag) {
    case "idle":
      return "시작하려면 버튼을 누르세요";
    case "loading":
      return "불러오는 중...";
    case "success":
      return `${state.data.length}명 로드됨`; // data 접근 가능
    case "error":
      return `오류: ${state.message}`;        // message 접근 가능
  }
}
```

`success` 케이스 안에서만 `state.data`가 보이고, `error` 케이스 안에서만 `state.message`가 보인다. 잘못된 상태에서 필드를 읽는 실수는 컴파일러가 막는다. 방어적 `if`가 사라지고 코드가 상태 정의를 그대로 따라간다.

## 전이 함수 타이핑

상태 머신의 또 다른 축은 전이다. 어떤 이벤트가 현재 상태를 다음 상태로 바꾸는지를 함수로 표현한다.

```typescript
type Event =
  | { type: "FETCH" }
  | { type: "RESOLVE"; data: User[] }
  | { type: "REJECT"; message: string };

function transition(state: ScreenState, event: Event): ScreenState {
  switch (event.type) {
    case "FETCH":
      return { tag: "loading" };
    case "RESOLVE":
      return { tag: "success", data: event.data };
    case "REJECT":
      return { tag: "error", message: event.message };
  }
}
```

전이 함수는 항상 유효한 `ScreenState`만 반환할 수 있다. 모순된 상태를 만들 방법이 타입에 없으니, 잘못된 전이는 작성하는 순간 막힌다.

## exhaustiveness로 빈틈 막기

상태나 이벤트를 나중에 하나 추가했는데 `switch`에서 처리를 빠뜨리면 어떻게 될까? `never` 타입을 이용한 exhaustiveness 검사를 넣으면 컴파일러가 누락을 잡아 준다.

```typescript
function render(state: ScreenState): string {
  switch (state.tag) {
    case "idle": return "...";
    case "loading": return "...";
    case "success": return "...";
    case "error": return "...";
    default: {
      const _exhaustive: never = state; // 새 상태 추가 시 여기서 컴파일 에러
      return _exhaustive;
    }
  }
}
```

모든 케이스를 처리했다면 `default`에 도달하는 `state`의 타입은 `never`다. 만약 `{ tag: "retrying" }` 같은 상태를 유니온에 추가하면, 처리되지 않은 그 상태가 `never`에 할당되지 못해 컴파일 에러가 난다.

정리하면, 상태 머신 타이핑의 원칙은 ① 모순 조합을 만드는 플래그 대신 판별 유니온으로 상태를 분리하고 ② 데이터를 그것이 유효한 상태에만 두며 ③ 전이를 함수로 닫고 ④ exhaustiveness로 빈틈을 막는 것이다. "불가능한 상태를 표현 불가능하게"라는 한 문장이 수많은 방어 코드와 런타임 버그를 한꺼번에 없앤다. 다음 글에서는 객체 그래프를 조립하는 또 다른 주제, 의존성 주입의 타이핑을 다룬다.

---

**지난 글:** [빌더 패턴 타이핑 — 타입으로 단계 강제하기](/posts/ts-builder-pattern-typing/)

**다음 글:** [의존성 주입 타이핑 — 토큰과 컨테이너 설계](/posts/ts-dependency-injection-typing/)

<br>
읽어주셔서 감사합니다. 😊
