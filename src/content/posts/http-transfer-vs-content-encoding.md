---
title: "Transfer-Encoding vs Content-Encoding — 두 인코딩의 차이 완전 정복"
description: "표현의 일부인 Content-Encoding과 홉 단위 운송 포장인 Transfer-Encoding의 차이를 종단 간/홉 단위 모델, 포장 순서, Content-Length·ETag와의 관계 중심으로 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["TransferEncoding", "ContentEncoding", "표현", "홉단위", "종단간", "ContentLength", "TE헤더"]
featured: false
draft: false
---

[지난 글](/posts/http-streaming/)에서 스트리밍을 다루며 `Transfer-Encoding: chunked`와 압축(`Content-Encoding: gzip`)이 함께 등장했다. 이름이 비슷해서 자주 혼동되는 이 두 헤더는 사실 **작동하는 계층이 완전히 다르다.** 하나는 콘텐츠의 정체성에 속하고, 하나는 운송 수단에 속한다. 이 차이를 정확히 이해하면 Content-Length가 무엇의 길이인지, 프록시가 무엇을 바꿔도 되는지, ETag가 왜 인코딩마다 달라야 하는지가 한 번에 풀린다.

## 한 문장 정의

```
Content-Encoding  = 표현(representation)의 일부
                    "이 리소스를 gzip으로 압축한 형태로 보낸다"
                    종단 간(end-to-end) — 끝에서 끝까지 유지

Transfer-Encoding = 메시지의 운송 포장
                    "이 한 구간에서 이렇게 포장해 나른다"
                    홉 단위(hop-by-hop) — 받는 즉시 벗겨짐
```

택배에 비유하면 Content-Encoding은 **진공 압축팩에 넣은 상품 자체**고(받는 사람이 뜯는다), Transfer-Encoding은 **운송 중에만 쓰는 송장과 박스**다(중간 물류센터마다 갈아치울 수 있다).

## 종단 간 vs 홉 단위

차이가 가장 극명하게 드러나는 곳은 프록시를 낀 경로다.

![종단 간 vs 홉 단위](/assets/posts/http-transfer-vs-content-encoding-hops.svg)

원본 서버가 gzip으로 압축한 본문을 chunked로 보냈다고 하자.

- `Content-Encoding: gzip`은 프록시를 그대로 **통과**한다. 중간 장비가 마음대로 풀거나 다시 압축하면 안 된다 (명시적으로 변환을 허용한 게이트웨이가 아닌 한). 클라이언트에 도착할 때까지 본문은 gzip된 그 바이트열이다.
- `Transfer-Encoding: chunked`는 **프록시가 받는 순간 소멸**한다. 프록시는 청크를 풀어 본문을 복원한 뒤, 다음 구간에서는 자기 사정대로 다시 포장한다 — 전체를 버퍼링했다면 `Content-Length`로 바꿔 보낼 수도 있고, 다시 chunked로 보낼 수도 있다. 둘 다 정당하다.

그래서 같은 응답이라도 서버→프록시 구간은 chunked, 프록시→클라이언트 구간은 Content-Length인 상황이 흔하다. **Transfer-Encoding은 메시지의 속성이 아니라 구간의 속성**이기 때문이다.

## 포장 순서 — 누가 안쪽인가

두 인코딩이 함께 쓰일 때 적용 순서는 항상 같다. **표현을 먼저 만들고, 그것을 전송 단위로 자른다.**

![포장 순서](/assets/posts/http-transfer-vs-content-encoding-layers.svg)

```
송신: 원본 100KB
      → Content-Encoding: gzip 적용 (28KB의 "표현" 완성)
      → 그 28KB를 chunked로 잘라 전송

수신: chunked 조각 재조립 (28KB 복원)
      → gzip 해제 (100KB 원본)
```

이 순서에서 중요한 결론들이 따라 나온다.

**Content-Length는 "gzip이 적용된 표현"의 크기다.** 원본 100KB가 아니라 28416바이트. 클라이언트가 `Content-Length`로 진행률 바를 만들면 그것은 압축본 기준 진행률이다.

**chunked의 조각 크기는 어디에도 남지 않는다.** 운송 포장이므로 벗기고 나면 끝이다. 반면 gzip은 벗기기 전까지 본문의 일부다.

**ETag는 표현 기준이다.** 같은 리소스라도 gzip 표현과 원본 표현은 바이트가 다르므로 강한 ETag가 달라야 한다 — [ETag 편](/posts/http-etag-conditional/)에서 본 nginx의 약한 ETag 강등이 바로 이 규칙의 산물이다.

## 와이어에서 확인하기

```bash
# 서버가 보내는 원시 형태 그대로 관찰
curl -s --raw -H 'Accept-Encoding: gzip' -D - https://example.com/ -o body.raw
# HTTP/1.1 200 OK
# Content-Encoding: gzip          ← 표현: gzip
# Transfer-Encoding: chunked      ← 운송: chunked (Content-Length 없음)

# body.raw에는 청크 크기 줄 + gzip 바이트가 섞여 있다
xxd body.raw | head -3
# 00000000: 3739 3038 0d0a 1f8b 0800 ...
#           ^^^^ "7908" 청크 크기  ^^^^ gzip 매직 넘버(1f 8b)
```

