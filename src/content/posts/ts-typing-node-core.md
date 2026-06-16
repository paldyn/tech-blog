---
title: "Node.js 코어 타이핑 — @types/node와 내장 모듈"
description: "Node.js 런타임을 TypeScript에서 타입 안전하게 쓰기 위한 @types/node의 역할을 정리합니다. 전역 타입 인식, tsconfig의 types·lib 설정, node: 프로토콜 import, Buffer·process·global 같은 내장 객체 타이핑을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "Node", "@types/node", "내장모듈", "tsconfig"]
featured: false
draft: false
---

[지난 글](/posts/ts-typed-env-vars/)에서 `process.env`를 안전하게 다뤘다. 그런데 `process`라는 전역 객체의 타입은 애초에 어디서 왔을까? TypeScript는 브라우저든 Node든 런타임 자체를 알지 못한다. Node.js의 전역 객체와 내장 모듈에 타입을 입히는 것은 별도 패키지 `@types/node`의 몫이다. 이번 글은 이 패키지가 무엇을 해 주는지, 그리고 tsconfig에서 어떻게 활성화하는지를 정리한다.

## TypeScript는 Node를 모른다

순수 TypeScript 컴파일러는 `process`, `Buffer`, `require` 같은 Node 전역을 전혀 알지 못한다. `@types/node` 없이 이들을 쓰면 바로 에러가 난다.

```typescript
console.log(process.platform);
// ❌ Cannot find name 'process'. Do you need to install
//    type definitions for node? Try `npm i --save-dev @types/node`.
```

TypeScript의 표준 라이브러리(`lib.dom.d.ts` 등)는 ECMAScript와 브라우저 API만 담는다. Node 런타임의 API는 그 바깥이므로, 별도의 선언 파일 묶음이 필요하다.

```bash
npm install --save-dev @types/node
```

이 패키지는 Node 런타임 전체에 대한 타입 선언(`.d.ts`)만 담은 묶음이다. 런타임 코드는 한 줄도 없으며, 컴파일 시점에만 쓰이므로 `devDependencies`에 둔다.

![@types/node 타이핑](/assets/posts/ts-typing-node-core-flow.svg)

## 전역으로 인식되는 원리

`@types/node`를 설치하면 `node_modules/@types/node`에 선언이 놓인다. TypeScript는 기본적으로 `node_modules/@types` 아래의 모든 패키지를 **자동으로 전역 타입에 포함**한다. 그래서 import 없이도 `process`나 `Buffer`가 인식된다.

```typescript
const buf = Buffer.from("hello", "utf-8"); // Buffer — import 불필요
const pid: number = process.pid;            // process — 전역으로 인식
declare const __dirname: string;            // 이미 선언돼 있음
```

만약 tsconfig의 `types` 배열을 명시하면 자동 포함이 꺼지고 나열한 패키지만 들어간다. Node 타입을 쓰려면 반드시 포함해야 한다.

```jsonc
{
  "compilerOptions": {
    // types를 생략하면 @types/* 전부 자동 포함 (권장)
    // 명시하면 나열한 것만 — node를 빠뜨리면 전역이 사라진다
    "types": ["node"]
  }
}
```

## node: 프로토콜로 내장 모듈 import

내장 모듈은 `node:` 프로토콜을 붙여 import하는 것이 현대적 권장 방식이다. npm 패키지와 이름이 겹칠 여지를 없애고, 내장임을 명확히 한다.

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:http";

const buf: Buffer = await readFile(join(__dirname, "data.json"));
```

`@types/node`가 각 내장 모듈의 시그니처를 제공하므로, `readFile`의 인자와 반환 타입(`Promise<Buffer>`)이 정확히 추론된다.

![내장 전역과 모듈 타입](/assets/posts/ts-typing-node-core-code.svg)

## 버전과 lib을 맞추기

`@types/node`는 Node 메이저 버전을 따라간다. 런타임 Node 20을 쓰면서 `@types/node@18`을 설치하면, Node 20에 추가된 API(예: 안정화된 `fetch`, `--watch` 관련 타입 등)가 타입에 없어 어긋난다.

```jsonc
{
  "compilerOptions": {
    "lib": ["ES2023"],        // 런타임이 지원하는 JS 기능 수준
    "target": "ES2022",
    "module": "NodeNext",     // Node의 ESM/CJS 해석 규칙
    "moduleResolution": "NodeNext"
  }
}
```

여기서 `lib`은 ECMAScript 기능(예: `Array.prototype.findLast`)의 타입을, `@types/node`는 Node 고유 API(`fs`, `process` 등)의 타입을 담당한다. 둘은 역할이 다르므로 **함께** 맞춰야 한다. 런타임 Node 버전과 `@types/node` 메이저, 그리고 `lib`의 ES 수준을 한 세트로 정렬하는 것이 어긋난 타입으로 인한 혼란을 막는 길이다.

## global에 안전하게 얹기

전역 객체에 무언가를 추가해야 한다면(예: 싱글턴 캐시), `globalThis`를 모듈 보강으로 타이핑한다. 단언 없이 타입 안전하게 접근할 수 있다.

```typescript
declare global {
  // eslint-disable-next-line no-var
  var __cache: Map<string, unknown> | undefined;
}

globalThis.__cache ??= new Map();
globalThis.__cache.set("k", 1); // 타입 안전
export {};
```

정리하면, `@types/node`는 ① TypeScript가 모르는 Node 런타임에 타입을 입히고 ② `node_modules/@types`를 통해 전역으로 인식되며 ③ `node:` 프로토콜 import의 시그니처를 제공하고 ④ 런타임 버전·`lib`과 함께 정렬해야 한다. 다음 글에서는 그 내장 모듈 중에서도 가장 자주 쓰는 `fs`와 `path`의 타이핑을 구체적으로 파고든다.

---

**지난 글:** [환경 변수 타이핑 — process.env 안전하게 다루기](/posts/ts-typed-env-vars/)

**다음 글:** [fs / path 타이핑 — 파일 시스템 API 안전하게](/posts/ts-typing-fs-path/)

<br>
읽어주셔서 감사합니다. 😊
