---
title: "satisfies 연산자 — 타입 검증과 추론 보존을 동시에"
description: "TypeScript 4.9의 satisfies 연산자가 타입 주석·as 단언과 어떻게 다른지, 검사는 엄격하게 유지하면서 추론된 리터럴 타입을 보존하는 원리와 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "satisfies", "타입추론", "타입주석", "as단언", "const어서션"]
featured: false
draft: false
---

[지난 글](/posts/ts-deep-readonly/)에서 재귀 매핑 타입으로 중첩 객체 전체를 불변으로 만드는 패턴을 다뤘다. 이번에는 TypeScript 4.9에서 추가된 이후 설정 객체와 상수 정의의 표준이 된 **`satisfies` 연산자**를 살펴본다. 핵심은 한 문장으로 요약된다 — *값이 어떤 타입을 만족하는지 검사하되, 변수의 타입은 추론된 결과 그대로 둔다.* 타입 주석과 `as` 단언 사이에서 늘 아쉬웠던 빈자리를 정확히 채우는 기능이다.

## 타입 주석의 딜레마

색상 팔레트를 정의한다고 하자. 값은 `"#ff0000"` 같은 문자열일 수도, `[255, 0, 0]` 같은 RGB 튜플일 수도 있다.

```typescript
type RGB = [red: number, green: number, blue: number];
type Color = string | RGB;

const palette: Record<string, Color> = {
  red: [255, 0, 0],
  green: "#00ff00",
  blue: [0, 0, 255],
};

const r = palette.red.at(0);
// ❌ Error: 'at' 속성이 'Color' 형식에 없습니다
```

`red`에 분명히 배열을 넣었는데도 `palette.red`의 타입은 `Color`, 즉 `string | RGB`다. 타입 주석을 붙이는 순간 컴파일러는 **선언된 타입을 변수의 타입으로 채택**하고, 값에서 추론할 수 있었던 더 정밀한 정보(`red`는 튜플, `green`은 문자열)를 버린다. 검사는 얻었지만 추론을 잃었다.

반대로 주석을 떼면 추론은 완벽해지지만, `Color`에 맞지 않는 값을 넣거나 키 이름에 오타를 내도 그 자리에서는 아무 에러가 나지 않는다. 검사를 잃은 것이다.

![타입 주석 vs satisfies 추론 보존 비교](/assets/posts/ts-satisfies-operator-vs-annotation.svg)

## satisfies — 두 마리 토끼

`satisfies`는 표현식 뒤에 붙어서 "이 값이 해당 타입에 할당 가능한지"를 검사하지만, 표현식의 타입 자체는 바꾸지 않는다.

```typescript
const palette = {
  red: [255, 0, 0],
  green: "#00ff00",
  blue: [0, 0, 255],
} satisfies Record<string, Color>;

const r = palette.red.at(0);   // ✅ red는 [number, number, number]
const g = palette.green.toUpperCase(); // ✅ green은 string
```

`palette.red`는 튜플로, `palette.green`은 문자열로 정확히 추론된다. 동시에 제약 검사도 살아 있다.

```typescript
const broken = {
  red: [255, 0],          // ❌ RGB 튜플은 요소 3개 필요
  grren: "#00ff00",       // ❌ 오타도 초과 프로퍼티 검사로 잡힘
} satisfies Record<"red" | "green", Color>;
```

`as` 단언과 비교하면 차이가 더 분명하다. `as`는 컴파일러의 판단을 **덮어쓰는** 도구라서 실제로 맞지 않는 값도 통과시킬 수 있지만, `satisfies`는 일반 할당과 동일한 엄격한 검사를 수행한다. 검사를 우회할 방법이 없다.

![타입 주석, as, satisfies 세 가지 방식 비교](/assets/posts/ts-satisfies-operator-three-ways.svg)

## as const와의 조합

`satisfies`는 `as const`와 함께 쓸 때 진가가 드러난다. `as const`로 리터럴 타입을 고정하고, `satisfies`로 구조를 검증하는 조합이다.

```typescript
type Route = { path: string; auth: boolean };

const routes = {
  home: { path: "/", auth: false },
  admin: { path: "/admin", auth: true },
} as const satisfies Record<string, Route>;

// routes.admin.path 타입: "/admin" (리터럴!)
// routes.admin.auth 타입: true

type RouteName = keyof typeof routes; // "home" | "admin"
```

`as const`만 쓰면 구조 검증이 없고, `satisfies`만 쓰면 `path`가 `string`으로 넓어진다. 둘을 함께 쓰면 **리터럴 수준의 정밀한 타입과 구조 검증**을 모두 얻는다. 라우트 테이블, 환경 설정, 디자인 토큰처럼 "형태는 정해져 있지만 각 값의 리터럴이 중요한" 데이터에 사실상의 표준 패턴이다.

## 실전 활용 패턴

설정 객체에서 특히 자주 쓰인다. 예를 들어 환경별 설정을 정의하면서 키 누락을 잡고 싶을 때다.

```typescript
type Env = "development" | "staging" | "production";
type EnvConfig = { apiUrl: string; debug: boolean };

const config = {
  development: { apiUrl: "http://localhost:3000", debug: true },
  staging: { apiUrl: "https://stg.example.com", debug: true },
  production: { apiUrl: "https://api.example.com", debug: false },
} satisfies Record<Env, EnvConfig>;
```

`Record<Env, EnvConfig>`를 만족해야 하므로 세 환경 중 하나라도 빠지면 컴파일 에러가 난다. 동시에 `config.development.apiUrl`은 정확한 추론을 유지하므로 이후 코드에서 자유롭게 쓸 수 있다.

함수 구현이 인터페이스를 만족하는지 확인할 때도 유용하다.

```typescript
interface Handlers {
  onClick?: (e: MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
}

const handlers = {
  onClick: (e) => console.log(e.clientX), // e가 MouseEvent로 추론
} satisfies Handlers;
```

`satisfies`가 문맥 타입(contextual type)을 제공하므로 매개변수 `e`의 타입을 일일이 적지 않아도 된다.

## 언제 무엇을 쓸까

세 도구의 역할을 정리하면 이렇다. **타입 주석**은 함수 시그니처나 공개 API처럼 "넓은 타입으로 통일하는 것 자체가 목적"일 때 쓴다. **`as` 단언**은 컴파일러보다 개발자가 더 많이 아는 극히 드문 경우(예: `document.getElementById`의 결과를 구체 타입으로 좁힐 때)로 제한한다. 그리고 **`satisfies`**는 "제약은 검증하고 싶지만 추론은 잃기 싫은" 나머지 대부분의 경우 — 특히 상수 데이터 정의 — 에 쓴다.

`as`를 쓰려던 자리에서 한 번씩 멈춰 "이거 `satisfies`로 되지 않나?"라고 자문해 보는 습관만으로도 코드의 타입 안전성이 눈에 띄게 올라간다. 다음 글에서는 TypeScript가 `import` 경로를 실제 파일로 연결하는 **모듈 해석(module resolution)** 의 동작 원리를 파헤친다.

---

**지난 글:** [Deep Readonly 패턴 완전 정복](/posts/ts-deep-readonly/)

**다음 글:** [모듈 해석 — TypeScript가 import를 찾는 방법](/posts/ts-module-resolution/)

<br>
읽어주셔서 감사합니다. 😊
