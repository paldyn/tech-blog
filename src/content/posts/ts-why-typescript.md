---
title: "왜 TypeScript인가: 정적 타입이 바꾸는 개발 경험"
description: "JavaScript로 충분한데 왜 TypeScript를 써야 하는가? 에러 조기 검출, IDE 지원, 리팩터링 안전성 등 TypeScript 도입의 실질적 이유를 코드로 설명한다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "정적타입", "타입에러", "IDE지원", "리팩터링", "코드품질"]
featured: false
draft: false
---

[지난 글](/posts/ts-essence/)에서 TypeScript가 무엇인지, JavaScript와 어떤 관계인지를 살펴봤다. 이번 편에서는 "왜 굳이 TypeScript를 써야 하는가?"라는 현실적인 질문에 정면으로 답한다.

## 같은 버그, 다른 발견 시점

TypeScript의 핵심 가치는 단순하다. **에러를 더 일찍, 더 저렴하게 발견한다.** 아래 코드를 보자.

![컴파일 타임 vs 런타임 에러 검출](/assets/posts/ts-why-typescript-errors.svg)

JavaScript에서는 `add("1", 2)`를 호출해도 아무 에러가 없다. 문자열과 숫자를 `+`로 연결하면 `"12"`가 되기 때문이다. 이 버그는 실행한 사람이 이상한 결과를 봐야만 드러난다.

TypeScript에서는 같은 코드가 컴파일 단계에서 즉시 에러를 발생시킨다.

```typescript
function add(a: number, b: number): number {
  return a + b;
}

add("1", 2);
// Error: Argument of type 'string' is not assignable
//        to parameter of type 'number'.
```

에디터가 빨간 물결선으로 즉시 표시하고, 저장하거나 빌드할 때 컴파일이 중단된다. 사용자가 프로덕션 버그를 보기 전에 개발자가 먼저 알게 된다.

## 버그 발견 비용의 차이

소프트웨어 공학의 오래된 법칙이 있다. 버그를 수정하는 비용은 발견하는 시점이 늦을수록 기하급수적으로 늘어난다.

| 발견 시점 | 상대적 비용 |
|-----------|------------|
| 코딩 중 (IDE가 표시) | 1배 |
| 코드 리뷰 | 6배 |
| QA 테스트 | 15배 |
| 프로덕션 | 100배+ |

TypeScript는 버그를 "코딩 중"으로 끌어당긴다. 에디터가 실시간으로 타입 오류를 표시하기 때문에 코드를 작성하는 순간에 바로 수정할 수 있다.

## 강력한 IDE 지원

TypeScript를 쓰는 또 다른 이유는 **개발 경험(DX)의 극적인 향상**이다.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

function formatUser(user: User): string {
  // 여기서 Ctrl+Space를 누르면 user.id, user.name,
  // user.email, user.createdAt이 자동완성된다.
  return `${user.name} (${user.email})`;
}
```

타입 정보가 있으면 에디터는 다음을 제공할 수 있다.

- **정확한 자동완성**: 객체의 프로퍼티만 정확히 제안한다. 오타나 없는 프로퍼티는 에러로 표시된다.
- **타입 힌트(Hover)**: 함수 시그니처, 반환 타입을 즉시 확인한다.
- **정의로 이동(F12)**: 타입/함수가 어디서 선언됐는지 한 키로 이동한다.
- **참조 찾기(Shift+F12)**: 이 타입이 코드 전체에서 어디서 사용되는지 한번에 확인한다.

## 살아있는 문서화

TypeScript 타입은 코드의 **계약서(contract)**다. 함수 시그니처를 보면 무엇을 받고 무엇을 반환하는지 즉시 알 수 있다.

```typescript
// 타입 없이는 내부를 읽어야 이해된다
function processPayment(data, options) { ... }

// 타입이 있으면 호출 전에 계약을 알 수 있다
function processPayment(
  data: PaymentData,
  options?: { retries?: number; timeout?: number }
): Promise<PaymentResult> { ... }
```

별도 주석이나 문서 없이도 함수를 어떻게 써야 하는지 타입이 알려준다. 더 중요한 것은 이 "문서"가 코드와 항상 동기화된다는 점이다. 주석은 코드가 바뀌어도 방치되지만, 타입은 컴파일러가 강제한다.

## 안전한 대규모 리팩터링

TypeScript 도입의 가장 극적인 효과는 리팩터링 자신감이다.

```typescript
// User 인터페이스에서 'email' 필드를 'emailAddress'로 이름 변경
interface User {
  id: number;
  name: string;
  emailAddress: string;  // 'email' → 'emailAddress'
}
```

이 변경 후 `tsc`를 실행하면 프로젝트 전체에서 `user.email`을 참조하는 모든 지점이 에러로 표시된다. 수천 개의 파일을 수동으로 grep할 필요 없이, 컴파일러가 영향 범위를 정확히 알려준다.

JavaScript에서는 이 작업이 "용기가 필요한 일"이었다. TypeScript에서는 일상적인 작업이 된다.

## TypeScript의 이점 정리

![TypeScript 도입의 핵심 이점](/assets/posts/ts-why-typescript-benefits.svg)

이 시리즈를 따라가면서 각 이점이 구체적으로 어떻게 구현되는지 하나씩 체험하게 될 것이다. 다음 편에서는 TypeScript와 JavaScript를 정면 비교하면서 "슈퍼셋"의 의미를 더 구체적으로 탐구한다.

---

**지난 글:** [TypeScript 완전 정복: 시리즈를 시작하며](/posts/ts-essence/)

**다음 글:** [TypeScript vs JavaScript: 슈퍼셋의 의미](/posts/ts-vs-javascript/)

<br>
읽어주셔서 감사합니다. 😊
