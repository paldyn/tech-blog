---
title: "런타임 환경 — 브라우저 · Node · Deno · Bun"
description: "JavaScript 런타임이란 무엇인지, 브라우저·Node.js·Deno·Bun이 각각 어떤 API와 설계 철학을 가지는지, 그리고 어떤 상황에서 무엇을 선택해야 하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "runtime", "nodejs", "deno", "bun", "browser"]
featured: false
draft: false
---

[지난 글](/posts/js-engines/)에서 V8, SpiderMonkey, JavaScriptCore가 소스 코드를 기계어로 변환하는 파이프라인을 살펴봤습니다. 그런데 엔진만으로는 파일을 읽거나, HTTP 요청을 보내거나, DOM을 조작할 수 없습니다. 이런 기능들을 제공하는 것이 바로 **런타임(Runtime)**입니다.

## 런타임 = 엔진 + 환경 API + 이벤트 루프

JavaScript 엔진은 ECMAScript 명세에 정의된 언어 문법만 처리합니다. 그 외 `fetch`, `setTimeout`, `document`, `fs.readFile` 같은 기능은 런타임이 별도로 제공하는 **Host API**입니다.

런타임의 세 가지 구성 요소를 정리하면 이렇습니다.

**JS 엔진**: ECMAScript를 실행합니다. 어느 런타임이든 이 역할은 V8, JSC 같은 엔진이 담당합니다.

**Host API**: 각 환경이 제공하는 기능 집합입니다. 브라우저는 DOM, Web Crypto, Geolocation 등을 제공하고, Node.js는 파일시스템, 네트워크, 프로세스 제어 등을 제공합니다.

**이벤트 루프**: 비동기 작업(타이머, 네트워크 응답, 파일 I/O)의 콜백을 JS 엔진에 순차적으로 전달하는 조율자입니다. 싱글 스레드인 JS가 동시에 여러 작업을 "처리하는 것처럼" 느껴지게 해주는 핵심 메커니즘입니다.

![JavaScript 런타임 아키텍처](/assets/posts/js-runtimes-architecture.svg)

## 브라우저: JS의 원래 집

브라우저 런타임은 JavaScript의 발상지이자 여전히 가장 광범위하게 쓰이는 환경입니다. HTML 문서와 CSS, 사용자 입력, 네트워크 요청을 모두 다루어야 하기 때문에 제공하는 API 범위가 넓습니다.

브라우저가 제공하는 핵심 API들:

- **DOM API**: `document.querySelector`, `createElement`, `addEventListener` 등으로 HTML 문서를 조작합니다.
- **BOM API**: `window`, `location`, `history`, `navigator`로 브라우저 자체를 제어합니다.
- **Fetch API**: HTTP 요청을 Promise 기반으로 처리합니다.
- **Web Storage**: `localStorage`, `sessionStorage`로 클라이언트 측 데이터를 저장합니다.
- **Web Workers**: 별도 스레드에서 JS를 실행해 메인 스레드를 블로킹하지 않게 합니다.

브라우저 환경의 가장 중요한 특징은 **보안 샌드박스**입니다. 사용자가 방문한 웹사이트가 로컬 파일을 마음대로 읽거나 운영체제 명령을 실행할 수 없도록, 브라우저는 JS 코드를 엄격히 제한합니다. 파일 시스템 접근은 File API를 통해 사용자가 명시적으로 허용해야만 가능합니다.

## Node.js: JS를 서버로

2009년 Ryan Dahl이 발표한 Node.js는 V8 엔진에 libuv(비동기 I/O 라이브러리)를 결합해 JavaScript를 서버에서 실행할 수 있게 했습니다. 2024년 기준으로 서버사이드 JavaScript의 사실상 표준입니다.

Node.js는 브라우저에 없는 다음 기능들을 제공합니다.

```javascript
// 파일 시스템 접근
const fs = require('fs/promises');
const data = await fs.readFile('./config.json', 'utf8');

// HTTP 서버 생성
const http = require('http');
http.createServer((req, res) => {
  res.end('Hello World');
}).listen(3000);

// 자식 프로세스 실행
const { execSync } = require('child_process');
const result = execSync('git status', { encoding: 'utf8' });
```

Node.js의 이벤트 루프는 libuv가 담당합니다. 파일 I/O, 네트워크, 타이머 등의 비동기 작업을 운영체제 수준에서 효율적으로 처리하며, 완료된 작업의 콜백을 JS 엔진에 전달합니다.

**CommonJS(CJS) 모듈 시스템**이 Node.js의 기본이었으나, 현재는 ESM(ES Modules)도 완전히 지원합니다. `package.json`의 `"type": "module"` 설정이나 `.mjs` 확장자를 사용하면 ESM을 쓸 수 있습니다.

