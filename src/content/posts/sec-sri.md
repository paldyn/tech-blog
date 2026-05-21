---
title: "SRI — 서브리소스 무결성 검증"
description: "Subresource Integrity(SRI)의 동작 원리, integrity 속성과 crossorigin 설정, SHA-256·SHA-384 해시 생성 방법, 빌드 도구 연동, CSP와의 조합까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "SRI", "서브리소스무결성", "CDN", "공급망공격", "integrity"]
featured: false
draft: false
---

[지난 글](/posts/sec-cors-deep/)에서 CORS의 동작 원리와 서버 구현 방법을 살펴봤습니다. 이번에는 외부 CDN에서 로드하는 스크립트나 스타일시트가 변조되지 않았음을 보장하는 **SRI(Subresource Integrity)** 를 다룹니다.

## 공급망 공격이란

CDN에서 jQuery나 Bootstrap 같은 라이브러리를 직접 불러오는 사이트가 많습니다. 그런데 CDN이 해킹당하거나 BGP 하이재킹으로 트래픽이 악성 서버로 우회된다면, 수백만 사이트에 악성 코드가 배포될 수 있습니다. 이런 공격을 **공급망 공격(Supply Chain Attack)**이라고 합니다.

실제로 2018년 Magecart 그룹은 서드파티 스크립트를 변조해 수천 개의 쇼핑 사이트에서 신용카드 정보를 탈취했습니다.

## SRI 동작 원리

![SRI — 서브리소스 무결성 동작 원리](/assets/posts/sec-sri-flow.svg)

SRI는 `<script>` 또는 `<link>` 태그의 `integrity` 속성에 리소스의 **암호학적 해시**를 명시하는 메커니즘입니다. 브라우저가 리소스를 다운로드한 후 실제 내용의 해시를 계산해 `integrity` 값과 비교합니다. 불일치하면 리소스를 실행·적용하지 않습니다.

```html
<!-- SRI 없음 — CDN 파일이 변조되면 악성 코드 실행 -->
<script src="https://cdn.example.com/jquery.min.js"></script>

<!-- SRI 있음 — 해시 불일치 시 차단 -->
<script
  src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"
  integrity="sha384-1H217gwSVyLSIfaLxHbE7dRb3v4mYCKbpQvzx0cegeju1MVsGrX5xXxAvs/HgeFs"
  crossorigin="anonymous">
</script>
```

`crossorigin="anonymous"` 속성이 없으면 브라우저가 CORS 모드 없이 요청을 보내고, 응답에 CORS 헤더가 없어 SRI 검증을 수행할 수 없습니다. CDN이 CORS를 지원해야 SRI가 동작합니다.

## 해시 생성

지원 알고리즘은 SHA-256, SHA-384, SHA-512입니다. SHA-384가 균형상 권장됩니다.

![SRI 해시 생성 — Node.js 스크립트](/assets/posts/sec-sri-build.svg)

터미널에서 간단히 생성하는 방법입니다.

```bash
# openssl로 생성
openssl dgst -sha384 -binary jquery.min.js | openssl base64 -A
# 결과: oqVuAfXRKap7fdgcCY5...

# 접두사 붙여서 integrity 값 완성
echo "sha384-$(openssl dgst -sha384 -binary jquery.min.js | openssl base64 -A)"
```

`integrity` 속성에는 `알고리즘-base64값` 형식으로 입력합니다. 공백으로 구분해 여러 알고리즘을 동시에 지정할 수도 있습니다.

```html
<!-- 여러 해시 지정 — 브라우저가 지원하는 강한 알고리즘 사용 -->
<script
  src="..."
  integrity="sha256-xxx sha384-yyy sha512-zzz"
  crossorigin="anonymous">
</script>
```

## 빌드 도구 연동

자체 번들을 CDN에 올리는 경우 빌드 시 자동으로 해시를 생성해 HTML에 삽입하는 방식이 실용적입니다.

```js
// vite.config.js — vite-plugin-html로 SRI 자동 삽입
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePluginSubresourceIntegrity } from 'vite-plugin-sri';

export default {
  plugins: [
    createHtmlPlugin(),
    VitePluginSubresourceIntegrity({ algorithms: ['sha384'] }),
  ],
};
```

webpack에서는 `webpack-subresource-integrity` 플러그인이 같은 역할을 합니다.

## CSP와 함께 사용

CSP의 `script-src` 디렉티브에 `'sha384-...'` 형태로 해시를 명시하면, `<script>` 태그의 `integrity` 없이도 브라우저가 스크립트를 해시로 검증합니다. SRI와 CSP를 병행하면 두 겹의 방어가 됩니다.

```http
Content-Security-Policy:
  script-src 'self'
    'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC'
    https://cdn.jsdelivr.net;
```

## SRI의 한계

SRI는 리소스 **내용**의 무결성만 보장합니다. 다음은 막지 못합니다.

- 원본 서버 자체가 악성 코드를 배포하는 경우(첫 배포 시 해시가 같음)
- DNS 탈취로 원본 URL이 가리키는 서버를 교체하는 경우(SRI 없는 경우만)
- 동적으로 생성되는 리소스(서버가 요청마다 다른 내용 반환)

따라서 SRI는 외부 **고정 파일** 리소스에 적합하고, 동적 API 응답에는 적용할 수 없습니다.

## 실용 가이드

1. 외부 CDN에서 불러오는 모든 `<script>`·`<link rel="stylesheet">`에 `integrity` 추가
2. jsDelivr, unpkg, cdnjs 등 주요 CDN은 파일 페이지에서 integrity 값을 제공
3. 자체 빌드 파일은 빌드 시 해시 자동 생성 플러그인 사용
4. `crossorigin="anonymous"` 누락 주의 — SRI가 조용히 실패함

## 정리

SRI는 CDN 공급망 공격에 대한 저비용 고효율 방어책입니다. `integrity` 속성 한 줄로 수십만 사용자를 지키는 효과를 낼 수 있습니다. 다음 글에서는 쿠키 보안 속성인 HttpOnly·Secure·SameSite를 자세히 정리합니다.

---

**지난 글:** [CORS 심층 분석 — 프리플라이트와 자격증명 요청](/posts/sec-cors-deep/)

**다음 글:** [쿠키 보안 — HttpOnly·Secure·SameSite·__Host 접두사](/posts/sec-cookies-httponly-secure/)

<br>
읽어주셔서 감사합니다. 😊
