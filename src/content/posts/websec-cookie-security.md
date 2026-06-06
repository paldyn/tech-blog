---
title: "쿠키 보안: Secure·HttpOnly·SameSite 완전 정복"
description: "Set-Cookie 속성(Secure·HttpOnly·SameSite·Path·Domain·Max-Age)이 막는 공격 유형, SameSite 세 가지 값의 동작 차이, 서드파티 쿠키 환경에서의 대응 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["쿠키", "HttpOnly", "Secure", "SameSite", "CSRF", "세션보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-postmessage-security/)에서 크로스 오리진 통신의 보안 구현을 다뤘다. 이번 글에서는 웹 인증의 핵심 저장소인 쿠키의 보안 속성을 파고든다. 쿠키 하나를 잘못 설정하면 XSS로 세션이 탈취되거나, CSRF로 의도치 않은 요청이 전송된다.

## 쿠키의 보안 위협

쿠키는 HTTP 통신에서 상태를 유지하는 기본 메커니즘이다. 세션 ID, 인증 토큰, 사용자 설정 등을 담는다. 공격자가 쿠키를 탈취하면 사용자를 완전히 사칭할 수 있어 쿠키 보안은 인증 보안과 동의어다.

주요 위협은 세 가지다.

1. **네트워크 도청**: HTTP 평문 전송 시 MITM 공격으로 탈취
2. **XSS를 통한 탈취**: `document.cookie`로 쿠키값 훔쳐 외부 전송
3. **CSRF**: 피해자 브라우저가 의도치 않은 요청 시 쿠키 자동 포함

## 쿠키 보안 속성 완전 정리

![쿠키 보안 속성 참조표](/assets/posts/websec-cookie-attributes.svg)

### Secure: 네트워크 도청 방어

```http
Set-Cookie: session=abc123; Secure
```

`Secure` 플래그가 있으면 브라우저는 HTTPS 연결에서만 쿠키를 전송한다. HTTP로 요청이 들어오면 해당 쿠키는 자동으로 제외된다. 로컬 개발 환경(`localhost`)은 예외적으로 HTTP에서도 동작한다.

### HttpOnly: XSS로부터 쿠키 보호

```http
Set-Cookie: session=abc123; HttpOnly
```

`HttpOnly`가 설정된 쿠키는 JavaScript의 `document.cookie`로 읽을 수 없다. XSS 공격으로 스크립트가 실행되어도 이 쿠키는 탈취할 수 없다.

```javascript
// HttpOnly 쿠키는 읽히지 않음
console.log(document.cookie); // session 쿠키는 빠짐

// 요청 시에는 자동으로 포함됨 (브라우저가 처리)
fetch('/api/profile'); // session 쿠키 자동 첨부
```

**중요**: `HttpOnly`는 XSS 쿠키 탈취를 막지만 XSS 자체를 막지는 않는다. 로그인된 사용자로 API를 호출하는 XSS 공격은 여전히 가능하다.

### SameSite: CSRF 방어의 핵심

SameSite는 크로스 사이트 요청 시 쿠키를 전송할지 결정한다. 세 가지 값이 있다.

![SameSite 속성 동작 비교](/assets/posts/websec-cookie-samesite.svg)

**SameSite=Strict**: 모든 크로스 사이트 요청에서 쿠키를 전송하지 않는다. 가장 강력한 CSRF 방어지만, 외부 링크를 통해 사이트에 처음 접근할 때도 쿠키가 없어 로그인 상태가 유지되지 않는다. 은행 거래처럼 보안이 최우선인 경우에 적합하다.

**SameSite=Lax** (Chrome 기본값): GET 방식의 최상위 탐색(링크 클릭)에는 쿠키를 포함하지만, POST 폼 제출이나 XHR/Fetch 같은 크로스 사이트 요청은 차단한다. 대부분의 CSRF 공격을 막으면서 사용자 경험을 유지한다.

**SameSite=None**: 크로스 사이트 요청에도 쿠키를 전송한다. 반드시 `Secure`와 함께 사용해야 한다. OAuth 콜백, 결제 위젯처럼 서드파티 통합이 필요한 경우에만 사용한다.

## 권장 쿠키 설정

```python
# FastAPI/Starlette 예시
from fastapi import Response

def set_secure_cookie(response: Response, session_id: str):
    response.set_cookie(
        key="session",
        value=session_id,
        httponly=True,          # XSS 탈취 방지
        secure=True,            # HTTPS 전용
        samesite="lax",         # CSRF 방어
        max_age=3600,           # 1시간 만료
        path="/",               # 전체 경로
        domain=None             # 현재 도메인만 (서브도메인 제외)
    )
```

```javascript
// Express.js 예시
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000  // 1시간
  }
}));
```

## Domain과 Path 속성

```http
Set-Cookie: pref=dark; Domain=example.com; Path=/app
```

**Domain**: 지정된 도메인과 하위 도메인(서브도메인)에 쿠키를 전송한다. 지정하지 않으면 현재 도메인에만 전송된다. `Domain=example.com`으로 설정하면 `sub.example.com`에도 전송되므로, 신뢰하지 않는 서브도메인이 있다면 주의해야 한다.

**Path**: 특정 경로 이하 요청에만 쿠키를 포함한다. `/admin` 쿠키가 `/public` 페이지에는 전송되지 않게 격리할 수 있다.

## 서드파티 쿠키 종말 이후

Chrome이 서드파티 쿠키를 단계적으로 폐지하면서 `SameSite=None`으로 동작하던 크로스 사이트 쿠키가 영향받는다. 대안으로는:

- **Storage Access API**: 사용자 허가 후 크로스 사이트 쿠키 접근
- **CHIPS (Partitioned Cookies)**: `Partitioned` 속성으로 사이트별 격리 쿠키

```http
Set-Cookie: widget_pref=dark; SameSite=None; Secure; Partitioned
```

## 보안 체크리스트

| 항목 | 설명 |
|---|---|
| `Secure` | HTTPS 환경에서는 항상 |
| `HttpOnly` | JS 접근이 불필요한 쿠키 (세션 ID 등)에 항상 |
| `SameSite=Lax` | 최소 기준. 민감한 작업은 Strict 고려 |
| `Max-Age` 또는 `Expires` | 영구 쿠키 방지 |
| `Path=/` | 최소 필요 경로로 제한 |
| `Domain` 미설정 | 현재 도메인만으로 제한 |

---

**지난 글:** [postMessage 보안: 크로스 오리진 통신 안전하게](/posts/websec-postmessage-security/)

**다음 글:** [클릭재킹: 보이지 않는 레이어의 함정](/posts/websec-clickjacking/)

<br>
읽어주셔서 감사합니다. 😊
