---
title: "참조와 메모리 — 값 복사 vs 참조 복사"
description: "JavaScript의 원시값 vs 객체 메모리 모델, 스택과 힙, 얕은 복사와 깊은 복사(structuredClone), 함수 인수 전달 방식, const와 불변성의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "참조", "메모리", "얕은복사", "깊은복사", "structuredClone", "스택", "힙"]
featured: false
draft: false
---

[지난 글](/posts/js-null-vs-undefined/)에서 null과 undefined의 의미론적 차이를 다뤘습니다. 이번에는 JavaScript가 값을 메모리에 어떻게 저장하고 복사하는지를 파고들겠습니다. "왜 객체를 복사했는데 원본이 바뀌냐"는 질문의 근본 원인이 여기에 있습니다.

## 스택과 힙

JavaScript 엔진은 두 종류의 메모리 영역을 사용합니다.

**스택(Stack)**은 정해진 크기의 빠른 메모리입니다. 원시값(number, string, boolean, null, undefined, symbol, bigint)은 크기가 고정되어 있어 스택에 직접 저장됩니다.

**힙(Heap)**은 크기가 가변적인 값을 저장하는 동적 메모리 영역입니다. 객체, 배열, 함수는 힙에 저장되고, 스택의 변수에는 힙의 메모리 주소(참조)만 담깁니다.

```javascript
let a = 42;         // 스택에 42 직접 저장
let b = a;          // 스택에 42 복사
b = 100;
console.log(a);     // 42 (독립적)

const obj = { name: 'Alice' }; // 힙에 객체, 스택에 주소
const obj2 = obj;              // 주소 복사 (같은 객체 가리킴)
obj2.name = 'Bob';
console.log(obj.name); // 'Bob' (같은 객체!)
```

![값 복사 vs 참조 복사 메모리 모델](/assets/posts/js-reference-and-memory-model.svg)

## 원시값은 불변

모든 원시값은 불변(immutable)입니다. 문자열 메서드는 항상 새 문자열을 반환하고, 원본을 수정하지 않습니다.

```javascript
let str = 'hello';
str.toUpperCase(); // 'HELLO' (새 문자열)
console.log(str);  // 'hello' (원본 불변)

let num = 5;
num++;             // num = num + 1 (새 값 할당)
```

변수 자체는 다른 값을 가리키도록 바꿀 수 있지만(`num++`), 값 자체는 변하지 않습니다.

## 얕은 복사 vs 깊은 복사

참조 복사의 문제를 피하려면 명시적으로 복사해야 합니다.

**얕은 복사(Shallow Copy)**: 최상위 프로퍼티만 복사하고, 중첩된 객체는 여전히 참조를 공유합니다.

```javascript
const original = { name: 'Alice', addr: { city: 'Seoul' } };

// 얕은 복사 방법들
const copy1 = { ...original };
const copy2 = Object.assign({}, original);

copy1.name = 'Bob';        // original.name 영향 없음
copy1.addr.city = 'Busan'; // original.addr.city도 'Busan'! (참조 공유)
```

**깊은 복사(Deep Copy)**: 중첩된 구조까지 완전히 분리된 복사본을 만듭니다.

```javascript
// structuredClone — ES2022, 현대적인 방법
const deep = structuredClone(original);
deep.addr.city = 'Busan'; // original.addr.city 영향 없음

// JSON 왕복 — 구식, 함수/Symbol/undefined/Date 처리 불완전
const deep2 = JSON.parse(JSON.stringify(original));
```

`structuredClone`은 Date, Map, Set, ArrayBuffer, RegExp 등을 올바르게 복사하지만, 함수와 DOM 노드는 복사할 수 없습니다.

![얕은 복사 vs 깊은 복사](/assets/posts/js-reference-and-memory-copy.svg)

## 함수 인수 전달 방식

JavaScript는 항상 **값에 의한 전달(pass by value)**을 합니다. 단, 객체의 경우 "참조 값"이 복사됩니다.

- **원시값**: 값 자체가 복사되므로 함수 내 변경이 외부에 영향 없음
- **객체**: 참조(주소)가 복사되므로 프로퍼티 변경은 외부에 영향 있음. 단, 변수 자체를 재할당하면 외부에 영향 없음

```javascript
function reassign(o) {
  o = { name: 'Charlie' }; // 지역 변수만 바뀜
}
const person = { name: 'Alice' };
reassign(person);
console.log(person.name); // 'Alice' (외부 영향 없음)
```

## const와 불변성의 차이

`const`는 변수 바인딩을 고정하는 것이지, 객체의 내용을 고정하지 않습니다.

```javascript
const arr = [1, 2, 3];
arr.push(4);      // ✓ 동작함 (배열 내용 변경)
arr = [5, 6];     // TypeError (변수 재할당 불가)

const obj = { x: 1 };
obj.x = 99;       // ✓ 동작함
obj = {};         // TypeError
```

객체의 내용까지 불변으로 만들려면 `Object.freeze()`를 사용합니다. 단, 얕은 동결(shallow freeze)이므로 중첩 객체는 여전히 변경 가능합니다.

```javascript
const frozen = Object.freeze({ nested: { val: 1 } });
frozen.x = 10;          // 조용히 무시 (strict mode에서 TypeError)
frozen.nested.val = 99; // 가능 (중첩 객체는 동결 안 됨)
```

## 동등 비교와 참조

객체의 `===` 비교는 참조(주소)를 비교합니다. 내용이 같아도 다른 객체면 `false`입니다.

```javascript
const a = { x: 1 };
const b = { x: 1 };
a === b; // false (다른 참조)
a === a; // true  (같은 참조)

// 내용 비교가 필요하면 직접 구현하거나 라이브러리 사용
JSON.stringify(a) === JSON.stringify(b); // true (간단하지만 한계 있음)
```

React나 Vue 같은 프레임워크가 불변 업데이트 패턴을 선호하는 이유가 바로 이 참조 동등 비교 때문입니다. `===`로 이전 상태와 새 상태를 빠르게 비교할 수 있어 렌더링을 최적화할 수 있습니다.

---

**지난 글:** [null과 undefined의 차이](/posts/js-null-vs-undefined/)

**다음 글:** [동등 비교 완전 정리](/posts/js-equality/)

<br>
읽어주셔서 감사합니다. 😊
