---
title: "런타임 환경 — 브라우저 · Node · Deno · Bun"
description: "JavaScript를 실행하는 네 가지 주요 런타임(브라우저, Node.js, Deno, Bun)의 아키텍처와 차이점, 그리고 각각의 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "Node.js", "Deno", "Bun", "런타임", "브라우저", "libuv"]
featured: false
draft: false
---

[지난 글](/posts/js-engines/)에서 V8·SpiderMonkey·JavaScriptCore라는 JS 엔진이 소스 코드를 파싱하고 JIT 컴파일로 실행한다는 것을 살펴봤습니다. 그런데 엔진 단독으로는 파일을 읽거나 네트워크 요청을 보낼 수 없습니다. 엔진에 그 능력을 부여하는 것이 바로 **런타임(runtime)**입니다.

## 엔진과 런타임의 차이

엔진은 JavaScript 코드를 해석·실행하는 핵심 부품입니다. 런타임은 엔진 위에 **외부 세계와 소통하는 API**를 얹은 완성된 실행 환경입니다.

```
런타임 = JS 엔진 + 환경 API + 이벤트 루프

브라우저 = V8/SpiderMonkey/JSC + DOM/fetch/localStorage + 브라우저 이벤트 루프
Node.js  = V8 + fs/http/crypto + libuv 이벤트 루프
Deno     = V8 + Web API/Deno.* + Tokio(Rust) 이벤트 루프
Bun      = JSC + Node 호환 API + Bun 네이티브 API
```

![런타임 환경 비교](/assets/posts/js-runtimes-comparison.svg)

## 브라우저 런타임

브라우저는 JavaScript의 원조 런타임입니다. 각 탭은 독립된 JavaScript 컨텍스트를 가지며, 엔진 외에 다음을 제공합니다:

- **DOM API**: `document.querySelector()`, `element.appendChild()` 등
- **Web API**: `fetch()`, `setTimeout()`, `requestAnimationFrame()`
- **저장소**: `localStorage`, `sessionStorage`, `IndexedDB`
- **Worker**: `WebWorker`, `ServiceWorker`

브라우저의 핵심 제약은 **샌드박스**입니다. 파일 시스템 접근이 불가능하고, 다른 사이트로의 요청은 CORS 정책의 제한을 받습니다. 이는 보안을 위한 의도된 설계입니다.

```javascript
// 브라우저에서만 작동
document.title = "Hello";          // DOM 조작
localStorage.setItem("key", "v");  // 브라우저 저장소
navigator.geolocation.getCurrentPosition(cb); // 위치 API

// 브라우저에서 실행 불가
const fs = require('fs');  // ReferenceError: require is not defined
```

## Node.js — 서버의 JavaScript

2009년 Ryan Dahl이 V8 엔진을 브라우저 밖으로 꺼내 파일 시스템, 네트워크와 연결한 것이 Node.js입니다. 핵심 아키텍처는 V8 + **libuv**입니다.

![Node.js 아키텍처](/assets/posts/js-runtimes-eventloop.svg)

**libuv**는 C로 작성된 비동기 I/O 라이브러리로, Node의 이벤트 루프를 구현합니다. 파일 읽기, 네트워크 요청 같은 I/O 작업을 논블로킹으로 처리하면서 JavaScript는 단일 스레드를 유지합니다.

```javascript
// Node.js에서 가능한 것들
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

// 파일 읽기
const content = await readFile('./data.json', 'utf-8');

// HTTP 서버
const server = createServer((req, res) => {
  res.end('Hello from Node!');
});
server.listen(3000);
```

Node는 두 가지 모듈 시스템을 지원합니다:
- **CommonJS(CJS)**: `require()` / `module.exports` (전통적 방식)
- **ESM**: `import` / `export` (현대적 방식, `.mjs` 또는 `"type": "module"`)

## Deno — Node.js의 후회를 담은 재설계

Ryan Dahl은 2018년 "Node.js에서 후회하는 10가지" 발표와 함께 Deno를 공개했습니다. Node의 설계 문제를 바로잡기 위한 재도전입니다.

