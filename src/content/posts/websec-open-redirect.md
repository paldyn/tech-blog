---
title: "오픈 리다이렉트: 신뢰 도메인을 피싱의 발판으로"
description: "외부 URL 검증 없이 리다이렉트를 허용하는 오픈 리다이렉트 취약점의 공격 원리, OAuth 코드 탈취·피싱 시나리오, 허용 목록과 상대 경로 기반 방어 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["웹보안", "오픈리다이렉트", "피싱", "OAuth", "입력검증"]
featured: false
draft: false
---

[지난 글](/posts/websec-host-header-injection/)에서 Host 헤더 조작으로 서버를 속이는 방법을 살펴봤다. 이번에는 서버가 리다이렉트 목적지를 검증하지 않아 발생하는 **오픈 리다이렉트(Open Redirect)** 취약점이다. 단독으로는 낮은 심각도로 분류되지만, 피싱·OAuth 코드 탈취와 결합하면 치명적인 공격이 된다.

## 오픈 리다이렉트란?

애플리케이션이 파라미터로 전달된 외부 URL을 검증 없이 `Location` 헤더로 설정해 사용자를 리다이렉트하는 취약점이다. 공격자는 신뢰할 수 있는 도메인 URL을 피싱 미끼로 사용한다:

```
https://trusted-bank.com/redirect?next=https://evil-phishing.com
```

URL의 도메인 부분(`trusted-bank.com`)은 사용자에게 익숙하고 신뢰성 있게 보인다. 하지만 클릭하면 악성 사이트로 이동한다.

![오픈 리다이렉트 공격 흐름](/assets/posts/websec-open-redirect-flow.svg)

## 취약한 코드 패턴

서버 측에서 검증 없이 파라미터를 리다이렉트에 사용하는 경우다:

```javascript
// 취약: next 파라미터를 검증 없이 사용
app.get('/login', (req, res) => {
  if (authenticate(req)) {
    const next = req.query.next || '/dashboard';
    res.redirect(next); // 외부 URL도 그대로 리다이렉트
  }
});
```

```python
# 취약: url 파라미터 무검증 리다이렉트
def redirect_view(request):
    url = request.GET.get('url', '/')
    return HttpResponseRedirect(url)
```

## 검증 우회 기법

단순히 `url.startsWith('https://trusted.com')`로 검증하면 우회된다. 공격자들이 자주 사용하는 우회 기법들이다:

```
# @ 기호로 호스트 위장
https://trusted.com@evil.com

# 프로토콜 상대 URL
//evil.com/phishing

# URL 인코딩
%2F%2Fevil.com

# 콜론 뒤 슬래시 생략
https:evil.com

# 도메인 이후 슬래시
https://trusted.com.evil.com

# 유니코드 정규화
https://trusted.com/\evil.com
```

## 주요 공격 시나리오

### 1. 피싱

공격자는 이메일·SMS·SNS에 신뢰 도메인 URL을 포함해 배포한다. 클릭 시 가짜 로그인 페이지로 이동해 자격증명을 수집한다.

### 2. OAuth 인증 코드 탈취

OAuth에서 `redirect_uri` 검증이 느슨하면 오픈 리다이렉트와 결합 가능하다:

```
https://auth-provider.com/authorize
  ?client_id=abc
  &redirect_uri=https://trusted-app.com/redirect
    ?next=https://evil.com
  &response_type=code
```

인증 후 `trusted-app.com/redirect?next=evil.com`으로 리다이렉트되고, 다시 `evil.com`으로 이동하면서 URL에 `code=AUTH_CODE`가 포함된 경우 탈취된다.

### 3. SSRF 경유

서버 측 HTTP 클라이언트가 리다이렉트를 자동 추적할 경우, 오픈 리다이렉트를 통해 내부 서비스로 요청을 유도할 수 있다:

```
/fetch?url=https://trusted.com/redirect?next=http://169.254.169.254/
```

## 방어 전략

![오픈 리다이렉트 방어 전략](/assets/posts/websec-open-redirect-defense.svg)

### 1. 허용 목록(allowlist) 기반 검증

URL 파싱 라이브러리로 호스트를 추출해 검증한다. 문자열 패턴 매칭은 우회된다:

```javascript
const SAFE_HOSTS = new Set(['app.example.com', 'www.example.com']);

function validateRedirectUrl(url, req) {
  try {
    // 상대 경로면 현재 origin 기준으로 파싱
    const parsed = new URL(url, `${req.protocol}://${req.hostname}`);
    if (!SAFE_HOSTS.has(parsed.hostname)) {
      return '/dashboard'; // 기본값으로 폴백
    }
    return url;
  } catch {
    return '/dashboard';
  }
}
```

### 2. 상대 경로만 허용

가장 안전한 방법은 외부 URL을 아예 허용하지 않고 같은 도메인의 경로만 허용하는 것이다:

```python
import re
from urllib.parse import urlparse

def safe_redirect_url(url, default='/'):
    # 상대 경로 확인: '/'로 시작하고 '//' 또는 '\\'로 시작하지 않음
    if re.match(r'^\/(?!\/|\\)', url):
        return url
    return default

# Django에서는 is_safe_url() 사용
from django.utils.http import url_has_allowed_host_and_scheme
if not url_has_allowed_host_and_scheme(url, allowed_hosts={request.get_host()}):
    url = '/'
```

### 3. 간접 리다이렉트 토큰 방식

URL을 직접 파라미터로 받지 않고 서버에서 관리하는 토큰만 사용한다:

```javascript
// 리다이렉트 생성
const id = crypto.randomUUID();
await db.set(`redirect:${id}`, '/target-page', { ex: 300 }); // 5분 TTL
res.redirect(`/go/${id}`);

// 리다이렉트 처리
app.get('/go/:id', async (req, res) => {
  const url = await db.get(`redirect:${req.params.id}`);
  if (!url) return res.status(404).end();
  res.redirect(url);
});
```

외부 URL 자체가 요청 파라미터에 노출되지 않아 조작이 불가능하다.

### 4. 외부 이탈 시 경고 페이지

의도적으로 외부 링크를 제공해야 할 경우 경고 페이지를 중간에 삽입한다. 사용자가 목적지를 확인하고 직접 선택할 수 있게 한다.

## 탐지

OWASP ZAP과 Burp Suite는 자동으로 리다이렉트 파라미터를 탐지한다. 수동으로는 `next`, `url`, `redirect`, `goto`, `return`, `returnUrl`, `dest`, `destination`, `redir` 같은 파라미터 이름을 찾아 외부 URL을 넣어본다.

---

**지난 글:** [Host 헤더 인젝션: 신뢰할 수 없는 호스트 값](/posts/websec-host-header-injection/)

**다음 글:** [레이스 컨디션](/posts/websec-race-conditions/)

<br>
읽어주셔서 감사합니다. 😊
