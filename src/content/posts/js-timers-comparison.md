---
title: "타이머 완전 비교 — setTimeout·setInterval·queueMicrotask·rAF"
description: "JavaScript의 주요 스케줄링 API(setTimeout, setInterval, queueMicrotask, requestAnimationFrame, requestIdleCallback)의 동작 차이, 최소 지연, 드리프트 문제, 올바른 사용 패턴을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "setTimeout", "setInterval", "requestAnimationFrame", "queueMicrotask", "타이머", "스케줄링"]
featured: false
draft: false
---

[지난 글](/posts/js-event-loop/)에서 이벤트 루프의 실행 순서(매크로태스크 → 마이크로태스크 → 렌더링)를 살펴봤습니다. 이번에는 그 큐에 작업을 등록하는 다양한 스케줄링 API를 비교합니다. 언제 어떤 API를 쓰느냐에 따라 실행 타이밍과 성능이 크게 달라집니다.

## setTimeout

가장 기본적인 비동기 스케줄링입니다. 지정한 시간(밀리초) 후에 콜백을 Task Queue에 등록합니다.

```js
const id = setTimeout(() => console.log('1초 후'), 1000);
clearTimeout(id); // 취소
```

**최소 지연**: 중첩 `setTimeout`이 5단계 이상 깊어지면 브라우저는 최소 4ms 지연을 강제합니다. 비활성 탭에서는 1000ms 이상으로 스로틀됩니다.

**0ms의 진실**: `setTimeout(fn, 0)`도 현재 콜 스택이 비워진 후, 마이크로태스크가 모두 소진된 후에야 실행됩니다. 즉시 실행이 아닙니다.

## setInterval

일정 간격으로 콜백을 반복 실행합니다. 하지만 중요한 함정이 있습니다.

```js
const id = setInterval(() => doWork(), 200);
clearInterval(id); // 정지
```

`setInterval`은 **이전 콜백의 완료 여부와 무관하게** 200ms마다 콜백을 Queue에 추가합니다. 콜백 실행 시간이 간격보다 길면 콜백이 적체됩니다.

![setInterval 드리프트와 setTimeout 재귀 패턴](/assets/posts/js-timers-comparison-drift.svg)

반복 작업에서 안전한 패턴은 **setTimeout 재귀**입니다.

```js
function tick() {
  doWork();
  setTimeout(tick, 200); // 완료 후 200ms 대기
}
setTimeout(tick, 200);
```

이 패턴은 이전 작업이 끝난 후에만 다음을 예약하므로 절대 적체되지 않습니다.

## queueMicrotask

Promise를 만들지 않고 마이크로태스크를 등록하는 저수준 API입니다.

```js
queueMicrotask(() => console.log('마이크로태스크'));
console.log('동기');
// 출력: 동기 → 마이크로태스크
```

`Promise.resolve().then(fn)`과 동일하게 동작하지만 Promise 객체 생성 오버헤드가 없습니다. 라이브러리 내부에서 일관된 비동기 실행을 보장할 때 유용합니다.

주의: 마이크로태스크 기아를 유발할 수 있으므로 재귀적으로 사용하지 않아야 합니다.

## requestAnimationFrame (rAF)

브라우저의 렌더링 사이클(보통 ~16ms, 60fps)에 동기화된 콜백을 등록합니다.

```js
function animate(timestamp) {
  const elapsed = timestamp - start;
  element.style.transform = `translateX(${elapsed * 0.1}px)`;
  requestAnimationFrame(animate);
}
const start = performance.now();
requestAnimationFrame(animate);
```

rAF의 장점:
- 렌더링 직전에 실행되어 레이아웃 스래싱 최소화
- 비활성 탭에서 자동으로 일시 중지 (배터리 절약)
- `timestamp` 인자로 고정밀 타이밍 제공

DOM 변경을 배치 처리하거나 `getBoundingClientRect()`로 읽은 후 즉시 쓰는 패턴에도 적합합니다.

## requestIdleCallback (rIC)

브라우저가 유휴 상태일 때 작업을 실행합니다. 우선순위가 낮은 백그라운드 작업에 적합합니다.

```js
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && tasks.length > 0) {
    processTask(tasks.shift());
  }
  if (tasks.length > 0) {
    requestIdleCallback(processTask); // 남은 작업 다음 유휴 시간에
  }
}, { timeout: 2000 }); // 최대 2초 내 강제 실행
```

`deadline.timeRemaining()`으로 남은 유휴 시간을 확인하며 작업을 분산합니다. `timeout` 옵션 없이는 실행이 매우 지연될 수 있습니다.

## 비교 요약

![타이머 API 비교표](/assets/posts/js-timers-comparison-table.svg)

실행 우선순위 요약:

```
동기 코드 → queueMicrotask/Promise.then → rAF → setTimeout/setInterval → rIC
```

## 언제 무엇을 쓰나

| 상황 | 추천 API |
|---|---|
| 비동기이지만 즉시 실행되어야 함 | `Promise.resolve().then()` 또는 `queueMicrotask` |
| UI 렌더링 직전 DOM 변경 | `requestAnimationFrame` |
| 일정 시간 후 한 번 실행 | `setTimeout` |
| 안전한 반복 실행 | `setTimeout` 재귀 |
| 낮은 우선순위 백그라운드 작업 | `requestIdleCallback` |

올바른 스케줄링 API 선택만으로도 UI 부드러움과 성능이 크게 개선됩니다. 특히 애니메이션에는 항상 `requestAnimationFrame`을, 반복 폴링에는 `setInterval` 대신 `setTimeout` 재귀를 사용하세요.

---

**지난 글:** [이벤트 루프 완전 해부 — 태스크·마이크로태스크·렌더링](/posts/js-event-loop/)

**다음 글:** [Promise 상태 — pending·fulfilled·rejected의 전이](/posts/js-promise-states/)

<br>
읽어주셔서 감사합니다. 😊
