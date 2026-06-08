---
title: "HTTP 메서드 안전성과 멱등성 — 재시도 설계의 기반"
description: "HTTP 안전성(Safe)과 멱등성(Idempotent)의 정의, 각 메서드별 속성 매트릭스, 멱등성이 네트워크 재시도·오류 복구·분산 시스템 설계에 미치는 영향을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["HTTP안전성", "HTTP멱등성", "Idempotency", "Safe메서드", "HTTP재시도", "분산시스템", "RFC7231"]
featured: false
draft: false
---

[지난 글](/posts/http-methods/)에서 9가지 HTTP 메서드를 살펴봤다. 이번 글에서는 메서드를 이해하는 핵심 개념인 **안전성(Safe)**과 **멱등성(Idempotent)**을 깊이 다룬다. 이 두 속성은 네트워크 재시도와 오류 복구 설계의 기반이다.

## 안전성 (Safe)

> 안전한 메서드는 요청이 서버의 의미 있는 상태를 변경하지 않는다.

RFC 7231 §4.2.1의 정의다. **서버 상태를 읽기만 하고 쓰지 않는** 메서드가 안전하다. GET, HEAD, OPTIONS, TRACE가 해당한다.

안전하다는 것은 오류가 없다거나 부작용이 없다는 뜻이 아니다. 서버는 GET 요청의 로그를 기록하고 접속 카운터를 올릴 수 있다. 그래도 **클라이언트 관점에서 요청이 서버 상태를 바꾸지 않는다**고 약속하면 안전하다.

## 멱등성 (Idempotent)

> 동일한 요청을 한 번 보낸 효과와 여러 번 보낸 효과가 동일한 성질.

![멱등성 개념 다이어그램](/assets/posts/http-method-safety-idempotency-concept.svg)

핵심은 **응답 코드**가 아니라 **서버 상태**의 동일함이다. DELETE를 두 번 보내면:
- 첫 번째: 204 No Content (삭제 성공)
- 두 번째: 404 Not Found (이미 없음)

응답 코드는 다르지만, 두 경우 모두 서버 상태는 "리소스 없음"으로 동일하다. 따라서 DELETE는 **멱등**하다.

## 메서드별 속성 행렬

![안전성·멱등성·캐시 가능성 매트릭스](/assets/posts/http-method-safety-idempotency-table.svg)

```
메서드    안전   멱등   캐시
GET       ✓     ✓     ✓
HEAD      ✓     ✓     ✓
OPTIONS   ✓     ✓     ✗
POST      ✗     ✗     △
PUT       ✗     ✓     ✗
PATCH     ✗     △     ✗
DELETE    ✗     ✓     ✗
```

## 왜 이 속성이 중요한가

### 네트워크 재시도 (Retry)

네트워크 오류나 타임아웃 시 클라이언트는 재시도를 결정해야 한다.

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# GET은 멱등 → 자동 재시도 안전
retry = Retry(
    total=3,
    allowed_methods=["GET", "HEAD", "OPTIONS", "PUT", "DELETE"],
    status_forcelist=[500, 502, 503]
)
adapter = HTTPAdapter(max_retries=retry)
session = requests.Session()
session.mount("https://", adapter)
```

**POST는 멱등하지 않으므로** 자동 재시도에서 기본적으로 제외한다. 주문·결제 API에서 POST를 재시도하면 중복 결제가 발생할 수 있다.

### 멱등 키 패턴

멱등하지 않은 POST 요청을 안전하게 재시도하려면 **멱등 키(Idempotency-Key)**를 사용한다.

```http
POST /api/payments HTTP/1.1
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{"amount": 10000, "currency": "KRW"}
```

서버는 이 키를 캐시하여, 동일 키로 재시도가 오면 이전 응답을 그대로 반환한다. Stripe, PayPal 등이 이 패턴을 사용한다.

### 캐시 가능성

브라우저와 CDN은 안전하고 멱등한 메서드의 응답을 캐시한다. GET과 HEAD가 주로 캐시되며, POST는 조건부로 캐시 가능하다(`Cache-Control: no-store`가 없고 응답에 캐시 관련 헤더가 있는 경우).

### 분산 시스템과 로드밸런서

멱등한 요청은 로드밸런서가 **다른 서버로 재라우팅**할 수 있다. 세션 없는 아키텍처에서 특히 중요하다. GET 요청은 어느 서버에서 처리해도 결과가 같으므로 부하를 자유롭게 분산할 수 있다.

## PATCH의 조건부 멱등성

PATCH는 구현에 따라 멱등할 수도, 아닐 수도 있다.

```http
# 멱등한 PATCH: 절대 값 설정
PATCH /api/counter
{"value": 10}   # 몇 번 보내도 counter = 10

# 멱등하지 않은 PATCH: 상대 변경
PATCH /api/counter
{"increment": 1}   # 보낼 때마다 counter += 1
```

`application/merge-patch+json`(RFC 7396)은 필드를 절대 값으로 덮어쓰므로 멱등하다. `application/json-patch+json`(RFC 6902)의 `add` 연산은 비멱등일 수 있다.

---

**지난 글:** [HTTP 메서드 완전 정복](/posts/http-methods/)

**다음 글:** [GET vs POST — 언제 어떤 메서드를 쓸까](/posts/http-method-get-post/)

<br>
읽어주셔서 감사합니다. 😊
