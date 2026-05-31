---
title: "TypeScript 컴파일러 tsc 완전 해설"
description: "tsc 컴파일러의 내부 처리 흐름, 주요 CLI 플래그, 출력 파일 종류(.js/.d.ts/.map)를 상세히 설명합니다. tsconfig와 CLI 옵션 우선순위도 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "tsc", "컴파일러", "tsconfig", "빌드"]
featured: false
draft: false
---

[지난 글](/posts/ts-setup-install/)에서 TypeScript 설치와 기본 환경 설정을 완료했다. 이번에는 TypeScript 컴파일러 `tsc`가 어떻게 동작하는지, 어떤 옵션들이 있는지 더 깊이 들어가 본다.

## tsc가 하는 일

`tsc`는 TypeScript 컴파일러다. 크게 두 가지 역할을 한다.

1. **타입 검사** — TypeScript 코드를 분석해 타입 오류를 찾는다
2. **코드 변환** — TypeScript 코드를 JavaScript로 변환(방출)한다

중요한 점은 이 두 역할이 독립적이라는 것이다. `--noEmit` 플래그를 쓰면 타입 검사만 하고 파일을 출력하지 않는다. CI/CD 파이프라인에서 타입 검사를 별도 단계로 실행할 때 유용하다.

![tsc 내부 처리 흐름](/assets/posts/ts-compiler-tsc-pipeline.svg)

## 내부 처리 단계

`tsc`는 소스 파일을 다음 순서로 처리한다.

**1. 설정 로드** — `tsconfig.json` 을 읽어 컴파일 옵션과 대상 파일 목록을 결정한다.

**2. 파싱** — `.ts` 파일을 읽어 AST(Abstract Syntax Tree)를 만든다. 이 단계에서 문법 오류를 잡는다.

**3. 바인딩** — AST를 순회하며 심벌 테이블을 만든다. 변수, 함수, 클래스 등의 선언을 기록한다.

**4. 타입 검사** — 심벌 테이블과 AST를 바탕으로 타입 오류를 찾는다. 가장 많은 시간이 걸리는 단계다.

**5. 방출(Emit)** — 타입 정보를 제거하고 `.js` 파일을 생성한다. `--declaration` 옵션이 있으면 `.d.ts` 도 함께 생성한다.

## 주요 CLI 플래그

`tsconfig.json` 에 설정하는 것과 동일한 옵션을 CLI에서 직접 지정할 수도 있다. CLI 인자는 `tsconfig.json` 보다 높은 우선순위를 갖는다.

```bash
# 단일 파일 컴파일
tsc src/index.ts

# watch 모드 — 파일 변경 시 자동 재컴파일
tsc --watch

# 타입 검사만 (파일 출력 없음)
tsc --noEmit

# 출력 버전 지정
tsc --target ES2022

# 출력 디렉터리 지정
tsc --outDir dist

# 다른 tsconfig 사용
tsc --project tsconfig.prod.json
```

![tsc 주요 플래그와 옵션](/assets/posts/ts-compiler-tsc-flags.svg)

## 출력 파일 종류

`tsc`가 생성하는 파일은 세 가지다.

### .js — 실행 가능한 JavaScript

기본 출력이다. TypeScript 문법이 제거된 순수 JavaScript다.

```typescript
// 입력: src/greeting.ts
function greet(name: string): string {
  return `Hello, ${name}!`;
}
export { greet };
```

```javascript
// 출력: dist/greeting.js (ES2022 target)
function greet(name) {
  return `Hello, ${name}!`;
}
export { greet };
```

### .d.ts — 타입 선언 파일

`--declaration` 옵션을 켜면 생성된다. JavaScript 파일 사용자가 TypeScript에서 타입 정보를 활용할 수 있도록 타입만 추출한 파일이다. npm 패키지를 TypeScript로 배포할 때 필수다.

```typescript
// 생성: dist/greeting.d.ts
declare function greet(name: string): string;
export { greet };
```

### .js.map — 소스맵

`--sourceMap` 옵션을 켜면 생성된다. 컴파일된 JS 코드와 원본 TS 코드의 줄 번호 매핑 정보를 담는다. 디버거에서 `.js` 파일을 실행할 때 원본 `.ts` 파일의 줄 번호를 보여 준다.

## 타입 오류와 컴파일 관계

기본적으로 타입 오류가 있으면 `tsc`는 `.js` 파일을 생성하지 않는다. 하지만 `noEmitOnError` 를 `false` 로 설정하면 오류가 있어도 JS를 출력한다.

```json
{
  "compilerOptions": {
    "noEmitOnError": false
  }
}
```

이 설정은 기존 JavaScript 프로젝트를 TypeScript로 점진적으로 전환할 때 유용하다. 일단 컴파일은 통과시키면서 타입 오류를 하나씩 해결할 수 있다.

## tsconfig vs CLI 우선순위

같은 옵션이 tsconfig와 CLI 양쪽에 있을 때는 **CLI 인자가 우선** 한다.

```bash
# tsconfig에 "target": "ES2015" 설정되어 있어도
# 아래 명령은 ES2022로 컴파일
tsc --target ES2022
```

단, `--project` 또는 `-p` 플래그로 tsconfig 파일을 명시적으로 지정하면 해당 tsconfig의 설정이 사용된다.

## 성능 팁

큰 프로젝트에서 컴파일이 느리다면:

- `--skipLibCheck` — `node_modules` 안의 `.d.ts` 타입 검사를 건너뜀. 빌드 시간을 크게 줄일 수 있다
- `--incremental` — 이전 컴파일 결과를 캐시해 변경된 파일만 재컴파일
- 프로젝트 참조(`references`) — 대규모 모노레포에서 부분 컴파일

다음 글에서는 설치 없이 브라우저에서 TypeScript를 바로 실험할 수 있는 TypeScript Playground를 소개한다.

---

**지난 글:** [TypeScript 설치와 환경 구성 완전 가이드](/posts/ts-setup-install/)

**다음 글:** [TypeScript Playground — 브라우저에서 바로 실험하기](/posts/ts-playground-repl/)

<br>
읽어주셔서 감사합니다. 😊
