---
title: "왜 TypeScript인가? 현업에서의 실제 가치"
description: "TypeScript를 도입해야 하는 5가지 이유, 런타임 오류와 컴파일 타임 오류의 차이, 그리고 실제 프로젝트에서 TypeScript가 버그를 막은 사례를 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "TypeScript장점", "정적타입", "TypeScript완전정복", "버그예방"]
featured: false
draft: false
---

[지난 글](/posts/ts-essence/)에서 TypeScript의 기본 개념과 본질을 살펴봤다. 이제 실용적인 질문에 답할 차례다. "TypeScript를 배우는 데 시간을 투자할 가치가 있는가?" 결론부터 말하면 현대 JavaScript 개발에서 TypeScript는 선택이 아닌 필수다. 왜 그런지 구체적인 근거와 함께 살펴보자.

## 1. 버그를 배포 전에 잡는다

JavaScript 개발자라면 이 오류를 한 번쯤 마주쳤을 것이다.

```
TypeError: Cannot read properties of undefined (reading 'name')
```

이런 오류는 프로덕션에서 발생하면 사용자에게 그대로 노출된다. TypeScript는 이런 종류의 버그를 코딩 단계에서 잡아낸다.

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  discount?: number;  // 옵셔널
}

function getDiscountedPrice(product: Product): number {
  // JavaScript였다면 product.discount가 undefined일 때 NaN 반환
  // TypeScript는 undefined 가능성을 경고한다
  return product.price * (1 - product.discount);  // Error!
  // 'discount'이 undefined일 수 있습니다 — optional chaining 사용 권장
}

// 올바른 버전
function getDiscountedPriceSafe(product: Product): number {
  const discount = product.discount ?? 0;
  return product.price * (1 - discount);
}
```

![TypeScript 오류 발견 시점 비교](/assets/posts/ts-why-typescript-errors.svg)

## 2. IDE가 강력한 조수가 된다

TypeScript가 없던 시절, JavaScript 개발자는 IDE 자동완성이 불완전해 API 문서를 자주 참조해야 했다. TypeScript를 사용하면 IDE가 모든 타입 정보를 알고 있어, 작성 가능한 메서드와 프로퍼티를 즉시 제안한다.

```typescript
const response = await fetch("https://api.example.com/users");
const users: User[] = await response.json();

// users[0]. 까지만 입력해도 IDE가 name, email, id 등을 자동 제안
users[0].  // <-- 자동완성 팝업 등장
```

실제 개발 속도가 눈에 띄게 빨라진다. 메서드 이름을 외울 필요 없이 IDE가 안내해준다.

## 3. 리팩터링이 안전해진다

대규모 코드베이스에서 함수명이나 인터페이스 구조를 바꾸는 건 JavaScript에서 위험한 작업이다. 사용처를 모두 찾아 수동으로 바꾸다 보면 하나를 빠뜨리기 쉽다.

```typescript
// Before: userID (camelCase)
interface ApiConfig {
  userID: string;
  baseUrl: string;
}

// After: userId (소문자 d) 로 변경 → TypeScript가 모든 사용처를 자동으로 찾아줌
interface ApiConfig {
  userId: string;  // IDE F2 rename → 프로젝트 전체에 반영
  baseUrl: string;
}

// 빠뜨린 사용처가 있다면 컴파일 오류로 즉시 알려준다
function callApi(config: ApiConfig) {
  return fetch(`${config.baseUrl}?id=${config.userID}`);
  //                                          ^^^^ Error: userID는 없고 userId만 있음
}
```

## 4. 팀 협업이 쉬워진다

여러 명이 함께 개발할 때, TypeScript의 타입은 "계약"이 된다. 내가 만든 함수를 다른 팀원이 잘못 사용하면 TypeScript가 즉시 경고한다.

```typescript
// 내가 만든 유틸리티 함수
export function formatCurrency(
  amount: number,
  currency: "KRW" | "USD",
  locale?: string
): string {
  return new Intl.NumberFormat(locale ?? "ko-KR", {
    style: "currency",
    currency,
  }).format(amount);
}

