---
title: "Cloudflare Workers와 workerd 런타임"
description: "Cloudflare Workers의 핵심 런타임인 workerd의 V8 Isolate 격리 모델, 엣지 실행 아키텍처, KV·D1·R2 스토리지 바인딩, Durable Objects, 로컬 개발 환경까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["Cloudflare Workers", "workerd", "엣지컴퓨팅", "V8Isolate", "서버리스", "KV"]
featured: false
draft: false
---

[지난 글](/posts/bun-jsc-bundler/)에서 Bun의 JSC 기반 아키텍처를 살펴봤다. 이번에는 JavaScript 런타임의 또 다른 영역인 **엣지 컴퓨팅**을 다룬다. Cloudflare Workers는 전 세계 300개 이상의 PoP(Point of Presence)에서 코드를 실행하는 서버리스 플랫폼이며, 이를 구동하는 오픈소스 런타임이 바로 **workerd**다.

## workerd — 오픈소스 엣지 런타임

workerd는 2022년 Cloudflare가 오픈소스로 공개한 Workers 런타임이다. V8 위에 C++로 구현되었으며, 핵심 설계 원칙은 **V8 Isolate를 격리 단위로 사용**하는 것이다.

기존 서버리스 플랫폼은 Lambda처럼 각 함수를 별도 컨테이너나 OS 프로세스로 격리한다. 이 방식은 안전하지만 콜드 스타트에 수백 밀리초가 소요된다. workerd는 대신 V8의 `Isolate` 객체를 활용한다.

![workerd — V8 Isolate 기반 격리 모델](/assets/posts/workerd-cloudflare-isolation.svg)

V8 Isolate는 독립적인 JavaScript 힙과 실행 컨텍스트를 가지며, 서로 다른 Isolate는 메모리를 공유하지 않는다. OS 프로세스를 만들지 않으므로 생성 비용이 극도로 낮고, Cloudflare는 이를 활용해 **1ms 미만의 콜드 스타트**를 달성한다.

## 런타임 제약 — 의도된 설계

Workers 환경은 일부 Node.js API가 없거나 제한된다. 이는 버그가 아니라 보안·예측 가능성을 위한 의도된 설계다.

```javascript
// Workers에서 사용 불가 — 블로킹 I/O 없음
const fs = require("fs");       // ❌
const child = require("child_process"); // ❌

// Workers에서 사용 가능 — 비동기 Web API
const res = await fetch("https://api.example.com"); // ✅
const cache = await caches.open("v1");              // ✅
crypto.getRandomValues(new Uint8Array(16));          // ✅

// 실행 시간 제한
// CPU 시간 기준 10ms (무료 플랜), 30s (유료 플랜)
// 실제 벽시계 시간은 더 길게 허용
```

이러한 제약이 있는 대신, Workers는 전 세계 최근접 서버에서 실행되므로 사용자 요청에 대한 레이턴시가 매우 낮다.

## fetch 핸들러 — Workers의 진입점

```typescript
// src/worker.ts
export interface Env {
  KV:   KVNamespace;
  DB:   D1Database;
  R2:   R2Bucket;
  API_KEY: string; // wrangler.toml secrets
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleAPI(request, env);
    }

    // 배경 작업 — 응답 후에도 계속 실행
    ctx.waitUntil(logRequest(request, env));

    return new Response("Hello Workers!", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};
```

`ExecutionContext.waitUntil()`은 응답을 먼저 반환한 뒤 비동기 작업(로깅, 캐시 갱신 등)을 계속 실행할 수 있게 해준다.

## 스토리지 바인딩

Workers는 자체 스토리지 서비스와 `env` 객체를 통해 연결된다.

![Cloudflare Worker 요청 처리 흐름](/assets/posts/workerd-cloudflare-request.svg)

```typescript
// KV — 글로벌 엣지 Key-Value 스토어
const value = await env.KV.get("user:123");
await env.KV.put("user:123", JSON.stringify(data), {
  expirationTtl: 3600, // TTL (초)
});

// D1 — SQLite 기반 관계형 DB
const stmt = env.DB.prepare(
  "SELECT * FROM users WHERE id = ?"
);
const user = await stmt.bind(userId).first();

// R2 — S3 호환 객체 스토리지
const obj = await env.R2.get("images/photo.jpg");
if (obj) {
  return new Response(obj.body, {
    headers: { "Content-Type": obj.httpMetadata?.contentType ?? "image/jpeg" },
  });
}
```

KV는 글로벌 최종 일관성(eventual consistency)이고, D1은 단일 리전에서 강한 일관성을 제공한다. 사용 목적에 따라 선택한다.

## Durable Objects — 상태 있는 엣지 컴퓨팅

일반 Workers는 요청 간 상태를 공유하지 않는다. **Durable Objects**는 특정 ID에 고정된 단일 Isolate로, 상태와 로직을 함께 갖는 객체를 엣지에서 실행할 수 있게 한다.

```typescript
export class ChatRoom implements DurableObject {
  private connections: Set<WebSocket> = new Set();

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    this.connections.add(pair[1]);
    pair[1].accept();

    pair[1].addEventListener("message", (evt) => {
      // 같은 방에 연결된 모든 클라이언트에게 브로드캐스트
      for (const ws of this.connections) {
        ws.send(evt.data);
      }
    });

    return new Response(null, { status: 101, webSocket: pair[0] });
  }
}
```

Durable Objects는 실시간 협업 도구, 게임 서버, 분산 잠금 같은 상태 공유 시나리오에 활용된다.

## 로컬 개발 — Wrangler

```bash
# 프로젝트 초기화
npx wrangler init my-worker

# 로컬 개발 서버 (workerd 사용)
npx wrangler dev

# 배포
npx wrangler deploy

# KV 네임스페이스 생성
npx wrangler kv:namespace create MY_KV
```

`wrangler dev`는 실제 workerd를 로컬에서 실행하므로 프로덕션 환경과 동일한 제약과 동작을 테스트할 수 있다.

## wrangler.toml 설정

```toml
name       = "my-worker"
main       = "src/worker.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding  = "KV"
id       = "abc123"

[[d1_databases]]
binding  = "DB"
database_name = "my-db"
database_id   = "def456"

[vars]
ENVIRONMENT = "production"
```

`compatibility_date`는 런타임 동작의 버전 고정을 위한 필드다. 날짜를 올리면 새로운 기능과 변경 사항이 적용된다.

---

**지난 글:** [Bun · JSC 기반 런타임과 내장 번들러](/posts/bun-jsc-bundler/)

**다음 글:** [TypeScript 핵심 · 왜 타입이 필요한가](/posts/ts-essence/)

<br>
읽어주셔서 감사합니다. 😊
