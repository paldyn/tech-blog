---
title: "CSP Nonce와 Hash: 인라인 스크립트 안전하게 허용하기"
description: "CSP에서 'unsafe-inline' 없이 인라인 스크립트를 허용하는 nonce와 hash 방식의 동작 원리, strict-dynamic 키워드, nonce 우회 기법과 방어, Next.js·Express 실전 구현 예시를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["웹보안", "CSP", "nonce", "hash", "XSS방어"]
featured: false
draft: false
---

[지난 글](/posts/websec-content-security-policy/)에서 CSP의 개요와 `'unsafe-inline'`의 위험성을 다뤘다. 이번에는 `'unsafe-inline'` 없이 인라인 스크립트를 허용하는 두 가지 방법인 **nonce**와 **hash**, 그리고 이를 강화하는 `'strict-dynamic'`을 깊이 살펴본다.

## 왜 Nonce와 Hash가 필요한가?

현실적으로 많은 애플리케이션이 인라인 스크립트를 사용한다. 초기 데이터를 HTML에 삽입하거나(`<script>window.__data__ = {...}</script>`), Google Tag Manager 등 서드파티 스니펫을 사용하는 경우다. `'unsafe-inline'`을 허용하면 XSS 방어가 무력화되고, 모든 인라인 스크립트를 외부 파일로 이동하는 것은 현실적으로 어렵다.

Nonce와 Hash는 특정 스크립트만 식별해 허용하는 방법이다.

![CSP Nonce vs Hash 동작 비교](/assets/posts/websec-csp-nonce-hash-flow.svg)

## Nonce 방식

### 원리

서버가 요청마다 암호학적으로 무작위한 토큰(nonce)을 생성한다. 이 nonce를 CSP 헤더에 `'nonce-{값}'`으로 포함하고, 허용할 스크립트 태그에 `nonce="{값}"` 속성을 추가한다. 브라우저는 스크립트의 nonce와 CSP의 nonce를 비교해 일치하는 경우만 실행한다.

```javascript
// Express.js 미들웨어
import crypto from 'crypto';

app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  
  res.setHeader('Content-Security-Policy', [
    `default-src 'self'`,
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `object-src 'none'`,
    `base-uri 'self'`,
  ].join('; '));
  
  next();
});
```

```html
<!-- EJS 템플릿 -->
<script nonce="<%= nonce %>">
  window.__APP_DATA__ = <%- JSON.stringify(data) %>;
</script>

<!-- 공격자가 삽입한 XSS 스크립트 -->
<script>malicious()</script>  <!-- nonce 없음 → 브라우저가 차단 -->
```

### 중요한 보안 요건

- **요청마다 새로운 nonce 생성**: 동일한 nonce를 재사용하면 공격자가 예측할 수 있다.
- **충분한 엔트로피**: 최소 128비트 (16바이트 랜덤)
- **nonce를 JS 변수로 노출 금지**: `window.__nonce__`처럼 JavaScript에서 접근 가능하게 두면 XSS로 탈취 가능하다.
- **캐시 안 됨**: `Cache-Control: no-store` 또는 CDN 설정으로 nonce가 포함된 HTML이 캐시되지 않도록 한다.

## Hash 방식

### 원리

스크립트 내용의 SHA256/SHA384/SHA512 해시를 CSP에 포함한다. 브라우저가 실제 스크립트 내용을 해시해 CSP의 값과 비교한다.

```bash
# 스크립트 해시 계산 (빌드 스크립트 또는 CLI)
echo -n "console.log('hello')" | openssl dgst -sha256 -binary | openssl enc -base64
```

```http
Content-Security-Policy: script-src 'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='
```

```html
<!-- 정확히 같은 내용이어야 함 (공백 포함) -->
<script>console.log('hello')</script>
```

### 언제 사용하나

Hash는 스크립트 내용이 빌드 시 결정되고 런타임에 변하지 않는 경우에 적합하다. Webpack, Vite 같은 번들러 플러그인이 자동으로 해시를 계산해 CSP 헤더를 생성해준다.

```javascript
// vite.config.ts (예시)
import { createHash } from 'crypto';

// 빌드 후 인라인 스크립트 해시를 자동 수집
const hashes = new Set<string>();
// ...build hook에서 hash 수집 후 CSP 헤더에 주입
```

동적 서버 사이드 렌더링에는 맞지 않다. 요청마다 내용이 달라지면 해시도 달라지기 때문이다.

## strict-dynamic

`'strict-dynamic'`은 nonce/hash로 신뢰된 스크립트가 동적으로 생성하는 스크립트도 신뢰하도록 허용한다:

```http
script-src 'nonce-abc123' 'strict-dynamic'
```

```javascript
// nonce 스크립트가 동적으로 생성한 스크립트는 자동 신뢰
const script = document.createElement('script');
script.src = 'https://external.cdn.com/lib.js'; // 출처 무관하게 허용
document.head.appendChild(script);
```

`'strict-dynamic'`이 활성화되면 URL 기반 허용 목록(`'self'`, 도메인 등)은 무시된다. React, Vue, Angular 같은 SPA 프레임워크가 번들 파일을 동적으로 로드하는 패턴에 필수적이다.

`'strict-dynamic'`을 지원하지 않는 구식 브라우저를 위한 폴백 정책을 함께 제공하는 것이 좋다:

```http
script-src 'nonce-{n}' 'strict-dynamic' 'unsafe-inline' https:;
```

`'strict-dynamic'`을 지원하는 브라우저는 `'unsafe-inline'`과 `https:`를 무시하고 nonce만 사용하므로 보안이 유지된다.

## 우회 기법과 방어

![CSP Nonce 우회 기법과 방어](/assets/posts/websec-csp-nonce-hash-bypass.svg)

**nonce 재사용**: 서버가 같은 nonce를 여러 응답에 사용하면 공격자가 기존 nonce를 포함한 스크립트를 삽입해 실행할 수 있다. 방어: 요청마다 새 nonce.

**DOM Clobbering**: id가 있는 HTML 요소로 DOM 속성을 덮어씌워 nonce를 탈취하는 기법. 방어: `nonce` 속성이 JavaScript에서 접근 불가능하도록 한다(최신 브라우저는 스크립트에서 `nonce` 속성 읽기를 빈 문자열로 반환).

**허용 도메인의 JSONP 악용**: `script-src cdn.example.com`이 있는데 `cdn.example.com`에 JSONP 엔드포인트가 있으면 우회 가능. 방어: `'strict-dynamic'` 사용(URL 기반 허용 목록 무효화).

## Next.js 실전 구현

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    default-src 'self';
    script-src 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' data: blob:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}
```

```tsx
// app/layout.tsx
import { headers } from 'next/headers';

export default function RootLayout({ children }) {
  const nonce = headers().get('x-nonce') ?? '';
  return (
    <html>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{
          __html: `window.__config__ = ${JSON.stringify(config)}`
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

**지난 글:** [콘텐츠 보안 정책(CSP): XSS의 마지막 방어선](/posts/websec-content-security-policy/)

**다음 글:** [Trusted Types: DOM XSS 방어의 새로운 표준](/posts/websec-trusted-types/)

<br>
읽어주셔서 감사합니다. 😊
