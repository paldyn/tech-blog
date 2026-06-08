---
title: "HTTP 요청·응답 메시지 해부 — 구조와 형식"
description: "HTTP 요청 메시지(요청 줄·헤더·빈 줄·본문)와 응답 메시지(상태 줄·헤더·본문)의 구조를 바이트 레벨로 해부하고, 실제 와이어 포맷과 RFC 7230 규정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["HTTP요청", "HTTP응답", "요청메시지", "상태줄", "요청줄", "HTTP헤더", "메시지구조", "RFC7230"]
featured: false
draft: false
---

[지난 글](/posts/http-url-uri-structure/)에서 URL과 URI의 구조를 살펴봤다. 이번 글에서는 실제로 HTTP가 네트워크 위를 어떤 형태로 흘러가는지, **요청과 응답 메시지의 구조**를 바이트 레벨로 해부한다.

## HTTP 메시지란

HTTP 메시지는 클라이언트와 서버가 주고받는 **텍스트 기반의 구조화된 데이터**다. HTTP/1.1까지는 순수 ASCII 텍스트로 전송되며, HTTP/2·3부터는 같은 구조를 바이너리 프레임으로 인코딩한다.

메시지는 크게 **요청(Request)**과 **응답(Response)** 두 종류다. 두 종류 모두 동일한 기본 구조를 갖는다.

```
시작 줄 (Start Line)
헤더 필드 (Header Fields) — 0개 이상
빈 줄 (Empty Line, CRLF)
메시지 본문 (Message Body) — 선택적
```

## 요청 메시지 구조

![HTTP 요청 메시지 구조](/assets/posts/http-request-response-anatomy-request.svg)

### 요청 줄 (Request Line)

요청 메시지의 첫 번째 줄이다. 세 가지 토큰이 공백(SP, 0x20)으로 구분되고 CRLF(`\r\n`)로 끝난다.

```
메서드 SP 요청-목표 SP HTTP-버전 CRLF
POST /api/users HTTP/1.1\r\n
```

- **메서드**: 대문자만 허용 (`GET`, `POST`, `PUT`, `DELETE` 등)
- **요청 목표**: 절대 경로 + 쿼리스트링 (`/search?q=http`)
- **버전**: `HTTP/1.0`, `HTTP/1.1`, `HTTP/2`, `HTTP/3`

### 요청 헤더

헤더는 `이름: 값\r\n` 형식이 반복된다. 이름은 대소문자를 구별하지 않는다.

```http
Host: example.com
Content-Type: application/json
Content-Length: 27
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

**Host** 헤더는 HTTP/1.1에서 **필수**다. 하나의 IP에 여러 가상 호스트를 운영할 때 어느 서버로 라우팅할지 결정한다.

### 빈 줄과 본문

헤더 섹션과 본문 사이에 **빈 줄(CRLF 하나)** 이 반드시 있어야 한다. RFC 7230은 이를 구조적으로 필수라고 정의한다. 본문은 선택적이며 `GET`·`HEAD` 요청에는 보통 없다.

## 응답 메시지 구조

![HTTP 응답 메시지 구조](/assets/posts/http-request-response-anatomy-response.svg)

### 상태 줄 (Status Line)

```
HTTP-버전 SP 상태코드 SP 이유구문 CRLF
HTTP/1.1 201 Created\r\n
```

- **상태 코드**: 3자리 숫자 (100~599)
- **이유 구문**: 사람이 읽는 짧은 설명. HTTP/2부터는 생략된다.

### 실전 요청·응답 쌍

```http
POST /api/users HTTP/1.1
Host: api.example.com
Content-Type: application/json
Content-Length: 27

{"name":"Alice","age":30}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json
Content-Length: 45
Location: /api/users/123

{"id":123,"name":"Alice","age":30}
```

## CRLF의 중요성

HTTP 메시지의 모든 줄은 `\r\n`(Carriage Return + Line Feed, 0x0D 0x0A)으로 끝난다. 헤더 파서는 이 두 바이트 시퀀스로 줄 끝을 판별하므로, `\n`만 사용하면 일부 서버에서 400 오류가 발생한다.

```
47 45 54 20 2F 20 48 54 54 50 2F 31 2E 31 0D 0A
G  E  T     /     H  T  T  P  /  1  .  1  \r \n
```

헤더 섹션 끝의 빈 줄은 `\r\n\r\n` 네 바이트로 표현된다. 이 패턴을 찾아 헤더/본문 경계를 파싱한다.

## HTTP/2·3에서의 변화

HTTP/2부터 메시지는 **바이너리 프레임**으로 인코딩된다. 논리적 구조는 동일하지만:

- 시작 줄이 `:method`, `:path`, `:status` 등 **가상 헤더(pseudo-header)**로 대체된다.
- 헤더는 **HPACK** 알고리즘으로 압축된다.
- HTTP/3는 QUIC 위에서 동일한 시맨틱을 갖는 **QPACK** 압축을 사용한다.

```
HTTP/2 요청 프레임 (의사 코드)
:method = POST
:path   = /api/users
:scheme = https
:authority = api.example.com
content-type = application/json
content-length = 27
```

와이어 포맷은 달라졌지만 헤더 이름·값의 의미는 그대로이므로, HTTP/1.1 메시지 구조를 이해하면 HTTP/2·3도 쉽게 따라갈 수 있다.

---

**지난 글:** [URL과 URI 완전 정복 — 구조와 컴포넌트](/posts/http-url-uri-structure/)

**다음 글:** [HTTP 메시지 해부 심화 — 바이트 레벨 분석](/posts/http-message-anatomy-deep/)

<br>
읽어주셔서 감사합니다. 😊
