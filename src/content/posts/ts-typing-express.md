---
title: "Express 타이핑 — Request 제네릭과 미들웨어"
description: "Express를 TypeScript로 타입 안전하게 쓰는 법을 정리합니다. Request의 4개 제네릭(Params, ResBody, ReqBody, Query), RequestHandler 타입, 미들웨어의 타입 전파, req 객체 보강, 비동기 핸들러 에러 처리까지 실무 관점으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 9
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "Express", "Request", "미들웨어", "제네릭", "웹서버"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-http-handlers/)에서 프레임워크에 의존하지 않고 핸들러의 입출력을 제네릭으로 묶는 원리를 봤다. 이번 글은 그 원리가 가장 널리 쓰이는 프레임워크 Express에서 어떻게 구체화되는지 본다. `@types/express`가 제공하는 `Request` 타입은 네 개의 제네릭을 받는데, 이 순서를 모르면 잘못 채워 본문과 쿼리 타입이 엉키기 쉽다. 제네릭의 의미와 미들웨어로의 타입 전파를 정리한다.

## Request의 네 가지 제네릭

`@types/express`의 `Request`는 `Request<Params, ResBody, ReqBody, Query>` 순서로 네 제네릭을 받는다. 순서를 외워 두는 것이 핵심이다.

```typescript
import type { Request, Response } from "express";

// Request<Params, ResBody, ReqBody, ReqQuery>
type Req = Request<
  { id: string },        // 1) 경로 파라미터 (:id)
  unknown,               // 2) 응답 본문 타입 (보통 Response 쪽에서 지정)
  { name: string },      // 3) 요청 본문 (req.body)
  { page?: string }      // 4) 쿼리 스트링 (req.query)
>;
```

네 자리의 의미는 차례로 경로 파라미터, 응답 본문, 요청 본문, 쿼리다. 두 번째 자리(`ResBody`)는 잘 안 쓰여 `unknown`으로 두고, 응답 타입은 `Response<T>` 쪽에서 지정하는 경우가 많다. 자리를 헷갈려 본문 타입을 쿼리 자리에 넣는 실수가 흔하니 주의한다.

![Express 제네릭](/assets/posts/ts-typing-express-flow.svg)

## 라우트 핸들러에 타입 입히기

제네릭을 채운 `Request`를 핸들러에 쓰면, `req.params`·`req.body`·`req.query`가 모두 정확한 타입으로 좁혀진다.

```typescript
import express, { type Request, type Response } from "express";

const app = express();
app.use(express.json());

interface Params { id: string }
interface Body { name: string }

app.put(
  "/users/:id",
  (req: Request<Params, unknown, Body>, res: Response) => {
    const id = req.params.id;    // string
    const name = req.body.name;  // string — 타입 보장
    res.json({ id, name });
  },
);
```

`req.params.id`와 `req.body.name`이 IDE 자동완성에 뜨고, 없는 필드를 읽으면 컴파일 에러가 난다. 다만 `req.body`의 타입은 런타임 검증이 아니라 **개발자의 선언**이므로, 앞 글에서 본 것처럼 실제로는 스키마 검증을 함께 거는 것이 안전하다.

![Request 제네릭 4개 인자](/assets/posts/ts-typing-express-code.svg)

## RequestHandler로 재사용

핸들러를 변수로 분리할 때는 `RequestHandler` 타입을 쓰면 제네릭을 한 번에 채울 수 있다. 인라인으로 `req`·`res`·`next`를 일일이 타이핑하지 않아도 된다.

```typescript
import type { RequestHandler } from "express";

// RequestHandler<Params, ResBody, ReqBody, ReqQuery>
const updateUser: RequestHandler<Params, unknown, Body> = (req, res) => {
  res.json({ id: req.params.id, name: req.body.name });
};

app.put("/users/:id", updateUser);
```

`updateUser`의 `req`, `res`, `next`가 모두 자동으로 타입을 갖는다. 이렇게 분리해 두면 테스트하기도, 여러 라우트에서 재사용하기도 쉽다.

## 미들웨어로 req 보강하기

미들웨어가 인증된 사용자를 `req`에 붙이는 패턴은 매우 흔하다. 이때 `Request`에 필드를 추가하려면 Express 타입을 **선언 보강**한다.

```typescript
// types/express.d.ts
import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: string };
  }
}
```

이렇게 전역 보강하면, 모든 핸들러에서 `req.user`에 타입 안전하게 접근할 수 있다.

```typescript
const auth: RequestHandler = (req, res, next) => {
  req.user = { id: "1", role: "admin" }; // 보강 덕분에 타입 OK
  next();
};

app.get("/me", auth, (req, res) => {
  res.json({ role: req.user?.role }); // user?: {...} 로 인식
});
```

보강된 `user`가 옵셔널(`?`)인 이유는, 인증 미들웨어를 거치지 않은 라우트에서는 존재하지 않기 때문이다. 옵셔널 체이닝으로 그 가능성을 다루게 강제하는 것이 정직한 타이핑이다.

## 비동기 핸들러의 에러

Express 4의 핸들러는 `Promise`를 자동으로 처리하지 못한다. async 핸들러에서 던진 에러가 잡히지 않으므로, 래퍼로 감싸 `next`에 흘려보낸다.

```typescript
const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

app.get("/users", asyncHandler(async (req, res) => {
  const users = await db.findAll(); // 던진 에러가 next로 전달됨
  res.json(users);
}));
```

`asyncHandler`는 핸들러의 반환값을 `Promise.resolve`로 감싸 `.catch(next)`로 에러를 에러 핸들러에 넘긴다. 타입 시그니처가 `RequestHandler`를 그대로 유지하므로 라우팅 코드는 바뀌지 않는다. (Express 5부터는 비동기 에러를 자동 처리한다.)

정리하면, Express 타이핑의 핵심은 ① `Request`의 네 제네릭(Params·ResBody·ReqBody·Query) 순서를 정확히 채우고 ② `RequestHandler`로 재사용하며 ③ `req` 확장은 선언 보강으로 안전하게 하고 ④ async 에러는 래퍼로 처리하는 것이다. 다음 글에서는 서버를 떠나 클라이언트 쪽 외부 입력의 대표주자, `fetch`의 타이핑을 본다.

---

**지난 글:** [HTTP 핸들러 타이핑 — 요청·응답에 타입 입히기](/posts/ts-typing-http-handlers/)

**다음 글:** [fetch 타이핑 — Response와 unknown 기반 파싱](/posts/ts-typing-fetch/)

<br>
읽어주셔서 감사합니다. 😊