// 팀원이 사용할 때 잘못 호출하면
formatCurrency("10000", "KRW");  // Error: 'amount'는 number여야 합니다
formatCurrency(10000, "JPY");    // Error: "JPY"는 허용되지 않은 값입니다
```

타입이 곧 문서이자 API 명세가 된다. JSDoc을 따로 쓰지 않아도 된다.

## 5. 점진적 도입이 가능하다

기존 JavaScript 프로젝트를 단번에 TypeScript로 바꿀 필요가 없다. 점진적으로 전환할 수 있다.

```bash
# 1단계: 새 파일만 .ts로 작성
# 2단계: 기존 .js 파일을 하나씩 .ts로 변환
# 3단계: any 타입을 구체적인 타입으로 교체
# 4단계: strict 모드 활성화

# tsconfig.json에서 점진적 설정
{
  "compilerOptions": {
    "allowJs": true,        // JS 파일 허용
    "strict": false,        // 처음엔 느슨하게 시작
    "noImplicitAny": false  // any 암묵 허용
  }
}
```

![TypeScript 5가지 장점](/assets/posts/ts-why-typescript-benefits.svg)

## 실제 현업 사례

### 에어비앤비의 사례

에어비앤비(Airbnb) 엔지니어링 팀이 분석한 결과, 과거에 발생한 버그의 **38%**가 TypeScript를 사용했다면 사전에 방지할 수 있었을 것으로 나타났다. 타입 시스템만으로 거의 40%의 버그를 예방할 수 있다는 의미다.

### 마이크로소프트 VS Code

VS Code 자체가 TypeScript로 작성됐다. 100만 줄 이상의 코드베이스에서 TypeScript가 유지보수성을 어떻게 높이는지 보여주는 가장 좋은 증거다.

### 구글 Angular

Angular 2.0부터 TypeScript를 기본 언어로 채택했다. 구글은 TypeScript의 타입 시스템이 대규모 팀에서 코드 품질을 유지하는 데 필수적이라고 판단했다.

## TypeScript가 적합하지 않은 경우

모든 상황에 TypeScript가 최선은 아니다.

**소규모 스크립트**: 100줄 이하의 간단한 자동화 스크립트라면 TypeScript의 빌드 설정이 오버헤드가 될 수 있다.

**프로토타이핑**: 아이디어를 빠르게 검증하는 단계에서는 JavaScript가 더 민첩하다. 단, 프로토타입이 프로덕션 코드로 이어진다면 처음부터 TypeScript를 쓰는 게 낫다.

**라이브러리 타입 미지원**: 아주 오래된 npm 패키지 중 `@types/...` 타입 정의가 없는 경우 `declare module`로 직접 정의해야 하는 번거로움이 있다.

## TypeScript의 채택 현황

2023년 State of JS 설문에서 TypeScript 사용 비율은 전체 JavaScript 개발자의 83%를 넘었다. npm 주간 다운로드 통계에서도 TypeScript는 꾸준히 상위권을 유지한다.

```
TypeScript 사용 비율 (State of JS 2023):
사용 중 + 사용 의향: 83.1%
사용 안 함:          16.9%
```

프론트엔드, 백엔드, 풀스택 어느 영역에서 일하든 TypeScript는 이제 필수 역량이 됐다.

## 정리

TypeScript를 도입해야 하는 이유는 단순한 유행이 아니다. 버그 예방, 개발 생산성 향상, 안전한 리팩터링, 팀 협업 강화, 점진적 도입 가능성이라는 실질적 가치가 있다. 다음 글에서는 TypeScript와 JavaScript를 직접 코드로 비교해보며 차이점을 구체적으로 확인한다.

---

**지난 글:** [TypeScript의 본질: JavaScript의 상위셋이란 무엇인가](/posts/ts-essence/)

**다음 글:** [TypeScript vs JavaScript: 코드로 보는 결정적 차이](/posts/ts-vs-javascript/)

<br>
읽어주셔서 감사합니다. 😊