청크 크기 줄(`7908\r\n`) 바로 뒤에 gzip 매직 넘버(`1f 8b`)가 보인다. 전송 포장 안에 표현이 들어 있는 구조가 바이트 수준에서 그대로 확인된다.

## Transfer-Encoding: gzip도 있다?

명세상 Transfer-Encoding에도 `gzip`, `deflate` 같은 값이 올 수 있다 (`Transfer-Encoding: gzip, chunked`). "이 구간에서만 압축해 나르고 도착하면 푼다"는 뜻이다. 이론적으로는 우아하다 — 압축이 운송의 관심사라면 캐시는 항상 원본을 저장하면 되고 ETag 문제도 사라진다.

하지만 **현실에서는 쓰이지 않는다.** 주요 브라우저가 구현하지 않았고, 서버도 마찬가지다. 요청 시 `TE: gzip` 헤더로 수락 의사를 밝힐 수 있지만 실무에서 보게 되는 값은 트레일러 수락 의사인 `TE: trailers`뿐이다. **실질적으로 Transfer-Encoding의 유일한 값은 chunked**라고 기억하면 된다.

```http
# TE는 "응답의 Transfer-Encoding으로 무엇을 받아줄지"를 알리는 요청 헤더
GET /data HTTP/1.1
TE: trailers          # 트레일러 헤더를 처리할 수 있음 (gRPC가 사용)
```

참고로 `TE`와 `Transfer-Encoding`은 둘 다 홉 단위 헤더라 `Connection` 헤더에 나열되는 부류다. 이 부류(Connection, Keep-Alive, TE, Transfer-Encoding, Upgrade 등)는 프록시가 다음 홉으로 **전달하면 안 되는** 헤더들이다.

## HTTP/2·3에서는 어떻게 되나

HTTP/2·3에는 `Transfer-Encoding`이 **존재하지 않는다.** 운송 포장의 역할(길이 모르는 스트리밍, 메시지 경계)을 바이너리 프레임 계층이 대신하기 때문이다. h2 메시지에 `transfer-encoding: chunked`를 넣으면 프로토콜 위반이다.

반면 `Content-Encoding`은 **그대로 살아 있다.** 표현의 속성은 프로토콜 버전과 무관하기 때문이다. 이 비대칭이 두 헤더의 본질 차이를 가장 깔끔하게 증명한다 — **운송 수단은 바뀌어도 화물은 그대로다.**

```
                     | HTTP/1.1        | HTTP/2 · HTTP/3
─────────────────────────────────────────────────────────
Content-Encoding     | 사용            | 동일하게 사용
Transfer-Encoding    | chunked 사용    | 금지 (프레임이 대체)
길이 미상 스트리밍   | chunked로       | DATA 프레임으로 자연 지원
트레일러             | 0 청크 뒤       | HEADERS 프레임으로 지원
```

## 실무 체크리스트

- 응답 크기를 다룰 때: **Content-Length는 인코딩된 표현의 크기**다. 원본 크기가 필요하면 별도 헤더(`X-Decompressed-Size` 류)나 트레일러로.
- 프록시 설정 시: chunked↔Content-Length 변환은 정상이다. 그러나 **gzip을 임의로 풀거나 재압축하는 프록시는 ETag·서명·Range를 깨뜨린다.**
- 직접 HTTP 파서를 짤 때: `Transfer-Encoding`과 `Content-Length`가 같이 오면 [요청 스머글링](/posts/http-chunked-transfer/) 위험 — Transfer-Encoding 우선, 의심스러우면 거부.
- 애플리케이션 코드에서 본문 해시·서명을 계산할 때: 어느 계층의 바이트(원본 vs 압축 표현)를 기준으로 하는지 명시하라. 클라이언트와 서버가 다른 계층을 보면 검증이 영원히 실패한다.

## 정리

- **Content-Encoding은 화물의 일부**(표현), **Transfer-Encoding은 구간별 포장**(운송)이다.
- 표현은 종단 간 유지되고, 운송 포장은 홉마다 벗겨지고 다시 싸인다.
- Content-Length·ETag·캐시는 모두 **표현 기준**으로 동작한다.
- 실무에서 Transfer-Encoding의 값은 사실상 chunked 하나뿐이고, HTTP/2·3에서는 그마저 프레임 계층으로 흡수됐다.

다음 글에서는 Content-Encoding의 실제 주인공들 — **gzip과 Brotli 압축**의 알고리즘 특성과 협상, 실전 설정을 다룬다.

---

**지난 글:** [HTTP 스트리밍 완전 정복 — 버퍼링 없이 응답 흘려보내기](/posts/http-streaming/)

**다음 글:** [HTTP 압축 완전 정복 — gzip과 Brotli](/posts/http-compression-gzip-brotli/)

<br>
읽어주셔서 감사합니다. 😊
