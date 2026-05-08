---
title: "가비지 컬렉션 — Mark & Sweep과 세대별 GC"
description: "JavaScript 엔진이 사용하지 않는 메모리를 회수하는 Mark & Sweep 알고리즘과 V8의 세대별(Generational) GC 구조를 깊이 있게 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "GarbageCollection", "MarkSweep", "V8", "메모리관리", "세대별GC"]
featured: false
draft: false
---

[지난 글](/posts/js-memory-model/)에서 스택과 힙이 어떻게 나뉘는지 살펴봤습니다. 이번에는 힙에 저장된 객체 중 **더 이상 필요 없는 것을 엔진이 어떻게 자동으로 회수하는지**, 즉 가비지 컬렉션(GC) 알고리즘을 들여다봅니다.

## 왜 GC가 필요한가

C/C++에서는 `malloc`으로 메모리를 할당하면 `free`로 직접 해제해야 합니다. 하지만 JavaScript는 **개발자가 메모리를 직접 해제하지 않습니다.** 엔진이 주기적으로 힙을 스캔해 더 이상 사용되지 않는 객체를 자동으로 회수합니다. 이것이 가비지 컬렉션입니다.

## Mark & Sweep 알고리즘

현대 JavaScript 엔진이 사용하는 핵심 GC 알고리즘은 **Mark & Sweep(표시 후 수거)** 입니다.

```js
// GC Root에서 시작해 도달 가능한 모든 객체를 표시
// 표시되지 않은 객체 = 가비지 → 힙에서 해제

let obj = { name: 'Alice' }; // 힙에 할당, Root에서 도달 가능
obj = null;                   // 참조 끊김 → GC 수거 가능

// 두 객체가 서로만 참조해도 Root에서 도달 불가 → 수거
function createCycle() {
  let a = {};
  let b = {};
  a.ref = b;
  b.ref = a;
  // a, b는 함수 반환 시 Root에서 끊김 → 수거됨
}
```

**Phase 1 — Mark(표시)**: GC Root(전역 변수, 스택 변수, 레지스터 등)에서 출발해 도달 가능한 모든 객체에 "살아있음" 표시를 합니다. 포인터를 따라가며 그래프를 탐색합니다.

**Phase 2 — Sweep(수거)**: 힙 전체를 순회해 표시되지 않은 객체의 메모리를 해제하고 빈 공간을 free list에 추가합니다.

![Mark & Sweep — 가비지 컬렉션 알고리즘](/assets/posts/js-gc-mark-sweep-algorithm.svg)

### 참조 카운팅 방식의 한계

초기 JavaScript 엔진은 **참조 카운팅**을 사용했습니다. 각 객체마다 참조 횟수를 세어 0이 되면 즉시 해제하는 방식입니다. 단순하지만 **순환 참조를 처리하지 못합니다.** Mark & Sweep은 Root 도달 가능성으로 판단하기 때문에 순환 참조도 올바르게 수거합니다.

## V8의 세대별(Generational) GC

V8은 "세대 가설(Generational Hypothesis)"에 기반한 세대별 GC를 씁니다.

> **세대 가설**: 대부분의 객체는 생성 직후 죽는다. 오래 살아남은 객체는 계속 살아있을 가능성이 높다.

```js
// 단명 객체 — 금방 수거됨 (Young Generation)
function processRequest(req) {
  const body = JSON.parse(req.body); // 요청 처리 후 사라짐
  const result = transform(body);
  return result;
}

// 장수 객체 — Old Generation으로 승격됨
const globalCache = new Map(); // 앱 전체 수명 동안 유지
```

![세대별 GC — V8 힙 구조](/assets/posts/js-gc-mark-sweep-generational.svg)

### Young Generation — Minor GC

새로 생성된 객체는 **Eden Space**에 할당됩니다. Eden이 가득 차면 Minor GC가 실행됩니다.

- Minor GC는 **매우 빠릅니다(~1ms)**. Young Generation이 작기 때문입니다.
- Eden에서 살아남은 객체는 **Survivor Space**로 이동합니다.
- 여러 번 Minor GC에서 살아남으면 **Old Generation으로 승격(Promotion)** 됩니다.

### Old Generation — Major GC

오래된 객체가 모이는 곳입니다. Major GC(Full GC)는 드물게 발생하지만 상대적으로 느립니다.

```js
// Major GC 중 Stop-The-World 발생
// 수백 MB의 Old Gen을 스캔하면 수십ms 지연 가능

// 힙 통계 확인 (Node.js)
const v8 = require('v8');
const stats = v8.getHeapStatistics();
console.log({
  total: (stats.total_heap_size / 1024 / 1024).toFixed(2) + ' MB',
  used:  (stats.used_heap_size  / 1024 / 1024).toFixed(2) + ' MB',
  limit: (stats.heap_size_limit / 1024 / 1024).toFixed(2) + ' MB',
});
```

## V8의 GC 최적화 기법

Major GC 중 JavaScript 실행이 멈추는 **Stop-The-World(STW)** 문제를 완화하기 위해 V8은 다양한 최적화를 적용합니다.

**증분 마킹(Incremental Marking)**: 마킹 작업을 작은 조각으로 나눠 JS 실행 사이사이에 끼워 넣습니다.

**병렬 GC(Parallel GC)**: 여러 GC 스레드가 동시에 수거 작업을 수행합니다.

**동시 GC(Concurrent GC)**: JS 실행 스레드와 GC 스레드가 동시에 실행됩니다.

## GC를 의식한 코딩

GC 자체는 자동이지만, **GC가 회수하지 못하는 상황**을 만들지 않는 게 개발자의 역할입니다.

```js
// ❌ 전역 캐시에 무한 축적
const cache = {};
function getUser(id) {
  if (!cache[id]) cache[id] = fetchUser(id); // 삭제 로직 없음
  return cache[id];
}

// ✅ 크기 제한 또는 WeakMap 활용
const cache = new WeakMap(); // 키가 GC되면 자동 제거
function getUser(obj) {
  if (!cache.has(obj)) cache.set(obj, compute(obj));
  return cache.get(obj);
}
```

## Node.js에서 힙 한계 늘리기

```bash
# 기본 힙: ~1.5GB (64비트), 조정 필요 시
node --max-old-space-size=4096 app.js   # 4GB로 늘림
node --max-semi-space-size=128 app.js   # Young Gen 크기 조정
```

## 정리

- GC는 **GC Root 도달 가능성**으로 수거 여부를 판단 (참조 카운팅이 아님)
- Mark & Sweep: 표시 → 미표시 객체 수거. 순환 참조도 처리
- V8은 세대별 GC: Young(빠른 Minor GC) + Old(느린 Major GC)
- 새 객체 대부분은 Eden에서 빠르게 수거, 오래 살면 Old Gen으로 승격
- Major GC 중 STW 발생 → V8은 증분/병렬/동시 기법으로 최소화
- 개발자의 역할: GC가 회수하지 못하게 하는 참조 누수를 만들지 않기

---

**지난 글:** [메모리 모델 — 힙·스택·참조의 구조](/posts/js-memory-model/)

**다음 글:** [메모리 누수 패턴 — 원인 분석과 탐지](/posts/js-memory-leak-patterns/)

<br>
읽어주셔서 감사합니다. 😊
