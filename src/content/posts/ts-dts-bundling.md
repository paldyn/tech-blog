---
title: ".d.ts 번들링"
description: "여러 파일로 흩어진 타입 선언을 단일 진입점 하나로 묶는 .d.ts 번들링을 다룬다. 왜 번들링이 필요한지, api-extractor·dts-bundle-generator·tsup 같은 도구의 선택 기준, internal 타입 숨기기와 선언 맵까지 라이브러리 배포 관점에서 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 3
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "d.ts", "번들링", "라이브러리", "api-extractor"]
featured: false
draft: false
---

[지난 글](/posts/ts-swc-esbuild/)에서 변환은 SWC/esbuild에, 타입 검사와 `.d.ts` 생성은 `tsc`에 맡기는 분리 구성을 봤다. 그렇게 `tsc`로 선언 파일을 만들면, 소스 파일 하나마다 `.d.ts` 하나가 생겨 수십 개의 선언 파일이 폴더 트리째 출력된다. 라이브러리를 배포할 때 이걸 그대로 내보내도 동작은 하지만, 여러 문제가 따라온다. 이번 글은 흩어진 선언을 단일 진입점 하나로 묶는 `.d.ts` 번들링을 다룬다.

## 번들링이란 무엇인가

`.d.ts` 번들링은 자바스크립트 번들링의 타입 버전이다. 여러 `.d.ts` 파일에 흩어진 타입 선언을, 공개 API의 진입점 하나(`index.d.ts`)로 합쳐 내보낸다. 이때 외부에 노출할 타입만 남기고, 내부 구현용 타입은 합치는 과정에서 숨긴다.

![.d.ts 번들링 흐름](/assets/posts/ts-dts-bundling-flow.svg)

소스를 `dist/index.js`라는 단일 자바스크립트 번들로 묶었다면, 타입도 `dist/index.d.ts`라는 단일 선언으로 묶어 짝을 맞추는 것이 자연스럽다. `package.json`의 `types` 필드가 이 한 파일만 가리키게 하면 된다.

## 왜 번들링하나

선언 파일을 트리째 내보내는 것의 문제는 캡슐화와 안정성에 있다.

![번들링하는 이유](/assets/posts/ts-dts-bundling-why.svg)

첫째, 내부 경로가 노출된다. `pkg/dist/internal/cache.d.ts`처럼 내부 구현 파일의 경로가 타입 그래프에 남으면, 사용자가 그 경로로 직접 import할 수 있게 되고 폴더 구조를 바꾸는 순간 사용자 코드가 깨진다. 둘째, 공개하지 않으려던 내부 타입까지 새어 나간다. 셋째, 파일이 많을수록 에디터가 타입을 로딩하는 부담이 커진다. 단일 번들은 이 셋을 한 번에 해결한다.

```json
{
  "name": "my-lib",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

## 도구 선택

`.d.ts`를 번들하는 도구는 몇 가지 결이 있다.

가장 손쉬운 길은 **tsup**이다. 내부적으로 `rollup-plugin-dts`를 써서, `dts: true` 한 줄로 JS 번들과 타입 번들을 함께 만든다. 애플리케이션 라이브러리 대부분에 충분하다.

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,        // .d.ts 번들 함께 생성
  clean: true,
});
```

더 엄격한 통제가 필요하면 **Microsoft의 api-extractor**가 있다. 단순 번들링을 넘어, 공개 API 보고서(`.api.md`)를 생성해 PR에서 API 변경을 리뷰하게 하고, `@public`/`@internal` 같은 release 태그로 노출 범위를 세밀하게 제어한다. 대규모 공개 라이브러리에서 API 안정성을 관리할 때 강력하다.

```typescript
/**
 * 공개 API
 * @public
 */
export function parse(input: string): Ast {
  return runParser(input);
}

/**
 * 내부 전용 — 번들에서 제외
 * @internal
 */
export function runParser(input: string): Ast {
  /* ... */
}
```

`@internal`로 표시한 선언은 api-extractor가 공개 `.d.ts`에서 걷어낸다. `dts-bundle-generator`는 그 중간쯤으로, 설정이 가벼우면서도 단일 파일 번들에 집중한다.

## 선언 맵으로 정의로 점프

번들링과 별개로, 라이브러리 사용자가 타입에서 "정의로 이동"했을 때 원본 소스로 가게 하려면 선언 맵을 켜면 된다.

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

`declarationMap`은 `.d.ts.map`을 생성해, `.d.ts`의 타입과 원본 `.ts`를 연결한다. 다만 번들러로 여러 `.d.ts`를 하나로 합치면 이 맵핑이 깨질 수 있으므로, "정의로 점프" 경험을 중시한다면 도구가 선언 맵을 어떻게 다루는지 확인해야 한다. 단순 배포가 목적이면 번들 단일 파일을, 모노레포 내부 패키지 간 점프가 중요하면 프로젝트 레퍼런스와 선언 맵 조합을 고려하는 식으로 나뉜다.

## 정리

`.d.ts` 번들링은 흩어진 선언을 단일 진입점으로 묶어 캡슐화와 안정성을 얻는 작업이다. **간단하면 tsup의 `dts: true`로, 엄격한 API 관리가 필요하면 api-extractor로 묶고, internal 타입은 번들에서 걷어내며, `package.json`의 `types`/`exports`가 단일 파일을 가리키게 한다.** 내부 구조를 바꿔도 사용자 import가 깨지지 않고, 공개 API만 깔끔하게 드러난다. 다음 글에서는 이렇게 만든 타입 포함 라이브러리를 실제로 npm에 배포하는 전 과정을 정리한다.

---

**지난 글:** [SWC와 esbuild의 타입 처리](/posts/ts-swc-esbuild/)

**다음 글:** [타입을 포함한 라이브러리 배포하기](/posts/ts-publishing-typed-library/)

<br>
읽어주셔서 감사합니다. 😊
