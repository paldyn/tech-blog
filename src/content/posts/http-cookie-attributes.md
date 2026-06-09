---
title: "쿠키 속성 완전 정복 — Secure, HttpOnly, SameSite, Max-Age"
description: "쿠키의 7가지 속성(Expires, Max-Age, Domain, Path, Secure, HttpOnly, SameSite)을 보안 관점에서 완전 해설하고, 실무 조합 권장사항을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["쿠키속성", "Secure쿠키", "HttpOnly", "SameSite", "CSRF방어", "XSS방어", "쿠키보안"]
featured: false
draft: false
---

[지난 글](/posts/http-cookies/)에서 쿠키의 기본 동작과 생명주기를 배웠다. 이번 글에서는 쿠키에 적용할 수 있는 **7가지 속성**을 보안 관점에서 완전히 해설하고, 조합 방법과 실무 예시를 제공한다.

## 속성 전체 개요

![쿠키 속성 완전 정리](/assets/posts/http-cookie-attributes-list.svg)

Set-Cookie의 전형적인 완전한 형태:

```http
Set-Cookie: sessionId=abc123;
  Expires=Thu, 01 Jan 2027 00:00:00 GMT;
  Max-Age=86400;
  Domain=example.com;
  Path=/;
  Secure;
  HttpOnly;
  SameSite=Lax
```

## Expires와 Max-Age

쿠키 만료 시간을 지정한다. 둘 다 있으면 **Max-Age 우선**이다.

```http
# Expires: HTTP-date 형식 (GMT)
Set-Cookie: prefs=dark; Expires=Fri, 31 Dec 2026 23:59:59 GMT

# Max-Age: 초 단위 상대값
Set-Cookie: prefs=dark; Max-Age=31536000   # 1년 = 86400 × 365

# 즉시 삭제 트릭
Set-Cookie: sessionId=; Max-Age=0; Path=/
Set-Cookie: sessionId=; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

Max-Age의 장점: 서버-클라이언트 시계 불일치에 영향을 받지 않는다. 음수나 0이면 즉시 삭제된다.

세션 쿠키(만료 없음) vs 영구 쿠키의 선택 기준:
- **세션 쿠키**: 높은 보안이 필요한 인증 토큰, 일시적 상태
- **영구 쿠키**: 사용자 설정, 장기 "기억하기" 기능

## Domain과 Path (범위 속성)

이 속성들은 앞에서 다뤘으므로 보안 관점을 보충한다.

```http
# 보안 관점: Domain은 최소 범위로
# 잘못된 예: 너무 넓음
Set-Cookie: apiKey=secret; Domain=.com   # 브라우저가 거부

# 올바른 예: 필요한 만큼만
Set-Cookie: sid=abc; Domain=api.example.com
Set-Cookie: csrf=xyz; Path=/api
```

Path는 **보안 경계가 아니다.** 동일 오리진 내에서는 `document.cookie`로 다른 Path 쿠키도 읽힌다. 진정한 격리가 필요하면 다른 서브도메인을 사용하라.

## Secure 속성

**HTTPS 연결에서만 쿠키를 전송**하도록 강제한다.

```http
Set-Cookie: sessionId=abc; Secure
```

Secure가 없는 쿠키는 HTTP와 HTTPS 양쪽에서 전송되어 **중간자 공격(MITM)**에 노출된다. 특히 HTTP 업그레이드 시나리오에서 쿠키가 평문으로 전송될 수 있다.

```python
# HSTS(HTTP Strict Transport Security)와 함께 사용
response.headers['Strict-Transport-Security'] = \
    'max-age=31536000; includeSubDomains; preload'

response.set_cookie(
    'sessionId', session_id,
    secure=True,
    httponly=True
)
```

localhost는 예외적으로 Secure 없이도 쿠키가 전송된다. 개발 환경 설정 시 주의하라.

## HttpOnly 속성

**JavaScript에서 쿠키 접근을 차단**한다. `document.cookie`로 읽거나 쓸 수 없다.

```http
Set-Cookie: sessionId=abc; HttpOnly
```

```javascript
// HttpOnly가 없는 쿠키
document.cookie;  // "sessionId=abc; theme=dark"

