---
title: "청크 전송 인코딩 완전 정복 — Transfer-Encoding: chunked"
description: "메시지 프레이밍이 왜 필요한지부터 chunked 와이어 포맷, 트레일러 헤더, 직접 구현 예제, 요청 스머글링 위험까지 청크 전송 인코딩을 완전히 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["청크전송", "TransferEncoding", "chunked", "ContentLength", "프레이밍", "트레일러"]
featured: false
draft: false
---

[지난 글](/posts/http-keep-alive-pipelining/)에서 영속 연결을 다뤘는데, 사실 영속 연결에는 숨은 전제가 하나 있다. 연결이 계속 열려 있다면, 수신자는 **"이 응답이 어디서 끝나는지"**를 연결 종료가 아닌 다른 방법으로 알아야 한다. 이 문제를 메시지 프레이밍(framing)이라 하고, 그 답 중 하나가 오늘의 주인공 **청크 전송 인코딩(Transfer-Encoding: chunked)**이다.

## 프레이밍 — 응답의 끝은 어디인가

HTTP/1.0 시절의 답은 단순했다. **연결이 닫히면 본문 끝.** 하지만 이 방식은 연결을 재사용할 수 없고, 더 나쁘게는 **전송이 중간에 끊긴 것인지 정상 종료인지 구별할 수 없다**는 치명적 약점이 있다.

HTTP/1.1은 메시지 안에서 끝을 알 수 있는 두 가지 방법을 제공한다.

![본문의 끝을 알리는 세 가지 방법](/assets/posts/http-chunked-transfer-framing.svg)

```http
# 방법 1: 길이를 미리 선언
HTTP/1.1 200 OK
Content-Length: 1024
# → 정확히 1024바이트 읽으면 이 응답 끝, 다음 바이트부터 새 응답

# 방법 2: 조각 단위로 보내며 끝을 표시
HTTP/1.1 200 OK
Transfer-Encoding: chunked
# → 크기가 0인 청크가 나오면 끝
```

`Content-Length`는 명확하지만 **전송을 시작하기 전에 전체 크기를 알아야** 한다. 동적으로 생성되는 HTML, 실시간으로 압축 중인 데이터, DB에서 행 단위로 흘러나오는 결과는 크기를 미리 알 수 없다. 본문을 전부 메모리에 버퍼링한 뒤 길이를 재는 방법도 있지만, 그러면 첫 바이트가 나가는 시점(TTFB)이 늦어지고 메모리도 낭비된다.

**chunked는 "크기를 모른 채 보내기 시작"을 가능하게 하는 프레이밍**이다.

## 와이어 포맷 해부

청크 하나의 구조는 `16진수 크기 + CRLF + 데이터 + CRLF`다. 이를 반복하다 크기 0인 청크로 끝을 알린다.

![청크 전송의 와이어 포맷](/assets/posts/http-chunked-transfer-wire.svg)

실제 바이트 스트림을 보자.

```http
HTTP/1.1 200 OK
Content-Type: text/plain
Transfer-Encoding: chunked

7\r\n
Network\r\n
1A\r\n
and HTTP, fully conquered.\r\n
0\r\n
\r\n
```

읽는 법:

- `7` — 다음 데이터가 7바이트라는 뜻. 크기는 **16진수**다. `1A`는 26바이트.
- 데이터 뒤에는 반드시 CRLF가 따라온다 (이 CRLF는 크기에 포함되지 않음).
- `0\r\n` — 크기 0짜리 마지막 청크. "본문 끝"의 신호다.
- 마지막 빈 줄로 메시지가 완전히 종료된다.

수신자는 조각들을 이어붙여 `Network and HTTP, fully conquered.`라는 33바이트 본문을 복원한다. 중요한 것은 **청크 경계에 아무 의미가 없다**는 점이다. 송신 측 버퍼 사정에 따라 쪼개진 전송 단위일 뿐, "청크 = 한 줄" 같은 가정은 절대 하면 안 된다 (SSE 같은 상위 프로토콜이 따로 경계를 정의한다).

`Transfer-Encoding: chunked`가 있으면 `Content-Length`는 **있어선 안 된다.** 둘이 같이 오면 어떤 일이 생기는지는 아래 보안 섹션에서 본다.

## 트레일러 — 본문 뒤에 오는 헤더

크기를 모른 채 보내기 시작하면 곤란해지는 헤더들이 있다. 본문 전체의 체크섬이나 처리 소요 시간처럼 **본문을 다 만들어 봐야 알 수 있는 값**들이다. chunked는 이를 위해 마지막 청크 뒤에 헤더를 추가하는 **트레일러(trailer)**를 지원한다.

```http
HTTP/1.1 200 OK
Transfer-Encoding: chunked
Trailer: Server-Timing, X-Body-Sha256

7\r\n
Network\r\n
0\r\n
Server-Timing: db;dur=53, render;dur=12\r\n
X-Body-Sha256: 9f86d081884c7d65...\r\n
\r\n
```

