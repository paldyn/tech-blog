---
title: "requestAnimationFrame · requestIdleCallback 완전 이해"
description: "rAF로 60fps 애니메이션 루프를 만드는 방법, rIC로 유휴 시간을 활용하는 패턴, 렌더링 파이프라인에서의 실행 위치, rIC 폴리필까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "requestAnimationFrame", "requestIdleCallback", "애니메이션", "성능", "브라우저", "렌더링"]
featured: false
draft: false
---

[지난 글](/posts/browser-performance-api/)에서 Performance API를 살펴봤습니다. 이번에는 브라우저 렌더링 루프와 연동해 **최적의 타이밍에 코드를 실행**하는 두 API — `requestAnimationFrame`(rAF)과 `requestIdleCallback`(rIC) — 를 정리합니다.

---

## 왜 setTimeout으로 애니메이션을 만들면 안 되나

`setTimeout(callback, 16)` 방식은 두 가지 문제가 있습니다.

1. **타이밍 불일치**: setTimeout은 이벤트 루프의 매크로태스크 큐에서 실행됩니다. 브라우저가 렌더링을 마친 직후가 아닐 수 있어 프레임이 건너뛰거나 두 번 그려집니다.
2. **백그라운드 탭 낭비**: 탭이 숨겨져 있어도 계속 실행됩니다.

`requestAnimationFrame`은 브라우저가 **다음 프레임을 그리기 직전**에 정확히 호출해줍니다. 탭이 숨겨지면 자동으로 멈춥니다.

---

## requestAnimationFrame 기본

```js
let rafId;

function draw(timestamp) {
  // timestamp: DOMHighResTimeStamp (ms, 소수점 포함)
  console.log(`렌더링: ${timestamp.toFixed(2)}ms`);
  // 다음 프레임 요청
  rafId = requestAnimationFrame(draw);
}

// 시작
rafId = requestAnimationFrame(draw);

// 취소
cancelAnimationFrame(rafId);
```

---

## rAF로 애니메이션 루프 만들기

![requestAnimationFrame 애니메이션 루프](/assets/posts/browser-raf-ric-animation.svg)

```js
function animate(element, duration = 1000) {
  let startTime = null;
  let rafId;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);

    element.style.opacity = String(progress);

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    }
  }

  rafId = requestAnimationFrame(step);
  return () => cancelAnimationFrame(rafId); // 취소 함수 반환
}

const stop = animate(document.getElementById('box'));
// 필요 시 stop() 호출
```

`startTime`을 첫 콜백에서 초기화하는 이유: `requestAnimationFrame`이 큐에 등록된 시점과 실제 호출 시점 사이에 지연이 있을 수 있기 때문입니다.

---

## 렌더링 루프에서의 위치

![rAF · rIC 렌더링 루프](/assets/posts/browser-raf-ric-loop.svg)

rAF 콜백은 렌더링 파이프라인(Style → Layout → Paint) **직전**에 실행됩니다. 이 위치에서 DOM을 변경하면 브라우저가 즉시 반영합니다.

---

## Layout Thrashing 방지

rAF 내에서 읽기(getBoundingClientRect)와 쓰기(style 변경)를 번갈아 하면 **레이아웃 재계산**이 반복 발생합니다.

```js
// ❌ 나쁜 패턴 — 읽기/쓰기 혼용
requestAnimationFrame(() => {
  elements.forEach((el) => {
    const { width } = el.getBoundingClientRect(); // 레이아웃 강제
    el.style.width = `${width * 1.1}px`; // 레이아웃 무효화
  });
});

// ✅ 좋은 패턴 — 읽기 일괄 → 쓰기 일괄
requestAnimationFrame(() => {
  const widths = elements.map((el) => el.getBoundingClientRect().width);
  elements.forEach((el, i) => {
    el.style.width = `${widths[i] * 1.1}px`;
  });
});
```

---

## requestIdleCallback — 유휴 시간 활용

rIC는 브라우저가 현재 프레임 렌더링을 마치고 **남은 시간(유휴 시간)**에 콜백을 실행합니다. 긴급하지 않은 작업(프리패치, 로깅, 분석)에 적합합니다.

```js
requestIdleCallback(
  (deadline) => {
    // deadline.timeRemaining(): 현재 유휴 시간 남은 ms
    // deadline.didTimeout: true면 timeout 초과로 강제 실행
    while (deadline.timeRemaining() > 0 && tasks.length > 0) {
      processTask(tasks.shift()); // 유휴 시간이 있는 동안 태스크 처리
    }
    if (tasks.length > 0) {
      requestIdleCallback(processTasksWhenIdle); // 남은 태스크 다음 유휴 시간에
    }
  },
  { timeout: 2000 } // 최대 2초 대기 후 강제 실행
);
```

**`deadline.timeRemaining()`** 이 0에 가까워지면 즉시 멈추고 다음 rIC로 미루는 것이 핵심입니다. 유휴 시간을 초과하면 프레임 드랍이 발생합니다.

---

## 작업 분할 패턴

```js
function processLargeArray(items, processItem) {
  const CHUNK_DEADLINE_BUFFER = 1; // 1ms 여유 확보

  return new Promise((resolve) => {
    const remaining = [...items];

    function scheduleChunk(deadline) {
      while (
        remaining.length > 0 &&
        deadline.timeRemaining() > CHUNK_DEADLINE_BUFFER
      ) {
        processItem(remaining.shift());
      }
      if (remaining.length > 0) {
        requestIdleCallback(scheduleChunk);
      } else {
        resolve();
      }
    }

    requestIdleCallback(scheduleChunk);
  });
}
```

---

## rIC 폴리필 (Safari 대응)

`requestIdleCallback`은 Safari에서 지원되지 않습니다(2026년 기준). `setTimeout`으로 간단히 대체합니다.

```js
const rIC = window.requestIdleCallback
  ?? ((cb, opts) => {
       const start = Date.now();
       return setTimeout(() => {
         cb({
           didTimeout: false,
           timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
         });
       }, opts?.timeout ?? 1);
     });

const cIC = window.cancelIdleCallback ?? clearTimeout;
```

---

## rAF vs rIC — 언제 무엇을?

| 기준 | requestAnimationFrame | requestIdleCallback |
|------|----------------------|---------------------|
| 실행 시점 | 다음 프레임 직전 | 프레임 후 유휴 시간 |
| 적합한 작업 | 애니메이션, DOM 변경, 캔버스 | 로깅, 분석, 프리패치 |
| 탭 비활성 시 | 자동 중단 | 실행 중단 가능 |
| 타임아웃 | 없음 | `options.timeout` |
| Safari 지원 | ✅ | ❌ (폴리필 필요) |

---

**지난 글:** [Performance API 완전 이해](/posts/browser-performance-api/)

**다음 글:** [Fetch API 완전 이해](/posts/net-fetch-master/)

<br>
읽어주셔서 감사합니다. 😊
