---
title: "배열 불변 메서드 — 원본을 건드리지 않는 방법들"
description: "ES2023에 추가된 toSorted, toReversed, toSpliced, with 메서드로 원본 배열을 보존하면서 변형하는 방법과 기존 가변 메서드와의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "배열", "불변", "toSorted", "toReversed", "toSpliced", "with", "ES2023"]
featured: false
draft: false
---

[지난 글](/posts/js-execution-context/)에서 실행 컨텍스트의 구조를 살펴봤습니다. 이번에는 현업에서 빈번하게 마주치는 배열 조작 패턴 — 특히 **원본 배열을 변경하지 않는 불변 메서드**를 집중적으로 다룹니다. React 상태 관리나 함수형 패턴처럼 불변성이 중요한 환경에서 `sort`, `reverse`, `splice`를 대체할 수 있는 ES2023 신규 메서드들을 중심으로 정리합니다.

## 가변 vs 불변 메서드

JavaScript 배열 메서드는 크게 두 종류로 나뉩니다. **가변(mutating) 메서드**는 원본 배열 자체를 변경하고, **불변(non-mutating) 메서드**는 새 배열이나 값을 반환하며 원본을 보존합니다.

![가변 메서드 vs 불변 메서드](/assets/posts/js-array-immutable-methods-table.svg)

`push`, `pop`, `sort`, `reverse`, `splice` 같은 가변 메서드는 성능상 이점이 있지만, React의 `setState`나 Redux 리듀서처럼 참조 동일성으로 변경을 감지하는 환경에서 버그를 유발하기 쉽습니다.

```javascript
// 가변 sort의 함정
const state = [3, 1, 2];
state.sort(); // state 자체가 [1, 2, 3]으로 변경됨
// React는 같은 참조라서 리렌더링 안 일어남
```

## ES2023 불변 배열 메서드

ECMAScript 2023(ES14)은 네 가지 불변 메서드를 추가했습니다.

### toSorted()

`sort()`의 불변 버전입니다. 정렬된 **새 배열**을 반환하며 원본은 그대로입니다.

```javascript
const nums = [3, 1, 4, 1, 5];
const sorted = nums.toSorted((a, b) => a - b);
console.log(sorted); // [1, 1, 3, 4, 5]
console.log(nums);   // [3, 1, 4, 1, 5] — 변경 없음
```

### toReversed()

`reverse()`의 불변 버전입니다.

```javascript
const items = ['a', 'b', 'c'];
const rev = items.toReversed();
console.log(rev);   // ['c', 'b', 'a']
console.log(items); // ['a', 'b', 'c'] — 변경 없음
```

### toSpliced()

`splice()`의 불변 버전입니다. 특정 위치에서 요소를 제거하거나 삽입한 새 배열을 반환합니다.

```javascript
const arr = [10, 20, 30, 40];
// 인덱스 1부터 2개 제거하고 99 삽입
const result = arr.toSpliced(1, 2, 99);
console.log(result); // [10, 99, 40]
console.log(arr);    // [10, 20, 30, 40] — 변경 없음
```

### with()

단일 요소를 교체한 새 배열을 반환합니다. `arr[i] = v` 패턴의 불변 버전입니다.

```javascript
const colors = ['red', 'green', 'blue'];
const updated = colors.with(1, 'yellow');
console.log(updated); // ['red', 'yellow', 'blue']
console.log(colors);  // ['red', 'green', 'blue'] — 변경 없음
```

음수 인덱스도 지원합니다: `colors.with(-1, 'purple')`은 마지막 요소를 교체합니다.

![ES2023 불변 배열 메서드 코드 예시](/assets/posts/js-array-immutable-methods-code.svg)

## 기존 불변 패턴과의 비교

ES2023 이전에는 전개 연산자나 `slice`를 조합해 불변성을 직접 구현해야 했습니다.

```javascript
const arr = [3, 1, 2];

// 이전 방식 — 장황하고 실수하기 쉬움
const sortedOld = [...arr].sort();
const reversedOld = [...arr].reverse();
const splicedOld = [...arr.slice(0, 1), ...arr.slice(2)];

// ES2023 방식 — 간결하고 의도 명확
const sortedNew = arr.toSorted();
const reversedNew = arr.toReversed();
const splicedNew = arr.toSpliced(1, 1);
```

## TypedArray 지원

네 메서드 모두 `Int32Array`, `Float64Array` 등 TypedArray에도 동일하게 적용됩니다.

```javascript
const typed = new Int32Array([5, 3, 8, 1]);
const sortedTyped = typed.toSorted();
// Int32Array [1, 3, 5, 8]
```

## 호환성

Chrome 110+, Firefox 115+, Safari 16.3+, Node.js 20+에서 사용 가능합니다. 오래된 환경이라면 `core-js` 폴리필 또는 전개 연산자 패턴으로 대체하세요.

## 정리

| 기존 (가변) | ES2023 (불변) | 반환값 |
|------------|--------------|-------|
| `sort()` | `toSorted()` | 새 배열 |
| `reverse()` | `toReversed()` | 새 배열 |
| `splice()` | `toSpliced()` | 새 배열 |
| `arr[i] = v` | `with(i, v)` | 새 배열 |

불변 메서드는 함수형 스타일로 작성하기 쉽고, 상태 관리 라이브러리와 궁합이 좋습니다. 새 프로젝트에서 `sort`, `reverse`, `splice`를 쓸 일이 생기면 불변 버전을 먼저 검토하세요.

---

**지난 글:** [실행 컨텍스트 — JavaScript 코드가 동작하는 환경](/posts/js-execution-context/)

**다음 글:** [Promise.withResolvers() — 외부에서 제어하는 Promise](/posts/js-promise-with-resolvers/)

<br>
읽어주셔서 감사합니다. 😊
