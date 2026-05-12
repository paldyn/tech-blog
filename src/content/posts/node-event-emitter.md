---
title: "EventEmitter · Node.js 이벤트 패턴"
description: "Node.js EventEmitter의 on·once·emit·off 메서드, error 이벤트 처리, EventEmitter를 확장한 커스텀 클래스 패턴, 메모리 누수 경고와 setMaxListeners, 동기 실행 보장, Promise 기반 이벤트 대기까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "EventEmitter", "이벤트", "발행-구독", "메모리 누수", "패턴"]
featured: false
draft: false
---

[지난 글](/posts/node-http-https-http2/)에서 Node.js HTTP/HTTPS/HTTP2 서버 구축을 살펴봤습니다. 이번에는 Node.js 내부 어디서나 사용되는 **EventEmitter** 패턴을 다룹니다. `fs`, `http`, `stream` 등 대부분의 Node.js 내장 모듈이 EventEmitter를 상속합니다.

---

## EventEmitter 기본 사용

```js
import { EventEmitter } from 'events';

const emitter = new EventEmitter();

// 이벤트 리스너 등록
emitter.on('data', (chunk) => {
  console.log('데이터 수신:', chunk.length, '바이트');
});

emitter.on('data', (chunk) => {
  console.log('두 번째 리스너도 호출됨'); // 같은 이벤트에 여러 리스너 가능
});

// 1회만 실행되는 리스너
emitter.once('connect', () => {
  console.log('첫 연결 완료 (이후 호출 안 됨)');
});

// 이벤트 발생 (동기적으로 모든 리스너 순서대로 실행)
emitter.emit('data', Buffer.from('hello'));
emitter.emit('connect');
emitter.emit('connect'); // once 리스너는 이미 제거됨
```

---

## EventEmitter 패턴 개요

![EventEmitter 이벤트 발행-구독 패턴](/assets/posts/node-event-emitter-pattern.svg)

`emit()`은 **동기적**으로 등록된 모든 리스너를 순서대로 호출합니다. 따라서 무거운 작업을 리스너에 직접 넣으면 이벤트 루프를 블로킹합니다. 무거운 작업은 `setImmediate`나 Worker Thread로 위임하세요.

---

## error 이벤트 — 필수 처리

`error` 이벤트는 특별합니다. 리스너가 없으면 **프로세스가 크래시**합니다.

```js
const emitter = new EventEmitter();

// error 리스너 반드시 등록
emitter.on('error', (err) => {
  console.error('처리된 에러:', err.message);
  // 이곳에서 처리하지 않으면 프로세스 종료
});

emitter.emit('error', new Error('연결 실패'));
// 처리됨 — 프로세스 계속 실행

// 리스너 없이 emit하면:
// const bare = new EventEmitter();
// bare.emit('error', new Error('치명적')); // UnhandledError → 크래시
```

---

## 리스너 관리

```js
const handler = (data) => console.log(data);

emitter.on('msg', handler);
emitter.on('msg', handler); // 같은 함수 중복 추가됨

// 특정 리스너 제거
emitter.off('msg', handler);         // removeListener 별칭
emitter.removeListener('msg', handler);

// 특정 이벤트의 모든 리스너 제거
emitter.removeAllListeners('msg');

// 모든 이벤트의 모든 리스너 제거
emitter.removeAllListeners();

// 등록된 리스너 조회
const listeners = emitter.listeners('msg');
console.log('리스너 수:', emitter.listenerCount('msg'));
console.log('이벤트 목록:', emitter.eventNames());
```

---

## prependListener — 순서 제어

```js
emitter.on('connect', () => console.log('2. 일반 리스너'));
emitter.prependListener('connect', () => console.log('1. 앞에 삽입'));
emitter.prependOnceListener('connect', () => console.log('0. 최우선 1회'));

emitter.emit('connect');
// 출력: 0. 최우선 1회 → 1. 앞에 삽입 → 2. 일반 리스너
```

---

## EventEmitter 확장 — 커스텀 클래스

![커스텀 EventEmitter 클래스 패턴](/assets/posts/node-event-emitter-code.svg)

```js
import { EventEmitter } from 'events';
import { watch } from 'fs';

class FileWatcher extends EventEmitter {
  #watcher = null;

  constructor(path) {
    super();
    this.path = path;
  }

  start() {
    this.#watcher = watch(this.path, { recursive: true }, (event, filename) => {
      this.emit(event, { filename, path: this.path });
    });
    return this; // 체이닝 지원
  }

  stop() {
    this.#watcher?.close();
    this.removeAllListeners();
    return this;
  }
}

// 사용
const watcher = new FileWatcher('./src')
  .start()
  .on('change', ({ filename }) => console.log('변경됨:', filename))
  .on('rename', ({ filename }) => console.log('이름 변경:', filename));

// 정리
process.on('SIGINT', () => watcher.stop());
```

---

## 메모리 누수 방지

EventEmitter의 기본 최대 리스너 수는 **10개**입니다. 10개를 초과하면 잠재적 메모리 누수를 의심해 경고를 출력합니다.

```js
const emitter = new EventEmitter();
emitter.setMaxListeners(50); // 인스턴스별 한도 조정

// 전역 기본값 변경
EventEmitter.defaultMaxListeners = 20;

// 무한대 (경고 비활성화 — 신중하게 사용)
emitter.setMaxListeners(Infinity);
```

흔한 누수 패턴은 이벤트 리스너를 등록하고 제거하지 않는 것입니다.

```js
// 위험 패턴: 매 요청마다 리스너 추가, 제거 안 함
server.on('request', (req, res) => {
  emitter.on('data', handler); // 요청마다 누적!
});

// 안전 패턴: once + cleanup
server.on('request', (req, res) => {
  const cleanup = () => emitter.off('data', handler);
  emitter.once('data', (data) => {
    cleanup();
    // 처리
  });
  req.on('close', cleanup); // 요청 취소 시에도 정리
});
```

---

## Promise 기반 이벤트 대기 — events.once

```js
import { once } from 'events';

const server = http.createServer(handler);
server.listen(3000);

// 서버가 listening 이벤트를 발생할 때까지 대기
await once(server, 'listening');
console.log('서버 준비 완료:', server.address().port);

// 타임아웃과 조합 (AbortController)
const ac = new AbortController();
const timeout = setTimeout(() => ac.abort(), 5000);

try {
  await once(emitter, 'connect', { signal: ac.signal });
  clearTimeout(timeout);
} catch (err) {
  if (err.name === 'AbortError') console.error('연결 타임아웃');
}
```

---

## on() — AsyncGenerator로 이벤트 스트림

```js
import { on } from 'events';

// 이벤트를 for await...of로 소비
for await (const [data] of on(emitter, 'data')) {
  process(data);
  // 루프 탈출 시 리스너 자동 해제
}
```

---

**지난 글:** [http · https · http2 · Node.js 네트워크 서버](/posts/node-http-https-http2/)

<br>
읽어주셔서 감사합니다. 😊
