---
title: "콘텐츠 보안 정책(CSP): XSS의 마지막 방어선"
description: "브라우저가 로드할 수 있는 리소스 출처를 제한하는 Content-Security-Policy의 주요 지시어, 'unsafe-inline'·'unsafe-eval'의 위험성, nonce·hash 기반 강화 CSP와 Report-Only 모드 활용법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 8
type: "knowledge"
category: "Security"
tags: ["웹보안", "CSP", "XSS방어", "Content-Security-Policy", "보안헤더"]
featured: false
draft: false
---

[지난 글](/posts/websec-cors-security/)에서 CORS 잘못된 설정으로 SOP가 무력화되는 방식을 살펴봤다. 이번에는 **콘텐츠 보안 정책(Content Security Policy, CSP)**이다. XSS 취약점이 존재하더라도 공격 스크립트의 실행을 막는 심층 방어 레이어다.

## CSP란?

CSP는 서버가 HTTP 응답 헤더로 브라우저에게 "이 페이지에서 어떤 리소스를 어느 출처에서 로드할 수 있는지"를 알려주는 정책이다. 브라우저는 이 정책을 강제해 정책에 없는 출처의 스크립트·스타일·이미지 등을 차단한다.

```http
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com
```

이 정책은 스크립트를 같은 출처(`'self'`)와 `cdn.example.com`에서만 로드하도록 허용한다. 공격자가 XSS를 통해 인라인 스크립트나 외부 악성 스크립트를 삽입해도 브라우저가 실행을 차단한다.

![Content Security Policy(CSP) 동작 원리](/assets/posts/websec-content-security-policy-overview.svg)

## 주요 지시어

**`default-src`**: 지정하지 않은 리소스 유형의 기본값이다. 먼저 `default-src 'none'`이나 `default-src 'self'`로 시작해 필요한 것만 추가하는 방식이 권장된다.

**`script-src`**: JavaScript 로드 가능 출처다. 가장 중요한 지시어다.

**`style-src`**: CSS 로드 가능 출처. `'unsafe-inline'`을 허용하면 인라인 스타일 기반 공격이 가능하다.

**`img-src`**: 이미지 로드 출처. `data:` URI나 `*` 허용 시 정보 누출 우려.

**`connect-src`**: `fetch`, `XHR`, WebSocket 연결 대상. 데이터 유출 방지에 중요.

**`frame-ancestors`**: 현재 페이지를 iframe에 삽입할 수 있는 출처. `'none'`이면 클릭재킹 방어.

**`base-uri`**: `<base>` 태그의 href 값 제한. `'none'`이나 `'self'`를 권장.

**`form-action`**: 폼 제출 가능 URL. 피싱 페이지로의 제출 방지.

## 위험한 키워드

![CSP 취약한 키워드와 강화 전략](/assets/posts/websec-content-security-policy-bypass.svg)

**`'unsafe-inline'`**: 인라인 스크립트(`<script>code</script>`)와 이벤트 핸들러(`onclick="..."`)를 허용한다. XSS 취약점이 존재하면 공격자가 인라인 스크립트를 삽입해 CSP를 우회할 수 있어, CSP의 XSS 방어 효과가 거의 사라진다.

**`'unsafe-eval'`**: `eval()`, `new Function()`, `setTimeout("code")` 등 문자열을 코드로 실행하는 것을 허용한다. 제거가 어렵다면 `'unsafe-eval'` 대신 `'wasm-unsafe-eval'`로 WebAssembly만 허용하도록 제한할 수 있다.

**와일드카드 호스트 (`*`)**: 모든 출처의 리소스를 허용해 CSP 의미를 잃는다.

**`data:` URI (스크립트)**: `script-src`에 `data:` 허용 시 인코딩된 스크립트 실행이 가능하다.

## Nonce 기반 CSP (권장)

`'unsafe-inline'` 없이 인라인 스크립트를 허용하려면 **nonce**를 사용한다. 서버가 요청마다 암호학적으로 무작위한 nonce를 생성해 CSP 헤더와 스크립트 태그 양쪽에 포함한다:

```javascript
// Express.js 예시
app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'nonce-${nonce}' 'strict-dynamic'; ` +
    `object-src 'none'; base-uri 'self'`
  );
  next();
});
```

```html
<!-- 템플릿 (Nonce가 있어야 실행됨) -->
<script nonce="<%= nonce %>">
  // 이 스크립트만 실행됨
  initApp();
</script>

<!-- 공격자가 삽입한 스크립트 (nonce 없음) -->
<script>steal()</script>  <!-- 브라우저가 차단 -->
```

`'strict-dynamic'`은 nonce가 있는 스크립트가 동적으로 추가하는 스크립트도 신뢰하도록 한다. 기존 `<script src="...">` 허용 목록은 무시되어 더 강력한 정책이 된다.

## Hash 기반 CSP

인라인 스크립트 내용이 고정돼 있다면 내용의 SHA256 해시를 사용할 수 있다:

```http
Content-Security-Policy: script-src 'sha256-abc123...'
```

스크립트 내용이 바뀌면 해시가 달라져 차단된다. 외부 파일에는 사용할 수 없다.

## Report-Only 모드로 시작하기

기존 서비스에 CSP를 바로 적용하면 의도치 않은 차단으로 서비스가 망가질 수 있다. `Content-Security-Policy-Report-Only`로 먼저 테스트한다:

```http
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' cdn.example.com; report-uri /csp-violations
```

위반 사항이 차단 없이 `/csp-violations`로 보고된다. 보고를 분석해 정책을 점진적으로 강화한다. 모든 위반이 의도된 것으로 확인되면 `Content-Security-Policy`로 전환한다.

## CSP의 한계

CSP는 XSS가 실행되어 악의적 행동(데이터 유출, 다른 서버로 연결 등)을 하는 것을 막지만, XSS 자체를 막지는 않는다. 입력 검증과 출력 인코딩이 여전히 기본이다. 또한 복잡한 SPA에서 nonce를 적용하기 어렵고, 서드파티 라이브러리가 `eval()`을 사용하면 `'unsafe-eval'`을 허용해야 하는 문제가 있다. 다음 글에서 nonce와 hash의 실전 활용을 더 깊이 다룬다.

---

**지난 글:** [CORS 보안 설정](/posts/websec-cors-security/)

**다음 글:** [CSP Nonce와 Hash 활용](/posts/websec-csp-nonce-hash/)

<br>
읽어주셔서 감사합니다. 😊
