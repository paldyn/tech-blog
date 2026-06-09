---
title: "TypeScript 설치 및 환경 설정 — 처음부터 시작하기"
description: "Node.js 설치부터 TypeScript 프로젝트 초기화, tsconfig.json 기본 설정까지 단계별로 안내합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "설치", "환경설정", "tsconfig", "npm"]
featured: false
draft: false
---

[지난 글](/posts/ts-vs-javascript/)에서 TypeScript와 JavaScript의 차이를 살펴봤습니다. 이제 실제로 TypeScript를 설치하고 첫 프로젝트를 만들어 봅니다.

![TypeScript 설치 흐름](/assets/posts/ts-setup-install-flow.svg)

## 사전 준비: Node.js 설치

TypeScript 컴파일러(`tsc`)는 Node.js 패키지로 배포됩니다. 먼저 Node.js를 설치해야 합니다.

```bash
# Node.js 버전 확인
node --version    # v20.x 이상 권장
npm --version     # 10.x 이상 권장
```

Node.js가 없다면 [nodejs.org](https://nodejs.org)에서 LTS 버전을 설치하세요. `nvm`(Node Version Manager)을 사용하면 여러 버전을 관리하기 편합니다.

```bash
# nvm으로 Node.js 설치 (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts
```

## 새 TypeScript 프로젝트 만들기

```bash
# 1. 프로젝트 디렉터리 생성
mkdir my-ts-app && cd my-ts-app

# 2. npm 초기화
npm init -y

# 3. TypeScript 로컬 설치 (개발 의존성)
npm install --save-dev typescript

# 4. TypeScript 버전 확인
npx tsc --version   # Version 5.x.x
```

TypeScript는 `devDependencies`로 설치합니다. 런타임에 필요하지 않고 개발·빌드 시에만 사용하기 때문입니다.

## tsconfig.json 생성

`tsconfig.json`은 TypeScript 컴파일러의 설정 파일입니다. 프로젝트 루트에 위치하며, `tsc` 명령어 실행 시 자동으로 읽힙니다.

```bash
# tsconfig.json 자동 생성
npx tsc --init
```

생성된 파일에는 수백 개의 옵션이 주석 처리되어 있습니다. 실용적인 최소 설정으로 단순화하면 다음과 같습니다.

```json
{
  "compilerOptions": {
    "target": "ES2020",          // 컴파일 후 JS 버전
    "module": "commonjs",        // 모듈 시스템 (Node.js용)
    "lib": ["ES2020"],           // 사용할 빌트인 타입 라이브러리
    "rootDir": "./src",          // TypeScript 소스 루트
    "outDir": "./dist",          // 컴파일 결과 출력 위치
    "strict": true,              // 엄격 모드 (강력 권장)
    "esModuleInterop": true,     // CommonJS 모듈 호환성
    "skipLibCheck": true,        // .d.ts 파일 검사 생략
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],       // 컴파일할 파일 패턴
  "exclude": ["node_modules", "dist"]
}
```

## 프로젝트 구조

![TypeScript 프로젝트 구조](/assets/posts/ts-setup-install-structure.svg)

```
my-ts-app/
├── src/
│   └── index.ts      # TypeScript 소스 파일
├── dist/             # 컴파일 출력 (gitignore에 추가)
├── node_modules/
├── tsconfig.json
├── package.json
└── .gitignore
```

`.gitignore`에 반드시 추가해야 할 항목:

```gitignore
node_modules/
dist/
*.js.map
```

## 첫 TypeScript 파일 작성

`src/index.ts`를 만들고 간단한 코드를 작성합니다.

```typescript
// src/index.ts
function greet(name: string): string {
  return `Hello, ${name}! TypeScript 환경이 준비되었습니다.`;
}

const message = greet("World");
console.log(message);
```

## 컴파일 및 실행

```bash
# 컴파일
npx tsc

# 실행
node dist/index.js
# 출력: Hello, World! TypeScript 환경이 준비되었습니다.
```

## package.json 스크립트 설정

자주 쓰는 명령어를 `package.json`의 `scripts`에 등록합니다.

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

```bash
npm run build      # 컴파일
npm run typecheck  # 파일 출력 없이 타입 검사만
```

## ts-node: 컴파일 없이 바로 실행

개발 중에는 컴파일 단계를 건너뛰고 TypeScript 파일을 직접 실행할 수 있습니다.

```bash
npm install --save-dev ts-node @types/node

# TypeScript 파일 직접 실행
npx ts-node src/index.ts
```

## strict 모드의 중요성

`"strict": true`는 다음 7개 플래그를 한 번에 활성화합니다.

```
noImplicitAny          – any 타입 자동 부여 금지
strictNullChecks       – null/undefined 명시적 처리 강제
strictFunctionTypes    – 함수 타입 엄격 검사
strictBindCallApply    – bind/call/apply 인자 타입 검사
strictPropertyInitialization – 클래스 프로퍼티 초기화 강제
noImplicitThis         – this 타입 명시 강제
alwaysStrict           – 'use strict' 자동 삽입
```

새 프로젝트는 반드시 `"strict": true`로 시작하는 것을 권장합니다. 나중에 켜려면 수많은 오류를 한꺼번에 수정해야 하는 고통이 따릅니다.

---

**지난 글:** [TypeScript vs JavaScript — 코드로 보는 차이](/posts/ts-vs-javascript/)

**다음 글:** [TypeScript 컴파일러 tsc 완전 이해](/posts/ts-compiler-tsc/)

<br>
읽어주셔서 감사합니다. 😊
