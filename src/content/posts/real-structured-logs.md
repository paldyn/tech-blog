---
title: "구조화 로그 실전 — JSON 로그와 상관 ID"
description: "JSON 구조화 로그의 스키마 설계, traceId·spanId를 이용한 분산 추적, AsyncLocalStorage로 요청 컨텍스트를 함수 인자 없이 전파하는 방법, 로그 집계 도구 연동 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "구조화로그", "분산추적", "AsyncLocalStorage", "traceId", "Node.js", "실전", "Pino"]
featured: false
draft: false
---

[지난 글](/posts/real-logging/)에서 Pino·Winston을 사용해 레벨을 제어하고 민감 정보를 마스킹하는 방법을 살펴봤습니다. 이번에는 **구조화 로그**를 한 단계 더 깊게 다룹니다. JSON 로그 스키마 설계, 마이크로서비스 간 **상관 ID(Correlation ID)** 전파, `AsyncLocalStorage`로 컨텍스트를 자동으로 주입하는 패턴을 정리합니다.

![구조화 로그 JSON 스키마](/assets/posts/real-structured-logs-schema.svg)

## 왜 구조화 로그인가

```
# 비구조화 로그 — 검색 불가
[2026-05-24 10:00:00] INFO 사용자 42 로그인 성공 (duration: 82ms)

# 구조화 로그 — 필드별 필터·집계 가능
{"level":"info","time":"2026-05-24T10:00:00Z","msg":"사용자 로그인 성공","userId":42,"duration":82,"traceId":"a1b2c3"}
```

구조화 로그는 Datadog·CloudWatch·Elasticsearch 같은 로그 집계 플랫폼이 파싱·인덱싱할 수 있습니다. `userId=42`인 모든 요청, `duration>1000`인 느린 요청, `level=error`인 이벤트를 쿼리 한 줄로 찾을 수 있습니다.

---

## 표준 필드 스키마

팀 전체가 동일한 필드 이름을 사용해야 집계가 됩니다.

```javascript
// 모든 로그에 공통으로 포함할 기본 컨텍스트
const BASE_FIELDS = {
  service:     process.env.SERVICE_NAME ?? 'unknown',
  environment: process.env.NODE_ENV ?? 'development',
  version:     process.env.APP_VERSION ?? '0.0.0',
  hostname:    os.hostname(),
};

const logger = pino({
  base: BASE_FIELDS, // 모든 로그에 자동 포함
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `time` | string (ISO8601) | 이벤트 발생 시각 |
| `level` | string / number | 로그 레벨 |
| `msg` | string | 정적 이벤트 설명 |
| `service` | string | 서비스·컴포넌트 이름 |
| `traceId` | string (UUID) | 분산 추적 루트 ID |
| `requestId` | string | HTTP 요청 단위 ID |
| `userId` | number/string | 인증된 사용자 |
| `duration` | number (ms) | 작업 소요 시간 |
| `err` | object | 에러 (name, message, stack) |

---

## 상관 ID(Correlation ID) — 분산 추적

![상관 ID를 통한 분산 추적](/assets/posts/real-structured-logs-correlation.svg)

마이크로서비스 환경에서 하나의 사용자 요청이 여러 서비스를 거칩니다. `traceId`를 HTTP 헤더로 전파하면 서비스마다 흩어진 로그를 하나의 요청으로 추적할 수 있습니다.

```javascript
// API Gateway — traceId 생성 및 전파
import { randomUUID } from 'crypto';

export function correlationMiddleware(req, res, next) {
  const traceId   = req.headers['x-trace-id']   ?? randomUUID();
  const requestId = req.headers['x-request-id'] ?? randomUUID();

  // 응답 헤더에도 포함 (클라이언트가 추적할 수 있도록)
  res.setHeader('x-trace-id',   traceId);
  res.setHeader('x-request-id', requestId);

  req.traceId   = traceId;
  req.requestId = requestId;

  // 하위 서비스 호출 시 헤더 전달
  req.propagationHeaders = {
    'x-trace-id':   traceId,
    'x-request-id': requestId,
  };

  next();
}

