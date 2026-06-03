---
title: "TypeScript vs JavaScript: 슈퍼셋의 의미"
description: "TypeScript가 JavaScript의 슈퍼셋이라는 말의 정확한 의미, 두 언어의 핵심 차이점, 그리고 어떤 상황에서 무엇을 선택해야 하는지를 비교 분석한다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "슈퍼셋", "정적타입", "동적타입", "언어비교"]
featured: false
draft: false
---

[지난 글](/posts/ts-why-typescript/)에서 TypeScript를 써야 하는 이유를 살펴봤다. 이번 편에서는 TypeScript와 JavaScript가 정확히 어떤 관계인지, 두 언어가 어떻게 다른지를 비교 분석한다.

## "슈퍼셋"이란 무엇인가

TypeScript가 JavaScript의 **슈퍼셋(superset)**이라는 말은 집합론적 의미다. TypeScript가 허용하는 코드의 집합이 JavaScript가 허용하는 코드의 집합을 완전히 포함한다.

![TypeScript는 JavaScript의 슈퍼셋](/assets/posts/ts-vs-javascript-superset.svg)

실질적 의미는 하나다. **모든 유효한 `.js` 파일은 확장자를 `.ts`로 바꿔도 동작한다.** 타입 주석이 없는 TypeScript 파일은 그대로 JavaScript다.

```typescript
// 이 파일은 100% 유효한 JavaScript이자 TypeScript다
const users = [];

function addUser(user) {
  users.push(user);
}

addUser({ name: "Alice", age: 30 });
```

TypeScript는 JavaScript를 대체하는 별개의 언어가 아니라, JavaScript에 선택적으로 타입을 추가하는 언어다.

## 두 언어의 핵심 차이

![TypeScript vs JavaScript 비교](/assets/posts/ts-vs-javascript-comparison.svg)

### 1. 타이핑: 동적 vs 정적

```javascript
// JavaScript: 동적 타입
let x = 42;
x = "hello";  // 아무 문제 없음
x = true;     // 여전히 괜찮음
```

```typescript
// TypeScript: 정적 타입
let x = 42;
x = "hello";  // Error: Type 'string' is not assignable to type 'number'
x = true;     // Error: Type 'boolean' is not assignable to type 'number'
```

TypeScript에서 변수의 타입은 최초 할당 시점에 결정(또는 추론)된다. 이후에 다른 타입의 값을 할당하면 컴파일 에러가 발생한다.

### 2. 에러 발견 시점

```javascript
// JavaScript: 런타임에서야 에러 발견
const obj = null;
console.log(obj.name); // TypeError: Cannot read properties of null
```

```typescript
// TypeScript: 컴파일 타임에 미리 발견
const obj: { name: string } | null = null;
console.log(obj.name);
// Error: Object is possibly 'null'.
// 컴파일조차 안 됨 (--strictNullChecks 옵션 활성화 시)
```

### 3. 코드 규모 적합성

JavaScript가 더 적합한 상황:

- 50줄 이하의 단순 스크립트
- 브라우저 콘솔에서 즉시 실행하는 일회성 코드
- 학습 초반 개념 실험
- 빌드 단계를 추가하기 어려운 환경

TypeScript가 더 적합한 상황:

- 팀 프로젝트 (2인 이상)
- 1,000줄 이상의 코드베이스
- API를 외부에 제공하는 라이브러리
- 장기 유지보수가 필요한 애플리케이션
- React, Next.js, Node.js 백엔드 개발

## TypeScript 고유 문법

JavaScript에는 없고 TypeScript에만 있는 문법이다. 이것들은 모두 컴파일 후 사라진다.

```typescript
// 1. 타입 주석
let name: string = "Alice";

// 2. 인터페이스
interface User {
  id: number;
  name: string;
}

// 3. 타입 별칭
type ID = string | number;

// 4. 제네릭
function identity<T>(value: T): T {
  return value;
}

// 5. 타입 단언
const input = document.getElementById("name") as HTMLInputElement;

// 6. enum (컴파일 후 객체로 변환됨)
enum Direction {
  Up = "UP",
  Down = "DOWN",
}
```

## 공통 부분: JavaScript 문법은 그대로

TypeScript를 쓴다고 JavaScript 문법이 달라지지 않는다. 클래스, 모듈, 화살표 함수, 구조 분해, 스프레드 — 모든 ES2015+ 문법이 그대로 동작한다.

```typescript
// ES2022+ 문법 그대로 사용 가능
class User {
  #id: number;  // private 필드 (JS와 동일)

  constructor(id: number, public name: string) {
    this.#id = id;
  }

  getId() {
    return this.#id;
  }
}

const [first, ...rest] = [1, 2, 3, 4];
const merged = { ...user1, ...user2 };
```

## 점진적 전환 전략

기존 JavaScript 프로젝트를 TypeScript로 전환할 때는 파일 단위로 점진적으로 적용할 수 있다.

```json
// tsconfig.json
{
  "compilerOptions": {
    "allowJs": true,     // .js 파일 컴파일에 포함
    "checkJs": false,    // 처음엔 JS 파일 검사 끄기
    "strict": false      // 처음엔 느슨하게
  }
}
```

하나씩 `.ts`로 전환하고 타입을 추가하면서 `strict` 옵션을 서서히 켜가는 방식이 일반적인 마이그레이션 전략이다.

다음 편에서는 TypeScript 개발 환경을 실제로 설치하고 구성하는 방법을 다룬다.

---

**지난 글:** [왜 TypeScript인가: 정적 타입이 바꾸는 개발 경험](/posts/ts-why-typescript/)

**다음 글:** [TypeScript 설치와 환경 구성: 첫 발을 내딛다](/posts/ts-setup-install/)

<br>
읽어주셔서 감사합니다. 😊
