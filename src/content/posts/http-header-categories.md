---
title: "HTTP 헤더 카테고리 완전 해설 — 공통·요청·응답·표현 헤더"
description: "HTTP 헤더의 4가지 분류(공통·요청·응답·표현), 각 카테고리의 역할과 대표 필드, HTTP/2 HPACK까지 실무 중심으로 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["HTTP헤더", "헤더카테고리", "공통헤더", "요청헤더", "응답헤더", "표현헤더", "HPACK"]
featured: false
draft: false
---

[지난 글](/posts/http-headers-overview/)에서 HTTP 헤더의 전체 개요와 기본 문법을 살펴봤다. 이번 글에서는 RFC 7230-7235에서 정의한 **4가지 헤더 분류**를 하나씩 파고들어, 어떤 헤더가 어느 분류에 속하고 왜 그렇게 분류되는지를 명확히 이해한다.

## 헤더 필드 기본 형식

HTTP 메시지의 헤더 섹션은 **field-name ":" OWS field-value OWS** 구조로 이루어진다. 여기서 OWS는 Optional Whitespace(선택적 공백)다. 몇 가지 핵심 규칙이 있다.

```http
GET /api/users HTTP/1.1
Host: api.example.com
Content-Type: application/json
Cache-Control: no-cache, max-age=0
X-Request-Id: 550e8400-e29b-41d4-a716
```

헤더 이름은 **대소문자를 구분하지 않는다.** `Content-Type`과 `content-type`은 동일하다. 단, HTTP/2에서는 HPACK 압축 테이블이 소문자 이름을 사용하므로 소문자가 사실상 표준이다. 또한 콜론 앞에 공백이 있으면 RFC 위반이다—수신 측에서 거부해도 된다.

단일 헤더에 여러 값을 넣을 때는 쉼표로 구분하거나 동일한 헤더를 여러 줄에 반복한다. 아래 두 형식은 동등하다.

```http
Accept: text/html, application/json
# 또는
Accept: text/html
Accept: application/json
```

다만 `Set-Cookie`는 예외다. 여러 쿠키를 설정할 때 쉼표 구분이 아닌 **별도의 Set-Cookie 헤더를 반복**해야 한다—쿠키 값 자체가 쉼표를 포함할 수 있기 때문이다.

## 4대 분류 개요

![HTTP 헤더 4대 분류](/assets/posts/http-header-categories-four.svg)

## 공통 헤더 (General Headers)

공통 헤더는 **요청과 응답 양쪽에 모두 쓰이는** 메시지 제어용 헤더다. 특정 메시지 방향에 종속되지 않고 전송 특성이나 메시지 수명을 제어한다.

| 헤더 | 역할 |
|------|------|
| `Cache-Control` | 캐시 지시어 (max-age, no-cache 등) |
| `Connection` | 연결 유지 여부 (keep-alive, close) |
| `Date` | 메시지 생성 시각 (GMT) |
| `Transfer-Encoding` | 전송 인코딩 방식 (chunked) |
| `Upgrade` | 프로토콜 업그레이드 (WebSocket) |
| `Via` | 프록시 경유 정보 |

```http
HTTP/1.1 200 OK
Date: Mon, 09 Jun 2026 12:00:00 GMT
Connection: keep-alive
Cache-Control: public, max-age=3600
Transfer-Encoding: chunked
```

`Date` 헤더는 HTTP/1.1에서 원본 서버가 **반드시** 포함해야 한다. 캐시가 신선도를 계산할 때 이 필드를 기준으로 삼는다.

## 요청 헤더 (Request Headers)

요청 헤더는 클라이언트가 서버에 **컨텍스트와 선호도를 전달**하는 필드들이다. 인증, 조건부 요청, 클라이언트 환경 정보 등을 담는다.

```http
GET /page HTTP/1.1
Host: www.example.com
User-Agent: Mozilla/5.0 (Macintosh) AppleWebKit/537.36
Accept: text/html,application/xhtml+xml;q=0.9
Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8
Accept-Encoding: gzip, deflate, br
Cookie: sessionId=abc123; theme=dark
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Referer: https://www.google.com/
If-None-Match: "etag-value-abc"
```

**Host** 헤더는 HTTP/1.1에서 유일하게 **필수** 요청 헤더다. 하나의 IP 주소에 여러 도메인이 호스팅될 때(가상 호스팅) 서버가 어느 사이트를 처리할지 결정한다.

**Referer** 헤더는 오타(Referrer의 오타)지만 그대로 표준이 됐다. CORS 보안 판단, 분석, 링크 추적에 사용된다. `Referrer-Policy` 헤더로 전송 범위를 제한할 수 있다.

## 응답 헤더 (Response Headers)

응답 헤더는 서버가 클라이언트에게 **서버 상태, 리소스 정보, 지시사항**을 전달한다.

```http
HTTP/1.1 200 OK
Server: nginx/1.24.0
Content-Location: /api/users/123
Location: https://new.example.com/api
WWW-Authenticate: Bearer realm="api"
Set-Cookie: sid=xyz; HttpOnly; Secure; SameSite=Lax
ETag: "a1b2c3d4"
Last-Modified: Mon, 08 Jun 2026 10:00:00 GMT
Age: 120
Vary: Accept-Encoding, Accept-Language
```

