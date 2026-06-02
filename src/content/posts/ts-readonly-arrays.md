---
title: "읽기 전용 배열 — ReadonlyArray와 readonly 수식어 완전 정리"
description: "TypeScript의 readonly T[], ReadonlyArray<T> 문법을 비교하고, 불변 배열이 함수 파라미터 설계와 부작용 방지에 어떻게 활용되는지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "ReadonlyArray", "불변성", "readonly", "배열타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-array-types/)에서 TypeScript의 기본 배열 타입 선언 문법을 정리했다. 이번에는 배열의 **불변성(immutability)**을 타입 시스템으로 보장하는 `readonly` 수식어와 `ReadonlyArray<T>`를 다룬다. 함수 파라미터를 읽기 전용으로 선언하거나 원본 데이터를 보호해야 하는 상황에서 이 타입들을 어떻게 활용하는지 완전히 정리한다.

![가변 배열 vs 읽기 전용 배열](/assets/posts/ts-readonly-arrays-compare.svg)

## readonly 수식어와 ReadonlyArray<T>

TypeScript에서 읽기 전용 배열을 선언하는 방법은 두 가지다.

```typescript
// 방법 1: readonly 수식어
const a: readonly string[] = ['x', 'y', 'z'];

// 방법 2: ReadonlyArray<T> 제네릭
const b: ReadonlyArray<string> = ['x', 'y', 'z'];
```

두 표현은 완전히 동일한 타입이다. TypeScript 컴파일러는 두 선언을 같은 방식으로 처리하며, 오류 메시지에도 동일하게 표시된다. 현재 TypeScript 커뮤니티와 공식 권장 사항은 `readonly T[]` 문법을 선호한다. `ReadonlyArray<T>`는 제네릭 코드에서 가독성이 필요한 경우에 적합하다.

읽기 전용 배열로 선언하면 배열을 변형하는 모든 메서드가 타입 오류를 발생시킨다.

```typescript
const nums: readonly number[] = [1, 2, 3];

// 변형 메서드 — 모두 컴파일 오류
nums.push(4);       // Error: Property 'push' does not exist
nums.pop();         // Error: Property 'pop' does not exist
nums.splice(0, 1);  // Error: Property 'splice' does not exist
nums.sort();        // Error: Property 'sort' does not exist
nums[0] = 99;       // Error: Index signature only permits reading

// 읽기 전용 메서드 — 정상 동작
const len = nums.length;          // OK
const first = nums[0];            // OK
const found = nums.includes(2);   // OK
const mapped = nums.map(n => n * 2); // OK — 새 배열 반환
```

`map`, `filter`, `reduce`, `slice` 같이 **새 배열을 반환**하는 메서드는 원본을 수정하지 않으므로 읽기 전용 배열에서도 정상적으로 사용할 수 있다.

## 가변 배열과의 호환성

읽기 전용 배열과 가변 배열 사이의 할당 호환성은 단방향이다.

```typescript
const mutable: number[] = [1, 2, 3];
const frozen: readonly number[] = [1, 2, 3];

// 가변 → 읽기 전용: OK (더 좁은 권한으로 이동)
const ro: readonly number[] = mutable;

// 읽기 전용 → 가변: Error (더 넓은 권한으로 이동 불가)
const mut: number[] = frozen;
// Error: The type 'readonly number[]' is 'readonly'
// and cannot be assigned to the mutable type 'number[]'.
```

이 규칙은 타입 안전성의 핵심이다. 가변 배열을 읽기 전용으로 좁히는 것은 항상 안전하지만, 역방향은 허용하지 않는다. 읽기 전용 배열을 가변 배열에 할당하면 우회 수정이 가능해지기 때문이다.

만약 읽기 전용 배열을 가변 배열로 변환해야 한다면 스프레드 연산자나 `Array.from`으로 새 배열을 만드는 것이 올바른 패턴이다.

```typescript
const frozen: readonly number[] = [1, 2, 3];

// 새 가변 배열 복사 — 안전한 변환
const copy1: number[] = [...frozen];
const copy2: number[] = Array.from(frozen);
```

