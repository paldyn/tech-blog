---
title: "Content-Type과 MIME 타입 완전 정복"
description: "HTTP Content-Type 헤더의 구조, MIME 타입 분류 체계, charset·boundary 파라미터 활용, MIME 스니핑 방지까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["ContentType", "MIME", "미디어타입", "charset", "boundary", "MIMEsniffing"]
featured: false
draft: false
---

[지난 글](/posts/http-header-categories/)에서 HTTP 헤더의 4가지 분류를 살펴봤다. 이번 글에서는 표현 헤더 중 가장 기본이 되는 **Content-Type과 MIME 타입 체계**를 깊이 파고든다. Content-Type은 "이 메시지 본문이 어떤 형식인가"를 선언하는 핵심 메타데이터다.

## MIME란 무엇인가

MIME(Multipurpose Internet Mail Extensions)는 원래 이메일에서 ASCII 외의 데이터를 전송하기 위해 1992년 RFC 1341에서 정의됐다. 이후 HTTP가 이를 채택해 메시지 본문의 미디어 타입을 명시하는 표준으로 자리 잡았다.

MIME 타입의 구조는 **type/subtype[;parameter=value]** 형식이다.

```
text/html; charset=utf-8
  │    │           └─ 파라미터: charset=utf-8
  │    └── 하위 타입: html
  └────── 상위 타입: text
```

상위 타입은 큰 분류를 나타내고, 하위 타입은 구체적인 형식을 나타낸다. 세미콜론 뒤의 파라미터는 추가 정보를 제공한다.

## MIME 타입 분류

![MIME 타입 구조와 분류](/assets/posts/http-content-type-mime-types.svg)

### text 타입

사람이 읽을 수 있는 텍스트 데이터다. charset 파라미터로 문자 인코딩을 명시한다.

```
text/html; charset=utf-8      # HTML 문서
text/css                       # CSS 스타일시트
text/javascript                # JavaScript (ECMAScript)
text/plain; charset=utf-8     # 순수 텍스트
text/csv                       # 콤마 구분 값
text/xml; charset=utf-8       # XML 텍스트
```

`text/*` 타입에서 charset을 생략하면 기본값이 **ISO-8859-1**이다. 이는 한국어 등 멀티바이트 문자를 깨뜨릴 수 있으므로, 항상 `charset=utf-8`을 명시하는 게 좋다.

### application 타입

애플리케이션 특화 바이너리 또는 구조화 데이터다.

```
application/json               # JSON 데이터
application/xml                # XML 데이터 (파서 필요)
application/pdf                # PDF 문서
application/zip                # ZIP 압축 파일
application/octet-stream       # 임의 바이너리 (기본값)
application/x-www-form-urlencoded  # HTML 폼 데이터
application/javascript         # JavaScript (구형)
```

`application/octet-stream`은 "알 수 없는 바이너리"를 뜻한다. 서버가 적절한 타입을 모를 때 폴백으로 사용한다. 브라우저는 이 타입을 받으면 파일 다운로드로 처리한다.

### multipart 타입

여러 파트를 하나의 본문에 묶는다. 파트 구분에 boundary 파라미터를 사용한다.

```http
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="username"

john
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="avatar"; filename="photo.jpg"
Content-Type: image/jpeg

[바이너리 데이터]
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

boundary 문자열은 본문 어디에도 등장하지 않는 고유 문자열이어야 한다. 파트의 끝에 `--boundary--` 형태로 종료 신호를 보낸다.

`multipart/byteranges`는 Range 요청에 대한 응답에서 여러 범위를 한 응답에 담을 때 쓴다.

## Content-Type 파라미터

### charset 파라미터

문자 인코딩을 지정한다. 텍스트 기반 미디어 타입에 사용한다.

```http
Content-Type: text/html; charset=utf-8
Content-Type: text/plain; charset=windows-1252
Content-Type: application/json; charset=utf-8
```

JSON의 경우 RFC 4627은 UTF-8, UTF-16, UTF-32를 허용했고 UTF-8을 권장했다. RFC 7159(현 8259)는 아예 **UTF-8만 허용**하도록 강화했다. 실무에서는 charset을 명시하든 안 하든 JSON은 항상 UTF-8로 인코딩해야 한다.

### boundary 파라미터

multipart 타입에서 파트 경계를 구분하는 문자열이다.

```python
import uuid

