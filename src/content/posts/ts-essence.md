---
title: "TypeScript 완전 정복: 본질과 핵심 가치"
description: "TypeScript가 무엇인지, JavaScript와 어떤 관계인지, 그리고 왜 현대 개발에서 필수가 되었는지 핵심 개념부터 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "정적타입", "입문"]
featured: false
draft: false
---

TypeScript는 단순한 JavaScript 확장이 아닙니다. 정적 타입 시스템이라는 강력한 도구를 추가함으로써 개발자가 코드를 작성하는 방식 자체를 바꾸었고, 오늘날 대형 프런트엔드 프로젝트부터 Node.js 서버까지 거의 모든 영역에서 사실상의 표준이 되었습니다.

![TypeScript 개요 다이어그램](/assets/posts/ts-essence-overview.svg)

## TypeScript란 무엇인가?

TypeScript는 **JavaScript의 상위 집합(superset)**입니다. 모든 유효한 JavaScript 코드는 그대로 TypeScript 코드이기도 합니다. TypeScript가 추가하는 것은 딱 하나, **정적 타입 시스템**입니다.

```typescript
// JavaScript와 완전히 호환
const name = "Alice";        // JavaScript
const age: number = 30;     // TypeScript 추가 문법 (타입 어노테이션)
```

타입 어노테이션은 컴파일 시 제거됩니다. 즉, TypeScript 코드는 항상 순수한 JavaScript로 변환되어 브라우저, Node.js, Deno 등 모든 JavaScript 런타임에서 동작합니다.

## 왜 타입이 필요한가?

JavaScript는 동적 타입 언어입니다. 변수의 타입이 런타임에 결정되고, 잘못된 타입의 값을 넘겨도 코드가 실행될 때까지 오류를 알 수 없습니다.

```javascript
// JavaScript: 오류가 런타임에 발생
function double(n) {
  return n * 2;
}

double("5");   // NaN 반환 — 오류지만 실행됨
double(null);  // 0 반환 — 의도치 않은 동작
```

TypeScript는 이를 **컴파일 타임**에 잡아줍니다.

```typescript
// TypeScript: 오류를 코드 작성 시점에 발견
function double(n: number): number {
  return n * 2;
}

double("5");   // ❌ 컴파일 에러: Argument of type 'string' is not assignable to parameter of type 'number'.
double(null);  // ❌ 컴파일 에러: strictNullChecks 위반
```

## 컴파일 과정

TypeScript 코드(`.ts`)는 `tsc`(TypeScript Compiler)를 통해 JavaScript(`.js`)로 변환됩니다. 이 과정에서 타입 어노테이션은 모두 제거됩니다.

![TypeScript 컴파일 파이프라인](/assets/posts/ts-essence-compile.svg)

```bash
# 설치
npm install --save-dev typescript

# 컴파일
npx tsc src/hello.ts

# 결과: dist/hello.js (타입 정보 없는 순수 JS)
```

컴파일 결과 JavaScript는 타입 정보가 전혀 없어서 런타임 오버헤드가 없습니다. TypeScript는 오직 개발 시점의 도구입니다.

## TypeScript의 핵심 가치 4가지

**1. 타입 안전성**: 컴파일 타임에 오류를 발견해 런타임 버그를 예방합니다. production 배포 전에 잠재적 오류를 제거할 수 있습니다.

**2. 개발 생산성**: VS Code 같은 IDE가 타입 정보를 활용해 정확한 자동완성, 타입 힌트, 즉시 오류 표시를 제공합니다. 문서 없이도 함수 시그니처만 보면 용도를 파악할 수 있습니다.

**3. 자기 문서화**: 타입 어노테이션 자체가 코드의 의도를 명확히 표현합니다. `function getUser(id: number): Promise<User>` 한 줄이 별도 문서 없이도 함수의 계약을 정의합니다.

**4. JS 완전 호환**: 기존 JavaScript 코드베이스에 점진적으로 도입할 수 있습니다. 파일 하나씩 `.js`에서 `.ts`로 전환하거나, `allowJs` 옵션으로 두 가지를 혼용할 수 있습니다.

## 생태계와 채택 현황

TypeScript는 Microsoft가 개발하고 Apache 2.0 라이선스로 공개된 오픈소스 프로젝트입니다. Angular, NestJS, Deno는 TypeScript를 기본 언어로 채택했고, React와 Vue도 공식 TypeScript 지원을 제공합니다. 2024년 Stack Overflow 설문에서는 가장 사랑받는 언어 중 하나로 꾸준히 선정되고 있습니다.

```typescript
// TypeScript의 핵심: 타입은 컴파일 후 사라지지만,
// 그 혜택(오류 검출, IDE 지원, 문서화)은 개발 내내 유지됩니다
type User = { id: number; name: string };  // 타입 공간 (런타임에 없음)
const user: User = { id: 1, name: "Alice" }; // 값 공간 (런타임에 존재)
```

이 시리즈를 통해 TypeScript의 기초부터 고급 타입 시스템까지 단계별로 완전히 정복해 보겠습니다.

---

**다음 글:** [왜 TypeScript인가? — JavaScript의 한계와 TypeScript의 해답](/posts/ts-why-typescript/)

<br>
읽어주셔서 감사합니다. 😊
