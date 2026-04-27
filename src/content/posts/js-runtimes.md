---
title: "런타임 환경 (브라우저 · Node · Deno · Bun)"
description: "JavaScript 엔진과 런타임의 차이를 명확히 하고, 브라우저·Node.js·Deno·Bun 각 런타임이 어떻게 다르며 언제 무엇을 선택해야 하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "nodejs", "deno", "bun", "런타임", "브라우저", "v8"]
featured: false
draft: false
---

지난 [JS 엔진 (V8 · SpiderMonkey · JavaScriptCore)](/posts/js-engines/) 글에서 JavaScript 코드가 엔진 안에서 어떻게 파싱되고 JIT 컴파일되는지 살펴봤습니다. 그런데 같은 V8 엔진을 써도 Chrome과 Node.js에서 사용할 수 있는 API가 전혀 다릅니다. 브라우저에서는 `window`와 `document`가 있고, Node.js에서는 `fs`와 `http`가 있습니다. 이 차이는 어디서 오는 걸까요? 그것이 바로 **런타임 환경**의 차이입니다.

## 런타임 = 엔진 + 추가 레이어

엔진은 JavaScript 코드 자체를 해석하고 실행하는 핵심 부품입니다. 하지만 실제 애플리케이션이 작동하려면 엔진만으로는 부족합니다. 파일을 읽고, 네트워크 요청을 보내고, 화면에 그림을 그리는 능력이 필요합니다. 이런 기능들은 엔진 바깥, 즉 **런타임 환경**이 제공합니다.

요리에 비유하면 엔진은 요리사의 요리 기술(언어 능력 자체)이고, 런타임은 어떤 재료(API)와 도구(환경)를 제공하느냐입니다. 같은 기술을 가진 요리사도 한국 주방과 이탈리아 주방에서 만들 수 있는 요리가 다릅니다.

![런타임 구성 레이어](/assets/posts/js-runtimes-layers.svg)

## 브라우저 런타임

브라우저는 가장 오래되고 가장 넓은 JavaScript 런타임입니다.

**제공하는 것들:**

- **DOM API**: `document.querySelector()`, `element.appendChild()` 등 HTML 조작
- **Web APIs**: `fetch`, `setTimeout`, `requestAnimationFrame`, `WebSocket`, `localStorage`, `IndexedDB`, `Web Workers`
- **이벤트 시스템**: 클릭·입력·스크롤 이벤트를 처리하는 이벤트 루프
- **렌더링 파이프라인**: JavaScript 실행과 CSS 적용, 화면 그리기를 조율

**제공하지 않는 것들:**

- 파일 시스템 접근 (`fs.readFile` 같은 API 없음) — 보안 샌드박스
- OS 수준의 프로세스 생성, 소켓 서버, 원시 네트워크 제어

브라우저는 신뢰할 수 없는 원격 코드를 실행하는 환경이므로, 파일 시스템 접근을 기본적으로 차단합니다. 이것이 바로 브라우저에서 실행되는 JS가 여러분의 로컬 파일을 맘대로 읽지 못하는 이유입니다.

## Node.js

2009년 Ryan Dahl이 V8 엔진을 꺼내 만든 서버 사이드 런타임입니다.

**핵심 구성 요소:**

- **libuv**: Node.js의 심장. I/O 작업을 비동기적으로 처리하는 이벤트 루프 구현체
- **V8**: JavaScript 실행
- **Node.js Core APIs**: `fs`, `http`, `https`, `path`, `os`, `crypto`, `stream`, `worker_threads`, `cluster` 등

```javascript
// Node.js에서만 동작하는 코드
import { readFileSync } from 'node:fs';

const content = readFileSync('./package.json', 'utf-8');
const pkg = JSON.parse(content);
console.log(pkg.name);
```

Node.js의 가장 큰 강점은 **npm 생태계**입니다. 200만 개가 넘는 패키지가 npm에 등록되어 있어 거의 모든 문제에 대해 검증된 라이브러리를 찾을 수 있습니다.

**버전 선택**: Node.js에는 LTS(Long-Term Support)와 Current 두 트랙이 있습니다. 프로덕션 서버에는 LTS를 권장합니다. 짝수 번호(18, 20, 22)가 LTS가 됩니다.

