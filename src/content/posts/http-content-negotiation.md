---
title: "HTTP 콘텐츠 협상(Content Negotiation) 완전 정복"
description: "HTTP 콘텐츠 협상의 4가지 차원(미디어 타입·언어·인코딩·charset), q-factor 우선순위 계산, Vary 헤더와 캐시 연동까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["콘텐츠협상", "ContentNegotiation", "Accept헤더", "qfactor", "Vary헤더", "HTTP협상"]
featured: false
draft: false
---

[지난 글](/posts/http-content-type-mime/)에서 MIME 타입과 Content-Type 헤더를 살펴봤다. 이번 글에서는 클라이언트와 서버가 **어떤 형식, 언어, 인코딩으로 통신할지 협의**하는 콘텐츠 협상(Content Negotiation) 메커니즘을 완전히 해설한다.

## 콘텐츠 협상이란

같은 URL이 다양한 표현(representation)을 가질 수 있다. 예를 들어 `/document`는 영어 HTML, 한국어 HTML, JSON, PDF 등 여러 형태로 제공될 수 있다. 클라이언트가 자신이 원하는 형태를 서버에 알리고, 서버가 최적의 표현을 선택해 반환하는 과정이 **콘텐츠 협상**이다.

콘텐츠 협상은 4가지 차원에서 이루어진다.

| 차원 | 요청 헤더 | 응답 헤더 |
|------|-----------|-----------|
| 미디어 타입 | `Accept` | `Content-Type` |
| 자연 언어 | `Accept-Language` | `Content-Language` |
| 전송 인코딩 | `Accept-Encoding` | `Content-Encoding` |
| 문자셋 (폐기 예정) | `Accept-Charset` | `Content-Type; charset=` |

![콘텐츠 협상 흐름](/assets/posts/http-content-negotiation-flow.svg)

## 서버 주도 협상 (Server-Driven)

가장 일반적인 방식이다. 클라이언트가 Accept-* 헤더로 선호도를 전달하고, 서버가 알고리즘으로 최적 표현을 선택한다.

```http
GET /article/42 HTTP/1.1
Host: api.example.com
Accept: text/html, application/json;q=0.9, */*;q=0.5
Accept-Language: ko-KR, ko;q=0.9, en-US;q=0.8
Accept-Encoding: gzip, br;q=0.9

HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Language: ko
Content-Encoding: gzip
Vary: Accept, Accept-Language, Accept-Encoding
```

서버가 모든 조건을 만족하는 표현을 찾지 못하면 **406 Not Acceptable**을 반환한다. 실무에서는 기본 표현(기본 언어 영어, 기본 형식 HTML)으로 폴백하는 경우가 많다.

### Vary 헤더의 중요성

`Vary` 헤더는 캐시 시스템에 **어떤 요청 헤더가 응답에 영향을 미치는지** 알린다.

```http
Vary: Accept-Encoding
Vary: Accept-Language
Vary: Accept, Accept-Language, Accept-Encoding
```

`Vary: Accept-Encoding`이 있으면 캐시는 같은 URL에 대해 `Accept-Encoding: gzip`과 `Accept-Encoding: br`을 **다른 캐시 키**로 취급해 별도 응답을 저장한다.

Vary 헤더가 없으면 캐시는 첫 번째 응답을 모든 클라이언트에게 반환할 수 있어, 영어 사용자에게 한국어 페이지가 내려갈 수 있다.

```
Vary: *   # 이 응답은 절대 캐시 불가
```

`Vary: *`는 모든 요청이 고유하다고 선언해 캐시를 완전히 무력화한다. 피해야 한다.

## q-factor (Quality Value)

q-factor는 각 선호도의 **우선순위**를 0.0~1.0 사이 값으로 표현한다. 생략하면 기본값 1.0이다.

![q-factor 우선순위](/assets/posts/http-content-negotiation-qvalue.svg)

```http
Accept: text/html;q=1.0, application/xhtml+xml;q=0.9, */*;q=0.5
Accept-Language: ko-KR;q=1.0, ko;q=0.9, en-US;q=0.8, en;q=0.7
Accept-Encoding: gzip;q=1.0, br;q=0.9, deflate;q=0.5, identity;q=0.1
```

q=0은 해당 표현을 **명시적으로 거부**한다. `identity;q=0`은 무압축 응답을 거부한다는 뜻이다.