## 함수 파라미터에서의 활용

`readonly` 배열이 가장 강력하게 빛나는 곳은 함수 파라미터다. 파라미터를 `readonly`로 선언하면 함수 계약에 "이 함수는 원본 배열을 수정하지 않는다"는 의미가 타입으로 명시된다.

```typescript
// 파라미터를 readonly로 선언 — 원본 보호
function sum(nums: readonly number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function first<T>(arr: readonly T[]): T | undefined {
  return arr[0];
}

// 가변 배열을 readonly 파라미터에 넘겨도 OK
const scores = [85, 92, 78];
const total = sum(scores); // scores는 수정되지 않음이 보장됨
```

함수 파라미터를 `readonly`로 선언하면 두 가지 이점이 생긴다.

첫째, **함수 내부에서 실수로 원본을 수정하는 버그**를 컴파일 타임에 방지한다. 팀원이 나중에 함수 본문에 `nums.push(...)` 를 추가하려 하면 즉시 오류가 발생한다.

둘째, **호출자 입장에서 안심하고 원본을 넘길 수 있다**. 가변 배열을 `readonly` 파라미터에 전달해도 타입 오류가 없으므로, 불필요한 복사 없이 함수를 호출할 수 있다.

![ReadonlyArray 활용 패턴](/assets/posts/ts-readonly-arrays-patterns.svg)

## as const와의 관계

`as const`를 사용하면 배열이 **리터럴 튜플 타입**으로 좁혀지며 자동으로 읽기 전용이 된다.

```typescript
// as const — 리터럴 튜플 타입으로 추론
const colors = ['red', 'green', 'blue'] as const;
// 타입: readonly ["red", "green", "blue"]

// readonly number[]와의 차이
const nums = [1, 2, 3] as const;
// 타입: readonly [1, 2, 3] — 원소 값까지 리터럴로 좁혀짐

const arr: readonly number[] = [1, 2, 3];
// 타입: readonly number[] — 원소는 number 타입

// as const 배열은 union 타입 추출에 유용
type Color = typeof colors[number]; // "red" | "green" | "blue"
```

`as const`는 단순히 읽기 전용만 만드는 것이 아니라 원소 타입까지 리터럴로 좁힌다는 점이 `readonly T[]`와의 차이다. 고정된 선택지 목록을 정의하고 그로부터 유니언 타입을 만들 때 `as const` 패턴이 유용하다.

## 실전 사용 패턴

프로젝트에서 자주 쓰이는 패턴을 정리한다.

```typescript
// 상수 목록 정의 — as const로 리터럴 유니언 생성
const STATUSES = ['pending', 'active', 'closed'] as const;
type Status = typeof STATUSES[number]; // "pending" | "active" | "closed"

// 불변 설정 객체 내 배열
interface Config {
  readonly allowedOrigins: readonly string[];
}

// 공개 API — 파라미터 readonly로 계약 명시
function processItems<T>(
  items: readonly T[],
  transform: (item: T) => T
): T[] {
  return items.map(transform); // map은 새 배열 반환 — OK
}

// 읽기 전용 배열을 가변으로 복사 후 정렬
function sortedCopy(nums: readonly number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}
```

마지막 `sortedCopy` 패턴이 특히 중요하다. `Array.prototype.sort`는 원본을 변경하는 메서드이므로 `readonly` 배열에 직접 호출할 수 없다. 스프레드로 복사한 뒤 정렬하는 것이 올바른 패턴이다. ES2023부터는 `toSorted()`, `toReversed()`, `toSpliced()` 같은 **비변형(non-mutating) 버전**이 추가됐으므로, TypeScript 5.2 이상 환경이라면 이쪽을 활용하는 것도 좋다.

---

**지난 글:** [배열 타입 완전 정리 — T[]와 Array<T> 문법부터 실전까지](/posts/ts-array-types/)

**다음 글:** [튜플 타입 — 고정 길이 이종 배열의 완전 정복](/posts/ts-tuple-types/)

<br>
읽어주셔서 감사합니다. 😊
