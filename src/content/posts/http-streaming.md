---
title: "HTTP 스트리밍 완전 정복 — 버퍼링 없이 응답 흘려보내기"
description: "TTFB를 줄이는 스트리밍 응답의 원리, 점진적 HTML 렌더링과 NDJSON 패턴, fetch ReadableStream 소비, 프록시 버퍼링 함정까지 HTTP 스트리밍을 실전 중심으로 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["HTTP스트리밍", "TTFB", "ReadableStream", "NDJSON", "점진적렌더링", "프록시버퍼링"]
featured: false
draft: false
---

[지난 글](/posts/http-chunked-transfer/)에서 크기를 모른 채 전송을 시작하는 청크 인코딩을 봤다. 이번 글은 그 메커니즘 위에서 만들어지는 응용 — **HTTP 스트리밍**이다. 응답을 다 만들어 한 번에 보내는 대신 만들어지는 대로 흘려보내면, 사용자는 전체가 완성되기 한참 전부터 화면을 보기 시작한다. LLM 챗봇의 글자가 한 글자씩 돋아나는 그 화면도, 검색 결과가 위에서부터 채워지는 화면도 모두 이 패턴이다.

## 무엇이 좋아지나 — TTFB

서버가 3초 걸려 만드는 페이지가 있다고 하자. 버퍼링 방식이라면 사용자는 3초 동안 빈 화면을 본다. 스트리밍이라면 첫 조각(헤더, 상단 레이아웃)이 0.5초 만에 도착하고, 브라우저는 **받은 HTML부터 파싱·렌더링을 시작**한다.

![버퍼링 vs 스트리밍 TTFB](/assets/posts/http-streaming-ttfb.svg)

총 소요 시간은 비슷하다. 달라지는 것은 **첫 바이트 시간(TTFB, Time To First Byte)**과 체감 속도다. 측정해 보면 차이가 명확하다.

```bash
# curl로 단계별 타이밍 측정
curl -so /dev/null -w '
TTFB:        %{time_starttransfer}s
전체 완료:   %{time_total}s
' https://example.com/report

# 버퍼링 서버:   TTFB 3.01s / 전체 3.12s
# 스트리밍 서버: TTFB 0.52s / 전체 3.15s   ← 체감은 6배 빠름
```

브라우저의 HTML 파서는 원래부터 스트리밍 파서다. `<head>`의 CSS·JS 다운로드를 본문이 도착하기 전에 시작하고, 화면 위쪽부터 그린다. 서버가 버퍼링하면 이 능력이 통째로 낭비된다.

## 패턴 1 — 점진적 HTML 렌더링

가장 오래된 스트리밍 패턴이다. 레이아웃 셸을 먼저 보내고, 느린 데이터가 준비되는 대로 이어 보낸다.

```js
// Node.js — 셸 먼저, 느린 부분은 나중에
http.createServer(async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

  // 1) 즉시 보낼 수 있는 부분 — 브라우저는 CSS 로딩을 바로 시작
  res.write('<html><head><link rel="stylesheet" href="/app.css">');
  res.write('</head><body><header>PALDYN</header><main>');

  // 2) 느린 DB 조회 — 그동안 사용자는 셸을 보고 있다
  const rows = await db.query('SELECT * FROM reports');  // 2~3초
  res.write(rows.map(r => `<article>${r.html}</article>`).join(''));

  res.end('</main></body></html>');
}).listen(8080);
```

React 18의 `renderToPipeableStream`(Suspense 스트리밍 SSR), Rails의 스트리밍 템플릿 등 프레임워크 기능들도 본질은 전부 이 패턴이다.

## 패턴 2 — NDJSON으로 데이터 스트리밍

API 응답도 스트리밍할 수 있다. 다만 JSON 배열 `[...]`은 닫는 대괄호까지 받아야 파싱되므로 스트리밍과 궁합이 나쁘다. 그래서 **한 줄에 JSON 하나**씩 보내는 NDJSON(Newline Delimited JSON)이 표준적인 선택이다.

```http
HTTP/1.1 200 OK
Content-Type: application/x-ndjson
Transfer-Encoding: chunked

{"id":1,"name":"첫 번째 결과"}
{"id":2,"name":"두 번째 결과"}
{"id":3,"name":"세 번째 결과"}
```

수신 측은 줄 단위로 끊어서 도착분부터 즉시 파싱한다. 10만 행 내보내기, 검색 결과 점진 표시, 로그 테일링에 두루 쓰인다.

## 클라이언트 — fetch로 스트림 소비하기

`fetch`의 `response.body`는 **ReadableStream**이다. `res.json()`처럼 전체를 기다리는 대신, 조각이 도착할 때마다 처리할 수 있다.

