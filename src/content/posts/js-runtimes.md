---
title: "런타임 환경 — 브라우저·Node·Deno·Bun의 차이"
description: "JavaScript 엔진 위에서 실행 환경을 완성하는 '런타임'이 무엇인지, 브라우저·Node.js·Deno·Bun·Edge 런타임이 어떻게 다른지 깊이 있게 비교합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "nodejs", "deno", "bun", "runtime", "browser", "eventloop", "libuv"]
featured: false
draft: false
---

## 엔진과 런타임 — 무엇이 다른가

지난 글에서 JavaScript 엔진(V8, SpiderMonkey, JavaScriptCore)이 코드를 파싱하고 최적화해 실행하는 과정을 살펴봤습니다. 그런데 아무리 좋은 엔진이 있어도 파일을 읽거나, HTTP 요청을 보내거나, DOM을 조작하는 것은 엔진 혼자 할 수 없습니다.

**런타임(Runtime)**은 엔진 위에 이런 기능들을 제공하는 환경입니다.

```text
┌─────────────────────────────────────────┐
│  런타임 (Runtime)                        │
│  ┌─────────────────────────────────┐    │
│  │  JS 엔진 (V8 / JSC / SM)        │    │
│  └─────────────────────────────────┘    │
│  + API (DOM, fetch, fs, process...)     │
│  + 이벤트 루프 구현                      │
│  + 가비지 컬렉터 통합                    │
└─────────────────────────────────────────┘
```

같은 V8 엔진을 써도 Chrome과 Node.js는 전혀 다른 API를 제공합니다. Chrome은 DOM을 조작할 수 있지만 파일시스템에 직접 접근할 수 없습니다. Node.js는 그 반대입니다.

---

## 브라우저 런타임

브라우저는 JavaScript의 원래 서식지입니다. V8(Chrome), SpiderMonkey(Firefox), JavaScriptCore(Safari) 각각의 엔진 위에, 브라우저마다 독자적인 런타임이 쌓여 있습니다.

![런타임 환경 비교](/assets/posts/js-runtimes-overview.svg)

### 브라우저가 제공하는 API

브라우저 런타임의 핵심은 웹 페이지와 상호작용하기 위한 API들입니다.

**DOM/CSSOM**: HTML 문서를 트리 구조로 접근·조작합니다. `document.querySelector`, `element.addEventListener` 같은 API가 여기 속합니다.

**BOM (Browser Object Model)**: 브라우저 자체와 상호작용합니다. `window`, `navigator`, `location`, `history` 등입니다.

**Web APIs**: 시간이 지나면서 브라우저에 추가된 다양한 API들입니다.

```javascript
// 브라우저에서만 가능한 API들
const data = localStorage.getItem('token');

const response = await fetch('https://api.example.com/data');
const json = await response.json();

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.fillRect(0, 0, 100, 100);

navigator.geolocation.getCurrentPosition(pos => {
  console.log(pos.coords.latitude);
});
```

### 브라우저 보안 샌드박스

브라우저 런타임의 가장 큰 특징은 **보안 샌드박스**입니다. 임의로 다운로드한 웹 페이지의 JavaScript가 내 컴퓨터 파일을 읽거나, 카메라를 켜거나, 다른 사이트에 요청을 보내는 것은 위험합니다.

브라우저는 이를 막기 위해:
- **파일시스템 직접 접근 불가** — File System Access API는 사용자 동의 필요
- **CORS**: 다른 출처(origin)의 리소스 요청 제한
- **Same-Origin Policy**: 다른 도메인의 쿠키·로컬스토리지 접근 불가
- **Permission API**: 카메라·마이크·위치 등 민감한 자원에 명시적 허가 필요

---

## Node.js 런타임

2009년 라이언 달이 만든 Node.js는 V8 엔진을 서버에서 실행할 수 있게 했습니다. 브라우저의 제약을 벗어나 파일시스템, 네트워크, 프로세스 등 OS 수준의 기능에 접근합니다.

### libuv — Node.js의 심장

Node.js가 비동기 I/O를 처리하는 핵심은 **libuv** 라이브러리입니다. C로 작성된 libuv는 운영체제마다 다른 비동기 I/O 메커니즘(Linux의 epoll, macOS의 kqueue, Windows의 IOCP)을 추상화합니다.

```javascript
// Node.js에서만 가능한 API들
import { readFile } = from 'fs/promises';

const content = await readFile('./config.json', 'utf-8');
const config = JSON.parse(content);

import { createServer } from 'http';

createServer((req, res) => {
  res.end('Hello, Node.js!');
}).listen(3000);

console.log(process.env.NODE_ENV);
console.log(process.argv);
```

### 이벤트 루프의 차이

브라우저와 Node.js 모두 이벤트 루프를 사용하지만, 구조가 다릅니다.

![이벤트 루프 비교](/assets/posts/js-runtimes-eventloop.svg)

Node.js의 이벤트 루프는 libuv가 관리하며 **6단계(phase)**로 구성됩니다. 각 단계는 특정 종류의 콜백을 처리합니다.

```javascript
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));

// 출력 순서:
// nextTick    ← 현재 단계 끝, 다음 단계 전에 실행
// promise     ← 마이크로태스크
// timeout     ← timers 단계
// immediate   ← check 단계 (I/O 콜백 내에서는 timeout보다 먼저)
```

`process.nextTick`은 Node.js에서만 존재하며, Promise 마이크로태스크보다도 먼저 실행됩니다. 이 차이를 모르면 예상치 못한 순서로 코드가 실행될 수 있습니다.

---

## Deno — Node.js를 다시 설계하다

