---
title: "HTTP 메서드 완전 정복 — GET·POST·PUT·PATCH·DELETE"
description: "HTTP/1.1의 9가지 표준 메서드(GET·HEAD·POST·PUT·PATCH·DELETE·OPTIONS·CONNECT·TRACE)의 의미·목적·안전성·멱등성을 RFC 7231 기준으로 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["HTTP메서드", "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "RFC7231", "REST"]
featured: false
draft: false
---

[지난 글](/posts/http-message-anatomy-deep/)에서 HTTP 메시지의 바이트 구조를 분석했다. 이번 글에서는 요청 줄의 핵심인 **HTTP 메서드** 9종을 완전히 정리한다.

## HTTP 메서드란

HTTP 메서드는 클라이언트가 서버에게 **수행할 동작의 의미**를 전달하는 토큰이다. RFC 7231 §4가 표준을 정의하며, 이후 RFC 5789(PATCH)가 추가됐다.

메서드는 **안전성(Safe)**과 **멱등성(Idempotent)**이라는 두 가지 핵심 속성을 갖는다.

- **안전(Safe)**: 요청이 서버 상태를 변경하지 않는다. (읽기 전용)
- **멱등(Idempotent)**: 동일 요청을 여러 번 보내도 결과가 같다.

![HTTP 메서드 9종 개요](/assets/posts/http-methods-overview.svg)

## 9가지 메서드 상세

### GET — 리소스 조회

```http
GET /api/users/42 HTTP/1.1
Host: api.example.com
```

가장 많이 사용되는 메서드. 리소스의 현재 표현을 요청한다. **본문을 보내면 안 된다** (기술적으로 허용되나 서버가 무시할 수 있음). URL에 모든 정보가 포함되므로 캐시·북마크가 가능하다.

### HEAD — 헤더만 조회

```http
HEAD /api/users/42 HTTP/1.1
Host: api.example.com
```

GET과 동일하지만 **응답 본문을 반환하지 않는다**. 파일 크기 확인(`Content-Length`), 리소스 존재 여부 검사, 캐시 유효성 확인 등에 사용한다.

### POST — 생성·처리

```http
POST /api/users HTTP/1.1
Host: api.example.com
Content-Type: application/json

{"name":"Alice","age":30}
```

요청 본문의 데이터로 새 리소스를 생성하거나 특정 처리를 수행한다. **멱등하지 않으므로** 같은 요청을 두 번 보내면 두 개의 리소스가 생성될 수 있다.

### PUT — 전체 교체

```http
PUT /api/users/42 HTTP/1.1
Content-Type: application/json

{"name":"Bob","age":25,"email":"bob@example.com"}
```

지정한 URI의 리소스를 **요청 본문으로 완전히 대체**한다. 리소스가 없으면 생성한다. **본문의 모든 필드를 포함해야 한다** — 누락된 필드는 제거될 수 있다.

### PATCH — 부분 수정

```http
PATCH /api/users/42 HTTP/1.1
Content-Type: application/merge-patch+json

{"name":"Bob"}
```

리소스의 **일부만 수정**한다. PUT과 달리 명시된 필드만 변경하고 나머지는 유지한다. RFC 5789(2010)에서 추가됐다.

### DELETE — 삭제

```http
DELETE /api/users/42 HTTP/1.1
Host: api.example.com
```

지정한 리소스를 삭제한다. 성공 시 204 No Content(본문 없음) 또는 200 OK(삭제 결과 포함)를 반환한다. **멱등**하다 — 이미 삭제된 리소스를 다시 삭제 요청해도 서버 상태는 동일(리소스 없음).

### OPTIONS — 허용 메서드 조회

```http
OPTIONS /api/users HTTP/1.1

# 응답
HTTP/1.1 204 No Content
Allow: GET, POST, OPTIONS
Access-Control-Allow-Methods: GET, POST
```

서버가 해당 리소스에서 허용하는 메서드 목록을 반환한다. **CORS 프리플라이트 요청**에 사용된다.

### CONNECT — HTTPS 터널

```http
CONNECT www.example.com:443 HTTP/1.1
Host: www.example.com:443
```

프록시 서버에게 목적지까지의 **TCP 터널**을 수립하도록 요청한다. 브라우저가 HTTP 프록시를 통해 HTTPS 사이트에 접속할 때 사용된다.

### TRACE — 루프백 진단

요청을 서버가 그대로 반향(echo)하여 응답한다. 경로 진단용이나 XST(Cross-Site Tracing) 공격 우려로 **실무에서 거의 비활성화**되어 있다.

## CRUD와의 매핑

![HTTP 메서드 CRUD 매핑](/assets/posts/http-methods-crud-mapping.svg)

## 확장 메서드

표준 외 메서드도 사용 가능하다. `WebDAV`는 `PROPFIND`, `MKCOL`, `COPY`, `MOVE` 등을 정의한다. 서버가 모르는 메서드를 받으면 **501 Not Implemented**를 반환해야 한다.

---

**지난 글:** [HTTP 메시지 해부 심화 — 바이트 레벨 분석](/posts/http-message-anatomy-deep/)

**다음 글:** [HTTP 메서드 안전성과 멱등성](/posts/http-method-safety-idempotency/)

<br>
읽어주셔서 감사합니다. 😊
