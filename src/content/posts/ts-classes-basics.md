---
title: "TypeScript 클래스 기초 — 객체지향의 출발점"
description: "TypeScript 클래스 문법, 프로퍼티·생성자·메서드 선언, 인스턴스 생성, 타입 안전성 확보 방법을 단계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "클래스", "class", "OOP", "생성자", "constructor", "메서드"]
featured: false
draft: false
---

[지난 글](/posts/ts-excess-property-checks/)에서 초과 프로퍼티 검사를 살펴봤다. 이번에는 TypeScript의 **클래스(class)** 문법을 다룬다. ES6부터 자바스크립트에 클래스 문법이 도입됐고, TypeScript는 그 위에 타입 주석과 접근 제어자를 더해 한층 안전한 객체지향 코드를 작성하게 해준다.

## 클래스가 필요한 이유

객체 리터럴로도 많은 것을 표현할 수 있지만, 같은 형태의 객체를 여러 개 만들어야 하거나 내부 상태를 메서드로 캡슐화해야 한다면 클래스가 훨씬 편리하다. 특히 TypeScript 클래스는 **인터페이스처럼 타입 역할도 함께** 수행하므로, 하나의 선언으로 값과 타입 두 가지를 얻는다.

```typescript
// 객체 리터럴 — 재사용 어려움
const alice = { name: "Alice", age: 30 };
const bob   = { name: "Bob",   age: 25 };

// 클래스 — 한 번 정의, 여러 번 인스턴스 생성
class Person {
  name: string;
  age:  number;

  constructor(name: string, age: number) {
    this.name = name;
    this.age  = age;
  }
}

const alice2 = new Person("Alice", 30);
const bob2   = new Person("Bob",   25);
```

## 클래스 구조 해부

TypeScript 클래스는 세 가지 핵심 요소로 구성된다.

![TypeScript 클래스 구조 해부](/assets/posts/ts-classes-basics-anatomy.svg)

**프로퍼티 선언**: 클래스 몸체 상단에 `name: string`처럼 선언한다. JavaScript와 달리 TypeScript에서는 `strict: true` 환경에서 프로퍼티를 반드시 선언해야 한다. 선언 없이 `this.name`에 접근하면 컴파일 오류가 난다.

**생성자**: `constructor` 키워드로 정의하며, `new`로 인스턴스를 만들 때 자동으로 실행된다. 여기서 프로퍼티를 초기화한다.

**메서드**: 클래스 안에 함수처럼 선언하되 `function` 키워드를 생략한다. 반환 타입을 명시하면 실수를 방지할 수 있다.

```typescript
class Person {
  // 1. 프로퍼티 선언
  name: string;
  age:  number;

  // 2. 생성자
  constructor(name: string, age: number) {
    this.name = name;
    this.age  = age;
  }

  // 3. 메서드
  greet(): string {
    return `Hi, I'm ${this.name} (${this.age})`;
  }

  birthday(): void {
    this.age += 1;
  }
}
```

## 인스턴스 생성과 사용

`new` 키워드로 인스턴스를 만들면 생성자가 호출되고 힙 메모리에 객체가 할당된다.

![클래스 인스턴스 생성과 사용](/assets/posts/ts-classes-basics-instance.svg)

```typescript
const alice = new Person("Alice", 30);

// 프로퍼티 접근
console.log(alice.name); // "Alice"
console.log(alice.age);  // 30

// 메서드 호출
console.log(alice.greet()); // "Hi, I'm Alice (30)"
alice.birthday();
console.log(alice.age);     // 31
```

TypeScript는 인스턴스의 타입을 클래스 이름(`Person`)으로 추론하므로, `alice.`를 입력하면 에디터가 `name`, `age`, `greet`, `birthday`를 자동 완성해 준다.

## 클래스는 타입이기도 하다

TypeScript 클래스는 선언과 동시에 **같은 이름의 타입**이 생성된다. 따라서 함수 매개변수 타입으로 클래스를 그대로 사용할 수 있다.

```typescript
function introduce(person: Person): void {
  console.log(person.greet());
}

introduce(alice); // OK ✅
introduce({ name: "Bob", age: 25 }); // OK ✅ — 구조적 타이핑
```

구조적 타이핑 덕분에 `Person` 클래스의 인스턴스가 아니어도 동일한 구조의 객체이면 `Person` 타입으로 사용할 수 있다. 이 점이 Java·C# 클래스와 가장 큰 차이다.

## 프로퍼티 초기화 shorthand

프로퍼티 선언과 초기화를 생성자에서 동시에 할 수 있는 **파라미터 프로퍼티** 문법도 있다. 이 내용은 이후 포스트에서 자세히 다룬다.

```typescript
// 파라미터 프로퍼티 (미리 보기)
class Point {
  constructor(
    public x: number,
    public y: number
  ) {}
}

const p = new Point(3, 4);
console.log(p.x, p.y); // 3 4
```

## 선택적 프로퍼티와 기본값

인터페이스처럼 `?`로 선택적 프로퍼티를 선언하고, 선언 시 기본값을 줄 수 있다.

```typescript
class Config {
  host:    string;
  port:    number  = 3000;      // 기본값
  timeout: number | undefined;  // 선택적 (undefined 허용)

  constructor(host: string) {
    this.host = host;
  }
}

const cfg = new Config("localhost");
console.log(cfg.port);    // 3000
console.log(cfg.timeout); // undefined
```

## 핵심 정리

TypeScript 클래스는 자바스크립트 클래스에 타입 주석을 입힌 것이다. 프로퍼티 선언, 생성자, 메서드 세 요소로 구성되며, 클래스 이름이 곧 타입이 된다. 다음 글에서는 클래스 멤버의 공개 범위를 제어하는 **접근 제한자(access modifiers)**를 살펴본다.

---

**다음 글:** [접근 제한자 — public, private, protected 완전 정리](/posts/ts-access-modifiers/)

<br>
읽어주셔서 감사합니다. 😊
