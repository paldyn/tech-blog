---
title: "로깅 실전 — 레벨 전략과 구조화 로그"
description: "console.log에서 벗어나 Pino·Winston 같은 구조화 로거를 사용하는 방법, 로그 레벨 전략, redact로 민감 정보를 제거하는 방법, 자식 로거와 요청 컨텍스트 전파 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "로깅", "Pino", "Winston", "구조화로그", "Node.js", "실전", "모니터링"]
featured: false
draft: false
---

[지난 글](/posts/real-config-priority/)에서 설정 우선순위와 오버라이드 전략을 살펴봤습니다. 이번에는 **로깅(Logging)**입니다. 프로덕션에서 버그를 추적하거나 성능을 분석하려면 `console.log`보다 훨씬 정교한 도구가 필요합니다. 레벨 제어·구조화 출력·민감 정보 제거·컨텍스트 전파를 갖춘 로깅 전략을 정리합니다.

![로그 레벨과 출력 전략](/assets/posts/real-logging-levels.svg)

## console.log의 한계

```javascript
// 프로덕션에서 이렇게 쓰면 안 되는 이유
console.log('사용자 로그인:', user.id, user.email, token); // 토큰 노출!
console.log('DB 쿼리:', sql, params); // 민감 데이터 노출
console.log('오류 발생:', error); // 레벨 구분 없음, 검색 불가
```

- **레벨 없음**: debug·info·warn·error를 구분할 수 없어 필터링이 불가능합니다
- **구조화 없음**: 자유 형식 텍스트는 로그 집계 도구(Datadog, CloudWatch)가 파싱하기 어렵습니다
- **민감 정보**: 토큰·비밀번호가 로그에 평문으로 남습니다
- **성능**: 동기 I/O인 console.log는 프로덕션 고부하에서 병목이 됩니다

---

## Pino — 빠른 JSON 로거

Pino는 Node.js에서 가장 빠른 로거 중 하나입니다. JSON 출력이 기본이라 로그 집계 도구와 잘 통합됩니다.

```bash
npm install pino pino-pretty
```

![Pino 로거 설정과 구조화 로그](/assets/posts/real-logging-pino.svg)

```javascript
// src/logger.js
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'warn'),

  // 개발: 사람이 읽기 쉬운 출력 / 프로덕션: JSON (로그 수집기용)
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,

  // 민감 정보 자동 마스킹
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.token',
      '*.secret',
      '*.creditCard',
    ],
    censor: '[REDACTED]',
  },
});
```

### 구조화 로그 작성 — 첫 인자는 항상 객체

```javascript
// ❌ 검색·필터링 불가
logger.info(`사용자 ${userId} 로그인 성공`);

// ✓ 구조화 — userId로 필터 가능
logger.info({ userId, action: 'login', ip: req.ip }, '사용자 로그인 성공');

// ✓ 에러 로그
try {
  await db.query(sql, params);
} catch (err) {
  logger.error({ err, requestId, sql: sql.slice(0, 100) }, 'DB 쿼리 실패');
  throw err;
}
```

메시지는 **정적 문자열**로, 가변 데이터는 **객체 프로퍼티**로 넘기는 것이 원칙입니다. 그래야 로그 집계 도구가 같은 이벤트를 정확히 그룹화할 수 있습니다.

---

## 자식 로거 — 요청 컨텍스트 전파

HTTP 요청 전체에서 같은 `requestId`를 로그에 포함하려면 **자식 로거(child logger)**를 사용합니다.

```javascript
// src/middleware/requestLogger.js
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';

export function requestLoggerMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] ?? randomUUID();
  const startTime = Date.now();

  // 요청별 컨텍스트를 고정한 자식 로거
  req.log = logger.child({
    requestId,
    method:  req.method,
    path:    req.path,
    userId:  req.user?.id,
  });

  req.log.info('요청 시작');

  res.on('finish', () => {
    req.log.info({
      statusCode: res.statusCode,
      duration:   Date.now() - startTime,
    }, '요청 완료');
  });

  next();
}

// 라우트 핸들러
async function getUser(req, res) {
  req.log.debug({ targetUserId: req.params.id }, 'getUser 호출');
  const user = await UserService.findById(req.params.id);
  req.log.info({ found: !!user }, 'getUser 완료');
  res.json(user);
}
```

모든 로그에 `requestId`가 자동으로 포함되어, 한 요청의 전체 흐름을 추적할 수 있습니다.

---

## Winston — 유연한 트랜스포트

Winston은 다양한 **트랜스포트(출력 대상)**를 지원합니다. 파일·콘솔·외부 서비스에 동시에 로그를 보낼 수 있습니다.

```javascript
import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
    json(),
  ),
  transports: [
    // 콘솔 출력 (개발용)
    new winston.transports.Console({
      format: process.env.NODE_ENV !== 'production'
        ? combine(colorize(), simple())
        : json(),
    }),
    // 에러 전용 파일
    new winston.transports.File({
      filename: 'logs/error.log',
      level:    'error',
      maxsize:  10 * 1024 * 1024, // 10MB 롤링
      maxFiles: 5,
    }),
  ],
});

// 처리되지 않은 예외도 로깅
logger.exceptions.handle(
  new winston.transports.File({ filename: 'logs/exceptions.log' }),
);
```

---

## 로그 레벨 동적 변경

프로덕션에서 특정 문제를 디버깅하기 위해 재배포 없이 로그 레벨을 올릴 수 있습니다.

```javascript
// HTTP 엔드포인트로 레벨 변경 (관리자 전용!)
app.put('/admin/log-level', adminOnly, (req, res) => {
  const { level } = req.body;
  const validLevels = ['trace', 'debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(level)) return res.status(400).json({ error: 'invalid level' });

  logger.level = level; // Pino는 직접 변경 가능
  logger.info({ level }, '로그 레벨 변경');
  res.json({ level });
});
```

---

## 로깅 체크리스트

| 항목 | 권장 |
|---|---|
| 출력 형식 | 프로덕션에 JSON, 개발에 pretty-print |
| 레벨 설정 | 개발 debug, 스테이징 info, 프로덕션 warn |
| 민감 정보 | `redact`로 password·token·authorization 마스킹 |
| 에러 로그 | `err` 객체 전달 (stack trace 포함) |
| 요청 추적 | `requestId`를 자식 로거로 전파 |
| 비동기 I/O | Pino의 `pino.destination()`으로 비동기 쓰기 |
| 로그 보존 | 파일 로테이션, 외부 서비스(CloudWatch, Datadog)로 전송 |

---

**지난 글:** [설정 우선순위 — 환경별 설정 오버라이드 전략](/posts/real-config-priority/)

**다음 글:** [구조화 로그 실전 — JSON 로그와 상관 ID](/posts/real-structured-logs/)

<br>
읽어주셔서 감사합니다. 😊
