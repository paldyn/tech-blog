---
title: "분산성 — 공변·반변·불변과 in/out 어노테이션"
description: "TypeScript의 공변(Covariance), 반변(Contravariance), 불변(Invariance) 개념, 함수 타입에서의 적용, TypeScript 4.7 in/out 분산성 어노테이션을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 3
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "공변", "반변", "분산성", "Variance", "in out", "구조적타입", "고급타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-noinfer-utility/)에서 `NoInfer<T>`로 추론 사이트를 제어하는 방법을 배웠다. 이번에는 TypeScript 타입 시스템의 근간 중 하나인 **분산성(Variance)**을 다룬다. 제네릭 타입이 서브타입 관계를 어떻게 계승하는지, 그리고 TypeScript 4.7에서 추가된 `in`/`out` 어노테이션으로 이를 명시적으로 선언하는 방법을 살펴본다.

## 분산성이란?

`Dog extends Animal`이 참일 때, `Box<Dog> extends Box<Animal>`도 참인가? 그 답이 곧 `Box<T>`의 분산성이다.

- **공변(Covariant)**: 서브타입 관계가 같은 방향으로 유지. `Box<Dog> extends Box<Animal>` ✓
- **반변(Contravariant)**: 서브타입 관계가 역전. `Box<Animal> extends Box<Dog>` ✓
- **불변(Invariant)**: 서브타입 관계 없음. 정확히 같은 타입만 호환.
- **이중변성(Bivariant)**: 양방향 모두 호환 (타입 안전성 완화).

```typescript
class Animal { breathe() {} }
class Dog extends Animal { bark() {} }

// 공변: 읽기 전용 컨테이너
type ReadonlyBox<T> = { readonly value: T };
const box: ReadonlyBox<Animal> = { value: new Dog() }; // ✓ Dog ⊂ Animal

// 불변: 읽기+쓰기 컨테이너
type MutableBox<T> = { value: T };
// const mbox: MutableBox<Animal> = { value: new Dog() }; // ✗ 위험!
// 나중에 mbox.value = new Cat(); 가 가능해지므로
```

## 함수 타입의 분산성

함수 타입은 **반환 타입은 공변, 매개변수 타입은 반변**이 안전하다.

```typescript
type GetAnimal = () => Animal;
type GetDog = () => Dog;

// 반환 타입 공변: Dog를 반환하는 함수는 Animal을 반환하는 위치에 사용 가능
const getAnimal: GetAnimal = () => new Dog(); // ✓

type EatAnimal = (a: Animal) => void;
type EatDog = (d: Dog) => void;

// 매개변수 반변: Animal을 받는 함수는 Dog를 받는 위치에 사용 가능
// (Animal 소비자는 Dog도 소비 가능 — Dog는 Animal의 모든 것을 가짐)
const eatDog: EatDog = (d: Animal) => { d.breathe(); }; // ✓
```

왜 매개변수가 반변이어야 안전한지는 리스코프 치환 원칙으로 이해할 수 있다. `EatDog` 함수가 기대하는 위치에 `EatAnimal`을 사용하면, `Animal`을 받는 함수에 `Dog`를 넘기는 것이므로 항상 안전하다.

![공변·반변·불변 개념](/assets/posts/ts-variance-concept.svg)

## TypeScript의 기본 동작

TypeScript는 기본적으로 함수 매개변수를 **이중변성(bivariant)**으로 처리한다. 이는 역사적 이유에서 비롯된 설계로, 메서드 선언(`method(): void`)은 여전히 이중변성이다.

```typescript
interface Comparator<T> {
  compare(a: T, b: T): number;  // 메서드 선언 → 이중변성
}

type CompareFn<T> = (a: T, b: T) => number;  // 함수 타입 → strictFunctionTypes 시 반변
```

`strict: true` 또는 `strictFunctionTypes: true`를 활성화하면 함수 타입 속성은 매개변수 반변이 적용된다.

## TypeScript 4.7: in/out 분산성 어노테이션

TypeScript 4.7부터 타입 파라미터에 `in`, `out` 키워드로 분산성을 명시할 수 있다.

```typescript
// out: 공변 — T는 출력(반환) 위치에만 사용
interface Provider<out T> {
  get(): T;
}

// in: 반변 — T는 입력(매개변수) 위치에만 사용
interface Acceptor<in T> {
  accept(value: T): void;
}

// in out: 불변 — 읽기+쓰기 모두
interface Transformer<in out T> {
  transform(input: T): T;
}
```

![분산성 어노테이션 in/out](/assets/posts/ts-variance-annotations.svg)

어노테이션의 이점은 두 가지다.

1. **명시적 의도**: 해당 타입이 어떤 방식으로 T를 사용하는지 코드에서 드러난다.
2. **성능 최적화**: 컴파일러가 분산성을 직접 계산하지 않고 어노테이션을 신뢰하므로 대형 타입 체계에서 빠르다.

어노테이션이 실제 사용 패턴과 맞지 않으면 컴파일 오류가 발생한다.

```typescript
interface Bad<out T> {
  // ✗ 오류: out 선언했는데 T가 입력 위치에 사용됨
  // set(value: T): void;
}
```

## 공변/반변 규칙이 실전에서 중요한 이유

```typescript
// 콜백 배열 예시
type Handler<T> = (event: T) => void;

const mouseHandlers: Handler<MouseEvent>[] = [];
const eventHandlers: Handler<Event>[] = mouseHandlers;
// ✗ 위험: mouseHandlers를 eventHandlers로 쓰면
//   eventHandlers.push((e: Event) => ...)가 가능해짐
//   실제로는 MouseEvent를 기대하는 핸들러가 Event를 받게 됨

// ReadonlyArray는 공변
const dogs: readonly Dog[] = [new Dog()];
const animals: readonly Animal[] = dogs; // ✓ 안전 (읽기만 가능)
```

## 분산성과 유니언

유니언에 분산되는(distributive) 조건부 타입과는 다른 개념이지만, 유니언 타입도 분산성과 연결된다.

```typescript
// 공변 위치: 유니언이 확장될 수 있음
type F<T> = () => T;
type FDogOrCat = F<Dog | Cat>;
// FDogOrCat = () => Dog | () => Cat 으로 분해되지 않음
// F<Dog | Cat> = () => Dog | Cat 자체

// 반변 위치: 유니언이 교차로 변환
type G<T> = (x: T) => void;
// G<Dog | Cat>는 (x: Dog | Cat) => void
// Dog를 받는 G에 넣으려면 더 넓은 타입 필요 → 반변
```

## 핵심 정리

분산성은 제네릭 타입의 서브타입 관계 계승 방향을 결정한다. 공변(out 위치)은 서브타입 방향 유지, 반변(in 위치)은 역전, 불변(in+out)은 호환 없음이다. 함수의 반환 타입은 공변, 매개변수는 반변이 안전하다. TypeScript 4.7의 `in`/`out` 어노테이션으로 분산성을 명시해 의도를 명확히 하고 컴파일 성능을 높일 수 있다.

---

**지난 글:** [NoInfer 유틸리티 — 제네릭 추론 사이트 제어](/posts/ts-noinfer-utility/)

**다음 글:** [매핑된 타입 수정자 — +/- readonly와 optional 제어](/posts/ts-mapped-type-modifiers/)

<br>
읽어주셔서 감사합니다. 😊
