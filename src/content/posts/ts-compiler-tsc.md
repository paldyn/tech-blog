---
title: "tsc 컴파일러 완전 이해: 파이프라인과 핵심 옵션"
description: "TypeScript 컴파일러(tsc)가 .ts 파일을 .js로 변환하는 5단계 파이프라인, 자주 쓰는 컴파일러 옵션, watch 모드와 incremental 컴파일까지 깊이 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["tsc", "TypeScript컴파일러", "TypeScript완전정복", "tsconfig", "컴파일파이프라인"]
featured: false
draft: false
---

[지난 글](/posts/ts-setup-install/)에서 TypeScript 개발 환경을 구성했다. 이번에는 매일 실행하는 `tsc` 명령어가 내부에서 어떤 일을 하는지 이해해보자. 컴파일러를 이해하면 오류 메시지를 더 잘 해석하고, tsconfig.json을 더 효과적으로 설정할 수 있다.

## tsc란 무엇인가

`tsc`는 TypeScript Compiler의 줄임말이다. TypeScript 코드를 읽어 타입 검사를 수행하고, 순수한 JavaScript를 출력하는 도구다.

```bash
# 기본 사용법
tsc                    # tsconfig.json 기반 전체 컴파일
tsc file.ts            # 단일 파일 컴파일 (tsconfig 무시)
tsc --watch            # 파일 변경 감지 자동 컴파일
tsc --noEmit           # 타입 검사만 (파일 출력 없음)
tsc --version          # 설치된 tsc 버전 확인
```

## tsc 내부 파이프라인

TypeScript 컴파일러는 5단계를 거쳐 `.ts`를 `.js`로 변환한다.

![tsc 컴파일 파이프라인](/assets/posts/ts-compiler-tsc-flow.svg)

### 1단계: Scanner (스캐너/렉서)

소스 코드를 읽어 토큰(Token) 스트림으로 분해한다. `function`, `const`, `"hello"`, `42` 같은 기본 단위를 인식한다.

```
function greet(name: string): string {
↓ 토큰화
[keyword:function] [identifier:greet] [(] [identifier:name] [:] [keyword:string] [)] ...
```

### 2단계: Parser (파서)

토큰 스트림을 구문 분석해 AST(Abstract Syntax Tree, 추상 구문 트리)를 생성한다. AST는 코드의 구조를 트리 형태로 표현한 것이다.

```typescript
// 이 코드의 AST (간략화)
function add(a: number, b: number): number {
  return a + b;
}

// AST 노드:
// FunctionDeclaration
//   name: Identifier (add)
//   parameters: [
//     Parameter (a: number),
//     Parameter (b: number)
//   ]
//   returnType: TypeReference (number)
//   body: Block
//     ReturnStatement: BinaryExpression (a + b)
```

### 3단계: Binder (바인더)

AST를 순회하며 심볼 테이블을 만든다. 각 변수, 함수, 클래스가 어떤 스코프에 속하는지 확인하고, 선언과 사용처를 연결한다.

### 4단계: Checker (타입 검사기)

TypeScript의 핵심이다. 바인더가 만든 심볼 테이블을 기반으로 타입 추론과 타입 호환성 검사를 수행한다. 타입 오류가 여기서 발견된다.

```typescript
function multiply(a: number, b: number): number {
  return a + b;  // 타입적으로는 OK (number + number = number)
}

multiply("hello", 2);  // Checker가 오류 감지:
// Error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'
```

### 5단계: Emitter (이미터)

타입 검사를 통과한 코드에서 타입 어노테이션을 제거하고 JavaScript 파일을 생성한다. `declaration: true` 옵션이면 `.d.ts` 파일도 생성한다.

## 자주 쓰는 tsconfig 옵션

![tsc 주요 옵션](/assets/posts/ts-compiler-tsc-options.svg)

### 출력 제어 옵션

```json
{
  "compilerOptions": {
    "target": "ES2022",     // 출력 JS 버전
    "module": "commonjs",   // 모듈 시스템
    "outDir": "./dist",     // 출력 디렉터리
    "rootDir": "./src",     // 소스 루트
    "declaration": true,    // .d.ts 생성
    "declarationMap": true, // .d.ts 소스맵
    "sourceMap": true,      // .js.map 생성
    "removeComments": true  // 주석 제거
  }
}
```

### 엄격도 옵션