동일한 q 값이면 **더 구체적인 타입이 우선**이다. `text/html`(q=1.0)과 `text/*`(q=1.0)이 동시에 있으면 `text/html`이 더 구체적이므로 우선된다.

## 클라이언트 주도 협상 (Reactive Negotiation)

서버가 여러 가능한 표현 목록을 `300 Multiple Choices`로 반환하면, 클라이언트가 직접 하나를 선택해 재요청한다. 이론적으로 정의됐지만 실제로는 거의 쓰이지 않는다.

```http
HTTP/1.1 300 Multiple Choices
Content-Type: text/html
Link: </article.en.html>; hreflang="en"; title="English version"
Link: </article.ko.html>; hreflang="ko"; title="Korean version"
```

## 투명 협상 (Transparent Negotiation)

중간 캐시가 서버 주도와 클라이언트 주도를 결합해 협상을 수행하는 방식이다. RFC 2295에서 정의됐지만 실제 구현체가 없어 사실상 폐기됐다.

## Accept-Encoding과 압축

현대 웹에서 가장 많이 쓰이는 협상 차원이다. 전송 크기를 크게 줄인다.

```http
Accept-Encoding: gzip, deflate, br, zstd
```

| 알고리즘 | 압축률 | 속도 | 비고 |
|---------|--------|------|------|
| gzip | 보통 | 빠름 | 가장 범용, RFC 1952 |
| deflate | 보통 | 매우 빠름 | 실제 구현이 zlib로 다름 |
| br (Brotli) | 높음 | 보통 | HTTPS 전용, 구글 개발 |
| zstd (Zstandard) | 높음 | 매우 빠름 | Facebook 개발, 최신 |

```python
# Python으로 Brotli 응답 처리
import brotli
import requests

response = requests.get(
    'https://api.example.com/data',
    headers={'Accept-Encoding': 'br, gzip'}
)
# requests 라이브러리가 자동으로 압축 해제
data = response.json()
```

## Accept-Language와 다국어

```http
Accept-Language: ko-KR, ko;q=0.9, en-US;q=0.8, en;q=0.7
```

언어 태그는 BCP 47 표준을 따른다. `ko-KR`은 한국에서 쓰는 한국어, `ko`는 지역 무관 한국어다. `*`는 모든 언어를 허용한다.

```javascript
// 브라우저의 언어 설정에 따라 자동 생성
// 사용자가 브라우저를 한국어로 설정하면:
// Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7

// Node.js Express에서 언어 협상
const acceptLanguage = require('accept-language');
acceptLanguage.languages(['en', 'ko', 'ja']);

app.use((req, res, next) => {
  const lang = acceptLanguage.get(req.headers['accept-language']);
  req.locale = lang; // 'ko', 'en', or 'ja'
  next();
});
```

## 협상 실패와 에러 처리

```http
# 서버가 JSON만 지원하는데 클라이언트가 XML만 요청
GET /api/data HTTP/1.1
Accept: application/xml

HTTP/1.1 406 Not Acceptable
Content-Type: application/json
{
  "error": "Not Acceptable",
  "supported": ["application/json", "text/html"]
}
```

실무 권장: 406보다는 **기본 형식으로 폴백**하는 편이 사용자 경험에 좋다. API에서는 `application/json`을 기본값으로, 웹에서는 `text/html`을 기본값으로 반환한다.

## Client Hints

전통적인 Accept-* 헤더 외에, 최근에는 **Client Hints**라는 새로운 프레임워크가 등장했다.

```http
# 서버가 클라이언트에게 힌트를 요청
Accept-CH: Viewport-Width, DPR, ECT

# 이후 클라이언트가 전송
Viewport-Width: 1280
DPR: 2
ECT: 4g
Save-Data: on
```

Client Hints는 이미지 크기, 해상도, 네트워크 품질 등 세밀한 정보를 기반으로 최적화된 콘텐츠를 제공할 수 있다. 단, 반드시 HTTPS에서만 작동한다.

---

**지난 글:** [Content-Type과 MIME 타입 완전 정복](/posts/http-content-type-mime/)

**다음 글:** [Accept 헤더 패밀리 완전 해설](/posts/http-accept-headers/)

<br>
읽어주셔서 감사합니다. 😊
