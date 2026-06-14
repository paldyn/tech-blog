---
title: "모듈 보강 — 남의 라이브러리 타입을 확장하기"
description: "선언 병합을 모듈 경계 너머로 확장하는 모듈 보강(module augmentation)을 정리합니다. declare module 문법, import가 필요한 이유, express Request 확장 같은 실전 패턴과 흔한 함정을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "모듈보강", "module-augmentation", "declare-module", "선언병합", "express"]
featured: false
draft: false
---

[지난 글](/posts/ts-declaration-merging/)에서 같은 이름의 선언이 하나로 합쳐지는 선언 병합 규칙을 다루면서, "이미 타입이 있는 라이브러리 모듈을 외부에서 확장하는 도구"로 모듈 보강을 예고했다. 인터페이스 병합은 같은 파일·같은 스코프 안에서 일어나지만, 실무에서 정말 필요한 건 **내가 건드릴 수 없는 남의 패키지** 타입에 멤버를 더하는 일이다. express의 `Request`에 `user`를 붙이고, `process.env`에 내 환경 변수를 추가하는 — 이 모든 게 **모듈 보강(module augmentation)** 이다.

## 모듈 보강이란

모듈 보강은 `declare module '모듈이름'` 블록 안에서, 그 모듈이 export하는 인터페이스에 멤버를 추가로 선언하는 것이다. 컴파일러는 이 선언을 원래 모듈의 타입 정의와 **병합**한다. 핵심은 "원본을 수정하는 게 아니라, 같은 이름의 인터페이스를 다시 열어 멤버를 덧붙인다"는 점이다.

![모듈 보강이 원본 모듈 타입과 병합되는 흐름](/assets/posts/ts-module-augmentation-flow.svg)

가장 자주 쓰이는 사례가 express다. 미들웨어에서 `req.user`에 인증된 사용자를 심어두고 핸들러에서 꺼내 쓰는 패턴은 흔하지만, express의 기본 `Request` 타입에는 `user`가 없다. 모듈 보강으로 이 타입을 확장한다.

![express Request에 user 프로퍼티를 보강하는 코드](/assets/posts/ts-module-augmentation-code.svg)

## import가 반드시 필요한 이유

모듈 보강에서 가장 많이 막히는 지점이 이것이다. 보강 파일은 **반드시 모듈 파일**이어야 한다. 즉 파일 안에 `import`나 `export`가 하나라도 있어야 한다.

```typescript
// ❌ 잘못된 보강 — 이 파일은 스크립트(전역) 파일이다
declare module 'express' {
  interface Request {
    user?: User;
  }
}
```

위 파일에 `import`/`export`가 없으면 TypeScript는 이 파일을 **모듈이 아닌 전역 스크립트**로 본다. 이때 `declare module 'express'`는 "보강"이 아니라 "express라는 이름의 **앰비언트 모듈을 새로 선언**"하는 의미로 해석된다. 그 결과 원본 타입과 병합되기는커녕, express의 모든 타입이 통째로 가려져 사라지는 끔찍한 상황이 벌어진다.

```typescript
// ✅ import 한 줄로 이 파일을 모듈로 만든다
import 'express';

declare module 'express' {
  interface Request {
    user?: User;
  }
}
```

`import 'express';`는 사이드 이펙트 import처럼 보이지만, 여기서는 "이 파일을 모듈로 승격시키는" 역할을 한다. 파일에 이미 다른 `import`가 있다면 굳이 추가할 필요는 없다. 핵심은 파일이 모듈 컨텍스트인지 여부다.

## 어떤 모듈 이름을 써야 하는가

`declare module`에 적는 문자열은 **실제 import할 때 쓰는 경로**와 정확히 일치해야 한다. 같은 패키지라도 진입점에 따라 보강 대상이 갈린다.

```typescript
// express 본체를 보강
declare module 'express' { /* ... */ }

// 서브 경로를 보강 (예: vue의 컴포넌트 옵션)
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $translate: (key: string) => string;
  }
}
```

라이브러리마다 "확장하라고 열어둔" 인터페이스가 정해져 있는 경우가 많다. Vue는 `ComponentCustomProperties`, Vue Router는 `RouteMeta`, styled-components는 `DefaultTheme` 같은 식이다. 라이브러리 문서나 `.d.ts`에서 빈 인터페이스로 선언된 확장 포인트를 찾는 것이 첫걸음이다.

## 보강 파일은 어디에 두는가

보강이 적용되려면 그 파일이 컴파일 대상에 **포함되어야** 한다. `tsconfig.json`의 `include` 범위 안에 있어야 하고, 보통은 `src/types/` 같은 디렉터리에 모아둔다.

```typescript
// src/types/express.d.ts
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; role: string };
  }
}
```

express의 `Request`는 실제로는 `express-serve-static-core`에 정의되어 있어서, 버전에 따라 이쪽을 보강해야 정확히 병합되는 경우가 있다. 보강이 먹지 않으면 원본 `.d.ts`에서 인터페이스가 **어느 모듈에 선언돼 있는지**를 먼저 확인하자.

## 함수·클래스가 아니라 인터페이스만

모듈 보강으로 확장할 수 있는 것은 인터페이스와 namespace다. 모듈이 export하는 **함수의 시그니처를 바꾸거나, 새 export를 추가**하는 것은 보강으로 안전하게 할 수 없다. 새 값을 추가하려는 시도는 "보강에는 export를 새로 만들 수 없다"는 에러로 막힌다.

```typescript
declare module 'some-lib' {
  // ❌ 보강에서 새 export 추가 불가
  export function brandNewApi(): void;
}
```

이런 경우엔 보강이 아니라 별도 모듈로 감싸는 래퍼를 만드는 편이 옳다. 모듈 보강은 어디까지나 **타입 구조를 넓히는 도구**이지, 런타임 동작을 더하는 도구가 아니라는 점을 기억하자.

모듈 보강은 특정 모듈을 정조준한 확장이다. 그렇다면 모듈에 속하지 않은 **전역**—`window`, `globalThis`, 전역 함수—은 어떻게 확장할까? 다음 글에서 전역 보강(global augmentation)을 이어서 다룬다.

---

**지난 글:** [선언 병합 — 같은 이름의 선언이 만나면](/posts/ts-declaration-merging/)

**다음 글:** [전역 보강 — Window와 전역 스코프 확장하기](/posts/ts-global-augmentation/)

<br>
읽어주셔서 감사합니다. 😊
