---
title: "선언 파일(.d.ts) — 타입 정보의 배포 형식"
description: "타입스크립트 생태계를 지탱하는 .d.ts 선언 파일을 해부합니다. declaration 옵션의 출력물, declare 키워드의 의미, 라이브러리가 타입을 배포하는 구조와 직접 작성하는 방법까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "d.ts", "선언파일", "declaration", "declare", "declarationMap", "라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/ts-verbatim-module-syntax/)에서 모듈 구문이 출력 JavaScript로 변환되는 규칙을 정리했다. 그런데 컴파일 출력에는 JavaScript 말고 한 종류가 더 있다. `node_modules`를 열어보면 어디에나 있는 **`.d.ts` 선언 파일(declaration file)** 이다. npm에서 받은 JavaScript 라이브러리에 자동완성이 동작하는 것, `tsc`가 외부 패키지의 API 오용을 잡아내는 것 — 전부 이 파일 덕분이다. 이번 글에서 선언 파일이 무엇이고 어떻게 만들어지며 어떻게 읽는지를 정리한다.

## 컴파일 출력의 나머지 절반

TypeScript 컴파일은 소스에서 두 가지를 분리해 낸다. 런타임에 실행될 로직은 `.js`로, 타입 정보는 `.d.ts`로 나간다. `tsconfig.json`에서 옵션 하나만 켜면 된다.

```jsonc
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true   // .d.ts → 원본 .ts 점프용 소스맵
  }
}
```

```text
src/math.ts  ──tsc──▶  dist/math.js        (런타임 코드)
                       dist/math.d.ts      (타입 선언)
                       dist/math.d.ts.map  (선언 소스맵)
```

![declaration 옵션의 세 가지 출력물](/assets/posts/ts-declaration-files-pipeline.svg)

`declarationMap`은 선택이지만 라이브러리라면 켜는 것이 좋다. 사용하는 쪽 에디터에서 "정의로 이동"을 눌렀을 때 `.d.ts`가 아니라 **원본 `.ts` 소스**로 점프하게 해 주기 때문이다.

## .d.ts 안에는 무엇이 있나

선언 파일의 내용은 한 마디로 "구현을 뺀 시그니처"다. 직접 비교해 보면 명확하다.

```typescript
// lib.ts — 원본
export function add(a: number, b: number): number {
  return a + b;
}
export const VERSION = "1.2.0";
```

```typescript
// lib.d.ts — 생성된 선언
export declare function add(a: number, b: number): number;
export declare const VERSION: "1.2.0";
```

함수 본문이 사라지고 시그니처에 `declare` 키워드가 붙었다. `declare`는 컴파일러에게 보내는 약속이다 — *"이 이름의 구현은 다른 곳(짝이 되는 .js)에 실제로 존재한다. 너는 형태만 알면 된다."* 그래서 선언 파일에는 실행 코드를 쓸 수 없다. 함수 본문, 변수 초기화 값 같은 것이 들어가면 컴파일 에러다.

![.ts 구현과 .d.ts 선언의 대응 관계](/assets/posts/ts-declaration-files-content.svg)

## 컴파일러는 .d.ts를 어떻게 찾는가

모듈 해석 글에서 본 규칙이 여기서 완성된다. `import { add } from "my-lib"`을 해석할 때 컴파일러가 타입을 찾는 경로는 다음 순서다.

```jsonc
// node_modules/my-lib/package.json
{
  "name": "my-lib",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",      // ① 명시적 진입점
  "exports": {
    ".": {
      "types": "./dist/index.d.ts", // ② nodenext/bundler가 보는 곳
      "default": "./dist/index.js"
    }
  }
}
```

`types`(또는 `exports`의 `types` 조건) 필드가 가리키는 파일이 그 패키지 타입의 진입점이 된다. 필드가 없으면 `index.d.ts`를 관례로 찾고, 그것도 없으면 **같은 이름 규칙**이 동작한다 — `./dist/index.js` 옆에 `./dist/index.d.ts`가 있으면 자동으로 짝을 짓는다. 패키지에 타입이 아예 없을 때 `@types/*` 폴백으로 넘어가는 것은 다음 글의 주제다.

## 직접 작성하는 경우

`.d.ts`는 대부분 자동 생성되지만, 직접 손으로 쓰는 상황이 두 가지 있다. 하나는 타입이 없는 사내 JavaScript 모듈에 타입을 입힐 때, 다른 하나는 빌드 산출물 없이 타입만 제공하고 싶을 때다.

```typescript
// legacy-utils.d.ts — 옆에 있는 legacy-utils.js의 타입을 수작업으로
export declare function slugify(input: string): string;

export interface PageMeta {
  title: string;
  updatedAt: Date;
}
export declare function parseMeta(raw: string): PageMeta;
```

작성 요령은 단순하다. **공개 API만, 구현 없이, 최대한 정확한 타입으로.** 참고로 인터페이스와 타입 별칭은 원래 타입 공간에만 존재하므로 `declare`가 필요 없고, 값 공간에 존재하는 함수·변수·클래스에만 `declare`를 붙인다.

직접 작성한 선언이 실제 구현과 어긋나는 것이 이 방식의 최대 리스크다. 컴파일러는 선언 파일을 **신뢰할 뿐 검증하지 않는다.** 선언이 거짓말을 하면 타입 검사는 통과하고 런타임에서 터진다. 그래서 손으로 쓴 `.d.ts`는 가능한 한 빨리 소스를 TypeScript로 전환하거나, 최소한 테스트로 시그니처를 검증하는 것이 안전하다.

## 정리

선언 파일은 TypeScript 생태계의 유통 화폐다. 라이브러리 저자는 `declaration: true`로 `.js`와 `.d.ts`를 함께 배포하고, 컴파일러는 `types` 필드와 이름 짝짓기 규칙으로 그것을 찾아내며, 에디터는 그 정보로 자동완성을 그린다. 그렇다면 타입을 직접 배포하지 않는 수만 개의 JavaScript 라이브러리는 어떻게 타입을 갖게 됐을까? 다음 글에서 커뮤니티가 운영하는 거대한 타입 저장소, **DefinitelyTyped와 @types**를 다룬다.

---

**지난 글:** [verbatimModuleSyntax — 모듈 구문을 쓴 그대로](/posts/ts-verbatim-module-syntax/)

**다음 글:** [DefinitelyTyped와 @types — 커뮤니티 타입 생태계](/posts/ts-definitely-typed/)

<br>
읽어주셔서 감사합니다. 😊
