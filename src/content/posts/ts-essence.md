---
title: "TypeScript 핵심 · 왜 타입이 필요한가"
description: "TypeScript의 존재 이유, 구조적 타이핑 원칙, 컴파일 파이프라인, 타입 추론 메커니즘, tsconfig 핵심 옵션을 완전히 정리합니다. JavaScript와의 관계와 TypeScript를 도입해야 하는 실질적 이유를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "타입시스템", "구조적타이핑", "타입추론", "컴파일러", "tsconfig"]
featured: false
draft: false
---

[지난 글](/posts/workerd-cloudflare/)에서 Cloudflare Workers의 V8 Isolate 기반 엣지 런타임을 살펴봤다. 이번 글부터는 **TypeScript** 시리즈를 시작한다. TypeScript는 오늘날 프론트엔드·백엔드·풀스택 개발에서 사실상 표준이 되었지만, 그 근본 원리를 모른 채 사용하면 `any` 남발이나 불필요한 타입 캐스팅 같은 패턴으로 타입 시스템의 이점을 버리게 된다.

## TypeScript는 무엇인가

TypeScript는 Microsoft가 2012년에 발표한 **JavaScript의 정적 타입 슈퍼셋(typed superset)**이다. 모든 유효한 JavaScript 코드는 유효한 TypeScript 코드다. TypeScript 컴파일러(`tsc`)는 타입 검사를 수행한 뒤 타입 정보를 모두 제거하고 순수한 JavaScript를 출력한다.

이 한 문장이 핵심이다: **타입은 런타임에 존재하지 않는다.** TypeScript의 타입 시스템은 순전히 컴파일 시점에만 동작하는 도구다.

## 왜 타입이 필요한가

JavaScript는 동적 타입 언어다. 이는 유연하지만 대규모 코드베이스에서 여러 문제를 야기한다.

```javascript
// JavaScript — 런타임이 되어야 오류를 안다
function getUserAge(user) {
  return user.age.toFixed(1); // TypeError: 런타임에야 발견
}

getUserAge({ name: "Alice" }); // age가 undefined
getUserAge({ name: "Bob", age: "25" }); // string에 toFixed 없음
```

TypeScript는 이 오류를 코드를 실행하기 전에 잡는다.

```typescript
// TypeScript — 컴파일 시점에 오류 발견
interface User {
  name: string;
  age:  number;
}

function getUserAge(user: User): string {
  return user.age.toFixed(1); // 안전 ✅
}

getUserAge({ name: "Alice" });          // TS2345 ❌ age 누락
getUserAge({ name: "Bob", age: "25" }); // TS2322 ❌ string ≠ number
```

이 차이가 팀 규모가 커질수록, 코드베이스가 커질수록 더 큰 가치를 만든다. IDE의 자동완성과 리팩터링 안전성도 타입 정보에 의존한다.

## 컴파일 파이프라인

![TypeScript 컴파일 파이프라인](/assets/posts/ts-essence-pipeline.svg)

TypeScript 컴파일러는 크게 네 단계로 동작한다.

1. **파서(Parser)**: `.ts` 소스를 읽어 AST(Abstract Syntax Tree)를 생성한다
2. **타입 검사기(Type Checker)**: AST를 순회하며 타입 추론과 오류 보고를 수행한다. 심볼 테이블을 구성하고 각 노드의 타입을 결정한다
3. **에미터(Emitter)**: 타입 어노테이션을 제거하고 JavaScript 코드를 생성한다. `d.ts` 선언 파일도 여기서 생성된다
4. **출력**: `.js`와 선택적으로 `.d.ts`, `.js.map` 파일을 생성한다

타입 오류가 있어도 기본적으로 JavaScript를 출력한다. `noEmitOnError: true`를 설정하면 오류 시 출력을 막을 수 있다.

## 구조적 타이핑

TypeScript는 **구조적 타이핑(structural typing)**을 사용한다. 타입의 이름이나 선언이 아니라 구조(형태)를 기준으로 호환성을 판단한다. Java나 C#의 명목적 타이핑(nominal typing)과 다르다.

![TypeScript 타입 시스템 특성](/assets/posts/ts-essence-type-system.svg)

```typescript
interface Point2D { x: number; y: number }
interface Point3D { x: number; y: number; z: number }

function move(p: Point2D) {
  console.log(p.x, p.y);
}

const p3: Point3D = { x: 1, y: 2, z: 3 };
move(p3); // ✅ Point3D는 Point2D의 구조를 포함한다
```

`Point3D`는 `Point2D`를 선언상 상속하지 않았지만, `x`와 `y`를 가지고 있으므로 `Point2D`가 필요한 곳에 사용할 수 있다. 이것이 구조적 타이핑이다.

## 타입 추론

TypeScript는 타입을 명시하지 않아도 문맥에서 타입을 **추론**한다. 불필요한 어노테이션을 반복하지 않아도 된다.

```typescript
// 변수 선언 시 추론
const count = 0;          // number
const name  = "Alice";    // string
const items = [1, 2, 3];  // number[]

// 함수 반환 타입 추론
function double(n: number) {
  return n * 2; // 반환 타입: number (추론)
}

// 객체 리터럴 추론
const config = {
  host: "localhost", // string
  port: 8080,        // number
};

// config.host → string, config.port → number 자동 추론
```

일반적인 원칙: 매개변수 타입은 명시하고, 반환 타입과 변수 타입은 추론에 맡긴다.

## tsconfig.json 핵심 옵션

```json
{
  "compilerOptions": {
    "target": "ES2022",         // 출력 JS 버전
    "module": "NodeNext",       // 모듈 시스템
    "strict": true,             // 모든 엄격 검사 활성화
    "outDir": "./dist",
    "rootDir": "./src",

    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,

    "noEmitOnError": true,
    "declaration": true,        // .d.ts 생성
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`strict: true`는 다음 옵션들의 묶음이다:
- `strictNullChecks`: `null`/`undefined`를 별도 타입으로 처리
- `strictFunctionTypes`: 함수 타입의 공변·반공변 검사
- `noImplicitAny`: 암시적 `any` 금지
- `strictPropertyInitialization`: 클래스 프로퍼티 초기화 강제

새 프로젝트는 `strict: true`로 시작하는 것이 강력히 권장된다.

## JavaScript에서 TypeScript로 점진적 이전

기존 JS 프로젝트를 TypeScript로 전환할 때는 단계적 접근이 효과적이다.

```json
// 1단계: allowJs로 TS와 JS 공존 허용
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "strict": false
  }
}
```

```typescript
// 2단계: 파일을 하나씩 .ts로 변환
// 처음에는 any를 허용하면서 타입 추가
function process(data: any) { // 임시 any
  return data.value;
}

// 3단계: any를 구체적 타입으로 교체
interface ProcessData { value: number }
function process(data: ProcessData): number {
  return data.value;
}
```

`@ts-check` 주석 한 줄로 `.js` 파일에서도 TypeScript 타입 검사를 받을 수 있어, 완전한 전환 전에 이점을 미리 경험해볼 수 있다.

---

**지난 글:** [Cloudflare Workers와 workerd 런타임](/posts/workerd-cloudflare/)

**다음 글:** [TypeScript 기본 타입 완전 정복](/posts/ts-basic-types/)

<br>
읽어주셔서 감사합니다. 😊
