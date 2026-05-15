---
title: "Permissions API 완전 이해"
description: "navigator.permissions.query()로 권한 상태를 조회·모니터링하는 방법, 지원 권한 목록, 권한 요청 타이밍 UX 패턴, 권한 상태별 UI 처리 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Permissions", "브라우저", "권한", "UX", "보안", "API"]
featured: false
draft: false
---

[지난 글](/posts/browser-notifications/)에서 Notifications API를 살펴봤습니다. 이번에는 여러 브라우저 권한(위치, 알림, 카메라 등)의 상태를 통일된 방식으로 조회하고 감시하는 **Permissions API**를 정리합니다.

---

## Permissions API란

각 브라우저 API(Geolocation, Notifications, Clipboard 등)는 자체 권한 요청 메커니즘을 갖고 있습니다. 이때 권한 상태를 **요청 전에 미리 확인**하려면 각 API마다 다른 방법을 써야 해서 불편했습니다. `navigator.permissions`는 이를 통합된 인터페이스로 해결합니다.

```js
// 권한 상태 조회
const result = await navigator.permissions.query({ name: 'geolocation' });
console.log(result.state); // 'granted' | 'denied' | 'prompt'
```

---

## 권한 상태 세 가지

![Permissions API 상태 전이](/assets/posts/browser-permissions-states.svg)

| 상태 | 의미 | 동작 |
|------|------|------|
| `"prompt"` | 아직 결정하지 않음 | 기능 호출 시 권한 다이얼로그 표시 |
| `"granted"` | 사용자가 허가함 | 다이얼로그 없이 즉시 사용 가능 |
| `"denied"` | 사용자가 거부함 | JS로 재요청 불가 — 브라우저 설정에서만 변경 |

---

## 조회 가능한 권한 목록

![주요 권한 이름](/assets/posts/browser-permissions-names.svg)

---

## 기본 사용 패턴

```js
async function checkPermission(name) {
  try {
    const status = await navigator.permissions.query({ name });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch (err) {
    // 미지원 권한 이름이면 TypeError
    console.warn(`'${name}' 권한은 이 브라우저에서 지원되지 않습니다.`);
    return 'unknown';
  }
}

// 여러 권한 동시 확인
async function checkAllPermissions() {
  const names = ['geolocation', 'notifications', 'camera', 'microphone'];
  const results = await Promise.all(
    names.map(async (name) => ({ name, state: await checkPermission(name) }))
  );
  return Object.fromEntries(results.map(({ name, state }) => [name, state]));
}

const perms = await checkAllPermissions();
// { geolocation: 'granted', notifications: 'prompt', camera: 'denied', ... }
```

---

## 권한 변화 실시간 감지

`PermissionStatus` 객체는 `change` 이벤트를 지원합니다. 브라우저 설정에서 사용자가 권한을 바꾸면 즉시 감지됩니다.

```js
async function watchPermission(name, onChange) {
  const status = await navigator.permissions.query({ name });
  onChange(status.state); // 초기 상태 즉시 전달

  const handler = () => onChange(status.state);
  status.addEventListener('change', handler);

  // cleanup 함수 반환
  return () => status.removeEventListener('change', handler);
}

// 사용
const cleanup = await watchPermission('notifications', (state) => {
  if (state === 'granted') enableNotificationButton();
  if (state === 'denied') showSettingsGuide();
});

// 컴포넌트 언마운트 시
cleanup();
```

---

## 권한 상태별 UI 전략

```js
async function renderLocationButton(buttonEl) {
  const status = await navigator.permissions.query({ name: 'geolocation' });

  function updateButton(state) {
    switch (state) {
      case 'granted':
        buttonEl.textContent = '내 위치 보기';
        buttonEl.disabled = false;
        break;
      case 'denied':
        buttonEl.textContent = '위치 권한이 차단됨 (설정에서 변경)';
        buttonEl.disabled = true;
        break;
      case 'prompt':
        buttonEl.textContent = '위치 권한 허가 후 보기';
        buttonEl.disabled = false;
        break;
    }
  }

  updateButton(status.state);
  status.addEventListener('change', () => updateButton(status.state));
}
```

---

## push 권한의 특이점

`push` 권한은 `userVisibleOnly` 옵션이 필요합니다.

```js
const pushStatus = await navigator.permissions.query({
  name: 'push',
  userVisibleOnly: true, // 모든 push는 알림으로 표시해야 함
});
console.log(pushStatus.state);
```

---

## React 훅 — usePermission

```js
import { useState, useEffect } from 'react';

function usePermission(name) {
  const [state, setState] = useState('unknown');

  useEffect(() => {
    let cleanup;
    navigator.permissions
      .query({ name })
      .then((status) => {
        setState(status.state);
        const handler = () => setState(status.state);
        status.addEventListener('change', handler);
        cleanup = () => status.removeEventListener('change', handler);
      })
      .catch(() => setState('unsupported'));

    return () => cleanup?.();
  }, [name]);

  return state; // 'granted' | 'denied' | 'prompt' | 'unknown' | 'unsupported'
}

// 사용
function CameraButton() {
  const cameraState = usePermission('camera');
  if (cameraState === 'denied') return <p>카메라 접근이 차단되었습니다.</p>;
  return <button onClick={startCamera}>카메라 시작</button>;
}
```

---

## 권한 요청 타이밍 베스트 프랙티스

**나쁜 패턴**: 페이지 로드 즉시 `requestPermission()` 호출 → 맥락 없는 권한 요청으로 거부율 급증.

**좋은 패턴**:
1. `permissions.query()`로 현재 상태를 먼저 확인합니다.
2. `"granted"` → 바로 기능 활성화.
3. `"prompt"` → 사용자가 해당 기능 버튼을 눌렀을 때, 왜 필요한지 설명 후 요청.
4. `"denied"` → 브라우저 설정 안내 UI를 표시. 절대 재요청하지 않음.

```js
async function handleLocationRequest() {
  const status = await navigator.permissions.query({ name: 'geolocation' });

  if (status.state === 'denied') {
    showToast('브라우저 주소창 왼쪽 자물쇠 아이콘 → 위치 → 허용으로 변경하세요.');
    return;
  }

  // 'granted' 또는 'prompt' → 바로 호출 (prompt면 다이얼로그 뜸)
  navigator.geolocation.getCurrentPosition(onSuccess, onError);
}
```

---

## 브라우저 지원 확인

Permissions API 자체가 없는 환경도 있습니다(일부 WebView, 구형 브라우저).

```js
if (!navigator.permissions) {
  // 직접 기능 호출 시 권한 다이얼로그가 뜨거나 에러가 남
  console.warn('Permissions API 미지원 — 직접 기능 호출로 fallback');
}
```

---

**지난 글:** [Notifications API 완전 이해](/posts/browser-notifications/)

**다음 글:** [Web Cryptography API 완전 이해](/posts/browser-web-crypto/)

<br>
읽어주셔서 감사합니다. 😊
