---
title: "Accept 헤더 패밀리 완전 해설 — Accept, Accept-Language, Accept-Encoding"
description: "HTTP Accept 헤더 패밀리의 문법, q-factor 우선순위 계산 규칙, 서버 측 처리 패턴, Accept-Charset 폐기 배경까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["Accept헤더", "AcceptLanguage", "AcceptEncoding", "AcceptCharset", "qfactor", "HTTP협상헤더"]
featured: false
draft: false
---

[지난 글](/posts/http-content-negotiation/)에서 콘텐츠 협상의 전체 흐름을 이해했다. 이번 글에서는 협상의 주체인 **Accept 헤더 패밀리** 각각의 문법, 동작, 실무 처리 방법을 하나씩 완전히 해설한다.

## Accept 헤더

Accept 헤더는 클라이언트가 처리 가능한 **미디어 타입의 목록과 선호도**를 서버에 전달한다.

```
Accept: type/subtype [;q=0.x], ...
```

![Accept 헤더 패밀리](/assets/posts/http-accept-headers-family.svg)

### 문법 규칙

```http
# 단일 타입
Accept: application/json

# 여러 타입 (쉼표 구분)
Accept: text/html, application/xhtml+xml, application/json;q=0.9, */*;q=0.8

# 와일드카드
Accept: text/*              # text 계열 모두
Accept: */*                 # 모든 타입 (기본값)
Accept: image/webp, */*;q=0.8   # webp 우선, 나머지도 OK

# 특정 타입 거부
Accept: text/html, application/json;q=0, */*;q=0.5
```

`*/*`는 "어떤 미디어 타입이든 수락"이다. 브라우저는 보통 이 값을 폴백으로 포함해 서버가 지원 가능한 최선의 형식을 반환할 수 있게 한다.

### 서버 측 처리

```python
# Python Flask에서 Accept 헤더 처리
from flask import Flask, request, jsonify
from werkzeug.exceptions import NotAcceptable

app = Flask(__name__)

@app.route('/api/data')
def get_data():
    best = request.accept_mimetypes.best_match(
        ['application/json', 'text/html']
    )
    
    if best == 'application/json':
        return jsonify({'key': 'value'})
    elif best == 'text/html':
        return '<html><body>data</body></html>', 200, \
               {'Content-Type': 'text/html'}
    else:
        raise NotAcceptable()
```

`best_match()` 함수는 q-factor와 명시성 규칙을 고려해 최적 타입을 반환한다.

## Accept-Language 헤더

사용자가 선호하는 **자연 언어(human language)**를 전달한다.

```http
Accept-Language: ko-KR, ko;q=0.9, en-US;q=0.8, en;q=0.7
```

### 언어 태그 (BCP 47)

```
ko            # 한국어
ko-KR         # 대한민국 한국어  
ko-KP         # 북한 한국어
zh-Hans       # 간체 중국어
zh-Hant-TW    # 대만 번체 중국어
en-US         # 미국 영어
en-GB         # 영국 영어
```

서브태그는 세분화될수록 구체적이다. 서버는 `ko-KR`을 지원하지 않으면 `ko`로, `ko`도 없으면 기본 언어로 폴백하는 로직을 구현해야 한다.

### 실무 처리 예시

```javascript
// Node.js에서 i18n 미들웨어
const i18next = require('i18next');
const i18nextHttpMiddleware = require('i18next-http-middleware');

i18next
  .use(i18nextHttpMiddleware.LanguageDetector)
  .init({
    detection: {
      order: ['header', 'querystring', 'cookie'],
      lookupHeader: 'accept-language',
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ko', 'ja'],
    resources: { /* translations */ }
  });

app.use(i18nextHttpMiddleware.handle(i18next));
app.get('/page', (req, res) => {
  res.json({ message: req.t('hello') });
});
```

## Accept-Encoding 헤더

전송 시 **압축 알고리즘** 선호도를 전달한다. 대역폭 절약에 직결되는 중요 헤더다.

```http
Accept-Encoding: gzip, deflate, br, zstd
Accept-Encoding: br;q=1.0, gzip;q=0.8, *;q=0.1
Accept-Encoding: identity   # 압축 없이 요청
Accept-Encoding: *;q=0      # 어떤 인코딩도 거부 (드묾)
```

### 알고리즘 비교

```bash
# 같은 파일을 다른 알고리즘으로 압축 비교
original: 100KB (index.html)

gzip -9:   25KB (75% 절감)  # zlib 기반
brotli -q11: 22KB (78% 절감) # 사전 압축 최적화
zstd -19:  23KB (77% 절감)  # 고속+고압축
```

### 서버에서의 설정

```nginx
# Nginx: gzip + brotli
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1024;
gzip_comp_level 6;

brotli on;
brotli_types text/plain text/css application/json application/javascript;
brotli_comp_level 6;
```

```python
# Python: 응답 압축 (starlette/FastAPI)
from starlette.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=500)
```

## Accept-Charset 헤더 (사실상 폐기)

문자셋 선호도를 전달하기 위해 정의됐으나, UTF-8의 보편화로 사실상 **사용되지 않는다.**

```http
Accept-Charset: utf-8, iso-8859-1;q=0.5
```

Chrome 44+ 이후 브라우저들은 이 헤더 전송을 중단했다. RFC 7231은 Accept-Charset을 더 이상 권장하지 않는다. Content-Type의 charset 파라미터로 충분하기 때문이다.

## 우선순위 계산 상세

![협상 우선순위 선택 예시](/assets/posts/http-accept-headers-negotiation.svg)

q-factor 외에 **명시성(specificity)** 도 고려된다.

```
우선순위 결정 (높을수록 우선):
1. q 값이 높을수록 우선 (0.0 ~ 1.0)
2. 동일 q 값이면 더 구체적인 타입 우선
   text/html > text/* > */*
3. 명시적 타입 > 와일드카드 타입
```

```
예시: Accept: text/html;q=0.9, */*;q=1.0
→ */*의 q가 더 높지만, text/html이 더 구체적
→ text/html 요청이 있을 때 서버가 HTML을 지원한다면 HTML 반환
```

실제로 RFC 7231 §5.3.2는 이 규칙을 명확히 정의한다. 서버 라이브러리는 이 규칙을 자동으로 처리하므로 직접 구현할 필요는 거의 없다.

## 실무 패턴

### API 버전 협상

Accept 헤더로 API 버전을 협상하는 패턴이다.

```http
# GitHub API 스타일
Accept: application/vnd.github.v3+json
Accept: application/vnd.github+json; version=3

# 버전별 응답
Content-Type: application/vnd.github.v3+json
```

```python
# FastAPI로 버전 협상 구현
from fastapi import Header, HTTPException

@app.get("/api/users")
async def get_users(accept: str = Header("application/json")):
    if "vnd.myapi.v2" in accept:
        return {"version": 2, "users": [...]}
    else:
        return {"version": 1, "users": [...]}
```

### 조건부 콘텐츠

```http
GET /image HTTP/1.1
Accept: image/webp, image/avif, image/*;q=0.8

# 서버가 WebP 지원하면
HTTP/1.1 200 OK
Content-Type: image/webp
Vary: Accept
```

Vary 헤더를 포함해야 CDN이 Accept에 따라 다른 응답을 캐시한다.

---

**지난 글:** [HTTP 콘텐츠 협상(Content Negotiation) 완전 정복](/posts/http-content-negotiation/)

**다음 글:** [HTTP 쿠키 완전 정복 — Set-Cookie와 Cookie 헤더](/posts/http-cookies/)

<br>
읽어주셔서 감사합니다. 😊
