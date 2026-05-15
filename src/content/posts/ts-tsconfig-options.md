---
title: "tsconfig 완전 정복 — 컴파일러 옵션 가이드"
description: "TypeScript tsconfig.json의 target, module, moduleResolution, strict 계열 옵션, 경로 설정, 프로젝트 참조까지 실무에서 자주 쓰는 옵션을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "tsconfig", "컴파일러옵션", "strict", "moduleResolution", "paths", "설정"]
featured: false
draft: false
---

[지난 글](/posts/ts-decorators/)에서 데코레이터 패턴과 실전 활용을 살펴봤다. 이번에는 TypeScript 프로젝트의 심장부인 **`tsconfig.json`**을 체계적으로 정리한다. 컴파일러 옵션을 제대로 이해하면 타입 안전성, 빌드 속도, 모듈 호환성 문제를 사전에 방지할 수 있다.

## tsconfig.json 기본 구조

```json
{
  "compilerOptions": {
    // 컴파일러 동작 제어
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "references": []
}
```

`include`와 `exclude`로 컴파일 대상 파일을 지정한다. `files`로 개별 파일을 명시적으로 나열할 수도 있다.

## target — 출력 자바스크립트 버전

```json
{
  "target": "ES2022"
}
```

`target`은 TypeScript가 생성하는 JavaScript의 버전을 지정한다. Node.js 18+ 환경이라면 `ES2022`, 브라우저 지원이 필요하다면 번들러가 트랜스파일을 담당하므로 `ESNext`로 설정해도 무방하다. `target`에 따라 일부 문법(클래스 필드, `??=` 등)이 트랜스파일되거나 그대로 출력된다.

## module과 moduleResolution

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

`module`은 emit되는 모듈 형식, `moduleResolution`은 `import` 경로를 해석하는 방식이다. 두 옵션은 반드시 쌍을 맞춰야 한다.

| 환경 | module | moduleResolution |
|---|---|---|
| Node.js ESM | NodeNext | NodeNext |
| Node.js CJS | CommonJS | Node |
| Vite/Webpack | ESNext | Bundler |
| 라이브러리 | ESNext | Bundler |

`Bundler` 전략은 번들러가 해석을 담당하므로 `.js` 확장자 없이 import할 수 있다.

![tsconfig 컴파일러 옵션](/assets/posts/ts-tsconfig-options-compiler.svg)

## lib — 타입 정의 포함

```json
{
  "lib": ["ES2022", "DOM", "DOM.Iterable"]
}
```

`lib`는 코드에서 사용할 수 있는 전역 타입을 결정한다. `DOM`이 없으면 `document`, `window`에 접근할 수 없다. Node.js 전용 프로젝트에서는 `DOM`을 제거하고 `@types/node`를 사용한다.

## strict 계열 옵션

`"strict": true` 하나로 가장 중요한 8가지 검사가 활성화된다.

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

`noUncheckedIndexedAccess`는 배열/객체 인덱스 접근 시 `T | undefined`를 반환해 런타임 오류를 방지한다. `exactOptionalPropertyTypes`는 `?` 속성에 `undefined`를 명시적으로 구분한다.

![strict 옵션 목록](/assets/posts/ts-tsconfig-options-strict.svg)

## 경로 별칭

```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"],
    "@lib/*": ["./src/lib/*"]
  }
}
```

`paths`는 TypeScript 컴파일러에게만 영향을 미치므로, 런타임 해석은 번들러나 Node.js 설정에서 별도로 처리해야 한다.

## 빌드 성능 옵션

```json
{
  "incremental": true,
  "tsBuildInfoFile": ".tsbuildinfo",
  "skipLibCheck": true
}
```

`incremental`은 이전 빌드 정보를 캐시해 재빌드 속도를 높인다. `skipLibCheck`는 `node_modules`의 `.d.ts` 파일 검사를 건너뛰어 빌드 시간을 단축한다.

## 프로젝트 참조 (Project References)

모노레포 환경에서 여러 패키지가 서로 참조할 때 사용한다.

```json
// packages/app/tsconfig.json
{
  "references": [
    { "path": "../shared" },
    { "path": "../api" }
  ]
}
```

```bash
tsc --build  # 참조 그래프를 추적해 필요한 패키지만 빌드
```

## verbatimModuleSyntax (TS 5.0+)

```json
{
  "verbatimModuleSyntax": true
}
```

이 옵션이 켜지면 타입 import에는 반드시 `import type`을 사용해야 한다. 번들러가 사용하지 않는 임포트를 제거할 때 타입 전용 임포트를 정확히 인식할 수 있어 권장된다.

## 프로젝트별 권장 설정

```json
// Node.js API 서버
{
  "extends": "@tsconfig/node22",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "./dist"
  }
}

// Vite React 프로젝트
{
  "extends": "@tsconfig/strictest",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

`@tsconfig/node22`, `@tsconfig/strictest` 같은 커뮤니티 베이스 설정을 `extends`로 상속하면 좋은 기본값에서 시작할 수 있다. 다음 글은 TypeScript 시리즈의 마지막 주제인 **점진적 도입 전략**이다.

---

**지난 글:** [데코레이터 — 클래스와 멤버에 메타데이터 주입](/posts/ts-decorators/)

**다음 글:** [TypeScript 점진적 도입 — JS 프로젝트에서 TS로](/posts/ts-incremental-adoption/)

<br>
읽어주셔서 감사합니다. 😊
