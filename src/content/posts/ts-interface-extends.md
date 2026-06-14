---
title: "interface extends — 계층적 타입 설계"
description: "TypeScript interface extends로 단일·다중 상속, 충돌 감지, 클래스 implements까지 계층적 타입 설계를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "interface", "extends", "상속", "다중상속", "계층설계"]
featured: false
draft: false
---

[지난 글](/posts/ts-assertion-functions/)에서 단언 함수를 살펴봤다. 이번에는 `interface extends`를 통한 **계층적 타입 설계**를 다룬다. 객체지향 설계의 상속 개념을 TypeScript 타입 시스템으로 구현하는 핵심 도구다.

## 기본 상속

```typescript
interface Animal {
  name: string;
  age:  number;
}

interface Dog extends Animal {
  breed: string;
  bark(): void;
}

// Dog는 Animal의 모든 필드를 포함
const dog: Dog = {
  name: "바둑이",
  age:  3,
  breed: "진도",
  bark() { console.log("왈!"); }
};
```

`Dog`는 `Animal`의 모든 필드를 자동으로 포함한다. `Dog` 타입의 변수는 `Animal` 타입 매개변수에 전달할 수 있다 — 구조적 타입 호환성.

## 다중 상속

TypeScript `interface`는 클래스와 달리 **여러 인터페이스를 동시에 확장**할 수 있다.

```typescript
interface Serializable {
  serialize():   string;
  deserialize(s: string): void;
}

interface Loggable {
  log(level: "info" | "warn" | "error"): void;
}

interface Identifiable {
  readonly id: string;
}

interface Entity extends Serializable, Loggable, Identifiable {
  createdAt: Date;
  updatedAt: Date;
}
```

![interface 다중 상속](/assets/posts/ts-interface-extends-multiple.svg)

`Entity`는 세 인터페이스의 멤버를 모두 포함한다. 구현 클래스는 이 모든 멤버를 제공해야 한다.

![interface 상속 계층](/assets/posts/ts-interface-extends-hierarchy.svg)

## 충돌 감지

`extends`는 인터섹션(`&`)과 달리 속성 타입 충돌을 즉시 잡아준다.

```typescript
interface A { x: string }
interface B extends A { x: number } // TS2430: 'number'는 'string'에 할당 불가 ❌

// 인터섹션은 충돌을 never로 처리 (에러 없음)
type C = { x: string } & { x: number }; // x: never
```

설계 의도가 "상속"이라면 `extends`가 더 안전하다. 충돌을 컴파일 타임에 잡아주기 때문이다.

## 클래스 implements

클래스가 인터페이스를 구현할 때도 `extends`와 같은 구조를 사용한다.

```typescript
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T):       Promise<T>;
  delete(id: string):    Promise<void>;
}

class UserRepository implements Repository<User> {
  async findById(id: string): Promise<User | null> {
    return db.users.findOne({ id });
  }
  async save(user: User): Promise<User> {
    return db.users.upsert(user);
  }
  async delete(id: string): Promise<void> {
    await db.users.remove({ id });
  }
}
```

`implements`는 클래스가 인터페이스를 구현하는지 컴파일 타임에 검사한다. 메서드 시그니처가 맞지 않으면 즉시 오류가 발생한다.

## 선택적 확장 — extends with Partial

부분 오버라이드가 필요한 경우 `Partial`과 조합할 수 있다.

```typescript
interface BaseConfig {
  host:    string;
  port:    number;
  timeout: number;
}

interface DevConfig extends Partial<BaseConfig> {
  debug: boolean;
}

// DevConfig: { host?: string; port?: number; timeout?: number; debug: boolean }
const dev: DevConfig = { debug: true }; // host, port, timeout은 선택사항
```

## 언제 extends를 쓰는가

`extends`는 "A는 B의 일종이다(is-a)" 관계를 표현할 때 쓴다. `Dog`는 `Animal`의 일종, `AdminUser`는 `User`의 일종. 단순히 필드를 합치는 용도라면 인터섹션(`&`) 또는 별도 인터페이스 선언으로도 충분하다.

---

**지난 글:** [단언 함수 — asserts 키워드와 불변식 검사](/posts/ts-assertion-functions/)

**다음 글:** [인덱스 시그니처 — 동적 키 타입 처리](/posts/ts-index-signatures/)

<br>
읽어주셔서 감사합니다. 😊