// HttpOnly 쿠키는 JS에서 보이지 않음
// 공격자의 XSS 스크립트에서도 접근 불가
document.cookie;  // "theme=dark"  (sessionId 없음)
```

HttpOnly는 **XSS(Cross-Site Scripting) 공격에서 세션 쿠키 탈취를 방어**하는 핵심 속성이다. 세션 ID는 반드시 HttpOnly로 설정해야 한다.

단, HttpOnly가 있어도 네트워크 레벨의 스니핑이나 CSRF 공격은 막지 못한다. Secure, SameSite와 조합이 필요하다.

## SameSite 속성 (핵심 보안 속성)

**크로스사이트 요청에서 쿠키 전송 여부**를 제어한다. CSRF(Cross-Site Request Forgery) 방어의 핵심이다.

![SameSite 속성 동작 비교](/assets/posts/http-cookie-attributes-samesite.svg)

### Strict

가장 엄격하다. 현재 사이트와 동일한 사이트에서 시작된 요청에만 쿠키를 전송한다.

```http
Set-Cookie: adminToken=xyz; SameSite=Strict
```

```
외부 링크 클릭 → example.com  : 쿠키 미전송 (처음 방문)
example.com 내부 탐색          : 쿠키 전송
form POST from evil.com       : 쿠키 미전송
```

**단점**: 다른 사이트에서 링크를 클릭해 들어올 때 쿠키가 없다. 로그인 상태로 직접 접근을 허용해야 하는 서비스(메일 링크, SNS 공유 등)에서는 불편할 수 있다.

### Lax (Chrome 80+ 기본값)

상위 탐색(top-level navigation) GET 요청에는 쿠키를 전송하고, 크로스사이트 이미지/iframe 로드나 form POST에는 전송하지 않는다.

```http
Set-Cookie: sessionId=abc; SameSite=Lax
```

```
외부 링크 클릭 → example.com  : 쿠키 전송 (최상위 GET 탐색)
<img src="example.com/img">    : 쿠키 미전송
form POST from evil.com       : 쿠키 미전송
OAuth 리다이렉트               : 쿠키 전송
```

대부분의 서비스에 적합한 설정이다. CSRF 방어와 편의성의 균형을 잘 맞춘다.

### None

모든 크로스사이트 요청에 쿠키를 전송한다. **반드시 Secure 속성을 함께 사용해야 한다.**

```http
Set-Cookie: trackingId=xyz; SameSite=None; Secure
```

서드파티 서비스(결제, 위젯, 광고)에서 iframe이나 크로스오리진 요청을 통해 쿠키를 전달해야 할 때 사용한다.

### SameSite 미지정 동작

Chrome 80 이전에는 SameSite 미지정 시 None처럼 동작했다. Chrome 80부터는 **Lax가 기본값**으로 바뀌었다. 레거시 코드에서 SameSite가 없는 쿠키가 갑자기 크로스사이트에서 동작하지 않는 이유가 이것이다.

## 실무 보안 조합

```python
# 세션 쿠키 최고 보안 설정
response.set_cookie(
    key="__Host-sessionId",   # __Host- 프리픽스로 추가 강화
    value=session_id,
    max_age=3600,
    path="/",
    secure=True,
    httponly=True,
    samesite="lax"
)

# 장기 저장 사용자 설정 쿠키
response.set_cookie(
    key="user_theme",
    value="dark",
    max_age=31536000,   # 1년
    path="/",
    samesite="lax"
    # secure, httponly 불필요: 민감하지 않은 데이터
)

# 결제/서드파티 통합용 쿠키
response.set_cookie(
    key="payment_token",
    value=token,
    max_age=300,         # 5분만 유효
    path="/checkout",
    secure=True,
    httponly=True,
    samesite="none"
)
```

### 체크리스트

| 쿠키 유형 | Secure | HttpOnly | SameSite |
|-----------|--------|----------|----------|
| 세션 ID | ✓ 필수 | ✓ 필수 | Lax |
| CSRF 토큰 | ✓ 필수 | ✗ (JS에서 읽어야 함) | Strict |
| 인증 토큰 | ✓ 필수 | ✓ 필수 | Strict/Lax |
| 사용자 설정 | 권장 | ✗ 불필요 | Lax |
| 서드파티 통합 | ✓ 필수 | 상황에 따라 | None |

---

**지난 글:** [HTTP 쿠키 완전 정복 — Set-Cookie와 Cookie 헤더](/posts/http-cookies/)

**다음 글:** [쿠키 보안 프리픽스 — __Host- 와 __Secure-](/posts/http-cookie-prefixes/)

<br>
읽어주셔서 감사합니다. 😊
