---
title: "메모리 누수 패턴 — 원인 분석과 탐지"
description: "JavaScript에서 자주 발생하는 메모리 누수 패턴 4가지와 각각의 해결책, Chrome DevTools와 Node.js를 활용한 탐지 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "메모리누수", "GC", "성능", "DevTools", "이벤트리스너", "WeakMap"]
featured: false
draft: false
---

[지난 글](/posts/js-gc-mark-sweep/)에서 GC가 도달 불가능한 객체를 자동으로 수거한다는 것을 배웠습니다. 메모리 누수는 **개발자가 의도치 않게 도달 가능한 참조를 남겨두어** GC가 수거하지 못하는 상황입니다. 이 글에서는 실무에서 자주 만나는 4가지 패턴과 탐지 방법을 다룹니다.

## 패턴 1 — 전역 변수·전역 캐시 무한 누적

```js
// ❌ 전역 캐시에 계속 추가, 삭제 로직 없음
const cache = {};
function processUser(id, data) {
  cache[id] = data; // 앱 수명 동안 계속 쌓임
}

// ✅ 해결 1: 최대 크기 제한 (간단한 LRU)
const MAX = 500;
const keys = [];
function cacheSet(key, val) {
  if (keys.length >= MAX) delete cache[keys.shift()];
  cache[key] = val;
  keys.push(key);
}

// ✅ 해결 2: WeakMap — 키 객체가 GC되면 자동 삭제
const wCache = new WeakMap();
function cacheUser(userObj, data) {
  wCache.set(userObj, data); // userObj가 사라지면 data도 수거
}
```

전역 객체(`window`, `global`)는 GC Root이므로 여기에 연결된 모든 객체는 수거되지 않습니다. 캐시나 레지스트리 패턴을 쓸 때는 반드시 크기 제한이나 만료 로직을 함께 구현해야 합니다.

![메모리 누수 4대 패턴](/assets/posts/js-memory-leak-patterns-code.svg)

## 패턴 2 — 이벤트 리스너 미제거

이벤트 리스너는 등록된 DOM 요소와 핸들러 함수 양쪽 모두에 대한 참조를 유지합니다. 컴포넌트를 DOM에서 제거해도 리스너가 살아있으면 관련 객체가 수거되지 않습니다.

```js
// ❌ 컴포넌트 해제 시 리스너를 제거하지 않음
class Widget {
  constructor() {
    this.data = new Array(100_000).fill(0); // 큰 데이터
    window.addEventListener('resize', this.onResize.bind(this));
  }
  onResize() { /* this.data를 참조 → 수거 불가 */ }
}
// Widget 인스턴스를 null로 해도 window가 onResize를 붙잡고 있음

// ✅ AbortController로 한 번에 정리
class Widget {
  constructor() {
    this.data = new Array(100_000).fill(0);
    this.ac = new AbortController();
    window.addEventListener('resize', this.onResize.bind(this),
      { signal: this.ac.signal });
  }
  destroy() {
    this.ac.abort(); // 등록된 모든 리스너 제거
    this.data = null;
  }
}
```

## 패턴 3 — setInterval / 타이머 미해제

```js
// ❌ 타이머 ID를 저장하지 않아 정리 불가
function startPolling(target) {
  setInterval(() => {
    // target을 클로저로 캡처 → target이 수거 안 됨
    target.update(fetch('/api/data'));
  }, 5000);
}

// ✅ ID를 저장하고 cleanup 함수 반환
function startPolling(target) {
  const id = setInterval(() => {
    target.update(fetch('/api/data'));
  }, 5000);

  return () => clearInterval(id); // cleanup
}

const stop = startPolling(myWidget);
// 필요 없을 때: stop();
```

React useEffect, Vue onUnmounted, Angular ngOnDestroy에서 반드시 cleanup을 반환·호출해야 합니다.

## 패턴 4 — 분리된 DOM 노드 참조 보관

```js
// ❌ DOM에서 제거했지만 JS 변수가 여전히 참조
let cachedEl = document.getElementById('modal');
document.body.removeChild(cachedEl); // DOM에서 분리됨
// cachedEl이 살아있어 전체 서브트리가 메모리에 잔류

// ✅ 사용 후 null 처리
cachedEl = null;

// ✅ WeakRef — GC가 필요하면 수거 허용
const ref = new WeakRef(document.getElementById('modal'));
// ref.deref()가 undefined를 반환하면 이미 수거됨
```

## 클로저에 의한 예상치 못한 누수

```js
function createHeavyResource() {
  const bigData = new Array(1_000_000).fill('x');

  // ❌ bigData를 참조하지 않는 함수도 bigData를 붙잡음
  // (일부 엔진에서 같은 스코프 내 클로저끼리 환경 공유)
  const doWork = () => console.log('working');
  const log = () => console.log(bigData.length); // bigData 참조

  return doWork; // log는 버리지만 bigData는 남을 수 있음
}

// ✅ 해결: 필요 없어진 즉시 null 처리
function createHeavyResource() {
  let bigData = new Array(1_000_000).fill('x');
  const len = bigData.length; // 필요한 값만 추출
  bigData = null;             // 즉시 해제

  return () => console.log(len);
}
```

## 탐지 방법

![메모리 누수 탐지 워크플로](/assets/posts/js-memory-leak-patterns-detection.svg)

**Chrome DevTools Memory 패널** 에서 Heap Snapshot을 두 번 찍어 Comparison 뷰로 비교합니다. 특정 작업 후 객체 수가 계속 증가하면 누수입니다.

```js
// Node.js: 주기적으로 힙 사용량 출력
setInterval(() => {
  const { heapUsed } = process.memoryUsage();
  console.log(`Heap: ${(heapUsed / 1024 / 1024).toFixed(1)} MB`);
}, 10_000);

// clinic.js (npm) — 전문적인 메모리 분석
// npx clinic heapsampler -- node app.js
```

**Performance Monitor**(DevTools → ⋮ → More Tools → Performance Monitor)에서 **JS Heap Size** 항목이 작업 후에도 계속 우상향하면 누수를 의심하세요.

## 정리

- 전역 변수·캐시: 크기 제한 + WeakMap으로 관리
- 이벤트 리스너: AbortController 또는 명시적 removeEventListener
- 타이머: ID 저장 + clearInterval/clearTimeout
- DOM 참조: 사용 후 null 처리 또는 WeakRef
- 클로저: 대형 객체를 클로저가 캡처하지 않도록 필요한 값만 추출
- 탐지: Chrome Heap Snapshot 비교 / Performance Monitor / clinic.js

---

**지난 글:** [가비지 컬렉션 — Mark & Sweep과 세대별 GC](/posts/js-gc-mark-sweep/)

**다음 글:** [WeakRef 활용 — 캐시와 파이널라이저 패턴](/posts/js-weakref-usage/)

<br>
읽어주셔서 감사합니다. 😊
