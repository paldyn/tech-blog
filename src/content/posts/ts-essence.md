---
title: "TypeScript의 본질: JavaScript의 상위셋이란 무엇인가"
description: "TypeScript가 JavaScript와 어떻게 다른지, 왜 '상위셋'이라고 부르는지, 정적 타입 시스템이 실제로 어떤 가치를 제공하는지 깊이 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "TypeScript시작", "정적타입", "TypeScript완전정복", "타입시스템"]
featured: false
draft: false
---

TypeScript를 처음 접하면 "그냥 JavaScript에 타입 붙인 거 아닌가?"라는 생각이 든다. 이 생각이 완전히 틀린 건 아니지만, TypeScript의 본질을 깊이 이해하면 그 이상의 가치가 있음을 알게 된다. TypeScript는 단순히 타입을 추가한 확장이 아니라, 대규모 소프트웨어 개발을 위한 설계 철학을 담은 언어다.

## TypeScript란 무엇인가

TypeScript는 Microsoft가 2012년 공개한 오픈소스 프로그래밍 언어다. 핵심 정의는 두 가지로 압축된다.

**JavaScript의 상위셋(Superset)**: 모든 유효한 JavaScript 코드는 그대로 TypeScript 코드다. `.js` 파일을 `.ts`로 이름만 바꿔도 TypeScript로 동작한다. 기존 JS 지식이 100% 활용된다.

**정적 타입 언어**: 변수, 함수 파라미터, 반환값에 타입을 명시할 수 있다. 컴파일 단계(코드를 실행하기 전)에 타입 오류를 잡아낸다.

```typescript
// 이것은 완벽한 TypeScript 코드이기도 하다
const message = "Hello, World!";
console.log(message);

// 타입을 추가하면 더욱 명확해진다
const greet = (name: string): string => {
  return `Hello, ${name}!`;
};
```

![TypeScript 개요 다이어그램](/assets/posts/ts-essence-overview.svg)

## 정적 타입 vs 동적 타입

JavaScript는 동적 타입 언어다. 변수의 타입이 런타임(실행 시점)에 결정되고, 같은 변수에 여러 타입을 담을 수 있다.

```javascript
// JavaScript: 동적 타입
let value = 42;         // number
value = "hello";        // string으로 변경 — 오류 없음
value = { key: "val" }; // object로 변경 — 오류 없음
```

TypeScript는 정적 타입 언어다. 변수의 타입이 선언 시점(또는 초기화 시점)에 고정된다.

```typescript
// TypeScript: 정적 타입
let value: number = 42;
value = "hello";  // Error: Type 'string' is not assignable to type 'number'
```

이 차이는 단순해 보이지만, 실제 개발에서 큰 차이를 만든다. JavaScript에서는 `add(1, "2")`처럼 잘못된 인수를 넘겨도 컴파일러가 아무 말도 하지 않는다. TypeScript는 즉시 오류를 보고한다.

## TypeScript의 컴파일 과정

TypeScript 코드는 직접 실행되지 않는다. 브라우저와 Node.js는 JavaScript만 이해하기 때문에, TypeScript는 반드시 JavaScript로 변환(컴파일)되어야 한다.

```bash
# TypeScript 파일 컴파일
tsc hello.ts    # hello.js 생성

# 컴파일 후 실행
node hello.js
```

이 컴파일 과정에서 TypeScript는 두 가지 핵심 작업을 수행한다.

1. **타입 검사**: 코드에서 타입 오류를 찾아 보고한다. 오류 발견 시 컴파일을 중단할 수 있다.
2. **타입 제거**: `.js` 파일에는 타입 어노테이션이 포함되지 않는다. 순수 JavaScript만 남는다.

```typescript
// TypeScript 입력 (hello.ts)
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// JavaScript 출력 (hello.js) — 타입 정보 제거됨
function greet(name) {
  return `Hello, ${name}!`;
}
```

![TypeScript 컴파일 흐름](/assets/posts/ts-essence-compilation.svg)

## TypeScript가 제공하는 실질적 가치

