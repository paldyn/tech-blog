---
title: "Record 타입 완전 정복"
description: "TypeScript의 Record<K, V> 유틸리티 타입을 깊이 파헤칩니다. 인덱스 시그니처와의 차이, 리터럴 유니언 키로 완전한 매핑 강제, groupBy·상태 설정 테이블·폼 에러 맵 등 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "유틸리티 타입", "Record", "Mapped Type", "타입 설계"]
featured: false
draft: false
---

[지난 글](/posts/ts-pick-omit/)에서 기존 타입에서 필드를 선택하거나 제거하는 방법을 살펴봤습니다. 이번에는 **새로운 키-값 구조**를 선언할 때 핵심이 되는 `Record<K, V>`를 다룹니다. 단순해 보이지만 리터럴 유니언 키와 결합하면 놀라운 타입 안전성을 제공합니다.

![Record 구조와 활용](/assets/posts/ts-record-type-overview.svg)

## 내부 구현

```typescript
// TypeScript 표준 라이브러리
type Record<K extends keyof any, T> = {
  [P in K]: T;
};
```

`Record`는 `Mapped Type`의 가장 단순한 형태입니다. `K`에 들어온 키 유니언의 각 멤버를 프로퍼티로 갖고, 모든 값이 `T` 타입인 객체 타입을 만들어 냅니다.

## 인덱스 시그니처와 차이

둘 다 키-값 구조를 표현하지만 동작이 다릅니다.

```typescript
// 인덱스 시그니처 — 런타임에 어떤 키든 들어올 수 있음
interface Dict { [key: string]: number }
const d: Dict = {};
d.anything = 1; // OK, 키 제약 없음

// Record — 리터럴 유니언으로 키를 고정할 수 있음
type Scores = Record<"math" | "english" | "science", number>;
const s: Scores = { math: 90 }; // Error: english, science 없음
const s2: Scores = { math: 90, english: 85, science: 92 }; // OK
```

`Record`의 강점은 **K를 리터럴 유니언으로 지정하면 모든 키가 필수**가 된다는 점입니다. 매핑 누락을 컴파일 타임에 잡을 수 있습니다.

## 실전 패턴

![Record 실전 패턴](/assets/posts/ts-record-type-patterns.svg)

### 상태 설정 테이블

enum이나 리터럴 유니언 기반 상태 코드를 UI 설정과 매핑할 때 매우 유용합니다.

```typescript
type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface StatusConfig {
  label: string;
  color: string;
  icon: string;
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  pending:    { label: "대기중",   color: "gray",   icon: "clock" },
  processing: { label: "처리중",  color: "blue",   icon: "gear" },
  shipped:    { label: "배송중",   color: "orange", icon: "truck" },
  delivered:  { label: "배송완료", color: "green",  icon: "check" },
  cancelled:  { label: "취소됨",   color: "red",    icon: "x" },
};

// "refunded"를 OrderStatus에 추가하면 여기서 즉시 컴파일 에러
function getStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_CONFIG[status].label;
}
```

새 상태가 추가되면 설정 테이블 업데이트를 컴파일러가 강제합니다. 런타임 에러가 아닌 컴파일 에러로 잡히기 때문에 안전합니다.

### 라우터 설정 맵

```typescript
type Route = "/home" | "/about" | "/products" | "/cart";

interface RouteConfig {
  title: string;
  requiresAuth: boolean;
  component: React.ComponentType;
}

const routes: Record<Route, RouteConfig> = {
  "/home":     { title: "홈",      requiresAuth: false, component: Home },
  "/about":    { title: "소개",    requiresAuth: false, component: About },
  "/products": { title: "상품",    requiresAuth: false, component: Products },
  "/cart":     { title: "장바구니", requiresAuth: true,  component: Cart },
};
```

### groupBy 유틸리티

```typescript
function groupBy<T, K extends string>(
  items: T[],
  getKey: (item: T) => K
): Partial<Record<K, T[]>> {
  return items.reduce<Partial<Record<K, T[]>>>((acc, item) => {
    const key = getKey(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

// 사용 예
const grouped = groupBy(users, u => u.role);
// grouped.admin → User[] | undefined
```

반환 타입을 `Partial<Record<K, T[]>>`로 하는 이유는, 실제로 어떤 키가 존재할지 런타임에야 알 수 있기 때문입니다. 모든 키를 필수로 하려면 반환 전 모든 키를 초기화해야 합니다.

### 폼 유효성 에러 맵

```typescript
interface LoginForm {
  email: string;
  password: string;
}

type FormErrors<T> = Partial<Record<keyof T, string>>;

const errors: FormErrors<LoginForm> = {
  email: "유효하지 않은 이메일 형식입니다",
};
// password 에러는 없으면 생략 가능 (Partial이므로)
```

`Partial<Record<keyof T, string>>`은 "T의 모든 필드 이름을 키로, 에러 메시지(string)를 값으로 갖는 선택적 맵"을 표현합니다. React Hook Form 등 폼 라이브러리의 에러 타입과 유사한 구조입니다.

## keyof와의 조합

```typescript
// 특정 타입의 모든 키에 대해 boolean 플래그 맵
type DirtyFields<T> = Record<keyof T, boolean>;

// 특정 타입의 모든 키를 string으로 직렬화
type Serialized<T> = Record<keyof T, string>;

// 두 타입의 키를 합쳐서 맵 만들기
type MergedRecord<A, B> = Record<keyof A | keyof B, string>;
```

## 주의사항: 키 타입 제약

`K`는 `keyof any`(= `string | number | symbol`)여야 합니다. 임의의 객체 타입이나 유니언 타입 중 primitive가 아닌 타입은 키로 사용할 수 없습니다.

```typescript
// OK
type A = Record<string, number>;
type B = Record<number, string[]>;
type C = Record<"a" | "b", boolean>;

// Error: User 객체는 키가 될 수 없음
type D = Record<User, string>; // Error
```

또한 `K`가 `string`처럼 넓은 타입이면 모든 string 키에 접근할 수 있지만, 접근 결과가 `V` 타입임을 보장하므로 실제로 없는 키를 접근해도 타입 에러가 나지 않는다는 점을 유의해야 합니다. `noUncheckedIndexedAccess` 컴파일러 옵션을 켜면 이를 `V | undefined`로 좁힐 수 있습니다.

---

**지난 글:** [Pick과 Omit으로 타입 조각내기](/posts/ts-pick-omit/)

**다음 글:** [Extract와 Exclude로 유니언 조각내기](/posts/ts-extract-exclude/)

<br>
읽어주셔서 감사합니다. 😊
