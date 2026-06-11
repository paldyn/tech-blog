---
title: "조건부 요청 심화 — If-Match, If-Unmodified-Since, If-Range와 평가 순서"
description: "HTTP 조건부 요청 헤더 5종의 역할과 RFC 9110이 정의한 평가 순서, If-Range를 이용한 안전한 이어받기, 412·304·428 상태 코드의 관계를 깊이 있게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["조건부요청", "IfMatch", "IfUnmodifiedSince", "IfRange", "평가순서", "412", "RFC9110"]
featured: false
draft: false
---

[지난 글](/posts/http-etag-conditional/)에서 ETag와 If-Match 낙관적 잠금을 봤다. 그런데 조건부 헤더는 If-Match 하나가 아니다. If-None-Match, If-Modified-Since, If-Unmodified-Since, If-Range까지 **다섯 가지 전제조건 헤더**가 있고, 여러 개가 동시에 오면 서버는 **정해진 순서**로 평가해야 한다. 이번 글에서는 RFC 9110이 규정한 평가 순서와 각 헤더의 정확한 의미, 그리고 실무에서 자주 놓치는 상호작용을 정리한다.

## 조건부 헤더 5종 한눈에

```
헤더                 | 검증자        | 의미                          | 실패 시
─────────────────────────────────────────────────────────────────────
If-Match            | ETag (강한)   | 이 버전일 때만 수행하라        | 412
If-None-Match       | ETag (약한)   | 이 버전이 아닐 때만 수행하라   | 304/412
If-Modified-Since   | 날짜          | 이후 수정됐을 때만 보내라      | 304
If-Unmodified-Since | 날짜          | 이후 수정 안 됐을 때만 수행하라 | 412
If-Range            | ETag/날짜     | 같은 버전이면 Range만 보내라   | 200 전체
```

방향이 헷갈리기 쉬운데, 이렇게 기억하면 된다.

- **Match 계열**은 ETag를, **Since 계열**은 Last-Modified 날짜를 본다.
- **If-Match / If-Unmodified-Since**는 "변하지 않았을 때만 실행" — 주로 **쓰기 보호**용.
- **If-None-Match / If-Modified-Since**는 "변했을 때만 보내라" — 주로 **캐시 재검증**용.

## 평가 순서 — 왜 정해져 있나

한 요청에 조건부 헤더가 여러 개 올 수 있다. 예를 들어 브라우저 캐시는 ETag와 Last-Modified를 둘 다 보관하면 `If-None-Match`와 `If-Modified-Since`를 함께 보낸다. 서버 구현마다 평가 순서가 다르면 같은 요청에 다른 응답이 나오므로, RFC 9110 §13.2.2는 순서를 못박았다.

![조건부 헤더 평가 순서](/assets/posts/http-conditional-requests-deep-precedence.svg)

```
1. If-Match            → 불일치 시 412, 더 평가하지 않음
2. If-Unmodified-Since → If-Match가 없을 때만 평가, 위반 시 412
3. If-None-Match       → 일치 시 GET·HEAD는 304, 그 외 메서드는 412
4. If-Modified-Since   → If-None-Match가 없는 GET·HEAD만, 미수정 시 304
5. If-Range            → Range 헤더가 있을 때, 일치하면 206 / 불일치하면 200
```

핵심 규칙 세 가지:

**첫째, ETag 검증자가 날짜 검증자를 이긴다.** `If-None-Match`가 있으면 `If-Modified-Since`는 **무시된다**. ETag가 더 정밀한 검증자이기 때문이다. Last-Modified는 1초 해상도라 1초 안에 두 번 수정되면 변경을 놓친다.

**둘째, 조건 평가는 리소스가 존재한 다음 이야기다.** 대상 리소스가 없으면 404가 먼저다. 412는 "리소스는 있는데 전제조건이 어긋났다"는 뜻이다.

**셋째, If-None-Match 일치의 결과는 메서드에 따라 갈린다.** GET·HEAD라면 "캐시 쓰세요"라는 뜻의 304, PUT·DELETE 같은 변경 메서드라면 "전제조건 실패"인 412다.

```http
# 같은 If-None-Match: * 라도 메서드에 따라 의미가 다르다

# GET → 캐시 재검증 (일치하면 304)
GET /report.pdf HTTP/1.1
If-None-Match: "v3"

# PUT → "존재하지 않을 때만 생성하라" (존재하면 412)
PUT /report.pdf HTTP/1.1
If-None-Match: *
```

## If-Unmodified-Since — ETag가 없는 시스템의 쓰기 보호

If-Match가 더 정확하지만, 레거시 시스템이나 정적 파일 서버에는 ETag가 없고 Last-Modified만 있는 경우가 있다. 이때 갱신 분실을 막는 차선책이 `If-Unmodified-Since`다.

```http
# 문서를 읽었을 때 Last-Modified: Tue, 09 Jun 2026 10:00:00 GMT

PATCH /wiki/page-12 HTTP/1.1
If-Unmodified-Since: Tue, 09 Jun 2026 10:00:00 GMT
Content-Type: application/json-patch+json

[{"op": "replace", "path": "/title", "value": "새 제목"}]

# 그 사이 다른 사람이 수정했다면
HTTP/1.1 412 Precondition Failed
```

