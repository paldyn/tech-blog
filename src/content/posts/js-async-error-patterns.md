---
title: "비동기 에러 패턴 — 실전 설계 전략"
description: "재시도, 서킷 브레이커, Fallback, 에러 경계 등 비동기 에러 처리의 핵심 패턴을 정리합니다. 계층별 역할 분리로 견고한 에러 처리 구조를 설계합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "에러처리", "재시도", "서킷브레이커", "Fallback", "비동기", "패턴"]
featured: false
draft: false
---

[지난 글](/posts/js-aggregate-error/)에서 `AggregateError`로 여러 에러를 묶는 방법을 살펴봤습니다. 이번에는 프로덕션 환경에서 비동기 에러를 처리하는 대표적인 패턴 네 가지와 계층 설계 전략을 다룹니다.

## 패턴 1 — 재시도 (Retry)

일시적인 네트워크 오류나 서버 과부하는 재시도로 해결할 수 있습니다.

```js
async function retry(fn, maxAttempts = 3, delay = 500) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts - 1) {
        // 지수 백오프: 500ms, 1000ms, 2000ms
        await sleep(delay * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

// 사용
const data = await retry(
  () => fetch('/api/data').then(r => r.json()),
  3,     // 최대 3회
  500    // 초기 지연 500ms
);
```

재시도 시 **지수 백오프(exponential backoff)**를 적용하면 서버 과부하를 줄일 수 있습니다. 429(Too Many Requests)나 503(Service Unavailable) 에러에만 재시도하고, 400/401/403은 재시도해도 의미 없으므로 즉시 throw합니다.

![비동기 에러 처리 4가지 패턴](/assets/posts/js-async-error-patterns-overview.svg)

## 패턴 2 — 서킷 브레이커 (Circuit Breaker)

연속으로 실패가 쌓이면 더 이상 서버에 요청을 보내지 않고 즉시 에러를 반환합니다.

```js
class CircuitBreaker {
  #state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
  #failures = 0;
  #threshold = 5;
  #cooldown = 30_000; // 30초
  #openAt = null;

  async call(fn) {
    if (this.#state === 'OPEN') {
      const elapsed = Date.now() - this.#openAt;
      if (elapsed < this.#cooldown) {
        throw new Error('Circuit open — 서비스 일시 차단');
      }
      this.#state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.#onSuccess();
      return result;
    } catch (e) {
      this.#onFailure();
      throw e;
    }
  }

  #onSuccess() {
    this.#failures = 0;
    this.#state = 'CLOSED';
  }

  #onFailure() {
    this.#failures++;
    if (this.#failures >= this.#threshold) {
      this.#state = 'OPEN';
      this.#openAt = Date.now();
    }
  }
}
```

서킷이 `OPEN` 상태에서는 함수를 실행하지 않고 즉시 에러를 반환하므로 다운된 서버에 요청이 쏟아지는 것을 막습니다.

## 패턴 3 — Fallback (대체값)

실패 시 기본값이나 캐시 데이터를 반환해서 서비스를 계속 제공합니다.

```js
async function withFallback(fn, fallback) {
  try {
    return await fn();
  } catch (e) {
    logger.warn('API 실패, fallback 사용', e);
    return typeof fallback === 'function' ? fallback(e) : fallback;
  }
}

// 사용
const user = await withFallback(
  () => fetchUser(id),
  cache.getUser(id) ?? DEFAULT_USER
);
```

fallback을 적용할 때는 **반드시 로깅**하세요. 에러를 조용히 숨기면 프로덕션 문제를 늦게 발견합니다.

## 패턴 4 — 에러 경계 (Error Boundary)

전체 애플리케이션의 최상단에서 미처리 에러를 포착합니다.

```js
// Express 에러 미들웨어
app.use((err, req, res, next) => {
  logger.error('미처리 에러', err);
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
  }
  res.status(500).json({ error: 'InternalServerError' });
});

// 전역 Promise rejection 처리
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('미처리 rejection', { reason });
  // 심각한 에러는 프로세스 종료
  process.exit(1);
});
```

## 에러 처리 계층 설계

각 계층은 자신이 처리할 수 있는 에러만 처리하고, 나머지는 위로 전파합니다.

![에러 처리 계층 설계](/assets/posts/js-async-error-layer.svg)

```
API 계층:    HTTP 상태 코드 → 도메인 에러 변환
서비스 계층: 도메인 에러로 래핑 + 재시도/fallback
UI 계층:     AppError → 사용자 메시지 표시
전역 핸들러: 미처리 에러 로깅 + 알림
```

**중요 원칙**: 처리하지 못하는 에러는 **반드시** `throw e`로 상위에 전파합니다. 모든 것을 catch하는 "god catch"는 디버깅을 불가능하게 만듭니다.

## 재시도 vs 서킷 브레이커 선택

| 상황 | 권장 패턴 |
|------|----------|
| 일시적 네트워크 오류 | 재시도 + 지수 백오프 |
| 서버 계속 실패 중 | 서킷 브레이커 |
| 선택적 기능 실패 | Fallback |
| 전체 기능 실패 | 에러 경계 + 에러 UI |
| 사용자 입력 오류 | 재시도 없이 즉시 에러 표시 |

## 실전 조합 패턴

재시도와 서킷 브레이커를 함께 사용합니다.

```js
const breaker = new CircuitBreaker();

async function robustFetch(url) {
  return breaker.call(() =>
    retry(
      () => fetch(url).then(r => {
        if (!r.ok) throw new NetworkError(`HTTP ${r.status}`);
        return r.json();
      }),
      3,
      1000
    )
  );
}
```

## 정리

- **재시도**: 일시적 오류 → 지수 백오프로 n회 반복
- **서킷 브레이커**: 반복 실패 → 서버 요청 차단, cooldown 후 복구 시도
- **Fallback**: 실패 → 캐시/기본값, 반드시 로깅
- **에러 경계**: 전체 앱 최상단 → 미처리 에러 포착
- 계층별 역할 분리 + 처리 못하는 에러는 상위로 전파

---

**지난 글:** [AggregateError — 여러 에러를 하나로](/posts/js-aggregate-error/)

**다음 글:** [미처리 Rejection — 전역 에러 경계 설계](/posts/js-unhandled-rejection/)

<br>
읽어주셔서 감사합니다. 😊
