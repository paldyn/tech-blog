---
title: "TypeScript 설치와 환경 구성 완전 가이드"
description: "Node.js, TypeScript 설치부터 tsconfig.json 기본 설정, ts-node 개발 환경까지 실습 중심으로 안내합니다. 처음 시작하는 분도 10분 안에 TypeScript 개발 환경을 갖출 수 있습니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "설치", "환경설정", "tsconfig", "Node.js"]
featured: false
draft: false
---

[지난 글](/posts/ts-vs-javascript/)에서 TypeScript와 JavaScript의 차이를 코드 레벨에서 비교했다. 이제 직접 TypeScript를 설치하고 환경을 구성해 보자. 처음부터 따라 하면 10분 안에 TypeScript 개발 환경을 완성할 수 있다.

## 사전 요구사항: Node.js

TypeScript 컴파일러는 Node.js 위에서 실행된다. [nodejs.org](https://nodejs.org)에서 **LTS 버전(v20 이상)** 을 다운로드하여 설치한다. Node.js를 설치하면 `npm`도 함께 설치된다.

```bash
# 설치 확인
node --version   # v20.x.x
npm --version    # 10.x.x
```

![TypeScript 설치 단계](/assets/posts/ts-setup-install-steps.svg)

## TypeScript 설치

TypeScript 컴파일러(`tsc`)는 npm으로 설치한다. **전역 설치**와 **프로젝트 로컬 설치** 두 가지 방식이 있다.

```bash
# 전역 설치 — tsc 명령어를 어디서나 쓸 수 있음
npm install -g typescript

# 버전 확인
tsc --version   # Version 5.x.x
```

**프로젝트 로컬 설치**는 팀 협업에 더 적합하다. 프로젝트마다 TypeScript 버전을 다르게 관리할 수 있다.

```bash
# 새 프로젝트 시작
mkdir my-ts-project && cd my-ts-project
npm init -y

# 로컬 설치 (개발 의존성)
npm install --save-dev typescript

# npx로 tsc 실행
npx tsc --version
```

## tsconfig.json 생성

`tsconfig.json` 은 TypeScript 컴파일러 설정 파일이다. `tsc --init` 명령으로 기본 설정 파일을 생성한다.

```bash
tsc --init
# tsconfig.json 파일이 현재 디렉터리에 생성됨
```

기본 생성된 파일에는 수백 개의 옵션이 주석 처리되어 있다. 처음 시작할 때는 다음 설정으로 깔끔하게 시작하자.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

![tsconfig.json 핵심 옵션](/assets/posts/ts-setup-install-tsconfig.svg)

주요 옵션 설명:

- **target** — 컴파일 결과 JavaScript 버전. `ES2022` 는 최신 Node.js에서 잘 동작한다
- **outDir** — 컴파일된 `.js` 파일이 저장될 위치
- **rootDir** — TypeScript 소스 파일 위치
- **strict** — 엄격 모드 활성화. `null` 체크, 암묵적 `any` 금지 등 강력한 타입 검사를 켠다
- **esModuleInterop** — `import React from 'react'` 같은 CommonJS 모듈 import 편의 문법 활성화

## 첫 번째 파일 작성과 컴파일

프로젝트 구조를 만들고 첫 번째 TypeScript 파일을 작성한다.

```bash
mkdir src
touch src/index.ts
```

`src/index.ts`:

```typescript
interface Greeting {
  name: string;
  language: "ko" | "en";
}

function greet(options: Greeting): string {
  if (options.language === "ko") {
    return `안녕하세요, ${options.name}님!`;
  }
  return `Hello, ${options.name}!`;
}

const result = greet({ name: "TypeScript", language: "ko" });
console.log(result);
```

컴파일 후 실행:

```bash
npx tsc         # src/index.ts → dist/index.js 생성
node dist/index.js  # 안녕하세요, TypeScript님!
```

## ts-node로 빠른 개발

개발 중에는 컴파일 없이 TypeScript를 직접 실행할 수 있는 `ts-node`를 쓰면 편하다.

```bash
npm install --save-dev ts-node

# 직접 실행
npx ts-node src/index.ts  # 컴파일 없이 바로 출력
```

`package.json`에 스크립트를 추가하면 더 편하다.

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  }
}
```

## watch 모드

파일을 수정할 때마다 자동으로 다시 컴파일하려면 watch 모드를 사용한다.

```bash
npx tsc --watch   # 파일 변경 감지 후 자동 재컴파일
```

`nodemon` 과 `ts-node` 를 함께 쓰면 파일 변경 시 자동으로 재실행도 된다.

```bash
npm install --save-dev nodemon
npx nodemon --exec ts-node src/index.ts
```

## 요약

| 명령 | 설명 |
|---|---|
| `npm install -g typescript` | TypeScript 전역 설치 |
| `tsc --init` | tsconfig.json 생성 |
| `tsc` | 프로젝트 전체 컴파일 |
| `tsc --watch` | watch 모드 |
| `ts-node src/index.ts` | 직접 실행 (개발용) |

환경 설정이 완료됐다. 다음 글에서는 TypeScript 컴파일러 `tsc`의 주요 옵션과 작동 방식을 더 깊이 살펴본다.

---

**지난 글:** [TypeScript vs JavaScript — 무엇이 다른가](/posts/ts-vs-javascript/)

**다음 글:** [TypeScript 컴파일러 tsc 완전 해설](/posts/ts-compiler-tsc/)

<br>
읽어주셔서 감사합니다. 😊
