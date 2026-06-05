---
title: "명목적 타입과 브랜드 타입 — 의미 있는 타입 구분"
description: "TypeScript 브랜드 타입(Branded Types)으로 명목적 타이핑 구현, 팩토리 함수 검증, unique symbol 패턴, 실전 사용 사례를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "브랜드타입", "branded types", "명목적타입", "타입안전", "유니크심볼"]
featured: false
draft: false
---

[지난 글](/posts/ts-structural-typing/)에서 구조적 타이핑을 살펴봤다. 이번에는 구조적 타이핑의 한계를 극복하는 **브랜드 타입(Branded Types)**을 다룬다. 같은 원시 타입이라도 의미가 다를 때 컴파일러가 구분하도록 만드는 기법이다.

## 문제: 의미가 다른데 같은 타입

```typescript
type UserId  = number;
type OrderId = number;

function getUser(id: UserId): User { /* ... */ }

const orderId: OrderId = 42;
getUser(orderId); // 컴파일 오류 없음 ❌
// UserId와 OrderId는 둘 다 number — TypeScript가 구분 못함
```

구조적 타이핑에서 `type UserId = number`는 단순 별칭이다. `number`와 완전히 호환되므로 `OrderId`를 `UserId` 자리에 넣어도 오류가 없다.

## 브랜드 타입 기본 패턴

![브랜드 타입 패턴](/assets/posts/ts-nominal-branded-types-brand.svg)

인터섹션(`&`)으로 고유한 "브랜드" 필드를 추가한다.

```typescript
type UserId  = number & { _brand: "UserId"  };
type OrderId = number & { _brand: "OrderId" };

function getUser(id: UserId): User { /* ... */ }

const orderId = 42 as OrderId;
getUser(orderId); // TS2345 ❌ OrderId는 UserId에 할당 불가
```

`{ _brand: "UserId" }`는 런타임에 실제로 존재하지 않는다. 컴파일 타임에만 존재하는 가상 필드다. 이 필드 덕에 두 타입이 서로 다른 타입으로 인식된다.

## 팩토리 함수로 타입 안전 생성

브랜드 타입은 직접 `as` 캐스팅하지 않고 팩토리 함수를 통해 생성하는 것이 좋다.

```typescript
function toUserId(n: number): UserId {
  if (n <= 0) throw new RangeError("UserId must be positive");
  return n as UserId;
}

function toOrderId(n: number): OrderId {
  if (n <= 0) throw new RangeError("OrderId must be positive");
  return n as OrderId;
}

// 사용
const uid = toUserId(1);    // UserId
const oid = toOrderId(42);  // OrderId
getUser(uid); // OK ✅
getUser(oid); // TS2345 ❌
```

팩토리 함수에서 검증을 하고 브랜드를 붙이면, 이후 코드에서는 검증된 값임을 타입으로 보장할 수 있다.

## unique symbol 패턴 — 더 강한 브랜딩

```typescript
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & Record<typeof __brand, B>;

type UserId  = Brand<number, "UserId">;
type OrderId = Brand<number, "OrderId">;
```

`unique symbol`을 사용하면 외부에서 브랜드 필드에 직접 접근하기 어렵다. 더 강한 불투명성을 제공한다.

## 실전 사용 사례

![브랜드 타입 실전 패턴](/assets/posts/ts-nominal-branded-types-opaque.svg)

```typescript
// 단위 구분
type Meters  = Brand<number, "Meters">;
type Seconds = Brand<number, "Seconds">;

function speed(dist: Meters, time: Seconds): number {
  return dist / time;
}

const distance = 100 as Meters;
const duration = 10 as Seconds;
speed(duration, distance); // TS2345 ❌ 인수 순서 바꿔도 오류

// 검증된 문자열
type EmailAddress = Brand<string, "EmailAddress">;
function parseEmail(raw: string): EmailAddress {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    throw new Error("Invalid email");
  }
  return raw as EmailAddress;
}

function sendEmail(to: EmailAddress, body: string) { /* ... */ }
const email = parseEmail("user@example.com");
sendEmail(email, "Hello!"); // OK ✅
sendEmail("user@example.com", "Hi"); // TS2345 ❌ — 미검증 문자열
```

## 런타임 오버헤드 없음

브랜드 타입은 컴파일 타임에만 존재한다. JavaScript로 컴파일되면 `_brand` 필드는 사라지고 원시 값만 남는다. 성능 비용이 전혀 없다.

---

**지난 글:** [구조적 타이핑 — TypeScript가 타입을 비교하는 방법](/posts/ts-structural-typing/)

**다음 글:** [초과 프로퍼티 검사 — 객체 리터럴의 엄격한 검사](/posts/ts-excess-property-checks/)

<br>
읽어주셔서 감사합니다. 😊
