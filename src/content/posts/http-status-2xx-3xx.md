---
title: "2xx 성공과 3xx 리다이렉션 — 상태 코드 완전 분석"
description: "200·201·202·204·206 성공 코드와 301·302·303·304·307·308 리다이렉션 코드의 의미, 브라우저 동작, POST/Redirect/GET 패턴, 메서드 보존 여부를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["HTTP2xx", "HTTP3xx", "200OK", "201Created", "301", "302", "304NotModified", "리다이렉션", "PRG패턴"]
featured: false
draft: false
---

[지난 글](/posts/http-status-codes-overview/)에서 상태 코드 5개 범주를 개괄했다. 이번 글에서는 **2xx 성공**과 **3xx 리다이렉션** 코드를 상세히 분석한다.

## 2xx 성공 상태 코드

![2xx 성공 상태 코드](/assets/posts/http-status-2xx-3xx-2xx.svg)

### 200 OK

가장 일반적인 성공 코드. 요청이 성공했고 응답 본문에 결과가 있다.

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 95

{"id":42,"name":"Alice","email":"alice@example.com","created_at":"2026-01-01"}
```

### 201 Created

새 리소스가 **성공적으로 생성**됐다. POST·PUT 요청 후 반환한다. `Location` 헤더에 생성된 리소스의 URI를 담는다.

```http
HTTP/1.1 201 Created
Location: /api/users/123
Content-Type: application/json

{"id":123,"name":"Bob","created_at":"2026-06-09"}
```

200과의 차이: **201은 새 리소스를 생성했음을 명시**한다. REST API 설계 시 POST 응답에는 201이 더 정확하다.

### 202 Accepted

요청을 수락했지만 **아직 처리 완료되지 않음**. 비동기 작업(배치 처리, 이메일 발송, 보고서 생성 등)에 사용한다.

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{"job_id":"job-abc-123","status":"queued","check_url":"/api/jobs/job-abc-123"}
```

클라이언트는 `check_url`을 폴링하거나 웹훅으로 완료 알림을 받는다.

### 204 No Content

요청 성공, 본문 없음. DELETE 요청 성공이나 자동 저장(에디터) 응답에 적합하다.

```http
HTTP/1.1 204 No Content
X-RateLimit-Remaining: 99
```

**주의**: 204 응답에 본문을 넣으면 RFC 위반이다. `Content-Length: 0`이거나 아예 없어야 한다.

### 206 Partial Content

`Range` 헤더로 일부를 요청했을 때의 부분 응답. 동영상 스트리밍, 파일 이어받기에 사용된다.

```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/10240
Content-Length: 1024

[첫 1024 바이트 데이터]
```

## 3xx 리다이렉션 상태 코드

![3xx 리다이렉션 상태 코드](/assets/posts/http-status-2xx-3xx-3xx.svg)

### 301 Moved Permanently

리소스가 **영구적으로 이동**했다. 브라우저는 다음 요청부터 자동으로 새 URL로 접속한다. 검색 엔진은 원래 URL의 SEO 가중치를 새 URL로 이전한다.

```http
HTTP/1.1 301 Moved Permanently
Location: https://www.example.com/new-path
```

### 302 Found (임시 이동)

임시 이동. 원래 URL은 유지된다. 과거 스펙 불일치로 **POST 요청에 302 응답이 오면 브라우저가 GET으로 변환**하는 문제가 있다.

### 303 See Other

POST 처리 후 결과 페이지를 GET으로 보여주는 **PRG(Post/Redirect/Get) 패턴**에 사용된다.

```
1. POST /checkout         → 주문 처리
2. 서버 응답: 303 See Other + Location: /order/123
3. 브라우저: GET /order/123  → 주문 완료 페이지
```

이 패턴이 없으면 사용자가 새로고침할 때 POST가 재전송되어 중복 주문이 발생한다.

### 304 Not Modified

`If-Modified-Since` 또는 `If-None-Match` 헤더로 캐시 유효성을 검증했을 때, **캐시가 아직 유효하면** 304로 응답한다. 본문 없이 클라이언트가 캐시를 사용하도록 지시한다.

```http
# 요청
GET /api/products/1 HTTP/1.1
If-None-Match: "abc123"

# 캐시 유효 시
HTTP/1.1 304 Not Modified
ETag: "abc123"
Cache-Control: max-age=3600
```

### 307 Temporary Redirect vs 308 Permanent Redirect

302·301의 메서드 보존 버전이다. POST로 보낸 요청이 리다이렉트될 때 **메서드를 그대로 유지**한다.

| 코드 | 영구/임시 | 메서드 보존 |
|------|---------|-----------|
| 301 | 영구 | △ (GET으로 바꾸기도) |
| 302 | 임시 | △ (GET으로 바꾸기도) |
| 307 | 임시 | ✓ 보존 |
| 308 | 영구 | ✓ 보존 |

REST API에서 URL을 변경할 때는 301 대신 **308**이 더 안전하다.

## 리다이렉션 루프 방지

```javascript
// 최대 리다이렉트 횟수 제한
let redirects = 0;
async function fetchWithRedirect(url) {
  while (redirects < 10) {
    const resp = await fetch(url, { redirect: 'manual' });
    if ([301, 302, 307, 308].includes(resp.status)) {
      url = resp.headers.get('Location');
      redirects++;
    } else {
      return resp;
    }
  }
  throw new Error('Too many redirects');
}
```

브라우저는 보통 20회 리다이렉트 후 오류 표시한다. `fetch()`의 `redirect: 'follow'`(기본값) 모드에서는 브라우저가 자동 처리한다.

---

**지난 글:** [HTTP 상태 코드 완전 정복 — 5개 범주 개요](/posts/http-status-codes-overview/)

**다음 글:** [4xx 클라이언트 오류와 5xx 서버 오류](/posts/http-status-4xx-5xx/)

<br>
읽어주셔서 감사합니다. 😊
