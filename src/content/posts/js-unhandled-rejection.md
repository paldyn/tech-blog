---
title: "미처리 Rejection — 전역 에러 경계 설계"
description: "미처리 Promise rejection이 발생하는 원인과 브라우저·Node.js에서 전역적으로 포착하는 방법을 정리합니다. 프로덕션 에러 모니터링 연동까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "unhandledRejection", "Promise", "전역에러", "에러모니터링", "Node.js", "브라우저"]
featured: false
draft: false
---

[지난 글](/posts/js-async-error-patterns/)에서 비동기 에러 처리 패턴을 살펴봤습니다. 이번에는 어떤 catch에도 걸리지 않은 **미처리 Promise rejection**이 어떻게 발생하고, 어떻게 전역적으로 포착하는지 다룹니다.

## 미처리 Rejection이 발생하는 경우

`catch` 없이 rejected Promise가 사라지면 미처리 rejection이 됩니다.

```js
// 케이스 1: await 없이 async 함수 호출
async function doWork() {
  throw new Error('작업 실패');
}
doWork(); // await도 없고 .catch()도 없음 → 미처리!

// 케이스 2: Promise 체인에 .catch 없음
fetch('/api/data')
  .then(r => r.json())
  // .catch()가 없으면 네트워크 오류가 미처리 rejection이 됨

// 케이스 3: Promise.all 내부 에러
const p = Promise.all([fetchA(), fetchB()]);
// p를 await 하거나 .catch()로 처리하지 않으면 미처리
```

![미처리 Rejection — 발생 경로와 감지](/assets/posts/js-unhandled-rejection-flow.svg)

## 브라우저: 미처리 Rejection 감지

브라우저에서는 `window`에 이벤트 리스너를 등록합니다.

```js
// Promise rejection 감지
window.addEventListener('unhandledrejection', event => {
  const error = event.reason; // rejected된 이유 (보통 Error 객체)
  console.error('미처리 rejection:', error);

  // Sentry 등으로 전송
  captureError(error, { type: 'unhandledRejection' });

  // 브라우저 콘솔 경고 억제 (선택 사항)
  event.preventDefault();
});

// 동기 에러 감지
window.addEventListener('error', event => {
  const error = event.error;
  console.error('미처리 에러:', error);
  captureError(error, { type: 'uncaughtError' });
});
```

`event.reason`은 `reject(reason)`에 넘긴 값으로, 보통 `Error` 객체입니다.

## Node.js: 미처리 Rejection 처리

```js
// 미처리 Promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('미처리 rejection', {
    reason: reason instanceof Error
      ? { message: reason.message, stack: reason.stack }
      : reason,
  });

  // 프로덕션에서는 즉시 종료 권장
  process.exit(1);
});

// 동기 uncaught exception
process.on('uncaughtException', (error) => {
  logger.fatal('포착되지 않은 예외', { error });
  process.exit(1);
});
```

Node.js 15+에서는 `unhandledRejection`이 기본적으로 프로세스를 종료합니다. `--unhandled-rejections=none` 플래그로 이전 동작으로 되돌릴 수 있지만 권장하지 않습니다.

![전역 에러 핸들러 — 브라우저 vs Node.js](/assets/posts/js-unhandled-rejection-handlers.svg)

## 리스너 등록 타이밍

전역 핸들러는 **가능한 한 빨리 등록**해야 합니다. 비동기 초기화 중에 발생한 에러는 리스너가 없으면 놓칩니다.

```js
// app.js — 가장 먼저 실행되는 파일
process.on('unhandledRejection', globalHandler);
process.on('uncaughtException', globalHandler);

// 이후에 나머지 초기화
import('./server.js').then(startServer);
```

## 이벤트 루프 흐름

```js
// 마이크로태스크 큐가 비워진 뒤 미처리 여부 검사
const p = Promise.reject(new Error('test'));

// 이 Promise.resolve().then(...)이 실행되기 전에
// unhandledRejection이 발생할 수 있음

// 해결책: 항상 즉시 .catch() 연결
const p = Promise.reject(new Error('test')).catch(handleError);
```

## rejectionhandled 이벤트

늦게 `.catch()`가 추가된 경우 `rejectionhandled` 이벤트로 이를 감지할 수 있습니다.

```js
window.addEventListener('rejectionhandled', event => {
  console.log('뒤늦게 처리된 rejection:', event.promise);
  // 이미 unhandledRejection으로 보고했다면 취소 로직
});
```

## 흔한 안티패턴

```js
// 1. 비동기 함수를 await 없이 호출
function init() {
  loadConfig(); // async 함수인데 await 없음
}

// 2. forEach 안에서 async
items.forEach(async item => {
  await process(item); // forEach는 반환된 Promise를 무시함
});
// 해결책: for...of 또는 Promise.all

// 3. 이벤트 핸들러에서 async
element.addEventListener('click', async (e) => {
  await doSomething(); // reject되면 미처리!
  // 해결책: try/catch 감싸기
});
```

## 프로덕션 에러 모니터링

```js
// Sentry 통합 예시
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: process.env.SENTRY_DSN });

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
  // Sentry가 플러시될 시간을 준 후 종료
  setTimeout(() => process.exit(1), 2000);
});
```

## 정리

- `await` 없는 async 호출, `.catch()` 없는 Promise가 미처리 rejection 주범
- 브라우저: `window.addEventListener('unhandledrejection', ...)`
- Node.js: `process.on('unhandledRejection', ...)`
- 전역 핸들러는 가능한 한 빨리 등록
- Node.js v15+: 기본적으로 프로세스 종료 — `process.exit(1)` 명시
- 프로덕션: Sentry/Datadog 연동으로 에러 추적
- `forEach` + async 조합, await 없는 async 호출 주의

---

**지난 글:** [비동기 에러 패턴 — 실전 설계 전략](/posts/js-async-error-patterns/)

**다음 글:** [메모리 모델 — 힙·스택·참조의 구조](/posts/js-memory-model/)

<br>
읽어주셔서 감사합니다. 😊
