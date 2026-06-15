---
title: "async/await와 Promise 타이핑 — 비동기 코드의 타입"
description: "TypeScript에서 Promise<T>의 타입, async 함수의 반환 타입 추론, await 언래핑, Promise.all과 Promise.allSettled의 타이핑까지 비동기 코드를 타입 안전하게 다루는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "async", "await", "Promise", "비동기", "타입추론"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-react/)에서 React 컴포넌트와 props에 타입을 주는 법을 다뤘다. 이번에는 거의 모든 실무 코드에 등장하는 **비동기 처리**를 TypeScript가 어떻게 타이핑하는지 살펴본다. `Promise`, `async`, `await`는 런타임 동작만 이해하면 충분하다고 여기기 쉽지만, 타입 관점에서 보면 "값을 미래에 담는 상자"를 어떻게 추론하고 풀어내는지가 핵심이다.

## Promise&lt;T&gt;는 미래의 값을 담는 타입

`Promise<T>`는 "언젠가 `T` 타입의 값으로 이행(resolve)될 비동기 작업"을 나타내는 제네릭 타입이다. `T`가 결과 값의 타입이다.

```typescript
const p1: Promise<number> = Promise.resolve(42);
const p2: Promise<string> = fetch("/api").then((r) => r.text());

// Promise<void> — 값 없이 완료만 알리는 경우
const p3: Promise<void> = saveLog();
```

중요한 점은 `Promise<T>`의 `T`에 직접 접근할 수 없다는 것이다. `p1.toFixed(2)` 같은 코드는 동작하지 않는다. `p1`은 `number`가 아니라 `number`를 **감싼** 상자이기 때문이다. 상자를 열어 값을 꺼내려면 `await` 또는 `.then()`이 필요하다.

![async/await 타입 흐름](/assets/posts/ts-typing-async-flow.svg)

## async 함수의 반환 타입은 항상 Promise로 래핑된다

`async` 키워드가 붙은 함수는 무엇을 반환하든 그 값이 `Promise`로 감싸진다. `return 1`을 해도 반환 타입은 `Promise<number>`가 된다.

```typescript
async function getUser(id: number): Promise<User> {
  const res = await fetch(`/users/${id}`);
  return res.json(); // User 형태를 반환한다고 가정
}

// 반환 타입을 생략하면 TypeScript가 추론한다
async function getCount() {
  return 10; // 추론 결과: Promise<number>
}
```

반환 타입 애너테이션에 `Promise<User>`라고 쓰면, 함수 본문에서 `User`를 반환해야 한다. 실수로 `Promise<Promise<User>>`처럼 이중으로 쓰면 오류가 난다. 또한 `async` 함수의 반환 타입을 직접 명시하면 본문이 의도한 타입을 반환하는지 컴파일러가 검증해 주므로, 공개 API에는 명시하는 편이 안전하다.

## await는 Promise를 언래핑한다

`await`는 `Promise<T>`에서 `T`를 꺼낸다. 이 언래핑 추론이 비동기 타이핑의 중심이다.

```typescript
const user = await getUser(1);
//    ^? User  — Promise가 벗겨진 상태

const users = await Promise.all([getUser(1), getUser(2)]);
//    ^? User[]  — 각 Promise의 결과가 배열로
```

`Promise.all`은 입력 튜플의 각 Promise를 언래핑해 결과 배열(정확히는 튜플)로 만든다. 서로 다른 타입을 섞어도 위치별로 정확히 추론된다.

```typescript
const [u, posts, ok] = await Promise.all([
  getUser(1),        // Promise<User>
  getPosts(),        // Promise<Post[]>
  ping(),            // Promise<boolean>
]);
// u: User, posts: Post[], ok: boolean
```

![Promise 반환과 await 추론](/assets/posts/ts-typing-async-code.svg)

## Promise.allSettled와 결과 판별

`Promise.allSettled`는 일부가 실패해도 전체를 기다린다. 결과는 `fulfilled` 또는 `rejected` 상태를 담은 객체의 유니온이다. `status` 필드로 좁혀서 사용한다.

```typescript
const results = await Promise.allSettled([getUser(1), getUser(2)]);

for (const r of results) {
  if (r.status === "fulfilled") {
    console.log(r.value); // User
  } else {
    console.error(r.reason); // 실패 사유
  }
}
```

`status`는 판별 유니온(discriminated union)의 태그 역할을 한다. `"fulfilled"`로 좁히면 `value`에, `"rejected"`로 좁히면 `reason`에 안전하게 접근할 수 있다.

## Awaited 유틸리티 타입

중첩된 Promise나 thenable을 깊이 언래핑한 타입이 필요할 때는 내장 유틸리티 `Awaited<T>`를 쓴다. `await`가 타입 수준에서 하는 일을 그대로 표현한다.

```typescript
type A = Awaited<Promise<string>>;          // string
type B = Awaited<Promise<Promise<number>>>; // number (재귀적으로 벗김)

// 함수의 비동기 반환 결과 타입만 뽑아내기
type UserResult = Awaited<ReturnType<typeof getUser>>; // User
```

`ReturnType<typeof fn>`은 `Promise<User>`까지만 주지만, `Awaited<...>`로 감싸면 최종 값 타입인 `User`를 얻는다. 라이브러리 타입을 다룰 때 자주 쓰이는 조합이다.

비동기 코드의 타입은 결국 "상자에 넣고(`async`/`Promise`) 다시 꺼내는(`await`/`Awaited`)" 한 쌍의 변환으로 정리된다. 이 구조만 손에 익히면 복잡한 비동기 흐름에서도 타입이 어디서 래핑되고 풀리는지 추적할 수 있다. 다음 글에서는 이 비동기 코드에서 빠질 수 없는 **에러 처리**를 타입 안전하게 다루는 법을 본다.

---

**지난 글:** [React 타이핑 시작 — 컴포넌트와 props의 타입](/posts/ts-typing-react/)

**다음 글:** [TypeScript 에러 핸들링 — unknown catch와 타입 안전한 예외 처리](/posts/ts-error-handling/)

<br>
읽어주셔서 감사합니다. 😊
