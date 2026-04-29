---
title: "제너레이터 응용 패턴"
description: "제너레이터 함수를 활용해 지연 파이프라인, 상태 기계, 코루틴, yield* 위임 등 실용적인 패턴을 구현하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "제너레이터", "generator", "yield", "yield*", "지연 평가", "상태 기계", "코루틴"]
featured: false
draft: false
---

[지난 글](/posts/js-iterator-protocol/)에서 이터레이터 프로토콜의 `next()`, `return()`, `throw()` 세 메서드를 살펴봤습니다. 이번 글에서는 이터레이터를 훨씬 쉽게 작성할 수 있는 **제너레이터 함수**와 그 응용 패턴을 다룹니다. 제너레이터 함수 자체의 기본은 이전 시리즈에서 다뤘으므로, 여기서는 실용적인 활용에 집중합니다.

## 지연 map / filter / take

제너레이터는 값을 요청받을 때만 계산하므로 중간 배열 없이 변환 파이프라인을 구성할 수 있습니다.

```javascript
function* map(iter, fn) {
  for (const v of iter) yield fn(v);
}

function* filter(iter, pred) {
  for (const v of iter) if (pred(v)) yield v;
}

function* take(iter, n) {
  let count = 0;
  for (const v of iter) {
    if (++count > n) break;
    yield v;
  }
}
```

이 세 함수를 조합하면 메모리 효율적인 파이프라인이 됩니다.

```javascript
function* range(start, end) {
  for (let i = start; i <= end; i++) yield i;
}

// 1~1000에서 홀수의 제곱, 처음 5개
const result = [
  ...take(
    map(
      filter(range(1, 1000), n => n % 2 !== 0),
      n => n * n
    ),
    5
  )
];
console.log(result); // [1, 9, 25, 49, 81]
// 실제로 처리된 숫자: 9개뿐 (1,3,5,7,9 + break 시점의 11)
```

![제너레이터 응용 패턴 — 파이프라인](/assets/posts/js-generator-applications-patterns.svg)

## yield* — 이터러블 위임

`yield*`는 다른 이터러블을 현재 제너레이터로 전개합니다.

```javascript
function* concat(...iters) {
  for (const it of iters) yield* it;
}

console.log([...concat([1, 2], [3, 4], [5])]); // [1, 2, 3, 4, 5]
```

재귀 트리 순회도 간결해집니다.

```javascript
function* flatten(arr, depth = 1) {
  for (const item of arr) {
    if (Array.isArray(item) && depth > 0) {
      yield* flatten(item, depth - 1);
    } else {
      yield item;
    }
  }
}

console.log([...flatten([1, [2, [3, 4]], 5], 1)]); // [1, 2, [3, 4], 5]
```

## 상태 기계

`yield`로 실행을 일시 정지하는 특성 덕분에 제너레이터는 상태 기계를 자연스럽게 표현합니다.

![제너레이터 상태 기계 다이어그램](/assets/posts/js-generator-applications-state.svg)

```javascript
function* trafficLight() {
  while (true) {
    yield '빨강';
    yield '노랑';
    yield '초록';
  }
}

const light = trafficLight();
console.log(light.next().value); // 빨강
console.log(light.next().value); // 노랑
console.log(light.next().value); // 초록
console.log(light.next().value); // 다시 빨강
```

제너레이터가 이전 상태를 클로저로 유지하므로 외부에서 상태 변수를 관리할 필요가 없습니다.

## 코루틴 — 양방향 통신

`next(value)`로 값을 주입하면 제너레이터가 입력을 받는 코루틴이 됩니다.

```javascript
function* accumulator() {
  let total = 0;
  while (true) {
    const n = yield total; // 외부에서 전달받은 값
    if (n === null) return total;
    total += n;
  }
}

const acc = accumulator();
acc.next();    // 초기 실행, { value: 0, done: false }
acc.next(10);  // { value: 10, done: false }
acc.next(20);  // { value: 30, done: false }
acc.next(5);   // { value: 35, done: false }
acc.next(null);// { value: 35, done: true }
```

## 무한 ID 생성기

```javascript
function* idGenerator(prefix = 'id') {
  let n = 0;
  while (true) yield `${prefix}-${n++}`;
}

const newId = idGenerator('user');
console.log(newId.next().value); // user-0
console.log(newId.next().value); // user-1
console.log(newId.next().value); // user-2
```

## 제너레이터로 트리 DFS

명시적 스택 없이 깊이 우선 탐색을 표현합니다.

```javascript
function* dfs(node) {
  yield node.value;
  for (const child of node.children ?? []) {
    yield* dfs(child);
  }
}

const tree = {
  value: 'A',
  children: [
    { value: 'B', children: [{ value: 'D' }, { value: 'E' }] },
    { value: 'C' },
  ],
};

console.log([...dfs(tree)]); // ['A', 'B', 'D', 'E', 'C']
```

## 주의사항

제너레이터는 강력하지만 두 가지를 주의합니다. 첫째, **재사용 불가** — 한번 완료된 제너레이터는 다시 호출해도 값을 반환하지 않습니다. 둘째, **디버깅 복잡도** — 실행 흐름이 `yield`로 분산되므로 스택 트레이스가 분산됩니다.

다음 글에서는 `[Symbol.iterator]`를 커스터마이징하는 고급 패턴과 이터러블 프로토콜을 확장하는 방법을 다룹니다.

---

**지난 글:** [이터레이터 프로토콜](/posts/js-iterator-protocol/)

**다음 글:** [Symbol.iterator 심화](/posts/js-symbol-iterator/)

<br>
읽어주셔서 감사합니다. 😊
