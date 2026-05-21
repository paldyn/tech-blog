---
title: "CSRF와 SameSite 쿠키 — 사이트 간 요청 위조 방어"
description: "CSRF 공격 원리와 피해 시나리오, SameSite 쿠키(Strict·Lax·None)의 동작 차이, CSRF 토큰 구현, Origin 헤더 검증까지 실전 방어 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "CSRF", "SameSite", "쿠키", "CSRF토큰", "Origin헤더"]
featured: false
draft: false
---

[지난 글](/posts/sec-xss/)에서 XSS의 세 가지 유형과 방어 방법을 살펴봤습니다. 이번에는 XSS와 함께 OWASP 최상위 취약점에 항상 등장하는 **CSRF(Cross-Site Request Forgery)**를 다룹니다.

## CSRF란 무엇인가

CSRF는 피해자의 브라우저가 **본인 의지 없이** 신뢰된 사이트에 요청을 보내도록 유도하는 공격입니다. 브라우저는 쿠키를 자동으로 첨부하기 때문에, 피해자가 이미 `bank.com`에 로그인되어 있으면 `evil.com`의 숨겨진 폼이 `bank.com/transfer`로 POST 요청을 보낼 때 세션 쿠키가 자동으로 실려 가게 됩니다.

공격이 성공하려면 두 가지 조건이 충족되어야 합니다. 피해자가 대상 사이트에 **인증된 상태**이어야 하고, 요청의 부작용이 서버 **상태를 변경**해야 합니다(GET 요청으로 데이터를 조회만 하는 경우엔 영향이 없습니다).

## 공격 흐름

![CSRF 공격 흐름과 SameSite 방어](/assets/posts/sec-csrf-samesite-flow.svg)

전형적인 Stored CSRF 시나리오를 단계별로 살펴보면 다음과 같습니다.

1. 공격자가 `evil.com`에 숨겨진 HTML 폼을 만듭니다.
2. 피해자가 `bank.com`에 로그인된 상태로 `evil.com`을 방문합니다.
3. 페이지 로드 시 JavaScript가 폼을 자동 제출합니다.
4. 브라우저는 `bank.com`으로 요청을 보내면서 `bank.com` 세션 쿠키를 자동 첨부합니다.
5. 서버는 유효한 쿠키로 인증된 요청이라 판단해 송금을 처리합니다.

```html
<!-- evil.com에 숨겨진 자동 제출 폼 -->
<form id="csrf" action="https://bank.com/transfer" method="POST">
  <input type="hidden" name="to" value="attacker-account">
  <input type="hidden" name="amount" value="1000000">
</form>
<script>document.getElementById('csrf').submit();</script>
```

## SameSite 쿠키 — 브라우저 레벨 방어

`SameSite` 속성은 쿠키를 크로스 사이트 요청에 포함할지 여부를 브라우저에게 지시합니다. 세 가지 값이 있습니다.

**Strict**: 크로스 사이트 요청에 절대 쿠키를 보내지 않습니다. 외부에서 링크를 클릭해도 쿠키가 빠지므로, 로그인 상태가 필요한 첫 페이지 진입이 실패할 수 있습니다. 보안이 최우선인 관리자 패널 같은 곳에 적합합니다.

**Lax**: 크로스 사이트 POST·XHR·fetch 요청에는 쿠키를 보내지 않지만, 탑 레벨 GET 탐색(링크 클릭, 리다이렉트)은 허용합니다. Chrome 80부터 기본값입니다.

**None**: 모든 크로스 사이트 요청에 쿠키를 전송합니다. 반드시 `Secure` 속성을 함께 설정해야 하며, OAuth 리다이렉트·삽입형 위젯처럼 크로스 사이트 전송이 필요한 경우에 씁니다.

```http
Set-Cookie: sessionId=abc; SameSite=Strict; Secure; HttpOnly
Set-Cookie: sessionId=abc; SameSite=Lax; Secure; HttpOnly
Set-Cookie: embed=xyz; SameSite=None; Secure
```

## CSRF 토큰

SameSite로 막히지 않는 환경(구형 브라우저, 같은 사이트 내 취약점)을 대비해 **CSRF 토큰**을 함께 사용합니다. 서버가 세션마다 고유한 무작위 토큰을 발급하고, 상태 변경 요청 시 이 토큰을 요청 본문이나 헤더에 포함시켜 서버가 검증합니다.

![CSRF 토큰 구현 패턴](/assets/posts/sec-csrf-samesite-code.svg)

### Double Submit Cookie 패턴

세션 저장소 없이도 구현할 수 있는 방식입니다. 서버가 무작위 값을 쿠키로 설정하면, 클라이언트가 이를 읽어 요청 헤더에도 함께 보냅니다. 서버는 쿠키 값과 헤더 값이 일치하는지만 확인합니다.

```js
// 클라이언트
async function postWithCsrf(url, body) {
  const csrfToken = document.cookie
    .split('; ')
    .find(c => c.startsWith('csrf='))
    ?.split('=')[1];

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(body),
  });
}
```

크로스 사이트 요청은 `evil.com`에서 `bank.com`의 쿠키를 자바스크립트로 읽을 수 없으므로(SOP 제한), 이 패턴이 유효합니다.

## Origin / Referer 헤더 검증

서버에서 `Origin` 또는 `Referer` 헤더를 확인하는 방법도 유효합니다. `Origin` 헤더는 크로스 사이트 요청과 POST 요청에 브라우저가 자동으로 추가하며, 쿠키와 달리 자바스크립트로 위조할 수 없습니다.

```js
function verifyCsrfOrigin(req, res, next) {
  const allowedOrigins = ['https://bank.com', 'https://app.bank.com'];
  const origin = req.headers['origin'] || req.headers['referer'];

  if (!origin || !allowedOrigins.some(o => origin.startsWith(o))) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  next();
}
```

단, `Origin` 헤더가 없는 경우(일부 GET 요청, 오래된 브라우저)도 있으므로, CSRF 토큰과 병행 사용하는 것이 바람직합니다.

## CSRF vs XSS의 차이

| 구분 | CSRF | XSS |
|---|---|---|
| 공격 대상 | 서버 (피해자 권한 남용) | 클라이언트 (피해자 브라우저) |
| 조건 | 피해자의 인증된 세션 | 취약한 출력 지점 |
| SameSite 방어 효과 | 높음 | 없음 |
| CSRF 토큰 방어 효과 | 높음 | 없음 |

## 정리

CSRF 방어의 첫 번째 레이어는 `SameSite=Strict` 또는 `SameSite=Lax` 쿠키입니다. 현대 브라우저에서는 Lax가 기본이라 상당수 공격이 자동 차단됩니다. 그 위에 CSRF 토큰이나 Origin 헤더 검증을 추가해 심층 방어를 구성하는 것이 모범 사례입니다. 다음 글에서는 XSS 방어의 핵심인 CSP를 깊게 파고듭니다.

---

**지난 글:** [XSS(크로스 사이트 스크립팅) 완전 정복](/posts/sec-xss/)

**다음 글:** [Content-Security-Policy — 인라인 스크립트 차단과 nonce 전략](/posts/sec-csp/)

<br>
읽어주셔서 감사합니다. 😊
