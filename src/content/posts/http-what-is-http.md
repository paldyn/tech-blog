---
title: "HTTP란 무엇인가 — 웹 통신의 기초"
description: "HTTP(HyperText Transfer Protocol)의 정의, 요청·응답 구조, 무상태 특성, HTTP/0.9부터 HTTP/3까지의 진화 과정을 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["HTTP", "웹통신", "요청응답", "무상태", "HTTP/1.1", "HTTP/2", "HTTP/3", "클라이언트서버"]
featured: false
draft: false
---

[지난 글](/posts/network-traceroute-mtr/)까지 네트워크 인프라와 진단 도구를 다뤘다. 이제 그 위에서 동작하는 **HTTP** 시리즈를 시작한다. 브라우저 주소창에 URL을 입력했을 때, 그 순간부터 페이지가 뜰 때까지 HTTP가 모든 것을 주관한다.

## HTTP란

HTTP(HyperText Transfer Protocol)는 **웹에서 데이터를 주고받기 위한 응용 계층 프로토콜**이다. 1989년 팀 버너스-리가 WWW를 설계하며 만들었다. HTML 문서를 전송하기 위해 시작했지만 오늘날에는 이미지·JSON·동영상·파일 등 거의 모든 웹 데이터를 다룬다.

TCP(또는 HTTP/3에서는 UDP 기반 QUIC) 위에서 동작하며, 기본 포트는 HTTP 80, HTTPS 443이다.

## 클라이언트-서버 모델

HTTP는 **요청(Request)과 응답(Response)** 한 쌍으로 이루어진다.

![HTTP 요청 · 응답 구조](/assets/posts/http-what-is-http-request-response.svg)

1. 클라이언트(브라우저)가 TCP 연결을 맺는다.
2. HTTP 요청 메시지를 서버로 전송한다.
3. 서버가 요청을 처리하고 HTTP 응답을 반환한다.
4. 클라이언트가 응답을 파싱·렌더링한다.

### 요청 메시지 구조

```
GET /index.html HTTP/1.1        ← 시작줄 (메서드 + 경로 + 버전)
Host: example.com               ← 헤더들
Accept: text/html, */*
User-Agent: Mozilla/5.0
                                ← 빈 줄 (헤더 끝 구분)
                                ← 본문 (GET은 비어있음)
```

### 응답 메시지 구조

```
HTTP/1.1 200 OK                 ← 상태줄 (버전 + 상태코드 + 사유구문)
Content-Type: text/html; charset=utf-8  ← 헤더들
Content-Length: 1234
Date: Sat, 07 Jun 2026 05:00:00 GMT
                                ← 빈 줄
<!DOCTYPE html>                 ← 본문 (HTML 본문)
<html>...
```

## HTTP의 핵심 특성

### 1. 무상태(Stateless)

HTTP 서버는 **이전 요청을 기억하지 않는다**. 각 요청은 완전히 독립적이다.

```
요청 1: GET /login  (로그인)
요청 2: GET /profile  (서버는 요청 1을 모름)
```

이 특성 덕분에 서버를 수평 확장할 수 있다. 어느 서버가 요청을 받아도 처리할 수 있다. 상태가 필요할 때는 쿠키나 토큰을 클라이언트가 매 요청에 포함시킨다.

### 2. 텍스트 기반 (HTTP/1.x)

HTTP/1.x는 사람이 읽을 수 있는 ASCII 텍스트로 구성된다. `curl`이나 `telnet`으로 직접 읽고 쓸 수 있다.

```bash
# telnet으로 HTTP 직접 요청
telnet example.com 80
GET / HTTP/1.1
Host: example.com
[엔터 두 번]
```

### 3. 요청-응답 패턴

클라이언트가 먼저 요청해야 서버가 응답한다. 서버가 먼저 데이터를 보내는 것은 기본 HTTP에서는 불가능하다. (SSE, WebSocket, Server Push는 확장 메커니즘이다.)

## HTTP 버전 진화

![HTTP 버전 진화](/assets/posts/http-what-is-http-versions.svg)

### HTTP/0.9 (1991)

웹의 시작. `GET`만 지원하고 헤더가 없었다. HTML만 전송할 수 있었다.

### HTTP/1.0 (1996)

헤더 개념 도입. 메서드 추가(POST, HEAD). 상태 코드 도입. 단, 요청마다 새 TCP 연결을 열고 닫았다.

### HTTP/1.1 (1997 ~ 현재)

`Keep-Alive` 지속 연결, 청크 전송 인코딩, 호스트 헤더 필수화, 캐시 제어 헤더 강화. 현재도 가장 널리 쓰이는 버전이다.

### HTTP/2 (2015)

바이너리 프레이밍, 멀티플렉싱(하나의 TCP 연결에서 여러 요청 동시 처리), HPACK 헤더 압축, 서버 푸시. HTTPS 없이는 사실상 사용 불가.

### HTTP/3 (2022, RFC 9114)

TCP 대신 **QUIC**(UDP 기반) 사용. 0-RTT 빠른 연결, TCP HOL Blocking 없음, 네트워크 전환(Wi-Fi↔LTE) 시 연결 유지.

## HTTP와 HTTPS의 차이

HTTPS는 HTTP + TLS다. 별도 프로토콜이 아니라 TLS 위에서 HTTP가 동작하는 것이다.

```
HTTP:  클라이언트 → TCP → 서버
HTTPS: 클라이언트 → TCP → TLS → HTTP → 서버
```

TLS가 암호화·서버 인증·데이터 무결성을 제공한다. 2024년 기준 전체 웹 트래픽의 90% 이상이 HTTPS다.

## 실제 HTTP 요청 확인

```bash
# curl로 HTTP 헤더 확인
curl -I https://example.com

# HTTP/2 확인
curl -I --http2 https://example.com

# 상세 연결 과정 보기
curl -v https://example.com 2>&1 | head -50
```

---

**지난 글:** [traceroute · mtr로 네트워크 경로 추적하기](/posts/network-traceroute-mtr/)

**다음 글:** [URL과 URI 완전 정복 — 구조와 컴포넌트](/posts/http-url-uri-structure/)

<br>
읽어주셔서 감사합니다. 😊
