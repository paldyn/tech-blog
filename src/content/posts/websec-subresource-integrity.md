---
title: "서브리소스 무결성(SRI): CDN 공급망 공격 방어"
description: "CDN에서 로드하는 JS·CSS 파일이 변조되어도 브라우저가 차단하도록 integrity 해시를 사용하는 SRI 원리, 구현 방법, crossorigin 속성, 해시 생성 자동화를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["SRI", "서브리소스무결성", "CDN", "공급망공격", "브라우저보안", "해시검증"]
featured: false
draft: false
---

[지난 글](/posts/websec-clickjacking/)에서 클릭재킹을 막는 frame-ancestors와 X-Frame-Options를 살펴봤다. 이번 글에서는 CDN을 통해 로드하는 외부 리소스의 무결성을 보장하는 **서브리소스 무결성(Subresource Integrity, SRI)**을 다룬다. CDN이 해킹되어 파일이 변조되어도 브라우저가 스스로 차단할 수 있다.

## CDN을 통한 공급망 공격

많은 웹사이트가 jQuery, Bootstrap, 폰트 등을 CDN에서 로드한다.

```html
<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js"></script>
```

이 코드는 편리하지만 심각한 보안 위험을 내포한다. CDN 제공자의 계정이 탈취되거나 서버가 침해되면 공격자가 파일 내용을 수정할 수 있다. 수십만 개 사이트가 같은 URL을 참조하므로, 파일 하나를 변조하면 엄청난 규모의 공격이 가능하다.

2016년 실제로 여러 CDN에서 이런 사건이 발생했다. 악성 jQuery 파일이 배포되어 카드 스키머 코드가 삽입됐다.

## SRI 동작 원리

![서브리소스 무결성(SRI) 동작 원리](/assets/posts/websec-sri-mechanism.svg)

SRI는 간단하다. 개발자가 원본 파일의 암호학적 해시값을 미리 계산해 HTML 태그의 `integrity` 속성에 기록한다. 브라우저는 파일을 다운로드한 후 해시를 직접 계산해 비교한다. 불일치하면 리소스를 실행하지 않고 차단한다.

![공급망 공격: SRI 없을 때 vs 있을 때](/assets/posts/websec-sri-supply-chain.svg)

## 구현 방법

```html
<!-- SRI 적용 예시 -->
<script
  src="https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js"
  integrity="sha384-NXgwF8Kv9SSAr+jemKKcbvQsz+teULH/a5UNJvZc6kP47hZgl62M1vGnw68WSBB"
  crossorigin="anonymous">
</script>

<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
  integrity="sha384-GLhlTQ8iRABdZLl6O3oVMWSktQA4nS8dSjH40ZVFKZH3B7/awNr3GWvJQWZVG1z"
  crossorigin="anonymous">
```

### integrity 속성 형식

```
integrity="<알고리즘>-<Base64 인코딩된 해시>"
```

- **알고리즘**: `sha256`, `sha384`(권장), `sha512`
- 여러 해시를 공백으로 구분해 지정 가능 (브라우저가 지원하는 알고리즘 사용)

```html
integrity="sha256-abc... sha384-def..."
```

### crossorigin 속성 필수

`integrity`와 함께 반드시 `crossorigin` 속성을 지정해야 한다. 없으면 브라우저가 CORS 모드로 파일을 가져오지 않아 해시 검증이 불가능하다.

```html
crossorigin="anonymous"      <!-- 쿠키 없이 요청 (대부분의 경우) -->
crossorigin="use-credentials" <!-- 인증 포함 (거의 안 씀) -->
```

## 해시 생성 방법

### 명령줄 생성

```bash
# 파일을 직접 해시
cat jquery.min.js | openssl dgst -sha384 -binary | openssl base64 -A

# curl로 다운로드 후 해시
curl -s https://cdn.jsdelivr.net/npm/jquery@3.7.0/dist/jquery.min.js \
  | openssl dgst -sha384 -binary \
  | openssl base64 -A
```

### 빌드 자동화 (Webpack)

```javascript
// webpack.config.js
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

module.exports = {
  output: {
    crossOriginLoading: 'anonymous',
  },
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ['sha256', 'sha384'],
      enabled: process.env.NODE_ENV === 'production',
    }),
  ],
};
```

### 온라인 도구

[srihash.org](https://www.srihash.org/)에 URL을 입력하면 integrity 속성값을 즉시 생성해준다.

## 주의사항

### 파일이 변경되면 해시도 변경된다

CDN 라이브러리를 버전업하면 새 파일의 해시를 다시 계산해 HTML을 업데이트해야 한다.

```html
<!-- v3.7.0 → v3.7.1로 업그레이드 시 해시 값 변경됨 -->
<script
  src="https://cdn.jsdelivr.net/.../jquery@3.7.1/dist/jquery.min.js"
  integrity="<새로운 해시값>"
  crossorigin="anonymous">
</script>
```

패키지 관리자와 연동해 이 과정을 자동화하면 좋다.

### CSP와 함께 사용

SRI를 적용한 외부 스크립트라도 CSP로 허용된 오리진인지 함께 확인하는 것이 좋다.

```http
Content-Security-Policy:
  script-src 'self'
             cdn.jsdelivr.net
             'sha384-<해시>'
```

### fallback 전략

SRI 실패 시 CDN 파일이 로드되지 않으면 사이트 기능이 깨질 수 있다. 중요한 라이브러리는 자체 서버에도 복사본을 두고 오류 이벤트 시 로드하는 fallback을 준비한다.

```html
<script
  src="https://cdn.example.com/jquery.min.js"
  integrity="sha384-..."
  crossorigin="anonymous"
  onerror="this.remove(); document.write('<script src=/local/jquery.min.js><\/script>')">
</script>
```

## 보안 체크리스트

| 항목 | 설명 |
|---|---|
| 외부 CDN 리소스 | 모두 integrity 속성 추가 |
| 알고리즘 | sha384 이상 권장 |
| crossorigin 속성 | integrity와 함께 반드시 지정 |
| 라이브러리 업데이트 | 해시 재생성 및 업데이트 |
| 빌드 파이프라인 | SRI 해시 자동 생성 플러그인 연동 |

---

**지난 글:** [클릭재킹: 보이지 않는 레이어의 함정](/posts/websec-clickjacking/)

**다음 글:** [HTTP 보안 헤더 완전 가이드](/posts/websec-security-headers/)

<br>
읽어주셔서 감사합니다. 😊
