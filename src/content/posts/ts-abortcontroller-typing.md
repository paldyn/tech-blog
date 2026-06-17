---
title: "AbortController 타이핑"
description: "AbortController와 AbortSignal을 TypeScript로 다루는 법을 정리합니다. controller·signal의 타입, signal을 함수 옵션으로 받는 시그니처, AbortError를 catch에서 좁혀 구분하기, AbortSignal.timeout과 any 조합, 이벤트 리스너 자동 해제 패턴까지 실무 관점으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 9
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "AbortController", "AbortSignal", "취소", "비동기", "fetch"]
featured: false
draft: false
---

[지난 글](/posts/ts-async-iterators/)에서 비동기 값의 연속을 다루는 이터레이터를 봤다. 비동기 작업을 시작하는 법은 충분히 다뤘으니, 이번에는 그 반대 — **시작한 작업을 취소하는 법**을 타이핑한다. 표준 도구는 `AbortController`다. fetch 요청 취소, 이벤트 리스너 정리, 타임아웃까지 하나의 인터페이스로 묶는데, TypeScript의 DOM·Node 타입에 이미 잘 정의되어 있어 타이핑은 비교적 매끄럽다. 다만 취소 에러를 구분하는 부분에 우리가 시리즈 내내 다룬 좁히기가 다시 등장한다.

## AbortController와 AbortSignal

`AbortController`는 두 가지를 제공한다. 읽기 전용 핸들인 `signal`(타입 `AbortSignal`)과, 취소를 발동하는 `abort()` 메서드다. 작업을 시작하는 쪽에 `signal`을 건네주고, 취소하고 싶을 때 `abort()`를 부른다.

```typescript
const controller = new AbortController();
const signal: AbortSignal = controller.signal;

// 어딘가에서 취소
controller.abort();
console.log(signal.aborted); // true
```

`controller`의 타입은 `AbortController`, `signal`은 `AbortSignal`로 모두 표준 라이브러리에 정의돼 있다. 핵심 설계는 **권한 분리**다. `signal`을 받은 쪽은 취소를 *관찰*만 할 수 있고, 취소를 *발동*하는 권한은 `controller`를 쥔 쪽에만 있다.

![AbortController에서 signal의 전파](/assets/posts/ts-abortcontroller-typing-flow.svg)

`abort()` 한 번이 그 `signal`을 구독하는 모든 소비처 — fetch, 이벤트 리스너, 커스텀 비동기 작업 — 에 동시에 전파된다.

## signal을 함수 옵션으로 받기

취소 가능한 함수를 직접 만들 때는, 옵션 객체에 `signal?: AbortSignal`을 받는 게 표준 관용구다. `fetch`나 Node API들도 모두 이 형태를 따른다.

```typescript
async function fetchUser(
  id: number,
  options?: { signal?: AbortSignal }
): Promise<User> {
  const res = await fetch(`/api/user/${id}`, { signal: options?.signal });
  return res.json();
}

const controller = new AbortController();
const promise = fetchUser(1, { signal: controller.signal });
// 필요하면 controller.abort()
```

`signal`을 옵셔널로 두면 호출하는 쪽이 취소가 필요할 때만 넘긴다. `fetch`의 두 번째 인자 `RequestInit`이 이미 `signal?: AbortSignal | null` 필드를 갖고 있어, 그대로 전달하면 타입이 맞아떨어진다.

## 취소 에러 구분하기 — catch는 unknown에서

`signal`로 취소된 `fetch`는 그냥 실패하지 않는다. `AbortError`라는 이름의 `DOMException`으로 reject된다. 문제는 [지난 Promise 글](/posts/ts-typing-promise-deep/)에서 강조했듯, `catch`로 받는 `e`가 `unknown`이라는 점이다. 취소인지 진짜 네트워크 실패인지 구분하려면 좁혀야 한다.

```typescript
try {
  const user = await fetchUser(1, { signal });
} catch (e) {
  if (e instanceof Error && e.name === "AbortError") {
    // 사용자가 의도적으로 취소함 — 조용히 무시
    return;
  }
  // 그 외는 진짜 에러 — 화면에 표시하거나 재시도
  throw e;
}
```

![취소 에러를 catch에서 구분](/assets/posts/ts-abortcontroller-typing-error.svg)

`e instanceof Error`로 먼저 `Error`임을 보장한 뒤 `e.name === "AbortError"`로 취소를 가려낸다. [instanceof 좁히기](/posts/ts-typeof-instanceof-narrowing/)의 전형적인 응용이다. 취소를 에러로 취급해 사용자에게 보여주는 실수가 흔한데, 이 분기 하나로 막는다.

## AbortSignal의 정적 헬퍼들

최신 환경에는 `AbortSignal`에 편리한 정적 메서드가 있고, 타입도 따라온다. `AbortSignal.timeout(ms)`은 일정 시간 후 자동으로 취소되는 signal을, `AbortSignal.any([...])`는 여러 signal 중 하나라도 취소되면 함께 취소되는 signal을 만든다.

```typescript
// 5초 타임아웃
const res = await fetch("/api/slow", { signal: AbortSignal.timeout(5000) });

// 사용자 취소 OR 타임아웃 — 둘 중 먼저
const userController = new AbortController();
const combined: AbortSignal = AbortSignal.any([
  userController.signal,
  AbortSignal.timeout(5000),
]);
```

`AbortSignal.timeout`은 `AbortSignal`을, `AbortSignal.any`는 입력 배열을 받아 `AbortSignal`을 반환한다고 타입에 정의돼 있다. 타임아웃으로 취소되면 `e.name`이 `"TimeoutError"`라 위의 분기에서 `AbortError`와 또 구분할 수 있다.

## 이벤트 리스너 자동 해제

`AbortController`의 또 다른 깔끔한 용도는 이벤트 리스너 정리다. `addEventListener`의 옵션에 `signal`을 넘기면, `abort()` 시 리스너가 자동으로 제거된다. 여러 리스너를 등록해도 `abort()` 한 번으로 전부 해제되니, React `useEffect`의 cleanup 등에서 유용하다.

```typescript
function setupListeners(signal: AbortSignal) {
  window.addEventListener("resize", onResize, { signal });
  window.addEventListener("scroll", onScroll, { signal });
  // controller.abort() 한 번으로 둘 다 해제
}
```

`addEventListener`의 옵션 타입 `AddEventListenerOptions`에 `signal?: AbortSignal` 필드가 있어 그대로 들어맞는다. `removeEventListener`를 일일이 짝지어 부를 필요가 없어진다.

정리하면, `AbortController`는 `signal`(관찰용)과 `abort()`(발동용)로 권한을 나눈 취소 표준이다. 함수는 `signal?: AbortSignal`을 옵션으로 받고, 취소 에러는 `catch`에서 `e.name === "AbortError"`로 좁혀 구분한다. `AbortSignal.timeout`/`any`로 타임아웃과 다중 취소를, 이벤트 리스너 옵션의 `signal`로 자동 해제를 얻는다. 다음 글에서는 이렇게 만든 코드를 검증하는 테스트의 세계로 넘어가, Vitest와 Jest를 타이핑한다.

---

**지난 글:** [비동기 이터레이터 타이핑](/posts/ts-async-iterators/)

**다음 글:** [Vitest와 Jest 타이핑](/posts/ts-typing-vitest-jest/)

<br>
읽어주셔서 감사합니다. 😊