부분 업로드를 여러 번 나눠 보내는 동안 "처음 검사했던 그 파일이 맞는지"를 매 요청마다 확인하는 용도로도 쓰인다.

## If-Range — 이어받기를 안전하게

대용량 다운로드가 중간에 끊겼다고 하자. `Range: bytes=512000-`으로 뒷부분만 다시 요청하면 되지만, **그 사이 파일이 새 버전으로 교체됐다면** 옛 파일의 앞 조각과 새 파일의 뒤 조각이 이어붙어 손상된 파일이 된다.

`If-Range`는 이 문제를 한 번의 왕복으로 해결한다. "버전이 그대로면 Range만, 바뀌었으면 전체를 보내라."

![If-Range 안전한 이어받기](/assets/posts/http-conditional-requests-deep-if-range.svg)

```http
GET /video.mp4 HTTP/1.1
Range: bytes=512000-
If-Range: "v1"

# 파일 그대로 → 요청한 구간만
HTTP/1.1 206 Partial Content
Content-Range: bytes 512000-2097151/2097152

# 파일 변경됨 → 전체를 처음부터
HTTP/1.1 200 OK
Content-Length: 2304512
```

If-Range만의 특수 규칙이 있다.

- 값은 **딱 하나** — 강한 ETag 하나 또는 HTTP-date 하나. 목록 불가.
- **강한 비교만** 사용한다. `W/"v1"` 같은 약한 ETag는 절대 일치하지 않으므로 넣어도 항상 200 전체 응답이 온다.
- 날짜를 쓸 경우 그 날짜는 **강한 검증자로 간주할 수 있을 때만** (해당 초에 두 번 수정된 적이 없다고 확신할 때) 일치 처리한다.
- 조건 불일치는 에러가 아니다. 412 없이 그냥 200으로 전체를 준다.

`curl`로 직접 확인해 보자.

```bash
# 1단계: 앞 512KB만 받고 ETag 기록
curl -s -o part.bin -D - -r 0-511999 https://example.com/video.mp4 \
  | grep -i etag
# etag: "v1"

# 2단계: If-Range와 함께 이어받기
curl -s -o rest.bin -D - -r 512000- \
  -H 'If-Range: "v1"' https://example.com/video.mp4 | head -1
# HTTP/1.1 206 Partial Content  ← 그대로면 이어받기 성공

cat part.bin rest.bin > video.mp4
```

## 서버 구현 시 주의점

프레임워크가 조건부 요청을 자동 처리해 주지 않는 경우, 평가 순서를 직접 구현해야 한다. 순서를 지키지 않으면 표준 클라이언트와 동작이 어긋난다.

```js
// Express 미들웨어 스케치 — RFC 9110 순서대로
function evaluatePreconditions(req, res, resource) {
  const { etag, lastModified } = resource;

  // 1. If-Match (강한 비교)
  const ifMatch = req.get('If-Match');
  if (ifMatch !== undefined) {
    if (!strongMatch(ifMatch, etag)) return res.sendStatus(412);
  } else {
    // 2. If-Unmodified-Since — If-Match 없을 때만
    const ius = req.get('If-Unmodified-Since');
    if (ius && lastModified > new Date(ius)) return res.sendStatus(412);
  }

  // 3. If-None-Match (약한 비교)
  const inm = req.get('If-None-Match');
  if (inm !== undefined) {
    if (weakMatch(inm, etag)) {
      const safe = req.method === 'GET' || req.method === 'HEAD';
      return res.sendStatus(safe ? 304 : 412);
    }
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    // 4. If-Modified-Since — If-None-Match 없을 때만
    const ims = req.get('If-Modified-Since');
    if (ims && lastModified <= new Date(ims)) return res.sendStatus(304);
  }

  return null; // 모든 전제조건 통과 → 본 처리 진행
}
```

추가로 기억할 것들:

- **304 응답에는 ETag·Cache-Control 등 메타데이터 헤더를 다시 실어라.** 캐시는 이 헤더로 저장된 항목을 갱신한다.
- **412 응답 본문에 현재 버전 정보를 담아주면** 클라이언트가 재조회 없이 충돌을 해소할 수 있다 (표준은 아니지만 흔한 관행).
- 무조건 덮어쓰기를 막고 싶다면 `428 Precondition Required`로 조건부 헤더 자체를 강제할 수 있다.

## 정리

조건부 요청은 단순한 캐시 최적화가 아니라 **HTTP에 내장된 버전 검증 프로토콜**이다. 읽기 경로에서는 If-None-Match/If-Modified-Since가 대역폭을 아끼고, 쓰기 경로에서는 If-Match/If-Unmodified-Since가 데이터를 지키며, If-Range는 그 사이에서 이어받기를 안전하게 만든다. 그리고 이 모든 것은 서버가 **RFC 9110의 평가 순서**를 지킬 때만 예측 가능하게 동작한다.

다음 글에서는 주제를 바꿔, 브라우저 보안 모델의 핵심인 **CORS(교차 출처 리소스 공유)**를 다룬다.

---

**지난 글:** [ETag 완전 정복 — 강한·약한 검증자, 생성 전략, If-Match 낙관적 잠금](/posts/http-etag-conditional/)

**다음 글:** [CORS 완전 정복 — 교차 출처 리소스 공유의 원리](/posts/http-cors/)

<br>
읽어주셔서 감사합니다. 😊
