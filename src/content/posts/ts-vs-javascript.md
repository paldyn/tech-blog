---
title: "TypeScript vs JavaScript — 무엇이 다른가"
description: "TypeScript와 JavaScript의 차이를 타입 시스템, 오류 감지 시점, 실행 환경, IDE 지원 관점에서 코드 예시와 함께 명확히 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "JavaScript", "비교", "정적타입", "동적타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-why-typescript/)에서 TypeScript가 왜 지금 필요한지 데이터와 사례로 살펴봤다. 이번에는 TypeScript와 JavaScript가 구체적으로 무엇이 다른지, 그 차이가 실제 코드에서 어떻게 나타나는지 하나씩 짚어 본다.

## 핵심 차이: 타입 시스템

가장 근본적인 차이는 타입 시스템이다. JavaScript는 **동적 타입(dynamic typing)** 언어다. 변수의 타입이 런타임에 결정되고, 같은 변수에 다른 타입의 값을 대입할 수 있다.

```javascript
// JavaScript — 런타임에 타입이 바뀜
let value = "hello";
value = 42;        // 문제없음
value = true;      // 문제없음
value = null;      // 문제없음
```

TypeScript는 **정적 타입(static typing)** 을 추가한다. 선언 시점에 타입을 지정하면 컴파일러가 그 타입을 강제한다.

```typescript
// TypeScript — 컴파일 타임에 타입 강제
let value: string = "hello";
value = 42;    // 오류: Type 'number' is not assignable to type 'string'
value = true;  // 오류: Type 'boolean' is not assignable to type 'string'
```

![JavaScript vs TypeScript 비교](/assets/posts/ts-vs-javascript-diff.svg)

## 오류 감지 시점

JavaScript에서는 오류가 코드를 실제로 **실행해야** 드러난다. 이 말은 프로덕션 환경에서 사용자가 버그를 만날 수도 있다는 뜻이다.

```javascript
// JavaScript — 런타임에 TypeError 발생
function getUserName(user) {
  return user.profile.name; // user가 null이면 터짐
}

getUserName(null); // 실행해야 알 수 있다: TypeError: Cannot read properties of null
```

TypeScript는 이 오류를 **코드를 작성하는 순간** 에 잡는다.

```typescript
// TypeScript — 컴파일 시점에 경고
interface User {
  profile: { name: string };
}

function getUserName(user: User): string {
  return user.profile.name;
}

getUserName(null); // 오류: Argument of type 'null' is not assignable to parameter of type 'User'
```

## JS와 TS의 포함 관계

TypeScript는 JavaScript의 **슈퍼셋** 이다. 유효한 JavaScript 코드는 모두 유효한 TypeScript다. 반대로 TypeScript 코드는 타입 문법이 포함되어 있으므로 JavaScript 엔진이 바로 실행할 수 없다.

![JS와 TS의 관계](/assets/posts/ts-vs-javascript-coexist.svg)

이 포함 관계는 실용적으로 중요하다. 기존 JavaScript 프로젝트를 **점진적으로** TypeScript로 전환할 수 있다. `.js` 파일을 `.ts` 로 바꾸고, 오류가 생기는 곳에만 타입을 추가하면 된다. 한 번에 전체를 고칠 필요가 없다.

## IDE 지원의 차이

타입 정보가 있으면 IDE가 훨씬 정확하게 도움을 줄 수 있다.

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  category: "electronics" | "clothing" | "food";
}

function formatProduct(p: Product): string {
  return `${p.name} - ${p.price}원`; // p. 입력 시 id, name, price, category 정확하게 제안
}
```

JavaScript에서도 IDE가 추론을 통해 자동완성을 제공하지만, 타입 정보가 없으면 추론의 한계가 있다. 특히 함수의 매개변수처럼 정보가 없는 경우 IDE의 도움을 거의 받지 못한다.

## 런타임 성능 차이는 없다

자주 나오는 오해가 있다. "TypeScript가 더 느리지 않나요?" — 아니다. TypeScript는 컴파일되면 타입 정보가 완전히 제거되고, 결과물은 일반 JavaScript와 동일하다. 런타임에서 TypeScript 고유의 오버헤드는 없다.

```typescript
// TypeScript 소스
function add(a: number, b: number): number {
  return a + b;
}
```

```javascript
// 컴파일된 JavaScript — 타입 제거됨
function add(a, b) {
  return a + b;
}
```

컴파일 시간은 늘어나지만, 이는 일회성 빌드 비용이다. 실제 서비스 응답 시간이나 앱 실행 속도에는 영향이 없다.

## 공존: TypeScript 파일에서 JS 라이브러리 사용

TypeScript와 JavaScript는 같은 생태계를 공유한다. `npm install` 로 설치하는 JavaScript 라이브러리를 TypeScript 프로젝트에서 그대로 쓸 수 있다. 해당 라이브러리가 타입 정의 파일(`.d.ts`)을 제공하면 TypeScript의 타입 검사 혜택까지 누린다.

```typescript
import axios from 'axios'; // axios는 내장 타입 정의 포함

// 반환 타입이 자동으로 추론됨
const response = await axios.get<{ users: User[] }>('/api/users');
const users = response.data.users; // users: User[] — 자동 완성 동작
```

타입 정의가 없는 라이브러리는 `@types/패키지명` 으로 별도 설치하거나, 직접 `.d.ts` 파일을 작성한다. 다음 글에서는 TypeScript 환경을 실제로 설치하고 첫 번째 파일을 실행해 본다.

---

**지난 글:** [TypeScript, 왜 지금 배워야 하는가](/posts/ts-why-typescript/)

**다음 글:** [TypeScript 설치와 환경 구성](/posts/ts-setup-install/)

<br>
읽어주셔서 감사합니다. 😊
