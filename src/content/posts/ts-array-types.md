---
title: "배열 타입 완전 정리 — T[]와 Array<T> 문법부터 실전까지"
description: "TypeScript 배열 타입의 두 가지 선언 문법(T[]와 Array<T>)을 비교하고, 읽기 전용 배열, 다차원 배열, 배열 메서드 타입 추론까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "배열타입", "Array", "제네릭", "타입안전성"]
featured: false
draft: false
---

[지난 글](/posts/ts-unknown-never-any/)에서 unknown, never, any라는 특수 타입을 살펴봤다. 이번에는 TypeScript에서 가장 자주 쓰이는 자료구조인 **배열 타입**을 다룬다. 기초처럼 보이지만 `T[]`와 `Array<T>` 두 문법의 차이, 다차원 배열 표현, 메서드 타입 추론, 그리고 `readonly` 수식어까지 한 번에 정리하면 일상적인 TypeScript 작성이 훨씬 명확해진다.

![배열 타입 선언 방법 비교](/assets/posts/ts-array-types-syntax.svg)

## T[]와 Array<T> — 두 문법의 차이

TypeScript는 배열 타입을 표현하는 두 가지 문법을 제공한다.

```typescript
// T[] — 배열 리터럴 문법
const nums: number[] = [1, 2, 3];
const strs: string[] = ['hello', 'world'];

// Array<T> — 제네릭 문법
const nums2: Array<number> = [1, 2, 3];
const strs2: Array<string> = ['hello', 'world'];
```

두 표현은 **완전히 동일한 타입**을 나타낸다. 컴파일러는 두 문법을 구분하지 않으며, 타입 오류 메시지에도 동일하게 표시된다.

그렇다면 어떤 것을 써야 할까? 실제로 TypeScript 공식 코드베이스, Angular, React 생태계 모두 `T[]` 문법을 선호하는 경향이 강하다. 가독성이 높고 타이핑이 짧기 때문이다. 단, `Array<T>` 문법이 자연스러운 경우가 있다. 유니언 타입을 배열 원소로 쓸 때가 그 예다.

```typescript
// 유니언 타입 배열 — Array<T>가 더 가독성이 좋을 수 있다
const mixed: Array<number | string> = [1, 'two', 3];

// T[] 문법으로 쓰면 괄호가 필요해 복잡해 보인다
const mixed2: (number | string)[] = [1, 'two', 3];
```

유니언 원소처럼 타입 표현이 복잡해질 때는 `Array<T>`가 더 읽기 쉽다. 팀 컨벤션을 하나로 통일하되, 복잡한 원소 타입에서는 예외를 두는 방식이 실용적이다.

## 다차원 배열과 제네릭 중첩

배열 안에 배열을 담는 2차원 이상의 구조도 동일한 두 문법으로 표현한다.

```typescript
// 2차원 배열 — 숫자 행렬
const matrix: number[][] = [
  [1, 2, 3],
  [4, 5, 6],
];

// Array<T> 중첩 표현
const matrix2: Array<Array<number>> = [
  [1, 2, 3],
  [4, 5, 6],
];

// 3차원 배열
const cube: number[][][] = [[[1, 2], [3, 4]]];
```

`T[][]` 표현은 직관적이지만 3차원 이상이 되면 `[][][]`가 눈에 잘 들어오지 않는다. 그런 경우에는 타입 별칭을 만들어 가독성을 높이는 것이 좋다.

```typescript
type Row = number[];
type Matrix = Row[];

const data: Matrix = [[1, 2], [3, 4]];
```

## 배열 메서드의 타입 추론

TypeScript는 배열 메서드의 반환 타입을 원소 타입에서 자동으로 추론한다. 이 덕분에 명시적 타입 어노테이션 없이도 타입 안전성이 유지된다.

```typescript
const scores: number[] = [85, 92, 78, 95];

// map — 원소 타입 그대로 유지
const doubled = scores.map(s => s * 2);
// 타입 추론: number[]

// filter — 원소 타입 유지, 길이만 줄어듦
const passing = scores.filter(s => s >= 80);
// 타입 추론: number[]

// find — 원소 타입 | undefined
const first = scores.find(s => s > 90);
// 타입 추론: number | undefined

// reduce — 초기값 타입이 결과 타입 결정
const total = scores.reduce((acc, cur) => acc + cur, 0);
// 타입 추론: number

// reduce로 타입 변환
const result = scores.reduce<Record<number, boolean>>(
  (acc, cur) => ({ ...acc, [cur]: cur >= 80 }),
  {}
);
// 타입 추론: Record<number, boolean>
```

![타입 안전한 배열 조작](/assets/posts/ts-array-types-methods.svg)

`reduce`에서 초기값의 타입이 누산기 타입을 결정하므로, 초기값을 `[]`나 `{}`로 줄 때는 제네릭 인자를 명시해야 올바른 타입을 얻을 수 있다.

## readonly 배열 미리보기

배열 타입 앞에 `readonly` 수식어를 붙이면 읽기 전용 배열이 된다. 변형 메서드(`push`, `pop`, `splice` 등)를 호출하면 컴파일 오류가 발생한다.

```typescript
const frozen: readonly number[] = [1, 2, 3];

frozen.push(4);   // 오류: Property 'push' does not exist
frozen[0] = 99;   // 오류: Index signature in type 'readonly number[]' only permits reading
```

`ReadonlyArray<T>`와 `readonly T[]`는 동일한 타입이다. 함수 파라미터를 `readonly`로 선언하면 함수 내부에서 원본 배열을 수정할 수 없다는 계약을 타입 시스템으로 강제한다. 다음 글에서 `readonly` 배열을 더 자세히 다룬다.

## 실전 패턴

실제 프로젝트에서 자주 쓰이는 배열 타입 패턴을 정리하면 다음과 같다.

```typescript
// 빈 배열 초기화 — 타입 명시 필수
const items: string[] = [];
// const items = []; → any[]로 추론되어 타입 안전성 없음

// 튜플과의 구분
const pair: [number, string] = [1, 'one']; // 튜플 — 길이 고정
const nums: number[] = [1, 2, 3];          // 배열 — 길이 가변

// 함수 반환 타입 명시
function getIds(users: { id: number }[]): number[] {
  return users.map(u => u.id);
}

// 제네릭 함수 — 배열 타입 활용
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const n = first([1, 2, 3]); // 타입 추론: number | undefined
const s = first(['a', 'b']); // 타입 추론: string | undefined
```

빈 배열을 초기화할 때 타입을 명시하지 않으면 `any[]`가 되어 타입 안전성이 사라진다. 이 점을 항상 주의해야 한다. ESLint의 `@typescript-eslint/no-unsafe-assignment` 규칙이 이 패턴을 잡아준다.

---

**지난 글:** [unknown · never · any — 타입 계층의 끝점들](/posts/ts-unknown-never-any/)

**다음 글:** [읽기 전용 배열 — ReadonlyArray와 readonly 수식어 완전 정리](/posts/ts-readonly-arrays/)

<br>
읽어주셔서 감사합니다. 😊
