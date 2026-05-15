---
title: "Bun · JSC 기반 런타임과 내장 번들러"
description: "Bun의 JavaScriptCore 엔진 선택 이유, Zig 구현의 성능 특성, 내장 번들러·트랜스파일러·패키지 매니저·테스트 러너를 하나로 묶은 올인원 도구체인을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["Bun", "JavaScriptCore", "번들러", "런타임", "Zig", "패키지매니저"]
featured: false
draft: false
---

[지난 글](/posts/deno-security-stdlib/)에서 Deno의 보안 모델과 JSR 표준 라이브러리를 살펴봤다. 이번에는 JavaScript 런타임 경쟁의 또 다른 축인 **Bun**을 다룬다. Bun은 Jarred Sumner가 2022년에 발표한 런타임으로, "Node.js의 빠른 대안"을 목표로 하지만 실제로는 런타임에 번들러·트랜스파일러·패키지 매니저·테스트 러너까지 통합한 올인원 도구체인이다.

## JavaScriptCore를 택한 이유

Bun이 V8 대신 **JavaScriptCore(JSC)**를 선택한 이유는 성능 특성에 있다. JSC는 Apple이 Safari를 위해 개발한 엔진으로, V8과 비교해 다음 특징이 있다.

- **낮은 메모리 사용량**: V8의 히든 클래스 최적화보다 메모리 효율적
- **빠른 스타트업**: JIT 컴파일 전략이 달라 콜드 스타트가 빠름
- **인터프리터 레이어**: LLInt(Low Level Interpreter)가 JIT 없이도 합리적 성능 제공

V8의 Turbofan이 장시간 실행 서버 프로세스에 강하다면, JSC는 CLI 도구나 빌드 스크립트처럼 짧고 빠르게 종료되는 프로세스에 유리하다.

![Bun 아키텍처 — JSC 기반 런타임](/assets/posts/bun-jsc-bundler-architecture.svg)

## Zig로 구현된 이유

Bun의 런타임 코어와 HTTP 서버, 파일 시스템 바인딩은 **Zig**로 작성되었다. Zig는 C와 동등한 성능을 내면서 메모리 안전성 추론 도구와 컴파일타임 반영(comptime)을 제공하는 시스템 언어다. Node.js(C++), Deno(Rust)와 다른 선택이다.

Zig가 선택된 실질적 이유는 C 라이브러리와의 통합이 극도로 쉽다는 점이다. Bun은 내부적으로 `uWebSockets.js`, `boringssl`, `libarchive` 등 C/C++ 라이브러리를 직접 링크하는데, Zig의 C ABI 지원이 이를 자연스럽게 해준다.

## Node.js 호환성

Bun의 핵심 가치 제안 중 하나는 **기존 Node.js 코드가 수정 없이 동작**하는 것이다. `package.json`, `node_modules`, CommonJS `require()`, npm 레지스트리를 그대로 지원한다.

```bash
# 기존 Node.js 프로젝트를 그대로 실행
bun install          # npm install 대체 (속도 10~25x)
bun run dev          # npm run dev 대체
bun index.ts         # ts-node 없이 TypeScript 직접 실행
```

특히 `bun install`은 lockfile 형식(bun.lockb)이 바이너리라서 파싱 비용이 없고, 글로벌 캐시를 하드링크로 재사용하기 때문에 디스크 사용량도 절약된다.

## 내장 번들러 — bun build

Bun의 번들러는 esbuild에서 영감을 받아 처음부터 새로 구현되었다. TypeScript, JSX, TSX를 별도 설정 없이 처리하며, 트리 쉐이킹과 코드 스플리팅을 지원한다.

![Bun 빌드 파이프라인](/assets/posts/bun-jsc-bundler-pipeline.svg)

```typescript
// 번들러 JavaScript API
const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "./dist",
  target: "browser",   // "bun" | "node" | "browser"
  format: "esm",       // "cjs" | "esm" | "iife"
  minify: true,
  sourcemap: "external",
  splitting: true,     // 코드 스플리팅 활성화
  external: ["react"], // 번들에 포함하지 않을 패키지
});

if (!result.success) {
  console.error(result.logs);
}
```

`target: "browser"`로 설정하면 브라우저 환경에서 실행 가능한 번들을, `target: "bun"`으로 설정하면 Bun 런타임에 최적화된 번들을 생성한다.

## 내장 테스트 러너

```typescript
// sum.test.ts — bun test로 실행
import { expect, test, describe, beforeEach } from "bun:test";
import { sum } from "./sum";

describe("sum", () => {
  test("두 수의 합", () => {
    expect(sum(1, 2)).toBe(3);
  });

  test("음수 처리", () => {
    expect(sum(-1, -2)).toBe(-3);
  });
});
```

`bun test`는 Jest 호환 API(`expect`, `describe`, `test`, `mock`)를 내장한다. 별도 설정 파일 없이 `*.test.ts` 패턴을 자동으로 찾아 실행한다.

## 내장 HTTP 서버 — Bun.serve

```typescript
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response("OK");
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
```

`Bun.serve`는 Fetch API의 `Request`/`Response` 인터페이스를 그대로 사용하기 때문에 Edge Runtime(Cloudflare Workers, Vercel Edge)과 코드를 공유하기 쉽다.

## Bun Shell — 크로스 플랫폼 셸 스크립트

```typescript
import { $ } from "bun";

// Windows/macOS/Linux 동일하게 동작하는 셸 스크립트
const result = await $`ls src/*.ts`.text();
console.log(result);

// 파이프라인
const count = await $`cat package.json | grep -c "bun"`.text();
```

Bun Shell(`$` 템플릿 태그)은 bash 없이 크로스 플랫폼 셸 스크립트를 작성할 수 있게 해준다. Windows에서도 동일한 명령이 동작한다.

## 성능 비교 관점

Bun 팀이 공개한 벤치마크는 Node.js 대비 HTTP 처리 속도 2~4배, `bun install` 10~25배 빠름을 보여주지만, 실제 애플리케이션에서의 차이는 코드 특성에 따라 달라진다. V8의 Turbofan JIT가 장시간 구동 후에는 JSC를 앞서는 경우도 있어, **CPU 집약적 서버 프로세스**보다는 **CLI 도구, 빌드 스크립트, 엣지 함수**에서 Bun의 이점이 두드러진다.

---

**지난 글:** [Deno 보안 모델과 표준 라이브러리](/posts/deno-security-stdlib/)

**다음 글:** [Cloudflare Workers와 workerd 런타임](/posts/workerd-cloudflare/)

<br>
읽어주셔서 감사합니다. 😊
