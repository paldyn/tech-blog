---
title: "TypeScript란 무엇인가 — 본질부터 이해하기"
description: "TypeScript의 본질을 JavaScript 슈퍼셋 개념부터 컴파일 파이프라인, 세 가지 핵심 가치까지 단계적으로 설명합니다. TS를 왜 배워야 하는지 확실히 납득하고 시작하세요."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "정적타입", "타입시스템", "컴파일"]
featured: false
draft: false
---

TypeScript는 마이크로소프트가 2012년에 공개한 오픈소스 프로그래밍 언어다. 한 줄로 정의하면 **"타입 시스템을 더한 JavaScript"** 지만, 그 한 줄이 현업 개발자의 일상을 얼마나 바꿔 놓는지는 직접 경험해 봐야 실감이 난다. 이 시리즈는 TypeScript를 처음 접하는 개발자부터 이미 쓰고 있지만 원리가 궁금한 개발자까지, 완전한 이해를 목표로 처음부터 차근차근 풀어 나간다.

## TypeScript = JavaScript + 타입

TypeScript는 JavaScript의 **슈퍼셋(superset)** 이다. 유효한 JavaScript 코드는 모두 유효한 TypeScript 코드다. 파일 확장자만 `.js` → `.ts` 로 바꿔도 일단 컴파일이 된다. 여기에 타입 애너테이션, 인터페이스, 제네릭 같은 문법을 얹어 타입 정보를 표현한다.

```typescript
// JavaScript 코드 — 그대로 TypeScript에서도 동작
function add(a, b) {
  return a + b;
}

// TypeScript 코드 — 타입 정보 추가
function add(a: number, b: number): number {
  return a + b;
}
```

두 번째 버전에서 `a: number` 는 "매개변수 a는 number 타입이어야 한다"는 선언이다. `: number` 뒤 반환 타입도 마찬가지다. 이 타입 정보는 **컴파일 시점에만 존재하고 런타임에는 완전히 제거된다.** 즉, TypeScript가 만들어 내는 JavaScript는 기존 JS 엔진이 아무 문제 없이 실행한다.

![TypeScript 본질 개요](/assets/posts/ts-essence-overview.svg)

## 컴파일 파이프라인

TypeScript 소스(`.ts`)는 `tsc` 컴파일러를 통해 JavaScript(`.js`)로 변환된다. 내부적으로는 다음 단계를 거친다.

1. **파싱** — `.ts` 파일을 읽어 AST(Abstract Syntax Tree)를 생성한다
2. **타입 검사** — AST를 분석해 타입 오류를 찾는다
3. **코드 방출** — 타입 정보를 제거한 `.js` 파일을 출력한다

타입 검사 단계에서 오류가 발견되면 기본적으로 컴파일을 중단한다(설정으로 변경 가능). 이것이 TypeScript의 핵심 이점이다 — 코드가 브라우저나 Node.js에서 실행되기 **전에** 버그를 잡는다.

![TypeScript 컴파일 파이프라인](/assets/posts/ts-essence-compile-flow.svg)

## TypeScript의 세 가지 핵심 가치

### 1. 정적 타입 검사

가장 직접적인 이점은 **런타임 오류를 컴파일 타임으로 당기는 것** 이다.

```typescript
function getLength(value: string): number {
  return value.length;
}

getLength(42); // 오류: Argument of type 'number' is not assignable to parameter of type 'string'
```

JavaScript였다면 `42.length` 가 `undefined` 를 반환하다가 결국 어딘가에서 예상치 못한 버그로 터진다. TypeScript는 이 코드를 실행조차 못 하게 막는다.

### 2. IDE 자동완성과 리팩터링 지원

타입 정보가 있으면 IDE가 훨씬 정확하게 도움을 줄 수 있다. 객체의 프로퍼티 목록을 자동으로 제안하고, 함수 매개변수의 타입을 힌트로 보여 주며, 전역 이름 변경(rename)이 타입 체계 안에서 안전하게 이루어진다.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function printUser(user: User) {
  console.log(user.); // IDE가 id, name, email 자동 제안
}
```

### 3. 코드 자체가 문서가 된다

함수 시그니처만 봐도 무엇을 받고 무엇을 반환하는지 알 수 있다. 별도 JSDoc 주석 없이도 타입 정보가 의도를 명확히 전달한다.

```typescript
// 매개변수와 반환 타입만 봐도 이 함수의 계약을 알 수 있다
function fetchUser(userId: string): Promise<User | null> {
  // ...
}
```

## "그냥 JavaScript 써도 되지 않나요?"

맞다. TypeScript 없이도 훌륭한 앱을 만들 수 있다. 하지만 프로젝트 규모가 커지고, 팀원이 늘고, 코드베이스가 오래될수록 타입 없는 JavaScript는 부담이 커진다. 변수가 어떤 형태인지, 함수가 무엇을 기대하는지 파악하기 위해 소스를 쫓아다니는 시간이 늘어난다.

TypeScript는 이 문제에 정면으로 대응한다. 단순한 문법 설탕이 아니라 **대규모 협업 코드베이스를 관리하는 엔지니어링 도구** 다. GitHub, Slack, Airbnb, Microsoft를 비롯한 수많은 대형 프로젝트가 TypeScript로 전환한 이유가 여기 있다.

## 시리즈 로드맵

이 시리즈는 TypeScript를 다음 순서로 다룬다.

- **기초 입문** — 설치, 컴파일러, 에디터 설정, 첫 번째 프로그램
- **타입 시스템** — 기본 타입, 추론, 유니언, 인터섹션
- **고급 타입** — 제네릭, 조건부 타입, 매핑 타입, 템플릿 리터럴
- **실전 패턴** — React, Node.js, 비동기, 오류 처리
- **생태계** — tsconfig, ESLint, 라이브러리 타이핑, 마이그레이션

첫 걸음이 반이다. 다음 글에서는 TypeScript를 **왜 지금 배워야 하는지** — 생태계 현황과 실제 채택 사례를 중심으로 더 깊게 파고든다.

---

**다음 글:** [TypeScript, 왜 지금 배워야 하는가](/posts/ts-why-typescript/)

<br>
읽어주셔서 감사합니다. 😊
