---
title: "모듈 해석 — TypeScript가 import를 찾는 방법"
description: "import 경로가 실제 파일로 연결되는 모듈 해석 과정을 분해합니다. 상대 경로와 패키지 경로의 탐색 순서, moduleResolution 4가지 전략의 차이와 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "moduleResolution", "모듈해석", "node_modules", "bundler", "tsconfig"]
featured: false
draft: false
---

[지난 글](/posts/ts-satisfies-operator/)에서 satisfies로 검사와 추론을 동시에 잡는 방법을 배웠다. 이번에는 평소에 당연하게 쓰지만 막상 에러가 나면 가장 당황스러운 주제 — **모듈 해석(module resolution)** 을 다룬다. `import { format } from "./util"`이라는 한 줄을 만났을 때 컴파일러가 어떤 순서로 어떤 파일을 뒤지는지 알면, `Cannot find module` 에러의 90%는 메시지만 보고도 원인을 짚을 수 있다.

## 모듈 해석이란 무엇인가

모듈 해석은 import 구문의 **모듈 지정자(module specifier)** 문자열을 디스크 위의 실제 파일 하나로 연결하는 과정이다. 여기서 중요한 전제가 하나 있다. TypeScript는 코드를 실행하지 않으므로, 런타임이 찾을 JavaScript 파일이 아니라 **타입 정보를 담은 파일(.ts, .tsx, .d.ts)** 을 찾는다.

```typescript
import { format } from "./util";
// 컴파일러의 질문: "./util"의 타입 정보는 어느 파일에 있는가?

import _ from "lodash";
// 컴파일러의 질문: lodash 패키지의 타입은 어디에 있는가?
```

그래서 모듈 해석은 항상 두 갈래로 나뉜다. `./`나 `../`로 시작하는 **상대 경로**와, 패키지 이름으로 시작하는 **비상대(non-relative) 경로**다.

## 상대 경로 — 후보를 순서대로 시도

`./util`처럼 확장자 없이 쓴 상대 경로에 대해, 컴파일러는 import한 파일의 위치를 기준으로 후보 파일을 정해진 순서대로 시도한다.

```text
import "./util" 의 탐색 순서 (node10 기준)

1. ./util.ts
2. ./util.tsx
3. ./util.d.ts
4. ./util/package.json 의 "types" 필드
5. ./util/index.ts → index.tsx → index.d.ts
```

먼저 발견되는 파일이 채택된다. `util.ts`와 `util/index.ts`가 둘 다 있으면 `util.ts`가 이긴다 — 가끔 리팩터링 중에 "분명 고쳤는데 옛날 타입이 보이는" 사고의 원인이 바로 이 우선순위다.

![상대 경로와 패키지 경로의 탐색 순서](/assets/posts/ts-module-resolution-lookup.svg)

## 패키지 경로 — node_modules를 거슬러 올라가기

`lodash`처럼 상대 경로가 아닌 지정자는 `node_modules` 디렉터리에서 찾는다. 현재 파일의 디렉터리부터 시작해 파일 시스템 루트까지 한 단계씩 올라가며 반복한다.

```text
/src/features/user.ts 에서 import "lodash" 하면

1. /src/features/node_modules/lodash
2. /src/node_modules/lodash
3. /node_modules/lodash        ← 보통 여기서 발견
```

패키지 디렉터리를 찾은 다음에는 그 안에서 타입의 진입점을 결정한다. `package.json`의 `types`(또는 `typings`) 필드를 먼저 확인하고, 없으면 `index.d.ts`를 찾는다. 패키지 자체에 타입이 없으면 마지막으로 `node_modules/@types/lodash` 같은 **DefinitelyTyped 폴백**을 시도한다 — 이 생태계는 시리즈 뒤에서 따로 다룬다.

## moduleResolution — 네 가지 전략

지금까지 설명한 탐색 규칙은 사실 `tsconfig.json`의 `moduleResolution` 옵션 값에 따라 달라진다. 선택지는 실질적으로 네 가지다.

```jsonc
{
  "compilerOptions": {
    // "classic" | "node10" | "bundler" | "node16" | "nodenext"
    "moduleResolution": "bundler"
  }
}
```

**classic**은 TypeScript 1.x 시절의 방식으로 `node_modules`조차 모른다. 하위 호환을 위해서만 존재하므로 잊어도 된다. **node10**(예전 이름 `node`)은 CommonJS 시절 Node.js의 규칙을 그대로 따라한 것으로, 위에서 설명한 확장자 생략·`index` 파일·`@types` 폴백이 모두 여기서 나왔다. 오랫동안 사실상의 표준이었지만 결정적인 한계가 있다 — 현대 패키지가 진입점을 선언하는 `package.json`의 `exports` 필드를 **인식하지 못한다.**

그래서 TypeScript 5.0에서 **bundler** 전략이 추가됐다. Vite, esbuild, webpack 같은 번들러가 동작하는 방식을 모델링한 것으로, `exports` 필드를 존중하면서도 상대 경로의 확장자 생략은 허용한다. 번들러가 최종 빌드를 책임지는 프런트엔드 프로젝트라면 이것이 기본 선택이다.

마지막으로 **node16 / nodenext**는 ESM 시대의 Node.js 규칙을 그대로 구현한 전략이다. 상대 경로에 확장자가 필수가 되는 등 가장 엄격하며, `tsc`의 출력물을 Node가 직접 실행하는 서버나 라이브러리에 적합하다. 워낙 다른 점이 많아서 다음 글 전체를 할애해 다룬다.

![moduleResolution 네 가지 전략 비교](/assets/posts/ts-module-resolution-strategies.svg)

## 해석 과정 디버깅하기

전략을 이해해도 막히는 순간은 온다. 그럴 때를 위한 공식 도구가 `--traceResolution`이다.

```bash
npx tsc --traceResolution > resolution.log

# 로그에서 특정 모듈만 확인
grep -A 5 "Resolving module 'lodash'" resolution.log
```

어떤 후보 파일을 어떤 순서로 시도했고 각각 왜 실패했는지가 전부 기록되므로, `Cannot find module` 에러를 추측이 아니라 사실로 디버깅할 수 있다. TypeScript 5.x의 에러 메시지도 많이 좋아져서, `exports` 필드 때문에 막힌 경우에는 "패키지의 exports에서 해당 서브패스를 찾을 수 없다"는 힌트를 직접 알려준다.

## 정리

모듈 해석의 핵심을 요약하면 세 가지다. 첫째, TypeScript는 런타임 파일이 아니라 **타입 정보 파일**을 찾는다. 둘째, 상대 경로는 후보 확장자를 순서대로, 패키지 경로는 `node_modules`를 위로 거슬러 올라가며 찾는다. 셋째, 이 규칙 전체가 `moduleResolution` 값에 따라 바뀌며, 현대 프로젝트의 선택지는 **bundler 아니면 node16/nodenext** 둘뿐이다. 다음 글에서는 그중 가장 엄격하고 가장 오해가 많은 node16/nodenext 전략을 집중 해부한다.

---

**지난 글:** [satisfies 연산자 — 타입 검증과 추론 보존을 동시에](/posts/ts-satisfies-operator/)

**다음 글:** [Node16/NodeNext 모듈 해석 — ESM 시대의 규칙](/posts/ts-module-resolution-node16/)

<br>
읽어주셔서 감사합니다. 😊