// 하위 서비스 호출 시
const response = await fetch(`${USER_SERVICE_URL}/users/${id}`, {
  headers: {
    ...req.propagationHeaders,
    Authorization: `Bearer ${token}`,
  },
});
```

---

## AsyncLocalStorage — 컨텍스트 자동 전파

요청 컨텍스트(`traceId`, `userId` 등)를 모든 함수에 인자로 전달하면 코드가 복잡해집니다. `AsyncLocalStorage`는 비동기 컨텍스트를 **자동으로** 하위 호출까지 전달합니다.

```javascript
import { AsyncLocalStorage } from 'async_hooks';

// 전역 컨텍스트 스토어
export const requestContext = new AsyncLocalStorage();

// 미들웨어: 요청 컨텍스트 저장
export function contextMiddleware(req, res, next) {
  const ctx = {
    traceId:   req.traceId,
    requestId: req.requestId,
    userId:    req.user?.id,
    startTime: Date.now(),
  };

  // 이 콜백 안의 모든 비동기 코드가 ctx를 상속
  requestContext.run(ctx, next);
}

// 컨텍스트 주입 로거
export function getLogger() {
  const ctx = requestContext.getStore() ?? {};
  return logger.child(ctx); // traceId·requestId 자동 포함
}
```

```javascript
// 라우트 핸들러 — 인자 없이 컨텍스트 사용
async function getUser(req, res) {
  const log = getLogger(); // req를 인자로 안 받아도 traceId 포함
  log.info({ targetId: req.params.id }, 'getUser 시작');

  const user = await UserRepository.findById(req.params.id);
  // UserRepository 내부에서도 getLogger()를 호출하면 같은 traceId
  log.info({ found: !!user }, 'getUser 완료');

  res.json(user);
}
```

```javascript
// Repository 내부 — req.log를 인자로 받지 않아도 됨
class UserRepository {
  static async findById(id) {
    const log = getLogger(); // AsyncLocalStorage에서 자동 조회
    log.debug({ id }, 'DB 쿼리 실행');
    return db.query('SELECT * FROM users WHERE id = $1', [id]);
  }
}
```

Express + Node.js에서 `AsyncLocalStorage`를 사용하면 미들웨어 단계에서 한 번 설정한 컨텍스트가 그 요청의 모든 비동기 콜백에 자동으로 전달됩니다.

---

## 에러 로그 표준화

```javascript
// 에러를 구조화하는 헬퍼
function serializeError(err) {
  return {
    name:    err.name,
    message: err.message,
    code:    err.code,
    stack:   err.stack?.split('\n').slice(0, 5).join('\n'), // 5줄만
    cause:   err.cause ? serializeError(err.cause) : undefined,
  };
}

// Express 전역 에러 핸들러
app.use((err, req, res, next) => {
  const log = getLogger();
  const status = err.status ?? 500;

  log.error({
    err:        serializeError(err),
    statusCode: status,
    path:       req.path,
    method:     req.method,
  }, '처리되지 않은 에러');

  if (status >= 500) {
    // Sentry·PagerDuty 알림 트리거
    alerting.notify(err);
  }

  res.status(status).json({
    error:     err.message,
    requestId: req.requestId, // 사용자가 지원팀에 전달할 수 있도록
  });
});
```

---

## 로그 집계 도구 쿼리 예시

```bash
# CloudWatch Insights — traceId로 전체 요청 추적
filter traceId = "a1b2c3d4"
| sort time asc
| fields time, service, level, msg, duration

# 느린 요청 탐지
filter duration > 1000
| stats avg(duration), count(*) by path
| sort avg(duration) desc

# 에러율 집계
filter level = "error"
| stats count(*) as errorCount by service, bin(5m)
```

---

**지난 글:** [로깅 실전 — 레벨 전략과 구조화 로그](/posts/real-logging/)

**다음 글:** [토큰 저장 전략 — 브라우저에서 인증 토큰 안전하게 관리하기](/posts/real-token-storage/)

<br>
읽어주셔서 감사합니다. 😊
