---
title: "tsc 컴파일러 완전 해부: 동작 원리와 옵션"
description: "TypeScript 컴파일러 tsc의 내부 파이프라인, 핵심 플래그 사용법, tsconfig.json 주요 옵션을 깊이 있게 다룬다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "tsc", "컴파일러", "tsconfig", "빌드", "타입검사"]
featured: false
draft: false
---

[지난 글](/posts/ts-setup-install/)에서 TypeScript 개발 환경을 구성했다. 이번 편에서는 `tsc` 컴파일러가 내부적으로 어떻게 동작하는지, 그리고 실무에서 자주 쓰는 옵션과 플래그를 체계적으로 정리한다.

## tsc 컴파일 파이프라인

TypeScript 컴파일러는 소스 파일을 받아 4단계로 처리한다.

![tsc 컴파일러 파이프라인](/assets/posts/ts-compiler-tsc-pipeline.svg)

### ① 파싱 (Parsing)

소스 코드를 읽어 **추상 구문 트리(AST, Abstract Syntax Tree)**로 변환한다. 이 단계에서 구문 오류(SyntaxError)가 검출된다.

### ② 심볼 해석 (Symbol Resolution)

변수, 함수, 타입 선언을 스코프와 연결한다. "이 `name`이라는 변수는 어디서 선언됐는가"를 추적한다.

### ③ 타입 검사 (Type Checking)

이 단계가 TypeScript의 핵심이다. 모든 표현식의 타입을 계산하고, 타입 규칙을 위반하는 코드를 찾아낸다. 타입 에러는 여기서 발생한다.

### ④ 출력 (Emit)

타입 정보를 제거하고 JavaScript 파일을 생성한다. 선택적으로 `.d.ts` 타입 선언 파일과 소스맵(`.js.map`)도 생성할 수 있다.

## 주요 CLI 플래그

```bash
# 기본 컴파일 (tsconfig.json 사용)
npx tsc

# 특정 파일만 컴파일 (tsconfig 무시)
npx tsc src/index.ts

# 파일 변경 감지 모드
npx tsc --watch

# 타입 검사만 수행 (파일 출력 없음)
npx tsc --noEmit

# 상세 출력 보기
npx tsc --listFiles
```

`--noEmit`은 CI 파이프라인에서 타입 검사 단계에 자주 쓰인다. 파일을 생성하지 않고 타입 오류만 체크한다.

## tsconfig.json 핵심 옵션

![tsconfig.json 핵심 옵션](/assets/posts/ts-compiler-tsc-config.svg)

### 출력 제어 옵션

```json
{
  "compilerOptions": {
    "target": "ES2020",          // 출력 JS 버전
    "module": "NodeNext",        // 모듈 시스템
    "moduleResolution": "NodeNext",  // 모듈 탐색 방식
    "outDir": "./dist",          // 출력 디렉터리
    "rootDir": "./src",          // 소스 루트
    "declaration": true,         // .d.ts 생성
    "declarationMap": true,      // 선언 파일 소스맵
    "sourceMap": true            // .js.map 소스맵
  }
}
```

`target` 값에 따라 tsc가 최신 JS 문법을 하위 호환 코드로 변환한다. 예를 들어 `target: "ES5"`로 설정하면 화살표 함수가 일반 함수로 변환된다.

### 엄격 모드 옵션

`"strict": true`는 6개의 하위 옵션을 한번에 켠다.

```json
{
  "compilerOptions": {
    "strict": true
    // 아래 6개를 모두 켜는 것과 동일:
    // "noImplicitAny": true,
    // "strictNullChecks": true,
    // "strictFunctionTypes": true,
    // "strictBindCallApply": true,
    // "strictPropertyInitialization": true,
    // "noImplicitThis": true
  }
}
```

이 중 가장 중요한 두 가지:

**`noImplicitAny`**: 타입을 추론할 수 없을 때 `any`로 묵시적 처리하는 것을 금지한다.

```typescript
// noImplicitAny: true일 때 에러
function greet(name) {  // Error: Parameter 'name' implicitly has an 'any' type
  return `Hello, ${name}`;
}

// 명시적 타입 추가 필요
function greet(name: string) {
  return `Hello, ${name}`;
}
```

**`strictNullChecks`**: `null`과 `undefined`를 다른 타입에 할당할 수 없게 한다.

```typescript
// strictNullChecks: true일 때
let name: string = null;  // Error: Type 'null' is not assignable to type 'string'

// null을 허용하려면 유니언 타입 사용
let name: string | null = null;  // OK
```

### 모듈 관련 옵션

```json
{
  "compilerOptions": {
    "esModuleInterop": true,              // CommonJS 모듈 기본 import 허용
    "allowSyntheticDefaultImports": true, // 기본 export 없어도 default import 허용
    "resolveJsonModule": true,            // .json 파일 import 허용
    "paths": {                            // 경로 별칭
      "@/*": ["./src/*"]
    }
  }
}
```

`esModuleInterop`은 `import fs from 'fs'`처럼 CommonJS 모듈을 기본(default) import 방식으로 쓸 수 있게 해준다.

### 추가 검사 옵션

```json
{
  "compilerOptions": {
    "noUnusedLocals": true,          // 사용하지 않는 지역변수 에러
    "noUnusedParameters": true,      // 사용하지 않는 파라미터 에러
    "noImplicitReturns": true,       // 함수가 항상 값을 반환해야 함
    "noFallthroughCasesInSwitch": true  // switch 폴스루 금지
  }
}
```

이 옵션들은 `strict`에 포함되지 않지만 코드 품질에 크게 기여한다.

## 여러 tsconfig 파일 관리

프로젝트가 커지면 환경별로 다른 설정이 필요하다.

```json
// tsconfig.base.json - 공통 설정
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true,
    "lib": ["ES2020"]
  }
}

// tsconfig.json - 개발 환경
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "sourceMap": true
  },
  "include": ["src"]
}

// tsconfig.prod.json - 프로덕션 빌드
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true
  }
}
```

`extends`로 기본 설정을 상속하고 각 환경에 필요한 옵션만 오버라이드한다.

## 성능 최적화: incremental 컴파일

큰 프로젝트에서 컴파일 속도를 높이려면 증분 컴파일을 활성화한다.

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  }
}
```

이전 컴파일 정보를 `.tsbuildinfo`에 캐시해서 변경된 파일만 재컴파일한다.

다음 편에서는 설치 없이 브라우저에서 TypeScript를 바로 실험할 수 있는 TypeScript Playground를 소개한다.

---

**지난 글:** [TypeScript 설치와 환경 구성: 첫 발을 내딛다](/posts/ts-setup-install/)

**다음 글:** [TypeScript Playground: 브라우저에서 즉시 실험하기](/posts/ts-playground-repl/)

<br>
읽어주셔서 감사합니다. 😊
