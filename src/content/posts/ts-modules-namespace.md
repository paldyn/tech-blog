---
title: "모듈과 네임스페이스 — TypeScript 코드 구조화"
description: "TypeScript의 ESM 모듈 시스템, import type, 모듈 보강, 네임스페이스, .d.ts 타입 선언 파일 작성, 경로 별칭 설정까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "모듈", "네임스페이스", "import-type", "declaration", "경로별칭", ".d.ts"]
featured: false
draft: false
---

[지난 글](/posts/ts-discriminated-union/)에서 판별 유니언으로 상태를 모델링하는 방법을 배웠다. 이번에는 TypeScript 코드를 파일 단위로 구조화하는 **모듈 시스템**과 **네임스페이스**를 살펴본다. JavaScript의 ESM을 기반으로 하면서 타입 정보를 추가하는 TypeScript만의 방식을 이해하는 것이 핵심이다.

## 스크립트 vs 모듈

TypeScript 파일은 두 가지 모드 중 하나로 동작한다.

```typescript
// 스크립트 모드: import/export 없음 → 전역 스코프
// 어떤 파일에서나 접근 가능 (비권장)
var globalVar = "I'm global";

// 모듈 모드: import 또는 export 존재 → 로컬 스코프
export const localVar = "I'm local";  // 이 파일에서만
```

`tsconfig.json`의 `"module": "NodeNext"` 또는 `"module": "ESNext"` 설정이 모듈 해석 방식을 결정한다.

## import type과 export type

TypeScript 3.8에서 도입된 `import type`은 타입 정보만 가져오며 런타임 코드가 생성되지 않는다.

```typescript
// 값 + 타입 (런타임 코드 포함)
import { createUser } from "./user";

// 타입만 (런타임 코드 없음, 번들 크기 영향 없음)
import type { User, UserId } from "./types";

// 인라인 타입 지정자 (TS 4.5+)
import { type User, createUser } from "./user";
```

`verbatimModuleSyntax`(TypeScript 5.0+) 옵션을 켜면 타입 import/export에 반드시 `type`을 명시해야 한다. 번들러가 사용하지 않는 임포트를 정확히 제거할 수 있어 권장된다.

![모듈 import/export](/assets/posts/ts-modules-namespace-esm.svg)

## 모듈 보강 (Module Augmentation)

기존 모듈의 타입 정의를 확장할 수 있다. 라이브러리 타입에 속성을 추가할 때 유용하다.

```typescript
// express.d.ts (또는 프로젝트 내 타입 파일)
import { Request } from "express";

declare module "express" {
  interface Request {
    user?: AuthUser;       // req.user 타입 추가
    requestId: string;     // 미들웨어가 주입하는 필드
  }
}
```

`declare module`로 감싸고 파일에 최소 하나의 `import` 또는 `export`가 있어야 모듈 모드로 동작한다.

## 전역 타입 보강

```typescript
// global.d.ts
declare global {
  interface Window {
    analytics: Analytics;
    __APP_CONFIG__: AppConfig;
  }

  // 전역 함수 타입 추가
  function myPolyfill(x: string): string;
}

export {};  // 모듈 모드 활성화용
```

## 네임스페이스

네임스페이스는 TypeScript 초기 방식으로, 단일 파일이나 전역 스코프에서 코드를 그룹화한다. 현재는 ESM 모듈로 대체되었지만 `.d.ts` 파일 작성이나 레거시 코드에서 여전히 등장한다.

```typescript
namespace Validation {
  export interface StringValidator {
    isAcceptable(s: string): boolean;
  }

  const letterRegexp = /^[A-Za-z]+$/;
  export class LettersOnlyValidator implements StringValidator {
    isAcceptable(s: string) { return letterRegexp.test(s); }
  }
}

const validator: Validation.StringValidator = new Validation.LettersOnlyValidator();
```

## 타입 선언 파일 (.d.ts)

JavaScript 라이브러리에 타입을 추가하거나, 빌드 결과물로 타입만 배포할 때 `.d.ts` 파일을 작성한다.

```typescript
// my-lib.d.ts
declare module "my-lib" {
  export interface Config {
    timeout: number;
    retries?: number;
  }

  export function init(config: Config): void;
  export function fetch<T>(url: string): Promise<T>;

  export default class Client {
    constructor(config: Config);
    get<T>(path: string): Promise<T>;
  }
}
```

`@types/` 패키지(`@types/node`, `@types/react` 등)가 바로 이런 `.d.ts` 파일 모음이다.

![네임스페이스와 선언](/assets/posts/ts-modules-namespace-declaration.svg)

## 경로 별칭 설정

절대 경로 스타일의 임포트를 사용하려면 `tsconfig.json`에서 `paths`를 설정한다.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@types/*": ["./src/types/*"]
    }
  }
}
```

```typescript
// 상대 경로 대신
import { Button } from "../../../components/Button";

// 별칭 사용
import { Button } from "@components/Button";
import type { User } from "@types/user";
```

단, `paths`는 TypeScript 컴파일러에게만 알려주는 것이므로, 런타임(Node.js, 번들러)에서도 동작하려면 별도 설정이 필요하다. Vite는 `vite.config.ts`의 `resolve.alias`, Node.js는 패키지 `imports` 필드를 사용한다.

## 재내보내기 패턴

```typescript
// src/index.ts — public API 집약점
export { createUser, deleteUser } from "./user";
export type { User, UserId } from "./types";
export * from "./utils";
export { default as UserService } from "./UserService";
```

배럴(barrel) 파일이라 불리는 이 패턴은 공개 API를 한 곳에서 관리하지만, 과도하게 사용하면 번들러의 트리 셰이킹을 방해하므로 라이브러리 진입점에만 제한적으로 사용하는 것이 좋다. 다음 글에서는 TypeScript 데코레이터를 살펴본다.

---

**지난 글:** [판별 유니언 — 타입 안전한 상태 모델링](/posts/ts-discriminated-union/)

**다음 글:** [데코레이터 — 클래스와 멤버에 메타데이터 주입](/posts/ts-decorators/)

<br>
읽어주셔서 감사합니다. 😊
