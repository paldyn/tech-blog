---
title: "Promise 깊이 타이핑하기"
description: "Promise를 TypeScript로 깊이 있게 타이핑하는 법을 정리합니다. Promise<T>의 의미와 then 체이닝의 타입 흐름, 자동 평탄화, Promise.all·allSettled·race·any의 반환 타입 차이, Awaited 유틸리티, reject가 타입에 잡히지 않는 한계와 대응까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "Promise", "비동기", "Awaited", "PromiseAll", "타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-react-generic-components/)로 React 묶음을 마무리했다. 이번에는 비동기로 돌아와, 시리즈 앞부분 [async/await 글](/posts/ts-typing-async/)에서 가볍게 다뤘던 `Promise`를 타입 관점에서 깊게 파고든다. `Promise<T>`는 단순해 보이지만 `then` 체이닝의 타입 흐름, 자동 평탄화, 조합 함수들의 반환 타입, 그리고 "reject는 타입에 잡히지 않는다"는 근본적 한계까지 알아둘 게 꽤 있다.

## Promise<T>의 T는 "성공 값"이다

`Promise<T>`의 `T`는 그 Promise가 **성공적으로 resolve될 때의 값** 타입이다. 실패(reject) 값은 이 타입에 들어가지 않는다 — 이 비대칭이 나중에 중요한 한계로 이어진다. 우선 성공 경로의 타입 흐름부터 보자.

```typescript
function fetchUser(id: number): Promise<User> {
  return fetch(`/api/user/${id}`).then((r) => r.json() as Promise<User>);
}

const p: Promise<User> = fetchUser(1);
```

`fetchUser`의 반환 타입을 `Promise<User>`로 선언하면, 이 Promise를 `await`한 값은 `User`다. `async` 함수라면 반환 타입을 명시하지 않아도 본문에서 `return`하는 값으로부터 `Promise<T>`가 추론된다.

## then 체이닝과 자동 평탄화

`then`의 핵심은 **콜백이 반환한 값이 다음 단계의 입력 타입이 된다**는 점이다. 그리고 콜백이 또 다른 Promise를 반환하면, TypeScript는 `Promise<Promise<T>>`로 중첩시키지 않고 `Promise<T>`로 평탄화한다.

```typescript
fetchUser(1)
  .then((user) => user.id) // user: User → number 반환
  .then((id) => fetchPosts(id)) // id: number → Promise<Post[]> 반환
  .then((posts) => posts.length); // posts: Post[] (평탄화됨!)
```

두 번째 `then`이 `Promise<Post[]>`를 반환했는데, 세 번째 `then`의 인자는 `Promise<Post[]>`가 아니라 `Post[]`다. 중첩 Promise가 자동으로 펼쳐지기 때문이다. 이 평탄화 동작이 타입으로도 정확히 반영된다.

![then 체이닝과 타입 흐름](/assets/posts/ts-typing-promise-deep-chain.svg)

이 덕분에 `await`도 한 겹만 벗긴다. `await fetchUser(1)`은 `User`이고, 설령 `Promise<Promise<User>>`가 있어도 `await` 한 번에 `User`로 풀린다.

## Awaited<T> — 평탄화를 타입으로

이 "Promise를 벗긴 타입"을 직접 얻고 싶을 때 쓰는 게 [Awaited 유틸리티](/posts/ts-awaited-utility/)다. `Awaited<T>`는 `T`가 Promise면 그 안의 타입을, 중첩 Promise면 끝까지 벗긴 타입을 준다.

```typescript
type A = Awaited<Promise<User>>; // User
type B = Awaited<Promise<Promise<number>>>; // number
type C = Awaited<string>; // string (Promise 아니면 그대로)

// 함수 반환값에서 성공 타입 추출
type UserResult = Awaited<ReturnType<typeof fetchUser>>; // User
```

