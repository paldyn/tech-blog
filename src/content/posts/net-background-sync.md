---
title: "Background Sync API · 오프라인 요청 큐"
description: "Background Sync API의 SyncManager.register(), Service Worker sync 이벤트, IndexedDB 큐 패턴, Periodic Background Sync, 브라우저 지원 현황과 대안 전략까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Background Sync", "Service Worker", "오프라인", "IndexedDB", "PWA", "SyncManager"]
featured: false
draft: false
---

[지난 글](/posts/net-push-api/)에서 Push API로 서버에서 브라우저로 알림을 보내는 방법을 살펴봤습니다. 이번에는 **Background Sync API**를 정리합니다. 오프라인 상태에서 실패한 요청을 저장해두었다가, 네트워크가 복구되면 **브라우저가 자동으로 재전송**하는 메커니즘입니다.

---

## 왜 Background Sync인가

사용자가 약한 네트워크 환경에서 폼을 제출하거나 메시지를 보낼 때, 요청이 실패하면 보통 오류 메시지를 보여줍니다. Background Sync를 사용하면:

1. 오프라인/약한 네트워크에서 요청을 **로컬에 저장**
2. 네트워크가 복구되면 **Service Worker가 자동으로 재전송**
3. **페이지가 닫혀 있어도** 동작

이메일 전송, 폼 제출, 좋아요·댓글처럼 사용자 의도를 반드시 서버에 반영해야 하는 작업에 적합합니다.

---

## 전체 흐름

![Background Sync 라이프사이클](/assets/posts/net-background-sync-lifecycle.svg)

오프라인 상태에서 fetch가 실패하면 데이터를 IndexedDB에 저장하고 `SyncManager.register('tag')`를 호출합니다. 브라우저가 네트워크 복구를 감지하면 Service Worker에게 `sync` 이벤트를 발행합니다. SW는 IndexedDB에서 저장된 요청을 읽어 재전송하고, 성공하면 큐에서 제거합니다.

---

## 구현: 페이지 측

![Background Sync 코드 패턴](/assets/posts/net-background-sync-code.svg)

```js
async function submitForm(formData) {
  const sw = await navigator.serviceWorker.ready;

  try {
    // 온라인이면 직접 전송
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showSuccess();
  } catch {
    // 오프라인 또는 일시적 실패
    await saveToIndexedDB(formData);
    await sw.sync.register('send-form');
    showPendingMessage(); // "나중에 전송됩니다" UI
  }
}
```

`sync.register()`에 전달하는 **태그**는 동일한 태그가 이미 등록되어 있으면 중복 등록되지 않습니다. 따라서 같은 종류의 작업은 동일한 태그를 사용하고, IndexedDB의 큐에 여러 항목을 저장해도 됩니다.

---

## 구현: Service Worker 측

```js
// sw.js
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-form') {
    event.waitUntil(replayFormQueue());
  }
});

async function replayFormQueue() {
  const db = await openDB();
  const pendingItems = await db.getAll('pending-forms');

  for (const item of pendingItems) {
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.data)
      });

      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status}`);
      }

      // 성공: IndexedDB에서 제거
      await db.delete('pending-forms', item.id);

      // 열린 탭에 성공 알림
      const clients = await self.clients.matchAll();
      clients.forEach(c => c.postMessage({
        type: 'SYNC_COMPLETE',
        id: item.id
      }));
    } catch (err) {
      // fetch 실패: 예외를 던져야 브라우저가 재시도
      throw err;
    }
  }
}
```

`event.waitUntil()`에 전달한 Promise가 **reject**되면 브라우저가 나중에 다시 `sync` 이벤트를 발행합니다. **resolve**되면 큐에서 해당 태그가 제거됩니다.

---

## IndexedDB 큐 구현

Background Sync는 IndexedDB와 함께 사용하는 것이 표준 패턴입니다.

```js
// idb 라이브러리 활용
import { openDB } from 'idb';

const dbPromise = openDB('sync-store', 1, {
  upgrade(db) {
    db.createObjectStore('pending-forms', {
      keyPath: 'id',
      autoIncrement: true
    });
  }
});

async function saveToIndexedDB(data) {
  const db = await dbPromise;
  await db.add('pending-forms', {
    data,
    timestamp: Date.now()
  });
}

async function getAllPending() {
  const db = await dbPromise;
  return db.getAll('pending-forms');
}
```

---

## Periodic Background Sync

주기적으로 데이터를 갱신하고 싶을 때 사용합니다. `sync` 이벤트와 달리 **주기적으로** 트리거됩니다.

```js
// 페이지에서 등록
const reg = await navigator.serviceWorker.ready;
if ('periodicSync' in reg) {
  await reg.periodicSync.register('news-update', {
    minInterval: 24 * 60 * 60 * 1000 // 최소 24시간
  });
}

// sw.js
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'news-update') {
    event.waitUntil(updateNewsCache());
  }
});
```

Periodic Background Sync는 **Chrome 80+**에서만 지원되며, 사이트가 홈 화면에 추가되어 있거나 충분한 사용 기록이 있어야 합니다. 배터리·네트워크 상태를 고려해 브라우저가 실행 시점을 결정합니다.

---

## 브라우저 지원 현황

| 기능 | Chrome | Firefox | Safari |
|------|--------|---------|--------|
| Background Sync | 49+ | ❌ | ❌ |
| Periodic Background Sync | 80+ | ❌ | ❌ |

Firefox와 Safari가 Background Sync를 미지원하므로, 폴백 전략이 필요합니다.

---

## 폴백 전략

```js
async function robustSubmit(data) {
  // Background Sync 지원 여부 확인
  const sw = await navigator.serviceWorker.ready;
  const hasBgSync = 'sync' in sw;

  try {
    await sendToServer(data);
  } catch {
    await saveToIndexedDB(data);

    if (hasBgSync) {
      await sw.sync.register('send-form');
    } else {
      // 폴백: 온라인 이벤트 기다렸다가 재시도
      window.addEventListener('online', () => retrySavedData(), { once: true });
    }
  }
}
```

`window.addEventListener('online', ...)` 폴백은 탭이 열려 있는 동안만 동작합니다. 완전한 오프라인 지원이 필요하면 **Workbox Background Sync** 플러그인을 사용하는 것이 가장 안정적입니다.

---

## Workbox Background Sync

```js
// sw.js (Workbox 사용)
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

const bgSyncPlugin = new BackgroundSyncPlugin('form-queue', {
  maxRetentionTime: 24 * 60, // 24시간 후 만료
});

registerRoute(
  ({ url }) => url.pathname === '/api/submit',
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST'
);
```

Workbox가 IndexedDB 큐 관리, 재시도 로직, 만료 처리를 모두 처리합니다. 직접 구현하는 것보다 훨씬 안정적입니다.

---

**지난 글:** [Push API · 브라우저 푸시 알림](/posts/net-push-api/)

**다음 글:** [Web Share API · 네이티브 공유 다이얼로그](/posts/net-web-share/)

<br>
읽어주셔서 감사합니다. 😊
