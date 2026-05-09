---
title: "localStorage · sessionStorage 완전 이해"
description: "Web Storage API의 localStorage와 sessionStorage 차이, JSON 직렬화, storage 이벤트로 탭 간 동기화, QuotaExceededError 처리까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "localStorage", "sessionStorage", "WebStorage", "브라우저", "스토리지"]
featured: false
draft: false
---

[지난 글](/posts/browser-location-history/)에서 `location`과 `history` API를 살펴봤습니다. 이번에는 브라우저에 데이터를 저장하는 Web Storage — `localStorage`와 `sessionStorage` — 를 정리합니다.

---

## 두 스토리지의 핵심 차이

두 스토리지는 완전히 같은 API를 공유하지만, **데이터의 수명과 탭 공유 범위**가 다릅니다.

`localStorage`는 명시적으로 삭제하거나 브라우저 데이터를 지우기 전까지 영구적으로 유지됩니다. 같은 origin의 모든 탭이 동일한 스토리지를 공유합니다.

`sessionStorage`는 탭(세션)이 닫히면 사라집니다. 탭마다 독립적인 스토리지를 가지므로, 같은 URL을 두 탭에서 열어도 데이터가 공유되지 않습니다.

![Web Storage 비교](/assets/posts/browser-storage-local-session-comparison.svg)

---

## 기본 API

두 스토리지는 `Storage` 인터페이스를 동일하게 구현합니다.

```js
// 저장
localStorage.setItem('theme', 'dark');
sessionStorage.setItem('token', 'abc123');

// 읽기
const theme = localStorage.getItem('theme'); // 'dark'
const missing = localStorage.getItem('nothing'); // null (없으면 null)

// 삭제
localStorage.removeItem('theme');
sessionStorage.clear(); // 해당 스토리지 전체 삭제

// 순회
console.log(localStorage.length); // 키 개수
const firstKey = localStorage.key(0); // 인덱스로 키 접근
```

**주의**: 브래킷 표기법(`localStorage['key']`)이나 점 표기법(`localStorage.theme`)도 작동하지만, `length`나 `clear` 같은 내장 프로퍼티 이름과 충돌할 수 있어 `setItem`/`getItem`을 사용합니다.

---

## JSON 직렬화

Web Storage는 **문자열만** 저장합니다. 객체나 배열을 저장하려면 직렬화가 필요합니다.

```js
// 저장
const user = { id: 1, name: '홍길동', prefs: { lang: 'ko' } };
localStorage.setItem('user', JSON.stringify(user));

// 읽기
const raw = localStorage.getItem('user');
const parsed = raw !== null ? JSON.parse(raw) : null;
```

숫자를 저장해도 읽을 때 문자열로 반환됩니다.

```js
localStorage.setItem('count', 42);
typeof localStorage.getItem('count'); // 'string', not 'number'
const count = Number(localStorage.getItem('count'));
```

### 안전한 래퍼 함수

```js
function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function storageGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    // JSON.parse 실패 (손상된 데이터)
    return fallback;
  }
}
```

---

## storage 이벤트 — 탭 간 동기화

`localStorage`의 변경은 **다른 탭**에 `storage` 이벤트로 전파됩니다. 변경을 일으킨 탭 자신에서는 발생하지 않습니다.

```js
window.addEventListener('storage', (e) => {
  console.log(e.key);         // 변경된 키
  console.log(e.oldValue);    // 이전 값 (문자열)
  console.log(e.newValue);    // 새 값 (삭제됐으면 null)
  console.log(e.url);         // 변경이 일어난 문서 URL
  console.log(e.storageArea); // localStorage 또는 sessionStorage 참조
});
```

이 이벤트를 활용하면 여러 탭 사이에서 로그인 상태, 테마, 언어 설정 등을 실시간 동기화할 수 있습니다.

```js
// 탭 A에서 로그아웃 → 탭 B도 자동 로그아웃
window.addEventListener('storage', (e) => {
  if (e.key === 'auth' && e.newValue === null) {
    redirectToLogin();
  }
});
```

`sessionStorage`는 탭 격리이므로 `storage` 이벤트가 다른 탭으로 전파되지 않습니다.

---

## QuotaExceededError

저장 용량이 초과되면 `setItem`이 `QuotaExceededError`를 던집니다. 브라우저마다 한도가 다르지만 일반적으로 5–10 MB입니다.

```js
function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // 오래된 캐시 제거 후 재시도
      evictOldEntries();
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        console.error('스토리지 용량 초과 — 저장 실패');
      }
    }
  }
}
```

사이즈가 큰 데이터(이미지 캐시, 대용량 JSON 등)는 `IndexedDB`를 사용합니다.

---

## 프라이빗 브라우징 / 쿠키 차단

프라이빗(시크릿) 모드에서는 `localStorage`가 비어 있는 상태로 시작하고, 탭을 닫으면 삭제됩니다. 일부 브라우저 설정이나 Safari의 ITP(Intelligent Tracking Prevention)는 서드파티 컨텍스트에서 Web Storage 접근을 차단합니다. 접근 가능 여부를 확인하려면 다음 패턴을 사용합니다.

```js
function isStorageAvailable(type = 'localStorage') {
  try {
    const storage = window[type];
    const key = '__test__';
    storage.setItem(key, '1');
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
```

![Web Storage 코드 패턴](/assets/posts/browser-storage-local-session-code.svg)

---

## 사용 사례 정리

| 사용 사례 | 추천 스토리지 |
|---|---|
| 사용자 설정 (테마, 언어) | `localStorage` |
| 로그인 토큰 (세션 기반) | `sessionStorage` |
| 장바구니 (영구 유지) | `localStorage` |
| 폼 임시 저장 | `sessionStorage` |
| 탭 간 동기화 | `localStorage` + `storage` 이벤트 |
| 대용량 데이터 | `IndexedDB` |

---

## 정리

| 항목 | `localStorage` | `sessionStorage` |
|---|---|---|
| 수명 | 영구 | 탭 닫으면 삭제 |
| 탭 공유 | O (같은 origin) | X |
| 용량 | 5–10 MB | 5–10 MB |
| `storage` 이벤트 | 다른 탭에 전파 | 전파 안 됨 |

---

**지난 글:** [location · history API 완전 이해](/posts/browser-location-history/)

**다음 글:** [Cookie API 완전 이해](/posts/browser-cookie-api/)

<br>
읽어주셔서 감사합니다. 😊
