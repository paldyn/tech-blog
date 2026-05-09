---
title: "window · document · navigator 완전 이해"
description: "브라우저 전역 객체 window, DOM 진입점 document, 환경 정보 navigator의 핵심 프로퍼티와 사용 패턴을 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "window", "document", "navigator", "BOM", "DOM", "브라우저"]
featured: false
draft: false
---

[지난 글](/posts/event-clipboard/)에서 클립보드 API를 살펴봤습니다. 이번부터는 브라우저 환경을 구성하는 핵심 객체들을 살펴봅니다. 그 시작으로 모든 웹 개발자가 매일 쓰지만 정확한 관계를 모르는 경우가 많은 `window`, `document`, `navigator`를 정리합니다.

---

## 세 객체의 관계

`window`는 브라우저 탭 하나를 대표하는 **전역 객체**입니다. 브라우저 환경에서 `var`로 선언한 변수나 전역 함수(`setTimeout`, `fetch` 등)는 모두 `window`의 프로퍼티입니다.

`document`는 `window.document`입니다. 현재 탭에 로드된 HTML 문서를 객체 트리로 표현한 것이며, DOM(Document Object Model)의 진입점입니다.

`navigator`는 `window.navigator`입니다. 브라우저와 기기의 환경 정보(언어, 온라인 상태, 하드웨어 정보 등)를 제공합니다.

```js
// 이 두 표현은 동일합니다
window.document === document // true
window.navigator === navigator // true
```

---

## window — 전역 객체

`window`는 생략할 수 있지만, 명시하면 의도가 더 분명해집니다.

### 뷰포트 크기

```js
// 뷰포트 내부 크기 (스크롤바 미포함)
const vw = window.innerWidth;
const vh = window.innerHeight;

// 브라우저 창 전체 크기 (스크롤바 포함)
const ow = window.outerWidth;
const oh = window.outerHeight;

// 레티나 감지
const dpr = window.devicePixelRatio; // 2 (HiDPI), 1 (일반)
```

`resize` 이벤트로 뷰포트 변화를 감지합니다. 성능을 위해 `ResizeObserver`를 사용하거나, 이벤트를 디바운스합니다.

### 스크롤

```js
const { scrollX, scrollY } = window; // 현재 스크롤 위치

window.scrollTo({ top: 0, behavior: 'smooth' }); // 부드러운 상단 이동
window.scrollBy({ top: 100, behavior: 'smooth' }); // 상대 스크롤
```

### 팝업 (사용 자제)

```js
window.alert('메시지');
window.confirm('확인?');  // boolean 반환
window.prompt('입력:');   // string 또는 null 반환
```

세 메서드는 메인 스레드를 블로킹하고 UX가 좋지 않아 현대 웹에서는 커스텀 다이얼로그로 대체합니다.

---

## document — DOM 진입점

### 핵심 프로퍼티

```js
document.title = 'New Title';     // 탭 제목 변경
document.URL;                      // 현재 URL
document.documentElement;          // <html> 요소
document.head;                     // <head> 요소
document.body;                     // <body> 요소
document.cookie;                   // 쿠키 문자열
```

### readyState와 로드 이벤트

`document.readyState`는 세 단계로 전이합니다.

| 상태 | 의미 | 발생 이벤트 |
|---|---|---|
| `'loading'` | HTML 파싱 중 | — |
| `'interactive'` | HTML 파싱 완료, 서브리소스 로드 중 | `DOMContentLoaded` |
| `'complete'` | 모든 리소스 로드 완료 | `load` |

```js
// 스크립트 실행 시점에 이미 DOM이 준비됐을 수도 있음
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init(); // 이미 파싱 완료된 경우
}
```

### visibilitychange

탭이 숨겨지거나 다시 보일 때 발생합니다.

```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    pauseVideo();
    stopPolling();
  } else {
    resumeVideo();
    startPolling();
  }
});
```

배터리 소모, 불필요한 네트워크 요청을 줄이는 데 유용합니다.

---

## navigator — 브라우저·기기 환경

### 언어

```js
navigator.language;       // 'ko-KR' (기본 언어)
navigator.languages;      // ['ko-KR', 'ko', 'en-US'] (선호 순서)
```

현지화(i18n) 구현 시 `navigator.languages[0]`을 기준으로 언어를 결정합니다. `Intl` API와 연계하면 더 강력합니다.

### 온라인 상태

```js
navigator.onLine; // true / false

window.addEventListener('online',  () => syncData());
window.addEventListener('offline', () => showOfflineBanner());
```

`navigator.onLine`이 `true`라도 실제 인터넷 연결이 보장되지는 않습니다(LAN 연결만 있을 수 있음). 실제 연결 확인에는 소형 `fetch`를 사용합니다.

### 하드웨어

```js
navigator.hardwareConcurrency; // 논리 CPU 코어 수 (Worker 수 결정에 활용)
navigator.deviceMemory;        // 대략적 RAM 크기 (GB 단위, 0.25~8)
```

Web Worker 풀 크기나 기능 다운그레이드 결정에 활용합니다.

### userAgent — 주의사항

```js
navigator.userAgent; // 브라우저/OS 정보 문자열
```

`userAgent` 파싱으로 브라우저를 감지하는 것은 신뢰할 수 없습니다. 기능 감지(`'geolocation' in navigator`)가 올바른 접근법입니다.

### sendBeacon

페이지가 언로드될 때 데이터를 서버에 안전하게 전송합니다.

```js
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // unload 시에도 취소되지 않음
    navigator.sendBeacon('/analytics', JSON.stringify(pageStats));
  }
});
```

`fetch`는 `unload` 이벤트에서 취소될 수 있어, 분석 데이터 전송에는 `sendBeacon`이 더 신뢰할 수 있습니다.

![window · document · navigator 관계](/assets/posts/browser-window-document-navigator-structure.svg)

![주요 패턴 코드](/assets/posts/browser-window-document-navigator-code.svg)

---

## 정리

| 객체 | 역할 | 주요 용도 |
|---|---|---|
| `window` | 전역 컨텍스트, 브라우저 탭 | 뷰포트 크기, 스크롤, 타이머 |
| `document` | HTML 문서 트리 | DOM 쿼리, 요소 조작, 로드 이벤트 |
| `navigator` | 브라우저·기기 정보 | 언어, 온라인 상태, 하드웨어 |

---

**지난 글:** [클립보드 API 완전 이해](/posts/event-clipboard/)

**다음 글:** [location · history API 완전 이해](/posts/browser-location-history/)

<br>
읽어주셔서 감사합니다. 😊
