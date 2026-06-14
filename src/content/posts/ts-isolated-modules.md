---
title: "isolatedModules — 파일 단위 트랜스파일을 위한 제약"
description: "isolatedModules 옵션이 무엇을 검사하는지 정리합니다. 전체 프로그램 변환과 파일 단위 변환의 차이, esbuild·swc·Babel과의 관계, 타입 재내보내기·const enum 같은 위반 패턴과 해결법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "isolatedModules", "tsconfig", "esbuild", "swc", "Babel", "트랜스파일"]
featured: false
draft: false
---

[지난 글](/posts/ts-lib-target-module/)에서 `target`·`module`·`lib`으로 출력 형식을 정하는 법을 다뤘다. 그런데 요즘은 `tsc`가 직접 JavaScript를 내보내는 대신, **타입 체크는 `tsc`가 하고 실제 변환은 esbuild·swc·Babel 같은 빠른 도구가** 하는 구성이 흔하다. 이 구성에는 한 가지 전제가 숨어 있고, 그 전제를 지키도록 강제하는 옵션이 `isolatedModules`다.

## 전체 프로그램 vs 파일 단위

핵심은 **변환 단위**의 차이다. `tsc`는 프로젝트의 모든 파일을 함께 보며 타입 정보를 종합한다. 반면 esbuild·swc·Babel은 속도를 위해 **파일을 하나씩 독립적으로** 변환한다. 한 파일을 변환할 때 다른 파일을 들여다보지 않는다.

![전체 프로그램 변환과 파일 단위 변환의 차이](/assets/posts/ts-isolated-modules-perfile.svg)

이 차이가 문제를 만든다. TypeScript에는 "다른 파일을 봐야만 타입인지 값인지 알 수 있는" 코드가 존재한다. `tsc`는 전체를 보니 문제없지만, 한 파일만 보는 도구는 잘못 변환하거나 깨진 출력을 낸다. `isolatedModules: true`는 이런 **위험한 코드를 `tsc`가 미리 에러로 잡아주는** 안전망이다. 즉 "이 코드는 파일 하나만 봐도 안전하게 변환할 수 있는가?"를 검사한다.

## 위반 1: 값/타입을 섞은 재내보내기

가장 흔한 위반은 import한 이름을 다시 export할 때다.

![타입 재내보내기에 type 키워드를 붙여 해결하는 비교](/assets/posts/ts-isolated-modules-fix.svg)

```typescript
import { User } from './types';
export { User }; // ❌ User가 타입이면 출력에서 지워야 하는데,
                 //    이 파일만 봐선 타입인지 값인지 모른다
```

`User`가 타입이라면 변환 후 JavaScript에는 이 export가 남으면 안 된다(런타임에 존재하지 않는 걸 export하면 에러). 그런데 파일 단위 변환기는 `./types`를 보지 않으니 `User`의 정체를 모른다. 해결책은 **의도를 명시**하는 것이다.

```typescript
import type { User } from './types';
export type { User }; // ✅ 타입임을 명시 → 출력에서 안전히 제거
```

`import type`/`export type`를 쓰면 "이건 타입이니 런타임 코드에 남기지 말라"는 신호가 파일 안에 박힌다. 그러면 어떤 도구도 다른 파일을 볼 필요 없이 올바르게 변환한다.

## 위반 2: const enum

`const enum`도 대표적인 위반이다. 일반 enum과 달리 `const enum`은 사용처에 값을 **인라인**해 넣는데, 이 인라인을 하려면 enum의 정의를 봐야 한다.

```typescript
// 다른 파일에서 const enum을 import해 쓰면
const enum Color { Red, Green }
// 파일 단위 변환기는 Color.Red를 0으로 치환할 정보가 없다
```

`isolatedModules`가 켜져 있으면 다른 모듈의 `const enum` 사용이 막힌다. 해결책은 `const`를 떼고 일반 `enum`을 쓰거나, enum 대신 객체 리터럴 + `as const`를 쓰는 것이다.

## 위반 3: 값이 없는 모듈의 재export

import한 것을 그대로 다시 내보내는 배럴(barrel) 파일에서도 같은 문제가 생긴다. 타입과 값을 한 `export { ... }`에 섞으면 위험하다. 타입은 `export type { ... }`로, 값은 `export { ... }`로 분리해야 한다.

```typescript
// barrel index.ts
export { createUser } from './user';      // 값
export type { User, Role } from './user';  // 타입
```

이 분리 습관은 `isolatedModules` 없이도 좋은 습관이다. "이름이 타입인가 값인가"를 import/export 시점에 명확히 하면 사람이 읽기에도 의도가 분명해진다.

## 언제 켜야 하나

규칙은 단순하다. **변환을 `tsc`가 아닌 다른 도구(esbuild, swc, Babel, Vite 등)에 맡긴다면 `isolatedModules: true`를 켜라.** 그래야 그 도구들이 안전하게 변환할 수 없는 코드를 작성하는 순간 `tsc`가 알려준다. 실제로 Vite를 비롯한 많은 도구가 이 옵션을 켤 것을 권장하거나 전제한다.

```json
{
  "compilerOptions": {
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

`verbatimModuleSyntax`(이 시리즈의 별도 글에서 다룬다)와 함께 쓰면, 타입 전용 import/export를 더 일관되게 강제할 수 있어 궁합이 좋다.

여기까지가 "한 파일을 빠르게 변환"하기 위한 제약이었다. 이번엔 반대 방향, 즉 **여러 번의 빌드 사이에서 작업을 재사용해 전체 빌드를 빠르게** 만드는 쪽을 본다. 다음 글에서 `incremental`과 `composite` 옵션으로 증분 빌드를 구성하는 법을 다룬다.

---

**지난 글:** [lib·target·module — 컴파일 타깃을 결정하는 3대 옵션](/posts/ts-lib-target-module/)

**다음 글:** [composite와 incremental — 증분 빌드의 기초](/posts/ts-composite-incremental/)

<br>
읽어주셔서 감사합니다. 😊
