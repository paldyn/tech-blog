---
title: "클로저와 메모리 누수 — 언제 문제가 되는가"
description: "클로저가 의도치 않게 대용량 객체나 DOM 요소를 참조 유지해 GC를 막는 패턴과, 이를 예방·수정하는 방법을 구체적인 코드로 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "클로저", "메모리누수", "GC", "가비지컬렉션", "이벤트리스너", "WeakMap"]
featured: false
draft: false
---

[지난 글](/posts/js-closure-patterns/)에서 클로저가 얼마나 강력한 패턴인지 살펴봤습니다. 그런데 클로저는 그 본질인 "외부 변수 참조 유지"가 곧 양날의 검입니다. 의도적으로 상태를 유지하는 것은 좋지만, 의도치 않게 불필요한 데이터를 메모리에 붙잡아 두면 **메모리 누수(Memory Leak)**가 발생합니다. JavaScript의 가비지 컬렉터는 완전히 자동이지만, 참조 사슬이 끊기지 않으면 아무리 정교한 GC도 메모리를 회수할 수 없습니다.

---

## GC와 클로저의 관계

V8의 가비지 컬렉터는 **Mark-and-Sweep** 방식을 사용합니다. GC 루트(전역 변수, 스택 변수)에서 도달 가능한 객체를 마킹하고, 마킹되지 않은 객체를 회수합니다.

클로저가 외부 변수를 참조하면, 그 클로저가 살아있는 한 외부 렉시컬 환경 전체(해당 변수를 포함)가 도달 가능 상태가 됩니다. 클로저가 실제로 그 변수를 사용하든 아니든 상관없이 환경 전체가 유지될 수 있습니다.

```javascript
function outer() {
  const largeData = new Array(1_000_000).fill('💾');
  const small = 'just a string';

  // largeData를 캡처한 클로저
  return () => console.log(small); // small만 쓰지만
  // 일부 엔진에서 largeData도 유지될 수 있음
}

const fn = outer(); // largeData가 GC 대상이 되지 않을 수 있음
```

최신 V8은 실제로 사용하는 변수만 캡처하도록 최적화하지만, 동일 스코프의 다른 함수가 `largeData`를 참조하면 상황이 달라집니다.

![GC와 클로저 — 참조 사슬](/assets/posts/js-closure-memory-leak-gc.svg)

---

## 패턴 1 — 이벤트 리스너 누수

DOM 이벤트 리스너는 가장 흔한 클로저 누수 원인입니다. 핸들러가 DOM 요소나 대형 데이터를 캡처하면, 핸들러가 제거되지 않는 한 메모리가 유지됩니다.

```javascript
// ❌ 익명 핸들러 → 제거 불가
function setupHandler() {
  const el = document.getElementById('button');
  const data = loadLargeData(); // 수 MB

  el.addEventListener('click', () => {
    console.log(el.id, data); // el과 data를 클로저로 캡처
  });
  // el이 DOM에서 제거되어도 핸들러가 el과 data를 참조
  // → GC 불가
}
```

```javascript
// ✓ named handler + 정리 함수
function setupHandler() {
  const el = document.getElementById('button');
  const data = loadLargeData();

  const handler = () => console.log(el.id, data);
  el.addEventListener('click', handler);

  return () => el.removeEventListener('click', handler); // 정리 함수
}

const cleanup = setupHandler();
// 필요 없어지면:
cleanup(); // 핸들러 제거 → el, data 참조 해제 → GC 가능
```

![클로저 메모리 누수 패턴과 해결](/assets/posts/js-closure-memory-leak-pattern.svg)

---

## 패턴 2 — 타이머 누수

`setInterval`은 명시적으로 `clearInterval`을 호출하지 않으면 영원히 실행됩니다. 콜백이 클로저를 통해 외부 데이터를 참조하면 그 데이터도 함께 유지됩니다.

```javascript
// ❌ clearInterval 없음 → 영구 실행 + 누수
function startPolling(url) {
  const cache = {}; // 계속 커질 수 있음

  setInterval(async () => {
    const data = await fetch(url).then(r => r.json());
    cache[Date.now()] = data; // cache가 클로저로 계속 살아있음
  }, 1000);
}
```

