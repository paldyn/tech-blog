---
title: "게터와 세터 — 프로퍼티 접근 제어"
description: "TypeScript get/set 접근자의 동작 원리, 유효성 검사 패턴, 계산된 프로퍼티, 인터페이스와의 관계, 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "getter", "setter", "get", "set", "접근자", "프로퍼티", "캡슐화"]
featured: false
draft: false
---

[지난 글](/posts/ts-parameter-properties/)에서 파라미터 프로퍼티로 생성자를 간결하게 만드는 방법을 살펴봤다. 이번에는 **게터(getter)와 세터(setter)**를 다룬다. 외부에서는 일반 프로퍼티처럼 쓰지만, 내부에서는 메서드처럼 로직을 실행할 수 있는 접근자 패턴이다.

## get / set 기본

`get` 키워드로 선언한 메서드는 값을 읽을 때 자동으로 호출되고, `set` 키워드로 선언한 메서드는 값을 쓸 때 자동으로 호출된다.

```typescript
class Circle {
  constructor(private _radius: number) {}

  get radius(): number {
    return this._radius;
  }

  set radius(v: number) {
    if (v < 0) throw new Error("반지름은 0 이상이어야 합니다");
    this._radius = v;
  }

  get area(): number {
    return Math.PI * this._radius ** 2; // 계산된 프로퍼티
  }
}

const c = new Circle(5);
console.log(c.radius); // 5  — get 호출
c.radius = 10;         // set 호출
// c.radius = -1;      // Error 런타임 ❌
console.log(c.area);   // 314.15...
```

## 동작 원리

![게터·세터 동작 원리](/assets/posts/ts-getters-setters-concept.svg)

외부 코드는 `obj.name = "x"` 또는 `obj.name`처럼 평범한 프로퍼티 문법을 사용한다. 내부에서 setter/getter가 실행되므로 호출 코드를 바꾸지 않아도 로직을 추가하거나 변경할 수 있다.

## 유효성 검사 패턴

![get / set 코드 패턴](/assets/posts/ts-getters-setters-code.svg)

```typescript
const t = new Temperature(25);
console.log(t.fahrenheit); // 77
t.celsius = 100;
console.log(t.fahrenheit); // 212
// t.celsius = -300; // Error 런타임 — 절대영도 이하
```

세터에서 값을 검증하면, 클래스 불변식(invariant)을 언제나 보장할 수 있다.

## getter만 있는 경우 — 읽기 전용 계산

세터 없이 게터만 선언하면 읽기 전용 계산 프로퍼티가 된다.

```typescript
class FullName {
  constructor(
    public firstName: string,
    public lastName:  string
  ) {}

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

const name = new FullName("John", "Doe");
console.log(name.fullName); // "John Doe"
// name.fullName = "Jane"; // Error ❌ — setter 없음
```

TypeScript는 게터만 있고 세터가 없으면 자동으로 `readonly`로 추론한다.

## 인터페이스와 접근자

인터페이스에서 접근자를 선언하는 방법은 일반 프로퍼티 선언과 동일하다. 구현 클래스에서 get/set으로 구현하면 된다.

```typescript
interface Scalable {
  scale: number;
}

class Vector implements Scalable {
  private _scale = 1;

  get scale(): number { return this._scale; }
  set scale(v: number) {
    if (v <= 0) throw new Error("양수만 허용");
    this._scale = v;
  }
}
```

## TypeScript 접근자 타입 규칙

- getter 반환 타입과 setter 파라미터 타입이 **다를 수 없다** (TypeScript 4.3 이전엔 허용됐지만 이후로 더 엄격해짐).
- setter는 반환 타입을 명시할 수 없다 (`void` 생략 — 컴파일러가 강제).
- `abstract` 클래스에서 `abstract get`/`abstract set`도 선언 가능.

```typescript
class Box {
  private _value = 0;

  get value(): number { return this._value; }
  set value(v: number) { this._value = v; } // 반환 타입 명시 금지
}
```

## 언제 게터/세터를 쓸까

게터/세터가 유용한 상황:
- 값을 읽거나 쓸 때 유효성 검사가 필요한 경우
- 저장 형식과 노출 형식이 다른 경우 (Celsius ↔ Fahrenheit)
- 여러 필드에서 파생되는 계산 결과를 프로퍼티처럼 표현할 때

단순히 값을 저장하는 경우라면 일반 프로퍼티가 더 명확하다. 게터/세터는 프로퍼티처럼 보이지만 실제로는 메서드 호출이므로, 무거운 연산을 게터에 넣으면 매번 읽을 때마다 실행된다는 점을 기억하자.

## 핵심 정리

게터와 세터는 "프로퍼티 인터페이스를 유지하면서 내부 로직을 숨기는" 캡슐화 도구다. 유효성 검사, 변환, 지연 계산을 추가할 수 있고 호출 코드는 바꾸지 않아도 된다. 다음 글에서는 인스턴스가 아닌 클래스 자체에 속하는 **정적 멤버(static members)**를 살펴본다.

---

**지난 글:** [파라미터 프로퍼티 — 생성자 단축 선언](/posts/ts-parameter-properties/)

**다음 글:** [정적 멤버 — 클래스 레벨의 공유 상태](/posts/ts-static-members/)

<br>
읽어주셔서 감사합니다. 😊
