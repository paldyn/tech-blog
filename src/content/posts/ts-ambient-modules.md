---
title: "앰비언트 모듈 — 타입 없는 모듈에 타입 입히기"
description: "declare module 구문으로 타입이 없는 npm 패키지와 에셋 import에 타입을 부여하는 방법을 다룹니다. 와일드카드 모듈, 본문 없는 축약 선언, vite/client의 정체까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 9
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "declare-module", "앰비언트모듈", "와일드카드모듈", "에셋타입", "vite-client"]
featured: false
draft: false
---

[지난 글](/posts/ts-ambient-declarations/)에서 `declare`로 전역 존재를 컴파일러에게 알리는 방법을 배웠다. 이번에는 같은 기법의 모듈 버전이다. 내장 타입도 없고 `@types`에도 없는 패키지를 import해야 할 때, 그리고 `import logo from "./logo.svg"`처럼 JavaScript가 아닌 파일을 import할 때 — 두 상황 모두 **앰비언트 모듈(ambient module)**, 즉 `declare module` 구문으로 해결한다.

## 마지막 수단 — 타입이 어디에도 없는 패키지

타입 탐색의 우선순위를 복기하자. 패키지 내장 타입 → `@types` 폴백 → 둘 다 없으면 TS7016 에러. 사내에서만 쓰는 패키지나 오래된 소형 라이브러리는 실제로 이 마지막 단계까지 온다.

```typescript
import slug from "slugify-x";
// ❌ TS7016: Could not find a declaration file for
//    module 'slugify-x'. ... implicitly has an 'any' type.
```

이때 프로젝트 안에 `.d.ts` 파일을 만들고, 따옴표로 감싼 모듈 이름과 함께 그 모듈의 공개 API를 선언한다.

```typescript
// src/types/slugify-x.d.ts
declare module "slugify-x" {
  export interface SlugOptions {
    separator?: string;
    lower?: boolean;
  }
  export default function slugify(
    input: string,
    options?: SlugOptions
  ): string;
  export const VERSION: string;
}
```

`declare module "이름"` 블록 안의 내용이 곧 그 모듈의 내보내기 정의가 된다. 이름은 import 지정자와 **문자열로 정확히 일치**해야 매칭된다는 점, 그리고 이 선언 파일 자체가 `tsconfig`의 `include` 범위에 있어야 한다는 점만 지키면 된다.

![declare module로 타입 없는 패키지에 타입 입히기](/assets/posts/ts-ambient-modules-declare.svg)

급할 때 쓰는 **본문 없는 축약형**도 있다.

```typescript
declare module "slugify-x";
// 모든 내보내기가 any가 됨 — 에러는 사라지지만 타입 안전도 없음
```

에러를 멈추는 응급 처치로는 유효하지만, 모듈 전체가 `any`가 되므로 가능하면 위처럼 시그니처를 명시하는 것이 좋다. 응급 처치로 시작했다면 TODO를 남기고 점진적으로 채워 나가자.

## 와일드카드 모듈 — 에셋 import의 정체

`declare module`의 진짜 일상적인 쓰임은 따로 있다. 모듈 이름에 `*` 와일드카드를 쓸 수 있다는 점을 이용해, **JavaScript가 아닌 파일의 import**에 타입을 부여하는 것이다.

```typescript
// src/types/assets.d.ts
declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.css";  // 사이드 이펙트 import 허용

declare module "*?raw" {
  const content: string;
  export default content;
}
```

```typescript
import logo from "./logo.svg";   // logo: string (번들된 URL)
import "./global.css";           // ✅ 통과
import shader from "./sky.glsl?raw"; // shader: string
```

번들러(Vite, webpack)는 이런 import를 만나면 파일을 URL이나 문자열로 변환해 준다. 하지만 tsc는 번들러 설정을 모르므로, 변환 결과가 어떤 타입인지를 와일드카드 선언으로 알려주는 것이다. **선언이 번들러의 실제 동작과 일치해야 한다**는 책임은 여기서도 그대로 적용된다 — `*.svg`를 string으로 선언했는데 번들러 설정이 React 컴포넌트로 변환하고 있다면 타입은 거짓말이 된다.

![와일드카드 모듈 선언과 에셋 import](/assets/posts/ts-ambient-modules-wildcard.svg)

## vite/client와 next-env.d.ts의 정체

Vite 프로젝트의 `src/vite-env.d.ts`에 있는 한 줄을 본 적 있을 것이다.

```typescript
/// <reference types="vite/client" />
```

이 참조가 끌어오는 `vite/client.d.ts`를 열어보면 정체가 드러난다 — `*.css`, `*.svg`, `*.png`, `*?raw`, `*?url` 등 Vite가 처리하는 모든 에셋 패턴의 **와일드카드 앰비언트 모듈 묶음**이다. Next.js의 `next-env.d.ts`도 같은 원리다. 프레임워크가 미리 작성해 둔 선언 덕분에 우리가 에셋 import를 바로 쓸 수 있었던 것이다. 직접 커스텀 로더나 쿼리 접미사를 추가했다면, 같은 방식으로 선언을 추가하면 된다.

```typescript
// vite.config에서 .hbs를 컴파일된 템플릿 함수로 변환하는 경우
declare module "*.hbs" {
  const template: (data: Record<string, unknown>) => string;
  export default template;
}
```

## 한계와 다음 단계

앰비언트 모듈에는 분명한 한계가 하나 있다. `declare module "이름"` 블록은 모듈을 **처음부터 정의**하는 도구라서, *이미 타입이 있는 모듈에 무언가를 추가*하는 데는 쓸 수 없다. 예컨대 Express의 `Request`에 커스텀 프로퍼티를 추가하거나, 라이브러리의 인터페이스를 확장하는 작업은 다른 메커니즘이 필요하다.

그 메커니즘의 토대가 TypeScript의 독특한 기능인 **선언 병합(declaration merging)** 이다. 같은 이름의 선언이 만나면 합쳐지는 이 규칙을 다음 글에서 자세히 다루고, 그 위에 세워진 모듈 보강(module augmentation)으로 이어간다.

---

**지난 글:** [앰비언트 선언 — 컴파일러에게 존재를 알리기](/posts/ts-ambient-declarations/)

**다음 글:** [선언 병합 — 같은 이름의 선언이 만나면](/posts/ts-declaration-merging/)

<br>
읽어주셔서 감사합니다. 😊
