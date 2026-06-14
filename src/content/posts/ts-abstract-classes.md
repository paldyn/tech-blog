---
title: "추상 클래스 — 설계도와 구현 분리"
description: "TypeScript abstract class의 선언 방식, 추상 메서드 강제 구현, 인터페이스와의 차이, 템플릿 메서드 패턴 실무 예시를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "추상클래스", "abstract", "OOP", "템플릿메서드", "상속"]
featured: false
draft: false
---

[지난 글](/posts/ts-ecmascript-private-fields/)에서 ECMAScript 비공개 필드를 살펴봤다. 이번에는 **추상 클래스(Abstract Class)**를 다룬다. 추상 클래스는 직접 인스턴스화할 수 없는 클래스로, 공통 구조와 동작을 정의하는 **설계도** 역할을 한다. 서브클래스는 이 설계도를 바탕으로 구체적인 구현을 제공해야 한다.

## abstract 키워드

`abstract` 키워드를 클래스에 붙이면 추상 클래스가 된다. 추상 클래스 안에서 `abstract` 메서드를 선언할 수 있으며, 이 메서드는 body가 없다.

```typescript
abstract class Shape {
  abstract area(): number;    // 구현 없음 — 서브클래스 의무
  abstract perimeter(): number;

  // 일반 메서드는 구현 가능
  describe(): string {
    return `넓이: ${this.area().toFixed(2)}, 둘레: ${this.perimeter().toFixed(2)}`;
  }
}

// new Shape(); // Error ❌ — 추상 클래스는 인스턴스화 불가
```

## 추상 클래스 계층 구조

![추상 클래스 계층 구조](/assets/posts/ts-abstract-classes-structure.svg)

서브클래스가 추상 메서드를 **모두** 구현하지 않으면 컴파일 오류가 난다. TypeScript가 "너 아직 `area()` 안 만들었어"라고 알려준다.

## 코드 패턴

![추상 클래스 코드 패턴](/assets/posts/ts-abstract-classes-code.svg)

```typescript
class Circle extends Shape {
  constructor(private r: number) { super(); }
  area():      number { return Math.PI * this.r ** 2; }
  perimeter(): number { return 2 * Math.PI * this.r; }
}

class Rectangle extends Shape {
  constructor(private w: number, private h: number) { super(); }
  area():      number { return this.w * this.h; }
  perimeter(): number { return 2 * (this.w + this.h); }
}

const shapes: Shape[] = [new Circle(5), new Rectangle(4, 6)];
for (const s of shapes) {
  console.log(s.describe());
  // "넓이: 78.54, 둘레: 31.42"
  // "넓이: 24.00, 둘레: 20.00"
}
```

`shapes` 배열의 타입이 `Shape[]`이므로, 루프에서 `area()`와 `perimeter()`가 반드시 존재함을 보장한다.

## 인터페이스와의 차이

추상 클래스와 인터페이스 모두 "구현을 강제"하는 역할을 하지만 차이가 있다.

| 항목 | abstract class | interface |
|------|---------------|-----------|
| 구현 포함 | 가능 (일반 메서드) | 불가 (TS 4.2 이전) / 가능 (default 없음) |
| 생성자 | 있음 | 없음 |
| 필드 선언 | 가능 | 가능 |
| 다중 상속 | 불가 (단일) | 가능 (여러 implements) |
| 접근 제한자 | 가능 | 불가 (전부 public) |
| 런타임 존재 | 있음 (JS 클래스로) | 없음 (타입만 존재) |

**공통 구현**이 있거나, 생성자 로직이 필요하거나, 접근 제한자가 필요하면 추상 클래스. 순수하게 타입 계약만 맺으려면 인터페이스.

## 템플릿 메서드 패턴

추상 클래스의 대표적인 활용 패턴이다. 알고리즘의 뼈대를 추상 클래스에 정의하고, 세부 단계만 서브클래스가 구현한다.

```typescript
abstract class DataProcessor {
  // 템플릿 메서드 — 알고리즘 뼈대
  process(raw: string): string {
    const parsed   = this.parse(raw);
    const filtered = this.filter(parsed);
    return this.format(filtered);
  }

  protected abstract parse(raw: string):         string[];
  protected abstract filter(data: string[]):     string[];
  protected abstract format(data: string[]):     string;
}

class CsvProcessor extends DataProcessor {
  protected parse(raw: string) { return raw.split(","); }
  protected filter(d: string[]) { return d.filter(s => s.trim()); }
  protected format(d: string[]) { return d.join(" | "); }
}

const proc = new CsvProcessor();
console.log(proc.process("a,b,,c")); // "a | b | c"
```

## abstract 프로퍼티

메서드뿐 아니라 프로퍼티도 `abstract`로 선언할 수 있다.

```typescript
abstract class Animal {
  abstract readonly sound: string;

  makeSound(): void {
    console.log(this.sound);
  }
}

class Dog extends Animal {
  readonly sound = "Woof";
}
```

## 핵심 정리

추상 클래스는 "공통 로직 + 가변 동작"을 분리하는 도구다. 직접 인스턴스화를 막아 "이 클래스는 항상 구체적인 서브클래스와 함께 써야 한다"는 설계 의도를 코드로 표현한다. 다음 글에서는 추상 클래스를 포함한 클래스 상속 전체를 다룬다.

---

**지난 글:** [ECMAScript 비공개 필드 — # 기반 런타임 캡슐화](/posts/ts-ecmascript-private-fields/)

**다음 글:** [클래스 상속 — extends와 super 완전 정리](/posts/ts-class-inheritance/)

<br>
읽어주셔서 감사합니다. 😊
