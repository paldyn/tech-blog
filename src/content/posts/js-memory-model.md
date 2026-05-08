---
title: "메모리 모델 — 힙·스택·참조의 구조"
description: "JavaScript 엔진이 값을 스택과 힙에 나눠 저장하는 방식, 원시값과 참조 타입의 차이, 그리고 변수 할당 시 실제로 무슨 일이 일어나는지를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "메모리모델", "스택", "힙", "참조타입", "원시값", "GC"]
featured: false
draft: false
---

[지난 글](/posts/js-unhandled-rejection/)에서 미처리 Promise rejection을 전역적으로 감지하는 방법을 다뤘습니다. 이번에는 한 단계 아래로 내려가 JavaScript 엔진이 값을 **어디에, 어떻게** 저장하는지 살펴봅니다. 메모리 모델을 이해하면 클로저 누수, 객체 공유 버그, GC 최적화를 훨씬 명확하게 파악할 수 있습니다.

## 두 가지 저장 공간: 스택과 힙

JavaScript 엔진은 메모리를 크게 **Call Stack(콜 스택)** 과 **Heap(힙)** 으로 나눠 사용합니다.

| 구분 | 스택(Stack) | 힙(Heap) |
|------|-------------|----------|
| 저장 대상 | 원시값, 참조(주소) | 객체, 배열, 함수 |
| 크기 | 고정(컴파일 타임 예측) | 가변(런타임 결정) |
| 속도 | 빠름 | 상대적으로 느림 |
| 관리 | 자동(함수 반환 시 즉시 해제) | GC가 관리 |

스택은 함수가 호출될 때마다 프레임(frame)을 쌓고, 반환되면 즉시 제거합니다. 힙은 동적으로 할당되며, 더 이상 참조하는 변수가 없을 때 가비지 컬렉터가 회수합니다.

![JavaScript 메모리 모델 — 스택과 힙](/assets/posts/js-memory-model-stack-heap.svg)

## 원시값(Primitive) — 값이 직접 스택에 들어간다

```js
let a = 42;
let b = a; // 42라는 값이 복사됨
b = 100;

console.log(a); // 42 — a는 영향 없음
console.log(b); // 100
```

`number`, `string`, `boolean`, `null`, `undefined`, `symbol`, `bigint` — 7가지 원시 타입은 모두 **스택에 값 자체가 저장**됩니다. `b = a`는 값을 복사하므로 이후 `b`를 바꿔도 `a`는 변하지 않습니다.

원시값은 **불변(immutable)** 입니다. 문자열 `"hello"`는 변경이 불가능하고, `"hello" + " world"`는 새 문자열 객체를 힙에 생성합니다.

## 참조 타입(Reference Type) — 주소가 스택에 들어간다

```js
const obj1 = { x: 1 };
const obj2 = obj1; // 힙 주소(참조)가 복사됨

obj2.x = 99;

console.log(obj1.x); // 99 — 같은 객체를 공유!
console.log(obj1 === obj2); // true — 동일 참조
```

`Object`, `Array`, `Function`은 **힙에 실제 데이터가 저장**되고, 변수에는 그 힙 주소(참조)가 저장됩니다. 따라서 `obj2 = obj1`을 하면 주소가 복사되어 두 변수가 **같은 객체**를 가리킵니다. 한 쪽에서 프로퍼티를 수정하면 다른 쪽에도 반영됩니다.

![참조 타입 — 변수는 주소를 공유한다](/assets/posts/js-memory-model-reference.svg)

## const는 참조를 고정한다

```js
const arr = [1, 2, 3];
arr.push(4);       // OK — 힙 내부 데이터 변경
console.log(arr);  // [1, 2, 3, 4]

arr = [5, 6]; // TypeError — const는 재할당(참조 변경) 불가
```

`const`는 변수 바인딩 자체(스택의 주소 값)를 변경하지 못하게 할 뿐입니다. 힙 내부 데이터는 얼마든지 바꿀 수 있습니다. 진정한 불변 객체가 필요하면 `Object.freeze()`를 써야 합니다.

## 함수 호출과 스택 프레임

```js
function add(a, b) {
  return a + b; // 반환 시 프레임이 스택에서 제거됨
}

function main() {
  const x = 10;
  const y = 20;
  const result = add(x, y); // add 프레임이 쌓임
  console.log(result); // 30
}

main(); // main 프레임이 쌓임 → add 프레임이 쌓임 → 순차 제거
```

`main()`이 호출되면 스택에 main 프레임이 생성되고, 내부에서 `add()`를 호출하면 add 프레임이 그 위에 쌓입니다. `add`가 반환되면 add 프레임이 즉시 제거됩니다. 재귀 함수가 깊어지면 스택이 가득 차 **Stack Overflow** 에러가 발생합니다.

## 힙과 가비지 컬렉션

```js
function createObj() {
  const heavy = { data: new Array(100_000).fill(0) };
  return heavy; // 참조를 반환하면 힙에서 살아있음
}

let ref = createObj(); // 힙에 살아있음
ref = null; // 참조 끊김 → GC가 회수 가능 상태로

// ref가 없어지면 heavy 객체는 수거 대상
```

힙의 객체는 아무도 참조하지 않을 때 GC의 대상이 됩니다. 클로저나 전역 변수가 불필요하게 큰 객체를 붙잡고 있으면 메모리 누수로 이어집니다.

## 얕은 복사 vs 깊은 복사

```js
// 얕은 복사 — 중첩 객체는 여전히 참조 공유
const shallow = { ...original };
const shallow2 = Object.assign({}, original);

// 깊은 복사 — 완전히 독립된 사본
const deep = structuredClone(original); // ES2022+

// JSON 방식 (함수·undefined·순환참조 불가)
const deep2 = JSON.parse(JSON.stringify(original));
```

`spread`, `Object.assign`은 최상위 프로퍼티만 복사합니다. 중첩 객체는 여전히 같은 힙 주소를 공유합니다. 완전히 독립적인 복사가 필요하면 `structuredClone()`을 사용하세요.

## 정리

- 원시값 7종은 스택에 **값 자체** 저장 → 복사 시 독립적
- 객체·배열·함수는 힙에 저장, 스택에는 **힙 주소(참조)** 만 저장 → 복사 시 공유
- `const`는 재할당 금지이지, 힙 내부 변경을 막지는 않음
- 힙 객체는 참조가 없어질 때 GC 대상 → 클로저·전역변수가 참조를 붙잡으면 누수
- 깊은 복사가 필요하면 `structuredClone()` 사용

---

**지난 글:** [미처리 Rejection — 전역 에러 경계 설계](/posts/js-unhandled-rejection/)

**다음 글:** [가비지 컬렉션 — Mark & Sweep과 세대별 GC](/posts/js-gc-mark-sweep/)

<br>
읽어주셔서 감사합니다. 😊
