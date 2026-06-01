---
title: "TypeScript 완전 정복 ⑤: tsc 컴파일러 완전 이해"
description: "TypeScript 컴파일러 tsc의 내부 동작 원리, 주요 CLI 옵션, 타입 검사와 코드 생성을 분리하는 현대적 워크플로우를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "tsc", "컴파일러", "tsconfig", "빌드", "타입검사"]
featured: false
draft: false
---

[지난 글](/posts/ts-setup-install/)에서 TypeScript를 설치하고 `tsconfig.json`을 만들었다. 이번 글에서는 `tsc`가 내부적으로 어떻게 동작하는지, 어떤 CLI 옵션이 있는지, 그리고 현대 개발 워크플로우에서 `tsc`를 어떻게 효율적으로 사용하는지를 다룬다.

## tsc 컴파일러 내부 파이프라인

`tsc`는 단순히 "타입을 제거하는 도구"가 아니다. 내부적으로 정교한 파이프라인을 거친다.

![tsc 컴파일러 내부 파이프라인](/assets/posts/ts-compiler-tsc-pipeline.svg)

**파이프라인 5단계:**

1. **스캐너(Scanner)**: 소스 코드를 토큰으로 분해
2. **파서(Parser)**: 토큰으로 AST(추상 구문 트리) 생성
3. **바인더(Binder)**: 변수 선언을 심볼 테이블에 등록, 스코프 분석
4. **타입 검사기(Type Checker)**: 타입 추론 및 오류 탐지 — 파이프라인의 핵심
5. **에미터(Emitter)**: 타입 정보를 제거한 `.js` 파일과 `.d.ts` 파일 생성

TypeScript가 "느리다"고 느껴지는 이유는 대부분 4단계 **타입 검사기**다. 타입 추론은 프로그래밍 언어 이론의 복잡한 연산이다. 대규모 코드베이스에서 빌드 속도 최적화가 필요하면 타입 검사와 코드 생성을 분리하는 전략을 쓴다.

## 컴파일 결과 살펴보기

```typescript
// 입력: src/example.ts
interface User {
  name: string;
  age: number;
}

const greeting = (user: User): string => {
  return `Hello, ${user.name}!`;
};

enum Direction {
  Up = "UP",
  Down = "DOWN",
}
```

```javascript
// 출력: dist/example.js (ES2022, commonjs 기준)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const greeting = (user) => {
    return `Hello, ${user.name}!`;
};
var Direction;
(function (Direction) {
    Direction["Up"] = "UP";
    Direction["Down"] = "DOWN";
})(Direction || (Direction = {}));
```

`interface`는 완전히 사라지고, `enum`은 IIFE 패턴으로 변환됐다. 타입 어노테이션도 없다.

## 자주 쓰는 tsc CLI 옵션

```bash
# 기본 빌드 (tsconfig.json 읽음)
npx tsc

# 감시 모드 (파일 변경 감지 → 자동 재빌드)
npx tsc --watch
npx tsc -w

# 타입 검사만 (JS 파일 생성 안 함)
npx tsc --noEmit

# 단일 파일 컴파일 (tsconfig 무시)
npx tsc src/index.ts --target ES2020 --module commonjs

# 현재 적용 중인 tsconfig 확인
npx tsc --showConfig

# 진단 정보 출력 (속도 분석)
npx tsc --diagnostics

# 자세한 컴파일 정보
npx tsc --verbose
```

## tsc의 두 가지 역할 분리

`tsc`는 두 가지 역할을 한다: **타입 검사**와 **코드 생성**. 현대 워크플로우에서는 이 두 역할을 분리하는 것이 일반적이다.

![tsc의 두 가지 역할 분리](/assets/posts/ts-compiler-tsc-modes.svg)

**이유:** `tsc`의 코드 생성은 `esbuild`, `SWC`, `Vite` 같은 도구보다 10~100배 느리다. 반면 타입 검사는 `tsc` 외에 대안이 없다. 따라서 개발 서버와 빌드에는 빠른 도구를 쓰고, CI에서 `tsc --noEmit`으로 타입을 검사하는 전략이 널리 쓰인다.

```json
// package.json 스크립트 분리
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "ci": "tsc --noEmit && vitest run"
  }
}
```

## tsconfig extends와 공유 설정

여러 패키지가 있는 모노레포나 팀 공통 설정을 만들 때는 `extends`를 활용한다.

```json
// tsconfig.base.json (공통 설정)
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

```json
// tsconfig.json (프로젝트별 설정)
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "commonjs"
  }
}
```

`@tsconfig/recommended`, `@tsconfig/node22` 같은 공식 기본 설정 패키지도 있다.

```bash
npm install --save-dev @tsconfig/node22
```

```json
{
  "extends": "@tsconfig/node22/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## 컴파일 오류 이해하기

`tsc`가 출력하는 오류 메시지는 처음엔 낯설다. 패턴을 이해하면 읽기 쉬워진다.

```typescript
// 오류 예시 코드
let x: number = "hello";
```

```
src/index.ts:1:5 - error TS2322: Type 'string' is not assignable to type 'number'.

1 let x: number = "hello";
      ~
```

`TS2322`는 TypeScript 오류 코드다. [TypeScript Error Decoder](https://ts.errors.wtf/)나 공식 문서에서 코드로 검색하면 상세 설명을 찾을 수 있다. 자주 보는 오류 코드들:
- `TS2322`: 타입 불일치
- `TS2339`: 존재하지 않는 프로퍼티
- `TS2345`: 함수 인수 타입 불일치
- `TS7006`: 암묵적 `any` (`noImplicitAny`)
- `TS2531`: `null` 가능성 (`strictNullChecks`)

## 증분 컴파일과 빌드 캐시

대규모 프로젝트에서 `tsc`를 빠르게 하려면 증분 컴파일을 활성화한다.

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

`.tsBuildInfo` 파일에 이전 빌드 정보를 저장해 변경된 파일만 재컴파일한다. `.gitignore`에 `.tsbuildinfo`를 추가하는 것이 일반적이다.

## 정리

`tsc`는 타입 검사기이자 코드 생성기다. 현대 프로젝트에서는 `tsc --noEmit`으로 타입 검사, Vite/esbuild로 번들링을 분리하는 전략이 표준이다. 오류 코드를 이해하고, `incremental` 설정으로 빌드 속도를 최적화할 수 있다.

---

**지난 글:** [TypeScript 설치와 환경 설정](/posts/ts-setup-install/)

**다음 글:** [TypeScript Playground 활용](/posts/ts-playground-repl/)

<br>
읽어주셔서 감사합니다. 😊
