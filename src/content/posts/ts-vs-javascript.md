---
title: "TypeScript vs JavaScript: 무엇이 다른가"
description: "TypeScript와 JavaScript의 핵심 차이점을 타입 시스템, 오류 감지 시점, 컴파일 과정, IDE 지원 등 6가지 관점에서 구체적으로 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "비교", "컴파일", "차이점"]
featured: false
draft: false
---

[지난 글](/posts/ts-why-typescript/)에서 TypeScript가 주는 이점을 살펴봤습니다. 이번 글에서는 TypeScript와 JavaScript가 구체적으로 어떤 점에서 다른지 코드와 함께 비교합니다.

## 가장 눈에 띄는 차이: 타입 주석

JavaScript와 TypeScript 코드를 나란히 보면 차이가 바로 보입니다.

```javascript
// JavaScript
function calculateTax(amount, rate) {
  return amount * rate;
}

const result = calculateTax(1000, "10%"); // 오류지만 실행됨
```

```typescript
// TypeScript
function calculateTax(amount: number, rate: number): number {
  return amount * rate;
}

const result = calculateTax(1000, "10%");
// TS2345: Argument of type 'string' is not assignable
// to parameter of type 'number'
```

타입 주석(`: number`)이 추가되는 것이 문법의 전부처럼 보이지만, 이것이 타입 검사기를 동작시키는 열쇠입니다.

![TypeScript vs JavaScript 비교표](/assets/posts/ts-vs-javascript-compare.svg)

## 컴파일 과정이 필요하다

JavaScript는 브라우저와 Node.js가 직접 실행합니다. TypeScript는 반드시 JavaScript로 컴파일해야 실행할 수 있습니다.

![TypeScript 컴파일 흐름](/assets/posts/ts-vs-javascript-compile.svg)

```bash
# TypeScript 파일 컴파일
npx tsc index.ts

# 결과: index.js 생성 (타입 정보 제거됨)
```

이 컴파일 단계가 핵심입니다. `tsc`는 타입 검사를 수행하고, 오류가 있으면 보고한 뒤 JavaScript를 출력합니다. (`--noEmitOnError` 옵션으로 오류 시 JS 출력을 막을 수 있습니다.)

## 타입 추론: 모든 곳에 타입을 쓰지 않아도 된다

TypeScript의 타입 추론(type inference) 덕분에 모든 곳에 타입을 명시할 필요는 없습니다.

```typescript
// 타입 명시 안 해도 TS가 number로 추론
const score = 95;

// 명시적 타입 주석
const name: string = "Alice";

// 함수 반환 타입 추론
function double(n: number) {
  return n * 2; // 반환 타입 number로 자동 추론
}

// 복잡한 경우엔 명시 권장
function fetchData(): Promise<User[]> {
  return fetch("/api/users").then(r => r.json());
}
```

## `any`: 탈출구이자 위험 신호

TypeScript에는 `any`라는 특별한 타입이 있습니다. `any`로 지정된 변수는 타입 검사를 완전히 건너뜁니다.

```typescript
let data: any = "hello";
data = 42;        // OK
data = { x: 1 };  // OK
data.foo.bar;     // 타입 오류 없음 — 런타임에 터질 수 있음!
```

`any`는 기존 JavaScript 코드를 점진적으로 마이그레이션할 때 임시로 사용하는 탈출구입니다. 가능하면 `unknown`으로 대체하고, `tsconfig.json`에 `"noImplicitAny": true`를 설정하는 것이 좋습니다.

## JavaScript 파일과의 호환

TypeScript는 JavaScript 파일을 프로젝트에 그대로 포함할 수 있습니다. `tsconfig.json`에 `"allowJs": true`를 설정하면 `.js` 파일도 함께 컴파일됩니다. JSDoc 주석을 활용하면 JS 파일에서도 타입 힌트를 얻을 수 있습니다.

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true
  }
}
```

TypeScript와 JavaScript는 적입니다 — 아니라, TypeScript는 JavaScript 위에서 작동합니다. TypeScript를 배운다는 것은 JavaScript를 버리는 게 아니라 JavaScript를 더 잘 쓰는 방법을 배우는 것입니다.

---

**지난 글:** [왜 TypeScript인가: 타입 시스템이 주는 생산성](/posts/ts-why-typescript/)

**다음 글:** [TypeScript 설치와 환경 구성](/posts/ts-setup-install/)

<br>
읽어주셔서 감사합니다. 😊
