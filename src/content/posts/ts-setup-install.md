---
title: "TypeScript 설치와 환경 구성"
description: "Node.js, npm, TypeScript 설치부터 tsconfig.json 초기 설정까지 단계별로 안내합니다. 첫 TypeScript 프로젝트를 5분 안에 시작하는 방법을 배웁니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "설치", "환경설정", "Node.js", "npm", "tsconfig"]
featured: false
draft: false
---

[지난 글](/posts/ts-vs-javascript/)에서 TypeScript와 JavaScript의 차이를 비교했습니다. 이번 글에서는 실제 TypeScript 개발 환경을 만드는 방법을 단계별로 설명합니다.

## 개발 환경 구성 요소

TypeScript 개발에 필요한 도구는 세 가지입니다.

![TypeScript 개발 환경 구성 요소](/assets/posts/ts-setup-install-env.svg)

1. **Node.js**: JavaScript 런타임. npm(패키지 매니저) 포함. v18 LTS 이상 권장
2. **TypeScript**: npm으로 설치하는 컴파일러 패키지
3. **VS Code**: TypeScript Language Server가 내장된 에디터 (설치 없이 바로 타입 지원)

## 단계별 설치 가이드

![설치 단계](/assets/posts/ts-setup-install-flow.svg)

### 1. Node.js 설치 확인

```bash
node -v    # v20.x.x 이상 권장
npm -v     # 10.x.x 이상
```

Node.js가 없다면 [nodejs.org](https://nodejs.org)에서 LTS 버전을 설치하거나, `nvm`(Node Version Manager)을 사용합니다.

```bash
# nvm 사용 시
nvm install --lts
nvm use --lts
```

### 2. 프로젝트 생성

```bash
mkdir my-typescript-project
cd my-typescript-project
npm init -y
```

### 3. TypeScript 설치

TypeScript는 개발 의존성으로 설치합니다. 런타임에는 필요 없고 빌드 시에만 사용합니다.

```bash
npm install --save-dev typescript

# 전역 설치 (선택 사항, 프로젝트별 설치 권장)
# npm install -g typescript
```

설치 확인:

```bash
npx tsc --version
# Version 5.x.x
```

### 4. tsconfig.json 생성

```bash
npx tsc --init
```

이 명령이 `tsconfig.json` 파일을 생성합니다. 주석이 달린 모든 옵션이 포함된 파일이 생성되며, 처음엔 아래 최소 설정으로 시작하는 것을 권장합니다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 5. 프로젝트 구조 만들기

```bash
mkdir src
touch src/index.ts
```

### 6. 컴파일 스크립트 추가 (package.json)

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "typecheck": "tsc --noEmit"
  }
}
```

- `npm run build`: TypeScript를 JavaScript로 컴파일
- `npm run build:watch`: 파일 변경 감지 후 자동 재컴파일
- `npm run typecheck`: 타입 검사만 (파일 출력 없음, CI에서 활용)

## 대안 실행 방법

실제 프로젝트에서는 TypeScript를 직접 컴파일하지 않고 번들러나 실행기를 사용하는 경우가 많습니다.

```bash
# ts-node: 컴파일 없이 TypeScript 직접 실행 (개발용)
npm install --save-dev ts-node
npx ts-node src/index.ts

# tsx: 더 빠른 TypeScript 실행기
npm install --save-dev tsx
npx tsx src/index.ts

# ts-node/esm: ESM 모듈 지원
node --loader ts-node/esm src/index.ts
```

## Node.js 타입 정의 추가

Node.js 내장 모듈(`fs`, `path` 등)의 타입 정의는 별도 패키지로 제공됩니다.

```bash
npm install --save-dev @types/node
```

`@types/` 접두사를 가진 패키지들은 DefinitelyTyped에서 관리하는 타입 선언 파일입니다. 라이브러리 자체에 타입이 없을 때 이 방식으로 타입을 추가합니다.

이제 TypeScript 개발 환경이 갖춰졌습니다. 다음 글에서는 `tsc` 컴파일러의 내부 동작과 주요 옵션들을 더 깊이 살펴보겠습니다.

---

**지난 글:** [TypeScript vs JavaScript: 무엇이 다른가](/posts/ts-vs-javascript/)

**다음 글:** [tsc 컴파일러 완전 이해](/posts/ts-compiler-tsc/)

<br>
읽어주셔서 감사합니다. 😊
