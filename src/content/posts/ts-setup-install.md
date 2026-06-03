---
title: "TypeScript 설치와 환경 구성: 첫 발을 내딛다"
description: "Node.js부터 TypeScript 설치, tsconfig.json 초기화, 첫 컴파일까지 — TypeScript 개발 환경을 처음부터 구성하는 완전한 가이드."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "설치", "tsconfig", "tsc", "Node.js", "환경설정"]
featured: false
draft: false
---

[지난 글](/posts/ts-vs-javascript/)에서 TypeScript와 JavaScript의 차이를 비교했다. 이제 실제로 TypeScript를 설치하고 개발 환경을 구성해 보자. 이번 편을 따라하면 5분 안에 TypeScript 프로젝트를 시작할 수 있다.

## 사전 준비: Node.js 설치

TypeScript 컴파일러(`tsc`)는 Node.js 위에서 실행된다. Node.js가 없다면 먼저 설치해야 한다.

![TypeScript 설치 단계](/assets/posts/ts-setup-install-steps.svg)

```bash
# 설치 후 버전 확인
node --version   # v20.x.x 이상 권장
npm --version    # 10.x.x 이상
```

Node.js는 공식 사이트(nodejs.org)에서 LTS 버전을 다운로드하거나, `nvm`(Node Version Manager)를 이용하면 여러 버전을 관리하기 편하다.

```bash
# nvm을 이용한 LTS 설치 (권장)
nvm install --lts
nvm use --lts
```

## TypeScript 설치

TypeScript는 두 가지 방법으로 설치할 수 있다.

### 방법 1: 프로젝트 로컬 설치 (권장)

```bash
mkdir my-ts-project && cd my-ts-project
npm init -y
npm install --save-dev typescript
```

로컬 설치를 권장하는 이유는 프로젝트마다 TypeScript 버전을 독립적으로 관리할 수 있기 때문이다. 팀 협업 시 버전 불일치 문제를 방지한다.

로컬 설치 시에는 `npx`를 앞에 붙여 실행한다.

```bash
npx tsc --version   # TypeScript 5.x.x
```

### 방법 2: 글로벌 설치

```bash
npm install -g typescript
tsc --version       # 글로벌 명령어로 바로 실행
```

글로벌 설치는 간단하지만 프로젝트 간 버전이 달라질 수 있어 로컬 설치를 더 선호한다.

## tsconfig.json 초기화

TypeScript 컴파일러 옵션은 `tsconfig.json` 파일로 관리한다. 자동 생성 명령어로 시작하자.

```bash
npx tsc --init
```

이 명령이 프로젝트 루트에 `tsconfig.json`을 만들어 준다. 수백 개의 옵션이 주석 처리된 채로 들어있으므로 필요한 것만 활성화하면 된다.

## 프로젝트 구조

![TypeScript 프로젝트 구조](/assets/posts/ts-setup-install-structure.svg)

권장하는 기본 프로젝트 구조다.

```
my-ts-project/
├── src/           # TypeScript 소스 파일
│   └── index.ts
├── dist/          # 컴파일된 JavaScript 출력 (.gitignore에 추가)
├── tsconfig.json
├── package.json
└── .gitignore
```

`.gitignore`에 `dist/`와 `node_modules/`를 추가하는 것을 잊지 말자.

```
# .gitignore
node_modules/
dist/
```

## tsconfig.json 핵심 설정

처음 시작하는 프로젝트에 적합한 최소 설정이다.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
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

각 옵션의 의미:

| 옵션 | 값 | 의미 |
|------|----|------|
| `target` | `ES2020` | 출력 JavaScript 버전 |
| `module` | `commonjs` | 모듈 시스템 (Node.js용) |
| `outDir` | `./dist` | 컴파일 출력 디렉터리 |
| `rootDir` | `./src` | TypeScript 소스 루트 |
| `strict` | `true` | 엄격 모드 활성화 (권장) |

## package.json 스크립트 설정

개발 편의를 위해 npm 스크립트를 추가한다.

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "start": "node dist/index.js",
    "dev": "tsc --watch & node dist/index.js"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- `npm run build`: 한 번 컴파일
- `npm run build:watch`: 파일 변경 감지 후 자동 재컴파일
- `npm start`: 컴파일된 JS 실행

## 첫 파일 작성 및 컴파일

`src/index.ts` 파일을 만들고 간단한 코드를 작성해보자.

```typescript
// src/index.ts
interface Greeter {
  greet(name: string): string;
}

const greeter: Greeter = {
  greet(name) {
    return `Hello, ${name}! Welcome to TypeScript.`;
  },
};

const message = greeter.greet("World");
console.log(message);
```

컴파일하고 실행해보자.

```bash
npx tsc        # src/index.ts → dist/index.js 변환
node dist/index.js
# Hello, World! Welcome to TypeScript.
```

`dist/index.js`를 열어보면 타입 정보가 모두 제거된 순수 JavaScript가 나타난다.

## ts-node로 즉시 실행

개발 중에는 컴파일 단계 없이 TypeScript를 직접 실행할 수 있는 `ts-node`가 편리하다.

```bash
npm install --save-dev ts-node
npx ts-node src/index.ts
# Hello, World! Welcome to TypeScript.
```

`ts-node`는 메모리에서 컴파일하고 즉시 실행하므로 개발 단계의 빠른 피드백 루프에 적합하다.

환경 설정이 완료됐다. 다음 편에서는 `tsc` 컴파일러 내부 동작과 주요 옵션을 더 깊이 살펴본다.

---

**지난 글:** [TypeScript vs JavaScript: 슈퍼셋의 의미](/posts/ts-vs-javascript/)

**다음 글:** [tsc 컴파일러 완전 해부: 동작 원리와 옵션](/posts/ts-compiler-tsc/)

<br>
읽어주셔서 감사합니다. 😊
