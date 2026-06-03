---
title: "CSRF: 사이트 간 요청 위조 공격의 원리와 방어"
description: "브라우저의 쿠키 자동 첨부 메커니즘을 악용하는 CSRF 공격 원리, 실제 공격 HTML, CSRF 토큰과 SameSite 쿠키를 이용한 완전한 방어 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["CSRF", "웹 보안", "OWASP", "SameSite", "CSRF 토큰", "쿠키"]
featured: false
draft: false
---

[지난 글](/posts/websec-xss-dom-based/)에서 DOM 기반 XSS를 살펴봤습니다. 이번 글의 주제인 **CSRF(Cross-Site Request Forgery, 사이트 간 요청 위조)**는 XSS와 종종 혼동되지만 완전히 다른 공격입니다. XSS는 공격자가 피해자의 브라우저에서 스크립트를 실행하는 것이고, CSRF는 피해자가 의도하지 않은 요청을 인증된 상태로 서버에 보내도록 만드는 공격입니다.

## CSRF의 핵심 원리

브라우저는 특정 도메인에 대한 요청을 보낼 때 해당 도메인의 쿠키를 자동으로 첨부합니다. 이 동작을 악용하는 것이 CSRF입니다.

피해자가 `bank.com`에 로그인된 상태에서 공격자의 사이트 `evil.com`을 방문하면, 그 페이지에 숨겨진 form이 자동으로 `bank.com/transfer`에 POST 요청을 보냅니다. 브라우저는 이 요청에 `bank.com`의 세션 쿠키를 자동으로 첨부하므로, 서버는 이것이 피해자의 정상적인 요청이라고 믿고 이체를 처리합니다.

![CSRF 공격 흐름](/assets/posts/websec-csrf-flow.svg)

## 실제 공격 HTML

공격자가 `evil.com`에 배치하는 HTML은 매우 단순합니다:

```html
<!-- 이미지 태그를 이용한 GET 요청 CSRF -->
<img src="https://bank.com/transfer?to=attacker&amount=1000000" width="0" height="0">

<!-- 자동 제출 form으로 POST 요청 CSRF -->
<form id="csrf" action="https://bank.com/transfer" method="POST">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="1000000">
</form>
<script>document.getElementById('csrf').submit();</script>

<!-- fetch API를 이용한 CSRF (SameSite=None 쿠키 대상) -->
<script>
fetch('https://bank.com/transfer', {
  method: 'POST',
  credentials: 'include',  // 쿠키 첨부
  body: 'to=attacker&amount=1000000',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
</script>
```

CSRF가 성공하는 이유는 서버가 요청의 **출처(Origin)**를 검증하지 않기 때문입니다. 세션 쿠키가 유효하면 정상 요청으로 처리합니다.

## CSRF 토큰 방어

가장 보편적인 방어책은 **동기화 토큰 패턴(Synchronizer Token Pattern)**입니다.

서버가 폼을 응답할 때 예측 불가능한 난수 토큰을 hidden 필드에 삽입합니다. 폼 제출 시 서버는 이 토큰이 세션에 저장된 값과 일치하는지 검증합니다. 공격자가 `evil.com`에서 교차 출처 페이지를 읽어 토큰을 추출하는 것은 Same-Origin Policy로 차단됩니다.

```python
# Django — CSRF 토큰 자동 처리
# settings.py에 'django.middleware.csrf.CsrfViewMiddleware' 추가 (기본 포함)

# 템플릿
# {% csrf_token %}  ← hidden input 자동 생성

# API 엔드포인트 (AJAX)
# Django는 X-CSRFToken 헤더로도 검증
fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'X-CSRFToken': getCookie('csrftoken'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ to: 'friend', amount: 10000 })
});
```

```java
// Spring Security — CSRF 보호 기본 활성화
@Configuration
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            );
        return http.build();
    }
}
```

REST API의 경우 SPA가 많아 `withHttpOnlyFalse()`로 JavaScript가 쿠키에서 토큰을 읽을 수 있게 설정합니다.

## SameSite 쿠키 속성

최신 방어 방법은 쿠키에 `SameSite` 속성을 설정하는 것입니다. 이 속성은 브라우저에게 교차 출처 요청에서 쿠키를 전송하지 말라고 지시합니다.

![CSRF 방어: 토큰 방식과 SameSite 쿠키](/assets/posts/websec-csrf-token.svg)

```http
# 가장 강력한 보호 — 동일 사이트 요청에만 쿠키 전송
Set-Cookie: session=abc123; SameSite=Strict; HttpOnly; Secure

# 일반적 권장 — POST는 차단, 링크 GET은 허용 (Chrome 80+ 기본값)
Set-Cookie: session=abc123; SameSite=Lax; HttpOnly; Secure
```

```python
# Flask에서 SameSite 쿠키 설정
from flask import Flask
app = Flask(__name__)
app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True
)
```

`SameSite=Strict`는 CSRF를 완전히 차단하지만 외부 링크로 사이트에 들어올 때 세션이 전송되지 않아 로그인이 풀린 것처럼 보일 수 있습니다. `SameSite=Lax`는 GET 요청은 허용하므로 링크 클릭 시 세션이 유지됩니다.

## Double Submit Cookie 패턴

SPA나 API 서버에서 세션을 사용하지 않는 경우에 유용한 대안 방법입니다:

```javascript
// 서버: 랜덤 토큰을 쿠키와 응답 헤더 모두에 설정
res.cookie('csrf-token', randomToken, { httpOnly: false });
res.setHeader('X-CSRF-Token', randomToken);

// 클라이언트: 쿠키에서 읽어 요청 헤더에 추가
const token = document.cookie
  .split('; ')
  .find(r => r.startsWith('csrf-token='))
  ?.split('=')[1];

fetch('/api/action', {
  method: 'POST',
  headers: { 'X-CSRF-Token': token },
  credentials: 'include'
});

// 서버: 쿠키와 헤더 값이 동일한지 검증
// 교차 출처에서는 쿠키를 읽을 수 없으므로 위조 불가
```

## Origin / Referer 헤더 검증

CSRF 토큰 없이 `Origin` 또는 `Referer` 헤더를 검증하는 방법도 있습니다. 단, 일부 프록시나 프라이버시 설정으로 헤더가 제거될 수 있어 보조 수단으로만 사용해야 합니다:

```python
def verify_origin(request):
    origin = request.headers.get('Origin', '')
    referer = request.headers.get('Referer', '')
    allowed = 'https://bank.com'
    return origin == allowed or referer.startswith(allowed)
```

## CSRF vs XSS 구분

| 구분 | CSRF | XSS |
|------|------|-----|
| 공격 대상 | 서버 (피해자 권한으로 행동 유발) | 피해자 브라우저 (스크립트 실행) |
| 쿠키 탈취 | 불필요 | 종종 목적 |
| SOP 우회 | 쿠키 자동 전송 악용 | 동일 출처 권한 악용 |
| CSRF 토큰으로 방어 | 가능 | 불가 |

`SameSite=Lax` 또는 `Strict` + CSRF 토큰의 이중 방어를 기본으로 적용하는 것이 현재 권장 사항입니다.

---

**지난 글:** [DOM 기반 XSS: 서버를 거치지 않는 클라이언트 사이드 공격](/posts/websec-xss-dom-based/)

**다음 글:** [CSRF와 SameSite: 현대적 쿠키 보안의 모든 것](/posts/websec-csrf-samesite/)

<br>
읽어주셔서 감사합니다. 😊
