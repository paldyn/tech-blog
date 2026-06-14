---
title: "strict 모드 플래그 — 엄격함을 구성하는 옵션들"
description: "TypeScript의 strict 모드를 구성하는 개별 플래그를 정리합니다. strict가 켜는 플래그 묶음, strictNullChecks와 noImplicitAny의 효과, strict에 포함되지 않는 추가 안전 플래그까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 3
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "strict", "tsconfig", "strictNullChecks", "noImplicitAny", "컴파일러옵션"]
featured: false
draft: false
---

[지난 글](/posts/ts-global-augmentation/)까지 선언 병합·모듈 보강·전역 보강으로 타입 시스템을 외부로 확장하는 법을 다뤘다. 이제 시선을 컴파일러 설정으로 옮긴다. TypeScript를 도입할 때 가장 먼저, 그리고 가장 크게 영향을 주는 설정이 바로 **`strict`** 다. 새 프로젝트라면 켜야 하고, 기존 프로젝트라면 어떻게 켤지 고민해야 하는 이 옵션의 정체를 뜯어보자.

## strict는 사실 묶음 스위치

`tsconfig.json`에 `"strict": true` 한 줄을 쓰면 간단해 보이지만, 이것은 **여러 개별 플래그를 한꺼번에 켜는** 메타 스위치다.

![strict: true가 켜는 개별 플래그 묶음](/assets/posts/ts-strict-mode-flags-family.svg)

`strict: true`가 켜는 주요 플래그는 다음과 같다.

- `noImplicitAny` — 타입을 추론할 수 없는 자리에 암묵적 `any`가 생기는 것을 에러로 만든다.
- `strictNullChecks` — `null`과 `undefined`를 모든 타입의 일부로 취급하지 않고 별도로 구분한다.
- `strictFunctionTypes` — 함수 타입의 파라미터를 반공변(contravariant)으로 더 엄격하게 검사한다.
- `strictBindCallApply` — `bind`/`call`/`apply` 호출의 인자 타입을 검사한다.
- `strictPropertyInitialization` — 클래스 필드가 생성자에서 초기화되는지 강제한다.
- `noImplicitThis` — `this`가 암묵적 `any`가 되는 것을 막는다.
- `alwaysStrict` — 출력 파일마다 `'use strict'`를 넣고 strict 모드로 파싱한다.
- `useUnknownInCatchVariables` — `catch (e)`의 `e`를 `any`가 아닌 `unknown`으로 만든다.

핵심은 `strict: true`로 전부 켜되, 필요하면 그 아래에서 개별 플래그를 `false`로 끌 수 있다는 점이다. 예를 들어 마이그레이션 중이라면 `"strict": true`와 함께 `"strictPropertyInitialization": false`를 둬서 한 가지만 잠시 완화할 수 있다.

## strictNullChecks: 가장 영향이 큰 플래그

이 묶음에서 코드에 가장 큰 변화를 주는 것이 `strictNullChecks`다. 끄면 `null`과 `undefined`가 모든 타입에 슬그머니 할당 가능하지만, 켜면 명시적으로 다뤄야 한다.

![strictNullChecks 켜고 끔에 따른 컴파일 결과 비교](/assets/posts/ts-strict-mode-flags-nullchecks.svg)

```typescript
function len(s: string | null): number {
  // strictNullChecks: true 에서는 좁히기가 강제된다
  if (s === null) return 0;
  return s.length; // 여기서 s는 string으로 좁혀짐
}
```

`strictNullChecks`가 켜져 있으면 "`null`일 수도 있는 값"을 그냥 쓸 수 없다. 위처럼 좁히기를 거치거나, 옵셔널 체이닝(`s?.length`)을 써야 한다. 처음엔 에러가 쏟아져 번거롭지만, 이 플래그 하나가 막아주는 "`undefined`의 프로퍼티를 읽을 수 없습니다" 류의 런타임 버그는 실무에서 가장 흔한 종류다.

## noImplicitAny: 타입을 적게 해 달라는 요청

`noImplicitAny`는 컴파일러가 타입을 추론하지 못하는 자리에 암묵적으로 `any`를 넣는 것을 금지한다.

```typescript
// noImplicitAny: true
function greet(name) {   // ❌ 'name'의 타입이 암묵적 any
  return `Hi, ${name}`;
}

function greet2(name: string) { // ✅ 명시
  return `Hi, ${name}`;
}
```

주의할 점은 이것이 **모든** `any`를 막는 게 아니라는 것이다. 추론 실패로 **암묵적으로 생기는** `any`만 막는다. 개발자가 `: any`라고 직접 쓰는 것은 여전히 허용된다. 그것까지 막고 싶다면 ESLint의 `@typescript-eslint/no-explicit-any` 같은 별도 규칙이 필요하다.

## strict에 포함되지 않는 추가 플래그

`strict`는 출발점이지 종착점이 아니다. 더 깐깐하게 가고 싶다면 `strict` 묶음에 **포함되지 않는** 안전 플래그를 따로 켤 수 있다.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true
  }
}
```

특히 `noUncheckedIndexedAccess`는 강력하다. 배열·객체를 인덱스로 접근한 결과에 자동으로 `| undefined`를 붙여, `arr[i]`가 존재한다고 가정하는 흔한 실수를 막는다. 다만 인덱스 접근이 많은 코드에서는 좁히기 부담이 커지므로, 팀의 성숙도에 맞춰 도입 여부를 정하면 된다.

## 권장 출발점

새 프로젝트라면 고민할 것 없이 `"strict": true`로 시작하라. 기존 프로젝트라면 `strictNullChecks`가 가장 큰 산이므로, 다른 플래그를 먼저 켜고 마지막에 `strictNullChecks`를 켜는 단계적 접근이 흔하다. 어느 쪽이든 목표는 같다 — 컴파일러가 더 많은 버그를 빌드 타임에 잡게 만드는 것이다.

`strict`로 컴파일러를 엄격하게 세팅했다면, 다음으로 흔히 손대는 것이 import 경로다. 다음 글에서는 `baseUrl`과 `paths`로 경로 별칭을 만들어 지저분한 상대 경로 import를 정리하는 법을 다룬다.

---

**지난 글:** [전역 보강 — Window와 전역 스코프 확장하기](/posts/ts-global-augmentation/)

**다음 글:** [paths와 baseUrl — 경로 별칭으로 import 정리하기](/posts/ts-tsconfig-paths-baseurl/)

<br>
읽어주셔서 감사합니다. 😊
