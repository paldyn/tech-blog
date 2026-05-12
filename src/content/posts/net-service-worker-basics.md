---
title: "Service Worker 기초 · 오프라인 캐싱"
description: "Service Worker 라이프사이클(등록·설치·활성화·제어), fetch 이벤트 가로채기, Cache-First·Network-First·Stale-While-Revalidate 전략, skipWaiting·clients.claim(), Workbox 활용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Service Worker", "PWA", "캐싱", "오프라인", "fetch", "Cache API", "Workbox"]
featured: false
draft: false
---

[지난 글](/posts/net-webrtc-overview/)에서 WebRTC로 P2P 연결을 수립하는 방법을 살펴봤습니다. 이번에는 **Service Worker**를 정리합니다. Service Worker는 브라우저와 네트워크 사이에 위치하는 프록시 스크립트로, 오프라인 지원·캐싱·백그라운드 동기화·푸시 알림의 기반입니다.

---

## Service Worker란

Service Worker는 **페이지와 별도의 스레드에서 실행**되는 JavaScript 파일입니다. DOM에 접근할 수 없으며, HTTPS 환경(또는 localhost)에서만 동작합니다. 브라우저가 닫혀도 백그라운드에서 실행될 수 있어, 오프라인 캐싱·푸시·백그라운드 동기화를 가능하게 합니다.

```js
// 메인 스크립트에서 Service Worker 등록
if ('serviceWorker' in navigator) {
  const registration = await navigator.serviceWorker
    .register('/sw.js', { scope: '/' });
  console.log('SW 등록됨:', registration.scope);
}
```

`scope`는 Service Worker가 제어할 URL 범위입니다. `/app/`으로 설정하면 `/app/` 하위 요청만 가로챕니다.

---

## 라이프사이클

![Service Worker 라이프사이클](/assets/posts/net-service-worker-basics-lifecycle.svg)

**1. Parsed**: SW 스크립트 파싱 완료.

**2. Installing**: `install` 이벤트 발생. 주로 정적 에셋을 캐시에 미리 채웁니다(Pre-caching). `event.waitUntil()`에 Promise를 전달하면 완료 전까지 다음 단계로 진행하지 않습니다.

**3. Waiting (Installed)**: 이전 SW가 여전히 페이지를 제어 중이면 새 SW는 대기합니다. `skipWaiting()`으로 강제 활성화할 수 있습니다.

**4. Activating**: `activate` 이벤트. 이전 버전 캐시를 정리하는 최적 시점입니다.

**5. Active (제어 중)**: `fetch` 이벤트를 가로채 캐시 전략을 적용합니다.

```js
// sw.js
const CACHE_NAME = 'v1';
const PRECACHE = ['/index.html', '/app.css', '/app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting(); // 대기 없이 즉시 활성화
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim(); // 열린 탭을 즉시 제어
});
```

`clients.claim()`을 호출하지 않으면 새 SW는 다음 페이지 로드부터 제어를 시작합니다.

---

## fetch 이벤트 — 요청 가로채기

```js
self.addEventListener('fetch', (event) => {
  // GET 요청만 캐싱 (POST는 제외)
  if (event.request.method !== 'GET') return;

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone()); // 응답은 스트림이므로 clone 필수
  return response;
}
```

`event.respondWith()`에 전달하는 Promise가 Response로 resolve되면 브라우저에 그 응답이 반환됩니다.

---

## 캐시 전략 3가지

![캐시 전략 3가지](/assets/posts/net-service-worker-basics-strategies.svg)

**Cache-First**: 캐시에 있으면 즉시 반환, 없으면 네트워크 요청 후 캐시에 저장. 정적 에셋(이미지·폰트·CSS)에 적합합니다.

**Network-First**: 먼저 네트워크 요청을 시도하고, 실패하면 캐시를 반환. HTML 페이지·API 응답처럼 최신 데이터가 중요할 때 사용합니다.

**Stale-While-Revalidate**: 캐시된 응답을 즉시 반환하면서 백그라운드에서 네트워크 요청으로 캐시를 갱신. 사용자는 빠른 응답을 받고, 다음 요청에서 최신 데이터를 받습니다.

| 전략 | 속도 | 최신성 | 오프라인 | 적합 대상 |
|------|------|--------|---------|---------|
| Cache-First | ⭐⭐⭐ | ⭐ | ✅ | 정적 에셋 |
| Network-First | ⭐ | ⭐⭐⭐ | 부분 | API·HTML |
| SWR | ⭐⭐⭐ | ⭐⭐ | ✅ | 피드·앱 셸 |

---

## Cache API 직접 사용

```js
// 캐시 열기
const cache = await caches.open('api-v1');

// 요청-응답 쌍 저장
await cache.put('/api/users', new Response(JSON.stringify([{id: 1}]), {
  headers: { 'Content-Type': 'application/json' }
}));

// 매칭 조회
const matched = await cache.match('/api/users');
const data = await matched?.json();

// 캐시 항목 삭제
await cache.delete('/api/users');

// 모든 캐시 이름 목록
const cacheNames = await caches.keys();
```

---

## 업데이트 감지 및 사용자 알림

```js
// sw.js
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 메인 스크립트
const reg = await navigator.serviceWorker.register('/sw.js');

reg.addEventListener('updatefound', () => {
  const newWorker = reg.installing;
  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      // 새 SW가 대기 중 → 사용자에게 업데이트 알림
      showUpdateBanner(() => {
        newWorker.postMessage('SKIP_WAITING');
      });
    }
  });
});

// SW 활성화 후 페이지 새로고침
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload();
});
```

---

## Workbox — 권장 라이브러리

Service Worker 캐싱 로직을 직접 구현하면 복잡해집니다. Google의 **Workbox** 라이브러리를 사용하면 전략을 선언적으로 구성할 수 있습니다.

```js
// sw.js (Workbox 사용)
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { precacheAndRoute } from 'workbox-precaching';

// 빌드 시 주입된 매니페스트로 사전 캐싱
precacheAndRoute(self.__WB_MANIFEST);

// 정적 에셋
registerRoute(({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'images' }));

// API
registerRoute(({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api', networkTimeoutSeconds: 3 }));

// HTML 페이지
registerRoute(({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({ cacheName: 'pages' }));
```

Vite·webpack의 Workbox 플러그인과 함께 사용하면 빌드 타임에 사전 캐시 매니페스트를 자동 생성합니다.

---

**지난 글:** [WebRTC 개요 · P2P 실시간 통신](/posts/net-webrtc-overview/)

**다음 글:** [Push API · 브라우저 푸시 알림](/posts/net-push-api/)

<br>
읽어주셔서 감사합니다. 😊
