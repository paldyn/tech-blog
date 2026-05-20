---
title: "메모리 프로파일링 — 누수 탐지와 힙 스냅샷"
description: "Chrome DevTools Memory 패널로 힙 스냅샷을 비교하는 방법, Allocation Timeline으로 누수 객체를 찾는 방법, 이벤트 리스너·클로저·타이머·캐시로 인한 4가지 메모리 누수 패턴과 해결책을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "성능", "메모리", "프로파일링", "힙스냅샷", "메모리누수", "DevTools", "GC", "최적화"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "perf-lighthouse-webpagetest"
  title: "Lighthouse와 WebPageTest — 성능 측정 도구 완전 정복"
next:
  slug: "perf-cpu-profiling-flame"
  title: "CPU 프로파일링과 플레임 차트 — 병목 함수 찾기"
---

[지난 글](/posts/perf-lighthouse-webpagetest/)에서 Lighthouse와 WebPageTest로 성능을 측정하는 방법을 알아봤습니다. 이번에는 **메모리 문제** — 특히 메모리 누수를 탐지하고 수정하는 방법을 다룹니다. 메모리 누수는 초기에는 눈에 띄지 않다가 시간이 지나면서 페이지가 느려지거나 탭이 강제 종료되는 현상으로 나타납니다.

---

## 메모리 누수 증상 파악

