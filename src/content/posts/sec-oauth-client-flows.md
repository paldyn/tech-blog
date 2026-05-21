---
title: "OAuth 2.0 클라이언트 흐름 — PKCE와 Authorization Code"
description: "OAuth 2.0 흐름의 종류(Authorization Code·PKCE·Client Credentials·Device)와 각 흐름의 적합한 상황, SPA에서 PKCE 구현, state 파라미터로 CSRF 방어, 토큰 저장 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "OAuth2", "PKCE", "Authorization Code", "SPA인증", "state파라미터"]
featured: false
draft: false
---

[지난 글](/posts/sec-jwt-storage/)에서 JWT 저장 전략을 살펴봤습니다. 이번에는 소셜 로그인과 API 권한 위임의 근간인 **OAuth 2.0**의 클라이언트 흐름을 정리합니다.

## OAuth 2.0이란

OAuth 2.0은 리소스 소유자(사용자)가 클라이언트(앱)에게 서버의 리소스에 대한 **제한적 접근 권한**을 위임하는 프레임워크입니다. 비밀번호를 공유하지 않고 "Google Drive 파일 읽기" 같은 특정 권한만 허용할 수 있습니다.

등장하는 네 주체는 다음과 같습니다.

- **리소스 소유자(RO)**: 사용자
- **클라이언트**: 권한을 요청하는 앱
- **인가 서버(AS)**: 동의를 받고 토큰을 발급하는 서버(Google, GitHub 등)
- **리소스 서버(RS)**: 실제 데이터를 가진 API 서버

## 흐름의 종류

| 흐름 | 사용 환경 | 클라이언트 시크릿 |
|---|---|---|
| Authorization Code | 백엔드 서버 앱 | 필요 |
| **Authorization Code + PKCE** | SPA·모바일 앱 | 불필요 |
| Client Credentials | 서버 간 통신 | 필요 |
| Device Code | TV·CLI 기기 | 불필요 |
| Implicit (폐기) | — | — |

SPA와 모바일 앱은 클라이언트 시크릿을 안전하게 보관할 수 없기 때문에 **PKCE(Proof Key for Code Exchange)** 가 필수입니다.

## Authorization Code + PKCE 흐름

![OAuth 2.0 — Authorization Code + PKCE 흐름](/assets/posts/sec-oauth-client-flows-pkce.svg)

PKCE의 핵심은 `code_verifier`와 `code_challenge`의 쌍입니다.

1. 클라이언트가 무작위 `code_verifier`를 생성하고, `SHA-256(code_verifier)`를 `code_challenge`로 계산합니다.
2. 인가 요청 시 `code_challenge`를 포함시킵니다.
3. 인가 서버가 인가 코드를 반환합니다.
4. 토큰 교환 시 `code_verifier`를 포함시킵니다.
5. 인가 서버가 `SHA256(code_verifier) == code_challenge`를 검증합니다.

공격자가 인가 코드를 중간에서 가로채도 `code_verifier`를 모르면 토큰 교환이 불가능합니다.

![PKCE 클라이언트 구현](/assets/posts/sec-oauth-client-flows-code.svg)

```js
// Web Crypto API로 code_verifier 및 challenge 생성
function generateCodeVerifier(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function sha256base64url(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

## state 파라미터 — CSRF 방어

인가 요청에 무작위 `state` 값을 포함시키고, 리다이렉트 후 돌아온 `state`가 일치하는지 확인해야 합니다. 이를 통해 CSRF 공격으로 다른 사람의 계정을 내 세션에 연결하는 공격을 방어합니다.

```js
// 인가 요청 전
const state = crypto.randomUUID();
sessionStorage.setItem('oauth_state', state);

// 인가 URL에 포함
params.append('state', state);

// 콜백에서 검증
const returnedState = new URLSearchParams(location.search).get('state');
if (returnedState !== sessionStorage.getItem('oauth_state')) {
  throw new Error('State mismatch — possible CSRF');
}
sessionStorage.removeItem('oauth_state');
```

## 토큰 교환 (백엔드 BFF 패턴)

SPA에서 토큰 교환을 직접 하면 CORS 설정이 필요하고 토큰이 브라우저에 노출됩니다. **BFF(Backend for Frontend)** 패턴은 중간 서버를 두어 토큰 교환을 처리하고, 브라우저에는 HttpOnly 쿠키로만 세션을 전달합니다.

```
SPA → BFF 서버 → 인가 서버 (토큰 교환)
                ↓
        HttpOnly 쿠키로 세션 발급 → SPA
```

```js
// BFF 서버에서 토큰 교환
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  // state 검증은 서버 세션으로...

  const tokenRes = await fetch('https://as.example.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: session.codeVerifier,
    }),
  });

  const { access_token, refresh_token } = await tokenRes.json();

  // 토큰을 서버 세션에 저장, 브라우저에는 세션 쿠키만
  req.session.accessToken = access_token;
  req.session.refreshToken = refresh_token;

  res.redirect('/dashboard');
});
```

## Client Credentials 흐름

서버 간 API 통신처럼 사용자가 없는 상황에서 씁니다.

```js
const tokenRes = await fetch('https://as.example.com/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
  },
  body: 'grant_type=client_credentials&scope=read:data',
});

const { access_token, expires_in } = await tokenRes.json();
```

## 보안 체크리스트

| 항목 | 설명 |
|---|---|
| PKCE 사용 | SPA·모바일에서 필수, 코드 가로채기 방어 |
| state 파라미터 | 요청·응답 state 일치 검증, CSRF 방어 |
| 리다이렉트 URI 검증 | 서버에서 허용 목록과 정확히 일치 검사 |
| 토큰 저장 | Access Token 인메모리, Refresh Token HttpOnly 쿠키 |
| scope 최소화 | 필요한 권한만 요청 |

## 정리

SPA의 OAuth 구현에는 Authorization Code + PKCE가 표준입니다. `state` 파라미터로 CSRF를 방어하고, 토큰은 인메모리 + HttpOnly 쿠키 패턴을 사용합니다. 민감한 앱이라면 BFF 패턴으로 토큰 자체를 브라우저에서 완전히 숨기는 것이 최선입니다. 다음 글에서는 `eval()`과 `Function()` 생성자의 보안 위험을 다룹니다.

---

**지난 글:** [JWT 저장 전략 — localStorage vs HttpOnly 쿠키](/posts/sec-jwt-storage/)

**다음 글:** [eval과 new Function의 보안 위험](/posts/sec-eval-function-risk/)

<br>
읽어주셔서 감사합니다. 😊
