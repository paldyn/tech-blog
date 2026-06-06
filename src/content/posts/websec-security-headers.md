---
title: "HTTP 보안 헤더 완전 가이드"
description: "HSTS·CSP·X-Frame-Options·X-Content-Type-Options·Referrer-Policy·Permissions-Policy 등 필수 보안 헤더의 역할, 값 설정, nginx/Express/FastAPI 구현, 검사 도구를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["보안헤더", "HTTP헤더", "HSTS", "CSP", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]
featured: false
draft: false
---

[지난 글](/posts/websec-subresource-integrity/)에서 CDN 리소스의 무결성을 SRI로 보장하는 방법을 다뤘다. 이번 글에서는 서버가 브라우저에 전달하는 **HTTP 보안 헤더** 전체를 정리한다. 보안 헤더는 응답 헤더 몇 줄로 XSS, 클릭재킹, 도청 등 다양한 공격을 브라우저 레벨에서 차단할 수 있는 강력하고 저비용의 방어 수단이다.

## 보안 헤더 전체 개요

![HTTP 보안 헤더 완전 가이드](/assets/posts/websec-security-headers-overview.svg)

## 핵심 헤더별 상세 설명

### 1. Strict-Transport-Security (HSTS)

HTTP 연결을 HTTPS로 강제한다. 사용자가 `http://`로 접속해도 브라우저가 자동으로 `https://`로 업그레이드한다. SSL Stripping 공격을 막는다.

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- `max-age`: HSTS 정책 적용 기간(초). 최소 6개월, 권장 1년
- `includeSubDomains`: 서브도메인에도 HSTS 적용
- `preload`: 브라우저 preload list에 등록 (hstspreload.org)

> HSTS는 다음 글에서 별도로 심층 분석한다.

### 2. Content-Security-Policy (CSP)

어떤 오리진에서 리소스를 로드할 수 있는지 세밀하게 제어한다. XSS 방어의 핵심이다.

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' cdn.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  frame-ancestors 'self';
  base-uri 'self';
  form-action 'self'
```

`report-only` 모드로 먼저 테스트한 후 적용한다.

```http
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

### 3. X-Content-Type-Options

브라우저가 응답의 Content-Type을 무시하고 내용을 분석해 타입을 추측하는 MIME 스니핑을 차단한다. 공격자가 이미지로 위장한 스크립트를 실행하는 공격을 막는다.

```http
X-Content-Type-Options: nosniff
```

값은 `nosniff` 하나뿐이다. 설정이 간단하므로 모든 응답에 추가한다.

### 4. Referrer-Policy

다른 사이트로 이동할 때 `Referer` 헤더에 포함되는 정보를 제어한다. 인증 토큰이나 사용자 ID가 URL에 포함된 경우 유출을 막는다.

```http
# 권장: 같은 오리진에는 전체 URL, 크로스 오리진에는 오리진만
Referrer-Policy: strict-origin-when-cross-origin

# 최강 보호: Referer 헤더를 전혀 보내지 않음
Referrer-Policy: no-referrer
```

| 값 | 설명 |
|---|---|
| `no-referrer` | Referer 헤더 없음 |
| `origin` | 오리진만 전송 (경로 제외) |
| `strict-origin-when-cross-origin` | 동일 오리진: 전체, 크로스: 오리진만 |
| `unsafe-url` | 항상 전체 URL 전송 (비권장) |

### 5. Permissions-Policy

브라우저 API 접근을 제한한다. 악성 스크립트가 카메라, 마이크, 위치정보를 무단으로 사용하는 것을 막는다.

```http
Permissions-Policy:
  camera=(),
  microphone=(),
  geolocation=(),
  payment=(self),
  usb=()
```

빈 괄호 `()`는 완전 차단, `(self)`는 자신만 허용, `(self "https://partner.com")`은 파트너 허용이다.

### 6. Cross-Origin 헤더 (고급)

Spectre 사이드채널 공격 방어를 위한 세 가지 헤더다. `SharedArrayBuffer`와 고해상도 타이머가 필요한 경우 설정한다.

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

`COEP + COOP` 두 헤더를 함께 설정하면 Cross-Origin Isolated 컨텍스트가 활성화되고 `SharedArrayBuffer` 사용이 가능해진다.

## 환경별 구현

![보안 헤더 실전 설정](/assets/posts/websec-security-headers-config.svg)

### nginx 완전 설정

```nginx
# /etc/nginx/sites-enabled/example.conf
server {
    listen 443 ssl http2;
    server_name example.com;

    # SSL 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # 보안 헤더
    add_header Strict-Transport-Security
      "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy
      "default-src 'self'; script-src 'self' cdn.example.com" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy
      "camera=(), microphone=(), geolocation=()" always;
}
```

### Express.js + helmet

```javascript
import helmet from 'helmet';

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "cdn.example.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameAncestors: ["'self'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'sameorigin' },
  noSniff: true
}));
```

## 헤더 검사

```bash
# curl로 헤더 확인
curl -I https://example.com | grep -iE "strict|content-security|x-frame|referrer|permissions"
```

온라인 검사 도구:
- **securityheaders.com**: A~F 등급 채점
- **observatory.mozilla.org**: Mozilla 기준 검사
- **hstspreload.org**: HSTS preload 등록 상태 확인

## 적용 우선순위

보안 헤더 도입 순서를 추천한다.

1. **즉시 적용**: `X-Content-Type-Options: nosniff` (영향 없음, 설정 쉬움)
2. **즉시 적용**: `X-Frame-Options: SAMEORIGIN` (클릭재킹 방어)
3. **적용**: `Strict-Transport-Security` (HTTPS 전환 완료 후)
4. **단계적 적용**: `Content-Security-Policy` (Report-Only로 시작)
5. **적용**: `Referrer-Policy`, `Permissions-Policy`

---

**지난 글:** [서브리소스 무결성(SRI): CDN 공급망 공격 방어](/posts/websec-subresource-integrity/)

**다음 글:** [HSTS: 강제 HTTPS와 Preload의 모든 것](/posts/websec-hsts/)

<br>
읽어주셔서 감사합니다. 😊
