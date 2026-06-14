---
title: "verbatimModuleSyntax — 모듈 구문을 쓴 그대로"
description: "TypeScript 5.0의 verbatimModuleSyntax 옵션을 해부합니다. import elision의 문제, 옵션 하나로 통합된 규칙, CJS 출력에서의 동작, 도입 시 마주치는 에러와 해결법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "verbatimModuleSyntax", "import-elision", "isolatedModules", "tsconfig", "ESM"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-only-imports/)에서 `import type`이 파일 단위 트랜스파일러를 위한 구문이라는 것을 확인했다. 이번에는 그 연장선에 있는 컴파일러 옵션, TypeScript 5.0의 **`verbatimModuleSyntax`** 를 다룬다. 이름 그대로 "모듈 구문을 verbatim(쓴 그대로) 출력한다"는 옵션인데, 이 단순한 약속이 TypeScript 모듈 출력의 오래된 혼란을 한 번에 정리했다.

## 문제의 뿌리 — import elision이라는 추측

`verbatimModuleSyntax` 이전의 TypeScript는 import를 출력할지 말지를 **사용 패턴을 분석해서 추측**했다. 타입으로만 쓰인 import는 알아서 지우는, 이른바 import elision이다. 편리해 보이지만 부작용이 있다.

```typescript
// polyfill처럼 사이드 이펙트가 목적인 import가 아니라
// 바인딩을 가져오는 import에서 문제가 생긴다
import { initialize } from "./setup.js";
// initialize를 타입 위치에서만 썼다면? → import가 통째로 사라짐
// setup.js의 사이드 이펙트도 함께 증발
```

개발자가 쓴 import가 출력에 남을지 사라질지를 소스만 보고 알 수 없다는 것, 이것이 근본 문제였다. 이를 통제하려고 `importsNotUsedAsValues`, `preserveValueImports`라는 옵션이 차례로 추가됐지만, 두 옵션과 `isolatedModules`의 조합에 따라 동작이 달라지는 또 다른 미로가 만들어졌다.

![세 가지 레거시 옵션이 verbatimModuleSyntax 하나로 통합](/assets/posts/ts-verbatim-module-syntax-history.svg)

## 새로운 규칙 — 추측을 없앤다

TypeScript 5.0은 두 레거시 옵션을 deprecated 처리하고 `verbatimModuleSyntax` 하나로 교체했다. 규칙은 단 하나다.

```jsonc
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

- `type` 키워드가 **없는** import/export → 출력에 **그대로 유지** (사용 여부 분석 안 함)
- `type` 키워드가 **있는** import/export → 출력에서 **완전히 제거**

![verbatimModuleSyntax의 단일 규칙](/assets/posts/ts-verbatim-module-syntax-rule.svg)

이제 출력 JavaScript가 어떻게 생길지 소스 코드만 보고 100% 예측할 수 있다. 컴파일러의 추측이 사라진 자리에는 검사가 들어온다. 타입인 것을 `type` 없이 import하면 에러가 난다.

```typescript
import { User } from "./models.js";
// ❌ TS1484: 'User' is a type and must be imported using
//    a type-only import when 'verbatimModuleSyntax' is enabled.

import type { User } from "./models.js"; // ✅
```

귀찮은 강제가 아니라 일관성 보증이다. 이 검사를 통과한 코드는 esbuild, SWC, Babel 어떤 도구로 변환해도 동일한 결과가 나온다.

## 두 번째 효과 — ESM 구문과 CJS 출력의 분리

`verbatimModuleSyntax`에는 덜 알려진 강력한 동작이 하나 더 있다. **CommonJS로 컴파일되는 파일에서 ESM 구문 자체를 금지**한다.

```typescript
// module: "nodenext" + 이 파일이 CJS로 판정된 경우 (.cts 등)

import { readFile } from "fs";
// ❌ TS1286: ESM 구문은 CJS 출력에서 사용할 수 없음

import fs = require("fs");        // ✅ TS의 CJS 전용 구문
export = myFunction;               // ✅ CJS 스타일 내보내기
```

기존에는 ESM처럼 보이는 코드를 쓰면 tsc가 `require` 호출로 **변환**해 줬다. 겉보기엔 ESM인데 실제로는 CJS로 동작하는, 소스와 런타임의 괴리가 생기는 지점이다. verbatim 모드는 이 변환 마법을 거부한다 — ESM 구문을 썼다면 출력도 ESM이어야 하고, CJS로 출력할 거라면 처음부터 CJS 구문(`import ... = require(...)`)을 쓰라는 것이다. "쓴 그대로 출력한다"는 원칙의 자연스러운 귀결이다.

## 도입 가이드

새 프로젝트라면 켜지 않을 이유가 없다. 기존 프로젝트에 도입할 때 마주치는 에러는 대부분 두 종류이고, 둘 다 기계적으로 해결된다.

**첫째, TS1484 (타입에 type 표기 누락).** ESLint의 자동 수정으로 일괄 처리한다.

```bash
# @typescript-eslint/consistent-type-imports 규칙으로 일괄 변환
npx eslint --fix "src/**/*.ts"
```

**둘째, TS1286 (CJS 출력에서 ESM 구문).** 프로젝트가 실제로 CJS로 출력되고 있다는 신호다. 이 기회에 `"type": "module"`로 ESM 전환을 하든가, 당장 어렵다면 verbatim 대신 `isolatedModules`만 유지하는 선택지도 있다. 참고로 `verbatimModuleSyntax`를 켜면 `isolatedModules`가 보장하려던 파일 단위 변환 안전성은 자동으로 충족되므로 별도로 켤 필요가 없다.

번들러 기반 프런트엔드 프로젝트(모든 출력이 ESM)에서는 TS1286을 만날 일이 없으므로 도입 비용이 사실상 0에 가깝다. Vite 공식 템플릿이 이 옵션을 기본으로 켜는 이유다.

## 정리

`verbatimModuleSyntax`는 세 문장으로 요약된다. type 없는 import는 남는다. type 붙은 import는 사라진다. ESM 구문은 ESM 출력에서만 허용된다. 이 단순함 덕분에 TypeScript의 모듈 처리는 "컴파일러만 아는 마법"에서 "누구나 예측 가능한 규칙"이 됐다. 다음 글에서는 모듈 생태계의 또 다른 축 — 타입 정보를 배포하는 형식인 **선언 파일(.d.ts)** 을 다룬다.

---

**지난 글:** [타입 전용 import/export — import type 완전 정복](/posts/ts-type-only-imports/)

**다음 글:** [선언 파일(.d.ts) — 타입 정보의 배포 형식](/posts/ts-declaration-files/)

<br>
읽어주셔서 감사합니다. 😊
