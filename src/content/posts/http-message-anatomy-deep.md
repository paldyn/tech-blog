---
title: "HTTP 메시지 해부 심화 — 바이트 레벨 분석"
description: "HTTP 메시지 구조를 바이트 레벨로 분석합니다. 시작 줄 토큰 규칙, 헤더 필드 파싱 알고리즘, CRLF 경계, HTTP/2 가상 헤더와의 대응 관계를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["HTTP메시지", "CRLF", "헤더파싱", "시작줄", "상태줄", "요청줄", "HTTP바이트", "RFC7230"]
featured: false
draft: false
---

[지난 글](/posts/http-request-response-anatomy/)에서 HTTP 요청과 응답 메시지의 기본 구조를 살펴봤다. 이번 글에서는 각 구성 요소를 **바이트·토큰 레벨**로 더 깊이 분석한다.

## 메시지 전체 구조 다이어그램

![HTTP 메시지 바이트 레벨 구조](/assets/posts/http-message-anatomy-deep-structure.svg)

## 시작 줄 상세 분석

시작 줄은 요청과 응답에서 형식이 다르다.

![시작 줄 비교](/assets/posts/http-message-anatomy-deep-start-line.svg)

### 요청 줄 토큰 규칙

RFC 7230은 메서드를 **토큰(token)**으로 정의한다. 토큰은 `!#$%&'*+-.^_`|~` 및 알파벳/숫자만 허용한다. 실제로 등록된 메서드는 모두 대문자 ASCII다.

```
method = token
request-target = origin-form / absolute-form / authority-form / asterisk-form
origin-form = absolute-path ["?" query]
```

```http
GET /search?q=http HTTP/1.1
POST /api/users HTTP/1.1
OPTIONS * HTTP/1.1
CONNECT www.example.com:443 HTTP/1.1
```

### 상태 줄 토큰 규칙

```
status-code = 3DIGIT
reason-phrase = *( HTAB / SP / VCHAR )
```

이유 구문(reason-phrase)은 사람이 읽는 용도로만 존재하며, 자동화 처리는 반드시 상태 코드 숫자로 해야 한다. HTTP/2는 이유 구문을 아예 제거했다.

## 헤더 필드 파싱

### 기본 문법

```
header-field = field-name ":" OWS field-value OWS
field-name   = token      # 대소문자 무관
field-value  = *( field-content / obs-fold )
OWS          = *( SP / HTAB )  # Optional WhiteSpace
```

콜론(`:`) 앞에는 공백이 없어야 하고, 뒤에는 선택적 공백이 허용된다.

```http
Content-Type: application/json     ← 올바름
Content-Type : application/json    ← 오류 (콜론 앞 공백)
Content-Type:application/json      ← 허용 (OWS 0개)
```

### 줄 접기 (obs-fold) — 역사적 유물

RFC 7230 이전에는 긴 헤더를 다음 줄에 SP/HTAB으로 시작하여 이어 쓸 수 있었다 (줄 접기, line folding). 현재는 **사용 금지(obsolete)**되었지만, 레거시 서버 파싱 시 유의해야 한다.

```http
# 구식 줄 접기 (현재 금지)
Subject: This is a very long
  header value
```

### 중복 헤더 처리

같은 이름의 헤더가 여러 번 나올 경우:

```http
Set-Cookie: a=1
Set-Cookie: b=2
```

콤마로 병합 가능한 헤더(`Accept`, `Allow` 등)는 합쳐도 동일하지만, **Set-Cookie는 병합 불가**다. 서버 구현 버그 중 상당수가 이 처리를 잘못한 데서 발생한다.

## 메시지 본문 길이 결정

본문이 있을 때 파서는 다음 순서로 길이를 결정한다.

```
1. Transfer-Encoding: chunked 이면 → 청크드 인코딩으로 읽기
2. Content-Length 헤더 값(바이트 수)으로 읽기
3. 연결 종료까지 읽기 (HTTP/1.0 방식)
```

```http
HTTP/1.1 200 OK
Transfer-Encoding: chunked

7\r\n
Mozilla\r\n
9\r\n
Developer\r\n
7\r\n
Network\r\n
0\r\n
\r\n
```

청크드 인코딩에서 `0\r\n\r\n`은 본문 끝을 의미한다.

## HTTP/2에서의 대응

HTTP/2는 같은 의미를 바이너리 프레임으로 표현한다. 가상 헤더(pseudo-header)는 `:` 접두사를 갖는다.

```
# HTTP/2 HEADERS 프레임 (의사 표현)
:method   = GET
:path     = /search?q=http
:scheme   = https
:authority = www.example.com
accept    = text/html
```

실제 와이어에서는 HPACK 인덱스 테이블로 압축된다. 예를 들어 `:method: GET`은 정적 테이블 인덱스 2번으로 1바이트만 차지한다.

---

**지난 글:** [HTTP 요청·응답 메시지 해부 — 구조와 형식](/posts/http-request-response-anatomy/)

**다음 글:** [HTTP 메서드 완전 정복](/posts/http-methods/)

<br>
읽어주셔서 감사합니다. 😊