## Deno

Ryan Dahl이 Node.js를 만든 후 "내가 후회하는 Node.js의 10가지"라는 발표를 한 뒤 만든 런타임입니다. Node.js 설계에서 아쉬웠던 점을 고치는 것이 목표였습니다.

**Deno의 차별점:**

**1. 보안 모델**: 기본적으로 모든 접근이 차단됩니다. 파일을 읽으려면 `--allow-read`, 네트워크를 쓰려면 `--allow-net` 플래그를 명시해야 합니다. 프로그램이 불필요한 권한을 갖지 않도록 강제하는 것입니다.

```bash
# Deno는 권한을 명시적으로 요청
deno run --allow-read --allow-net server.ts
```

**2. TypeScript 기본 지원**: 별도 설치나 설정 없이 `.ts` 파일을 바로 실행할 수 있습니다.

**3. Web API 호환**: 브라우저의 `fetch`, `Blob`, `FormData` 등을 그대로 제공합니다. 한 번 배운 API가 브라우저와 서버에서 동일하게 동작합니다.

**4. URL 기반 모듈 (초기)**: 초기에는 npm 없이 URL로 모듈을 가져왔지만, Deno v2부터 npm 호환성을 갖춰 기존 생태계를 활용할 수 있게 됐습니다.

## Bun

2023년 정식 출시된 Bun은 "올인원 JavaScript 툴킷"을 표방합니다.

**Bun의 특징:**

**1. JavaScriptCore 엔진**: V8 대신 Apple의 JavaScriptCore를 씁니다. Zig 언어로 작성된 네이티브 코드와 결합해 매우 빠른 시작 속도를 달성합니다.

**2. 통합 번들러·테스트러너**: 별도로 webpack, Jest를 설치하지 않아도 됩니다. `bun build`, `bun test` 명령이 기본으로 내장되어 있습니다.

**3. Node.js 호환**: Node.js API를 대부분 구현해 기존 Node.js 프로젝트를 큰 수정 없이 실행할 수 있습니다.

**4. TypeScript 기본 지원**: Deno처럼 별도 설정 없이 `.ts` 파일을 직접 실행합니다.

```bash
# Bun으로 TypeScript 파일 직접 실행
bun run server.ts

# 번들러·테스트러너 내장
bun build ./src/index.ts --outdir ./dist
bun test
```

## 런타임 비교 한눈에 보기

![JS 런타임 환경 비교](/assets/posts/js-runtimes-comparison.svg)

## 어떤 런타임을 선택해야 할까

**브라우저**: 선택의 여지가 없습니다. 웹 프런트엔드라면 사용자의 브라우저 환경이 런타임입니다.

**Node.js**: 가장 안전한 선택. 성숙한 생태계, 풍부한 레퍼런스, 대부분의 클라우드·PaaS 서비스에서 1등급 지원. 팀의 숙련도가 Node.js에 있다면 그냥 Node.js를 쓰세요.

**Deno**: 보안이 중요한 서버, 스크립트 자동화, Deno Deploy(엣지 컴퓨팅) 사용 시 고려. TypeScript를 네이티브로 쓰고 싶은 경우에도 좋습니다.

**Bun**: 빠른 빌드·테스트 시간이 필요하거나, 새 프로젝트에서 올인원 툴킷을 원할 때. Node.js 마이그레이션 용이성 덕분에 기존 코드베이스에도 점진적으로 도입할 수 있습니다.

## 요약

런타임 환경은 엔진이 무엇을 할 수 있는가가 아니라 **무엇을 쓸 수 있게 해주는가**를 결정합니다. 브라우저는 DOM과 Web API를, Node.js는 파일 시스템과 서버 API를, Deno는 보안과 표준화를, Bun은 속도와 통합 도구를 강점으로 내세웁니다.

다음 Part II에서는 JavaScript 언어 자체로 들어가 **변수 선언과 데이터 타입**부터 차근차근 살펴봅니다. `var`, `let`, `const`의 차이와 호이스팅, TDZ 같은 핵심 개념이 기다립니다.

---

**지난 글:** [JS 엔진 (V8 · SpiderMonkey · JavaScriptCore)](/posts/js-engines/)

<br>
읽어주셔서 감사합니다. 😊
