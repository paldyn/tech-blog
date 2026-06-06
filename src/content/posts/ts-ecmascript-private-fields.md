---
title: "ECMAScript 비공개 필드 — # 기반 런타임 캡슐화"
description: "ECMAScript 비공개 필드(#)와 TypeScript private의 차이, 런타임 캡슐화 보장 원리, in 연산자 타입 가드, 실무 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "ECMAScript", "private fields", "#", "캡슐화", "WeakMap", "클래스"]
featured: false
draft: false
---

[지난 글](/posts/ts-access-modifiers/)에서 TypeScript `private`이 컴파일 타임 전용이라는 점을 살펴봤다. 이번에는 **ECMAScript 비공개 필드(Private Class Fields)**, 즉 `#` 문법을 다룬다. 이 기능은 TypeScript가 아닌 JavaScript 언어 자체에 추가된 것으로, 런타임에서도 진짜 캡슐화를 보장한다.

## # 문법 기본

이름 앞에 `#`을 붙이면 ECMAScript private field가 된다. 선언할 때도, 사용할 때도 항상 `#`을 붙여야 한다.

```typescript
class Token {
  #value: string; // 선언

  constructor(value: string) {
    this.#value = value; // 초기화: this.#value
  }

  masked(): string {
    return this.#value.slice(0, 3) + "***";
  }
}

const t = new Token("supersecret");
console.log(t.masked()); // "sup***"
// t.#value; // SyntaxError — 클래스 외부 접근 불가
```

클래스 외부에서 `#value`에 접근하면 컴파일 오류가 아닌 **SyntaxError** — 즉 파서 수준에서 막힌다. `as any`로도 우회할 수 없다.

## TypeScript private vs # 비교

![TypeScript private vs # ECMAScript private](/assets/posts/ts-ecmascript-private-fields-compare.svg)

핵심 차이는 **격리 레이어**다. TypeScript `private`은 타입 체커 레이어에서만 막고, 컴파일 후 JavaScript에는 흔적이 없다. ECMAScript `#`은 JavaScript 엔진이 WeakMap을 사용해 런타임에서 별도로 저장하므로 `Object.keys()`, `JSON.stringify()`, 프로토타입 탐색 모두에서 보이지 않는다.

## # 필드 캡슐화 패턴

![# 필드를 활용한 캡슐화 패턴](/assets/posts/ts-ecmascript-private-fields-pattern.svg)

`equals` 메서드처럼 같은 클래스의 다른 인스턴스 `#` 필드에는 접근할 수 있다는 점이 흥미롭다. 이는 JavaScript 스펙에 명시된 동작이다.

```typescript
const c1 = new Counter();
const c2 = new Counter();
c1.increment();
c1.increment();
c2.increment();
console.log(c1.equals(c2)); // false
```

## in 연산자로 타입 가드

`#` 필드는 `in` 연산자와 결합해 타입 가드를 만들 수 있다. 해당 `#` 필드를 가진 클래스의 인스턴스인지 런타임에서 확인하는 패턴이다.

```typescript
class Circle {
  #radius: number;
  constructor(r: number) { this.#radius = r; }

  static isCircle(obj: unknown): obj is Circle {
    return #radius in (obj as object);
  }

  area(): number {
    return Math.PI * this.#radius ** 2;
  }
}

const c = new Circle(5);
if (Circle.isCircle(c)) {
  console.log(c.area()); // 78.53...
}
```

`#radius in obj`는 `obj`가 `Circle` 인스턴스일 때만 `true`를 반환한다. 위조가 불가능한 강력한 타입 가드다.

## 서브클래스와의 관계

`#` 필드는 **서브클래스에서도 접근할 수 없다.** TypeScript `protected`를 대체할 수 없으며, 서브클래스가 내부 상태를 공유해야 한다면 `protected`를 써야 한다.

```typescript
class Base {
  #secret = "hidden";

  getSecret(): string { return this.#secret; }
}

class Child extends Base {
  reveal(): string {
    // return this.#secret; // SyntaxError ❌
    return this.getSecret(); // OK ✅ — 메서드 위임
  }
}
```

## 언제 # 를 선택할까

| 상황 | 선택 |
|------|------|
| 컴파일 타임 검사만 필요 | `private` |
| 서드파티에 제공하는 라이브러리 | `#` |
| JSON 직렬화에서 제외되어야 함 | `#` |
| 서브클래스가 접근해야 함 | `protected` |
| `as any` 우회가 걱정됨 | `#` |

실무에서는 라이브러리를 외부에 배포하거나 민감한 상태를 진짜로 숨겨야 할 때 `#`을 쓰고, 팀 내부 코드에서 의도를 표현할 때는 TypeScript `private`으로도 충분한 경우가 많다.

---

**지난 글:** [접근 제한자 — public, private, protected 완전 정리](/posts/ts-access-modifiers/)

**다음 글:** [추상 클래스 — 설계도와 구현 분리](/posts/ts-abstract-classes/)

<br>
읽어주셔서 감사합니다. 😊
