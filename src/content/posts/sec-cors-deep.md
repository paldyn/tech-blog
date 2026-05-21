---
title: "CORS 심층 분석 — 프리플라이트와 자격증명 요청"
description: "CORS의 동일 출처 정책 배경, Simple Request와 Preflight 요청의 차이, Access-Control 헤더 구성, 자격증명 포함 요청(credentials), 서버 구현 방법을 상세히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "CORS", "프리플라이트", "Access-Control", "SOP", "자격증명"]
featured: false
draft: false
---

[지난 글](/posts/sec-csp/)에서 CSP의 디렉티브와 nonce 전략을 살펴봤습니다. 이번에는 프론트엔드 개발자라면 반드시 만나게 되는 **CORS(Cross-Origin Resource Sharing)** 오류의 원리와 올바른 해결 방법을 깊게 파고듭니다.

## 동일 출처 정책(SOP)이란

브라우저는 기본적으로 **동일 출처 정책(Same-Origin Policy, SOP)**을 강제합니다. `https://app.example.com`에서 실행 중인 JavaScript가 `https://api.example.com`의 리소스를 읽으려 하면, 출처(scheme + hostname + port)가 다르므로 브라우저가 차단합니다.

SOP는 CSRF와 데이터 탈취 공격을 막기 위한 보안 메커니즘입니다. CORS는 이 정책을 **서버가 명시적으로 허용한 범위 내에서 완화**하는 표준입니다.

## Simple Request vs Preflight

모든 크로스 오리진 요청이 프리플라이트를 발생시키는 건 아닙니다. 브라우저는 요청의 속성을 판단해 두 경로로 나눕니다.

### Simple Request 조건 (프리플라이트 없음)

- 메서드: `GET`, `HEAD`, `POST` 중 하나
- 헤더: `Accept`, `Accept-Language`, `Content-Language`, `Content-Type`만 있을 때
- `Content-Type`: `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` 중 하나

이 조건에 해당하면 브라우저가 실제 요청에 `Origin` 헤더를 붙여 바로 보냅니다.

### Preflight Request

`Authorization` 헤더, `Content-Type: application/json`, `DELETE`·`PATCH` 메서드 등을 쓰면 브라우저가 실제 요청 전에 `OPTIONS` 메서드로 **프리플라이트** 요청을 먼저 보냅니다.

![CORS 프리플라이트 흐름](/assets/posts/sec-cors-deep-flow.svg)

서버가 프리플라이트에 적절한 응답을 하면 브라우저가 실제 요청을 이어서 보냅니다. 서버가 허용하지 않으면 실제 요청은 전송되지 않습니다.

## Access-Control 응답 헤더

![CORS 응답 헤더 — Express 구현](/assets/posts/sec-cors-deep-headers.svg)

서버가 설정해야 하는 주요 헤더들입니다.

```http
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
```

`Access-Control-Max-Age`는 프리플라이트 응답을 브라우저가 캐시하는 시간(초)입니다. 86400초(24시간)로 설정하면 같은 요청에 대해 하루 동안 프리플라이트를 생략합니다.

## 자격증명 포함 요청

쿠키나 HTTP 인증을 크로스 오리진 요청에 포함하려면 fetch의 `credentials: 'include'` 옵션이 필요하고, 서버는 두 가지 조건을 반드시 충족해야 합니다.

```js
// 클라이언트
const res = await fetch('https://api.example.com/user', {
  credentials: 'include',      // 쿠키 포함 전송
  headers: {
    'Content-Type': 'application/json',
  },
});
```

```http
/* 서버 응답 — 두 헤더 모두 필수 */
Access-Control-Allow-Origin: https://app.example.com   /* 와일드카드(*) 불가 */
Access-Control-Allow-Credentials: true
```

자격증명 요청에서 `Access-Control-Allow-Origin: *`을 쓰면 브라우저가 오류를 발생시킵니다. 반드시 구체적인 origin을 명시해야 합니다.

## 동적 Origin 허용 — 화이트리스트 패턴

여러 출처를 허용해야 할 때 `Access-Control-Allow-Origin`은 하나의 값만 담을 수 있습니다. 서버가 요청의 `Origin` 헤더를 화이트리스트와 비교해 동적으로 설정하는 패턴이 표준적입니다.

```js
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
  'http://localhost:5173',  // 개발 환경
]);

app.use((req, res, next) => {
  const origin = req.headers['origin'];
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');  // 캐시가 origin별로 분리되도록
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }
  next();
});
```

`Vary: Origin` 헤더를 함께 설정해야 CDN·프록시가 origin별로 캐시를 분리해 잘못된 origin 헤더가 담긴 응답이 다른 사용자에게 내려가는 문제를 방지합니다.

## 노출 헤더 설정

브라우저는 기본적으로 몇 가지 안전한 응답 헤더(`Content-Type`, `Cache-Control` 등)만 JavaScript에 노출합니다. 커스텀 헤더나 `X-Request-Id` 같은 값을 클라이언트에서 읽으려면 서버가 명시적으로 노출을 허용해야 합니다.

```http
Access-Control-Expose-Headers: X-Request-Id, X-Rate-Limit-Remaining
```

## CORS 오류 디버깅

| 오류 메시지 | 원인 |
|---|---|
| `No 'Access-Control-Allow-Origin' header` | 서버가 CORS 헤더를 반환하지 않음 |
| `The value ... is not equal to the supplied origin` | 자격증명 요청에 `*` 사용 |
| `has been blocked by CORS policy` (OPTIONS 500) | 프리플라이트 처리 누락 또는 서버 에러 |
| `Credentials flag is 'true' ... Access-Control-Allow-Credentials not 'true'` | `credentials: true` 헤더 누락 |

**CORS 오류는 항상 서버 측 문제입니다.** 브라우저가 서버의 허용 없이 임의로 차단하는 것이 아니라, 서버가 허용 헤더를 보내지 않은 것입니다. 프록시에서 헤더를 추가해 우회하는 것은 개발 환경에서만 사용해야 합니다.

## 정리

CORS는 보안 메커니즘이지 버그가 아닙니다. 올바른 해결책은 서버에 `Access-Control-Allow-Origin`을 명시하고, 자격증명이 필요하면 `Allow-Credentials: true`를 추가하는 것입니다. 화이트리스트 기반 동적 허용과 `Vary: Origin` 헤더를 함께 사용하는 것이 프로덕션 모범 사례입니다. 다음 글에서는 SRI(Subresource Integrity)로 외부 스크립트 무결성을 검증하는 방법을 살펴봅니다.

---

**지난 글:** [Content-Security-Policy — 인라인 스크립트 차단과 nonce 전략](/posts/sec-csp/)

**다음 글:** [SRI — 서브리소스 무결성 검증](/posts/sec-sri/)

<br>
읽어주셔서 감사합니다. 😊