```js
// Performance API로 메모리 사용량 확인 (Chrome 전용)
if (performance.memory) {
  const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
  console.log(`사용: ${(usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`할당: ${(totalJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`한계: ${(jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`);
}

// 반복 확인으로 증가 추세 파악
setInterval(() => {
  console.log('힙:', (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1), 'MB');
}, 5000);
```

특정 동작을 반복했을 때 메모리가 계속 증가하면 누수를 의심합니다. 정상적인 페이지는 **톱니 패턴**(증가 후 GC로 감소)을 보이고, 누수가 있는 페이지는 **계단 패턴**(감소 없이 증가)을 보입니다.

---

## Chrome DevTools — Heap Snapshot

힙 스냅샷은 **특정 시점의 메모리 상태**를 촬영해 두 스냅샷을 비교함으로써 새로 생성되어 해제되지 않은 객체를 찾습니다.

![힙 스냅샷 비교 — 메모리 누수 탐지](/assets/posts/perf-memory-profiling-heap.svg)

### 단계별 절차

```
1. DevTools → Memory 탭
2. "Heap snapshot" 선택
3. "Take snapshot" → Snapshot 1
4. 의심되는 동작 10~20회 반복 (예: 모달 열기/닫기)
5. "Take snapshot" → Snapshot 2
6. Snapshot 2 클릭 → 상단 드롭다운에서 "Comparison" 선택
7. "#New"(새로 생성) 컬럼 정렬 → 크게 증가한 생성자 탐색
8. 의심 항목 펼쳐서 "Retainer" 확인
```

**Retained Size**가 크게 증가한 생성자가 누수의 원인입니다. Retainer 체인을 따라가면 어디서 참조를 유지하고 있는지 알 수 있습니다.

---

## Allocation Timeline

힙 스냅샷이 "지금 어떤 상태인가"를 본다면, Allocation Timeline은 "어떤 객체가 생성되어 해제되지 않고 있는가"를 시간 축으로 보여줍니다.

```
1. DevTools → Memory 탭
2. "Allocation instrumentation on timeline" 선택
3. "Start" 클릭
4. 의심 동작 수행
5. "Stop"
6. 타임라인에서 빨간 막대(GC 후에도 남은 객체) 클릭
7. 아래 Object 목록에서 retain 경로 확인
```

---

## 4가지 주요 누수 패턴

![메모리 누수 패턴](/assets/posts/perf-memory-profiling-leaks.svg)

### 1. 제거되지 않은 이벤트 리스너

```js
// ❌ 리스너를 추가만 하고 제거하지 않음
class ScrollTracker {
  constructor() {
    // 이 arrow function의 참조를 this에 저장하지 않아서 제거 불가
    window.addEventListener('scroll', () => this.updatePosition());
  }
  // destroy()가 있어도 리스너를 제거할 방법이 없음
}

// ✅ 참조를 저장해두고 제거
class ScrollTracker {
  constructor() {
    this.handler = () => this.updatePosition();
    window.addEventListener('scroll', this.handler);
  }
  destroy() {
    window.removeEventListener('scroll', this.handler);
  }
}
```

React에서는 `useEffect` 반환 함수가 cleanup 역할을 합니다.

```js
useEffect(() => {
  const handler = () => updatePosition();
  window.addEventListener('scroll', handler);
  return () => window.removeEventListener('scroll', handler); // cleanup
}, []);
```

### 2. 클로저가 DOM 참조 유지

```js
// ❌ element가 DOM에서 제거되어도 클로저가 참조를 유지
function setupHandler() {
  const largeElement = document.getElementById('big-list'); // 수천 개 자식
  const data = processData(largeElement);

  document.getElementById('btn').addEventListener('click', () => {
    // largeElement가 클로저에 캡처됨 — DOM 제거 후에도 메모리 차지
    console.log(data, largeElement.childNodes.length);
  });
}

// ✅ 필요한 값만 캡처
function setupHandler() {
  const largeElement = document.getElementById('big-list');
  const data = processData(largeElement);
  const count = largeElement.childNodes.length; // 값만 복사

  document.getElementById('btn').addEventListener('click', () => {
    console.log(data, count); // DOM 참조 없음
  });
}
```

### 3. 정리되지 않은 타이머

```js
// ❌ 컴포넌트 제거 후에도 interval 실행
class LiveData {
  constructor(element) {
    this.el = element;
    setInterval(() => {
      this.el.textContent = fetchData(); // this.el 참조 유지
    }, 1000);
    // interval ID를 저장하지 않아 중단 불가
  }
}

// ✅ ID 저장 + destroy 메서드
class LiveData {
  constructor(element) {
    this.el = element;
    this.intervalId = setInterval(() => {
      this.el.textContent = fetchData();
    }, 1000);
  }
  destroy() {
    clearInterval(this.intervalId);
    this.el = null; // 참조 해제
  }
}
```

### 4. 무제한 캐시

```js
// ❌ 키가 계속 추가되어 메모리 무한 증가
const imageCache = {};
function loadImage(url) {
  if (imageCache[url]) return imageCache[url];
  const img = new Image();
  img.src = url;
  imageCache[url] = img; // 삭제되지 않음
  return img;
}

// ✅ WeakMap (키가 DOM 노드인 경우) — 키 소멸 시 자동 해제
const nodeData = new WeakMap();
function attachData(node, data) {
  nodeData.set(node, data); // node가 GC되면 데이터도 해제
}

// ✅ 크기 제한 캐시
const cache = new Map();
const MAX = 100;
function setCache(key, value) {
  if (cache.size >= MAX) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, value);
}
```

---

## Node.js 메모리 프로파일링

브라우저와 달리 Node.js에서는 `--inspect` 플래그로 같은 DevTools를 연결해 서버 사이드 메모리를 분석할 수 있습니다.

```bash
# Node.js 인스펙터 활성화
node --inspect --expose-gc app.js

# Chrome에서 chrome://inspect 열기 → Node 프로세스 클릭
# DevTools Memory 탭으로 힙 스냅샷 촬영 가능
```

```js
// 수동 GC 강제 실행 (--expose-gc 필요)
global.gc();
const heapBefore = process.memoryUsage().heapUsed;
doWork();
global.gc();
const heapAfter = process.memoryUsage().heapUsed;
console.log(`메모리 증가: ${((heapAfter - heapBefore) / 1024).toFixed(1)}KB`);
```

---

## 정리

메모리 누수 디버깅의 핵심은 **재현 → 측정 → 원인 추적** 순서입니다.

1. DevTools Memory 탭 → Heap Snapshot 비교로 누수 여부 확인
2. Allocation Timeline으로 GC 후에도 남는 객체 식별
3. Retainer 체인으로 참조 유지 경로 추적
4. 이벤트 리스너, 클로저, 타이머, 캐시에서 불필요한 참조 제거

---

**지난 글:** [Lighthouse와 WebPageTest — 성능 측정 도구 완전 정복](/posts/perf-lighthouse-webpagetest/)

**다음 글:** [CPU 프로파일링과 플레임 차트 — 병목 함수 찾기](/posts/perf-cpu-profiling-flame/)

<br>
읽어주셔서 감사합니다. 😊
