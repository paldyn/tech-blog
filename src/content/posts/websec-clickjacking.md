---
title: "클릭재킹: 보이지 않는 레이어의 함정"
description: "투명 iframe으로 클릭을 가로채는 클릭재킹 공격 원리, X-Frame-Options·CSP frame-ancestors 방어 헤더 설정, SameSite 쿠키 보완 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["클릭재킹", "X-Frame-Options", "CSP", "frame-ancestors", "iframe", "UI레이어공격"]
featured: false
draft: false
---

[지난 글](/posts/websec-cookie-security/)에서 쿠키 보안 속성으로 XSS와 CSRF를 막는 방법을 다뤘다. 이번 글에서는 쿠키가 아닌 **사용자의 클릭 자체**를 탈취하는 클릭재킹(Clickjacking) 공격을 살펴본다. 공격자는 투명한 iframe 레이어로 피해자가 엉뚱한 버튼을 클릭하게 만든다.

## 클릭재킹이란

클릭재킹(UI 레드레싱이라고도 부른다)은 공격자가 악성 페이지에 투명한 iframe을 올려놓아 사용자의 클릭을 가로채는 공격이다. 피해자는 보이는 버튼을 클릭했다고 생각하지만, 실제로는 투명 레이어 아래 숨겨진 실제 사이트의 버튼을 클릭한다.

![클릭재킹 공격 메커니즘](/assets/posts/websec-clickjacking-mechanism.svg)

## 공격 시나리오

```html
<!-- 공격자 페이지 (attacker.com) -->
<!DOCTYPE html>
<html>
<head>
<style>
/* 실제 사이트 iframe을 투명하게 전체 덮기 */
#overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;        /* 완전 투명 */
  z-index: 999;      /* 가장 위 레이어 */
}

/* 미끼 버튼 위치를 iframe의 실제 버튼과 정밀 일치 */
#decoy-btn {
  position: absolute;
  top: 250px;
  left: 310px;
  padding: 12px 24px;
  background: gold;
  cursor: pointer;
}
</style>
</head>
<body>
  <!-- 피해자에게 보이는 미끼 콘텐츠 -->
  <div id="decoy-btn">🎁 경품 당첨! 지금 받기</div>

  <!-- 실제 사이트를 투명하게 덮는 iframe -->
  <iframe id="overlay"
    src="https://bank.example.com/transfer?to=attacker&amount=1000000">
  </iframe>
</body>
</html>
```

피해자가 "경품 받기" 버튼을 클릭하면, 실제로는 투명 iframe 위의 "이체 확인" 버튼이 클릭된다. 피해자가 은행에 로그인되어 있다면 세션 쿠키가 자동으로 포함되어 이체가 실행된다.

## 방어 전략

![클릭재킹 방어 전략](/assets/posts/websec-clickjacking-defense.svg)

### ① X-Frame-Options 헤더

가장 간단한 방어다. HTTP 응답 헤더로 이 페이지가 iframe 안에 표시될 수 있는지 제어한다.

```http
# 어느 사이트에서도 iframe으로 표시 불가
X-Frame-Options: DENY

# 같은 오리진에서만 iframe 허용
X-Frame-Options: SAMEORIGIN
```

Express.js에서는 `helmet` 미들웨어로 자동 설정된다.

```javascript
import helmet from 'helmet';

app.use(helmet({
  frameguard: {
    action: 'sameorigin'  // 기본값 'sameorigin'
  }
}));
```

**한계**: 특정 도메인(예: `partner.example.com`)만 허용하는 세밀한 제어가 불가능하다. `ALLOW-FROM` 지시자는 현대 브라우저에서 지원이 중단되었다.

### ② CSP frame-ancestors (권장)

Content Security Policy의 `frame-ancestors` 지시자는 X-Frame-Options보다 강력하고 유연하다.

```http
# 자신만 허용
Content-Security-Policy: frame-ancestors 'self';

# 같은 오리진과 특정 파트너 도메인 허용
Content-Security-Policy: frame-ancestors 'self' https://partner.example.com;

# 완전 차단
Content-Security-Policy: frame-ancestors 'none';
```

```nginx
# nginx 설정
add_header Content-Security-Policy "frame-ancestors 'self' https://trusted-partner.com";
```

```python
# FastAPI 미들웨어
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "frame-ancestors 'self' https://partner.example.com"
        )
        return response
```

**X-Frame-Options vs frame-ancestors 선택 기준**:
- 구형 IE 지원 필요 → X-Frame-Options 추가
- 특정 도메인만 허용 → frame-ancestors 필수
- 일반적인 경우 → 둘 다 설정 (X-Frame-Options는 하위 호환, frame-ancestors는 현대 브라우저)

### ③ SameSite 쿠키 보완

클릭재킹은 피해자가 대상 사이트에 로그인된 상태여야 효과가 있다. `SameSite=Strict`이면 크로스 사이트 iframe에서 세션 쿠키가 전송되지 않아 공격 효과를 줄인다.

```http
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax
```

`Lax`는 POST 폼을 차단하지만 iframe 내 GET 요청에는 쿠키를 포함한다. 클릭재킹 완전 방어를 위해서는 `Strict` 또는 `frame-ancestors` 헤더를 함께 써야 한다.

### ④ JS frame-busting (비권장)

```javascript
// 옛날 방어 방식 — 우회 가능하므로 단독으로 사용 금지
if (top !== self) {
  top.location = self.location;
}
```

이 방식은 `sandbox="allow-scripts"` 속성이 붙은 iframe에서는 동작하지 않는다. iframe의 JS가 `top.location`을 변경할 수 없도록 sandbox로 차단하면 frame-busting 코드가 무력화된다.

## 어떤 사이트가 취약한가

```bash
# curl로 헤더 확인
curl -I https://example.com | grep -i -E "x-frame|content-security"

# 없으면 취약
```

frame-ancestors나 X-Frame-Options 헤더가 없는 사이트는 클릭재킹에 노출된다. 로그인, 결제, 동의 버튼이 있는 페이지가 특히 위험하다.

## 권장 보안 설정 요약

```http
# 완전 차단 (권장)
Content-Security-Policy: frame-ancestors 'none';
X-Frame-Options: DENY

# 같은 오리진만 허용
Content-Security-Policy: frame-ancestors 'self';
X-Frame-Options: SAMEORIGIN

# 파트너 도메인 허용 (frame-ancestors만 가능)
Content-Security-Policy: frame-ancestors 'self' https://partner.com;
```

---

**지난 글:** [쿠키 보안: Secure·HttpOnly·SameSite 완전 정복](/posts/websec-cookie-security/)

**다음 글:** [서브리소스 무결성(SRI): CDN 공급망 공격 방어](/posts/websec-subresource-integrity/)

<br>
읽어주셔서 감사합니다. 😊
