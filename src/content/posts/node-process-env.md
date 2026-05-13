---
title: "process · Node.js 프로세스 환경"
description: "Node.js process 글로벌 객체를 완전히 정리합니다. process.env 환경 변수, process.argv CLI 인수, stdin/stdout/stderr 스트림, 시그널(SIGTERM/SIGINT) 처리, graceful shutdown 패턴, hrtime 고해상도 타이머까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "process", "환경변수", "process.env", "시그널", "graceful shutdown"]
featured: false
draft: false
---

[지난 글](/posts/node-child-process/)에서 자식 프로세스를 생성하는 방법을 살펴봤습니다. `process`는 Node.js 어디서나 사용할 수 있는 글로벌 객체로, 현재 실행 중인 Node.js 프로세스의 정보와 제어권을 제공합니다. `import` 없이 바로 접근할 수 있습니다.

---

## process 객체 전체 조감도

![process 객체 핵심 속성과 이벤트](/assets/posts/node-process-env-overview.svg)

---

## process.env — 환경 변수

```js
// 기본값 패턴
const port = process.env.PORT ?? '3000';
const dbUrl = process.env.DATABASE_URL
  ?? 'postgresql://localhost:5432/dev';

// 타입 변환 — 모든 환경 변수는 문자열
const maxConnections = Number(process.env.MAX_CONN ?? '10');
const debugMode = process.env.DEBUG === 'true';

// NODE_ENV 관례
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// 환경 변수 설정 (자식 프로세스에도 전파됨)
process.env.TZ = 'Asia/Seoul'; // 타임존 변경
```

`.env` 파일은 `process.env`에 자동으로 로드되지 않습니다. Node.js 20.6+에서는 `--env-file` 플래그로 직접 로드할 수 있습니다.

```bash
node --env-file=.env app.js
```

---

## process.argv — CLI 인수

```js
// node app.js --port 8080 --env production
console.log(process.argv);
// [
//   '/usr/bin/node',   // argv[0]: 실행 파일
//   '/home/user/app.js', // argv[1]: 스크립트 경로
//   '--port', '8080',
//   '--env', 'production',
// ]

// 사용자 인수만 추출
const args = process.argv.slice(2);

// 간단한 파싱
const argMap = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  argMap[key] = args[i + 1];
}
// 실무에서는 commander, yargs, parseArgs(v18.3+) 사용 권장
```

Node.js 18.3+에는 `util.parseArgs()`가 내장되어 있습니다.

```js
import { parseArgs } from 'util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p' },
    env:  { type: 'string', short: 'e' },
    verbose: { type: 'boolean', short: 'v' },
  },
});
console.log(values.port, values.env, values.verbose);
```

---

## stdin / stdout / stderr

```js
// stdout 직접 쓰기 (console.log 내부에서 사용)
process.stdout.write('진행 중...\r');

// stdin 읽기
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (line) => {
  const input = line.trim();
  console.log('입력:', input);
});

// stderr — 오류 메시지는 stdout과 분리
process.stderr.write(`[ERROR] ${new Date().toISOString()} ...\n`);
```

---

## 시그널 처리와 graceful shutdown

![process.env · 종료 처리 패턴](/assets/posts/node-process-env-code.svg)

```js
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} 수신 — graceful shutdown 시작`);

  try {
    // 1. 새 요청 수락 중단
    server.close();
    // 2. 진행 중인 작업 완료 대기
    await Promise.allSettled(activeRequests);
    // 3. 데이터베이스 연결 해제
    await db.close();

    console.log('정상 종료 완료');
    process.exitCode = 0;
  } catch (err) {
    console.error('종료 중 오류:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM')); // kill / 컨테이너 종료
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
```

`process.exit()`를 즉시 호출하면 `exit` 이벤트 리스너에서 **비동기 작업**을 실행할 수 없습니다. `process.exitCode`를 설정하고 자연 종료를 기다리거나, 비동기 정리를 완료한 후 `exit()`를 호출하세요.

---

## 예외 처리 이벤트

```js
// 잡히지 않은 동기 예외
process.on('uncaughtException', (err, origin) => {
  // 이 핸들러 내에서 비동기 작업은 신뢰할 수 없음
  fs.writeFileSync('/var/log/crash.log', `${err.stack}\n${origin}`);
  process.exit(1); // 즉시 종료 권장
});

// 처리되지 않은 Promise 거부
process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 거부:', reason);
  // Node.js 15+에서는 기본적으로 프로세스 종료
});
```

`uncaughtException`을 복구 목적으로 사용하는 것은 **위험**합니다. 이 시점에 애플리케이션 상태는 불일치할 수 있으므로, 로그를 남기고 즉시 종료하는 것이 안전합니다.

---

## 성능 측정 — hrtime

```js
// 고해상도 타이머 (나노초 단위)
const start = process.hrtime.bigint();

// 측정할 작업
await heavyComputation();

const elapsed = process.hrtime.bigint() - start;
console.log(`소요 시간: ${Number(elapsed) / 1_000_000}ms`);

// 메모리 사용량
const mem = process.memoryUsage();
console.log({
  heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`,
  heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB`,
  rss: `${(mem.rss / 1024 / 1024).toFixed(2)}MB`,
  external: `${(mem.external / 1024 / 1024).toFixed(2)}MB`,
});
```

---

**지난 글:** [child_process · Node.js 자식 프로세스](/posts/node-child-process/)

**다음 글:** [디버깅 · Node.js inspect와 진단 도구](/posts/node-debugging-inspect/)

<br>
읽어주셔서 감사합니다. 😊