주요 특징:

**1. 명시적 권한 시스템**

```bash
# 파일 읽기 권한 없이 실행하면 오류
deno run script.ts

# 명시적으로 권한 부여
deno run --allow-read --allow-net script.ts
```

악성 패키지가 파일 시스템이나 네트워크에 무단으로 접근하는 것을 방지합니다.

**2. TypeScript 네이티브 지원**

별도 빌드 설정 없이 `.ts` 파일을 직접 실행합니다.

```bash
deno run script.ts  # TypeScript 바로 실행
```

**3. Web API 호환**

`fetch`, `Request`, `Response`, `URL` 등 브라우저 Web API를 동일하게 사용합니다. 브라우저와 Deno 양쪽에서 실행되는 코드를 작성할 수 있습니다.

**4. URL 기반 임포트 (레거시)**

초기에는 npm 없이 URL로 모듈을 임포트했지만, 현재는 `deno.json`의 `imports` 맵과 npm 패키지도 지원합니다.

```typescript
// Deno — npm 패키지도 지원
import { z } from "npm:zod@3";
```

## Bun — 속도 우선의 올인원 도구

2022년 공개된 Bun은 "Node.js와 호환되면서 훨씬 빠른 런타임"을 목표로 합니다. JavaScriptCore를 엔진으로 선택하고, 전체를 Zig 언어로 작성했습니다.

```bash
# Node.js 대신 Bun으로 실행
bun run server.js

# 번들링
bun build ./src/index.ts --outdir ./dist

# 테스트
bun test

# 패키지 설치 (npm보다 빠름)
bun install
```

Bun의 핵심 장점:

| 기능 | Node.js | Bun |
|------|---------|-----|
| 런타임 | V8 + libuv | JSC + Zig |
| 번들러 | 별도 (Webpack/esbuild) | 내장 |
| 테스트 러너 | 별도 (Jest/Vitest) | 내장 |
| 패키지 관리 | npm/pnpm/yarn | 내장 (빠름) |
| TypeScript | ts-node / tsx | 내장 |
| 시작 속도 | 기준 | ~3~5배 빠름 |

Bun은 Node.js 호환성을 높이 두어 기존 Node 프로젝트 대부분을 변경 없이 실행할 수 있습니다.

## Edge 런타임 — 새로운 전선

Cloudflare Workers, Deno Deploy, Vercel Edge Functions 같은 **엣지 런타임**도 빠르게 성장하고 있습니다. 전 세계 CDN 서버에서 JavaScript를 실행하여 지연 시간을 최소화합니다.

엣지 런타임은 Node.js의 전체 API 대신 **제한된 Web API** 서브셋을 제공합니다. 이 때문에 Next.js의 `middleware.ts` 같은 경우 `edge` 런타임을 명시하면 `fs` 모듈 등을 사용할 수 없습니다.

## 무엇을 선택해야 할까

| 목적 | 추천 런타임 |
|------|------------|
| 웹 앱 프론트엔드 | 브라우저 (선택 여지 없음) |
| 백엔드 API 서버 | Node.js (생태계 최대) 또는 Bun (속도 우선) |
| CLI 도구 · 스크립팅 | Node.js 또는 Deno (TypeScript 선호) |
| 보안 중요 스크립팅 | Deno (권한 샌드박스) |
| 엣지/CDN 함수 | Cloudflare Workers / Deno Deploy |
| 빌드 도구 통합 | Bun (올인원) |

현재(2024 기준) Node.js가 생태계와 사용량에서 압도적이지만, Bun은 빠른 속도로 채택이 늘고 있습니다. Deno는 Deno 2.0에서 npm 호환성을 크게 강화하여 Node 대안으로서 경쟁력이 높아졌습니다.

---

**지난 글:** [JS 엔진 — V8 · SpiderMonkey · JavaScriptCore](/posts/js-engines/)

**다음 글:** [Strict mode와 sloppy mode](/posts/js-strict-mode/)

<br>
읽어주셔서 감사합니다. 😊
