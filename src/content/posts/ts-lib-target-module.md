---
title: "lib·target·module — 컴파일 타깃을 결정하는 3대 옵션"
description: "TypeScript 출력을 결정하는 target, module, lib 옵션을 정리합니다. 각 옵션의 역할 분담, target에 따른 문법 변환, lib의 기본값과 DOM 포함 여부, 환경별 권장 조합을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "tsconfig", "target", "module", "lib", "컴파일러옵션"]
featured: false
draft: false
---

[지난 글](/posts/ts-tsconfig-paths-baseurl/)에서 `paths`로 import 경로를 정리했다. 이번에는 컴파일러가 **무엇을, 어디로 향해** 코드를 변환하는지를 결정하는 세 옵션, `target`·`module`·`lib`을 다룬다. 이 셋은 자주 한 묶음으로 다뤄지지만 각자 책임이 다르고, 그 차이를 모르면 "분명 최신 문법인데 타입이 없다"거나 "빌드는 됐는데 실행이 안 된다"는 혼란에 빠지기 쉽다.

## 세 옵션의 역할 분담

먼저 큰 그림부터. `target`은 출력 JavaScript의 **문법 수준**, `module`은 출력의 **모듈 형식**, `lib`은 코드에서 사용 가능한 **내장 API 타입**을 결정한다. 서로 독립적이다.

![target, module, lib 세 옵션의 역할 분담](/assets/posts/ts-lib-target-module-roles.svg)

이 셋이 따로 논다는 점이 중요하다. `target: "ESNext"`로 최신 문법을 그대로 출력하면서, `module: "CommonJS"`로 모듈만 require 방식으로 바꿀 수 있다. 셋을 헷갈리면 엉뚱한 옵션을 만지게 된다.

## target: 출력 문법의 수준

`target`은 컴파일러가 어느 ECMAScript 버전의 문법으로 코드를 내보낼지 정한다. `target`이 낮으면 화살표 함수, `async/await`, 옵셔널 체이닝 같은 신문법을 그 버전이 이해할 수 있는 형태로 **다운레벨링(변환)** 한다.

![target을 낮추면 신문법이 변환되는 모습](/assets/posts/ts-lib-target-module-emit.svg)

```json
{ "compilerOptions": { "target": "ES2022" } }
```

`target`을 무작정 낮추면 출력 코드가 커지고 헬퍼 함수가 늘어난다. 요즘 환경은 대부분 최신 문법을 지원하므로, 굳이 구형 브라우저를 지원할 게 아니라면 `ES2020`~`ES2022` 정도를 두는 것이 보통이다. 브라우저 호환성은 보통 Babel/번들러가 별도로 처리하므로 `tsc`에서 과하게 낮출 이유가 적다.

## lib: 사용 가능한 내장 타입

`lib`은 코드에서 **타입으로** 사용할 수 있는 내장 API 목록이다. `Array.prototype.flat`, `Promise`, `fetch`, `document` 같은 것들의 타입 선언이 여기 들어 있다. 핵심은 `lib`이 **타입만** 제공할 뿐, 런타임 폴리필을 넣어주지는 않는다는 점이다.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

`lib`을 명시하지 않으면 `target`에 따라 기본값이 정해진다. 예를 들어 `target: "ES2020"`이면 `lib`도 `ES2020`(+DOM) 수준이 기본으로 깔린다. 그래서 흔한 함정이 하나 있다. **브라우저가 아닌 Node 프로젝트**에서 기본값에 포함된 `DOM` 타입 때문에 `document`나 `window`가 타입 에러 없이 통과해버리는 것이다. Node 전용이라면 `lib`에서 `DOM`을 빼고 `@types/node`에 맡기는 게 안전하다.

반대로 `target`은 낮게 두면서 새 API의 타입만 쓰고 싶을 때도 `lib`을 따로 지정한다. 이때는 런타임 폴리필을 직접 챙겨야 한다 — `lib`이 타입만 줄 뿐 구현은 주지 않기 때문이다.

## module: 출력 모듈 형식

`module`은 `import`/`export`를 어떤 모듈 시스템으로 내보낼지 정한다. `CommonJS`로 두면 `require`/`module.exports`로, `ESNext`로 두면 `import`/`export`를 그대로 유지한다.

```json
{ "compilerOptions": { "module": "ESNext", "moduleResolution": "Bundler" } }
```

`module`은 `target`보다 까다롭다. 모듈 해석 방식(`moduleResolution`), 패키지의 `type: "module"` 여부, 실행 환경(Node ESM/CJS, 번들러)과 맞물리기 때문이다. 이 모듈 해석 주제는 그 자체로 깊어서, 이 시리즈에서도 별도 글로 다룬다. 여기서는 "`module`은 출력의 모듈 형식을 정하고, 실제 해석 규칙은 `moduleResolution`과 함께 정해진다"는 큰 틀만 잡아두자.

## 환경별 권장 조합

정답은 환경에 따라 다르지만, 출발점으로 삼을 만한 조합은 다음과 같다.

```json
// 번들러를 쓰는 프런트엔드 (Vite/webpack)
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "Bundler",
  "lib": ["ES2022", "DOM", "DOM.Iterable"]
}
```

```json
// 번들 없이 실행하는 최신 Node
{
  "target": "ES2022",
  "module": "NodeNext",
  "moduleResolution": "NodeNext",
  "lib": ["ES2022"]
}
```

요점은 "출력이 어디서 실행되는가"로 거꾸로 추론하는 것이다. 번들러가 받는다면 `module`은 `ESNext`로 두고 번들러에 맡기고, Node가 직접 실행한다면 Node의 모듈 규칙(`NodeNext`)에 맞춘다. `lib`은 실행 환경에 실제로 존재하는 API에 맞춰 DOM 포함 여부를 정한다.

이렇게 출력 형식까지 정했다면, 다음은 **빌드 도구가 파일을 하나씩 따로 변환**할 때 생기는 제약을 봐야 한다. 다음 글에서 `isolatedModules` 옵션과, 그것이 왜 Babel·esbuild·swc 같은 트랜스파일러와 함께 쓸 때 중요한지를 다룬다.

---

**지난 글:** [paths와 baseUrl — 경로 별칭으로 import 정리하기](/posts/ts-tsconfig-paths-baseurl/)

**다음 글:** [isolatedModules — 파일 단위 트랜스파일을 위한 제약](/posts/ts-isolated-modules/)

<br>
읽어주셔서 감사합니다. 😊
