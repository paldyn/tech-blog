---
title: "type-challenges 입문 — 타입 레벨 프로그래밍 연습"
description: "type-challenges 저장소로 타입 레벨 프로그래밍을 연습하는 법을 정리합니다. 타입을 함수처럼 다루는 사고방식, MyPick·First·Length 같은 입문 문제 풀이, 그리고 conditional·infer·재귀를 조합하는 패턴까지 소개합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "type-challenges", "타입레벨", "제네릭", "infer", "조건부타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-build-performance/)에서 빌드 성능을 다뤘다. 이번 글부터는 TypeScript의 가장 흥미로운 영역, **타입 레벨 프로그래밍**에 들어간다. 좋은 출발점이 바로 [type-challenges](https://github.com/type-challenges/type-challenges) 저장소다. 작은 타입 퍼즐을 풀면서 제네릭·조건부 타입·`infer`·재귀를 자연스럽게 익힐 수 있다. 이 글은 그 사고방식의 첫걸음을 안내한다.

## 타입을 함수처럼 생각하기

핵심 발상은 "**제네릭 타입은 타입을 입력받아 타입을 반환하는 함수**"라는 것이다. 값의 세계에서 함수가 `(x) => ...`라면, 타입의 세계에서는 `type F<T> = ...`가 함수다. 입력은 타입 매개변수, 분기는 조건부 타입, 반복은 재귀로 표현한다.

```typescript
// 값 함수: 인자를 받아 값을 반환
const double = (n: number) => n * 2;

// 타입 함수: 타입을 받아 타입을 반환
type Double<T> = [T, T]; // T를 받아 길이 2 튜플 타입을 반환
```

이 대응 관계를 머릿속에 깔아 두면, 타입 퍼즐이 "특이한 문법"이 아니라 "타입으로 짜는 프로그램"으로 보이기 시작한다.

![타입 레벨 프로그래밍 사고](/assets/posts/ts-type-challenges-intro-flow.svg)

## 첫 문제: MyPick 구현하기

type-challenges의 입문 문제 중 하나는 내장 유틸리티 `Pick<T, K>`를 직접 구현하는 것이다. `T`에서 키 `K`에 해당하는 속성만 골라 새 객체 타입을 만든다.

```typescript
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};

interface Todo {
  title: string;
  done: boolean;
  priority: number;
}

type TodoPreview = MyPick<Todo, "title" | "done">;
// { title: string; done: boolean }
```

여기에 두 가지 도구가 쓰였다. `K extends keyof T`는 "`K`는 반드시 `T`의 키여야 한다"는 **제약**이고, `[P in K]`는 유니온 `K`를 순회하며 키를 만드는 **매핑 타입**이다. `T[P]`는 인덱스 접근으로 원래 속성의 타입을 가져온다.

![첫 챌린지: MyPick 구현](/assets/posts/ts-type-challenges-intro-code.svg)

## 튜플을 다루기: First와 Length

배열·튜플 조작은 타입 퍼즐의 단골이다. 튜플의 첫 요소를 뽑는 `First`와 길이를 구하는 `Length`를 보자.

```typescript
type First<T extends any[]> = T extends [infer F, ...any[]] ? F : never;

type A = First<[3, 2, 1]>; // 3
type B = First<[]>;        // never (빈 배열)

type Length<T extends readonly any[]> = T["length"];

type L = Length<["a", "b", "c"]>; // 3
```

`First`는 조건부 타입과 `infer`의 조합이다. `T`가 `[F, ...]` 형태에 맞으면 첫 요소를 `F`로 **추론**해 반환하고, 빈 배열이면 `never`를 준다. `Length`는 튜플 타입의 `length` 속성이 리터럴 숫자라는 점을 이용한다.

## 조건부 + 재귀로 확장하기

더 어려운 문제들은 조건부 타입과 재귀를 엮는다. 예를 들어 유니온의 각 멤버에 무언가를 적용하거나, 튜플을 하나씩 줄여 가며 처리한다. 간단한 재귀 예로 튜플을 뒤집는 `Reverse`를 보자.

```typescript
type Reverse<T extends any[]> =
  T extends [infer Head, ...infer Rest]
    ? [...Reverse<Rest>, Head]
    : [];

type R = Reverse<[1, 2, 3]>; // [3, 2, 1]
```

머리(`Head`)와 나머지(`Rest`)를 분리하고, 나머지를 먼저 뒤집은 뒤 머리를 끝에 붙인다. 빈 튜플에 도달하면 재귀가 멈춘다. 값 세계의 재귀 함수와 구조가 똑같다.

## 어떻게 연습할까

처음에는 난이도 `easy`부터 푼다. 막히면 정답을 보되, **왜** 그렇게 동작하는지 한 줄씩 손으로 추론해 보는 것이 중요하다. VS Code에서 타입 위에 마우스를 올리면 중간 결과가 보이므로, 작은 입력으로 `// ^?` 주석을 달아 단계별로 확인하면 학습 효율이 높다.

```typescript
type Step = Reverse<[1, 2]>;
//   ^? [2, 1]  — 에디터에서 즉시 확인
```

type-challenges는 타입 시스템을 "읽을 줄 아는" 단계에서 "쓸 줄 아는" 단계로 넘어가게 해 주는 가장 좋은 훈련장이다. 다음 글에서는 그 도구 중에서도 까다롭기로 유명한 `UnionToIntersection` — 유니온을 인터섹션으로 바꾸는 타입을 정면으로 파헤친다.

---

**지난 글:** [TypeScript 빌드 성능 최적화 — 컴파일 속도 끌어올리기](/posts/ts-build-performance/)

**다음 글:** [UnionToIntersection — 유니온을 인터섹션으로 변환하기](/posts/ts-union-to-intersection/)

<br>
읽어주셔서 감사합니다. 😊
