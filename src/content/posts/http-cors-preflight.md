---
title: "CORS 프리플라이트 완전 정복 — OPTIONS 요청과 인증 정보 규칙"
description: "프리플라이트가 발생하는 정확한 조건, OPTIONS 요청·응답 헤더의 의미, Access-Control-Max-Age 캐시, credentials 포함 요청의 와일드카드 금지 규칙까지 상세 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["CORS", "프리플라이트", "OPTIONS", "AccessControlMaxAge", "credentials", "브라우저보안"]
featured: false
draft: false
---

[지난 글](/posts/http-cors/)에서 CORS의 기본 원리와 단순 요청을 다뤘다. 그런데 개발자 도구 네트워크 탭을 보면 내가 보낸 적 없는 **OPTIONS 요청**이 API 호출마다 먼저 날아가는 걸 발견하게 된다. 이것이 **프리플라이트(preflight)** — 브라우저가 본 요청을 보내도 되는지 서버에 미리 묻는 절차다. 이번 글에서는 프리플라이트가 언제, 왜 발생하고, 서버가 정확히 어떻게 응답해야 하는지를 정리한다.

## 왜 사전 확인이 필요한가

단순 요청(GET, 폼 POST 등)은 CORS 이전에도 HTML 폼이 만들 수 있던 요청이라 서버들이 이미 받을 준비가 돼 있다. 하지만 `PUT`, `DELETE`, `Content-Type: application/json` 같은 요청은 **CORS 등장 전에는 교차 출처에서 올 수 없던 모양**이다.

오래된 서버는 "이런 요청은 우리 도메인의 신뢰된 코드만 보낼 수 있다"고 가정하고 만들어졌을 수 있다. 브라우저가 갑자기 아무 사이트에서나 이런 요청을 보내게 해 버리면 그 가정이 깨진다. 그래서 CORS 설계자들은 **위험할 수 있는 요청은 실행 전에 서버의 명시적 동의를 받도록** 했다. 단순 요청은 "이미 가능했던 것"이라 사후 검사(응답 읽기 차단)로 충분하지만, 그 밖의 요청은 **사전 검사로 본 요청 자체를 막는다.**

## 프리플라이트 발생 조건

다음 중 하나라도 해당하면 프리플라이트가 발생한다.

```
1. 메서드가 GET·HEAD·POST 이외 (PUT, DELETE, PATCH...)
2. 커스텀 헤더 사용 (Authorization, X-Request-Id...)
3. Content-Type이 다음 셋 이외:
   - application/x-www-form-urlencoded
   - multipart/form-data
   - text/plain
```

실무에서 가장 흔한 트리거 두 가지:

```js
// 트리거 1: JSON 본문 → Content-Type: application/json
await fetch('https://api.shop.com/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ item: 7 }),
});

// 트리거 2: 토큰 인증 헤더
await fetch('https://api.shop.com/me', {
  headers: { Authorization: `Bearer ${token}` },
});
```

JSON API라면 사실상 거의 모든 요청에 프리플라이트가 붙는다고 보면 된다.

## 프리플라이트 왕복 해부

![프리플라이트 흐름](/assets/posts/http-cors-preflight-flow.svg)

브라우저는 본 요청 대신 먼저 OPTIONS를 보낸다. 본 요청의 "계획서"다.

```http
OPTIONS /orders HTTP/1.1
Host: api.shop.com
Origin: https://app.shop.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type
```

- `Access-Control-Request-Method` — 본 요청에서 쓰려는 메서드
- `Access-Control-Request-Headers` — 본 요청에 붙일 비단순 헤더 목록