`ReturnType`과 `Awaited`를 조합하면 "이 비동기 함수가 결국 무슨 값을 주는가"를 타입으로 뽑아낼 수 있다. API 함수의 결과 타입을 재사용할 때 유용하다.

## Promise 조합 함수의 반환 타입

여러 Promise를 동시에 다룰 때 쓰는 조합 함수들은 입력 배열의 타입을 결과 타입으로 정교하게 매핑한다. 각각의 차이를 타입 관점에서 정리하자.

![Promise 조합 함수의 반환 타입](/assets/posts/ts-typing-promise-deep-combinators.svg)

`Promise.all`은 입력을 튜플로 받아 결과도 튜플로 돌려준다. 서로 다른 타입의 Promise를 섞어도 위치마다 타입이 보존된다.

```typescript
const [user, posts, count] = await Promise.all([
  fetchUser(1), // Promise<User>
  fetchPosts(1), // Promise<Post[]>
  fetchCount(), // Promise<number>
]);
// user: User, posts: Post[], count: number — 튜플로 정확히 매핑
```

하나라도 reject되면 전체가 reject된다. 반면 `Promise.allSettled`는 모든 결과를 기다리되, 각 항목을 `PromiseSettledResult<T>`로 감싼다. `status`로 좁혀야 값에 접근할 수 있다.

```typescript
const results = await Promise.allSettled([fetchUser(1), fetchUser(2)]);
for (const r of results) {
  if (r.status === "fulfilled") {
    console.log(r.value); // User
  } else {
    console.error(r.reason); // 실패 이유
  }
}
```

`r.status === "fulfilled"`로 좁히면 `r.value`에, `"rejected"`면 `r.reason`에 접근할 수 있다. [판별 유니온](/posts/ts-discriminated-union/)이 또 등장한다. `Promise.race`와 `Promise.any`는 입력들의 유니온 타입(`A | B`)을 반환하는데, `race`는 가장 먼저 끝난 것(성공이든 실패든), `any`는 가장 먼저 성공한 것을 준다.

## reject는 타입에 잡히지 않는다

마지막으로 가장 중요한 한계. `Promise<T>`의 타입에는 **reject 값의 타입이 없다.** `catch`로 받는 에러는 항상 `unknown`(혹은 옛 설정에선 `any`)이다. TypeScript는 어떤 함수가 무엇을 throw하는지 추적하지 않기 때문이다.

```typescript
try {
  const user = await fetchUser(1);
} catch (e) {
  // e: unknown — 무슨 타입인지 컴파일러는 모른다
  if (e instanceof Error) {
    console.error(e.message); // 좁힌 뒤에야 안전
  }
}
```

이 비대칭 때문에 [에러 처리 글](/posts/ts-error-handling/)에서 본 것처럼, 실패를 타입으로 다루고 싶다면 throw 대신 [Result 타입](/posts/ts-result-either-type/)을 반환하는 패턴이 대안으로 쓰인다. `Promise<Result<User, ApiError>>`처럼 실패까지 성공 타입 안에 담으면, `catch`의 `unknown`을 피하고 컴파일러가 양쪽 경로를 모두 검사하게 만들 수 있다.

정리하면, `Promise<T>`의 `T`는 성공 값이고 `then`은 그 값을 다음 단계로 흘리며 중첩을 자동 평탄화한다. `Awaited`로 그 타입을 추출하고, `all`/`allSettled`/`race`/`any`는 각기 다른 반환 타입을 가진다. 단 reject는 타입에 잡히지 않으므로 `catch`는 `unknown`에서 시작한다. 다음 글에서는 값을 하나씩 비동기로 흘려보내는 비동기 이터레이터를 타이핑한다.

---

**지난 글:** [제네릭 컴포넌트 만들기](/posts/ts-react-generic-components/)

**다음 글:** [비동기 이터레이터 타이핑](/posts/ts-async-iterators/)

<br>
읽어주셔서 감사합니다. 😊