## Deno: 안전과 모던함을 재설계

Ryan Dahl은 Node.js를 만든 지 10년 후인 2018년, Node.js의 후회스러운 설계 결정들을 고백하며 Deno를 발표합니다. `node_modules`의 복잡성, CommonJS 우선 설계, 보안 모델 부재 등을 보완하고자 했습니다.

Deno의 핵심 철학은 다음과 같습니다.

**명시적 보안 권한**: Deno의 코드는 기본적으로 파일, 네트워크, 환경 변수에 접근할 수 없습니다. 필요한 권한을 실행 시 명시적으로 부여해야 합니다.

```bash
# 네트워크 접근만 허용
deno run --allow-net server.ts

# 특정 디렉터리만 읽기 허용
deno run --allow-read=/tmp script.ts
```

**TypeScript 네이티브 지원**: 별도의 컴파일러 없이 `.ts` 파일을 직접 실행합니다.

**Web API 우선**: `fetch`, `Request`, `Response`, `URL`, `crypto`같은 Web Standard API를 기본으로 내장해, 브라우저와 코드를 공유하기 쉽게 설계됐습니다.

**URL 기반 import**: `node_modules` 없이 URL로 직접 모듈을 가져올 수 있습니다. 다만 이 방식의 재현성 문제로 현재는 `deno.json`의 imports 맵을 통한 관리를 권장합니다.

```typescript
// Deno의 URL import
import { assertEquals } from 'https://deno.land/std/assert/mod.ts';
```

Deno 2.0(2024)에서는 npm 패키지 호환성이 크게 개선되어 `npm:` 접두사로 npm 패키지를 직접 사용할 수 있게 됐습니다.

## Bun: 올인원 툴체인

2022년 등장한 Bun은 **속도**에 집착한 런타임입니다. V8 대신 **JavaScriptCore**를 엔진으로 사용하며, 핵심 코드를 Zig 언어로 작성해 Node.js보다 훨씬 빠른 시작 속도와 I/O 성능을 달성했습니다.

더 중요한 것은 Bun이 **번들러, 테스트 러너, 패키지 매니저를 모두 내장**한다는 점입니다. Node.js 생태계에서는 webpack/vite(번들러), jest/vitest(테스트), npm/pnpm(패키지 관리)를 따로 설치해야 했지만, Bun은 이 모두를 하나로 통합합니다.

```bash
# Bun으로 할 수 있는 것들
bun run server.ts          # TypeScript 직접 실행
bun test                   # 테스트 실행
bun build ./src/index.ts   # 번들링
bun add react              # 패키지 설치 (npm보다 빠름)
```

Bun은 Node.js 호환성을 최우선 목표로 삼아, 대부분의 npm 패키지와 Node.js API가 그대로 동작합니다. 기존 Node.js 프로젝트를 `node` 대신 `bun`으로 실행하는 것만으로도 성능 이점을 얻을 수 있는 경우가 많습니다.

![서버사이드 런타임 비교](/assets/posts/js-runtimes-comparison.svg)

## 어떤 런타임을 선택해야 할까

**Node.js**: 팀이 이미 익숙하고, npm 생태계 의존성이 많고, 프로덕션 안정성이 최우선이라면 Node.js가 여전히 최선입니다. 방대한 레퍼런스와 커뮤니티가 강점입니다.

**Deno**: 보안이 민감한 스크립팅 환경이나, TypeScript 퍼스트 워크플로우를 원하고, Web Standard API를 선호한다면 Deno가 좋은 선택입니다.

**Bun**: 빌드 속도와 실행 성능이 중요하고, 도구 통합을 단순화하고 싶다면 Bun이 매력적입니다. CI/CD 파이프라인에서 설치 속도가 중요한 경우 특히 유리합니다.

## 엣지 런타임

한 가지 더 언급할 환경이 있습니다. Cloudflare Workers, Vercel Edge Functions, Deno Deploy 같은 **엣지 컴퓨팅** 플랫폼도 JavaScript를 실행합니다. 이 환경들은 전 세계 CDN 노드에서 코드를 실행해 지연 시간을 최소화합니다.

엣지 런타임은 Node.js API 대신 **Web Standard API**만 지원하는 경우가 많습니다. `fetch`, `Request`, `Response`, `crypto`, `URL`은 지원하지만 `fs`, `child_process`는 사용할 수 없습니다. Deno가 Web API를 우선시하는 것도 이 엣지 환경과의 호환성을 염두에 둔 설계입니다.

---

**지난 글:** [JS 엔진 — V8 · SpiderMonkey · JavaScriptCore](/posts/js-engines/)

**다음 글:** [Strict mode와 sloppy mode](/posts/js-strict-mode/)

<br>
읽어주셔서 감사합니다. 😊
