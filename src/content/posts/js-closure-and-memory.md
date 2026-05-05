---
title: "클로저와 메모리 — 스코프가 메모리를 어떻게 붙잡는가"
description: "클로저가 외부 변수를 캡처하는 내부 구조([[Environment]])와 이로 인한 메모리 보유, 그리고 누수를 예방하는 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "클로저", "메모리", "렉시컬환경", "Environment", "메모리누수", "GC"]
featured: false
draft: false
---

[지난 글](/posts/js-weakref-usage/)에서 WeakRef로 GC를 방해하지 않는 캐시를 만드는 법을 살펴봤습니다. 이번에는 클로저가 **왜, 어떻게 메모리를 붙잡는지** 내부 구조부터 이해하고, 이를 안전하게 다루는 패턴을 정리합니다.

## 클로저의 메모리 구조

JavaScript의 모든 함수는 생성될 때 `[[Environment]]`라는 내부 슬롯에 **자신이 생성된 렉시컬 환경(Lexical Environment)** 에 대한 참조를 저장합니다.

```js
function outer() {
  let count = 0;
  const data = new Array(50_000).fill(0);

  function inner() {
    count++;           // outer 환경의 count를 캡처
    return data[count]; // outer 환경의 data를 캡처
  }

  return inner;
}

const fn = outer();
// outer() 스택 프레임은 제거됐지만
// fn의 [[Environment]]가 outer의 환경 레코드를 참조
// → count, data는 힙에서 살아있음
```

`outer()`가 반환되면 outer의 스택 프레임은 사라지지만, `inner` 함수 객체의 `[[Environment]]`가 outer의 **환경 레코드(힙)**를 참조하고 있습니다. `fn`이 살아있는 한 `count`와 `data`는 GC 대상이 되지 않습니다.

![클로저가 외부 변수를 붙잡는 구조](/assets/posts/js-closure-and-memory-scope.svg)

## 엔진의 최적화: 사용된 변수만 캡처

현대 엔진(V8 등)은 클로저가 실제로 **사용하는 변수만 캡처**합니다. 사용하지 않는 변수는 최적화로 제외되는 경우가 있습니다.

```js
function outer() {
  const heavy = new Array(1_000_000).fill('x'); // 미사용
  const needed = 42;

  return () => needed; // heavy를 참조하지 않음
}

const fn = outer();
// 엔진이 heavy를 제외할 수 있지만... 보장되지 않음
// 같은 스코프에 다른 클로저가 heavy를 참조하면 함께 유지됨
```

**주의**: 같은 스코프에서 만들어진 여러 클로저는 환경을 공유합니다. 한 클로저가 `heavy`를 참조하면, `heavy`를 참조하지 않는 다른 클로저도 함께 `heavy`를 붙잡을 수 있습니다.

```js
function sharedEnv() {
  const big = new Array(1_000_000).fill('x');
  const num = 1;

  const usesNum = () => num;       // big 참조 안 함
  const usesBig = () => big.length; // big 참조

  return usesNum;
  // usesBig를 버려도 usesNum이 같은 환경을 통해 big을 붙잡을 수 있음!
}
```

## 이벤트 리스너 클로저 누수

실무에서 가장 흔한 클로저 누수 패턴입니다.

```js
// ❌ 이벤트 핸들러가 this 전체(bigData 포함)를 캡처
class Component {
  constructor(el) {
    this.bigData = new Array(100_000).fill(0);
    // 화살표 함수는 this를 렉시컬 캡처
    el.addEventListener('click', () => {
      console.log(this.bigData.length);
    });
    // destroy 없으면 el이 DOM에 있는 한 Component 전체 잔류
  }
}

// ✅ 해결 1: 필요한 값만 추출 후 클로저에 넘기기
class Component {
  constructor(el) {
    this.bigData = new Array(100_000).fill(0);
    const len = this.bigData.length; // 숫자만 캡처
    el.addEventListener('click', () => console.log(len));
  }
}
```

![클로저 메모리 누수 — 패턴 vs 해결책](/assets/posts/js-closure-and-memory-leak-fix.svg)

## setInterval + 클로저

```js
// ❌ 인터벌이 큰 데이터를 계속 붙잡음
function startTracking(largeDataset) {
  setInterval(() => {
    analyze(largeDataset); // largeDataset 캡처
  }, 1000);
  // clearInterval 없음 → largeDataset 영구 잔류
}

// ✅ 해결: ID 저장 + cleanup
function startTracking(largeDataset) {
  const id = setInterval(() => analyze(largeDataset), 1000);
  return () => {
    clearInterval(id);
    largeDataset = null; // 참조 해제
  };
}

const stop = startTracking(myData);
// 작업 완료 후:
stop();
```

## 모듈 수준 클로저 누수

```js
// ❌ 모듈 수준에서 클로저가 대형 데이터 캡처
const handlers = [];

export function registerHandler(data) {
  // data는 handlers 배열이 살아있는 한 수거 불가
  handlers.push(() => process(data));
}

// ✅ 해결: 필요한 식별자만 저장 + 명시적 제거 API
const handlers = new Map(); // ID → 함수

export function register(id, data) {
  const snapshot = summarize(data); // 필요한 것만 추출
  handlers.set(id, () => process(snapshot));
}

export function unregister(id) {
  handlers.delete(id);
}
```

## 클로저 디버깅 팁

```js
// Chrome DevTools: Closure 섹션 확인
function make() {
  const secret = 'captured!';
  return function inner() {
    return secret;
  };
}

const fn = make();
// DevTools → Sources → 중단점 설정 → Scope 패널에서
// "Closure (make)" 섹션에 secret이 표시됨

// 프로덕션: process.memoryUsage() 모니터링
setInterval(() => {
  const { heapUsed } = process.memoryUsage();
  if (heapUsed > THRESHOLD) {
    console.warn('힙 증가 감지:', heapUsed);
  }
}, 30_000);
```

## 정리

- 모든 함수는 `[[Environment]]`로 생성 시의 렉시컬 환경을 참조
- 클로저가 살아있는 한, 캡처된 변수는 GC 대상이 되지 않음
- 같은 스코프의 클로저들은 환경을 공유 → 하나만 살아있어도 모두 잔류 가능
- 예방책: 클로저에 최소한의 값만 캡처 + 명시적 cleanup(`null`, `removeEventListener`)
- 탐지: DevTools Scope 패널 / Heap Snapshot / 메모리 사용량 모니터링

---

**지난 글:** [WeakRef 활용 — 캐시와 파이널라이저 패턴](/posts/js-weakref-usage/)

**다음 글:** [typeof · instanceof의 한계와 올바른 타입 판별](/posts/js-typeof-instanceof-limits/)

<br>
읽어주셔서 감사합니다. 😊
