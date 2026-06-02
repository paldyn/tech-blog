---
title: "객체 타입 완전 정리 — 프로퍼티·옵셔널·인덱스 시그니처"
description: "TypeScript 객체 타입의 인라인 선언, type 별칭, 옵셔널 프로퍼티, readonly, 인덱스 시그니처를 실전 예제와 함께 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "객체타입", "옵셔널프로퍼티", "인덱스시그니처", "readonly"]
featured: false
draft: false
---

[지난 글](/posts/ts-variadic-tuples/)에서 가변 인자 튜플을 살펴봤다. 이번 글에서는 TypeScript에서 가장 자주 사용하는 구성 요소인 **객체 타입**을 완전히 정리한다. 인라인 선언부터 `type` 별칭, 옵셔널 프로퍼티, `readonly`, 인덱스 시그니처, 중첩 객체까지 단계별로 다룬다.

## 객체 타입 선언 방법

![객체 타입 선언 방법](/assets/posts/ts-object-types-syntax.svg)

객체 타입을 선언하는 방법은 크게 두 가지다: **인라인 객체 타입**과 **`type` 별칭**이다.

### 인라인 객체 타입

변수를 선언할 때 바로 객체 형태를 기술하는 방식이다.

```typescript
const user: { name: string; age: number } = {
  name: "Alice",
  age: 30,
};
```

간단한 일회성 타입에는 편리하지만, 타입을 재사용할 수 없고 코드가 길어지면 가독성이 떨어진다.

### type 별칭

`type` 키워드를 사용하면 이름을 붙여 재사용할 수 있다.

```typescript
type User = {
  name: string;
  age: number;
  email?: string;       // 옵셔널 프로퍼티
  readonly id: number;  // 읽기 전용 프로퍼티
};

const alice: User = { name: "Alice", age: 30, id: 1 };
const bob: User = { name: "Bob", age: 25, id: 2, email: "bob@example.com" };
```

`type` 별칭은 함수 시그니처, 유니언 타입, 교차 타입 등 복잡한 타입에도 사용할 수 있어 범용성이 높다.

## 옵셔널 프로퍼티 (?)

프로퍼티 이름 뒤에 `?`를 붙이면 해당 프로퍼티는 있어도 되고 없어도 된다. 타입은 `T | undefined`로 확장된다.

```typescript
type Config = {
  host: string;
  port?: number;    // port는 number | undefined
  timeout?: number;
};

const minimal: Config = { host: "localhost" };
const full: Config = { host: "localhost", port: 8080, timeout: 5000 };

// 옵셔널 프로퍼티 접근 시 undefined 체크 필요
function getPort(cfg: Config): number {
  return cfg.port ?? 3000; // nullish coalescing으로 기본값 제공
}
```

옵셔널 프로퍼티를 읽을 때는 항상 `undefined` 가능성을 고려해야 한다. optional chaining(`?.`)이나 nullish coalescing(`??`)을 활용하자.

## readonly 프로퍼티

`readonly` 수식어를 붙이면 객체 생성 시 이후에는 해당 프로퍼티를 변경할 수 없다.

```typescript
type Point = {
  readonly x: number;
  readonly y: number;
};

const origin: Point = { x: 0, y: 0 };
// origin.x = 10; // 오류: Cannot assign to 'x' because it is a read-only property.

// 배열에도 적용 가능
type UserRecord = {
  readonly id: number;
  name: string;
  readonly createdAt: Date;
};

const user: UserRecord = {
  id: 1,
  name: "Alice",
  createdAt: new Date(),
};

user.name = "Alicia"; // 허용 — readonly 아님
// user.id = 2;       // 오류 — readonly
```

`readonly`는 **얕은(shallow) 불변성**만 보장한다. 프로퍼티가 객체 타입이라면 그 내부는 여전히 변경 가능하다.

```typescript
type Team = {
  readonly members: string[];
};

const team: Team = { members: ["Alice"] };
// team.members = []; // 오류 — members 자체는 변경 불가
team.members.push("Bob"); // 허용 — members 내부는 변경 가능
```

완전한 불변성이 필요하다면 `Readonly<T>` 유틸리티 타입이나 `as const`를 함께 사용한다.

## 인덱스 시그니처

![인덱스 시그니처](/assets/posts/ts-object-types-index.svg)

