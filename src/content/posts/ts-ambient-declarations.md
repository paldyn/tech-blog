---
title: "앰비언트 선언 — 컴파일러에게 존재를 알리기"
description: "declare 키워드로 런타임에 이미 존재하는 전역 변수·함수·클래스에 타입을 입히는 앰비언트 선언을 다룹니다. 스크립트와 모듈의 전역 스코프 차이, declare global, 흔한 함정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "declare", "앰비언트선언", "declare-global", "전역타입", "d.ts"]
featured: false
draft: false
---

[지난 글](/posts/ts-definitely-typed/)에서 @types 생태계가 타입 없는 패키지를 커버하는 구조를 봤다. 그런데 @types로도 해결되지 않는 영역이 있다. CDN `<script>` 태그가 만든 전역 변수, 빌드 도구가 주입하는 상수, 서버가 HTML에 심어둔 데이터 — **런타임에는 분명히 존재하지만 TypeScript 소스 어디에도 정의가 없는 것들**이다. 이들을 컴파일러에게 알리는 도구가 앰비언트 선언(ambient declaration), 즉 `declare` 키워드다.

## 문제 상황 — 컴파일러가 모르는 존재

전형적인 예부터 보자. HTML에서 analytics 스크립트를 로드하고 코드에서 호출하는 경우다.

```typescript
// index.html에서 <script>가 전역 gtag 함수를 만들어 둠
gtag("event", "page_view");
// ❌ TS2304: Cannot find name 'gtag'.

// 빌드 도구(Vite의 define 등)가 컴파일 타임에 치환하는 상수
console.log(__APP_VERSION__);
// ❌ TS2304: Cannot find name '__APP_VERSION__'.
```

코드는 런타임에 정상 동작한다. 문제는 오직 타입 검사다. 컴파일러는 자기가 본 선언만 알기 때문에, 외부에서 만들어진 존재는 직접 알려줘야 한다.

## declare — 구현 없는 존재 증명

`declare`는 "이 이름은 어딘가에 실제로 존재하니, 형태만 믿고 검사해 달라"는 선언이다. 보통 프로젝트에 `globals.d.ts` 같은 파일을 만들어 모아둔다.

```typescript
// src/globals.d.ts
declare function gtag(...args: unknown[]): void;
declare const __APP_VERSION__: string;

declare class LegacyWidget {
  constructor(el: HTMLElement);
  render(): void;
}
```

이제 프로젝트 어디서든 `gtag(...)`가 타입 검사를 통과한다. 중요한 성질은 두 가지다. 첫째, **앰비언트 선언은 컴파일 출력에 한 줄도 남기지 않는다.** 코드를 생성하는 것이 아니라 타입 정보만 추가한다. 둘째, **컴파일러는 선언을 검증하지 않는다.** `__APP_VERSION__`을 선언해 놓고 빌드 도구 설정을 빼먹으면, 타입 검사는 통과하고 런타임에서 `ReferenceError`가 난다. declare는 책임이 따르는 약속이다.

![앰비언트 선언의 개념 — 존재를 알리면 타입이 생긴다](/assets/posts/ts-ambient-declarations-concept.svg)

## 핵심 규칙 — 스크립트 파일과 모듈 파일

앰비언트 선언에서 가장 많이 발에 걸리는 규칙이 여기 있다. `.d.ts` 파일이 **전역으로 동작하느냐는 파일에 최상위 `import`/`export`가 있느냐로 결정된다.**

- import/export가 **없는** 파일 = 스크립트 → 내용 전체가 전역 스코프에 합쳐진다
- import/export가 **하나라도 있는** 파일 = 모듈 → 내용은 그 모듈 안에 갇힌다

```typescript
// ✅ globals.d.ts — import/export 없음 → 전역으로 동작
declare const VERSION: string;
```

```typescript
// ❌ 어느 날 누군가 타입 하나를 import하는 순간...
import type { Locale } from "./i18n.js";
declare const VERSION: string;
// 파일이 모듈이 되면서 VERSION 전역 선언이 조용히 무력화됨
// 프로젝트 곳곳에서 TS2304가 터지기 시작한다
```

모듈 파일 안에서 전역을 건드려야 한다면 `declare global` 블록을 쓴다. `window`에 커스텀 프로퍼티를 추가하는 고전적인 사례가 대표적이다.

```typescript
// env.d.ts
export {}; // 모듈로 만들기 위한 관용구

declare global {
  interface Window {
    __INITIAL_DATA__: { userId: string };
  }
  const __APP_VERSION__: string;
}

// 사용하는 쪽
window.__INITIAL_DATA__.userId; // ✅
```

![스크립트 .d.ts와 모듈 .d.ts의 전역 스코프 차이](/assets/posts/ts-ambient-declarations-scope.svg)

`import` 구문 없이 모듈임을 강제하는 `export {}` 관용구는 의도를 명시하는 효과도 있어서, 전역 보강 파일의 표준 시작점으로 널리 쓰인다.

## declare namespace — 전역 객체의 계층 표현

전역이 단일 함수가 아니라 메서드를 가진 객체라면 `declare namespace`로 계층을 표현한다.

```typescript
// analytics.d.ts
declare namespace analytics {
  function track(event: string, props?: Record<string, unknown>): void;
  function identify(userId: string): void;

  interface Config { apiKey: string; debug?: boolean; }
  function init(config: Config): void;
}

// 사용
analytics.init({ apiKey: "..." });
analytics.track("signup");
```

모듈 시스템 이전 시대의 jQuery(`$.ajax`)나 Google Maps(`google.maps.Map`) 같은 라이브러리의 타입이 전부 이 패턴으로 작성되어 있다. DefinitelyTyped의 오래된 패키지를 열어봤을 때 `declare namespace`가 가득한 이유다.

## 어디에 두고 어떻게 포함시키나

앰비언트 선언 파일은 `tsconfig.json`의 `include` 범위에만 들어 있으면 자동으로 인식된다. 관례는 `src/types/` 디렉터리나 `src/globals.d.ts` 단일 파일이다. Vite 프로젝트의 `src/vite-env.d.ts`처럼 프레임워크가 미리 만들어 주는 파일에 추가해도 된다.

마지막으로 우선순위 하나 — 전역을 선언하기 전에 항상 자문하자. *이것이 정말 전역이어야 하나?* import할 수 있는 일반 모듈이 타입 추적, 리팩터링, 테스트 모든 면에서 낫다. 앰비언트 선언은 전역이라는 기존 현실을 **수용**하는 도구이지, 새로운 전역을 만드는 핑계가 아니다. 다음 글에서는 앰비언트 선언의 모듈 버전 — 타입 없는 모듈 전체에 타입을 입히는 **앰비언트 모듈**(`declare module`)을 다룬다.

---

**지난 글:** [DefinitelyTyped와 @types — 커뮤니티 타입 생태계](/posts/ts-definitely-typed/)

**다음 글:** [앰비언트 모듈 — 타입 없는 모듈에 타입 입히기](/posts/ts-ambient-modules/)

<br>
읽어주셔서 감사합니다. 😊