`Trailer` 헤더로 "뒤에 어떤 헤더가 올지" 예고하고, 0 청크 뒤에 실제 값을 보낸다. gRPC가 상태 코드를 트레일러로 보내는 것이 대표적인 활용 사례다. 다만 브라우저의 `fetch`에서 트레일러 접근은 지원이 제한적이어서, 웹에서는 `Server-Timing` 정도가 현실적인 사용처다.

## 직접 만들어 보기

서버 입장에서 chunked 전송은 프레임워크가 대부분 자동 처리한다. `Content-Length`를 정하지 않고 본문을 조각조각 write 하면 chunked가 된다.

```js
// Node.js — write()를 여러 번 호출하면 자동으로 chunked
import http from 'node:http';

http.createServer(async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  // Content-Length를 안 정했으므로 Transfer-Encoding: chunked

  for (let i = 1; i <= 5; i += 1) {
    res.write(`데이터 조각 ${i}\n`);          // 청크 하나씩 즉시 전송
    await new Promise(r => setTimeout(r, 1000));
  }

  res.end();   // 0 크기 청크 전송 → 메시지 종료
}).listen(8080);
```

클라이언트에서 청크가 도착하는 모습을 보려면:

```bash
# --no-buffer로 도착 즉시 출력 — 1초마다 한 줄씩 나타난다
curl --no-buffer -v http://localhost:8080/ 2>&1 | grep -v '^[*<>]'

# 원시 바이트(크기 줄 포함)를 보고 싶다면
curl -s --raw http://localhost:8080/
# f
# 데이터 조각 1
# ...
# 0
```

`--raw` 옵션은 curl의 chunked 디코딩을 끄고 와이어 포맷 그대로 보여 준다. 디버깅할 때 유용하다.

## 보안 — 요청 스머글링의 단골 재료

`Transfer-Encoding`은 **요청**에도 쓸 수 있다(청크 업로드). 그런데 여기서 HTTP/1.1 역사상 가장 유명한 취약점 부류가 태어났다. **HTTP 요청 스머글링(Request Smuggling)**이다.

```http
POST / HTTP/1.1
Content-Length: 13
Transfer-Encoding: chunked

0

SMUGGLED
```

이 모순된 요청(길이 선언 두 개)을 프런트 프록시는 `Content-Length` 기준으로, 백엔드는 `Transfer-Encoding` 기준으로 해석한다면 — 두 장비가 **요청의 경계를 서로 다르게 자른다.** 백엔드 기준으로 남은 `SMUGGLED` 부분이 **다음 사용자 요청의 앞부분에 붙어** 해석되면서 인증 우회, 캐시 오염 등이 가능해진다.

명세(RFC 9112)는 둘이 함께 오면 **Transfer-Encoding이 우선**하며, 의심스러우면 요청을 거부하라고 규정한다. 현대 프록시(nginx, HAProxy 등)는 이런 요청을 400으로 거부하거나 정규화한다. 직접 HTTP 파서를 구현한다면 반드시 지켜야 할 규칙이다.

## HTTP/2·3에서는 chunked가 없다

`Transfer-Encoding`은 **HTTP/1.1 전용**이다. HTTP/2와 HTTP/3는 프로토콜 자체가 바이너리 프레임(DATA 프레임) 단위로 동작하므로, 길이를 모르는 스트리밍이 프레이밍 계층에서 기본 제공된다. chunked 인코딩을 쓸 필요도, 써서도 안 된다 (h2 요청에 `transfer-encoding` 헤더를 넣으면 프로토콜 오류다).

그래서 애플리케이션 코드는 "chunked를 쓴다"가 아니라 **"크기를 정하지 않고 스트리밍한다"**고 생각하는 게 맞다. 프로토콜 버전에 따라 그것이 chunked가 되기도, DATA 프레임이 되기도 한다.

## 정리

- 영속 연결에서는 메시지 안에서 본문의 끝을 알아야 한다 — `Content-Length` 또는 `chunked`.
- chunked는 `16진수 크기 + 데이터`의 반복, `0` 청크로 종료. **크기를 모른 채 전송 시작**이 가능해진다.
- 청크 경계는 전송 단위일 뿐 의미 단위가 아니다.
- 트레일러로 본문 이후에 계산되는 메타데이터(체크섬, 타이밍)를 보낼 수 있다.
- `Content-Length`와 `Transfer-Encoding`의 동시 등장은 스머글링 신호 — 파서는 거부해야 한다.
- HTTP/2·3에는 chunked가 없다. 스트리밍은 프레임 계층이 담당한다.

다음 글에서는 chunked가 가능하게 만든 응용 패턴 — **HTTP 스트리밍**으로 TTFB를 줄이고 점진적 렌더링을 구현하는 방법을 다룬다.

---

**지난 글:** [Keep-Alive와 파이프라이닝 — 영속 연결의 원리와 한계](/posts/http-keep-alive-pipelining/)

**다음 글:** [HTTP 스트리밍 완전 정복 — 버퍼링 없이 응답 흘려보내기](/posts/http-streaming/)

<br>
읽어주셔서 감사합니다. 😊