![fetch 스트리밍 소비 파이프라인](/assets/posts/http-streaming-fetch.svg)

```js
const res = await fetch('/search/stream');
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // 조각 경계 ≠ 줄 경계 — 버퍼에 모았다가 완성된 줄만 처리
  buf += dec.decode(value, { stream: true });
  const lines = buf.split('\n');
  buf = lines.pop();                    // 마지막 미완성 줄은 보류

  for (const line of lines) {
    if (line.trim()) addResult(JSON.parse(line));
  }
}
```

두 가지 함정을 코드가 처리하고 있다.

- **`read()`의 value 경계는 보장되지 않는다.** 네트워크 사정에 따라 한 줄이 두 조각으로 쪼개지거나 여러 줄이 한 조각에 올 수 있다. 줄 경계는 직접 찾아야 한다.
- **`stream: true` 옵션.** 한글 같은 멀티바이트 문자가 조각 경계에서 잘릴 수 있는데, 이 옵션이 잘린 바이트를 다음 호출까지 보관해 안전하게 이어붙인다.

## 함정 — 중간의 버퍼링 장비들

스트리밍 코드를 완벽하게 짜도 **중간 어딘가가 버퍼링하면 끝**이다. 실무에서 "로컬은 한 글자씩 나오는데 배포하니 한꺼번에 나온다"의 범인은 거의 항상 이 목록에 있다.

```nginx
# nginx 리버스 프록시 — 기본값이 응답 버퍼링!
location /stream/ {
    proxy_pass http://backend;
    proxy_buffering off;          # 핵심: 받는 대로 흘려보내기
    proxy_http_version 1.1;
}
```

```http
# 애플리케이션이 헤더로 버퍼링 해제를 요청할 수도 있다 (nginx 지원)
X-Accel-Buffering: no
```

점검 목록:

- **리버스 프록시**: nginx `proxy_buffering`(기본 on)
- **압축 미들웨어**: gzip이 압축 윈도를 채우려 조각을 모아둘 수 있음 — 스트리밍 경로는 압축 제외하거나 조각마다 flush
- **애플리케이션 프레임워크**: 자동 버퍼링 미들웨어 (응답 크기 측정용)
- **CDN·로드밸런서**: 응답 버퍼링 옵션 (ALB는 괜찮지만 일부 CDN은 기본 버퍼링)
- **서버 내부**: `res.write()` 후 flush가 필요한 런타임인지 확인

## 어디까지가 "HTTP 스트리밍"인가

이 글에서 다룬 것은 **하나의 응답을 점진적으로 보내는** 다운스트림 스트리밍이다. 주변 기술과 위치를 정리해 두자.

```
기법              | 방향        | 정체
─────────────────────────────────────────────────────────
스트리밍 응답     | 서버→클라  | 보통의 HTTP 응답을 조각으로
SSE               | 서버→클라  | text/event-stream + 재연결 규약
WebSocket         | 양방향      | HTTP에서 업그레이드된 별도 프로토콜
업로드 스트리밍   | 클라→서버  | 요청 본문의 스트리밍 (지원 제한적)
```

SSE는 스트리밍 응답 위에 이벤트 구분·자동 재연결 규칙을 얹은 표준이고, WebSocket은 아예 다른 프로토콜로 갈아타는 것이다. 둘 다 이 시리즈의 별도 편에서 깊이 다룬다. 핵심은 **"실시간처럼 보이는 화면"의 상당수는 평범한 HTTP 응답 하나를 천천히 보내는 것만으로 구현된다**는 사실이다.

## 정리

- 스트리밍의 가치는 총 시간이 아니라 **TTFB와 체감 속도**다. 브라우저 파서는 원래 스트리밍으로 동작한다.
- HTML은 셸 먼저, 느린 데이터는 나중에. API는 NDJSON으로 줄 단위 전송.
- 클라이언트는 `response.body.getReader()`로 소비하되, **조각 경계를 신뢰하지 말 것**.
- 스트리밍이 안 될 때는 코드보다 **중간 버퍼(프록시, 압축, CDN)**부터 의심하라.

다음 글에서는 이번 글에서 스쳐 지나간 주제 — `Transfer-Encoding`과 `Content-Encoding`이 정확히 어떻게 다른지, 압축은 어느 계층의 일인지를 정면으로 다룬다.

---

**지난 글:** [청크 전송 인코딩 완전 정복 — Transfer-Encoding: chunked](/posts/http-chunked-transfer/)

**다음 글:** [Transfer-Encoding vs Content-Encoding — 두 인코딩의 차이 완전 정복](/posts/http-transfer-vs-content-encoding/)

<br>
읽어주셔서 감사합니다. 😊
