---
title: "JavaScript 런타임 — Node.js, Deno, Bun, Workers 비교"
description: "Node.js부터 Deno, Bun, Cloudflare Workers까지 주요 JavaScript 런타임의 아키텍처, 철학, 적합한 사용 시나리오를 비교 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["Node.js", "Deno", "Bun", "런타임", "서버사이드"]
featured: false
draft: false
---

[지난 글](/posts/js-engines/)에서 V8 같은 JavaScript 엔진이 코드를 어떻게 파싱하고 최적화하는지 살펴보았습니다. 엔진이 "언어의 핵심 실행 기계"라면, **런타임**은 엔진 위에 파일 시스템·네트워크·타이머 등의 API를 얹어 실제 애플리케이션을 만들 수 있게 해주는 환경입니다. 오늘은 서버 사이드 JavaScript의 네 가지 주요 런타임을 비교합니다.

## 런타임이란 무엇인가

브라우저도 일종의 런타임입니다 — V8(또는 JSC) 위에 DOM, Fetch API, localStorage 등을 제공합니다. 서버 사이드 런타임은 같은 아이디어를 서버 환경에 적용한 것입니다. ECMAScript 표준 API 외에 파일 I/O, HTTP 서버, 암호화, 프로세스 관리 같은 시스템 수준 API를 노출합니다.

![Node.js 런타임 아키텍처](/assets/posts/js-runtimes-architecture.svg)

Node.js를 예로 들면, V8이 JS 코드를 실행하고 **libuv**가 비동기 I/O와 이벤트 루프를 담당합니다. 이 두 레이어 위에 Node.js Core APIs(`fs`, `http`, `path` 등)가 얹혀 개발자가 사용하는 인터페이스를 형성합니다.

## 런타임 비교

![JavaScript 런타임 비교](/assets/posts/js-runtimes-comparison.svg)

### Node.js (2009)

가장 먼저 등장한 서버 사이드 JS 런타임입니다. Ryan Dahl이 V8과 libuv를 결합해 만들었습니다. 지금도 가장 광범위한 생태계(npm)와 사용자 기반을 보유합니다.

```javascript
// Node.js — CJS와 ESM 모두 지원
// package.json "type": "module" 설정 시 ESM
import { readFile } from 'node:fs/promises';

const data = await readFile('./config.json', 'utf-8');
console.log(JSON.parse(data));
```

주요 특징: npm 생태계, CommonJS(CJS) 및 ESM 지원, `node:` 프리픽스로 내장 모듈 임포트, 거대한 커뮤니티.

### Deno (2020)

Node.js를 만든 Ryan Dahl이 Node.js의 설계 결함을 수정하겠다는 목표로 만든 런타임입니다. TypeScript와 ESM을 기본 지원하고, **권한 기반 보안 모델**을 채택합니다.

```typescript
// Deno — TypeScript 파일 직접 실행
// 실행: deno run --allow-net --allow-read server.ts
const server = Deno.serve({ port: 8000 }, (req) => {
  return new Response('Hello from Deno!');
});
```

권한 모델은 명시적 허가 없이는 파일·네트워크·환경 변수에 접근할 수 없습니다. `--allow-read`, `--allow-net` 같은 플래그로 필요한 권한만 부여합니다. JSR(JavaScript Registry)이라는 새 패키지 레지스트리도 운영합니다.

### Bun (2022)

JavaScriptCore(JSC) 엔진 기반으로 성능에 집중한 올인원 툴킷입니다. 런타임뿐 아니라 번들러, 테스트 러너, 패키지 매니저까지 내장합니다.

```typescript
// Bun — Node.js와 거의 호환되는 API
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello from Bun!');
  },
});
console.log(`Listening on port ${server.port}`);
```

Bun의 핵심 가치는 속도입니다. `bun install`은 npm보다 빠르고, TypeScript를 트랜스파일 없이 직접 실행합니다. Node.js 호환성을 목표로 하기 때문에 대부분의 npm 패키지가 동작합니다.

### Cloudflare Workers (2017)

V8 엔진의 **V8 Isolates** 기반 엣지 컴퓨팅 플랫폼입니다. 전통적인 Node.js 런타임이 아니라 **workerd**라는 별도 런타임을 사용합니다.

```typescript
// Cloudflare Workers
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    return new Response(`Path: ${url.pathname}`);
  },
} satisfies ExportedHandler;
```

Node.js API를 사용할 수 없고 Web API 표준(Fetch, SubtleCrypto, Streams)만 사용합니다. 콜드 스타트가 거의 없고 전 세계 엣지에 배포되어 레이턴시가 낮습니다. 단, 메모리와 CPU 시간에 엄격한 제한이 있습니다.

## 어떤 런타임을 선택해야 하나

| 상황 | 추천 런타임 |
|------|------------|
| 기존 Node.js 프로젝트 유지 | Node.js |
| 새 프로젝트, TypeScript 선호 | Deno 또는 Bun |
| 빠른 빌드/테스트 도구 | Bun |
| 글로벌 엣지 API 서버 | Cloudflare Workers |
| Next.js / Remix 등 프레임워크 | Node.js 또는 Bun |

대부분의 기업 프로젝트는 여전히 Node.js를 기반으로 합니다. 생태계 성숙도와 레퍼런스가 압도적이기 때문입니다. 하지만 새 프로젝트라면 Bun의 속도나 Deno의 보안 모델을 적극적으로 검토할 만합니다.

```bash
# 런타임별 Hello World 실행
node --version && node -e "console.log('Hello Node.js')"
deno --version && deno eval "console.log('Hello Deno')"
bun --version && bun -e "console.log('Hello Bun')"
```

---

**지난 글:** [JavaScript 엔진 — V8은 코드를 어떻게 실행하는가](/posts/js-engines/)

**다음 글:** [strict mode — 안전한 JavaScript의 시작](/posts/js-strict-mode/)

<br>
읽어주셔서 감사합니다. 😊
