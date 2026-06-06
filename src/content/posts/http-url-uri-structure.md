---
title: "URL과 URI 완전 정복 — 구조와 컴포넌트"
description: "URI, URL, URN의 차이, URL의 스킴·호스트·경로·쿼리·프래그먼트 컴포넌트 해부, 퍼센트 인코딩, 절대 URL과 상대 URL을 실무 예시로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["URL", "URI", "URN", "쿼리스트링", "퍼센트인코딩", "URL구조", "경로", "프래그먼트"]
featured: false
draft: false
---

[지난 글](/posts/http-what-is-http/)에서 HTTP의 기본 개념을 잡았다. HTTP 요청의 첫 줄에는 항상 URL이 있다. `GET /v1/items?q=test HTTP/1.1` — 이 경로가 정확히 무엇으로 구성되는지, URI와 URL의 차이가 무엇인지 이번 글에서 명확히 짚는다.

## URI vs URL vs URN

![URI · URL · URN 관계](/assets/posts/http-url-uri-vs-urn.svg)

- **URI(Uniform Resource Identifier)**: 리소스를 **고유하게 식별**하는 문자열. 가장 상위 개념.
- **URL(Uniform Resource Locator)**: URI의 부분집합. 리소스의 **위치(어디에 있는지)**로 식별. 웹에서 주로 사용.
- **URN(Uniform Resource Name)**: URI의 부분집합. 리소스의 **이름(무엇인지)**으로 식별. 위치와 무관한 영구 식별자.

```
URI (상위 개념)
├── URL: https://example.com/page     ← 위치 기반
└── URN: urn:isbn:978-0-13-110362-7   ← 이름 기반
```

일상에서 "URI"와 "URL"은 혼용되는 경우가 많다. 웹에서 http/https로 시작하는 것은 URL이자 URI다.

## URL 구조 해부

![URL 구조 완전 해부](/assets/posts/http-url-uri-anatomy.svg)

```
https://user:pass@api.example.com:8443/v1/items?q=test&lang=ko#section2
  │         │          │           │       │          │              │
스킴    사용자정보     호스트      포트    경로     쿼리스트링    프래그먼트
```

### 스킴 (Scheme)

어떤 프로토콜을 사용할지 지정한다. 대소문자 무관.

```
https   → HTTP over TLS
http    → 평문 HTTP
ftp     → 파일 전송
mailto  → 이메일 주소 (mailto:user@example.com)
file    → 로컬 파일 (file:///home/user/doc.txt)
ws      → WebSocket
wss     → WebSocket over TLS
```

### 호스트 (Host)와 포트

```
api.example.com:8443
│               │
도메인         포트 (생략 시 스킴 기본값)

# 기본 포트
http   → 80
https  → 443
ftp    → 21
```

포트를 명시할 때는 콜론(`:`)으로 구분한다. 기본 포트면 URL에서 생략할 수 있다.

### 경로 (Path)

서버 내 리소스의 계층적 위치를 나타낸다. 슬래시(`/`)로 구분된다.

```
/v1/items          → API 버전 1의 items 리소스
/users/42/profile  → 사용자 42번의 프로필
/                  → 루트 경로
```

서버가 경로를 어떻게 해석할지는 완전히 서버 구현에 달려있다. 파일 시스템 경로일 수도, 라우터 매핑일 수도 있다.

### 쿼리 스트링 (Query String)

`?`로 시작하고 `key=value` 쌍을 `&`로 연결한다.

```
?q=test&lang=ko&page=2
```

- 서버가 쿼리를 처리한다. 클라이언트는 그냥 전달한다.
- `GET` 요청에서 검색 조건, 필터, 페이지 번호를 전달하는 데 주로 쓴다.
- `?` 이하는 서버로 전송된다. (프래그먼트는 서버로 안 감)

### 프래그먼트 (Fragment)

`#` 이후 부분. **서버로 전송되지 않는다.** 브라우저가 클라이언트 측에서 처리한다.

```
https://example.com/docs#installation
                           │
                    해당 섹션으로 스크롤
```

SPA(Single Page Application)에서는 해시 라우팅(`#/about`, `#/profile`)에 활용한다.

## 퍼센트 인코딩 (Percent Encoding)

URL에는 ASCII 문자만 사용할 수 있다. 한글이나 특수문자는 퍼센트 인코딩이 필요하다.

```
인코딩 규칙: %XX (XX = 문자의 UTF-8 바이트 16진수)

예시:
공백     → %20  (또는 쿼리스트링에서 +)
한글 '가' → %EA%B0%80
#        → %23 (URL 내에서 특수 의미가 있을 때)
&        → %26
=        → %3D
```

```javascript
// JavaScript에서 퍼센트 인코딩
const encoded = encodeURIComponent('검색어 테스트');
// "검색어%20테스트"

const url = `https://api.example.com/search?q=${encoded}`;
// "https://api.example.com/search?q=검색어%20테스트"

// 디코딩
const decoded = decodeURIComponent('%EA%B0%80');
// "가"
```

퍼센트 인코딩이 필요한 문자는 `/`, `?`, `#`, `&`, `=`, 공백, 한글·중국어 등 비ASCII 문자다. 단, 경로 구분자(`/`)는 경로 안에서는 인코딩하지 않는다.

## 절대 URL vs 상대 URL

```html
<!-- 절대 URL: 스킴과 호스트가 모두 포함 -->
<a href="https://example.com/about">소개</a>

<!-- 스킴 상대 URL: 현재 페이지의 스킴을 따라감 -->
<a href="//cdn.example.com/image.jpg">이미지</a>

<!-- 루트 상대 URL: 현재 도메인의 루트 기준 -->
<a href="/about">소개</a>

<!-- 경로 상대 URL: 현재 경로 기준 -->
<a href="about">소개</a>          <!-- 같은 디렉토리 -->
<a href="../about">소개</a>        <!-- 상위 디렉토리 -->
```

상대 URL은 CDN 마이그레이션이나 도메인 변경 시 한꺼번에 적용된다는 장점이 있다.

## 실무 URL 설계 팁

```
# REST API URL 설계
GET    /users         → 사용자 목록
GET    /users/42      → 특정 사용자
POST   /users         → 사용자 생성
PUT    /users/42      → 사용자 수정
DELETE /users/42      → 사용자 삭제

# 쿼리스트링은 필터·정렬·페이징에
GET /products?category=phone&sort=price&page=2

# 버전은 경로나 헤더에
GET /v1/products      # 경로 버전닝
GET /products + Accept: application/vnd.api+json;version=2  # 헤더 버전닝
```

---

**지난 글:** [HTTP란 무엇인가 — 웹 통신의 기초](/posts/http-what-is-http/)

<br>
읽어주셔서 감사합니다. 😊
