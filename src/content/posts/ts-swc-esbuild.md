---
title: "SWC와 esbuild의 타입 처리"
description: "SWC와 esbuild는 TypeScript를 매우 빠르게 변환하지만 타입 검사는 하지 않는다. 변환과 타입 검사의 분리, isolatedModules 제약, const enum과 type-only import 문제, 그리고 빠른 빌드와 안전한 타입 검사를 함께 가져가는 실무 구성을 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "SWC", "esbuild", "빌드", "isolatedModules"]
featured: false
draft: false
---

[지난 글](/posts/ts-type-testing-expect-type/)에서 타입 자체를 테스트하는 법을 다뤘다. 이번에는 그 타입을 실제로 실행 가능한 자바스크립트로 바꾸는 단계, 즉 빌드를 살펴본다. 한때는 `tsc`가 변환의 유일한 선택지였지만, 지금은 Rust로 작성된 SWC와 Go로 작성된 esbuild가 압도적으로 빠른 변환을 제공한다. Vite, Next.js, Jest의 SWC 변환기 등 현대 도구 체인 곳곳에 이들이 숨어 있다. 중요한 점은, 이 빠름에는 분명한 전제가 있다는 것이다. **이들은 타입을 검사하지 않는다.**

## 변환과 타입 검사는 다른 일이다

`tsc`는 두 가지 일을 한꺼번에 한다. 첫째로 프로젝트 전체의 타입을 검사하고, 둘째로 타입을 떼어낸 자바스크립트를 출력한다. 타입 검사는 파일 하나가 아니라 전체 모듈 그래프를 분석해야 하므로 본질적으로 느리다.

![변환과 타입 검사의 분리](/assets/posts/ts-swc-esbuild-transpile-vs-typecheck.svg)

SWC와 esbuild는 두 번째 일, 즉 변환만 한다. 타입 검사를 아예 시도하지 않고 타입 주석을 기계적으로 떼어내기만 하므로 수십 배 빠르다. 그래서 현대적인 구성의 핵심 전략은 **둘을 분리하는 것**이다. 빠른 빌드는 SWC/esbuild에 맡기고, 타입 검사는 `tsc --noEmit`으로 별도 단계(에디터, 사전 커밋 훅, CI)에서 돌린다.

```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --outfile=dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

이 분리를 이해하지 못하면 "빌드는 통과했는데 타입 에러가 런타임까지 새어 나가는" 상황에 당황하게 된다. SWC/esbuild의 빌드 성공은 타입이 옳다는 보증이 전혀 아니다.

## 파일별 변환이라는 전제

SWC와 esbuild가 빠른 또 다른 이유는, 각 파일을 **독립적으로** 변환하기 때문이다. 파일 하나를 변환할 때 다른 파일을 들여다보지 않는다. 그런데 TypeScript의 일부 기능은 다른 파일의 정보가 있어야만 올바르게 변환할 수 있어서, 파일별 변환기와 충돌한다.

![파일별 변환의 제약과 해법](/assets/posts/ts-swc-esbuild-isolated-modules.svg)

대표적인 문제가 re-export다. `export { User } from "./types"`라고 쓰면, `User`가 타입인지 값인지를 `./types`를 봐야 알 수 있다. 파일별 변환기는 그 파일을 보지 않으므로, `User`를 출력 JS에 남겨야 할지 지워야 할지 판단하지 못한다. `const enum`도 비슷하다. `const enum`은 사용처에 값을 인라인으로 끼워 넣어야 하는데, 정의 파일을 보지 않으면 인라인할 값을 알 수 없다.

```typescript
// 위험: User가 타입이면 SWC가 잘못 남길 수 있다
export { User } from "./types";

// 안전: 타입임을 명시 → 출력 JS에서 확실히 제거
export type { User } from "./types";
```

## isolatedModules로 미리 막기

이런 충돌을 빌드 단계에서 터지기 전에 잡는 안전장치가 `isolatedModules` 옵션이다. 이 옵션을 켜면 `tsc`가 "파일별 변환기가 처리할 수 없는 패턴"을 미리 타입 에러로 알려준다. SWC나 esbuild를 쓴다면 사실상 필수 옵션이다.

```json
{
  "compilerOptions": {
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

`verbatimModuleSyntax`를 함께 켜면 한 발 더 나간다. `import`/`export`에 `type` 키워드가 붙지 않은 것은 모두 "값으로 취급해 그대로 출력"하도록 강제하므로, 타입과 값의 구분이 코드에 명시적으로 드러난다. 이렇게 하면 파일별 변환기가 추론할 필요 없이, 코드에 적힌 그대로 따라가면 된다.

```typescript
// verbatimModuleSyntax: 타입 import는 반드시 type 표기
import type { Config } from "./config";
import { loadConfig } from "./loader";
```

## const enum과 대안

`const enum`은 파일별 변환에서 특히 골칫거리다. esbuild는 일부 인라인을 지원하지만 한계가 있고, SWC도 별도 설정이 필요하다. 가장 안전한 길은 `const enum`을 피하고 `as const` 객체로 대체하는 것이다.

```typescript
// const enum 대신
const Color = {
  Red: 0,
  Green: 1,
  Blue: 2,
} as const;

type Color = (typeof Color)[keyof typeof Color];
```

이렇게 하면 일반 객체이므로 어떤 변환기에서도 문제없이 동작하면서, `as const` 덕분에 리터럴 타입의 안전성도 거의 그대로 얻는다.

## 어떤 도구를 언제

esbuild는 번들링까지 한 번에 처리하는 데 강하고, 애플리케이션 빌드나 빠른 개발 서버에 잘 맞는다. SWC는 Next.js나 Jest의 트랜스파일 단계처럼 도구 내부에 통합되는 경우가 많다. `tsc`는 여전히 가장 정확한 타입 검사기이자 `.d.ts` 생성기이므로, 변환은 SWC/esbuild에, 타입 검사와 선언 파일 생성은 `tsc`에 맡기는 조합이 현재의 표준적인 구성이다.

## 정리

SWC와 esbuild는 빠르지만 타입을 검사하지 않는다는 사실이 모든 것의 출발점이다. **변환과 타입 검사를 분리하고, `tsc --noEmit`으로 타입을 따로 검증하며, `isolatedModules`와 `verbatimModuleSyntax`로 파일별 변환의 제약을 코드에 명시한다.** `const enum`처럼 한 파일만으로 변환할 수 없는 기능은 피하면 도구를 자유롭게 바꿔 끼울 수 있다. 다음 글에서는 이렇게 빌드한 라이브러리의 타입 선언을 한 파일로 묶는 `.d.ts` 번들링을 다룬다.

---

**지난 글:** [타입을 테스트하기: expectTypeOf와 tsd](/posts/ts-type-testing-expect-type/)

**다음 글:** [.d.ts 번들링](/posts/ts-dts-bundling/)

<br>
읽어주셔서 감사합니다. 😊
