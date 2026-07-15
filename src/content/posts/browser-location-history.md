---
title: "location · history API 완전 이해"
description: "location URL 분해, assign/replace, history.pushState/replaceState, popstate 이벤트, URLSearchParams를 활용한 SPA 라우팅 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "location", "history", "pushState", "popstate", "URLSearchParams", "SPA", "라우팅"]
featured: false
draft: false
---

[지난 글](/posts/browser-window-document-navigator/)에서 `window`, `document`, `navigator`를 살펴봤습니다. 이번에는 URL을 읽고 조작하는 `location`과 브라우저 히스토리를 제어하는 `history` API를 정리합니다. 두 API를 이해하면 SPA 라우터의 핵심 원리를 파악할 수 있습니다.

---

## location — URL 파싱과 이동

`window.location`은 현재 URL의 각 부분을 파싱해 제공합니다.

```text
https://example.com:8080/path/page?q=hello&lang=ko#section
```

| 프로퍼티 | 값 |
|---|---|
| `protocol` | `'https:'` |
| `hostname` | `'example.com'` |
| `port` | `'8080'` |
| `host` | `'example.com:8080'` |
| `pathname` | `'/path/page'` |
| `search` | `'?q=hello&lang=ko'` |
| `hash` | `'#section'` |
| `origin` | `'https://example.com:8080'` |
| `href` | 전체 URL 문자열 |

```js
// 현재 URL의 일부만 변경
location.pathname = '/new-path';  // 페이지 이동
location.hash = '#top';           // 스크롤 앵커 (페이지 이동 없음)
```

`hash`만 변경하면 페이지가 새로 로드되지 않고 스크롤 위치만 바뀝니다. `hashchange` 이벤트로 감지할 수 있습니다.

### 이동 메서드

```js
// 히스토리 스택에 추가 — 뒤로가기로 돌아올 수 있음
location.assign('/about');
// 동일: location.href = '/about';

// 현재 엔트리를 교체 — 뒤로가기 불가
location.replace('/login');

// 페이지 새로고침
location.reload();
```

`assign`과 `replace`의 차이는 히스토리 스택입니다. 로그인 후 리다이렉트처럼 "이전 페이지로 돌아가지 않아야 하는" 경우에 `replace`를 씁니다.

---

## URLSearchParams — 쿼리 파라미터 다루기

`location.search`를 직접 문자열로 파싱하는 것보다 `URLSearchParams`가 안전하고 편리합니다.

```js
// 현재 URL의 쿼리 파라미터 읽기
const params = new URLSearchParams(location.search);
params.get('q');           // 'hello'
params.get('lang');        // 'ko'
params.has('page');        // false
params.getAll('tag');      // 복수 값 배열

// 수정
params.set('q', 'world');
params.append('tag', 'js');
params.delete('lang');

// URL에 반영 (replaceState로 히스토리 스택 유지)
history.replaceState({}, '', `?${params}`);
// 새 URL: ?q=world&tag=js

// URL 객체와 함께 사용
const url = new URL('https://example.com?q=test');
url.searchParams.set('page', '2');
console.log(url.href); // 'https://example.com?q=test&page=2'
```

필터, 정렬, 페이지네이션 UI에서 URL을 상태로 사용할 때 핵심 도구입니다.

---

## history API

`history` 객체는 브라우저의 세션 히스토리 스택을 조작합니다.

### 탐색

```js
history.back();       // 뒤로 (= 브라우저 뒤로가기 버튼)
history.forward();    // 앞으로
history.go(-2);       // 두 단계 뒤로
history.go(1);        // 한 단계 앞으로
history.length;       // 히스토리 스택 길이
```

### pushState / replaceState

두 메서드 모두 **페이지 로드 없이** URL을 변경합니다. 이것이 SPA의 핵심 원리입니다.

```js
// 시그니처: history.pushState(state, title, url)
// title은 현재 모든 브라우저에서 무시됨 — 빈 문자열 전달

// 새 URL을 히스토리 스택에 추가
history.pushState({ page: 'home' }, '', '/home');

// 현재 URL을 교체 (스택에 추가 안 함)
history.replaceState({ page: 'profile' }, '', '/profile');
```

`state` 객체는 직렬화 가능한 데이터를 담을 수 있습니다. `popstate` 이벤트에서 `e.state`로 접근합니다.

---

## popstate 이벤트

사용자가 뒤로/앞으로 버튼을 클릭하면 `popstate` 이벤트가 발생합니다. **`pushState`/`replaceState` 호출 자체는 `popstate`를 발생시키지 않습니다.**

```js
window.addEventListener('popstate', (e) => {
  console.log(e.state); // pushState/replaceState에 저장한 state 객체
  renderPage(location.pathname);
});
```

SPA에서 올바른 뒤로가기 처리가 안 된 경우는 대부분 `popstate` 처리를 빠뜨렸기 때문입니다.

---

## SPA 라우터 미니 구현

```js
// 페이지 렌더링 함수
function renderPage(pathname) {
  const routes = {
    '/': HomeComponent,
    '/about': AboutComponent,
    '/contact': ContactComponent,
  };
  const Component = routes[pathname] ?? NotFoundComponent;
  document.getElementById('app').replaceChildren(new Component().render());
}

// 네비게이션
function navigate(url, state = {}) {
  history.pushState(state, '', url);
  renderPage(new URL(url, location.origin).pathname);
}

// 뒤로/앞으로 처리
window.addEventListener('popstate', () => {
  renderPage(location.pathname);
});

// 링크 클릭 가로채기 (이벤트 위임)
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.origin !== location.origin) return; // 외부 링크 무시
  if (a.target === '_blank') return; // 새 탭 무시
  e.preventDefault();
  navigate(a.href);
});

// 초기 렌더링
renderPage(location.pathname);
```

![location · history API](/assets/posts/browser-location-history-api.svg)

![SPA 라우터 핵심 구현](/assets/posts/browser-location-history-code.svg)

---

## 보안 제약

`pushState`/`replaceState`로 변경할 수 있는 URL은 현재 페이지와 **같은 origin** 내로 제한됩니다. 다른 origin으로 변경하면 `SecurityError`가 발생합니다.

```js
// 현재 페이지: https://example.com

history.pushState({}, '', '/new-path');           // OK
history.pushState({}, '', 'https://evil.com');    // SecurityError
```

---

## 정리

| API | 역할 | 히스토리 영향 |
|---|---|---|
| `location.assign(url)` | URL 이동 | 스택 추가 |
| `location.replace(url)` | URL 이동 | 현재 엔트리 교체 |
| `history.pushState(s, '', url)` | URL 변경 (페이지 로드 없음) | 스택 추가 |
| `history.replaceState(s, '', url)` | URL 변경 (페이지 로드 없음) | 현재 엔트리 교체 |
| `popstate` 이벤트 | 뒤로/앞으로 감지 | — |

---

**지난 글:** [window · document · navigator 완전 이해](/posts/browser-window-document-navigator/)

**다음 글:** [localStorage · sessionStorage 완전 이해](/posts/browser-storage-local-session/)

<br>
읽어주셔서 감사합니다. 😊