boundary = f'boundary-{uuid.uuid4().hex}'
headers = {
    'Content-Type': f'multipart/form-data; boundary={boundary}'
}
```

boundary는 최대 70자, ASCII 가시 문자(공백 제외)로 구성한다.

## Content-Type 활용 패턴

![Content-Type 헤더 활용](/assets/posts/http-content-type-mime-header.svg)

### REST API에서의 Content-Type

```python
# FastAPI 예시
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/api/data")
async def create_data(request: Request):
    content_type = request.headers.get('content-type', '')
    
    if 'application/json' in content_type:
        data = await request.json()
    elif 'application/x-www-form-urlencoded' in content_type:
        data = await request.form()
    elif 'multipart/form-data' in content_type:
        form = await request.form()
        files = form.getlist('files')
    else:
        return JSONResponse(
            {'error': 'Unsupported Media Type'}, 
            status_code=415
        )
    
    return {'received': True}
```

서버가 지원하지 않는 Content-Type을 수신하면 **415 Unsupported Media Type**을 반환한다.

### 다운로드 강제

```http
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="report.pdf"
```

`application/octet-stream`으로 타입을 설정하면 브라우저는 렌더링 대신 다운로드 대화상자를 보여준다. `Content-Disposition: attachment`와 조합하면 더 명확하다.

## MIME 타입 스니핑

브라우저는 서버가 잘못된 Content-Type을 보내거나 생략했을 때 본문 내용을 분석해 타입을 추론하는 **MIME 스니핑**을 한다. 이는 편의성을 높이지만 보안 취약점이 된다.

예를 들어, 공격자가 이미지로 위장한 HTML 파일을 서버에 업로드하고, 서버가 `Content-Type: image/jpeg`를 반환해도 브라우저가 스니핑으로 HTML로 처리하면 XSS가 발생할 수 있다.

```http
# 스니핑 방지
X-Content-Type-Options: nosniff
```

`X-Content-Type-Options: nosniff`를 응답에 포함하면 브라우저는 **반드시 선언된 Content-Type으로만** 처리한다. 모든 응답, 특히 사용자 콘텐츠를 서빙할 때 필수다.

```nginx
# Nginx 설정
add_header X-Content-Type-Options "nosniff" always;
```

```python
# Django 미들웨어 (기본 내장)
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',  # nosniff 포함
]
```

## vendor 타입과 개인 타입

IANA에서 표준화하지 않은 타입은 다음 방식으로 구분한다.

```
application/vnd.ms-excel          # vnd 접두사: 벤더 전용
application/vnd.api+json          # JSON:API 표준
application/vnd.github+json       # GitHub API

application/x-www-form-urlencoded # x- 접두사: 비표준/실험적
image/x-icon                       # .ico 파일 (구형)
```

`vnd.*`는 특정 벤더나 조직의 전용 형식이다. IANA에 등록해 공식 타입으로 승격할 수 있다. `x-*`는 비공식 확장이었으나 RFC 6648에서 새로운 비표준 미디어 타입에 x- 접두사 사용을 **비권장**하도록 변경됐다.

## 실무 체크리스트

1. **명시**: 모든 응답에 Content-Type을 반드시 포함한다.
2. **charset**: text/* 타입은 항상 `charset=utf-8`을 명시한다.
3. **nosniff**: `X-Content-Type-Options: nosniff`를 모든 응답에 설정한다.
4. **JSON**: API 응답은 `application/json`으로 통일한다.
5. **파일 업로드**: multipart/form-data, boundary 자동 생성 라이브러리 활용.
6. **415 처리**: 서버가 처리할 수 없는 타입은 415로 명확히 거부한다.

---

**지난 글:** [HTTP 헤더 카테고리 완전 해설](/posts/http-header-categories/)

**다음 글:** [HTTP 콘텐츠 협상(Content Negotiation) 완전 정복](/posts/http-content-negotiation/)

<br>
읽어주셔서 감사합니다. 😊
