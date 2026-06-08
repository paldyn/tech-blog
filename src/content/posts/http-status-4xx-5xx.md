---
title: "4xx 클라이언트 오류와 5xx 서버 오류 — 오류 코드 완전 분석"
description: "400·401·403·404·405·409·422·429 클라이언트 오류와 500·502·503·504 서버 오류 코드의 의미, 차이, 올바른 사용법, 보안 고려사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["HTTP4xx", "HTTP5xx", "400", "401", "403", "404", "500", "503", "오류코드", "API오류"]
featured: false
draft: false
---

[지난 글](/posts/http-status-2xx-3xx/)에서 성공과 리다이렉션 코드를 살펴봤다. 이번 글에서는 **오류 상태 코드** 4xx와 5xx를 완전히 분석한다.

## 4xx — 클라이언트 오류

클라이언트의 요청이 잘못됐을 때 반환한다. **클라이언트(또는 클라이언트 코드)가 수정해야** 한다.

![4xx 클라이언트 오류](/assets/posts/http-status-4xx-5xx-4xx.svg)

### 400 Bad Request

요청 자체를 파싱·처리할 수 없다. 가장 범용적인 클라이언트 오류다.

```http
# 요청 본문에 JSON 문법 오류
POST /api/users HTTP/1.1
Content-Type: application/json

{"name": "Alice", "age":   # ← JSON 미완성

# 응답
HTTP/1.1 400 Bad Request
{"error": "Invalid JSON body"}
```

실무에서는 필수 파라미터 누락, 잘못된 데이터 타입, 범위 초과 등에 사용한다. 명확한 오류 메시지를 본문에 담아야 클라이언트가 디버깅할 수 있다.

### 401 Unauthorized

이름과 달리 "미인증(Unauthenticated)"을 의미한다. 요청에 인증 자격증명이 없거나 유효하지 않다. 응답에 `WWW-Authenticate` 헤더로 인증 방식을 안내해야 한다.

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="api.example.com"

{"error": "Authentication required"}
```

### 403 Forbidden

인증은 됐지만 **해당 리소스에 대한 권한이 없다**. `WWW-Authenticate` 헤더를 포함할 필요가 없다.

```
401 = "누구세요? 로그인하세요"
403 = "당신이 누구인지 알지만, 이건 접근 불가"
```

리소스 존재 자체를 숨기고 싶을 때는 403 대신 404를 반환하기도 한다. 관리자 전용 경로(`/admin/...`)에 일반 사용자가 접근하면, 경로 존재 여부를 숨기기 위해 404를 반환한다.

### 404 Not Found

요청한 리소스를 찾을 수 없다. 가장 유명한 HTTP 상태 코드.

```http
GET /api/users/99999 HTTP/1.1

HTTP/1.1 404 Not Found
{"error": "User not found", "resource": "/api/users/99999"}
```

**404를 오용하는 경우**: 서버 내부 오류를 전부 404로 반환하거나, 권한 없는 리소스를 보안상 404로 숨기는 것. 후자는 의도적이나 디버깅이 어려워진다.

### 405 Method Not Allowed

해당 URI에서 요청한 메서드를 허용하지 않는다. 응답에 `Allow` 헤더로 허용된 메서드 목록을 제공해야 한다.

```http
DELETE /api/config HTTP/1.1

HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, OPTIONS
```

### 409 Conflict

요청이 현재 리소스 상태와 충돌한다. 중복 생성, 낙관적 잠금(Optimistic Lock) 충돌에 사용한다.

```http
# 이미 존재하는 이메일로 회원가입 시도
HTTP/1.1 409 Conflict
{"error": "Email already registered"}
```

### 422 Unprocessable Entity

요청 문법은 맞지만(400이 아님) **의미적으로 처리 불가**한 경우. 주로 유효성 검증 실패에 사용된다.

```http
HTTP/1.1 422 Unprocessable Entity
{
  "errors": [
    {"field": "age", "message": "Must be between 0 and 150"},
    {"field": "email", "message": "Invalid email format"}
  ]
}
```

### 429 Too Many Requests

Rate Limit 초과. `Retry-After` 헤더로 대기 시간을 알린다.

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1717920000
```

## 5xx — 서버 오류

요청은 올바른데 **서버가 처리에 실패**했다. 서버·인프라 팀이 수정해야 한다.

![5xx 서버 오류](/assets/posts/http-status-4xx-5xx-5xx.svg)

### 500 Internal Server Error

서버 내부 예외가 발생했다. NullPointerException, DB 연결 오류, 예상치 못한 에러 등.

```python
# Flask 예시 — 500 처리
@app.errorhandler(500)
def internal_error(error):
    # 스택 트레이스 절대 클라이언트에 노출 금지!
    app.logger.exception("Internal error: %s", error)
    return jsonify({"error": "Internal server error"}), 500
```

**보안 주의**: 스택 트레이스, 파일 경로, DB 쿼리를 응답 본문에 노출하면 공격자에게 서버 구조를 알려준다.

### 502 Bad Gateway

프록시·게이트웨이 서버가 업스트림 서버로부터 **유효하지 않은 응답**을 받았다.

```
브라우저 → Nginx(프록시) → Node.js 앱
                    ↑
         Node.js가 다운 → Nginx가 502 반환
```

### 503 Service Unavailable

서버가 일시적으로 요청을 처리할 수 없다. 과부하, 점검, 배포 중 잠깐 발생.

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 30
Content-Type: application/json

{"error": "Service temporarily unavailable. Maintenance in progress."}
```

`Retry-After`로 클라이언트가 언제 재시도할지 알 수 있다. 지수 백오프(Exponential Backoff) 전략과 함께 사용한다.

### 504 Gateway Timeout

프록시·게이트웨이가 업스트림 서버로부터 **제한 시간 내에 응답을 받지 못했다**.

```
502 = 업스트림이 응답했으나 잘못된 응답
504 = 업스트림이 응답 자체를 안 함 (타임아웃)
```

## 오류 응답 바디 설계

표준 오류 포맷(RFC 7807 Problem Details)을 사용하면 API 소비자가 일관되게 처리할 수 있다.

```json
{
  "type": "https://example.com/problems/validation-error",
  "title": "Validation Failed",
  "status": 422,
  "detail": "One or more fields have invalid values.",
  "instance": "/api/users",
  "errors": [
    {"field": "email", "message": "Invalid format"}
  ]
}
```

---

**지난 글:** [2xx 성공과 3xx 리다이렉션](/posts/http-status-2xx-3xx/)

**다음 글:** [HTTP 헤더 완전 정복 — 분류와 개요](/posts/http-headers-overview/)

<br>
읽어주셔서 감사합니다. 😊
