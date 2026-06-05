---
title: "Trusted Types: DOM XSS 방어의 새로운 표준"
description: "innerHTML·eval 등 DOM XSS 싱크에 일반 문자열 할당을 브라우저 레벨에서 차단하는 Trusted Types API의 동작 원리, 정책 정의, 서드파티 라이브러리 처리, Report-Only 모드로 점진적 도입하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["웹보안", "TrustedTypes", "DOMXSS", "XSS방어", "CSP"]
featured: false
draft: false
---

[지난 글](/posts/websec-csp-nonce-hash/)에서 CSP nonce와 hash로 인라인 스크립트를 안전하게 허용하는 방법을 살펴봤다. 이번에는 DOM XSS를 브라우저 레벨에서 구조적으로 차단하는 **Trusted Types**다. 구글이 제안하고 현재 Chromium 기반 브라우저에서 지원하는 Web API로, W3C 표준화가 진행 중이다.

## 문제: DOM XSS 싱크

DOM XSS는 JavaScript가 사용자 제어 데이터를 DOM 조작 API에 직접 전달할 때 발생한다. 가장 흔한 싱크들이다:

```javascript
// HTML 싱크
element.innerHTML = userInput;
element.outerHTML = userInput;
document.write(userInput);

// URL 싱크
location.href = userInput;
script.src = userInput;
a.href = userInput;

// 코드 실행 싱크
eval(userInput);
new Function(userInput)();
setTimeout(userInput, 0);
```

이런 싱크들은 코드베이스 전체에 산재해 있다. 하나라도 검증을 빠뜨리면 XSS가 된다. 수십만 줄의 코드를 감사하는 것은 현실적으로 불가능하다.

## Trusted Types의 해결책

**"DOM 싱크는 Trusted 타입만 받는다"**가 핵심 원칙이다. CSP로 활성화하면 브라우저가 `innerHTML`에 일반 문자열 할당을 거부하고 `TrustedHTML` 타입 객체만 허용한다.

```http
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types myPolicy
```

이제 `TrustedHTML`을 생성하는 유일한 방법은 **Trusted Types 정책(Policy)**을 통하는 것이다. 정책에 sanitize 로직을 집중시키면, 전체 코드베이스에서 XSS 검증이 필요한 지점이 정책 하나로 줄어든다.

![Trusted Types: DOM XSS 싱크 제어](/assets/posts/websec-trusted-types-overview.svg)

## 정책 정의

```javascript
// Trusted Types 정책 생성 (앱 초기화 시 1회)
const sanitizePolicy = trustedTypes.createPolicy('myPolicy', {
  // TrustedHTML 생성
  createHTML: (input) => {
    return DOMPurify.sanitize(input, { RETURN_TRUSTED_TYPE: true });
  },
  // TrustedScript 생성
  createScript: (input) => {
    // 엄격한 검증 필요 — 가능하면 createScript 사용 자제
    if (!isAllowedScript(input)) throw new Error('허용되지 않은 스크립트');
    return input;
  },
  // TrustedScriptURL 생성
  createScriptURL: (input) => {
    const url = new URL(input, location.origin);
    if (!ALLOWED_SCRIPT_HOSTS.has(url.hostname)) {
      throw new Error(`허용되지 않은 스크립트 URL: ${url.hostname}`);
    }
    return input;
  },
});
```

이 정책 정의가 애플리케이션에서 HTML을 DOM에 삽입하는 **유일한 문** 이다.

## 사용 방법

```javascript
// 안전: 정책을 통해 TrustedHTML 생성
const safeHtml = sanitizePolicy.createHTML(userInput);
element.innerHTML = safeHtml; // TrustedHTML 타입 → 허용

// 차단: 일반 문자열 직접 할당
element.innerHTML = userInput; 
// TypeError: Failed to set the 'innerHTML' property on 'Element':
// This document requires 'TrustedHTML' assignment.

// React dangerouslySetInnerHTML도 마찬가지
<div dangerouslySetInnerHTML={{ __html: safeHtml }} />
```

React 18+는 Trusted Types를 지원해 `dangerouslySetInnerHTML`에 `TrustedHTML`을 전달할 수 있다.

## 서드파티 라이브러리 처리

많은 라이브러리가 내부적으로 `innerHTML` 등을 사용한다. Trusted Types가 강제 모드에서 이를 차단하면 라이브러리가 동작하지 않는다.

```javascript
// DOMPurify 3.x: TrustedTypes 지원
DOMPurify.sanitize(dirty, { RETURN_TRUSTED_TYPE: true });
// → TrustedHTML 객체 반환

// Angular: 기본적으로 Trusted Types 지원
// Vue 3: sanitize 훅으로 통합 가능
```

미지원 라이브러리를 위한 임시 방편으로 `'default'` 정책(passthrough)을 사용할 수 있다. 단, 이는 보안 수준을 낮추는 임시 조치다:

```javascript
// 마이그레이션 기간 중 임시 사용
trustedTypes.createPolicy('default', {
  createHTML: (s) => s, // 검증 없음 — 위험
  createScriptURL: (s) => s,
});
```

`'default'` 정책은 모든 싱크에 대한 폴백으로 작동한다. 라이브러리를 Trusted Types 지원 버전으로 교체하거나 래퍼를 작성하면서 점진적으로 제거한다.

## 점진적 도입 전략

![Trusted Types 도입 전략](/assets/posts/websec-trusted-types-migration.svg)

**1단계: Report-Only 모드**

차단 없이 위반 사항만 수집한다:

```http
Content-Security-Policy-Report-Only: require-trusted-types-for 'script'; report-uri /tt-violations
```

위반 보고 형식:
```json
{
  "csp-report": {
    "violated-directive": "require-trusted-types-for 'script'",
    "source-file": "https://app.example.com/bundle.js",
    "line-number": 42
  }
}
```

**2단계: 위반 싱크 수정**

보고된 모든 싱크를 정책 호출로 교체한다:

```javascript
// ESLint 플러그인으로 자동 탐지
// @typescript-eslint/no-restricted-syntax 등 활용

// 취약 패턴 검색
grep -rn "innerHTML\s*=" src/
grep -rn "document\.write" src/
grep -rn "eval(" src/
```

**3단계: 강제 모드 활성화**

모든 위반이 수정됐음을 확인 후 `Content-Security-Policy`로 전환한다.

## 브라우저 지원 현황

현재 Chrome/Edge(Chromium)에서 지원하고 Firefox는 개발 중이다. 폴리필(`@webcomponents/trusted-types`)로 미지원 브라우저에서도 개발 중 경고를 받을 수 있다. 프로덕션에서는 `trustedTypes` 존재 여부를 확인한다:

```javascript
const tt = window.trustedTypes;
if (tt) {
  const policy = tt.createPolicy('myPolicy', { createHTML: ... });
} else {
  // 폴리필 또는 기본 sanitize만 적용
}
```

---

**지난 글:** [CSP Nonce와 Hash 활용](/posts/websec-csp-nonce-hash/)

<br>
읽어주셔서 감사합니다. 😊
