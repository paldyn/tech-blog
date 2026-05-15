---
title: "Dedicated Worker vs Shared Worker · 스레드 공유 패턴"
description: "Dedicated Worker와 Shared Worker의 차이점, SharedWorker.port 사용법, onconnect 이벤트, 멀티 탭 상태 공유 패턴, 브라우저 지원 현황, BroadcastChannel과의 비교까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Shared Worker", "Dedicated Worker", "멀티스레드", "탭 공유", "MessagePort", "onconnect"]
featured: false
draft: false
---

[지난 글](/posts/worker-web-worker-basics/)에서 Web Worker의 기본 아키텍처와 메시지 패턴을 살펴봤습니다. 이번에는 **Dedicated Worker와 Shared Worker의 차이**를 정리합니다. Shared Worker는 여러 탭·iframe이 동일한 Worker 인스턴스를 공유하는 메커니즘으로, 탭 간 상태 동기화·WebSocket 공유·캐시 공유에 활용됩니다.

---

## Dedicated Worker vs Shared Worker

![Dedicated vs Shared Worker 비교](/assets/posts/worker-dedicated-vs-shared-comparison.svg)

**Dedicated Worker**는 하나의 스크립트(탭·window)와 **1:1**로 연결됩니다. 생성한 컨텍스트가 닫히면 Worker도 종료됩니다. 탭마다 독립적인 상태가 필요한 경우, 또는 단순히 CPU 집중 작업을 오프로드하려는 경우에 적합합니다.

**Shared Worker**는 같은 origin의 여러 탭·iframe이 **하나의 Worker 인스턴스**를 공유합니다. Worker는 마지막 연결이 닫힐 때까지 유지됩니다. 탭 간 상태 공유, 단일 WebSocket 연결 유지, 공유 캐시 관리 등에 적합합니다.

| 항목 | Dedicated Worker | Shared Worker |
|------|-----------------|---------------|
| 연결 수 | 1:1 (한 탭) | 1:N (여러 탭) |
| 생명주기 | 생성 탭이 닫히면 종료 | 모든 탭 닫힐 때 종료 |
| 통신 방식 | postMessage 직접 | port.postMessage |
| 상태 공유 | 탭 간 불가 | 가능 |
| 브라우저 지원 | 모든 브라우저 | Chrome·Firefox (Safari 제한) |

---

## Shared Worker 기본 사용법

```js
// page.js — 각 탭에서 실행
const sw = new SharedWorker('./shared.js');

// SharedWorker는 반드시 .port를 통해 통신
const { port } = sw;
port.start(); // 이벤트 수신 시작 (필수)

port.onmessage = ({ data }) => {
  console.log('Shared Worker로부터:', data);
};

port.postMessage({ type: 'HELLO', tabId: crypto.randomUUID() });
```

```js
// shared.js — Shared Worker 스크립트
const ports = new Set(); // 연결된 모든 포트 관리

self.onconnect = (event) => {
  const port = event.ports[0];
  ports.add(port);
  port.start();

  port.onmessage = ({ data }) => {
    console.log('탭으로부터:', data);
    // 모든 탭에 브로드캐스트
    broadcast({ type: 'MESSAGE', payload: data });
  };
};

function broadcast(message) {
  ports.forEach(port => port.postMessage(message));
}
```

---

## 멀티 탭 상태 공유 패턴

![Shared Worker 코드 패턴](/assets/posts/worker-dedicated-vs-shared-code.svg)

```js
// shared.js — 실시간 주식 가격 공유 예시
const ports = new Set();
let stockPrices = {};

self.onconnect = ({ ports: [port] }) => {
  ports.add(port);
  port.start();

  // 새 탭에 현재 가격 즉시 전달
  port.postMessage({ type: 'SNAPSHOT', data: stockPrices });

  port.onmessage = ({ data }) => {
    if (data.type === 'SUBSCRIBE') {
      startFetching(data.symbols);
    }
  };

  // 탭이 닫힐 때 (port는 자동으로 닫힘)
  port.addEventListener('close', () => {
    ports.delete(port);
    if (ports.size === 0) stopFetching();
  });
};

// 가격 업데이트 → 모든 탭에 전파
function updatePrices(prices) {
  stockPrices = { ...stockPrices, ...prices };
  ports.forEach(port => port.postMessage({
    type: 'UPDATE',
    data: prices
  }));
}

// fetch로 주기적 가격 조회 (Worker 내 fetch 가능)
let fetchInterval = null;
function startFetching(symbols) {
  if (fetchInterval) return; // 이미 실행 중
  fetchInterval = setInterval(async () => {
    const res = await fetch(`/api/stocks?symbols=${symbols.join(',')}`);
    updatePrices(await res.json());
  }, 5000);
}
```

