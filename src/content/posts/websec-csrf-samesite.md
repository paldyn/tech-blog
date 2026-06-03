---
title: "CSRF와 SameSite: 현대적 쿠키 보안의 모든 것"
description: "SameSite 쿠키 속성의 Strict/Lax/None 동작 원리, Same-Site와 Same-Origin의 차이, SameSite 우회 시나리오와 이중 방어 전략을 심층 분석합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["CSRF", "SameSite", "쿠키 보안", "웹 보안", "Same-Origin", "브라우저 보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-csrf/)에서 CSRF의 기본 원리와 CSRF 토큰, SameSite 쿠키를 개략적으로 살펴봤습니다. 이번 글에서는 **SameSite 쿠키 속성**이 정확히 어떻게 동작하는지, Same-Site와 Same-Origin의 차이가 무엇인지, 그리고 SameSite만으로는 왜 부족한지 깊이 파고듭니다.

## Same-Site vs Same-Origin: 다른 개념

두 개념이 자주 혼동됩니다. 정확하게 구분해야 합니다.

**Same-Origin**: 프로토콜, 호스트, 포트 세 가지가 모두 동일해야 합니다.
- `https://app.example.com:443` vs `https://api.example.com:443` → **Cross-Origin** (호스트 다름)

**Same-Site**: eTLD+1(등록 가능한 최상위 도메인 + 1)이 같으면 됩니다.
- `https://app.example.com` vs `https://api.example.com` → **Same-Site** (example.com 공유)
- `https://user.github.io` vs `https://attacker.github.io` → **Cross-Site** (github.io는 공개 접미사)

![SameSite vs SameOrigin: 정확한 개념 구분](/assets/posts/websec-csrf-samesite-model.svg)

공개 접미사(Public Suffix) 판단은 Mozilla가 관리하는 **Public Suffix List(PSL)**를 브라우저가 참조합니다. `github.io`, `vercel.app`, `netlify.app`, `co.kr` 등이 공개 접미사로 등록되어 있어 그 아래 서브도메인들은 서로 다른 사이트로 취급됩니다.

## SameSite 세 가지 값 상세 동작

**SameSite=Strict**: 교차 사이트 요청에서는 쿠키를 절대 전송하지 않습니다. 외부 링크를 클릭해 들어오는 경우도 포함됩니다. 보안성은 가장 높지만, 외부 링크에서 들어온 사용자는 로그인 상태가 아닌 것처럼 보일 수 있습니다.

```
# 예시: github.com의 세션 쿠키가 Strict라면
Google 검색 결과에서 github.com 링크 클릭
→ 쿠키 미전송 → 로그인 화면 리다이렉트
```

**SameSite=Lax**: Chrome 80 이후 기본값입니다. **Top-level navigation**이고 **안전한 HTTP 메서드(GET, HEAD, OPTIONS)**인 경우에만 교차 사이트 쿠키를 전송합니다. 대부분의 CSRF 공격(POST form 제출, XHR, fetch)을 차단합니다.

```http
# Lax에서 쿠키 전송 조건
- <a href> 클릭 → GET top-level nav → 전송
- <form method="GET"> 제출 → 전송
# Lax에서 쿠키 차단 조건
- <form method="POST"> 제출 → 차단
- fetch('https://...', { credentials: 'include' }) → 차단
- <img src="https://..."> → 차단 (서브리소스)
- <iframe src="https://..."> → 차단
```

**SameSite=None**: 모든 교차 사이트 요청에 쿠키를 전송합니다. 반드시 `Secure`와 함께 설정해야 합니다. 서드파티 쿠키(결제 모듈, 소셜 로그인 위젯 등)에 사용합니다.

```http
Set-Cookie: payment_session=xyz; SameSite=None; Secure
```

## SameSite 우회 시나리오와 한계

SameSite를 설정했다고 안심할 수 없는 이유가 있습니다.

![SameSite 한계와 우회 시나리오](/assets/posts/websec-csrf-samesite-bypass.svg)

**서브도메인 탈취**: 회사가 폐기했지만 DNS에 남아 있는 서브도메인을 공격자가 점유하면, 그 서브도메인에서 보내는 요청은 same-site로 분류됩니다. `SameSite=Lax`도 무력화됩니다.

**클라이언트 사이드 리다이렉트**: 서버가 `GET /redirect?url=/transfer`처럼 리다이렉트를 처리하면, 공격자가 같은 사이트 내 GET 리다이렉트로 상태 변경 요청을 유도할 수 있습니다.

**구형 브라우저**: IE 11이나 일부 구형 Safari는 SameSite를 지원하지 않아 쿠키를 그냥 전송합니다.

**XSS 결합**: 동일 사이트에서 XSS가 발생하면 SameSite는 아무 의미 없습니다. 스크립트가 이미 same-origin 컨텍스트에서 실행 중이기 때문입니다.

## 이중 방어 구성

SameSite는 CSRF 방어의 핵심이지만 단독으로는 불충분합니다. 다음 구성을 권장합니다:

```python
# Django — 안전한 쿠키 설정
SESSION_COOKIE_SAMESITE = 'Lax'      # 기본 Lax
SESSION_COOKIE_HTTPONLY = True       # JS 접근 차단
SESSION_COOKIE_SECURE = True         # HTTPS만
SESSION_COOKIE_AGE = 3600            # 세션 유효기간

CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False         # JS가 읽어야 함
CSRF_COOKIE_SECURE = True
```

```javascript
// Express.js — helmet + express-session
const session = require('express-session');
const csrf = require('csurf');

app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 3600000
  }
}));
app.use(csrf({ cookie: { sameSite: 'lax' } }));
```

## 민감 작업의 추가 보호

이체, 비밀번호 변경, 계정 삭제 같은 고위험 작업에는 SameSite + CSRF 토큰 위에 추가 인증 레이어를 더합니다:

```python
@require_POST
@login_required
def transfer_funds(request):
    # CSRF 토큰 자동 검증 (Django 미들웨어)
    
    # 추가: 비밀번호 재확인
    password = request.POST.get('confirm_password')
    if not request.user.check_password(password):
        return HttpResponseForbidden('비밀번호 확인 필요')
    
    # 또는 TOTP 코드 검증
    totp_code = request.POST.get('totp_code')
    if not verify_totp(request.user, totp_code):
        return HttpResponseForbidden('OTP 코드 오류')
    
    # 실제 이체 처리
    perform_transfer(request)
```

SameSite 쿠키를 올바르게 이해하고, CSRF 토큰과 병용하며, 고위험 작업에 재인증을 추가하는 것이 2026년 현재 CSRF 방어의 모범 사례입니다.

---

**지난 글:** [CSRF: 사이트 간 요청 위조 공격의 원리와 방어](/posts/websec-csrf/)

**다음 글:** [SSRF: 서버 사이드 요청 위조 공격](/posts/websec-ssrf/)

<br>
읽어주셔서 감사합니다. 😊
