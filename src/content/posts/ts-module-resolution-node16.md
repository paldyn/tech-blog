---
title: "Node16/NodeNext 모듈 해석 — ESM 시대의 규칙"
description: "moduleResolution: nodenext가 강제하는 규칙들을 해부합니다. 파일별 ESM/CJS 형식 판정, 상대 경로의 .js 확장자 의무, exports 필드 해석, .mts/.cts 확장자까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "NodeNext", "Node16", "ESM", "CommonJS", "exports", "moduleResolution"]
featured: false
draft: false
---

[지난 글](/posts/ts-module-resolution/)에서 모듈 해석의 큰 그림과 네 가지 전략을 살펴봤다. 이번에는 그중 가장 엄격하고, 처음 만났을 때 가장 많은 에러를 쏟아내는 **node16/nodenext** 전략을 집중적으로 다룬다. "왜 멀쩡하던 import에 확장자를 붙이라고 하지?"라는 당황은 이 전략의 설계 철학 하나만 이해하면 풀린다 — *tsc의 출력물이 Node.js에서 그대로 실행되도록, Node의 규칙을 한 치도 어기지 않는다.*

## node16과 nodenext의 관계

먼저 이름부터 정리하자. `node16`은 Node.js 16의 모듈 규칙을 고정한 스냅샷이고, `nodenext`는 "현재 Node.js 최신 동작을 따라간다"는 움직이는 타깃이다. 새 프로젝트라면 고민할 것 없이 `nodenext`를 쓰면 된다.

```jsonc
{
  "compilerOptions": {
    "module": "nodenext",
    // module이 nodenext면 moduleResolution은 자동으로 nodenext
    "moduleResolution": "nodenext"
  }
}
```

한 가지 규칙도 함께 기억하자. `module: "nodenext"`와 `moduleResolution: "nodenext"`는 항상 짝으로 움직인다. 모듈을 어떻게 출력할지와 어떻게 찾을지는 동전의 양면이기 때문이다.

## 모든 것의 출발점 — 파일별 형식 판정

Node.js의 ESM 지원은 "이 파일은 ESM인가 CJS인가"를 파일 단위로 판정하는 데서 시작한다. TypeScript도 똑같은 규칙을 따른다.

![Node16/NodeNext의 파일별 모듈 형식 판정 흐름](/assets/posts/ts-module-resolution-node16-format.svg)

판정 규칙은 세 줄로 요약된다.

```text
.mts / .mjs           → 무조건 ESM
.cts / .cjs           → 무조건 CJS
.ts / .tsx / .js      → 가장 가까운 package.json의 "type" 필드
                         "module"이면 ESM, 없거나 "commonjs"면 CJS
```

여기서 `.mts`와 `.cts`는 TypeScript가 Node의 `.mjs`/`.cjs`에 대응해 추가한 확장자다. `.mts`는 컴파일하면 `.mjs`가 되고 타입 선언은 `.d.mts`로 나온다. CJS 기반 프로젝트에서 일부 파일만 ESM으로 쓰고 싶을 때(혹은 그 반대) 파일 단위로 형식을 강제하는 수단이다.

중요한 것은 **이 판정 결과에 따라 그 파일에 적용되는 import 규칙 전체가 달라진다**는 점이다. ESM으로 판정된 파일은 ESM의 엄격한 규칙을, CJS로 판정된 파일은 기존의 느슨한 규칙을 따른다.

## ESM 파일의 상대 경로 — 확장자 필수, 그것도 .js로

node16/nodenext에서 가장 악명 높은 규칙이다. ESM 파일 안의 상대 경로 import는 확장자를 생략할 수 없고, `index` 파일 자동 탐색도 없다.

```typescript
// ESM으로 판정된 src/app.mts (또는 type: module 하의 .ts)

import { fmt } from "./util";      // ❌ TS2835: 확장자 필요
import { fmt } from "./util.ts";   // ❌ 기본 설정에선 불가
import { fmt } from "./util.js";   // ✅ 정답
```

`.ts` 파일을 import하면서 `.js`라고 쓰는 것이 처음엔 기괴해 보이지만, 논리는 일관적이다. 컴파일 후 실행되는 것은 `util.js`이고, Node ESM 런타임은 경로를 한 글자도 고쳐주지 않는다. 그래서 **소스 코드에 출력 기준 경로를 쓰고**, tsc가 타입 검사를 위해 `./util.js`를 `./util.ts`로 역매핑하는 것이다.

![import 확장자와 실제 소스 파일의 매핑](/assets/posts/ts-module-resolution-node16-extensions.svg)

CJS로 판정된 파일에서는 기존 node10처럼 확장자 생략과 `index` 탐색이 그대로 허용된다. 같은 프로젝트 안에서도 파일 형식에 따라 규칙이 다르다는 점이 이 전략의 핵심이자 혼란의 근원이다.

## exports 필드 — 패키지의 공식 출입구

패키지 경로 해석에서 node16/nodenext는 `package.json`의 `exports` 필드를 엄격하게 적용한다. `exports`가 선언된 패키지는 거기에 명시된 서브패스만 import할 수 있다.

```jsonc
// node_modules/some-lib/package.json
{
  "name": "some-lib",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./plugin": "./dist/plugin.js"
  }
}
```

```typescript
import lib from "some-lib";           // ✅ "." 진입점
import plugin from "some-lib/plugin"; // ✅ 선언된 서브패스
import util from "some-lib/dist/util"; // ❌ exports에 없음 — 차단
```

`import`/`require` 조건 분기도 여기서 동작한다. import하는 쪽 파일이 ESM이면 `import` 조건의 타입을, CJS면 `require` 조건의 타입을 가져온다. 같은 패키지를 import해도 **내 파일의 형식에 따라 다른 타입을 볼 수 있다**는 뜻이다. node10 전략이 `exports`를 통째로 무시하고 `types` 필드만 보던 것과 비교하면 정확성이 완전히 다르다.

## 언제 nodenext를 선택하는가

판단 기준은 단순하다. **tsc(또는 tsx, ts-node)의 출력물을 Node.js가 직접 실행하는가?** 그렇다면 nodenext다. 백엔드 서버, CLI 도구, npm에 배포할 라이브러리가 여기에 해당한다. 반대로 Vite나 webpack 같은 번들러가 모든 경로를 알아서 처리해 주는 프런트엔드 앱이라면, 확장자 의무 같은 규칙은 불필요한 마찰일 뿐이므로 `bundler` 전략이 맞다.

라이브러리 저자에게는 선택이 아니라 사실상 의무에 가깝다. nodenext로 컴파일이 통과한다는 것은 내 패키지가 Node ESM 환경에서 깨지지 않는다는 가장 확실한 증거이기 때문이다. 다음 글에서는 모듈 시스템과 타입 시스템의 경계에 있는 **타입 전용 import/export**(`import type`)를 다룬다.

---

**지난 글:** [모듈 해석 — TypeScript가 import를 찾는 방법](/posts/ts-module-resolution/)

**다음 글:** [타입 전용 import/export — import type 완전 정복](/posts/ts-type-only-imports/)

<br>
읽어주셔서 감사합니다. 😊
