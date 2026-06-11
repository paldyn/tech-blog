---
title: "CORS 완전 정복 — 교차 출처 리소스 공유의 원리"
description: "동일 출처 정책이 왜 존재하는지, CORS가 무엇을 허용해 주는지, 단순 요청과 Access-Control-Allow-Origin의 동작, 그리고 흔한 CORS 에러의 원인을 원리부터 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["CORS", "동일출처정책", "Origin", "AccessControlAllowOrigin", "교차출처", "브라우저보안"]
featured: false
draft: false
---

[지난 글](/posts/http-conditional-requests-deep/)까지 캐시와 조건부 요청을 마쳤다. 이번에는 프런트엔드 개발자가 가장 자주 마주치는 에러의 주인공, **CORS(Cross-Origin Resource Sharing)**다. "CORS 에러는 서버에서 헤더 하나 추가하면 된다"는 처방만 알고 넘어가기 쉽지만, 왜 브라우저가 멀쩡한 응답을 막아서는지, 무엇을 보호하려는 장치인지 원리를 이해하면 디버깅이 완전히 달라진다.

## 출처(Origin)란 정확히 무엇인가

CORS를 이해하려면 먼저 **출처**의 정의부터 정확해야 한다. 출처는 URL의 세 요소로 결정된다.

```
출처(Origin) = 스킴(scheme) + 호스트(host) + 포트(port)
```

![출처의 구성 요소](/assets/posts/http-cors-origin.svg)

`https://app.example.com`을 기준으로 보면:

- `https://app.example.com/other/path` — 경로만 다르면 **같은 출처**
- `http://app.example.com` — 스킴이 다르면 **다른 출처**
- `https://app.example.com:8443` — 포트가 다르면 **다른 출처**
- `https://api.example.com` — 서브도메인이 다르면 **다른 출처**

같은 회사 서비스라도 `app.example.com`에서 `api.example.com`을 호출하면 브라우저에게는 엄연히 교차 출처다. 실무 CORS 이슈의 대부분이 바로 이 구도(프런트와 API의 도메인 분리)에서 나온다.

## 동일 출처 정책 — 무엇을 막으려는 건가

**동일 출처 정책(Same-Origin Policy, SOP)**은 "한 출처의 스크립트가 다른 출처의 응답을 읽지 못하게 한다"는 브라우저 규칙이다. 왜 필요할까?

브라우저는 요청을 보낼 때 **그 도메인의 쿠키를 자동으로 첨부**한다. 당신이 `bank.com`에 로그인된 상태로 악성 사이트 `evil.com`을 방문했다고 하자. SOP가 없다면:

```js
// evil.com의 스크립트 — SOP가 없는 가상의 세계
const res = await fetch('https://bank.com/api/accounts');
// 브라우저가 bank.com 쿠키를 자동 첨부 → 로그인된 응답이 옴
const accounts = await res.json();   // 계좌 내역 탈취
sendToAttacker(accounts);
```

`evil.com`이 당신의 세션 쿠키에 올라탄 채 은행 데이터를 읽어가 버린다. SOP는 이 시나리오를 차단한다. **다른 출처로 요청은 보낼 수 있어도, 그 응답을 스크립트가 읽는 것은 막는다.**

여기서 중요한 비대칭이 있다. `<img>`, `<script>`, `<form>` 같은 HTML 요소를 통한 교차 출처 **요청 자체는 웹의 탄생부터 허용**돼 왔다 (다른 사이트의 이미지를 넣는 건 웹의 본질이다). SOP가 막는 것은 **스크립트의 프로그램적 읽기**다.

## CORS — SOP에 내는 구멍

SOP는 안전하지만 너무 엄격하다. `app.example.com` 프런트가 `api.example.com` API를 호출하는 정당한 사용까지 막아버린다. **CORS는 서버가 "이 출처는 내 응답을 읽어도 좋다"고 명시적으로 선언하는 프로토콜**이다.

동작은 헤더 두 개의 합의로 이뤄진다.

```http
# 브라우저: 요청에 출처를 자동으로 밝힌다 (스크립트가 위조 불가)
GET /items HTTP/1.1
Host: api.shop.com
Origin: https://app.shop.com

# 서버: 이 출처의 읽기를 허용한다고 응답
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.shop.com
Content-Type: application/json
```

브라우저는 응답의 `Access-Control-Allow-Origin`(이하 ACAO)이 요청의 `Origin`과 일치하는지 검사하고, 일치할 때만 응답을 자바스크립트에 넘겨준다.

![단순 요청의 CORS 흐름](/assets/posts/http-cors-simple-request.svg)

### 가장 많이 오해하는 지점

위 그림에서 꼭 봐야 할 사실: **요청은 이미 서버에 도달해서 실행됐다.** CORS 에러가 떴어도 서버 로그에는 200이 찍혀 있다. 차단된 것은 요청이 아니라 **응답을 스크립트가 읽는 것**이다.

따라서:

- CORS는 **서버를 보호하는 장치가 아니다.** `curl`, Postman, 서버 간 호출에는 CORS가 아예 존재하지 않는다 (브라우저만의 메커니즘이다).
- CORS 설정을 아무리 열어도 **서버 보안이 약해지는 것은 응답 읽기 측면뿐**이다. 반대로 인증이 쿠키 기반이라면 ACAO를 함부로 여는 것이 데이터 유출로 직결된다.
- "CORS 에러나니까 보안상 안전하다"도 틀렸다. 상태 변경(POST 등)은 이미 일어났을 수 있다 — 이것이 CSRF 공격이 성립하는 이유다.

## 단순 요청 (Simple Request)

모든 교차 출처 요청이 같은 절차를 밟는 건 아니다. **HTML 폼이 원래 만들 수 있던 수준의 요청**은 사전 확인 없이 바로 전송된다. 이를 단순 요청이라 한다.

조건을 모두 만족해야 한다:

```
메서드: GET, HEAD, POST 중 하나
수동 설정 헤더: Accept, Accept-Language, Content-Language,
               Content-Type 정도만
Content-Type: application/x-www-form-urlencoded,
              multipart/form-data, text/plain 중 하나
```

`Content-Type: application/json`을 붙이는 순간 단순 요청이 아니다. `Authorization` 헤더를 붙여도 마찬가지다. 단순 요청 조건을 벗어나면 브라우저는 본 요청 전에 **프리플라이트(preflight)**라는 사전 확인 요청을 보내는데, 이는 다음 글에서 깊이 다룬다.

## 서버 측 CORS 설정

Express와 nginx 예시다.

```js
// Express — 직접 구현 (원리 이해용)
app.use((req, res, next) => {
  const allowed = ['https://app.shop.com', 'https://admin.shop.com'];
  const origin = req.get('Origin');

  if (origin && allowed.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');   // 출처별로 응답이 다름을 캐시에 알림
  }

  next();
});
```

```nginx
# nginx — 정적 자산을 모든 출처에 공개 (폰트, 이미지 등)
location /assets/ {
    add_header Access-Control-Allow-Origin "*";
}
```

두 가지 실무 포인트:

**`Vary: Origin`을 잊지 마라.** ACAO를 요청 Origin에 따라 동적으로 바꾼다면, 중간 캐시(CDN)가 한 출처용 응답을 다른 출처에 재사용하지 않도록 `Vary: Origin`이 필수다. 이거 빠뜨리면 "어떨 땐 되고 어떨 땐 안 되는" 미스터리 CORS 에러가 만들어진다.

**와일드카드 `*`의 한계.** `Access-Control-Allow-Origin: *`는 공개 리소스에는 편리하지만, **자격 증명(쿠키) 포함 요청에는 사용할 수 없다.** 브라우저가 거부한다. 쿠키 기반 인증 API라면 반드시 구체적인 출처를 반사(reflect)하는 화이트리스트 방식이어야 한다.

## CORS 에러 디버깅 절차

```bash
# 1. 브라우저 없이 서버 응답 헤더부터 확인
curl -sI -H "Origin: https://app.shop.com" \
  https://api.shop.com/items | grep -i access-control
# access-control-allow-origin: https://app.shop.com  ← 있어야 함

# 2. 없다면: 서버/게이트웨이/프록시 중 어디서 빠지는지 추적
#    (에러 응답(4xx/5xx)에 CORS 헤더를 안 붙이는 설정이 흔한 범인)

# 3. 있는데도 막힌다면: Origin 값과 정확히 일치하는지
#    (https vs http, 포트, 끝 슬래시 여부)
```

흔한 원인 목록:

- 정상 응답에만 CORS 헤더를 붙이고 **에러 응답에는 안 붙임** → "500인데 CORS 에러로 보임"
- API 게이트웨이와 백엔드가 **둘 다 헤더를 붙여서 중복** → ACAO 값이 두 개가 되어 거부됨
- `Origin: https://app.shop.com`인데 서버 화이트리스트에는 `http://`로 등록
- 로컬 개발에서 `localhost:3000`과 `127.0.0.1:3000`을 혼용 (서로 다른 호스트다)

## 정리

- 출처 = 스킴 + 호스트 + 포트. 하나만 달라도 교차 출처.
- SOP는 쿠키에 올라탄 무단 읽기를 막는 **브라우저의 읽기 통제**다.
- CORS는 서버가 ACAO 헤더로 읽기를 **선택적으로 허용**하는 프로토콜이다.
- 요청은 차단되지 않는다. 읽기가 차단된다. 서버 로그에는 요청이 남는다.
- 동적 ACAO에는 `Vary: Origin`, 쿠키 인증에는 와일드카드 금지.

다음 글에서는 단순 요청 조건을 벗어났을 때 발생하는 **프리플라이트(OPTIONS) 요청**과 자격 증명 포함 요청의 상세 규칙을 다룬다.

---

**지난 글:** [조건부 요청 심화 — If-Match, If-Unmodified-Since, If-Range와 평가 순서](/posts/http-conditional-requests-deep/)

**다음 글:** [CORS 프리플라이트 완전 정복 — OPTIONS 요청과 인증 정보 규칙](/posts/http-cors-preflight/)

<br>
읽어주셔서 감사합니다. 😊
