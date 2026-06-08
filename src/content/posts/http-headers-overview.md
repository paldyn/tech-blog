---
title: "HTTP 헤더 완전 정복 — 분류와 핵심 개요"
description: "HTTP 헤더의 4가지 분류(공통·요청·응답·표현), 헤더 이름 규칙, 필수 헤더, HTTP/2에서의 변화, 보안 관련 헤더까지 실무 중심으로 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["HTTP헤더", "헤더분류", "요청헤더", "응답헤더", "공통헤더", "표현헤더", "HTTP/2", "HPACK"]
featured: false
draft: false
---

[지난 글](/posts/http-status-4xx-5xx/)에서 오류 상태 코드를 정리했다. 이번 글에서는 HTTP 메시지에서 시작 줄만큼 중요한 **헤더(Header)**의 전체 구조와 분류를 다룬다.

## HTTP 헤더란

HTTP 헤더는 **요청·응답에 대한 메타데이터**를 담는 이름-값 쌍이다. 인증 정보, 콘텐츠 타입, 캐시 정책, 압축 방식, 쿠키 등 HTTP의 핵심 기능 대부분이 헤더로 제어된다.

```
Header-Name: header value [; parameter=value]\r\n
```

콜론(`:`) 앞에는 공백이 없고, 뒤에는 선택적 공백(OWS)이 허용된다. 이름은 대소문자를 구별하지 않는다 (`Content-Type`과 `content-type`은 동일).

## 4가지 분류

![HTTP 헤더 카테고리](/assets/posts/http-headers-overview-categories.svg)

### 공통 헤더 (General Headers)

요청과 응답 모두에 사용 가능하다.

| 헤더 | 설명 |
|------|------|
| `Date` | 메시지 생성 시각 (RFC 1123 형식) |
| `Connection` | 연결 관리 (`keep-alive`, `close`) |
| `Cache-Control` | 캐시 지시어 |
| `Transfer-Encoding` | 전송 인코딩 (`chunked`) |
| `Via` | 프록시 경유 정보 |
| `Upgrade` | 프로토콜 업그레이드 (WebSocket) |

### 요청 헤더 (Request Headers)

클라이언트가 요청에 추가한다.

```http
Host: www.example.com              (HTTP/1.1 필수)
User-Agent: Mozilla/5.0 Chrome/126
Accept: text/html, application/json
Accept-Language: ko-KR, ko;q=0.9
Accept-Encoding: gzip, br, zstd
Authorization: Bearer eyJhbGci...
Referer: https://google.com/search
Cookie: session=abc123; theme=dark
If-None-Match: "abc123"
If-Modified-Since: Mon, 09 Jun 2026 00:00:00 GMT
```

### 응답 헤더 (Response Headers)

서버가 응답에 추가한다.

```http
Server: nginx/1.27.0
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict
Location: /api/users/42           (201·3xx 응답 시)
WWW-Authenticate: Bearer realm="api"
Retry-After: 60
ETag: "d41d8cd98f00b204e9800998ecf8427e"
Allow: GET, POST, OPTIONS
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
```

### 표현 헤더 (Representation Headers)

메시지 본문의 형식과 인코딩을 설명한다.

| 헤더 | 설명 |
|------|------|
| `Content-Type` | 미디어 타입 + 문자셋 |
| `Content-Length` | 본문 바이트 수 |
| `Content-Encoding` | 압축 방식 (`gzip`, `br`) |
| `Content-Language` | 언어 (`ko`, `en`) |
| `Content-Range` | 부분 응답 범위 |
| `Last-Modified` | 마지막 수정 시각 |
| `ETag` | 리소스 버전 식별자 |

## 실제 헤더 예시

![HTTP 헤더 요청/응답 예시](/assets/posts/http-headers-overview-examples.svg)

## 필수 헤더

**HTTP/1.1에서 필수**:
- `Host`: 요청 헤더. 하나의 IP에 여러 가상 호스트가 있을 때 라우팅에 사용.

**사실상 필수 (서버 호환성)**:
- `Content-Type`: 본문이 있는 모든 요청·응답
- `Content-Length` 또는 `Transfer-Encoding: chunked`: 본문 크기 전달

## HTTP/2에서의 변화

HTTP/2는 헤더를 **소문자 강제** + **HPACK 압축**으로 처리한다.

```
HTTP/1.1 (텍스트)           HTTP/2 (가상 헤더)
GET /search HTTP/1.1    →   :method: GET
Host: www.example.com   →   :path: /search
                            :scheme: https
                            :authority: www.example.com
```

HPACK은 **정적 테이블**(자주 쓰는 헤더 62개 사전 정의)과 **동적 테이블**(이전에 보낸 헤더 캐시)을 사용해 반복 헤더를 1~2바이트로 압축한다.

```
# HTTP/2 정적 테이블 예시
인덱스 2  = :method: GET        (1바이트로 표현)
인덱스 8  = :status: 200
인덱스 31 = content-type
```

## 보안 관련 헤더

헤더는 보안에서도 핵심 역할을 한다.

```http
# HTTPS 강제
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# 클릭재킹 방지
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: frame-ancestors 'none'

# XSS 방지
Content-Security-Policy: default-src 'self'; script-src 'nonce-abc123'

# 콘텐츠 스니핑 방지
X-Content-Type-Options: nosniff

# 리퍼러 정보 제어
Referrer-Policy: strict-origin-when-cross-origin
```

## 커스텀 헤더

표준에 없는 헤더는 직접 정의할 수 있다. 과거 `X-` 접두사가 관례였으나 RFC 6648(2012)에서 폐지됐다. 충돌을 피하려면 회사명·서비스명을 접두사로 사용한다.

```http
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000   (레거시 X- 방식)
Cloudflare-Ray: 8d7f9a2b1c3e4d5f                    (Cloudflare 고유)
X-GitHub-Request-Id: abc-123                         (GitHub 방식)
```

---

**지난 글:** [4xx 클라이언트 오류와 5xx 서버 오류](/posts/http-status-4xx-5xx/)

<br>
읽어주셔서 감사합니다. 😊
