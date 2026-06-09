---
title: "TypeScript Playground — 브라우저에서 즉시 실험하기"
description: "설치 없이 브라우저에서 TypeScript를 체험할 수 있는 공식 Playground의 기능과 활용법을 소개합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "Playground", "REPL", "학습도구"]
featured: false
draft: false
---

[지난 글](/posts/ts-compiler-tsc/)에서 tsc 컴파일러의 동작 원리를 살펴봤습니다. 새로운 TypeScript 기능을 배울 때나 팀원에게 버그를 공유할 때 설치 없이 바로 실험할 수 있는 최고의 도구, TypeScript Playground를 소개합니다.

![TypeScript Playground 인터페이스](/assets/posts/ts-playground-repl-layout.svg)

## Playground란?

TypeScript 공식 Playground(`typescriptlang.org/play`)는 브라우저에서 TypeScript를 바로 작성하고 실험할 수 있는 온라인 환경입니다. `npm install`도, VS Code 설정도 필요 없습니다.

주요 특징:
- 왼쪽에 TypeScript 코드 작성
- 오른쪽에 컴파일된 JavaScript 실시간 확인
- 타입 오류 즉시 감지 및 표시
- 코드를 URL로 공유 가능

## 기본 사용법

```typescript
// Playground에서 바로 실험해보세요
interface Product {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
}

function formatPrice(product: Product): string {
  const status = product.inStock ? "재고 있음" : "품절";
  return `${product.name}: ₩${product.price.toLocaleString()} (${status})`;
}

const laptop: Product = {
  id: 1,
  name: "MacBook Pro",
  price: 3200000,
  inStock: true
};

console.log(formatPrice(laptop));
// 출력: MacBook Pro: ₩3,200,000 (재고 있음)
```

오른쪽 패널에서 이 코드가 어떤 JavaScript로 변환되는지 즉시 확인할 수 있습니다.

## Playground의 핵심 기능

![Playground 주요 기능](/assets/posts/ts-playground-repl-features.svg)

### 실시간 타입 검사

코드를 입력하는 순간 오류가 빨간 밑줄로 표시됩니다. 마우스를 올리면 상세한 오류 설명이 나타납니다.

```typescript
// 이 코드를 Playground에 붙여넣어 오류를 확인하세요
function add(a: number, b: number) { return a + b; }
add("hello", 42);  // 빨간 밑줄 + 오류 설명 표시
```

### TypeScript 버전 선택

Playground 우상단의 버전 드롭다운에서 TypeScript 버전을 선택할 수 있습니다. TypeScript 5.0의 새 기능을 4.9에서도 테스트해보거나, 레거시 환경의 동작을 확인할 때 유용합니다.

### tsconfig 옵션 UI

`TS Config` 탭에서 `strict`, `target`, `module` 등 주요 옵션을 체크박스로 토글할 수 있습니다. 옵션 변경이 코드에 어떤 영향을 주는지 즉시 확인할 수 있습니다.

```typescript
// strict: false일 때
function greet(name) {  // any 허용됨
  return "Hello, " + name;
}

// strict: true일 때
function greet(name) {  // ❌ 'name' implicitly has an 'any' type
  return "Hello, " + name;
}
```

### .d.ts 선언 파일 확인

`DTS` 탭에서 작성한 코드에서 생성되는 타입 선언 파일을 확인할 수 있습니다. 라이브러리를 만들 때 `.d.ts` 파일이 올바르게 생성되는지 검증하는 데 유용합니다.

```typescript
// 이 TypeScript 코드
export interface Config {
  host: string;
  port: number;
}
export function createServer(config: Config): void;

// .d.ts 탭에서 확인:
// export interface Config { host: string; port: number; }
// export declare function createServer(config: Config): void;
```

### URL로 코드 공유

Playground의 URL은 코드를 포함합니다. 코드를 작성하면 URL이 자동으로 업데이트되어, 그 URL을 복사해 팀원에게 공유하거나 GitHub 이슈에 첨부할 수 있습니다.

```
https://www.typescriptlang.org/play?#code/...인코딩된코드...
```

이 기능으로 "이 코드에서 오류가 왜 나는지" 같은 질문을 명확하게 공유할 수 있습니다.

## 고급 활용: 타입 체조 연습

Playground는 복잡한 고급 타입을 실험하기에도 최적입니다.

```typescript
// 조건부 타입 실험
type IsString<T> = T extends string ? "yes" : "no";

type A = IsString<string>;  // "yes"
type B = IsString<number>;  // "no"
type C = IsString<"hello">; // "yes"

// hover하면 각 타입의 실제 값 표시
```

## Playground 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl+Enter` | 코드 실행 (콘솔 출력) |
| `Ctrl+Shift+F` | 코드 포맷팅 |
| `F1` | 명령 팔레트 열기 |
| 변수/타입 hover | 타입 정보 표시 |

## Playground vs 로컬 환경

| | Playground | 로컬 환경 |
|--|-----------|-----------|
| 설치 필요 | ❌ | ✅ |
| 파일 저장 | URL로만 | 로컬 저장 |
| 외부 패키지 | 제한적 | 모든 npm 패키지 |
| 팀 공유 | URL 공유 | Git |
| 대규모 프로젝트 | 비적합 | 적합 |

Playground는 학습, 실험, 버그 재현, 공유에 최적이고, 실제 프로젝트 개발은 로컬 환경에서 합니다.

---

**지난 글:** [TypeScript 컴파일러 tsc 완전 이해](/posts/ts-compiler-tsc/)

**다음 글:** [첫 TypeScript 프로그램 작성하기](/posts/ts-first-program/)

<br>
읽어주셔서 감사합니다. 😊
