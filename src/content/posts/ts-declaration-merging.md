---
title: "선언 병합 — 같은 이름의 선언이 만나면"
description: "TypeScript 고유의 선언 병합 규칙을 정리합니다. 인터페이스 병합의 동작과 제약, namespace와 함수·클래스·enum의 병합 패턴, Window 확장 같은 실전 사례와 주의점을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "선언병합", "declaration-merging", "interface", "namespace", "Window확장"]
featured: false
draft: false
---

[지난 글](/posts/ts-ambient-modules/)에서 앰비언트 모듈로 타입 없는 모듈을 정의하는 방법을 다루면서, "이미 타입이 있는 것을 확장하려면 다른 메커니즘이 필요하다"고 예고했다. 그 메커니즘의 뿌리가 이번 주제인 **선언 병합(declaration merging)** 이다. 같은 스코프에서 같은 이름의 선언이 여러 번 등장하면 에러가 아니라 **하나로 합쳐진다**는, 다른 언어에서 보기 드문 TypeScript 고유의 규칙이다.

## 인터페이스 병합 — 가장 중요한 케이스

같은 이름의 `interface`를 두 번 선언하면 컴파일러는 두 선언의 멤버를 합친 하나의 인터페이스로 취급한다.

```typescript
interface Box {
  width: number;
}

interface Box {
  height: number;
}

// 컴파일러가 보는 Box = { width: number; height: number }
const b: Box = { width: 100, height: 50 }; // ✅
```

![인터페이스 병합 — 두 선언이 하나가 된다](/assets/posts/ts-declaration-merging-interface.svg)

처음 보면 "오타로 이름이 겹치면 어쩌려고?" 싶은 위험한 기능 같지만, 이것은 의도된 설계다. 인터페이스는 **열려 있다(open)**. 누구든, 어느 파일에서든(같은 전역/모듈 스코프라면) 기존 인터페이스에 멤버를 추가할 수 있다. 표준 DOM 타입(`lib.dom.d.ts`)의 `Window`에 내 프로퍼티를 추가할 수 있는 것도, 라이브러리가 플러그인으로 확장될 수 있는 것도 모두 이 개방성 덕분이다.

```typescript
// 전역 스코프에서 — lib.dom.d.ts의 Window와 병합된다
declare global {
  interface Window {
    __ANALYTICS_READY__: boolean;
  }
}
window.__ANALYTICS_READY__ = true; // ✅
```

병합에는 규칙이 있다. **같은 이름의 프로퍼티는 타입까지 동일해야 한다.** 한쪽에서 `width: number`, 다른 쪽에서 `width: string`이면 에러다. 함수 멤버는 예외적으로 **오버로드로 누적**되며, 나중에 선언된 쪽의 오버로드가 더 높은 우선순위를 갖는다.

```typescript
interface Parser {
  parse(input: string): object;
}
interface Parser {
  parse(input: Uint8Array): object; // 오버로드로 추가됨
}
```

## type 별칭은 병합되지 않는다

인터페이스와 타입 별칭의 가장 실질적인 차이가 바로 여기다. `type`은 **닫혀 있다(closed)**.

```typescript
type Box = { width: number };
type Box = { height: number };
// ❌ TS2300: Duplicate identifier 'Box'.
```

이 차이가 공개 API 설계의 가이드라인을 만든다. 라이브러리의 공개 타입처럼 **사용자가 확장할 여지를 열어두고 싶다면 interface**, 유니언·매핑 타입이거나 **확장을 의도적으로 막고 싶다면 type**이 자연스러운 선택이다.

## namespace가 끼는 병합 — 값과 타입의 합체

선언 병합의 두 번째 축은 `namespace`다. namespace끼리는 물론이고, **함수·클래스·enum 같은 값 선언과도 병합**된다. 같은 이름의 함수와 namespace를 선언하면 "프로퍼티를 가진 함수"가 된다.

```typescript
function greet(name: string): string {
  return `${greet.prefix} ${name}`;
}

namespace greet {
  export let prefix = "Hello,";
  export type Style = "formal" | "casual";
}

greet("Dev");          // 함수로 호출
greet.prefix = "Hi,";  // 프로퍼티 접근
let s: greet.Style;    // 타입까지 제공
```

jQuery의 `$()`이자 `$.ajax`인 구조, 또는 `Object.assign`처럼 호출 가능하면서 멤버도 가진 API의 타입이 이 패턴으로 표현된다. 클래스와 병합하면 정적 멤버와 보조 타입을 클래스 이름 아래에 묶을 수 있다.

```typescript
class Tree {
  children: Tree.Node[] = [];
}

namespace Tree {
  export interface Node { value: number }
}

const n: Tree.Node = { value: 1 }; // 클래스 이름이 타입 컨테이너 역할
```

## 병합 가능 조합 한눈에 보기

전체 조합을 정리하면 이렇다.

![선언 병합 가능 조합 표](/assets/posts/ts-declaration-merging-kinds.svg)

```text
interface + interface        ✓ 멤버 병합
namespace + namespace        ✓ 내보내기 병합
namespace + function         ✓ 프로퍼티 가진 함수
namespace + class / enum     ✓ 정적 멤버·보조 타입 추가
type      + type             ✗ 중복 식별자 에러
class     + class            ✗ 병합 불가
```

값 선언끼리(class + class, function + 일반 function 재선언)는 병합되지 않는다는 점이 일관된 원칙이다 — 런타임에 실체가 두 개 생기는 병합은 타입 시스템이 흉내 낼 수 없기 때문이다.

## 강력함의 대가 — 주의점

선언 병합은 "어디서든 타입을 추가할 수 있다"는 뜻이고, 이는 곧 **타입의 정의를 한 곳에서 읽을 수 없게 될 수 있다**는 뜻이다. 몇 가지 원칙을 지키는 것이 좋다.

첫째, 의도적인 병합은 **한 곳에 모은다.** 전역 확장은 `src/types/global.d.ts` 한 파일로, 라이브러리 확장은 해당 라이브러리 이름의 파일로. 둘째, 우연한 병합을 경계한다. 전역 스코프(스크립트 파일)에서 `User`, `Config` 같은 흔한 이름의 인터페이스를 선언하면 의도치 않게 다른 선언과 합쳐질 수 있다 — 모듈 파일(import/export 있는 파일) 안의 선언은 병합 범위가 그 모듈로 제한되므로 훨씬 안전하다. 셋째, 새 코드에서 namespace 병합 패턴을 남발하지 않는다. ESM 시대에는 모듈 자체가 네임스페이스 역할을 하므로, 이 패턴은 주로 기존 API의 타입을 정확히 기술할 때 필요한 도구다.

선언 병합은 그 자체로 쓰는 날보다, **이 규칙 위에 세워진 기능**을 쓰는 날이 훨씬 많다. Express의 `Request`에 `user` 프로퍼티를 추가하고, Vue 컴포넌트 옵션을 확장하는 — 라이브러리 모듈을 외부에서 확장하는 **모듈 보강(module augmentation)** 이 바로 그것이다. 다음 글에서 이어서 다룬다.

---

**지난 글:** [앰비언트 모듈 — 타입 없는 모듈에 타입 입히기](/posts/ts-ambient-modules/)

<br>
읽어주셔서 감사합니다. 😊
