---
title: "HTTP/1.0 vs HTTP/1.1 — 무엇이 달라졌나"
description: "HTTP/0.9에서 1.0, 1.1로 이어진 진화의 역사와 1.1이 추가한 핵심 기능들 — 지속 연결, 필수 Host 헤더, 청크 전송, 캐시 제어 개선, 100 Continue, Range 요청까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["HTTP1.0", "HTTP1.1", "지속연결", "Host헤더", "청크전송", "keepalive", "가상호스팅"]
featured: false
draft: false
---

[지난 글](/posts/http-redirect-types-deep/)에서 3xx 리다이렉트를 상태코드 단위까지 파고들었다면, 이번에는 그 요청과 응답이 오가는 토대인 프로토콜 자체로 한 단계 내려간다. 오늘날 우리가 당연하게 여기는 `Host` 헤더, 연결 재사용, 청크 스트리밍은 모두 처음부터 있던 것이 아니다. HTTP/1.0과 1.1 사이의 변화를 짚어 보면, 웹이 "문서 몇 개 받아오는 시스템"에서 "수십 개의 리소스로 이루어진 페이지를 빠르게 조립하는 시스템"으로 넘어간 전환점이 보인다.

## 0.9에서 1.1까지 — 짧은 약사

HTTP는 세 단계를 거쳐 1.1에 도달했다.

- **HTTP/0.9 (1991)**: 한 줄짜리 프로토콜. `GET /page`가 전부였고 메서드는 GET 하나, 헤더도 상태코드도 없었다. 응답은 그냥 HTML 본문뿐이었다.
- **HTTP/1.0 (1996, RFC 1945)**: 헤더, 상태코드, `Content-Type`, POST·HEAD 같은 메서드가 들어왔다. 비로소 텍스트가 아닌 이미지·바이너리도 다룰 수 있게 됐다. 하지만 **연결당 한 번의 요청**이 기본이었다.
- **HTTP/1.1 (1997, 이후 RFC 7230~7235, 현재 RFC 9110/9112)**: 성능과 확장성의 한계를 정면으로 손봤다. 지속 연결을 기본으로 만들고, `Host` 헤더를 필수화하고, 청크 전송·캐시 제어·Range 등을 도입했다. 이후 20여 년간 웹의 사실상 기본 프로토콜로 군림한다.

버전은 요청 라인 끝에서 협상된다. 클라이언트가 `GET /path HTTP/1.1`처럼 자신이 쓰는 버전을 선언하고, 서버는 자신이 지원하는 버전으로 응답한다.

```http
GET /index.html HTTP/1.1
Host: www.example.com
```

## 1.0의 결정적 한계 — 연결과 Host

![1.0 연결당 요청 vs 1.1 연결 재사용](/assets/posts/http-1-0-vs-1-1-connections.svg)

1.0의 가장 큰 비용은 **연결 비효율**이었다. 기본 동작에서 요청 하나마다 새 TCP 연결을 열고, 응답을 받으면 닫는다. HTML 한 장에 이미지·CSS·스크립트가 수십 개씩 딸린 현대적 페이지에서는, 리소스 개수만큼 TCP 3-way 핸드셰이크를 반복해야 한다. 핸드셰이크 왕복 지연(RTT)이 그대로 쌓여 페이지가 느려진다.

```http
# HTTP/1.0 — 요청마다 새 연결, 응답 후 즉시 종료
GET /a.png HTTP/1.0

HTTP/1.0 200 OK
Content-Length: 1024
Connection: close
```

두 번째 한계는 `Host` 헤더의 부재다. 1.0의 요청 라인은 경로만 담았기 때문에, 서버는 클라이언트가 **어느 도메인**을 원하는지 알 수 없었다. 하나의 IP에 하나의 사이트만 올릴 수 있다는 뜻이고, 이는 IP 주소가 빠르게 고갈되던 시대에 심각한 제약이었다.

## 1.1의 핵심 추가 기능

![HTTP/1.1 추가 기능](/assets/posts/http-1-0-vs-1-1-features.svg)

1.1은 위 한계들을 포함해 여러 축에서 프로토콜을 끌어올렸다. 하나씩 보자.

### 지속 연결 (기본 keep-alive)

1.1에서는 **연결이 기본적으로 유지**된다. 한 번 연 TCP 연결로 여러 요청·응답을 주고받고, 끝내고 싶을 때만 `Connection: close`를 보낸다. 핸드셰이크 비용을 한 번만 치르고 페이지의 모든 리소스를 같은 연결로 받을 수 있다. (1.0에서도 `Connection: keep-alive`로 흉내 낼 수 있었지만 비표준 관행이었고, 1.1에서 기본값으로 명문화됐다.)

