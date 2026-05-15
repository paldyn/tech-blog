---
title: "Deno 보안 모델과 표준 라이브러리"
description: "Deno의 기본 차단 보안 모델, 권한 플래그 시스템, JSR 기반 @std 표준 라이브러리 활용법을 완전히 정리합니다. --allow-* 플래그 조합, Deno.permissions API, deno.json 설정, 주요 @std 모듈까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["Deno", "보안", "권한모델", "표준라이브러리", "JSR", "런타임"]
featured: false
draft: false
---

[지난 글](/posts/node-modules-hoisting/)에서 Node.js의 `node_modules` 호이스팅과 패키지 해석 알고리즘을 살펴봤다. 이번에는 Node.js와 전혀 다른 철학으로 설계된 **Deno**를 다룬다. Deno는 Ryan Dahl이 Node.js의 설계 실수를 반성하며 2018년에 발표한 런타임으로, V8 위에 Rust로 구현되어 있다. 가장 큰 특징은 **기본 차단(deny-by-default) 보안 모델**로, 모든 시스템 리소스 접근이 명시적 권한 없이는 차단된다.

## Deno가 해결하려 한 문제

Node.js는 탄생 당시 보안보다 성능과 사용 편의성을 우선시했다. `require()`로 불러온 모듈은 파일 시스템, 네트워크, 환경 변수에 무제한 접근할 수 있었고, `node_modules`의 공급망 공격에 취약했다. Deno는 이 문제에 두 가지 답을 제시한다.

1. **기본 차단 보안 모델**: 파일, 네트워크, 환경 변수, 서브프로세스 실행 모두 기본 차단 후 플래그로 허용
2. **중앙 registry 의존 탈피**: `npm` 대신 URL 직접 임포트 또는 JSR(`jsr:`) 사용

## 권한 플래그 시스템

Deno 프로그램을 실행할 때 필요한 권한을 `--allow-*` 플래그로 명시한다. 권한 없이 접근을 시도하면 `Deno.errors.PermissionDenied`가 즉시 던져진다.

![Deno 권한 모델 — 기본 차단 원칙](/assets/posts/deno-security-stdlib-permissions.svg)

```bash
# 모든 권한 거부 (기본 상태)
deno run script.ts

# 네트워크만 허용
deno run --allow-net script.ts

# 특정 호스트만 허용 (세밀한 제어)
deno run --allow-net=api.example.com script.ts

# 읽기·쓰기 경로 한정
deno run --allow-read=/data --allow-write=/tmp script.ts

# 모든 권한 허용 (지양)
deno run --allow-all script.ts
```

주요 플래그를 정리하면 다음과 같다.

| 플래그 | 제어 범위 | 세밀 지정 예 |
|---|---|---|
| `--allow-read` | 파일 읽기 | `--allow-read=/etc` |
| `--allow-write` | 파일 쓰기 | `--allow-write=/tmp` |
| `--allow-net` | 네트워크 요청 | `--allow-net=api.com:443` |
| `--allow-env` | 환경 변수 | `--allow-env=PORT,HOST` |
| `--allow-run` | 서브프로세스 | `--allow-run=git` |
| `--allow-sys` | 시스템 정보 | `--allow-sys=osRelease` |

## Deno.permissions API — 런타임 권한 조회

`--allow-*` 플래그가 정적 선언이라면, `Deno.permissions` API는 런타임에 권한 상태를 조회하거나 사용자에게 대화형으로 요청할 수 있다.

```typescript
// 현재 네트워크 권한 조회
const netStatus = await Deno.permissions.query({
  name: "net",
  host: "api.example.com",
});

console.log(netStatus.state); // "granted" | "denied" | "prompt"

if (netStatus.state === "granted") {
  const res = await fetch("https://api.example.com/data");
  console.log(await res.json());
} else {
  // 대화형 요청 (터미널 prompt)
  const req = await Deno.permissions.request({
    name: "net",
    host: "api.example.com",
  });
  if (req.state === "granted") {
    /* ... */
  }
}
```

`state`가 `"prompt"`인 경우, 사용자가 터미널에서 `y/n`으로 응답할 때까지 대기한다. 이 흐름 덕분에 CLI 도구가 필요한 권한을 명확히 안내하면서도 최소 권한 원칙을 유지할 수 있다.

