---
title: "Map과 Set"
description: "ES2015에서 도입된 Map과 Set의 내부 동작, Object/Array와의 차이점, 그리고 빈도 카운팅·그룹핑·집합 연산 등 실용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Map", "Set", "컬렉션", "ES2015", "집합 연산", "이터러블"]
featured: false
draft: false
---

[지난 글](/posts/js-async-iterable/)에서 비동기 이터러블을 살펴봤습니다. 이번 글에서는 ES2015에 추가된 **Map**과 **Set** 컬렉션을 깊이 살펴봅니다. 두 자료구조는 단순히 기존 `Object`와 `Array`의 대체재가 아니라, 각자 뚜렷한 장점을 가진 독립적인 도구입니다.

## Map

`Map`은 **키-값 쌍**을 삽입 순서대로 저장하는 컬렉션입니다. `Object`와 달리 키로 **모든 타입**을 사용할 수 있습니다.

```javascript
const map = new Map();

// 다양한 타입의 키
map.set('문자열 키', 1);
map.set(42, '숫자 키');
map.set(true, '불리언 키');

const objKey = { id: 1 };
map.set(objKey, '객체 키');

console.log(map.get(objKey)); // '객체 키'
console.log(map.size);        // 4
```

### 주요 메서드

```javascript
const m = new Map([['a', 1], ['b', 2], ['c', 3]]);

m.has('b');     // true
m.get('b');     // 2
m.delete('b');  // true
m.size;         // 2

// 순회
for (const [key, value] of m) console.log(key, value);
[...m.keys()];   // ['a', 'c']
[...m.values()]; // [1, 3]
[...m.entries()]; // [['a',1], ['c',3]]
```

### Map vs Object

![Map과 Set 내부 구조 비교](/assets/posts/js-map-set-internals.svg)

`Map`은 키가 빈번하게 추가·삭제되는 시나리오에서 `Object`보다 성능이 뛰어납니다. `Object`는 엔진이 Hidden Class(V8 기준)로 최적화하므로 정적인 레코드에는 적합하지만, 동적 변경이 잦으면 최적화가 해제됩니다.

## Set

`Set`은 **고유한 값**의 순서 있는 컬렉션입니다.

```javascript
const set = new Set([1, 2, 3, 2, 1]);
console.log([...set]); // [1, 2, 3] — 중복 제거

set.add(4);
set.has(2);    // true
set.delete(2); // true
set.size;      // 3
```

### 배열 중복 제거

```javascript
const arr = [1, 2, 2, 3, 3, 3];
const unique = [...new Set(arr)]; // [1, 2, 3]
```

### 집합 연산

```javascript
const a = new Set([1, 2, 3, 4]);
const b = new Set([3, 4, 5, 6]);

const union        = new Set([...a, ...b]);          // {1,2,3,4,5,6}
const intersection = new Set([...a].filter(x => b.has(x))); // {3,4}
const difference   = new Set([...a].filter(x => !b.has(x))); // {1,2}
```

ES2025에서는 `Set.prototype.union()`, `intersection()`, `difference()` 등 네이티브 메서드가 추가됩니다.

## 실용 패턴

![Map API 핵심 패턴](/assets/posts/js-map-set-patterns.svg)

### 빈도 카운팅

```javascript
function frequency(arr) {
  return arr.reduce((map, v) => {
    map.set(v, (map.get(v) ?? 0) + 1);
    return map;
  }, new Map());
}

const freq = frequency(['a', 'b', 'a', 'c', 'a', 'b']);
// Map { 'a' => 3, 'b' => 2, 'c' => 1 }

// 최빈값 찾기
const [topItem] = [...freq.entries()].sort(([, a], [, b]) => b - a);
console.log(topItem); // ['a', 3]
```

### 그룹핑

ES2024부터 `Map.groupBy()`를 사용할 수 있습니다.

```javascript
const people = [
  { name: 'Alice', dept: 'Eng' },
  { name: 'Bob', dept: 'HR' },
  { name: 'Charlie', dept: 'Eng' },
];

// ES2024
const byDept = Map.groupBy(people, p => p.dept);
byDept.get('Eng'); // [Alice, Charlie]

// 폴리필 (수동 구현)
function groupBy(iter, keyFn) {
  const map = new Map();
  for (const item of iter) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
```

### 객체를 키로 — 메타데이터 연결

`Map`의 가장 강력한 특성 중 하나는 **객체 자체를 키로 쓸 수 있다**는 점입니다. DOM 노드나 인스턴스에 추가 데이터를 연결할 때 활용합니다.

```javascript
const elementData = new Map();

document.querySelectorAll('.item').forEach(el => {
  elementData.set(el, { clicks: 0, lastSeen: Date.now() });
});

document.addEventListener('click', e => {
  const data = elementData.get(e.target);
  if (data) data.clicks++;
});
```

## Map / Set 순회

두 컬렉션 모두 이터러블이므로 `for...of`, 스프레드, 구조 분해가 모두 작동합니다.

```javascript
const s = new Set(['x', 'y', 'z']);
for (const v of s) console.log(v);   // x, y, z
const [first] = s;                    // 'x'
Array.from(s, v => v.toUpperCase()); // ['X', 'Y', 'Z']
```

## 직렬화

`Map`과 `Set`은 `JSON.stringify`로 직접 직렬화되지 않습니다.

```javascript
JSON.stringify(new Map([['a', 1]])); // '{}'  — 비어 있음!

// 변환 후 직렬화
JSON.stringify(Object.fromEntries(new Map([['a', 1]]))); // '{"a":1}'
JSON.stringify([...new Set([1, 2, 3])]); // '[1,2,3]'
```

다음 글에서는 메모리 참조를 약하게 유지하는 `WeakMap`과 `WeakSet`을 살펴봅니다.

---

**지난 글:** [비동기 이터러블](/posts/js-async-iterable/)

**다음 글:** [WeakMap과 WeakSet](/posts/js-weakmap-weakset/)

<br>
읽어주셔서 감사합니다. 😊
