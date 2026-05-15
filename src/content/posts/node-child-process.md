---
title: "child_process · Node.js 자식 프로세스"
description: "Node.js child_process 모듈의 spawn·exec·execFile·fork 차이점과 사용 패턴을 다룹니다. 스트리밍 출력, Promise API, 셸 주입 방지, 프로세스 종료 처리, stdio 파이프라인 연결까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "child_process", "spawn", "exec", "fork", "프로세스", "보안"]
featured: false
draft: false
---

[지난 글](/posts/node-cluster/)에서 cluster 모듈로 멀티코어를 활용하는 방법을 살펴봤습니다. `child_process`는 Node.js에서 **외부 프로그램이나 셸 명령**을 실행하는 표준 방법입니다. 빌드 도구 실행, 시스템 명령 호출, 별도 Node.js 스크립트 분리 등 다양한 상황에서 쓰입니다.

---

## 4가지 API 비교

![child_process 4가지 API 비교](/assets/posts/node-child-process-methods.svg)

| API | 셸 사용 | 출력 방식 | 주용도 |
|-----|---------|----------|--------|
| `spawn` | 없음 | Stream | 대용량 출력, 실시간 처리 |
| `exec` | `/bin/sh` | Buffer (콜백) | 짧은 명령, 셸 기능 필요 시 |
| `execFile` | 없음 | Buffer (콜백) | 바이너리 실행, exec보다 안전 |
| `fork` | 없음 | IPC + Stream | Node.js 자식 프로세스 |

---

## spawn — 스트리밍 실행

```js
import { spawn } from 'child_process';

const child = spawn('ffmpeg', [
  '-i', 'input.mp4',
  '-codec:a', 'libmp3lame',
  'output.mp3',
]);

child.stdout.on('data', (chunk) => process.stdout.write(chunk));
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

child.on('close', (code) => {
  console.log(`변환 완료. 종료 코드: ${code}`);
});

child.on('error', (err) => {
  console.error('spawn 실패:', err.message);
});
```

`spawn`은 인수를 배열로 받아 셸을 거치지 않습니다. stdout/stderr이 스트림이므로 대용량 출력도 메모리 부담 없이 처리합니다.

---

## exec / execFile — Promise 패턴

![spawn · exec 사용 예제](/assets/posts/node-child-process-code.svg)

```js
import { exec, execFile } from 'child_process/promises';

// exec — 셸 기능(파이프, 리다이렉션) 사용 가능
const { stdout } = await exec('git log --oneline -5');
console.log(stdout);

// execFile — 셸 없음, 인수 배열로 안전하게 전달
const { stdout: ls } = await execFile('ls', ['-la', '/tmp']);
console.log(ls);

// 옵션: 타임아웃, 최대 버퍼 크기
const { stdout: result } = await exec('node -e "console.log(42)"', {
  timeout: 5000,       // 5초 초과 시 SIGTERM
  maxBuffer: 1024 * 1024 * 10, // 10MB
  cwd: '/workspace',
  env: { ...process.env, NODE_ENV: 'test' },
});
```

---

## fork — Node.js 자식 프로세스 + IPC

```js
// main.js
import { fork } from 'child_process';

const child = fork('./compute.js', [], {
  silent: true,    // 자식의 stdout/stderr을 부모로 파이프
});

child.send({ task: 'fib', n: 40 });

child.on('message', (result) => {
  console.log('결과:', result);
  child.kill();
});

child.stdout?.on('data', (d) => console.log('[자식]', d.toString()));
```

```js
// compute.js
process.on('message', ({ task, n }) => {
  if (task === 'fib') {
    const fib = (n) => n <= 1 ? n : fib(n - 1) + fib(n - 2);
    process.send(fib(n));
  }
});
```

`fork`는 내부적으로 `spawn`이지만 IPC 채널이 자동으로 열려 `process.send()`를 바로 사용할 수 있습니다.

---

## 보안 — 셸 주입 방지

```js
// 위험: 사용자 입력을 exec 문자열에 직접 삽입
const filename = req.query.file; // 악의적 입력: "x; rm -rf /"
await exec(`cat ${filename}`);   // ← 셸 주입 취약점

// 안전: execFile + 인수 배열
await execFile('cat', [filename]); // 셸 없이 직접 실행 — 주입 불가

// 안전: spawn + 인수 배열
const child = spawn('grep', ['-r', userInput, './logs']);
```

`exec`에 사용자 입력을 직접 삽입하는 것은 **셸 주입 취약점**입니다. 반드시 `execFile`이나 `spawn`의 인수 배열을 사용하세요.

---

## stdio 파이프라인 연결

```js
// ls | grep .js 패턴을 Node에서 구현
import { spawn } from 'child_process';

const ls = spawn('ls', ['-la']);
const grep = spawn('grep', ['.js']);

ls.stdout.pipe(grep.stdin);
grep.stdout.on('data', (d) => console.log(d.toString()));

grep.on('close', (code) => console.log('grep 종료:', code));
```

---

## 프로세스 종료 제어

```js
const child = spawn('long-running-process', []);

// 정상 종료 신호
setTimeout(() => child.kill('SIGTERM'), 5000);

// SIGTERM 무시 시 강제 종료
child.on('exit', (code, signal) => {
  if (signal === 'SIGTERM') console.log('정상 종료 요청');
  if (code !== 0 && signal === null) console.error('비정상 종료:', code);
});

// AbortController로 취소
const ac = new AbortController();
const child2 = spawn('sleep', ['100'], { signal: ac.signal });
setTimeout(() => ac.abort(), 2000); // 2초 후 취소
```

---

**지난 글:** [Cluster · Node.js 멀티프로세스](/posts/node-cluster/)

**다음 글:** [process · Node.js 프로세스 환경](/posts/node-process-env/)

<br>
읽어주셔서 감사합니다. 😊