**ETag**는 리소스의 현재 버전을 식별하는 불투명 문자열이다. 조건부 요청(`If-None-Match`)과 결합해 불필요한 전체 전송을 방지한다. 강한 ETag(`"abc"`)는 바이트 단위로 동일할 때, 약한 ETag(`W/"abc"`)는 의미적으로 동일할 때 사용한다.

**Age** 헤더는 캐시 서버가 응답을 보유한 시간을 초 단위로 나타낸다. `Age: 120`이면 2분 전에 원본 서버에서 가져온 캐시를 반환하고 있다는 뜻이다.

**Vary** 헤더는 어떤 요청 헤더가 응답에 영향을 미치는지 캐시에 알린다. `Vary: Accept-Encoding`이 있으면 캐시는 인코딩별로 별도 응답을 저장해야 한다.

## 표현 헤더 (Representation Headers)

표현 헤더는 **메시지 본문의 형식, 인코딩, 언어**를 설명한다. 요청과 응답 양쪽에 모두 쓰일 수 있지만, 주로 응답에서 등장한다.

```http
Content-Type: application/json; charset=utf-8
Content-Length: 1234
Content-Encoding: gzip
Content-Language: ko
Content-Location: /api/data
Content-Range: bytes 0-999/5000
```

`Content-Length`와 `Transfer-Encoding: chunked`는 **동시에 사용할 수 없다.** 크기를 미리 알면 Content-Length, 동적으로 생성되는 스트리밍 응답이면 chunked 인코딩을 사용한다.

`Content-Encoding`은 전송을 위한 압축 레이어다. 클라이언트가 `Accept-Encoding: gzip`을 요청하면 서버는 gzip 압축 후 `Content-Encoding: gzip`으로 응답한다. 미디어 타입 자체의 압축(JPEG, PNG)과는 다른 개념이다.

## HTTP/2에서의 변화

HTTP/2는 헤더 분류 체계는 유지하면서 **전송 방식을 혁신**했다.

```
HTTP/1.1 헤더 (텍스트):
Content-Type: text/html; charset=utf-8  → 40바이트

HTTP/2 HPACK (바이너리 + 허프만):
:status: 200                           → 1바이트 (정적 테이블 8번)
content-type: text/html; charset=utf-8 → ~16바이트
```

HPACK은 두 가지 기술로 헤더를 압축한다.

1. **정적 테이블**: `:method: GET`, `:status: 200` 같이 자주 쓰이는 헤더 61개를 인덱스로 표현
2. **동적 테이블**: 요청/응답마다 반복되는 헤더를 세션 단위로 캐싱

또한 HTTP/2는 **헤더 이름을 소문자로 규정**한다. HTTP/1.1 파싱 코드와의 호환성을 위해 서버는 대소문자를 무시해야 하지만, 명시적으로 소문자를 사용하는 게 바람직하다.

HTTP/3(QUIC)은 QPACK이라는 유사한 메커니즘을 사용한다. 동적 테이블 업데이트가 스트림 간 HOL 블로킹을 일으키는 문제를 해결했다.

## 헤더 형식과 문법 실전

![HTTP 헤더 필드 문법](/assets/posts/http-header-categories-format.svg)

실무에서 자주 만나는 파싱 주의사항을 정리한다.

```python
# Python으로 헤더 파싱 예시
from email.message import Message

# Content-Type: text/html; charset=utf-8
# 헤더 파라미터 파싱
msg = Message()
msg['Content-Type'] = 'text/html; charset=utf-8'
content_type = msg.get_content_type()      # text/html
charset = msg.get_param('charset')         # utf-8

# 쉼표 구분 헤더 분리
accept = 'text/html, application/json;q=0.9, */*;q=0.5'
types = [t.strip() for t in accept.split(',')]
```

```javascript
// JavaScript (Fetch API)
const response = await fetch('/api/data');
console.log(response.headers.get('content-type'));
// → 'application/json; charset=utf-8'

// Headers 반복
for (const [name, value] of response.headers) {
  console.log(`${name}: ${value}`);
}
```

헤더 보안 관점에서 주의할 점:

- **Host 헤더 인젝션**: 공격자가 `Host` 헤더를 조작해 캐시 포이즈닝이나 비밀번호 리셋 링크 조작을 시도할 수 있다. 서버에서 허용 도메인을 화이트리스트로 검증해야 한다.
- **헤더 스머글링**: 두 개 이상의 `Content-Length` 헤더나 `Transfer-Encoding` 조합으로 프록시와 원본 서버 간 요청 해석 불일치를 유발한다.
- **민감 정보 노출**: `Server` 헤더로 서버 버전 정보가 노출되면 공격자에게 힌트를 줄 수 있다. 운영 환경에서는 최소한의 정보만 노출하라.

---

**지난 글:** [HTTP 헤더 완전 정복 — 분류와 핵심 개요](/posts/http-headers-overview/)

**다음 글:** [Content-Type과 MIME 타입 완전 정복](/posts/http-content-type-mime/)

<br>
읽어주셔서 감사합니다. 😊