서버는 허용 범위를 선언해 응답한다.

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.shop.com
Access-Control-Allow-Methods: PUT, DELETE
Access-Control-Allow-Headers: content-type
Access-Control-Max-Age: 86400
```

브라우저는 계획서의 메서드와 헤더가 허용 목록에 **모두 포함**되는지 검사한다. 하나라도 빠지면 본 요청은 **아예 전송되지 않고** CORS 에러가 난다. 단순 요청에서는 요청이 실행된 뒤 읽기만 차단됐던 것과 달리, 프리플라이트는 **실행 자체를 막는** 진짜 게이트다.

서버 구현 시 주의점:

- OPTIONS 응답은 **2xx**(보통 204)여야 한다. 리다이렉트(3xx)나 401도 실패로 취급된다.
- **인증 미들웨어보다 앞에서** OPTIONS를 처리하라. 프리플라이트에는 쿠키도 Authorization도 실리지 않으므로, 인증 검사를 통과할 수 없다.
- 본 요청 응답에도 `Access-Control-Allow-Origin`은 **여전히 필요**하다. 프리플라이트 통과는 "보내도 된다"는 뜻이고, 응답을 읽게 해 주는 건 본 응답의 ACAO다.

## Access-Control-Max-Age — 프리플라이트 비용 줄이기

프리플라이트는 모든 API 호출에 왕복(RTT) 하나를 추가한다. 모바일 환경에서 RTT가 100ms를 넘으면 체감 지연이 상당하다. `Access-Control-Max-Age`는 프리플라이트 결과를 브라우저가 캐시하는 시간(초)이다.

```http
Access-Control-Max-Age: 86400   # 이 조합은 24시간 동안 다시 묻지 않음
```

알아둘 세부 사항:

- 캐시 키는 **URL + 메서드 + 헤더 조합**이다. 같은 엔드포인트라도 다른 헤더 조합이면 새 프리플라이트가 난다.
- 브라우저별 상한이 있다. **Chrome은 7200초(2시간), Firefox는 86400초(24시간)**가 최대다. 더 큰 값을 줘도 잘린다.
- 캐시는 자격 증명 모드별로도 구분된다.

프리플라이트 자체를 줄이는 구조적 방법도 있다. 프런트와 API를 **같은 출처로 두는 것**(리버스 프록시로 `/api`를 백엔드에 연결)이 가장 확실하고, 그게 안 되면 Max-Age를 브라우저 상한까지 활용한다.

## 자격 증명(credentials) 포함 요청

교차 출처 요청에는 기본적으로 쿠키가 실리지 않는다. 쿠키 기반 세션 인증을 쓰려면 클라이언트와 서버 양쪽의 **명시적 합의**가 필요하다.

![자격 증명 포함 요청과 프리플라이트 캐시](/assets/posts/http-cors-preflight-credentials.svg)

```js
// 클라이언트: 쿠키를 포함하겠다고 선언
await fetch('https://api.shop.com/me', {
  credentials: 'include',
});
```

```http
# 서버: 자격 증명 포함을 허용한다고 선언 (둘 다 필수)
Access-Control-Allow-Origin: https://app.shop.com
Access-Control-Allow-Credentials: true
```

자격 증명 모드에서는 와일드카드 규칙이 완전히 달라진다.

```
일반 모드                       | 자격 증명 모드
────────────────────────────────────────────────────────
ACAO: *            → 허용      | ACAO: *            → 차단
Allow-Methods: *   → 모두 허용 | * 는 "별표"라는 리터럴로 취급
Allow-Headers: *   → 모두 허용 | 헤더를 일일이 나열해야 함
```

쿠키가 실리는 순간 응답 읽기는 곧 **사용자 데이터 유출**이 될 수 있으므로, "아무 출처나 허용"이라는 선언 자체를 브라우저가 거부하는 것이다. 그래서 쿠키 인증 API의 CORS 설정은 반드시 **화이트리스트 기반 출처 반사 + `Vary: Origin`** 패턴이 된다.

```js
// Express + cors 패키지 — 자격 증명 모드의 표준 설정
import cors from 'cors';

app.use(cors({
  origin: ['https://app.shop.com', 'https://admin.shop.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 7200,
}));
```

한 가지 더: **프리플라이트 요청 자체에는 쿠키가 실리지 않는다.** OPTIONS 핸들러에서 세션을 확인하려 하면 안 되는 이유다.

## 디버깅 체크리스트

```bash
# 프리플라이트를 손으로 재현
curl -si -X OPTIONS https://api.shop.com/orders \
  -H "Origin: https://app.shop.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type" | head -12

# 확인할 것:
# 1. 상태가 2xx인가 (401/302면 미들웨어 순서 문제)
# 2. Allow-Methods에 PUT이 있는가
# 3. Allow-Headers에 content-type이 있는가
# 4. credentials 모드라면 ACAO가 * 가 아닌가
```

자주 보는 증상과 원인:

- **OPTIONS가 401** → 인증 미들웨어가 프리플라이트까지 잡고 있음. CORS 처리를 앞으로.
- **"Request header field authorization is not allowed"** → `Allow-Headers`에 `authorization` 누락.
- **간헐적 실패** → CDN이 OPTIONS를 캐시하거나 `Vary: Origin` 누락.
- **로컬은 되는데 배포만 실패** → 게이트웨이(ALB, API Gateway, ingress)가 OPTIONS를 백엔드에 안 넘기거나 자체 CORS 설정과 충돌.

## 정리

- 프리플라이트는 "CORS 이전엔 불가능했던 모양의 요청"에 대한 **사전 동의 절차**다.
- JSON Content-Type과 Authorization 헤더가 실무 프리플라이트의 양대 트리거다.
- OPTIONS는 인증 없이 2xx로, 허용 메서드·헤더를 빠짐없이 나열해서 응답하라.
- `Access-Control-Max-Age`로 왕복 비용을 줄이되 브라우저 상한(Chrome 2시간)을 기억하라.
- 쿠키 포함 요청에서는 모든 와일드카드가 무효 — 화이트리스트 + `Vary: Origin`이 정답이다.

다음 글에서는 전송 계층으로 내려가 HTTP/1.1의 **Keep-Alive 영속 연결과 파이프라이닝**, 그리고 그 한계를 다룬다.

---

**지난 글:** [CORS 완전 정복 — 교차 출처 리소스 공유의 원리](/posts/http-cors/)

**다음 글:** [Keep-Alive와 파이프라이닝 — 영속 연결의 원리와 한계](/posts/http-keep-alive-pipelining/)

<br>
읽어주셔서 감사합니다. 😊
