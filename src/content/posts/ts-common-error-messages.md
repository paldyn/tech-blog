---
title: "자주 만나는 에러 메시지 읽기"
description: "TypeScript의 길고 무서워 보이는 에러 메시지를 빠르게 해석하는 법을 다룬다. 에러 코드·소스 타입·타깃 타입으로 메시지 구조를 분해하는 법, TS2322·TS2339·TS2345·TS18048 같은 단골 에러의 원인과 고치는 방향, 그리고 중첩된 'because' 체인을 읽는 요령까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-20"
archiveOrder: 3
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "에러", "디버깅", "타입 에러", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/ts-large-codebase-strategies/)에서 대규모 코드베이스를 구조적으로 다루는 전략을 살펴봤다. 코드가 커지고 타입이 정교해질수록 컴파일러가 내뱉는 에러 메시지도 길고 복잡해진다. 처음 보면 화면을 가득 채운 빨간 글씨에 압도되기 쉽지만, 사실 TypeScript의 에러 메시지는 일정한 구조를 따른다. 그 구조만 익히면 대부분의 에러는 첫 두 줄에서 원인이 보인다. 이번 글은 자주 만나는 에러 메시지를 빠르게 해석하는 법을 다룬다.

## 에러 메시지의 구조

거의 모든 타입 에러는 같은 골격을 가진다. **에러 코드**, **소스 타입**(내가 넣으려는 값), **타깃 타입**(받는 쪽이 기대하는 값). 이 셋만 짚으면 절반은 읽힌 셈이다.

![에러 메시지 해부](/assets/posts/ts-common-error-messages-anatomy.svg)

`error TS2322: Type 'string' is not assignable to type 'number'`를 보자. `TS2322`는 에러의 종류를 가리키는 코드로, 검색하거나 문서를 찾을 때의 키워드가 된다. `'string'`은 내가 실제로 넣은 값의 타입(소스), `'number'`는 그 자리가 원하는 타입(타깃)이다. 즉 "숫자가 와야 하는데 문자열을 넣었다"는 한 문장으로 압축된다.

```typescript
let count: number = "10"; // ❌
// Type 'string' is not assignable to type 'number'.
```

`assignable`이라는 단어가 핵심이다. "이 방향으로 할당이 가능한가"를 묻고 있고, 답이 아니라는 뜻이다.

## 단골 에러 네 가지

실무에서 마주치는 에러의 대부분은 몇 개 코드로 수렴한다. 코드 번호만 기억해 둬도 원인을 빠르게 좁힐 수 있다.

![자주 만나는 에러 코드](/assets/posts/ts-common-error-messages-catalog.svg)

```typescript
// TS2339: 객체에 없는 속성 접근
const user = { name: "Kim" };
console.log(user.age); // Property 'age' does not exist

// TS2345: 인자 타입 불일치
function greet(name: string) {}
greet(42); // Argument of type 'number' is not assignable...

// TS18048: 좁히기 전에 접근
function len(s?: string) {
  return s.length; // 's' is possibly 'undefined'
}
```

`TS2339`는 객체에 없는 속성을 읽으려 할 때 뜬다. 오타이거나, 타입 정의가 실제 객체보다 좁은 경우다. `TS2345`는 함수 인자의 타입이 매개변수와 맞지 않을 때다. `TS18048`(과 사촌 격인 `TS2532`)은 `undefined`일 수 있는 값을 좁히지 않고 바로 썼을 때 뜨며, `strictNullChecks`가 일하고 있다는 좋은 신호다. 옵셔널 체이닝이나 이른 반환으로 좁혀 주면 사라진다.

## 길고 중첩된 에러 읽기

객체나 제네릭이 얽히면 에러가 여러 줄로 길어진다. 이때는 들여쓰기가 단서다. TypeScript는 "왜 할당이 안 되는지"를 안쪽으로 한 단계씩 파고들며 설명한다.

```text
Type '{ id: number; name: number; }' is not
  assignable to type 'User'.
  Types of property 'name' are incompatible.
    Type 'number' is not assignable to type 'string'.
```

이런 메시지는 **맨 아래부터** 읽는 것이 빠르다. 가장 안쪽, 가장 깊이 들여쓴 줄이 진짜 원인이다. 위 예에서는 `name` 속성이 `number`인데 `string`이어야 한다는 것이 핵심이고, 윗줄들은 거기까지 도달한 경로를 설명할 뿐이다. 첫 줄의 거대한 객체 타입에 압도되지 말고, 마지막 줄의 "X is not assignable to Y"만 찾으면 된다.

## 에러를 빠르게 다루는 습관

에러를 잘 읽는 것만큼, 에러가 났을 때 도구를 잘 쓰는 것도 중요하다. 에디터에서 빨간 줄에 마우스를 올리면 같은 메시지를 보여 주고, 해당 심볼에서 "정의로 이동"을 누르면 타입이 어디서 왔는지 추적할 수 있다. 메시지가 정말 모호할 때는 문제의 값에 마우스를 올려 추론된 타입을 직접 확인하는 것이 가장 빠르다. 그래도 막히면 `TS2345` 같은 코드를 그대로 검색하면 같은 상황을 겪은 사례가 거의 항상 나온다.

## 무엇을 기억할까

TypeScript의 에러 메시지는 무섭게 생겼지만 규칙적이다. 코드·소스·타깃 세 조각으로 분해하면 첫 줄에서 의도가 보이고, 중첩된 메시지는 맨 아래 가장 깊은 줄이 진짜 원인이다. 단골 코드 몇 개의 의미를 기억해 두면, 빨간 줄을 보자마자 어디를 고쳐야 할지 감이 온다. 에러는 적이 아니라 컴파일러가 건네는 가장 구체적인 힌트다. 다음 글에서는 애초에 이런 에러가 좋은 방향으로 나도록 타입을 설계하는 원칙을 다룬다.

---

**지난 글:** [대규모 코드베이스 전략](/posts/ts-large-codebase-strategies/)

**다음 글:** [타입 설계 베스트 프랙티스](/posts/ts-type-design-best-practices/)

<br>
읽어주셔서 감사합니다. 😊
