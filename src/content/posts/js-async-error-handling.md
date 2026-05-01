---
title: "async/await 에러 처리 패턴 — try/catch·에러 래핑·fallback"
description: "async/await 환경에서 에러를 올바르게 처리하는 패턴(try/catch, Go스타일 튜플, 에러 래핑·재통, 미처리 rejection 감지)과 안티패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "async", "await", "에러 처리", "try/catch", "unhandledRejection", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/js-async-await-internals/)에서 async/await의 내부 동작과 직렬·병렬 패턴을 살펴봤습니다. 마지막으로 async/await 환경에서 에러를 어떻게 처리하고, 어디서 포착해야 하는지 실전 패턴을 정리합니다.

## 기본 패턴: try/catch/finally

`await` 표현식이 rejected Promise를 받으면 `throw`된 것처럼 동작합니다. 그래서 동기 코드와 동일한 `try/catch`로 처리할 수 있습니다.

```js
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    return user;
  } catch (e) {
    // fetchUser reject 시 여기로
    showError('사용자 로드 실패');
    return null;
  } finally {
    hideLoadingSpinner();
  }
}
```

`finally`는 성공/실패에 무관하게 항상 실행됩니다. 로딩 인디케이터, 연결 해제 같은 정리 작업에 적합합니다.

![async/await 에러 처리 패턴 네 가지](/assets/posts/js-async-error-handling-patterns.svg)

## Go 스타일 — 에러를 값으로

`try/catch`를 반복 사용하면 코드가 장황해집니다. 에러와 결과를 함께 반환하는 헬퍼를 만들면 깔끔해집니다.

```js
async function safe(promise) {
  return promise
    .then(value => [null, value])
    .catch(error => [error, null]);
}

// 사용
const [err, user] = await safe(fetchUser(id));
if (err) {
  log.error('사용자 로드 실패', err);
  return;
}

const [postsErr, posts] = await safe(fetchPosts(user.id));
// ...
```

이 패턴은 각 호출마다 에러를 명시적으로 확인하게 만들어, 에러를 조용히 삼키는 실수를 줄입니다.

## 에러 래핑 — 원인 추적

에러를 잡았을 때 그대로 re-throw 하면 어느 레이어에서 실패했는지 알기 어렵습니다. 에러를 래핑해서 `cause`로 원인을 보존하세요.

```js
class UserServiceError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'UserServiceError';
    this.cause = cause;
  }
}

async function getUser(id) {
  try {
    return await fetchUser(id);
  } catch (e) {
    throw new UserServiceError(`사용자 ${id} 로드 실패`, { cause: e });
  }
}
```

`instanceof`로 에러 종류를 구분하고, `e.cause`로 근본 원인을 추적할 수 있습니다.

```js
try {
  await getUser(id);
} catch (e) {
  if (e instanceof UserServiceError) {
    console.error(e.message, e.cause);
  } else {
    throw e; // 알 수 없는 에러는 재통
  }
}
```

## Fallback 패턴

실패해도 서비스를 계속 제공해야 할 때는 기본값으로 폴백합니다.

```js
async function getUserWithFallback(id) {
  try {
    return await fetchUser(id);
  } catch (e) {
    logger.warn('사용자 API 실패, 캐시 사용', e);
    return cache.getUser(id) ?? defaultUser;
  }
}
```

에러를 조용히 삼키지 말고 반드시 로깅하세요. 나중에 문제를 추적할 때 유일한 단서가 됩니다.

## 미처리 Rejection 감지

`await` 없이 async 함수를 호출하거나 `.catch` 없이 Promise를 만들면 미처리 rejection이 발생합니다.

```js
// 위험: rejection이 조용히 사라짐
async function doWork() { throw new Error('oops'); }
doWork(); // await 없음 → unhandledRejection
```

브라우저와 Node.js 모두 미처리 rejection 이벤트를 제공합니다.

```js
// 브라우저
window.addEventListener('unhandledrejection', event => {
  console.error('미처리 rejection:', event.reason);
  event.preventDefault(); // 콘솔 경고 억제
});

// Node.js
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('미처리 rejection', { reason });
  process.exit(1);
});
```

프로덕션에서는 Sentry 같은 에러 추적 서비스와 연동해서 미처리 rejection을 모니터링하세요.

![에러 경계와 복구 불가 에러 패턴](/assets/posts/js-async-error-handling-boundary.svg)

## 에러 처리 계층 설계

좋은 에러 처리는 계층별로 역할을 분리합니다.

```
UI 레이어:   사용자에게 표시할 메시지 결정
Service 레이어: 도메인 에러로 래핑
API 레이어:  네트워크 에러 분류 (4xx vs 5xx)
전역 핸들러: 미처리 rejection 로깅 + 알림
```

각 레이어는 자신이 처리할 수 있는 에러만 잡고, 나머지는 위로 전파해야 합니다. 모든 에러를 한 곳에서 삼키는 "god catch"는 디버깅을 극도로 어렵게 만듭니다.

## 흔한 안티패턴

```js
// 1. 에러 무시 (절대 금지)
fetchData().catch(() => {});

// 2. 에러를 console.log로만 처리
try {
  await fetchData();
} catch (e) {
  console.log(e); // 사용자는 실패를 모름
}

// 3. 에러 유형 확인 없는 전체 catch
try { /* ... */ } catch (e) {
  // TypeError든 NetworkError든 동일 처리
  showGenericError();
}
```

에러는 항상 (1) 기록하고, (2) 사용자에게 적절히 알리거나 폴백을 제공하고, (3) 가능하면 유형을 구분해서 처리하세요.

---

**지난 글:** [async/await 내부 동작 — 제너레이터와 Promise의 결합](/posts/js-async-await-internals/)

<br>
읽어주셔서 감사합니다. 😊
