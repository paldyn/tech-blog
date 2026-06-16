---
title: "fetch 타이핑 — Response와 unknown 기반 파싱"
description: "fetch API를 TypeScript로 안전하게 쓰는 법을 정리합니다. res.json()이 any를 반환하는 함정, 제네릭 단언의 위험, unknown 기반 타입 가드 래퍼, Result와 결합한 에러 처리, AbortController 타이핑까지 실무 관점으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "fetch", "Response", "unknown", "타입가드", "API"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-express/)에서 서버 쪽 Express 핸들러의 요청·응답 타이핑을 봤다. 이번 글은 그 반대편, 클라이언트가 서버에 요청을 보내는 `fetch`를 다룬다. `fetch`는 브라우저와 최신 Node 모두에서 표준이지만, 응답을 파싱하는 `res.json()`이 `any`를 반환한다는 결정적 약점이 있다. 시리즈에서 반복해 온 "외부 입력은 검증 전까지 신뢰하지 않는다"는 원칙을, 이번에는 네트워크 응답에 적용해 묶음을 마무리한다.

## res.json()은 any를 반환한다

`fetch`로 받은 `Response`의 `.json()` 메서드는 타입이 `Promise<any>`다. 파싱 결과에 무슨 짓을 해도 컴파일러가 막지 않는다.

```typescript
const res = await fetch("/api/user/1");
const user = await res.json(); // any
console.log(user.naem.toUpperCase()); // 오타·잘못된 형태 모두 통과
// 런타임에서야 터진다
```

`JSON.parse`와 똑같은 함정이다. 게다가 흔히 쓰는 제네릭 단언 `res.json() as User`나 `res.json<User>()` 같은 형태도 **런타임 검증 없는 거짓 안심**일 뿐이다. 서버가 다른 형태를 보내도 컴파일러는 만족한다.

```typescript
const user = (await res.json()) as User; // 검증 없는 단언 — 위험
```

![fetch 타이핑](/assets/posts/ts-typing-fetch-flow.svg)

## HTTP 상태부터 확인하기

또 하나 자주 빠뜨리는 점이 있다. `fetch`는 404·500 같은 HTTP 에러 응답에도 reject하지 않고 정상 resolve한다. `res.ok`를 직접 확인하지 않으면 에러 페이지의 본문을 데이터로 착각한다.

```typescript
const res = await fetch("/api/user/1");

if (!res.ok) {
  throw new Error(`HTTP ${res.status} ${res.statusText}`);
}
// 여기까지 와야 본문이 의미 있는 데이터다
```

`res.ok`는 상태 코드가 200~299일 때만 `true`다. 네트워크 실패(연결 끊김 등)는 reject로, HTTP 에러는 `res.ok === false`로 갈린다는 점을 기억해야 두 경우를 모두 처리할 수 있다.

## unknown 기반 검증 래퍼

견고한 해법은 `res.json()`을 `unknown`으로 받아, 타입 가드로 검증한 뒤에만 원하는 타입으로 좁히는 래퍼를 만드는 것이다.

```typescript
async function getJson<T>(
  url: string,
  guard: (value: unknown) => value is T,
): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data: unknown = await res.json(); // any 대신 unknown으로 받음
  if (!guard(data)) throw new Error("응답 형태가 예상과 다릅니다");

  return data; // 가드 통과 — T로 좁혀짐
}
```

`getJson`은 타입 가드를 인자로 받아, 응답이 실제로 `T` 형태일 때만 그 값을 돌려준다. 검증을 통과하지 못한 응답은 데이터로 흘러나가지 못한다. 호출부는 작은 가드 하나만 넘기면 된다.

```typescript
function isUser(v: unknown): v is User {
  return typeof v === "object" && v !== null && "id" in v;
}

const user = await getJson("/api/user/1", isUser); // User, 검증됨
```

![fetch 응답 안전 파싱](/assets/posts/ts-typing-fetch-code.svg)

## Result와 결합해 실패를 값으로

이 시리즈 앞부분에서 본 `Result`와 묶으면, 네트워크·HTTP·형태 불일치라는 세 가지 실패를 하나의 값으로 통합할 수 있다. 호출부는 `try/catch` 없이 `ok`만 확인한다.

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const value = await getJson(`/api/user/${id}`, isUser);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "요청 실패" };
  }
}

const r = await fetchUser("1");
if (r.ok) render(r.value);
else toast(r.error);
```

세 종류의 실패가 하나의 `Result`로 모이고, `r.ok`를 확인해야만 값에 접근할 수 있으니 에러 처리를 잊을 수 없다.

## AbortController로 취소 타이핑

마지막으로 요청 취소다. `fetch`의 `signal` 옵션에는 `AbortController`의 `signal`을 넘기며, 둘 다 `lib.dom`/`@types/node`에 타입이 선언돼 있어 추가 설정 없이 안전하게 쓸 수 있다.

```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 5000);

try {
  const res = await fetch("/api/slow", { signal: controller.signal });
  return await res.json();
} catch (e) {
  if (e instanceof DOMException && e.name === "AbortError") {
    console.log("요청 시간 초과로 취소됨");
  }
  throw e;
} finally {
  clearTimeout(timer);
}
```

취소되면 `fetch`는 `AbortError`라는 `DOMException`으로 reject된다. `e.name`으로 좁혀 취소와 다른 실패를 구분한다.

정리하면, 안전한 `fetch`의 핵심은 ① `res.ok`로 HTTP 상태를 먼저 확인하고 ② `res.json()`을 `unknown`으로 받아 타입 가드로 검증하며 ③ `Result`로 실패를 값으로 통합하고 ④ `AbortController`로 취소까지 타이핑하는 것이다. 이번 묶음에서 다룬 `Result`·상태 머신·DI·환경 변수·Node 코어·HTTP·Express·fetch는 모두 "신뢰할 수 없는 입력과 외부 세계를 타입으로 길들인다"는 한 줄로 이어진다. 타입은 단지 오타를 잡는 도구가 아니라, 시스템 경계에서 잘못된 데이터가 도메인 로직에 침투하지 못하게 막는 가드레일이다.

---

**지난 글:** [Express 타이핑 — Request 제네릭과 미들웨어](/posts/ts-typing-express/)

<br>
읽어주셔서 감사합니다. 😊