```json
{
  "compilerOptions": {
    "strict": true,                    // 아래 옵션 전체 활성화
    "noImplicitAny": true,             // any 암묵 추론 금지
    "strictNullChecks": true,          // null/undefined 분리
    "strictFunctionTypes": true,       // 함수 파라미터 공변/반변
    "noImplicitReturns": true,         // 모든 경로에서 반환 강제
    "noFallthroughCasesInSwitch": true // switch 폴스루 금지
  }
}
```

### 모듈 해석 옵션

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",       // Vite/webpack 환경
    "baseUrl": ".",                      // 절대 경로 기준점
    "paths": {
      "@/*": ["src/*"]                   // 경로 별칭
    },
    "esModuleInterop": true,             // CommonJS 호환 import
    "allowSyntheticDefaultImports": true // default import 허용
  }
}
```

## Watch 모드

개발 중 파일 변경마다 수동으로 `tsc`를 실행하는 건 번거롭다. Watch 모드를 사용하면 파일 변경 즉시 자동으로 재컴파일된다.

```bash
# Watch 모드 시작
tsc --watch
# 또는
tsc -w

# 출력 예시
[11:23:45] Starting compilation in watch mode...
[11:23:46] Found 0 errors. Watching for file changes.
[11:23:52] File change detected. Starting incremental compilation...
[11:23:53] Found 0 errors. Watching for file changes.
```

## Incremental 컴파일

프로젝트가 커지면 전체 재컴파일이 느려진다. `incremental: true`로 이전 컴파일 결과를 캐시해 변경된 파일만 다시 컴파일한다.

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"  // 캐시 파일 위치
  }
}
```

```bash
# 첫 컴파일: 전체 (느림)
tsc  # 5초

# 이후 컴파일: 변경분만 (빠름)
tsc  # 0.3초
```

## tsc 오류 메시지 읽는 법

TypeScript 오류는 처음에는 낯설지만, 패턴을 알면 쉽게 해석된다.

```
src/app.ts:15:3 - error TS2322: Type 'string' is not assignable to type 'number'.

15     count = "hello";
       ~~~~~

   src/app.ts:12:7
   12   let count: number = 0;
            ~~~~~~~~~~~~~~~
   'count' is declared here.
```

- `src/app.ts:15:3`: 파일명:줄번호:컬럼번호
- `TS2322`: TypeScript 오류 코드 (검색 가능)
- 오류 메시지: 무엇이 문제인지
- 하위 줄: 관련 선언 위치

오류 코드로 검색하면 자세한 설명과 해결책을 바로 찾을 수 있다. `TS2322 typescript`로 검색해보자.

## 커맨드라인 옵션 vs tsconfig.json

대부분의 옵션은 두 가지 방식으로 설정할 수 있다.

```bash
# 커맨드라인 플래그 (일회성)
tsc --target ES2022 --strict --outDir dist src/index.ts

# tsconfig.json (프로젝트 기본값 — 권장)
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "outDir": "dist"
  }
}
```

커맨드라인 플래그는 tsconfig.json 설정을 덮어쓴다. CI/CD에서 특정 옵션을 오버라이드할 때 유용하다.

## 타입 선언 파일(.d.ts) 생성

라이브러리를 배포할 때는 `.d.ts` 파일이 필요하다. 이 파일은 JavaScript 구현 없이 타입 정보만 포함한다.

```typescript
// src/utils.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

```bash
tsc --declaration
# dist/utils.js + dist/utils.d.ts 생성
```

```typescript
// dist/utils.d.ts (자동 생성)
export declare function add(a: number, b: number): number;
```

이 `.d.ts` 파일 덕분에 npm에 배포한 JavaScript 패키지도 TypeScript 사용자가 타입 정보를 활용할 수 있다.

## 정리

`tsc` 컴파일러는 Scanner → Parser → Binder → Checker → Emitter 5단계를 거쳐 `.ts`를 `.js`로 변환한다. Checker 단계가 TypeScript의 핵심이며, 여기서 타입 오류가 발견된다. Watch 모드와 Incremental 컴파일로 개발 속도를 높이고, tsconfig.json으로 프로젝트에 맞는 설정을 유지하자.

---

**지난 글:** [TypeScript 개발 환경 설치: Node.js부터 tsconfig까지](/posts/ts-setup-install/)

**다음 글:** [TypeScript Playground: 설치 없이 브라우저에서 실험하기](/posts/ts-playground-repl/)

<br>
읽어주셔서 감사합니다. 😊