```http
GET /a.css HTTP/1.1
Host: www.example.com

HTTP/1.1 200 OK
Content-Length: 512

# 연결 유지 — 같은 소켓으로 다음 요청을 바로 보냄
GET /b.js HTTP/1.1
Host: www.example.com
```

### Host 헤더 필수 (가상 호스팅)

1.1은 `Host` 헤더를 **필수**로 만들었다. 모든 요청이 대상 도메인을 명시하므로, 서버는 같은 IP에서 `a.com`과 `b.com`을 구분해 서빙할 수 있다. 이른바 **가상 호스팅(virtual hosting)**이고, 오늘날 공유 호스팅·CDN의 기반이다. `Host`가 없는 1.1 요청에는 서버가 `400 Bad Request`로 응답해야 한다.

### 청크 전송 인코딩

본문 크기를 미리 모를 때를 위한 기능이다. `Content-Length` 대신 `Transfer-Encoding: chunked`를 쓰면, 데이터를 만들어지는 대로 조각(chunk) 단위로 흘려보내고 마지막에 0 크기 청크로 끝을 알린다. 동적으로 생성되는 응답이나 스트리밍에 필수다.

```http
HTTP/1.1 200 OK
Transfer-Encoding: chunked

7
Mozilla
9
Developer
0

```

각 청크 앞에 16진수 길이를 적고, `0` 청크가 본문의 끝을 나타낸다.

### 캐시 제어 개선

1.0의 `Expires`(절대 시각)와 `Pragma`만으로는 부족했다. 1.1은 `Cache-Control`(상대 수명·재검증 지시), 검증용 `ETag`/`If-None-Match`, `If-Modified-Since`를 도입해 정교한 캐시 검증을 가능하게 했다. 지난 글에서 본 304 Not Modified가 바로 이 검증의 응답이다.

### 100 Continue

큰 본문을 보내기 전에 서버가 받아줄지 미리 확인하는 메커니즘이다. 클라이언트가 `Expect: 100-continue` 헤더만 먼저 보내면, 서버가 `100 Continue`로 "본문 보내라"고 답한 뒤에야 실제 본문을 전송한다. 인증 실패 같은 이유로 거절될 큰 업로드를 헛되이 보내는 낭비를 막는다.

### 더 많은 메서드·상태코드, 그리고 Range

OPTIONS·PUT·DELETE·TRACE 등 메서드가 정리됐고 상태코드도 늘었다. 특히 **Range 요청**(`Range: bytes=0-1023`)으로 리소스의 일부만 받아오는 부분 전송이 가능해졌다. 다운로드 이어받기, 동영상 탐색, 병렬 분할 다운로드가 모두 여기에 기댄다.

```bash
# 파일의 처음 1KB만 요청 — 서버는 206 Partial Content로 응답
curl -r 0-1023 -o head.bin https://example.com/large.bin

# 서버가 Range를 지원하는지 확인 (Accept-Ranges: bytes)
curl -sI https://example.com/large.bin | grep -i accept-ranges
```

## 정리

```
구분            | HTTP/1.0        | HTTP/1.1
──────────────────────────────────────────────────
연결            | 요청당 새 연결  | 기본 지속 연결
Host 헤더       | 없음            | 필수 (가상 호스팅)
본문 길이 미정  | 곤란            | 청크 전송 인코딩
캐시            | Expires/Pragma  | Cache-Control/ETag
대용량 업로드   | 그냥 전송       | 100 Continue
부분 전송       | 없음            | Range / 206
```

- HTTP/1.1의 무게중심은 **성능과 확장성**이다. 지속 연결로 RTT 낭비를 줄이고, `Host` 필수화로 한 서버에 여러 사이트를 얹을 길을 열었다.
- 청크 전송·캐시 제어·Range는 모두 "더 크고 더 동적인 콘텐츠"를 효율적으로 다루기 위한 장치다.
- 그럼에도 1.1은 한 연결에서 응답을 순서대로 처리해야 하는 한계를 안고 있다. 다음 글에서는 1.1의 지속 연결과 파이프라이닝, 그리고 그 한계인 HOL 블로킹을 심화해서 들여다본다.

---

**지난 글:** [리다이렉트 심화 — 301·302·303·307·308 정확히 구분하기](/posts/http-redirect-types-deep/)

**다음 글:** [HTTP/1.1 심화 — 지속 연결·파이프라이닝·HOL 블로킹](/posts/http-1-1-deep/)

<br>
읽어주셔서 감사합니다. 😊
