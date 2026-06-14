---
title: "구조적 타이핑 — TypeScript가 타입을 비교하는 방법"
description: "TypeScript 구조적 타이핑(Structural Typing)의 덕 타이핑 원칙, 함수 매개변수·반환 타입 호환성, 공변·반변 개념을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 8
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "구조적타이핑", "structural typing", "덕타이핑", "타입호환성", "공변반변"]
featured: false
draft: false
---

[지난 글](/posts/ts-indexed-access-types/)에서 인덱스 접근 타입을 살펴봤다. 이번에는 TypeScript 타입 시스템의 근본 원칙인 **구조적 타이핑(Structural Typing)**을 다룬다. "이름이 아니라 형태(shape)로 타입을 비교한다"는 원칙이 TypeScript의 모든 타입 호환성 결정의 기초다.

## 구조적 타이핑이란

Java나 C#은 명목적 타이핑(Nominal Typing)을 사용한다. 두 타입이 같은 구조를 가지더라도 이름이 다르면 다른 타입으로 취급한다. TypeScript는 구조적 타이핑을 사용한다. 이름과 무관하게 **필드 집합이 일치하면 같은 타입으로 취급**한다.

![구조적 vs 명목적 타이핑](/assets/posts/ts-structural-typing-comparison.svg)

```typescript
interface Point { x: number; y: number }
class Coord    { x = 0;      y = 0     }

// Coord는 Point를 implements하지 않음
// 하지만 구조가 같으므로 호환됨
const p: Point = new Coord(); // OK ✅
```

## 추가 필드는 괜찮다

구조적 타이핑에서 서브타입은 슈퍼타입의 모든 필드를 포함하기만 하면 된다. 추가 필드가 있어도 문제없다.

```typescript
interface Animal { name: string }
const dog = { name: "Bori", breed: "Jindo" };

// dog는 Animal보다 필드가 많지만
// Animal의 필드(name)를 포함하므로 호환
const a: Animal = dog; // OK ✅
```

![구조적 타입 호환성 규칙](/assets/posts/ts-structural-typing-compatibility.svg)

## 함수 매개변수 호환성

함수 타입의 매개변수는 **반변(contravariant)**이다. 더 적은 매개변수를 받는 함수를 더 많은 매개변수를 기대하는 타입에 할당할 수 있다.

```typescript
type OnClick = (event: MouseEvent) => void;
type OnAnyEvent = (event: Event) => void;

// MouseEvent extends Event이므로
// (event: Event) => void 는 (event: MouseEvent) => void에 할당 불가
// 하지만 실무에서는 콜백의 매개변수가 더 적어도 허용

const handler: OnClick = () => {}; // 매개변수 무시 — OK ✅
// Array.prototype.forEach의 콜백이 이 덕에 동작
[1, 2, 3].forEach(n => console.log(n)); // (n, index, arr) 무시 OK
```

## 반환 타입 공변성

반환 타입은 **공변(covariant)**이다. 더 구체적인 타입을 반환하는 함수가 더 추상적인 반환 타입에 할당 가능하다.

```typescript
interface Named { name: string }
interface NamedAndAged extends Named { age: number }

type GetNamed = () => Named;
type GetDetailed = () => NamedAndAged;

// NamedAndAged는 Named의 서브타입
// 더 구체적인 반환 타입을 가진 함수를 더 추상적인 함수 타입에 할당 가능
const fn: GetNamed = (): NamedAndAged => ({ name: "Alice", age: 30 }); // OK ✅
```

## 실무 활용

구조적 타이핑의 장점을 활용하면 다음이 가능하다.

```typescript
// 1. 외부 JSON을 인터페이스에 직접 할당
const rawData = await response.json(); // any
const user: User = rawData;            // 필드 검사 없이 할당

// 2. 라이브러리 없이 mock 객체 생성
interface UserService {
  getById(id: string): Promise<User>;
}

// 실제 클래스 없이 객체 리터럴로 mock
const mockService: UserService = {
  getById: async (id) => ({ id, name: "Test" }),
};

// 3. 함수가 필요한 필드만 선언
function printName(obj: { name: string }) {
  console.log(obj.name);
}
printName({ name: "Alice", age: 30 }); // 변수 경유 시 OK
```

---

**지난 글:** [인덱스 접근 타입 — T[K]로 타입 추출](/posts/ts-indexed-access-types/)

**다음 글:** [명목적 타입과 브랜드 타입 — 의미 있는 타입 구분](/posts/ts-nominal-branded-types/)

<br>
읽어주셔서 감사합니다. 😊