2018년 Ryan Dahl은 JSConf에서 "Node.js에 대해 후회하는 10가지"를 발표하며 **Deno**를 공개했습니다. Node.js 설계의 실수를 반성하고 처음부터 다시 만든 런타임입니다.

### Deno의 핵심 철학

**보안 우선**: Deno는 기본적으로 파일시스템, 네트워크, 환경 변수 등 모든 리소스 접근을 차단합니다. 필요한 권한을 명시적으로 허가해야 합니다.

```bash
# 네트워크 접근 허가
deno run --allow-net server.ts

# 파일 읽기만 허가
deno run --allow-read=./data script.ts

# 모든 권한 허가 (Node.js와 유사)
deno run --allow-all script.ts
```

**TypeScript 네이티브**: 별도 설정 없이 `.ts` 파일을 직접 실행합니다.

```bash
deno run script.ts  # tsc 설치 불필요
```

**ES Module 우선**: `require()` 대신 ES Module을 기본으로 합니다. URL로 직접 패키지를 가져올 수 있고, node_modules 폴더가 없습니다.

```typescript
// URL import (npm 없이)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// npm 호환 (Deno 1.28+)
import express from "npm:express@4";
```

**Web 표준 API**: 브라우저와 같은 API를 서버에서도 사용합니다. `fetch`, `Blob`, `ReadableStream`, `URL`, `crypto` 등이 전역 객체로 내장됩니다.

---

## Bun — 속도에 집착한 올인원 도구

2022년 공개된 **Bun**은 다른 방향의 도전입니다. JavaScriptCore 엔진과 Zig 언어로 작성한 극한의 성능을 추구합니다.

### Bun이 하나로 합친 것들

Node.js 생태계는 역할별로 도구가 분산돼 있습니다:

```text
Node.js 생태계:
실행: node
패키지 관리: npm / pnpm / yarn
번들러: webpack / vite / rollup
테스트: jest / vitest
트랜스파일러: babel / swc / esbuild

Bun 하나로:
bun run script.ts      # 실행 (TypeScript 포함)
bun install            # 패키지 관리
bun build ./index.ts   # 번들링
bun test               # 테스트
```

### 성능 벤치마크

Bun의 공식 벤치마크에 따르면:
- HTTP 서버 처리량: Node.js 대비 ~4배
- `bun install`: npm 대비 ~25배 빠름
- 파일 I/O: Node.js 대비 빠른 경우가 많음

이 수치는 항상 재현되지 않으며 벤치마크 방법에 따라 다르지만, Bun이 특히 **시작 시간**과 **패키지 설치 속도**에서 큰 이점을 보이는 것은 사실입니다.

### Node.js 호환성

Bun은 Node.js API 대부분을 지원합니다. 기존 Node.js 프로젝트를 큰 수정 없이 Bun으로 실행할 수 있는 경우가 많습니다.

```bash
bun run server.js  # Node.js 코드를 Bun으로 실행
```

다만 네이티브 Node.js 애드온(`node-gyp` 빌드)이나 일부 내부 API는 호환되지 않을 수 있습니다.

---

## Edge 런타임 — 사용자 옆에서 실행

**Cloudflare Workers**, **Vercel Edge Functions**, **Deno Deploy** 같은 서비스는 전 세계 수백 개의 데이터센터 엣지 서버에서 JavaScript를 실행합니다.

### V8 Isolate 기반

Edge 런타임은 각 요청을 **V8 Isolate**라는 초경량 컨텍스트에서 실행합니다. 완전한 Node.js 프로세스를 띄우는 것과 달리, Isolate는 메모리와 시작 시간을 최소화합니다.

```javascript
// Cloudflare Workers 예시
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/hello') {
      return new Response(JSON.stringify({ message: 'Hello!' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

콜드 스타트가 ~1ms 수준으로 매우 빠릅니다. 하지만 실행 시간 제한(대부분 수십~수백ms), 메모리 제한, 파일시스템 없음, Node.js API 미지원 등의 제약이 있습니다.

---

## 어떤 런타임을 선택할까

| 상황 | 권장 런타임 |
|---|---|
| 웹 앱 UI 개발 | 브라우저 (선택 불가) |
| 서버 API / 마이크로서비스 | Node.js (안정성·생태계) |
| 빠른 스크립트 / 빌드 도구 | Bun (속도) |
| 보안 중요 / TypeScript 중심 | Deno |
| 글로벌 저레이턴시 API | Cloudflare Workers |
| 서버리스 함수 | Vercel Edge / AWS Lambda@Edge |

Node.js는 여전히 가장 큰 생태계와 가장 많은 레퍼런스를 가집니다. Deno와 Bun은 모두 Node.js 호환성을 강화하면서 자신만의 강점을 키우고 있습니다. 세 런타임이 수렴하는 부분도 있고, 서로 다른 방향을 추구하는 부분도 있습니다.

---

## 정리

런타임은 JavaScript 엔진 위에 쌓인 실행 환경입니다. 같은 V8 엔진이라도 브라우저는 DOM을, Node.js는 파일시스템을 제공합니다. Deno는 보안과 Web 표준을, Bun은 극한의 성능을 추구하며 새로운 선택지를 제시했습니다. Edge 런타임은 JS를 전 세계 엣지 서버에서 실행하는 새로운 패러다임을 열었습니다.

다음 파트에서는 JavaScript 언어 자체로 들어가 **변수 선언 방식** — `var`, `let`, `const`의 차이와 각각의 동작 원리를 살펴봅니다.

---

**다음 글:** var·let·const 차이 — 호이스팅, 스코프, TDZ

<br>
읽어주셔서 감사합니다. 😊
