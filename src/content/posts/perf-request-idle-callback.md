---
title: "requestIdleCallback — 유휴 시간 활용"
description: "requestIdleCallback API의 동작 원리, IdleDeadline.timeRemaining()으로 작업을 나누는 방법, 적합한 사용 사례, Safari 폴백 패턴, requestAnimationFrame과의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "성능", "requestIdleCallback", "유휴시간", "프레임", "브라우저", "최적화"]
featured: false
draft: false
series:
  id: "javascript"
  title: "JavaScript 완전 정복"
prev:
  slug: "perf-memoization-pattern"
  title: "메모이제이션 패턴 — 계산 결과 캐싱으로 성능 향상"
next:
  slug: "perf-image-lazy-load"
  title: "이미지 지연 로딩 — Intersection Observer와 loading 속성"
---

[지난 글](/posts/perf-memoization-pattern/)에서 계산 결과를 캐싱해 반복 연산을 줄이는 메모이제이션을 살펴봤습니다. 이번에는 비핵심 작업을 메인 스레드 **유휴 시간에 밀어 넣어** 사용자 인터랙션에 방해를 주지 않는 `requestIdleCallback` API를 다룹니다.

---

## 왜 필요한가

브라우저의 메인 스레드는 JavaScript 실행, 스타일 계산, 레이아웃, 페인트, 합성을 모두 담당합니다. 60fps 기준으로 한 프레임은 약 16.67ms입니다. JS 실행과 렌더링이 이 시간 안에 끝나면 남은 시간이 **유휴 시간**으로 생깁니다.

분석 이벤트 전송, 캐시 사전 채우기, 로그 전송처럼 **지금 당장 화면에 영향을 주지 않는** 작업을 이 유휴 시간에 실행하면 메인 스레드를 낭비하지 않으면서도 사용자 경험을 해치지 않습니다.

![requestIdleCallback 프레임 유휴 타임라인](/assets/posts/perf-request-idle-callback-timeline.svg)

---

## 기본 사용법

```js
requestIdleCallback((deadline) => {
  // timeRemaining(): 현재 유휴 기간의 남은 시간 (ms)
  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    const task = tasks.shift();
    processTask(task);
  }

  // 처리 못 한 작업이 남아 있으면 다음 유휴에 예약
  if (tasks.length > 0) {
    requestIdleCallback(/* 이 함수 자신 */);
  }
});
```

`deadline.timeRemaining()`이 `0`이 되기 전에 루프를 중단하고, 남은 작업은 다음 유휴 콜백으로 미룹니다. 이렇게 하면 작업을 여러 프레임에 걸쳐 분산시킬 수 있습니다.

---

## 대용량 데이터 청크 처리

```js
function processLargeList(items) {
  let index = 0;

  function processBatch(deadline) {
    while (index < items.length && deadline.timeRemaining() > 1) {
      processItem(items[index]);
      index++;
    }
    if (index < items.length) {
      requestIdleCallback(processBatch);
    } else {
      console.log('모든 항목 처리 완료');
    }
  }

  requestIdleCallback(processBatch);
}

// 10000개 항목을 유휴 시간에 나눠서 처리
processLargeList(Array.from({ length: 10000 }, (_, i) => i));
```

한 번에 10000개를 동기로 처리하면 메인 스레드가 수백 ms 동안 멈춥니다. `requestIdleCallback`을 이용하면 각 유휴 기간에 처리 가능한 만큼만 처리하고 나머지는 다음 기회로 넘깁니다.

---

## timeout 옵션

유휴 시간이 오랫동안 생기지 않을 수 있습니다. 예를 들어 사용자가 연속으로 스크롤하는 동안은 매 프레임이 꽉 찰 수 있습니다. `timeout` 옵션을 설정하면 유휴가 발생하지 않더라도 지정된 시간 후에 강제 실행됩니다.

```js
requestIdleCallback(sendAnalyticsData, { timeout: 2000 });
// 최대 2초 기다리고, 유휴가 없어도 강제로 콜백 실행
```

강제 실행 시에는 `deadline.timeRemaining()`이 `0`을 반환하며, `deadline.didTimeout`이 `true`가 됩니다.

```js
requestIdleCallback((deadline) => {
  if (deadline.didTimeout) {
    // 유휴 없이 강제 실행 — 짧게 처리
    sendCriticalAnalytics();
  } else {
    // 여유 있게 처리
    sendFullAnalytics();
  }
}, { timeout: 1000 });
```

---

## requestAnimationFrame과의 차이

```js
// requestAnimationFrame — 다음 렌더 프레임 직전
requestAnimationFrame(() => {
  // 반드시 다음 프레임에 실행, 렌더링과 동기화
  element.style.transform = `translateX(${x}px)`;
});

// requestIdleCallback — 프레임 이후 남은 여유 시간
requestIdleCallback(() => {
  // 렌더와 무관, 시각적 변화 없는 작업만
  storeToIndexedDB(data);
});
```

| | rAF | rIC |
|---|---|---|
| 실행 시점 | 다음 렌더 직전 (매 프레임 보장) | 프레임 유휴 시 (보장 없음) |
| 주 용도 | 애니메이션, 렌더 동기화 | 비핵심 백그라운드 작업 |
| 시각적 변화 | 적합 | 부적합 |

---

## 사용 패턴과 주의사항

![rIC 사용 사례·주의사항](/assets/posts/perf-request-idle-callback-patterns.svg)

---

## Safari 폴백

`requestIdleCallback`은 Firefox, Chrome, Edge에서 지원되지만 **Safari에서는 미지원**입니다(2026년 현재 지원 없음). 폴백이 없으면 Safari에서 에러가 발생합니다.

```js
const requestIdle = typeof requestIdleCallback !== 'undefined'
  ? requestIdleCallback
  : (cb, opts) => {
      const id = setTimeout(
        () => cb({ timeRemaining: () => 50, didTimeout: false }),
        opts?.timeout ?? 1
      );
      return id;
    };

const cancelIdle = typeof cancelIdleCallback !== 'undefined'
  ? cancelIdleCallback
  : clearTimeout;
```

폴백에서는 항상 50ms의 여유가 있다고 가정합니다. Safari에서도 비핵심 작업이 실행되지만 유휴 감지 없이 setTimeout으로 처리됩니다.

---

## 정리

`requestIdleCallback`은 사용자 인터랙션에 전혀 영향을 주지 않으면서 백그라운드 작업을 처리할 수 있는 API입니다.

- 분석, 로그, 프리페치처럼 즉각성이 필요 없는 작업에 적합합니다.
- `deadline.timeRemaining()`으로 작업을 잘라서 여러 유휴 기간에 분산시킵니다.
- 시각적 변화나 애니메이션에는 `requestAnimationFrame`을 씁니다.
- `timeout` 옵션으로 무한 지연을 방지하고, Safari 폴백을 항상 포함합니다.

---

**지난 글:** [메모이제이션 패턴 — 계산 결과 캐싱으로 성능 향상](/posts/perf-memoization-pattern/)

**다음 글:** [이미지 지연 로딩 — Intersection Observer와 loading 속성](/posts/perf-image-lazy-load/)

<br>
읽어주셔서 감사합니다. 😊
