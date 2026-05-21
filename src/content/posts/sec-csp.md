---
title: "Content-Security-Policy — 인라인 스크립트 차단과 nonce 전략"
description: "CSP 헤더의 주요 디렉티브(default-src·script-src·connect-src·frame-ancestors)와 nonce·hash 방식의 인라인 스크립트 허용, Report-Only 모드로 배포 전 검증하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "CSP", "Content-Security-Policy", "nonce", "XSS방어", "HTTP헤더"]
featured: false
draft: false
---

[지난 글](/posts/sec-csrf-samesite/)에서 CSRF와 SameSite 쿠키를 살펴봤습니다. 이번에는 XSS를 포함한 여러 주입 공격의 **최후 방어선** 역할을 하는 Content-Security-Policy(CSP) 헤더를 깊게 파고듭니다.

## CSP가 하는 일

CSP는 브라우저에게 어떤 출처의 리소스를 실행·로드할 수 있는지 알려주는 HTTP 응답 헤더입니다. 공격자가 XSS를 통해 스크립트를 주입해도, CSP가 그 스크립트의 출처나 nonce를 검증해 실행을 막습니다.

인라인 스크립트(`<script>` 태그 내부), `eval()`, `javascript:` URL 같은 동적 코드 실행이 기본적으로 차단됩니다. 외부 CDN에서 스크립트를 로드하는 것도 명시적으로 허용한 출처만 가능합니다.

## 주요 디렉티브

![CSP 주요 디렉티브](/assets/posts/sec-csp-directives.svg)

디렉티브는 세미콜론으로 구분해 한 헤더에 나열합니다.

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}' 'strict-dynamic';
  style-src 'self' 'nonce-{RANDOM}';
  img-src 'self' data: https://cdn.example.com;
  connect-src 'self' https://api.example.com;
  font-src 'self' https://fonts.gstatic.com;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
```

`object-src 'none'`은 Flash·PDF 같은 플러그인을 차단합니다. `base-uri 'self'`는 `<base>` 태그를 통한 상대 URL 가로채기를 막습니다.

## nonce 방식 — 인라인 스크립트를 안전하게 허용

인라인 스크립트를 완전히 없애기 어려운 경우, **nonce**를 씁니다. 서버는 요청마다 암호학적으로 안전한 무작위값(nonce)을 생성해 헤더와 `<script>` 태그 양쪽에 넣습니다. 공격자가 XSS로 스크립트를 주입해도 nonce를 모르면 실행이 차단됩니다.

![CSP Nonce 동작 원리](/assets/posts/sec-csp-nonce.svg)

```js
// Express 예시 — 미들웨어에서 nonce 생성
import crypto from 'node:crypto';

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  res.setHeader(
    'Content-Security-Policy',
    `script-src 'self' 'nonce-${res.locals.nonce}' 'strict-dynamic'; object-src 'none';`
  );
  next();
});
```

템플릿에서 nonce를 스크립트 태그에 주입합니다.

```html
<!-- EJS 또는 Handlebars 예시 -->
<script nonce="<%= nonce %>">
  // 이 스크립트만 실행됨
  initApp();
</script>
```

nonce는 **요청마다 달라져야** 합니다. 고정값을 쓰면 공격자가 추측할 수 있습니다.

## strict-dynamic — 동적 스크립트 로딩

SPA는 번들된 스크립트가 동적으로 다른 스크립트를 로드하는 경우가 많습니다. `'strict-dynamic'`을 쓰면 nonce가 있는 스크립트가 생성한 `<script>` 요소도 신뢰합니다.

```http
script-src 'nonce-ABC' 'strict-dynamic'
```

이 설정에서는 nonce가 있는 스크립트만 신뢰하고, 그 스크립트가 `document.createElement('script')`로 추가한 스크립트도 신뢰됩니다. 반면 인라인 이벤트 핸들러나 `javascript:` URL은 차단됩니다.

## hash 방식 — 정적 인라인 스크립트

인라인 스크립트 내용이 변하지 않는다면, 그 내용의 SHA-256 해시를 CSP에 명시하는 방법도 있습니다.

```js
// 허용할 스크립트 내용의 SHA-256 해시 계산
const script = "console.log('hello');";
const hash = crypto.createHash('sha256').update(script).digest('base64');
// → 헤더에: script-src 'sha256-{hash}'
```

빌드 도구(webpack·vite)가 해시를 자동 계산해주는 플러그인도 있습니다.

## Report-Only 모드 — 배포 전 검증

CSP를 바로 적용하면 의도치 않은 리소스가 차단되어 앱이 깨질 수 있습니다. `Content-Security-Policy-Report-Only` 헤더를 먼저 써서 **차단하지는 않고 위반 보고만** 받을 수 있습니다.

```http
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' 'nonce-ABC';
  report-uri /csp-violations;
```

위반 시 브라우저가 `/csp-violations`에 JSON을 POST합니다. 이를 며칠간 모니터링해 정책을 조정한 후 실제 CSP로 전환하는 것이 권장 배포 전략입니다.

```js
// 위반 보고 수신 엔드포인트
app.post('/csp-violations', express.json({ type: 'application/csp-report' }),
  (req, res) => {
    const report = req.body['csp-report'];
    console.log('CSP violation:', report['blocked-uri'], report['violated-directive']);
    res.status(204).end();
  }
);
```

## unsafe-inline과 unsafe-eval — 피해야 할 키워드

`'unsafe-inline'`을 `script-src`에 추가하면 인라인 스크립트가 모두 허용되어 CSP의 XSS 방어 효과가 사라집니다. `'unsafe-eval'`은 `eval()`과 `new Function()` 실행을 허용합니다. 레거시 코드 때문에 어쩔 수 없다면, nonce나 hash 방식으로 점진적으로 교체하는 것이 바람직합니다.

## 프레임워크별 CSP 지원

| 프레임워크/도구 | CSP 지원 방식 |
|---|---|
| Next.js | `next.config.js`의 `headers()`로 설정 |
| Nuxt | `nuxt.config.ts`의 `security.headers` |
| Vite | 플러그인 또는 서버 미들웨어 |
| Helmet (Express) | `helmet.contentSecurityPolicy()` |

Next.js 13+ App Router는 서버 컴포넌트에서 nonce를 `generateStaticParams`나 미들웨어로 생성해 전파하는 패턴을 공식 문서에서 안내합니다.

## 정리

CSP는 XSS의 마지막 방어벽입니다. `default-src 'self'`를 기본으로 `script-src`에 nonce 또는 hash를 추가하고, `object-src 'none'`과 `base-uri 'self'`를 반드시 포함시킵니다. Report-Only로 정책을 검증한 뒤 실제 적용하는 단계적 접근이 안전합니다. 다음 글에서는 CORS를 심층적으로 다룹니다.

---

**지난 글:** [CSRF와 SameSite 쿠키 — 사이트 간 요청 위조 방어](/posts/sec-csrf-samesite/)

**다음 글:** [CORS 심층 분석 — 프리플라이트와 자격증명 요청](/posts/sec-cors-deep/)

<br>
읽어주셔서 감사합니다. 😊