## deno.json — 프로젝트 설정과 권한 선언

`deno.json`은 Node.js의 `package.json`에 해당한다. 태스크(task) 정의, 임포트 맵, 컴파일러 옵션을 한 곳에서 관리한다.

```json
{
  "tasks": {
    "start": "deno run --allow-net --allow-read src/main.ts",
    "test":  "deno test --allow-read tests/"
  },
  "imports": {
    "@std/path": "jsr:@std/path@^1.0.0",
    "@std/fs":   "jsr:@std/fs@^1.0.0"
  },
  "compilerOptions": {
    "strict": true
  }
}
```

`imports` 필드가 임포트 맵 역할을 하여, 코드에서 `"@std/path"`처럼 짧게 참조할 수 있다.

## JSR @std 표준 라이브러리

Deno는 별도 `npm install` 없이 JSR(JavaScript Registry)의 `@std` 네임스페이스를 통해 표준 라이브러리를 제공한다. 모든 모듈은 TypeScript 타입 내장, 테스트 커버리지 100%, 버전 SemVer 관리가 보장된다.

![JSR @std 표준 라이브러리](/assets/posts/deno-security-stdlib-std-code.svg)

주요 `@std` 모듈은 다음과 같다.

```typescript
// @std/path — 경로 처리
import { join, dirname, extname } from "jsr:@std/path";

// @std/fs — 파일 시스템 고수준 유틸
import { ensureDir, copy, walk } from "jsr:@std/fs";

// @std/encoding — Base64, Hex, CSV
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding/base64";

// @std/http — 서버 유틸리티
import { serveDir } from "jsr:@std/http/file-server";

// @std/assert — 테스트 단언
import { assertEquals, assertThrows } from "jsr:@std/assert";
```

Node.js의 `path.join`이나 `fs.mkdir({recursive: true})`처럼 매번 options 객체를 넘겨야 했던 패턴이, `join()`·`ensureDir()` 같은 직관적인 API로 교체된다.

## Deno의 내장 도구체인

Deno는 런타임 외에도 개발에 필요한 도구를 내장한다.

```bash
deno fmt          # 코드 포매터 (Prettier 대체)
deno lint         # 린터 (ESLint 대체)
deno test         # 테스트 러너
deno compile      # 단일 실행 파일 생성
deno bundle       # (deprecated → @std/build)
deno doc mod.ts   # JSDoc 문서 생성
```

별도 설정 없이 `deno fmt`만 실행하면 프로젝트 전체를 일관된 스타일로 포매팅한다. CI에서 `deno fmt --check`로 포매팅 검사를 통합하는 것도 자연스럽다.

## Node.js 호환성 레이어

Deno v1.15부터 `node:` 접두사로 Node.js 빌트인 모듈을 임포트할 수 있고, npm 패키지도 `npm:` 접두사로 직접 사용할 수 있다.

```typescript
// Node.js 빌트인 호환
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";

// npm 패키지 직접 사용
import express from "npm:express@4";
import chalk from "npm:chalk@5";
```

이 호환성 레이어 덕분에 기존 Node.js 코드베이스를 Deno로 점진적으로 이전하거나, npm 생태계 자산을 그대로 활용할 수 있다.

## 실전 Deno 서버 예시

```typescript
// main.ts — 권한: --allow-net --allow-read
import { Hono } from "npm:hono";
import { serveDir } from "jsr:@std/http/file-server";

const app = new Hono();

app.get("/static/*", (c) =>
  serveDir(c.req.raw, { fsRoot: "./public", urlRoot: "/static" })
);

app.get("/api/hello", (c) =>
  c.json({ message: "Hello from Deno!" })
);

Deno.serve({ port: 8000 }, app.fetch);
```

`Deno.serve`는 HTTP 서버를 여는 빌트인 API다. Hono 같은 경량 프레임워크와 조합하면 별도 패키지 없이 프로덕션급 서버를 구성할 수 있다.

---

**지난 글:** [node_modules 호이스팅과 의존성 해석](/posts/node-modules-hoisting/)

**다음 글:** [Bun · JSC 기반 런타임과 내장 번들러](/posts/bun-jsc-bundler/)

<br>
읽어주셔서 감사합니다. 😊