```javascript
// ✓ 정리 가능한 형태
function startPolling(url) {
  const cache = {};

  const id = setInterval(async () => {
    const data = await fetch(url).then(r => r.json());
    cache[Date.now()] = data;
  }, 1000);

  return () => clearInterval(id); // 정리 함수 반환
}

const stopPolling = startPolling('/api/data');
// 사용 완료 후:
stopPolling();
```

---

## 패턴 3 — 캐시 무한 증가

메모이제이션 캐시를 Map으로 구현하면 키가 계속 추가될 수 있습니다. 캐시 크기를 제한하지 않으면 메모리가 계속 증가합니다.

```javascript
// ❌ 캐시가 무한히 커짐
function memoize(fn) {
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) cache.set(key, fn(key));
    return cache.get(key);
  };
}

// ✓ LRU 방식으로 크기 제한
function memoizeWithLimit(fn, maxSize = 100) {
  const cache = new Map();
  return (key) => {
    if (cache.has(key)) {
      const val = cache.get(key);
      cache.delete(key);
      cache.set(key, val); // 최근 사용 순으로 이동
      return val;
    }
    const result = fn(key);
    if (cache.size >= maxSize) {
      // Map 순서 보장: 첫 번째 키(가장 오래된)를 삭제
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, result);
    return result;
  };
}
```

---

## WeakMap으로 약한 참조 활용

DOM 요소를 키로 데이터를 연결할 때 `Map` 대신 `WeakMap`을 쓰면, DOM 요소가 제거될 때 연결 데이터도 자동으로 GC됩니다.

```javascript
// ❌ Map: el이 DOM에서 제거되어도 Map이 참조 유지
const data = new Map();
data.set(domElement, { clicks: 0, history: [] });

// ✓ WeakMap: domElement가 사라지면 data도 GC 대상
const data = new WeakMap();
data.set(domElement, { clicks: 0, history: [] });
// domElement = null → GC 시 WeakMap 항목도 제거
```

`WeakMap`의 키는 GC 루트에서 도달 불가능해지면 `WeakMap`이 보유한 참조에도 불구하고 GC됩니다. 이를 **약한 참조(weak reference)**라고 합니다.

---

## React에서 useEffect 정리 함수

React에서 `useEffect`는 정리 함수를 반환할 수 있습니다. 이를 통해 이벤트 리스너, 타이머, 구독을 컴포넌트 언마운트 시 자동 해제합니다.

```javascript
useEffect(() => {
  const handler = (e) => console.log(e.key);
  window.addEventListener('keydown', handler);

  // 정리 함수: 언마운트 또는 다음 effect 실행 전 호출됨
  return () => window.removeEventListener('keydown', handler);
}, []);
```

정리 함수를 빠뜨리면 컴포넌트가 언마운트된 후에도 핸들러가 살아있어, 이미 사라진 컴포넌트의 state를 업데이트하려 해 경고가 발생합니다.

---

## 누수 진단 방법

Chrome DevTools의 **Memory 탭**에서 Heap Snapshot을 찍어 비교하거나, **Allocation Timeline**으로 메모리 증가 패턴을 확인할 수 있습니다.

```javascript
// 의도적 GC 트리거 (개발/테스트용)
// Node.js에서만 작동
if (global.gc) {
  global.gc(); // node --expose-gc 옵션 필요
}
```

실무에서는 페이지를 오래 열어두었을 때 메모리 사용량이 계속 증가하는지 Task Manager(Chrome: Shift+Esc)로 먼저 확인합니다.

---

## 핵심 체크리스트

| 상황 | 해결책 |
|------|--------|
| addEventListener | removeEventListener + 정리 함수 반환 |
| setInterval | clearInterval + 정리 함수 반환 |
| DOM 연결 데이터 | Map → WeakMap 교체 |
| 무한 캐시 | 크기 제한(LRU) 또는 TTL 적용 |
| React effect | return () => cleanup() 필수 |

---

**지난 글:** [클로저 패턴 — 실전 활용법](/posts/js-closure-patterns/)

**다음 글:** [this 규칙 완전 정복](/posts/js-this-rules/)

<br>
읽어주셔서 감사합니다. 😊
