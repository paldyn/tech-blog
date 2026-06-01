---
title: "TypeScript 완전 정복 ④: 설치와 환경 설정"
description: "Node.js, TypeScript 설치부터 tsconfig.json 기본 설정까지. 실제 프로젝트를 시작할 수 있는 환경을 단계별로 구성합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "설치", "환경설정", "tsconfig", "Node.js", "npm"]
featured: false
draft: false
---

[지난 글](/posts/ts-vs-javascript/)에서 TypeScript와 JavaScript의 차이를 코드로 비교했다. 이번 글에서는 실제로 TypeScript를 설치하고 첫 프로젝트를 실행할 수 있는 환경을 구성한다.

## 사전 요구사항: Node.js

TypeScript 컴파일러(`tsc`)는 Node.js 위에서 실행된다. Node.js LTS 버전을 먼저 설치한다.

```bash
# 현재 설치된 Node.js 버전 확인
node --version  # v22.x.x 이상 권장
npm --version   # 10.x 이상

# Node.js 미설치 시 https://nodejs.org 에서 LTS 다운로드
# 또는 nvm 사용 (버전 관리 용이)
# nvm install --lts
# nvm use --lts
```

Node.js 18 이상이면 TypeScript를 사용하는 데 문제없다. 최신 LTS(22.x)를 권장한다.

## TypeScript 설치

![TypeScript 설치 단계](/assets/posts/ts-setup-install-steps.svg)

TypeScript는 프로젝트 로컬 설치가 기본 관행이다. 전역 설치(global)도 가능하지만 프로젝트마다 다른 버전을 써야 할 때 충돌이 생긴다.

```bash
# 새 프로젝트 디렉토리 생성
mkdir my-ts-project
cd my-ts-project

# package.json 초기화
npm init -y

# TypeScript 로컬 설치 (devDependency)
npm install --save-dev typescript

# 설치된 버전 확인
npx tsc --version  # Version 5.x.x
```

`npm install --save-dev`로 설치하면 `devDependencies`에 추가된다. TypeScript는 개발 도구이므로 프로덕션 의존성(`dependencies`)이 아닌 개발 의존성에 넣는 것이 올바르다.

## tsconfig.json 생성

컴파일러 설정 파일 `tsconfig.json`을 생성한다.

```bash
# 기본 tsconfig.json 생성
npx tsc --init
```

이 명령은 모든 주요 옵션이 주석처리된 상태로 `tsconfig.json`을 생성한다. 초보자용 기본 설정은 다음과 같다.

![tsconfig.json 핵심 옵션](/assets/posts/ts-setup-install-config.svg)

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
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

가장 중요한 옵션은 **`strict: true`**다. 이것 하나로 다음 옵션들이 모두 활성화된다.
- `noImplicitAny`: 암묵적 `any` 타입 금지
- `strictNullChecks`: `null`/`undefined` 처리 강제
- `strictFunctionTypes`: 함수 매개변수 타입 엄격 검사
- 그 외 여러 엄격 검사 옵션

새 프로젝트를 시작한다면 항상 `strict: true`로 시작하자.

## 프로젝트 디렉토리 구조

```
my-ts-project/
├── src/
│   └── index.ts        # TypeScript 소스
├── dist/               # 컴파일 결과 (자동 생성)
├── node_modules/
├── package.json
├── package-lock.json
└── tsconfig.json
```

```bash
# src 디렉토리 생성
mkdir src

# 첫 TypeScript 파일 작성
cat > src/index.ts << 'EOF'
const message: string = "Hello, TypeScript!";
console.log(message);

function add(a: number, b: number): number {
  return a + b;
}

console.log(add(2, 3));
EOF
```

## 컴파일하고 실행하기

```bash
# 컴파일 (src/*.ts → dist/*.js)
npx tsc

# 결과 확인
ls dist/           # index.js, index.js.map

# 실행
node dist/index.js  # Hello, TypeScript!   5
```

`dist/index.js`를 열어보면 타입 어노테이션이 모두 제거된 순수 JavaScript임을 확인할 수 있다.

## package.json 스크립트 설정

매번 `npx tsc`를 치는 대신 npm 스크립트를 추가한다.

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  }
}
```

```bash
npm run build        # 빌드
npm run build:watch  # 파일 변경 감지하며 자동 재빌드
npm start            # 빌드된 JS 실행
```

## 빠른 실행: tsx와 ts-node

개발 중에 매번 컴파일하기 번거로울 때는 TypeScript를 직접 실행하는 도구를 사용한다.

```bash
# tsx 설치 (빠른 TS 실행, esbuild 기반)
npm install --save-dev tsx

# 직접 실행 (컴파일 없이)
npx tsx src/index.ts  # Hello, TypeScript!   5

# 또는 ts-node (공식적이지만 느림)
npm install --save-dev ts-node
npx ts-node src/index.ts
```

`tsx`는 개발 서버나 스크립트 실행에 적합하고, `tsc`는 타입 검사와 배포용 빌드에 사용한다. 두 역할을 분리해서 쓰는 것이 일반적이다.

## 타입 정의 패키지 (@types)

Node.js 내장 모듈이나 외부 라이브러리를 TypeScript에서 사용할 때 타입 정의가 필요하다.

```bash
# Node.js 내장 모듈 타입 정의 설치
npm install --save-dev @types/node

# Express 타입 정의
npm install express
npm install --save-dev @types/express

# 최근 라이브러리 (TypeScript 내장)
npm install zod        # 타입 정의 내장 — @types 불필요
npm install prisma     # 타입 생성 내장
```

최근에 만들어진 라이브러리들은 타입 정의가 패키지에 내장돼 있어서 `@types/` 패키지를 별도로 설치할 필요가 없다.

## 정리

TypeScript 환경 설정은 3단계다: Node.js 설치 → `npm install --save-dev typescript` → `npx tsc --init`. `strict: true`는 항상 켜두자. 개발 중 빠른 실행은 `tsx`, 타입 검사와 배포 빌드는 `tsc`로 분리해 쓴다.

---

**지난 글:** [TypeScript vs JavaScript 실전 비교](/posts/ts-vs-javascript/)

**다음 글:** [tsc 컴파일러 완전 이해](/posts/ts-compiler-tsc/)

<br>
읽어주셔서 감사합니다. 😊