### 버그 조기 발견

가장 흔한 JavaScript 버그 유형 중 하나는 `TypeError: Cannot read properties of undefined`다. 이런 오류는 보통 개발 완료 후 테스트 단계나 프로덕션에서 발견된다.

```typescript
interface User {
  id: number;
  name: string;
  email?: string;  // 옵셔널 프로퍼티
}

function getUserEmail(user: User): string {
  // strictNullChecks 활성화 시 undefined일 수 있음을 경고
  return user.email.toUpperCase();  // Error: Object is possibly 'undefined'
}

// 올바른 처리
function getUserEmailSafe(user: User): string {
  return user.email?.toUpperCase() ?? "이메일 없음";
}
```

### IDE 인텔리센스

TypeScript의 타입 정보는 IDE를 강력하게 만든다. 자동완성, 정의로 이동, 사용처 찾기, 인라인 오류 표시 등이 모두 타입 정보를 기반으로 작동한다.

```typescript
const user = {
  name: "Alice",
  age: 30,
  address: { city: "Seoul" }
};

user.address.ci    // IDE가 'city'를 자동완성 제안
user.address.country  // 즉시 오류 표시 (존재하지 않는 프로퍼티)
```

### 코드가 문서가 된다

타입 선언은 그 자체로 훌륭한 문서다.

```typescript
function processPayment(
  amount: number,
  currency: "KRW" | "USD" | "EUR",
  userId: string
): Promise<{ success: boolean; transactionId: string }> {
  // 함수 시그니처만 봐도 사용법이 완전히 명확하다
}
```

## TypeScript와 JavaScript의 공존

TypeScript는 JavaScript를 대체하는 게 아니라 확장한다.

- **모든 npm 패키지 사용 가능**: npm의 패키지를 그대로 사용한다. 대부분은 별도 타입 패키지(`@types/...`)도 제공한다.
- **점진적 도입**: `allowJs: true` 설정으로 JS와 TS 파일을 혼용할 수 있다. 파일 하나씩 TS로 전환 가능하다.
- **탈출구 존재**: `any` 타입으로 언제든 타입 검사를 비활성화할 수 있다.

```json
{
  "compilerOptions": {
    "allowJs": true,   // .js 파일도 컴파일 대상에 포함
    "checkJs": false   // JS 파일은 타입 검사 하지 않음
  }
}
```

## TypeScript의 한계

TypeScript가 만능은 아님도 알아야 한다.

**빌드 단계 추가**: `.ts` → `.js` 컴파일이 필요하다. 간단한 스크립트에는 오버헤드가 될 수 있다.

**러닝 커브**: 타입 시스템을 제대로 활용하려면 제네릭, 유틸리티 타입 등 새로운 개념을 배워야 한다.

**런타임 오류 완전 방지는 불가**: TypeScript는 컴파일 타임 오류만 잡는다. 잘못된 API 응답이나 예상 밖 런타임 값은 여전히 런타임 검사가 필요하다.

## TypeScript를 배워야 하는 이유

StackOverflow Developer Survey에서 TypeScript는 가장 선호하는 언어 상위권을 꾸준히 차지한다. GitHub, Airbnb, Slack, Microsoft, Spotify 등 대형 테크 기업들이 TypeScript를 주 언어로 사용한다. Angular는 TypeScript 기반이고, React, Vue, Next.js, NestJS 모두 공식적으로 TypeScript를 지원한다.

현대 프론트엔드·백엔드 개발에서 TypeScript는 사실상 표준이 됐다. JavaScript 개발자라면 TypeScript 학습은 선택이 아닌 필수다.

## 정리

TypeScript는 JavaScript의 모든 것을 포함하면서, 정적 타입 시스템이라는 강력한 도구를 추가한다. 이 시리즈를 통해 TypeScript의 기초부터 고급 기능까지 단계적으로 마스터하게 될 것이다.

---

**다음 글:** [왜 TypeScript인가? 현업에서의 실제 가치](/posts/ts-why-typescript/)

<br>
읽어주셔서 감사합니다. 😊