---

## WebSocket을 Shared Worker로 공유

WebSocket 연결 하나를 여러 탭이 공유하면 연결 수와 서버 부하를 줄일 수 있습니다.

```js
// shared-ws.js
let ws = null;
const subscribers = new Set();

function connectWS(url) {
  if (ws?.readyState === WebSocket.OPEN) return;
  ws = new WebSocket(url);
  ws.onmessage = ({ data }) => {
    subscribers.forEach(port => port.postMessage({ event: 'message', data }));
  };
  ws.onclose = () => setTimeout(() => connectWS(url), 3000);
}

self.onconnect = ({ ports: [port] }) => {
  subscribers.add(port);
  port.start();
  port.onmessage = ({ data }) => {
    if (data.type === 'CONNECT') connectWS(data.url);
    if (data.type === 'SEND') ws?.send(JSON.stringify(data.payload));
    if (data.type === 'DISCONNECT') {
      subscribers.delete(port);
      if (subscribers.size === 0) ws?.close(1000);
    }
  };
};
```

```js
// 각 탭에서 사용
const sw = new SharedWorker('./shared-ws.js');
sw.port.start();
sw.port.postMessage({ type: 'CONNECT', url: 'wss://api.example.com' });
sw.port.onmessage = ({ data }) => handleServerMessage(data);
sw.port.postMessage({ type: 'SEND', payload: { room: 'general', text: '안녕' } });
```

---

## port.close() — 연결 해제

```js
// page.js
window.addEventListener('beforeunload', () => {
  sw.port.postMessage({ type: 'DISCONNECT' });
  sw.port.close();
});
```

`port.close()`를 호출하면 Shared Worker가 `port close` 이벤트를 받습니다. 이를 통해 Worker가 비활성 포트를 정리할 수 있습니다.

---

## BroadcastChannel과의 비교

탭 간 간단한 메시지 브로드캐스트가 목적이라면 **BroadcastChannel**이 더 쉽습니다.

```js
// 탭 A
const bc = new BroadcastChannel('app-sync');
bc.postMessage({ type: 'USER_LOGGED_IN', userId: 42 });

// 탭 B (같은 채널)
const bc = new BroadcastChannel('app-sync');
bc.onmessage = ({ data }) => {
  if (data.type === 'USER_LOGGED_IN') syncUI(data.userId);
};
```

| 항목 | BroadcastChannel | Shared Worker |
|------|------------------|---------------|
| 복잡도 | 낮음 | 높음 |
| CPU 오프로드 | 불가 | 가능 |
| 상태 관리 | 탭에서 각자 | Worker에서 중앙화 |
| 백그라운드 fetch | 불가 | 가능 |
| 지원 | 광범위 | 일부 제한 |

---

## 디버깅

Chrome DevTools에서 `chrome://inspect/#workers`에 접속하면 현재 실행 중인 Shared Worker 목록을 볼 수 있습니다. Worker마다 별도 DevTools 창이 열리며, 콘솔·브레이크포인트를 사용할 수 있습니다.

```js
// Shared Worker 내 디버깅
self.onconnect = ({ ports: [port] }) => {
  console.log('새 탭 연결됨. 현재 연결 수:', ports.size + 1);
  // DevTools Workers 패널에서 이 로그 확인 가능
};
```

---

## 브라우저 지원

Shared Worker는 Chrome·Firefox에서 잘 지원되지만, **Safari**는 데스크탑(MacOS 14+)에서만 지원하며 iOS에서는 미지원입니다. 범용 지원이 필요한 경우 BroadcastChannel + Dedicated Worker 조합을 고려하세요.

---

**지난 글:** [Web Worker 기초 · 멀티스레드 JavaScript](/posts/worker-web-worker-basics/)

<br>
읽어주셔서 감사합니다. 😊
