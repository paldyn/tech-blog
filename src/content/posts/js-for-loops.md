---
title: "JavaScript 반복문 완전 정리"
description: "for, for...in, for...of, while, do...while의 동작 원리와 선택 기준, 그리고 break·continue·label로 흐름을 제어하는 방법을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 31
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "반복문", "for", "for...of", "for...in", "while", "break", "continue"]
featured: false
draft: false
---

[지난 글](/posts/js-decorators/)에서 데코레이터로 클래스와 메서드에 횡단 관심사를 선언적으로 붙이는 방법을 살펴봤습니다. 이번 글부터는 **반복과 순회** 영역으로 넘어갑니다. 먼저 JavaScript가 제공하는 다섯 가지 반복문과 흐름 제어 키워드를 정리합니다.

## for 루프

가장 오래된 반복문입니다. 초기화·조건·갱신 세 부분을 세미콜론으로 구분합니다.

```javascript
const arr = [10, 20, 30];
for (let i = 0; i < arr.length; i++) {
  console.log(arr[i]); // 10, 20, 30
}
```

인덱스를 직접 다루기 때문에 역순 순회, 특정 인덱스 건너뛰기, 두 배열 동시 순회처럼 유연한 제어가 필요할 때 적합합니다.

```javascript
// 역순
for (let i = arr.length - 1; i >= 0; i--) {
  console.log(arr[i]); // 30, 20, 10
}

// 짝수 인덱스만
for (let i = 0; i < arr.length; i += 2) {
  console.log(arr[i]); // 10, 30
}
```

![JavaScript 반복문 한눈에 보기](/assets/posts/js-for-loops-overview.svg)

## for...in

객체의 **열거 가능한(enumerable) 키**를 순회합니다.

```javascript
const user = { name: 'Alice', age: 30, role: 'admin' };
for (const key in user) {
  console.log(key, user[key]);
  // name Alice / age 30 / role admin
}
```

주의할 점이 두 가지 있습니다. 첫째, 프로토타입 체인의 열거 가능 속성도 포함됩니다. 상속 키까지 나오지 않게 하려면 `Object.hasOwn`으로 필터링합니다.

```javascript
for (const key in user) {
  if (!Object.hasOwn(user, key)) continue; // 상속 키 제외
  console.log(key, user[key]);
}
```

둘째, 배열에 `for...in`을 쓰면 인덱스가 문자열로 나오고 순서 보장이 약합니다. **배열은 `for...of` 또는 `for`를 사용하세요.**

## for...of

ES2015에서 도입된 반복문으로, **이터러블(iterable)** 객체의 값을 순회합니다.

```javascript
const nums = [1, 2, 3];
for (const n of nums) {
  console.log(n); // 1, 2, 3
}

// 문자열
for (const ch of 'hello') {
  console.log(ch); // h, e, l, l, o
}

// Map
const map = new Map([['a', 1], ['b', 2]]);
for (const [key, value] of map) {
  console.log(key, value); // a 1 / b 2
}
```

배열 인덱스가 필요하면 `entries()`를 활용합니다.

```javascript
for (const [i, v] of ['x', 'y', 'z'].entries()) {
  console.log(i, v); // 0 x / 1 y / 2 z
}
```

## while

조건이 `true`인 동안 반복합니다. 반복 횟수를 사전에 알 수 없을 때 자연스럽습니다.

```javascript
let input = '';
while (input !== 'quit') {
  input = prompt('명령어 입력:') ?? '';
}
```

반복 본문에서 조건 변수를 반드시 갱신해야 무한 루프를 피할 수 있습니다.

## do...while

조건 검사를 루프 끝에서 하기 때문에 **본문이 최소 한 번** 실행됩니다.

```javascript
let attempts = 0;
do {
  attempts++;
  console.log(`시도 ${attempts}회`);
} while (attempts < 3);
// 시도 1회 / 시도 2회 / 시도 3회
```

## break · continue · label

`break`는 루프를 즉시 종료하고, `continue`는 현재 반복을 건너뜁니다.

```javascript
// break: 3에서 멈춤
for (let i = 0; i < 5; i++) {
  if (i === 3) break;
  console.log(i); // 0, 1, 2
}

// continue: 짝수 건너뜀
for (let i = 0; i < 5; i++) {
  if (i % 2 === 0) continue;
  console.log(i); // 1, 3
}
```

중첩 루프를 한 번에 탈출하려면 **레이블(label)**을 사용합니다.

```javascript
outer: for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    if (i === 1 && j === 1) break outer;
    console.log(i, j);
  }
}
// 0 0 / 0 1 / 0 2 / 1 0 까지 출력 후 종료
```

레이블은 `continue outer`처럼 `continue`에도 사용할 수 있습니다.

![break · continue · label 루프 제어 흐름](/assets/posts/js-for-loops-break-continue.svg)

## 반복문 선택 기준

| 상황 | 권장 |
|---|---|
| 인덱스 직접 제어·역순·step | `for` |
| 배열·Map·Set·String 값 순회 | `for...of` |
| 객체 키 열거 | `for...in` + `hasOwn` |
| 횟수 불명확 조건 루프 | `while` |
| 최소 1회 실행 보장 | `do...while` |

`forEach`, `map`, `filter` 같은 배열 메서드는 함수형 파이프라인에 어울리지만 `break`를 쓸 수 없습니다. 조기 종료가 필요하면 `for...of`를 선택합니다.

다음 글에서는 `for...of`가 내부적으로 의존하는 **이터러블 프로토콜**을 살펴봅니다.

---

**지난 글:** [데코레이터](/posts/js-decorators/)

**다음 글:** [이터러블 프로토콜](/posts/js-iterable-protocol/)

<br>
읽어주셔서 감사합니다. 😊