키가 동적으로 결정되는 객체를 표현할 때 **인덱스 시그니처**를 사용한다.

```typescript
type StringMap = {
  [key: string]: string;
};

const env: StringMap = {};
env["NODE_ENV"] = "production";
env["PORT"] = "3000";
env["VERSION"] = "1.0.0";
```

인덱스 시그니처와 구체적인 프로퍼티를 함께 선언할 수 있다. 단, 구체적인 프로퍼티의 타입은 인덱스 시그니처의 값 타입에 **할당 가능**해야 한다.

```typescript
type NumberRecord = {
  [key: string]: number;
  length: number;   // 허용: number는 number에 할당 가능
  // name: string;  // 오류: string은 number에 할당 불가
};
```

인덱스 시그니처는 편리하지만 타입 안전성이 낮아진다. 키 집합이 미리 알려진 경우에는 **`Record<K, V>` 유틸리티 타입**을 사용하는 편이 더 안전하다.

```typescript
// Record<K, V> — 키 집합이 정해진 경우 더 안전
type Status = "pending" | "active" | "closed";
type StatusMap = Record<Status, number>;

const counts: StatusMap = {
  pending: 3,
  active: 10,
  closed: 2,
};
```

## 중첩 객체 타입

객체 타입 안에 객체 타입을 중첩할 수 있다.

```typescript
type Address = {
  street: string;
  city: string;
  zipCode: string;
};

type Person = {
  name: string;
  age: number;
  address: Address; // 중첩 객체
};

const alice: Person = {
  name: "Alice",
  age: 30,
  address: {
    street: "123 Main St",
    city: "Seoul",
    zipCode: "04524",
  },
};
```

인라인으로도 중첩할 수 있지만, `Address`처럼 별도 타입으로 분리하면 재사용성이 높아진다.

```typescript
// 서버 설정 타입 — 실전 패턴
type DatabaseConfig = {
  host: string;
  port: number;
  name: string;
  credentials: {
    user: string;
    password: string;
  };
};

type AppConfig = {
  server: {
    host: string;
    port: number;
  };
  database: DatabaseConfig;
  features: {
    darkMode: boolean;
    analytics: boolean;
  };
};
```

중첩이 깊어질수록 타입 선언이 복잡해진다. 깊이 3단계 이상이면 각 레벨을 별도 타입으로 추출하는 것을 권장한다.

## 객체 타입과 인터페이스의 차이

`type`과 `interface` 모두 객체 타입을 선언할 수 있다. 실용적인 차이를 정리하면 다음과 같다.

```typescript
// interface: 선언 병합(Declaration Merging) 지원
interface Animal {
  name: string;
}
interface Animal {
  age: number; // 기존 Animal에 병합됨
}
// Animal = { name: string; age: number }

// type: 선언 병합 불가 — 교차 타입으로 확장
type Vehicle = {
  make: string;
};
type ElectricVehicle = Vehicle & {
  batteryRange: number;
};
```

일반적인 가이드라인:
- **공개 라이브러리 API**, **클래스와 함께 사용**: `interface` 선호 (확장·병합에 유리)
- **유니언, 교차, 튜플, 복잡한 타입 조합**: `type` 선호
- **팀 내 일관성이 가장 중요** — 하나를 골라 통일하는 것이 최선

## 정리

객체 타입의 핵심을 요약하면:

- 인라인 타입은 일회성 용도에, `type` 별칭은 재사용에 사용한다.
- `?`로 옵셔널 프로퍼티를 표현하고, 접근 시 항상 `undefined` 처리를 한다.
- `readonly`는 얕은 불변성만 보장한다. 깊은 불변성이 필요하면 `Readonly<T>` 또는 `as const`를 사용한다.
- 인덱스 시그니처는 편리하지만 타입 안전성이 낮다. 키 집합이 알려진 경우 `Record<K, V>`를 검토한다.
- 중첩 구조가 깊어지면 타입을 레벨별로 분리하여 가독성을 높인다.

---

**지난 글:** [가변 인자 튜플 — 스프레드와 추론으로 복잡한 타입 다루기](/posts/ts-variadic-tuples/)

**다음 글:** [열거형 완전 정리 — 숫자·문자열·이종 enum 사용 가이드](/posts/ts-enum-types/)

<br>
읽어주셔서 감사합니다. 😊
