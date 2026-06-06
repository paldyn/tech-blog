---
title: "HSTS: 강제 HTTPS와 Preload의 모든 것"
description: "Strict-Transport-Security 헤더의 동작 원리, max-age·includeSubDomains·preload 지시자 설명, SSL Stripping 공격 차단, hstspreload.org 등록 절차와 주의사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["HSTS", "HTTPS", "SSLStripping", "보안헤더", "Preload", "TLS"]
featured: false
draft: false
---

[지난 글](/posts/websec-security-headers/)에서 HTTP 보안 헤더 전체를 조망했다. 이번 글에서는 그 중 가장 기초이자 가장 중요한 **HSTS(HTTP Strict Transport Security)**를 깊이 파고든다. HSTS는 HTTP 연결을 HTTPS로 강제해 중간자 공격과 SSL Stripping을 차단한다.

## HTTP의 약점: SSL Stripping

사용자가 브라우저에 `example.com`을 입력하면 브라우저는 기본적으로 `http://example.com`으로 요청을 보낸다. 서버가 `301 Moved Permanently`로 `https://`로 리다이렉트해도, 이 최초의 HTTP 요청은 이미 네트워크에 평문으로 노출된다.

SSL Stripping 공격은 이 첫 번째 HTTP 요청을 가로채서 공격자가 중간에서 피해자에게는 HTTP로 통신하고, 실제 서버와는 HTTPS로 통신하는 MITM 공격이다.

```
피해자 → (HTTP) → 공격자 → (HTTPS) → 서버
           ↑ 여기서 모든 통신이 평문 노출
```

## HSTS: 브라우저가 직접 업그레이드

HSTS는 서버가 HTTPS 응답에 다음 헤더를 포함하는 것으로 시작한다.

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

브라우저는 이 헤더를 받으면 `max-age` 기간 동안 해당 도메인에 대한 HTTP 요청을 네트워크로 보내지 않고, 브라우저 내부에서 즉시 HTTPS로 업그레이드한다.

![HSTS 동작 흐름](/assets/posts/websec-hsts-flow.svg)

## 지시자 상세

### max-age (필수)

HSTS 정책을 적용할 기간(초 단위)이다.

```http
# 최소 6개월 (15768000초)
Strict-Transport-Security: max-age=15768000

# 권장: 1년 (31536000초)
Strict-Transport-Security: max-age=31536000

# 초기 테스트: 짧게 시작
Strict-Transport-Security: max-age=300
```

처음 적용할 때는 작은 값(5분, 300초)으로 시작해 문제가 없으면 점진적으로 늘린다. HSTS 적용 중 HTTP로 롤백해야 하면 브라우저가 만료 전까지 HTTPS를 강제하므로 사이트 접근이 불가해진다.

### includeSubDomains

서브도메인에도 HSTS를 적용한다.

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

`sub.example.com`, `api.example.com` 등 모든 서브도메인에도 HTTPS가 강제된다. 서브도메인 중 HTTP만 지원하는 것이 있으면 적용하지 말아야 한다.

### preload

브라우저 내장 HSTS 목록에 등록하겠다는 의사를 표명한다. 단독으로 효과가 없고 `hstspreload.org`에 실제 등록해야 한다.

## HSTS Preload: 첫 방문도 보호

일반 HSTS의 한계는 첫 방문 시 HTTP 요청이 네트워크에 노출된다는 점이다. Preload는 이를 해결한다.

![HSTS Preload: 브라우저 내장 목록](/assets/posts/websec-hsts-preload.svg)

### 등록 요건

1. **`max-age=31536000` 이상**: 최소 1년
2. **`includeSubDomains` 포함**: 서브도메인 전체 HTTPS 필수
3. **`preload` 지시자 포함**: 헤더에 명시

```http
# Preload 요건 충족 헤더
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**등록 절차**: [hstspreload.org](https://hstspreload.org)에 도메인을 제출하면 Chrome 팀이 검토 후 Chromium 소스에 포함한다. Firefox, Safari, Edge도 같은 목록을 사용한다.

### 주의사항: 취소가 어렵다

Preload 목록에 등록하면 제거 요청 후 **실제 브라우저에 반영되기까지 수개월~1년**이 걸린다. 이미 배포된 브라우저 버전은 업데이트 전까지 계속 HTTPS를 강제한다. 다음 상황에서 심각한 문제가 발생한다.

- 도메인을 매각하거나 만료
- 서브도메인이 HTTP만 지원하는 서드파티 서비스로 변경
- 사이트를 HTTP로 롤백해야 하는 상황

## 구현 예시

### nginx

```nginx
server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # HSTS: 1년, 서브도메인 포함, preload
    add_header Strict-Transport-Security
        "max-age=31536000; includeSubDomains; preload" always;
}

server {
    listen 80;
    server_name example.com www.example.com;
    # HTTP를 HTTPS로 영구 리다이렉트
    return 301 https://$host$request_uri;
}
```

### Express.js

```javascript
import helmet from 'helmet';

app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true
}));
```

### FastAPI

```python
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

app.add_middleware(HTTPSRedirectMiddleware)

@app.middleware("http")
async def add_hsts_header(request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains; preload"
    )
    return response
```

## HSTS 관련 주의사항

```bash
# HSTS 확인 명령어
curl -I https://example.com | grep -i strict-transport

# HSTS 캐시 삭제 (Chrome 기준)
# chrome://net-internals/#hsts 에서 도메인 검색 후 Delete
```

**HSTS는 반드시 HTTPS 응답에서만 전송해야 한다.** HTTP 응답에 HSTS 헤더가 있어도 브라우저가 무시한다. 실수로 HTTP 응답에 HSTS를 보내는 설정 오류는 효과도 없고 의미도 없다.

---

**지난 글:** [HTTP 보안 헤더 완전 가이드](/posts/websec-security-headers/)

**다음 글:** [대칭 암호화 vs 비대칭 암호화](/posts/websec-symmetric-vs-asymmetric/)

<br>
읽어주셔서 감사합니다. 😊
