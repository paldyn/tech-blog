---
title: "TypeScript 컴파일러 tsc 완전 이해"
description: "tsc의 내부 동작 원리와 파이프라인, 주요 컴파일러 플래그, 그리고 효율적인 빌드 설정 방법을 심층적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "tsc", "컴파일러", "tsconfig", "빌드"]
featured: false
draft: false
---

[지난 글](/posts/ts-setup-install/)에서 TypeScript 환경을 설정했습니다. 이번에는 `tsc`가 내부적으로 어떻게 동작하는지, 그리고 다양한 컴파일러 옵션을 어떻게 활용하는지 깊이 들어가 보겠습니다.

![TypeScript 컴파일러 파이프라인](/assets/posts/ts-compiler-tsc-pipeline.svg)

## tsc의 내부 5단계

TypeScript 컴파일러는 `.ts` 파일을 받아 `.js`로 변환하기까지 다음 5단계를 거칩니다.

**1단계 — 파싱(Parsing)**: 소스 코드를 토큰으로 분해하고 AST(Abstract Syntax Tree)를 구성합니다. 문법 오류는 이 단계에서 발견됩니다.

**2단계 — 바인딩(Binding)**: 심볼 테이블을 구성하고 변수, 함수, 클래스의 스코프를 분석합니다. 같은 이름의 중복 선언 오류가 이 단계에서 나타납니다.

**3단계 — 타입 검사(Type Checking)**: TypeScript의 핵심 단계입니다. 수집된 타입 정보를 바탕으로 타입 불일치, null 참조, 잘못된 속성 접근 등을 감지합니다.

**4단계 — 변환(Transformation)**: 타입 어노테이션을 제거하고, ES2015+ 문법을 target 버전에 맞게 다운레벨 변환합니다.

**5단계 — 출력(Emit)**: `.js` 파일과 선택적으로 `.d.ts`(타입 선언), `.js.map`(소스맵) 파일을 생성합니다.

```bash
# 타입 검사만 (파일 미생성) — CI에서 유용
npx tsc --noEmit

# 전체 컴파일
npx tsc

# 변경 감지 자동 재컴파일
npx tsc --watch
```

## tsconfig.json 핵심 옵션

![tsconfig.json 핵심 옵션](/assets/posts/ts-compiler-tsc-flags.svg)

### target: 출력 JavaScript 버전

```json
{
  "compilerOptions": {
    "target": "ES2020"
  }
}
```

`target`은 컴파일 후 출력되는 JavaScript의 문법 버전을 지정합니다. `async/await`, `class`, 화살표 함수 등의 문법이 지정한 버전으로 다운레벨 변환됩니다.

```typescript
// 소스 (TypeScript)
const arr = [1, 2, 3];
const doubled = arr.map(n => n * 2);
```

```javascript
// target: ES5 출력
var arr = [1, 2, 3];
var doubled = arr.map(function(n) { return n * 2; });

// target: ES2020 출력 (거의 그대로)
const arr = [1, 2, 3];
const doubled = arr.map(n => n * 2);
```

### module: 모듈 시스템

```json
"module": "commonjs"    // Node.js 기본
"module": "ESNext"      // 브라우저 / 최신 번들러
"module": "Node16"      // Node.js 16+의 ESM 지원
```

Node.js 백엔드는 `commonjs`, 브라우저 앱(Vite, webpack 등)은 `ESNext` 또는 `ES2020`을 사용합니다.

### strict: 엄격 모드 플래그 번들

```typescript
// strictNullChecks 효과
function getLength(str: string | null): number {
  // strict 없으면: str.length (null 가능성 무시)
  // strict 있으면: null 체크 강제
  return str?.length ?? 0;
}

// noImplicitAny 효과
function process(data) {     // ❌ strict: data에 any 암시됨
  return data.value;
}
function process(data: unknown) { // ✅ 명시적 타입 필요
  if (typeof data === "object" && data !== null) {
    return (data as { value: unknown }).value;
  }
}
```

### paths: 모듈 경로 별칭

긴 상대 경로 대신 별칭을 사용할 수 있습니다.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/utils/*": ["src/utils/*"],
      "@/types/*": ["src/types/*"]
    }
  }
}
```

```typescript
// 이전: 상대 경로
import { formatDate } from "../../../utils/date";

// 이후: 별칭 사용
import { formatDate } from "@/utils/date";
```

## 여러 환경을 위한 tsconfig 분리

프로젝트가 커지면 환경별로 tsconfig를 분리하는 패턴이 유용합니다.

```
tsconfig.json          # 기본 (공통 설정)
tsconfig.build.json    # 프로덕션 빌드용
tsconfig.dev.json      # 개발용 (sourceMap, incremental)
```

```json
// tsconfig.build.json: 기본 설정을 상속
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "sourceMap": false
  },
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

## incremental 빌드로 속도 개선

대규모 프로젝트에서는 증분 빌드를 활성화해 컴파일 속도를 크게 향상시킬 수 있습니다.

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

첫 컴파일 이후 변경된 파일만 재컴파일하므로 대형 프로젝트에서 빌드 시간이 50~80% 단축됩니다.

## tsc vs 번들러의 타입 검사

실제 프로젝트에서는 tsc 대신 esbuild나 SWC로 트랜스파일하고, 타입 검사만 tsc에 위임하는 패턴이 많습니다.

```bash
# Vite + TypeScript의 일반적인 workflow
vite build          # esbuild로 빠른 번들링 (타입 무시)
tsc --noEmit        # 타입 검사만 별도 실행 (CI에서)
```

이 방식으로 개발 서버 시작과 HMR 속도를 극대화하면서, CI 파이프라인에서 정확한 타입 검사를 보장할 수 있습니다.

---

**지난 글:** [TypeScript 설치 및 환경 설정 — 처음부터 시작하기](/posts/ts-setup-install/)

**다음 글:** [TypeScript Playground — 브라우저에서 즉시 실험하기](/posts/ts-playground-repl/)

<br>
읽어주셔서 감사합니다. 😊
