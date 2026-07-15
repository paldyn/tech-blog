---
title: "Cookie API 완전 이해"
description: "document.cookie의 읽기·쓰기·삭제 패턴, Secure·HttpOnly·SameSite 보안 속성, Max-Age vs Expires, 현대적 CookieStore API까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "쿠키", "Cookie", "HttpOnly", "SameSite", "Secure", "CookieStore", "브라우저"]
featured: false
draft: false
---

[지난 글](/posts/browser-storage-local-session/)에서 `localStorage`와 `sessionStorage`를 살펴봤습니다. 이번에는 Web Storage보다 오래되고 더 복잡한 쿠키(Cookie) API를 정리합니다. 쿠키는 서버와 클라이언트 사이에서 자동으로 주고받는다는 점에서 Web Storage와 근본적으로 다릅니다.

---

## 쿠키와 Web Storage의 차이

쿠키의 가장 큰 특징은 **HTTP 요청마다 자동으로 서버에 전송**된다는 것입니다. 인증 토큰, 세션 ID처럼 서버가 사용자를 식별해야 하는 데이터에 사용됩니다.

| 항목 | Cookie | localStorage |
|---|---|---|
| 서버 자동 전송 | O | X |
| 용량 | ~4 KB | ~5–10 MB |
| 유효기간 설정 | O | X (직접 관리) |
| 보안 속성 | HttpOnly, Secure, SameSite | 없음 |
| JS 접근 | 선택적 차단 가능 | 항상 가능 |

---

## document.cookie — 기본 API

`document.cookie`는 현재 페이지에서 접근 가능한 모든 쿠키를 `name=value; name2=value2` 형식의 단일 문자열로 반환합니다.

### 쓰기 (Set)

`document.cookie`에 대입하면 **기존 쿠키를 덮어쓰는 것이 아니라** 새 쿠키를 추가하거나 같은 이름의 쿠키를 업데이트합니다.

```js
// 기본 쿠키 (세션 쿠키 — 탭 닫으면 삭제)
document.cookie = 'theme=dark';

// 속성 포함
document.cookie = 'theme=dark; Max-Age=86400; Path=/; SameSite=Lax';

// 여러 쿠키를 설정하려면 각각 대입
document.cookie = 'lang=ko; Path=/';
document.cookie = 'sidebar=open; Path=/';
```

### 읽기 (Get)

```js
function getCookie(name) {
  const entry = document.cookie
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${name}=`));
  return entry ? entry.split('=').slice(1).join('=') : null;
}

getCookie('theme'); // 'dark'
```

값에 `=`이 포함될 수 있으므로 첫 번째 `=`만 분리하는 것이 안전합니다.

### 삭제 (Delete)

쿠키는 `Max-Age=0`으로 설정해 즉시 만료시키는 방식으로 삭제합니다.

```js
function deleteCookie(name, path = '/') {
  document.cookie = `${name}=; Max-Age=0; Path=${path}`;
}

deleteCookie('theme');
```

**중요**: 삭제할 때 `Path`(와 `Domain`)를 원래 설정했던 것과 동일하게 지정해야 합니다. 다르면 다른 쿠키로 인식해 삭제되지 않습니다.

---

## 보안 속성

![쿠키 구조와 보안 속성](/assets/posts/browser-cookie-api-anatomy.svg)

### Secure

`Secure` 속성이 있으면 HTTPS 연결에서만 쿠키가 전송됩니다. `localhost`는 예외적으로 HTTP에서도 작동합니다.

```http
Set-Cookie: session=abc; Secure
```

### HttpOnly

`HttpOnly`는 JavaScript에서 `document.cookie`로 해당 쿠키에 접근하지 못하게 합니다. XSS 공격으로 쿠키가 탈취되는 것을 방지합니다. 세션 토큰이나 인증 관련 쿠키에 반드시 적용합니다.

`HttpOnly` 쿠키는 서버가 `Set-Cookie` 헤더로 설정해야 하며, JavaScript에서는 설정할 수 없습니다.

### SameSite

크로스 사이트 요청에서 쿠키 전송 여부를 제어해 CSRF 공격을 방어합니다.

```text
Strict: 같은 사이트 요청에만 전송
Lax:    탑레벨 GET 요청(링크 클릭)은 허용, 그 외 크로스 사이트는 제한 (기본값)
None:   모든 크로스 사이트 요청 허용 (반드시 Secure 필요)
```

```js
// JavaScript에서 SameSite 설정
document.cookie = 'pref=ko; SameSite=Lax; Path=/';
```

---

## 유효기간: Max-Age vs Expires

```js
// Max-Age: 초 단위 — 권장
document.cookie = `session=abc; Max-Age=${60 * 60 * 24 * 7}`; // 7일

// Expires: UTC 날짜 문자열 — 클라이언트 시계 의존
const d = new Date();
d.setDate(d.getDate() + 7);
document.cookie = `session=abc; Expires=${d.toUTCString()}`;

// 둘 다 없으면 세션 쿠키 (브라우저 닫으면 삭제)
// Max-Age가 Expires보다 우선순위가 높음
```

---

## CookieStore API

현대적 비동기 Cookie API입니다. `HttpOnly` 쿠키는 여전히 접근 불가지만, `document.cookie` 문자열 파싱 없이 쿠키를 다룰 수 있습니다. Service Worker에서도 사용할 수 있습니다.

```js
// 쓰기
await cookieStore.set({
  name: 'theme',
  value: 'dark',
  maxAge: 60 * 60 * 24,    // 초 단위
  path: '/',
  sameSite: 'lax',
});

// 읽기 — null 대신 undefined 반환
const cookie = await cookieStore.get('theme');
console.log(cookie?.value); // 'dark'

// 전체 목록
const all = await cookieStore.getAll();

// 삭제
await cookieStore.delete('theme');

// 변경 감지
cookieStore.addEventListener('change', (e) => {
  console.log(e.changed); // 변경된 쿠키 배열
  console.log(e.deleted); // 삭제된 쿠키 배열
});
```

![쿠키 조작 코드 패턴](/assets/posts/browser-cookie-api-code.svg)

---

## 인코딩

쿠키 이름과 값에 특수문자(`;`, `,`, `=`, 공백 등)가 포함될 수 있다면 `encodeURIComponent`로 인코딩합니다.

```js
function setCookie(name, value, days = 7) {
  const encodedName = encodeURIComponent(name);
  const encodedValue = encodeURIComponent(value);
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodedName}=${encodedValue}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function getCookieDecoded(name) {
  const raw = getCookie(encodeURIComponent(name));
  return raw !== null ? decodeURIComponent(raw) : null;
}
```

---

## 정리

| 속성 | 역할 |
|---|---|
| `Max-Age=N` | N초 후 만료 |
| `Path=/` | 해당 경로 이하에서만 전송 |
| `Domain=.example.com` | 서브도메인 포함 공유 |
| `Secure` | HTTPS만 전송 |
| `HttpOnly` | JavaScript 접근 차단 |
| `SameSite=Lax` | CSRF 방어 |

세션 인증 쿠키에는 반드시 `Secure`, `HttpOnly`, `SameSite=Lax`(또는 `Strict`)를 조합해 사용합니다.

---

**지난 글:** [localStorage · sessionStorage 완전 이해](/posts/browser-storage-local-session/)

**다음 글:** [IndexedDB 완전 이해](/posts/browser-indexeddb/)

<br>
읽어주셔서 감사합니다. 😊
