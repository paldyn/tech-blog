---
title: "전역 보강 — Window와 전역 스코프 확장하기"
description: "모듈 안에서 전역 스코프를 확장하는 declare global을 정리합니다. Window·globalThis 확장, 전역 변수와 함수 선언, interface와 var의 차이, .d.ts 배치와 흔한 실수를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "전역보강", "global-augmentation", "declare-global", "Window", "globalThis"]
featured: false
draft: false
---

[지난 글](/posts/ts-module-augmentation/)에서 `declare module`로 특정 라이브러리 모듈의 타입을 확장하는 모듈 보강을 다뤘다. 그런데 우리가 확장하고 싶은 대상이 모듈이 아니라 **전역**일 때가 있다. 브라우저의 `window.dataLayer`, Node의 `globalThis.__config`, 어디서나 import 없이 부르는 전역 함수 — 이런 것들은 어떤 모듈에도 속하지 않는다. 이때 쓰는 도구가 **전역 보강(global augmentation)**, 즉 `declare global`이다.

## declare global의 역설

전역 보강의 핵심 문법은 모듈 파일 **안에서** `declare global { ... }` 블록을 여는 것이다. 여기엔 작은 역설이 있다. 전역을 확장하려면 그 파일이 **모듈**이어야 한다는 점이다.

![declare global 블록이 모듈 내부에서 전역 스코프로 병합되는 흐름](/assets/posts/ts-global-augmentation-flow.svg)

왜 그럴까? 전역 스크립트 파일(import/export가 없는 파일)에서는 모든 선언이 이미 전역이다. 그래서 거기서 `interface Window`를 선언하면 그냥 전역 선언 병합으로 충분하고 `declare global`이 필요 없다 — 오히려 에러가 난다. `declare global`은 정확히 "지금은 모듈 스코프지만, 이 블록만큼은 전역으로 빠져나가겠다"는 탈출구다. 따라서 파일을 모듈로 만드는 `import`나 `export`가 **반드시** 있어야 한다.

![Window와 globalThis를 declare global로 확장하는 코드](/assets/posts/ts-global-augmentation-code.svg)

파일에 다른 import가 없다면 `export {};` 한 줄을 넣어 빈 모듈로 만드는 것이 관용적인 방법이다.

## interface는 병합, var는 전역 변수

전역 보강 블록 안에서 자주 헷갈리는 두 가지가 `interface`와 `var`다. 역할이 다르다.

```typescript
export {};

declare global {
  // 1) 기존 전역 타입에 멤버를 "병합"
  interface Window {
    dataLayer: unknown[];
  }

  // 2) 새 전역 "변수"를 선언
  var __APP_VERSION__: string;

  // 3) 새 전역 "함수"를 선언
  function gtag(...args: unknown[]): void;
}
```

`interface Window`는 이미 존재하는 `Window` 타입에 선언 병합으로 멤버를 더한다. 반면 새로운 전역 식별자(`__APP_VERSION__`, `gtag`)를 추가할 때는 `var`/`function`/`class`로 선언한다. 여기서 주의할 점 하나 — 전역 변수는 반드시 `var`를 써야 한다. `let`이나 `const`로 선언하면 `globalThis`에 프로퍼티로 노출되지 않아, `globalThis.__APP_VERSION__` 같은 접근이 타입 체크에서 막힌다.

## window vs globalThis

`interface Window`를 확장하면 브라우저의 `window.dataLayer`가 타입을 얻는다. 하지만 Node나 워커처럼 `window`가 없는 환경에서는 `globalThis`를 써야 한다. 다행히 둘은 연결되어 있다.

```typescript
declare global {
  interface Window {
    appReady: boolean;
  }
}

// 브라우저
window.appReady = true;     // ✅
// 환경 중립적으로 접근
globalThis.appReady;        // ✅ Window를 통해 globalThis에도 반영
```

브라우저에서 `globalThis`는 곧 `window`이므로, `Window` 인터페이스에 추가한 멤버는 `globalThis`를 통해서도 보인다. 환경에 종속되지 않는 전역 값을 만들고 싶다면 `interface Window` 대신 `var`로 전역 변수를 선언하는 편이 더 명확하다.

## .d.ts는 컴파일 대상에 포함되어야 한다

모듈 보강과 마찬가지로, 전역 보강 파일도 컴파일 범위 안에 있어야 효력이 생긴다. 보통 `src/types/global.d.ts` 한 파일에 모아두고 `tsconfig.json`의 `include`가 이를 포함하도록 한다.

```json
{
  "include": ["src/**/*.ts", "src/types/global.d.ts"]
}
```

`src/**/*.ts` 패턴은 `.d.ts`도 매칭하므로 보통은 자동으로 포함된다. 그래도 보강이 먹지 않을 때는 가장 먼저 "이 파일이 정말 컴파일 대상인가"와 "이 파일이 모듈인가(import/export가 있는가)"를 확인하자. 이 둘이 전역 보강 실패의 대부분이다.

## 남용하지 말 것

전역 보강은 강력하지만, 그만큼 **전역 네임스페이스를 오염**시킨다. 추가한 타입은 코드베이스 어디서나 보이므로, 흔한 이름을 쓰면 충돌 위험이 커지고 "이 타입이 어디서 왔는지" 추적하기 어려워진다. 가능하면 모듈로 export해서 명시적으로 import하는 쪽이 낫고, 전역 보강은 정말로 전역이어야 하는 것(서드파티 스크립트가 심는 `window` 프로퍼티, 빌드 타임에 주입되는 상수 등)에만 쓰자.

여기까지가 타입 시스템을 외부로 확장하는 보강 3종 세트—선언 병합, 모듈 보강, 전역 보강—다. 지금부터는 시선을 컴파일러 설정으로 옮긴다. 다음 글에서는 TypeScript의 엄격함을 구성하는 `strict` 모드 플래그들을 하나씩 뜯어본다.

---

**지난 글:** [모듈 보강 — 남의 라이브러리 타입을 확장하기](/posts/ts-module-augmentation/)

**다음 글:** [strict 모드 플래그 — 엄격함을 구성하는 옵션들](/posts/ts-strict-mode-flags/)

<br>
읽어주셔서 감사합니다. 😊
