---
title: "인덱스 시그니처 — 동적 키 타입 처리"
description: "TypeScript 인덱스 시그니처(Index Signature)의 string·number 인덱스, Record 유틸리티, 혼합 시그니처, 한계와 대안을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "인덱스시그니처", "index signature", "Record", "동적키", "딕셔너리"]
featured: false
draft: false
---

[지난 글](/posts/ts-interface-extends/)에서 interface extends를 살펴봤다. 이번에는 **인덱스 시그니처(Index Signature)**를 다룬다. 키를 미리 알 수 없는 딕셔너리 형태의 객체를 타입 안전하게 다루는 방법이다.

## 기본 문법

```typescript
// string 인덱스 시그니처
interface StringMap {
  [key: string]: string;
}

const map: StringMap = {};
map["foo"] = "bar";  // OK
map["baz"] = 42;     // TS2322 ❌ number는 string에 할당 불가
```

`[key: string]: ValueType` 형태로 선언한다. `key`는 임의의 이름이고, 실제 제약은 타입이다.

## 숫자 인덱스

```typescript
interface NumberMap {
  [index: number]: string;
}

const arr: NumberMap = ["a", "b", "c"];
arr[0]; // "a"
```

`number` 인덱스는 배열과 비슷하게 작동한다. TypeScript에서 숫자 인덱스는 내부적으로 문자열로 변환되므로, `number` 인덱스 타입은 `string` 인덱스 타입의 서브타입이어야 한다.

## 혼합 시그니처

![인덱스 시그니처 종류](/assets/posts/ts-index-signatures-types.svg)

알려진 키와 동적 키를 동시에 선언할 수 있다.

```typescript
interface MixedConfig {
  host: string;           // 알려진 키
  port: number;           // 알려진 키
  [key: string]: unknown; // 나머지 동적 키
}

// 알려진 키는 인덱스 시그니처 타입의 서브타입이어야 함
// string은 unknown의 서브타입 → OK
// number는 unknown의 서브타입 → OK
```

인덱스 시그니처가 있으면 **알려진 키의 타입이 인덱스 시그니처 값 타입의 서브타입**이어야 한다. 그래서 `[key: string]: string`이면 `port: number`를 추가할 수 없다.

## Record 유틸리티

실무에서는 `Record<K, V>`가 인덱스 시그니처보다 편리하다.

```typescript
// Record<string, number>는 { [key: string]: number }와 동일
const scores: Record<string, number> = {
  alice: 95,
  bob:   87,
};

// 유니언 리터럴로 허용 키 제한
type Status = "active" | "inactive" | "pending";
const counts: Record<Status, number> = {
  active:   10,
  inactive: 5,
  pending:  2,
};
```

![Record와 인덱스 시그니처 패턴](/assets/posts/ts-index-signatures-mapped.svg)

## 한계: 존재하지 않는 키 접근

인덱스 시그니처의 큰 단점은 존재하지 않는 키에 접근해도 `undefined` 대신 선언된 타입을 반환한다는 것이다.

```typescript
const map: Record<string, number> = { a: 1 };
const val = map["b"]; // 타입: number, 실제값: undefined

// 해결: noUncheckedIndexedAccess 옵션
// tsconfig.json: "noUncheckedIndexedAccess": true
// 이 옵션으로 val의 타입이 number | undefined 가 됨
```

`noUncheckedIndexedAccess` 옵션을 활성화하면 인덱스 접근 결과의 타입에 자동으로 `| undefined`가 붙는다.

## Map 대안

키-값 저장소가 필요하다면 `Map<K, V>`도 고려하자.

```typescript
const cache = new Map<string, User>();
cache.set("user-1", { id: "1", name: "Alice" });

const user = cache.get("user-1"); // User | undefined — 정직한 타입
```

`Map`은 존재하지 않는 키에 대해 `undefined`를 명시적으로 반환하므로 `noUncheckedIndexedAccess` 없이도 안전하다.

---

**지난 글:** [interface extends — 계층적 타입 설계](/posts/ts-interface-extends/)

**다음 글:** [readonly와 const 단언 — 불변 타입 설계](/posts/ts-readonly-const-assertions/)

<br>
읽어주셔서 감사합니다. 😊
