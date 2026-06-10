---
title: "tsc 컴파일러 완전 이해"
description: "TypeScript 컴파일러 tsc의 내부 파이프라인, 주요 CLI 옵션, tsconfig.json 핵심 설정을 이해합니다. noEmit, incremental 빌드, watch 모드까지 실용적인 사용법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "tsc", "컴파일러", "tsconfig", "빌드", "파이프라인"]
featured: false
draft: false
---

[지난 글](/posts/ts-setup-install/)에서 TypeScript 설치와 환경 구성을 마쳤습니다. 이번 글에서는 TypeScript 컴파일러 `tsc`가 내부적으로 어떻게 동작하는지, 어떤 옵션들이 있는지 자세히 살펴봅니다.

## tsc 컴파일 파이프라인

TypeScript 컴파일러는 소스 파일을 읽어서 JavaScript를 출력하기까지 여러 단계를 거칩니다.

![tsc 컴파일러 파이프라인](/assets/posts/ts-compiler-tsc-pipeline.svg)

1. **스캐너(Scanner)**: 소스 코드를 토큰(예약어, 식별자, 연산자 등)으로 분리
2. **파서(Parser)**: 토큰을 추상 구문 트리(AST, Abstract Syntax Tree)로 변환
3. **바인더(Binder)**: 심볼 테이블 구성, 스코프 분석, 선언과 참조 연결
4. **타입 검사기(Type Checker)**: 타입 추론 실행, 타입 오류 탐지, 타입 호환성 검사
5. **이미터(Emitter)**: AST를 JavaScript(.js), 타입 선언(.d.ts), 소스맵(.map)으로 출력

이 파이프라인을 이해하면 `tsc`의 옵션이 어느 단계에 영향을 주는지 파악할 수 있습니다.

## 주요 CLI 명령

```bash
# 기본 컴파일 (tsconfig.json 기준)
npx tsc

# 특정 파일 컴파일 (tsconfig.json 무시)
npx tsc src/index.ts

# 타입 검사만 (JS 출력 없음) — CI에서 주로 사용
npx tsc --noEmit

# 파일 변경 감지 자동 재컴파일
npx tsc --watch

# tsconfig.json 생성
npx tsc --init

# 현재 tsconfig 설정 확인
npx tsc --showConfig

# 특정 tsconfig 지정
npx tsc --project tsconfig.prod.json
```

## tsconfig.json 핵심 옵션

![tsconfig 핵심 옵션](/assets/posts/ts-compiler-tsc-options.svg)

### 출력 관련 옵션

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationDir": "./types",
    "sourceMap": true,
    "noEmit": false
  }
}
```

- `target`: 출력 JavaScript의 ECMAScript 버전. `ES2022`는 최신 Node.js LTS에서 지원
- `module`: 모듈 시스템. Node.js 18+는 `NodeNext` 또는 `Node16`
- `declaration`: `.d.ts` 타입 선언 파일 생성. 라이브러리 배포 시 필수
- `sourceMap`: `.map` 파일 생성. 디버깅 시 TS 소스 위치를 JS 실행 위치에 매핑

### strict 모드 플래그

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

`strict: true`는 여러 엄격 검사 플래그를 한 번에 활성화합니다.

- `strictNullChecks`: `null`과 `undefined`를 독립된 타입으로 취급
- `noImplicitAny`: 타입 추론 불가 시 암묵적 `any` 금지
- `strictFunctionTypes`: 함수 매개변수 공변/반변 엄격 검사
- `useUnknownInCatchVariables`: catch 블록 변수를 `any` 대신 `unknown`으로

신규 프로젝트라면 반드시 `strict: true`로 시작하는 것을 권장합니다.

### 경로 관련 옵션

```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@utils/*": ["utils/*"],
      "@types/*": ["types/*"]
    }
  }
}
```

`paths`로 절대 경로 임포트를 설정할 수 있습니다. 단, 런타임에서 경로 해석은 tsc가 하지 않으므로 webpack/vite/tsconfig-paths 등의 추가 설정이 필요합니다.

## noEmit과 번들러 조합

현대 프론트엔드 개발에서 TypeScript 컴파일은 주로 Vite, webpack, esbuild 같은 번들러가 담당합니다. 이 경우 `tsc`는 타입 검사 역할만 합니다.

```json
{
  "compilerOptions": {
    "noEmit": true,
    "strict": true
  }
}
```

```bash
# CI 파이프라인에서
npx tsc --noEmit  # 타입 오류 있으면 exit code 1로 종료
```

## incremental 빌드

대규모 프로젝트에서 컴파일 속도를 높이려면 `incremental` 빌드를 활성화합니다.

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  }
}
```

처음 빌드 후 `.tsbuildinfo` 파일에 상태를 저장하고, 변경된 파일만 재컴파일합니다. 대형 코드베이스에서 빌드 시간을 50~80% 단축할 수 있습니다.

`tsc`는 단순한 변환 도구가 아닙니다. 프로젝트의 타입 안전성을 보장하는 게이트키퍼 역할을 합니다. 옵션을 잘 이해하면 빌드 속도와 타입 안전성 모두를 최적화할 수 있습니다.

---

**지난 글:** [TypeScript 설치와 환경 구성](/posts/ts-setup-install/)

**다음 글:** [TypeScript Playground로 빠르게 배우기](/posts/ts-playground-repl/)

<br>
읽어주셔서 감사합니다. 😊
