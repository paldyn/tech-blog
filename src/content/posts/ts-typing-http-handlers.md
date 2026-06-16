---
title: "HTTP 핸들러 타이핑 — 요청·응답에 타입 입히기"
description: "프레임워크에 의존하지 않고 HTTP 핸들러의 요청 본문과 응답을 제네릭으로 타이핑하는 법을 정리합니다. 본문은 unknown으로 받아 검증, 응답은 직렬화 가능한 타입으로 제약, 핸들러 시그니처로 입출력 계약을 고정하는 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 8
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "HTTP", "핸들러", "제네릭", "API", "검증"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-fs-path/)에서 옵션 인자가 반환 타입을 바꾸는 오버로드 패턴을 봤다. 이번 글은 같은 발상을 웹 서버로 가져온다. HTTP 핸들러는 요청을 받아 응답을 돌려주는 함수다. 문제는 요청 본문이 외부 입력이라 `unknown`이고, 응답은 직렬화 가능한 형태여야 한다는 점이다. 특정 프레임워크에 들어가기 전에, 핸들러의 입력·출력을 제네릭으로 묶는 보편 원리를 먼저 정리한다.

## 요청 본문은 신뢰할 수 없다

날것의 Node `http` 모듈에서 요청 본문은 바이트 스트림이다. 파싱한 뒤에도 그 내용이 우리가 기대하는 형태라는 보장은 전혀 없다.

```typescript
import { createServer } from "node:http";

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const data = JSON.parse(body); // any — 외부 입력인데 검증 없음
    save(data.userId);             // 형태가 틀려도 통과
    res.end("ok");
  });
});
```

`JSON.parse(body)`는 `any`를 반환하고, 그 본문이 클라이언트가 보낸 임의의 데이터라는 사실을 타입이 전혀 반영하지 못한다. 핸들러의 입력을 정직하게 모델링하려면 본문을 `unknown`으로 두고 검증을 강제해야 한다.

![HTTP 핸들러 타이핑](/assets/posts/ts-typing-http-handlers-flow.svg)

## 핸들러를 제네릭으로 정의

핸들러의 입력 본문 타입 `Body`와 응답 타입 `Res`를 제네릭으로 묶으면, 시그니처 하나에 입출력 계약이 박힌다.

```typescript
interface TypedRequest<Body> {
  body: Body;
  params: Record<string, string>;
}

interface TypedResponse<Res> {
  json(data: Res): void;
  status(code: number): TypedResponse<Res>;
}

type Handler<Body, Res> = (
  req: TypedRequest<Body>,
  res: TypedResponse<Res>,
) => void | Promise<void>;
```

`Handler<Body, Res>`는 "이 본문을 받아 이 응답을 돌려준다"는 계약이다. `res.json`이 `Res`만 받으므로, 핸들러가 약속과 다른 형태를 응답하면 컴파일 에러가 난다.

![요청·응답을 제네릭으로 묶기](/assets/posts/ts-typing-http-handlers-code.svg)

## 본문은 unknown으로 받아 검증

본문 타입을 곧장 `Body`로 신뢰하면 결국 거짓말이다. 실무에서는 본문을 `unknown`으로 받아 스키마로 검증한 뒤에야 `Body`로 좁힌다. 이를 핸들러를 감싸는 고차 함수로 만들면 깔끔하다.

```typescript
import { z, type ZodType } from "zod";

function withBody<Body, Res>(
  schema: ZodType<Body>,
  handler: Handler<Body, Res>,
): Handler<unknown, Res> {
  return async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "잘못된 요청" } as Res);
      return;
    }
    await handler({ ...req, body: parsed.data }, res);
  };
}
```

`withBody`는 바깥에서 보면 `unknown` 본문을 받는 핸들러지만, 검증을 통과한 뒤 안쪽 핸들러에는 정확히 `Body` 타입의 본문을 넘긴다. 검증 실패는 400으로 끊기므로, 도메인 로직에는 항상 올바른 형태만 도달한다.

## 응답 타입으로 직렬화 보장

응답 타입 `Res`에 제약을 걸면, 직렬화할 수 없는 값(함수, `undefined`, 순환 참조 등)을 응답으로 보내는 실수도 줄일 수 있다.

```typescript
type Jsonable =
  | string | number | boolean | null
  | Jsonable[]
  | { [k: string]: Jsonable };

type SafeHandler<Body, Res extends Jsonable> = Handler<Body, Res>;

const createUser: SafeHandler<{ name: string }, { id: number }> =
  (req, res) => {
    const id = save(req.body.name); // body.name: string 보장
    res.json({ id });               // { id: number } 만 허용
  };
```

`Res extends Jsonable` 제약으로 응답이 JSON 직렬화 가능한 형태임을 강제한다. 핸들러를 정의하는 순간 입력 본문과 출력 응답의 형태가 모두 타입으로 고정되므로, 라우트가 늘어나도 각 핸들러가 자기 계약을 어길 수 없다.

정리하면, 프레임워크 독립적인 HTTP 핸들러 타이핑의 핵심은 ① 본문을 `unknown`으로 정직하게 받고 ② 핸들러를 입력·출력 제네릭으로 묶으며 ③ 검증을 통과한 뒤에만 본문을 좁히고 ④ 응답을 직렬화 가능 타입으로 제약하는 것이다. 다음 글에서는 이 원리가 실제 프레임워크인 Express에서 `Request` 제네릭과 미들웨어로 어떻게 구체화되는지 본다.

---

**지난 글:** [fs / path 타이핑 — 파일 시스템 API 안전하게](/posts/ts-typing-fs-path/)

**다음 글:** [Express 타이핑 — Request 제네릭과 미들웨어](/posts/ts-typing-express/)

<br>
읽어주셔서 감사합니다. 😊
