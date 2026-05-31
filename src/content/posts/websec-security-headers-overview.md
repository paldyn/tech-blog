---
title: "HTTP 보안 헤더 총정리"
description: "CSP, HSTS, X-Frame-Options 등 주요 HTTP 보안 헤더의 역할과 올바른 설정 방법을 설명합니다. Nginx, Apache, 백엔드 프레임워크에서 적용하는 방법과 실전 팁을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["보안헤더", "CSP", "HSTS", "HTTP보안", "XFrameOptions"]
featured: false
draft: false
---

[지난 글](/posts/websec-zero-trust/)에서 제로 트러스트의 원칙을 살펴봤다. 이번에는 웹 서버 설정 몇 줄만으로 브라우저 수준의 방어를 추가할 수 있는 HTTP 보안 헤더를 살펴본다. 비용 대비 효과가 매우 높은 기법이다.

## HTTP 보안 헤더란

HTTP 보안 헤더는 서버가 브라우저에게 보안 관련 동작을 지시하는 메타데이터다. 브라우저가 이 헤더를 해석하고 실행하기 때문에, 애플리케이션 코드를 수정하지 않아도 서버 설정만으로 여러 가지 공격을 막을 수 있다.

![주요 HTTP 보안 헤더](/assets/posts/websec-security-headers-overview-list.svg)

## 필수 보안 헤더

### Content-Security-Policy (CSP)

XSS 방어에 가장 효과적인 헤더다.

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self';
  img-src 'self' data: https:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

### Strict-Transport-Security (HSTS)

브라우저가 항상 HTTPS로만 접속하도록 강제한다.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**주의**: HSTS는 한 번 설정하면 `max-age` 동안 HTTP로 접속이 안 된다. HTTPS 인증서 설정이 완벽할 때만 사용하라.

## 권장 보안 헤더

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

![보안 헤더 설정 예시](/assets/posts/websec-security-headers-overview-code.svg)

## 설정 방법

### Nginx

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Python FastAPI 미들웨어

```python
from fastapi import FastAPI, Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = (
            "strict-origin-when-cross-origin"
        )
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        return response

app = FastAPI()
app.add_middleware(SecurityHeadersMiddleware)
```

무료 온라인 도구 `securityheaders.com`에서 사이트 URL을 입력하면 헤더 등급(A+~F)을 확인할 수 있다.

---

**지난 글:** [제로 트러스트(Zero Trust): '아무도 믿지 마라'](/posts/websec-zero-trust/)

**다음 글:** [강력한 비밀번호 정책 설계하기](/posts/websec-password-policies/)

<br>
읽어주셔서 감사합니다. 😊
