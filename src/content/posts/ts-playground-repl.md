---
title: "TypeScript Playground로 빠르게 배우기"
description: "설치 없이 브라우저에서 TypeScript를 실험할 수 있는 공식 Playground의 모든 기능을 알아봅니다. 실시간 타입 검사, 컴파일 결과 확인, URL 공유, 버전 선택 등 학습을 가속하는 방법을 소개합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "Playground", "학습", "온라인도구", "REPL"]
featured: false
draft: false
---

[지난 글](/posts/ts-compiler-tsc/)에서 `tsc` 컴파일러의 옵션들을 살펴봤습니다. 이번 글에서는 환경 설정 없이 TypeScript를 즉시 실험할 수 있는 공식 Playground를 소개합니다.

## TypeScript Playground란

TypeScript Playground(`typescriptlang.org/play`)는 TypeScript 공식 웹사이트에서 제공하는 브라우저 기반 편집기입니다. Node.js, npm, VS Code 설치 없이 TypeScript 코드를 작성하고 타입 검사 결과를 즉시 확인할 수 있습니다.

![Playground 주요 기능](/assets/posts/ts-playground-repl-features.svg)

학습 초기에는 환경 설정보다 TypeScript 문법과 타입 시스템을 익히는 데 집중하는 것이 효율적입니다. Playground는 그 목적에 최적화된 도구입니다.

## Playground 핵심 기능 6가지

![Playground 학습 흐름](/assets/posts/ts-playground-repl-flow.svg)

### ① 실시간 타입 검사

코드를 입력하는 즉시 타입 오류가 빨간 물결선으로 표시됩니다. 변수 위에 마우스를 올리면 추론된 타입 정보가 팝업으로 나타납니다.

```typescript
// Playground에서 아래 코드를 입력해 보세요
function greet(person: { name: string; age: number }) {
  return `Hello ${person.name}, you are ${person.age} years old`;
}

// person 위에 마우스를 올리면 타입이 보입니다
const result = greet({ name: "Alice", age: 30 });
```

### ② .JS 탭: 컴파일 결과 확인

오른쪽 탭에서 TypeScript 코드가 JavaScript로 어떻게 변환되는지 실시간으로 확인할 수 있습니다. 타입 주석이 제거되고, `interface`가 사라지는 것을 직접 눈으로 볼 수 있습니다.

```typescript
// TypeScript 입력
interface Point {
  x: number;
  y: number;
}

const origin: Point = { x: 0, y: 0 };

// 컴파일된 JavaScript 출력
// const origin = { x: 0, y: 0 };
// (interface Point는 사라짐)
```

### ③ URL 공유

Playground의 모든 코드는 URL 해시에 인코딩됩니다. 공유 버튼을 클릭하거나 주소창 URL을 복사하면 됩니다. GitHub Issues, Stack Overflow, 팀 채팅에서 TypeScript 관련 질문을 할 때 재현 코드를 공유하는 표준 방법입니다.

### ④ TypeScript 버전 선택

드롭다운에서 TypeScript 버전을 선택할 수 있습니다. Nightly 빌드도 선택 가능하여 최신 기능을 미리 체험할 수 있습니다. 버전 간 동작 차이를 비교하는 데 유용합니다.

### ⑤ tsconfig 옵션 조절

상단의 **Config** 탭에서 주요 컴파일러 옵션을 체크박스로 켜고 끌 수 있습니다. `strict`, `strictNullChecks`, `target` 등의 옵션이 코드에 어떤 영향을 주는지 즉시 확인할 수 있습니다.

```typescript
// strictNullChecks: false일 때
let name: string = null; // OK

// strictNullChecks: true일 때
let name: string = null;
// TS2322: Type 'null' is not assignable to type 'string'
```

### ⑥ .DTS 탭

`.DTS` 탭에서 현재 코드의 타입 선언 파일 미리보기를 볼 수 있습니다. 라이브러리를 만들 때 사용자에게 어떤 타입 정보가 제공되는지 확인하는 용도로 씁니다.

## Playground로 학습하는 효과적인 방법

```typescript
// 1. 타입 추론 실험: 마우스를 올려 추론 타입 확인
const arr = [1, 2, 3];           // number[]
const mixed = [1, "two", true];  // (string | number | boolean)[]

// 2. 오류 메시지 읽기 연습
interface Shape {
  kind: "circle" | "square";
  radius?: number;
  sideLength?: number;
}

function getArea(shape: Shape): number {
  if (shape.kind === "circle") {
    return Math.PI * (shape.radius ?? 0) ** 2;
  }
  return (shape.sideLength ?? 0) ** 2;
}

// 3. JS 탭에서 컴파일 결과 확인
// enum, namespace, decorator가 어떻게 변환되는지 직접 확인
```

Playground에서 충분히 실험하고 익힌 개념을 로컬 프로젝트에 적용하는 방식이 TypeScript 학습에 가장 효과적입니다. 다음 글에서는 실제 로컬 환경에서 첫 TypeScript 프로그램을 작성해봅니다.

---

**지난 글:** [tsc 컴파일러 완전 이해](/posts/ts-compiler-tsc/)

**다음 글:** [첫 TypeScript 프로그램 작성하기](/posts/ts-first-program/)

<br>
읽어주셔서 감사합니다. 😊
