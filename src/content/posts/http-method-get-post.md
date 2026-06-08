---
title: "GET vs POST — 언제 어떤 메서드를 써야 할까"
description: "GET과 POST의 요청 구조 차이, 데이터 전달 위치(URL vs Body), 캐시·보안·멱등성 비교, 실무에서 올바른 메서드를 선택하는 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["GET", "POST", "HTTP메서드", "쿼리스트링", "요청본문", "캐시", "멱등성", "REST설계"]
featured: false
draft: false
---

[지난 글](/posts/http-method-safety-idempotency/)에서 HTTP 메서드의 안전성과 멱등성을 살펴봤다. 이번 글에서는 가장 많이 쓰이는 **GET과 POST**의 차이를 실무 관점으로 완전히 정리한다.

## 가장 근본적인 차이: 데이터 위치

GET과 POST의 가장 큰 차이는 **데이터를 어디에 담느냐**다.

- **GET**: 데이터를 **URL의 쿼리스트링**에 담는다
- **POST**: 데이터를 **요청 본문(Body)**에 담는다

![GET vs POST 요청 구조](/assets/posts/http-method-get-post-anatomy.svg)

## GET 상세

```http
GET /search?q=http+메서드&lang=ko&page=1 HTTP/1.1
Host: www.example.com
Accept: text/html
Accept-Encoding: gzip, br
```

GET 요청의 특징:

| 항목 | 내용 |
|------|------|
| 데이터 위치 | URL 쿼리스트링 |
| 본문 | 없음 (허용되나 서버가 무시) |
| URL 길이 제한 | 브라우저마다 다름 (~2000~32000자) |
| 캐시 | 가능 (브라우저, CDN, 프록시) |
| 브라우저 히스토리 | 저장됨 |
| 북마크 | 가능 |
| 멱등성 | 있음 |
| 보안 | URL에 데이터 노출 (로그·리퍼러) |

### GET 캐싱

GET 응답은 `Cache-Control` 헤더가 허용하면 캐시된다. 같은 URL에 대한 두 번째 요청은 서버 대신 캐시에서 응답받는다.

```http
HTTP/1.1 200 OK
Cache-Control: max-age=3600
ETag: "abc123"
```

## POST 상세

```http
POST /api/orders HTTP/1.1
Host: api.shop.com
Content-Type: application/json
Content-Length: 87

{"product_id": 42, "quantity": 2, "address": "서울시 강남구..."}
```

POST 요청의 특징:

| 항목 | 내용 |
|------|------|
| 데이터 위치 | 요청 본문 |
| 본문 | 있음 |
| 데이터 크기 | 제한 없음 (서버 설정 한도) |
| 캐시 | 기본 불가 (조건부 가능) |
| 브라우저 히스토리 | 저장 안 됨 |
| 북마크 | 불가 |
| 멱등성 | 없음 |
| 보안 | URL에 노출 안 됨 (HTTPS 사용 시) |

## 실무 선택 기준

![GET vs POST 사용 상황](/assets/posts/http-method-get-post-usecase.svg)

```
조회, 검색, 필터, 정렬  → GET
  /products?category=phone&sort=price

리소스 생성             → POST
  POST /api/orders

로그인, 폼 제출         → POST
  POST /auth/login

파일 업로드             → POST (multipart/form-data)
  POST /api/files
```

## POST가 반드시 필요한 경우

### 1. 민감한 데이터

패스워드, 카드 번호 등을 GET으로 보내면 URL에 노출된다. 브라우저 히스토리, 웹 서버 로그, 프록시 로그, Referer 헤더에 기록되어 보안 위협이 된다.

```http
# 절대 금지: 패스워드를 GET 쿼리스트링으로
GET /login?password=mypassword123 HTTP/1.1

# 올바른 방법: POST 본문에 + HTTPS 필수
POST /auth/login HTTP/1.1
Content-Type: application/json

{"username":"alice","password":"mypassword123"}
```

### 2. 복잡한 검색 조건

쿼리스트링은 URL 인코딩 한계와 길이 제한이 있다. JSON 바디로 복잡한 필터를 전달할 때 POST를 쓰는 경우가 있다(GraphQL이 대표적).

```http
POST /api/search HTTP/1.1
Content-Type: application/json

{
  "filters": [
    {"field":"price","op":"gte","value":10000},
    {"field":"category","op":"in","value":["phone","tablet"]}
  ],
  "geo": {"lat":37.5,"lng":127.0,"radius":5}
}
```

### 3. 서버 상태 변경 작업

장바구니 추가, 주문, 결제 등 **서버 상태를 변경하는 모든 작업**은 POST(또는 PUT/DELETE)를 써야 한다. GET으로 상태 변경 작업을 구현하면:
- 크롤러·프리패치가 의도치 않게 실행한다
- 캐시가 실행 결과를 반환할 수 있다

## 자주 하는 실수

```javascript
// ❌ GET으로 상태 변경 (절대 금지)
fetch('/api/cart/add?product_id=42')

// ✅ POST로 상태 변경
fetch('/api/cart', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ product_id: 42 })
})
```

---

**지난 글:** [HTTP 메서드 안전성과 멱등성](/posts/http-method-safety-idempotency/)

**다음 글:** [PUT vs PATCH vs DELETE](/posts/http-method-put-patch-delete/)

<br>
읽어주셔서 감사합니다. 😊
