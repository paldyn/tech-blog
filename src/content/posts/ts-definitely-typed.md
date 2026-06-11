---
title: "DefinitelyTyped와 @types — 커뮤니티 타입 생태계"
description: "타입 없는 JavaScript 라이브러리에 타입을 공급하는 DefinitelyTyped 생태계를 정리합니다. @types 패키지의 동작 원리, 탐색 우선순위, 버전 정책, typeRoots 옵션과 흔한 함정까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "DefinitelyTyped", "@types", "npm", "typeRoots", "TS7016"]
featured: false
draft: false
---

[지난 글](/posts/ts-declaration-files/)에서 라이브러리가 `.d.ts`로 타입을 배포하는 구조를 봤다. 하지만 npm에는 TypeScript가 등장하기 전부터 존재한, 타입을 모르는 JavaScript 패키지가 수십만 개다. 이들이 전부 타입을 갖게 된 것은 라이브러리 저자들의 노력이 아니라 **DefinitelyTyped**라는 커뮤니티 프로젝트 덕분이다. `npm install -D @types/express` 한 줄 뒤에서 무슨 일이 일어나는지, 이 생태계의 구조와 함정을 정리한다.

## DefinitelyTyped란

DefinitelyTyped는 GitHub의 거대한 모노레포다. `types/lodash`, `types/express` 같은 디렉터리마다 해당 라이브러리의 `.d.ts`와 테스트가 들어 있고, 커뮤니티가 PR로 작성·수정하면 자동화된 퍼블리셔가 이를 npm의 **`@types/*` 스코프 패키지**로 배포한다.

![DefinitelyTyped에서 내 에디터까지의 흐름](/assets/posts/ts-definitely-typed-flow.svg)

핵심 특징은 **라이브러리 코드와 타입의 작성자가 다르다**는 점이다. lodash 메인테이너가 아니라 제3의 기여자가 lodash의 동작을 관찰해서 타입을 작성한다. 이 구조가 생태계 전체를 빠르게 커버할 수 있게 했지만, 동시에 "타입이 실제 동작과 다를 수 있다"는 이 생태계 고유의 리스크의 원천이기도 하다.

## 컴파일러는 @types를 어떻게 쓰는가

설치만 하면 끝이다. `tsc`는 기본 설정에서 `node_modules/@types` 아래의 모든 패키지를 자동으로 인식한다.

```bash
npm install express          # 런타임 코드 (타입 없음)
npm install -D @types/express  # 타입 — 빌드에만 필요하므로 -D
```

```typescript
import express from "express";
// tsc의 탐색: express 패키지에 types 필드 없음
//   → node_modules/@types/express 발견 → 이 타입을 사용

const app = express();  // ✅ 완전한 자동완성과 타입 검사
```

탐색에는 명확한 우선순위가 있다. **패키지에 내장된 타입이 항상 먼저**고, `@types`는 내장 타입이 없을 때의 폴백이다. 둘 다 없으면 그 유명한 에러를 만난다.

```text
TS7016: Could not find a declaration file for module 'some-lib'.
'.../some-lib/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/some-lib` if it exists ...
```

![패키지 타입의 탐색 우선순위](/assets/posts/ts-definitely-typed-resolution.svg)

에러 메시지가 시키는 대로 `@types/some-lib`을 검색해 보고, 없다면 직접 선언을 작성해야 한다 — 그 방법이 다음 두 글의 주제인 앰비언트 선언이다.

## 버전 정책 — major.minor만 맞춘다

`@types` 패키지의 버전은 원본 라이브러리를 따라가되 **major.minor까지만** 의미가 있다. patch 자리는 타입 자체의 수정 횟수다.

```text
express 4.18.x  ←→  @types/express 4.17.21
                     └─ 4.17: express 4.17 API 기준
                     └─ .21: 타입 선언의 21번째 수정
```

그래서 라이브러리를 메이저 업그레이드할 때는 `@types`도 함께 올려야 하고, 반대로 `@types`만 최신으로 올리면 아직 설치하지 않은 새 API의 타입이 보이는 착시가 생길 수 있다. 타입은 통과했는데 런타임에서 `undefined is not a function`이 나면 가장 먼저 의심할 곳이 이 버전 어긋남이다.

특별한 사례가 `@types/node`다. 이것은 특정 라이브러리가 아니라 **Node.js 런타임 전역**(`process`, `Buffer`, `fs` 모듈 등)의 타입이며, 메이저 버전을 사용 중인 Node 버전과 맞추는 것이 원칙이다.

## typeRoots와 types — 자동 포함 제어

`@types`의 자동 포함은 가끔 통제가 필요하다. 두 옵션이 그 역할을 한다.

```jsonc
{
  "compilerOptions": {
    // 전역 타입을 찾을 루트 디렉터리 (기본: 모든 상위 node_modules/@types)
    "typeRoots": ["./node_modules/@types", "./typings"],

    // 자동 포함할 패키지를 명시적으로 제한
    "types": ["node", "vitest/globals"]
  }
}
```

주의할 점은 이 옵션들이 **전역(global) 선언의 자동 포함**에만 영향을 준다는 것이다. `import`로 명시적으로 가져오는 타입은 `types` 배열에 없어도 정상 동작한다. 예를 들어 `types: ["node"]`로 제한해도 `import express from "express"`의 타입은 여전히 `@types/express`에서 온다. 이 옵션이 필요한 전형적인 상황은 테스트 프레임워크의 전역 함수(`describe`, `it`)가 소스 코드 타입 검사까지 오염시키는 것을 막을 때다.

## 생태계의 현재와 흐름

최근 몇 년의 추세는 분명하다 — **내장 타입이 표준이 되어 간다.** 새 라이브러리는 처음부터 TypeScript로 작성되거나 `.d.ts`를 동봉하고, axios·zod·date-fns처럼 `@types` 없이 쓰는 패키지가 늘었다. 어떤 패키지의 README에서 "TypeScript support out of the box"를 본다면 `@types` 설치가 필요 없다는 뜻이다. 헷갈릴 때는 npm 페이지의 타입 아이콘(내장이면 파란 TS, DefinitelyTyped면 DT)을 확인하면 된다.

그래도 express, lodash, jsonwebtoken 같은 거대 레거시 생태계는 여전히 DefinitelyTyped 위에 서 있다. 이 구조를 이해하면 "타입이 이상한데?" 싶을 때 원본 저장소가 아니라 DefinitelyTyped 저장소에서 이슈를 찾아야 한다는 것도 자연스럽게 알게 된다. 다음 글에서는 @types도 없는 코드를 위해 직접 타입의 존재를 선언하는 **앰비언트 선언(`declare`)** 을 본격적으로 다룬다.

---

**지난 글:** [선언 파일(.d.ts) — 타입 정보의 배포 형식](/posts/ts-declaration-files/)

**다음 글:** [앰비언트 선언 — 컴파일러에게 존재를 알리기](/posts/ts-ambient-declarations/)

<br>
읽어주셔서 감사합니다. 😊
