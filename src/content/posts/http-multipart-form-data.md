---
title: "multipart/form-data — 파일 업로드의 내부"
description: "파일 업로드가 왜 multipart/form-data를 쓰는지, boundary와 part별 Content-Disposition·Content-Type, 바이너리 안전성, RFC 7578, 서버 파싱과 크기 제한, multipart/byteranges와의 차이까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["multipart", "form-data", "파일업로드", "boundary", "RFC7578", "ContentDisposition", "enctype"]
featured: false
draft: false
---

[지난 글](/posts/http-oauth-http-level/)에서 인증 토큰을 HTTP 헤더에 실어 보내는 방식을 봤다면, 이번엔 본문(body)에 무엇을 어떻게 담는가를 다룬다. 폼을 제출할 때 브라우저가 만들어 내는 본문에는 사실 여러 인코딩 방식이 있고, 그중 파일을 보낼 수 있는 건 단 하나, `multipart/form-data`다. 평소엔 `<form>`의 `enctype` 속성 하나로 가려져 잘 보이지 않지만, 업로드가 안 되거나 한글 파일명이 깨지거나 서버가 413을 뱉을 때 결국 들여다봐야 하는 게 이 본문 구조다. 이 글은 그 바이트 표현을 한 줄씩 펼쳐 본다.

## 인코딩 세 가지 — 언제 multipart인가

HTML 폼이 POST로 보낼 수 있는 본문 인코딩은 `enctype` 속성으로 정해지며 세 가지가 있다. `application/x-www-form-urlencoded`(기본값), `multipart/form-data`, 그리고 `text/plain`이다.

![POST 본문 인코딩 세 가지 비교](/assets/posts/http-multipart-encoding-compare.svg)

기본값인 `x-www-form-urlencoded`는 `name=kim&age=29`처럼 키=값 쌍을 `&`로 잇고, 특수문자는 `%` 퍼센트 인코딩으로 바꾼다. 텍스트 필드 몇 개를 보내기엔 가볍지만, 파일 같은 바이너리를 담으면 한 바이트가 `%89%50%4E...`처럼 세 배로 부풀고 그나마도 안전하지 않다. `text/plain`은 이스케이프를 거의 하지 않아 사람이 읽기 좋지만, 그래서 구분 문자가 값에 섞이면 파싱이 무너져 운영에서는 권장되지 않는다(주로 디버깅용이다).

결론은 단순하다. **본문에 파일(바이너리)이 하나라도 들어가면 `multipart/form-data`를 써야 한다.** 실제로 `<input type="file">`이 있는 폼은 `enctype="multipart/form-data"`를 지정하지 않으면 파일이 이름만 전송되고 내용은 사라진다. multipart는 각 필드를 독립된 "part"로 나눠, 바이너리를 변형 없이(바이너리 안전하게) 그대로 실어 보낼 수 있는 유일한 방식이다.

## boundary — 본문을 가르는 경계 문자열

multipart의 핵심 아이디어는 하나의 본문 안에 여러 part를 담되, 각 part를 **boundary**라는 임의의 구분 문자열로 나누는 것이다. 이 boundary는 요청 헤더의 `Content-Type`에 선언된다.

```http
POST /upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----X7MA4YWxkTrZu0gW
```

본문 안에서는 각 part가 시작될 때마다 boundary 앞에 `--`를 붙여 `------X7MA4YWxkTrZu0gW` 형태로 나타나고, 모든 part가 끝나면 마지막에 boundary 뒤에도 `--`를 붙인 **closing boundary**(`------X7MA4YWxkTrZu0gW--`)로 본문의 끝을 알린다. boundary 문자열은 본문 데이터 어디에도 우연히 등장해선 안 되므로, 브라우저나 HTTP 라이브러리가 충분히 길고 무작위한 값을 생성한다. 파일 내용에 boundary와 같은 바이트열이 들어갈 확률을 사실상 0으로 만드는 것이 바이너리 안전성의 전제다.

## 각 part의 구조 — Content-Disposition과 Content-Type

이제 본문 전체를 펼쳐 보자. 텍스트 필드 하나와 파일 하나를 보내는 경우다.

![multipart/form-data 본문 구조](/assets/posts/http-multipart-structure.svg)

각 part는 자체적으로 **헤더 + 빈 줄 + 본문**이라는 작은 HTTP 메시지처럼 생겼다. 모든 part에 공통으로 붙는 헤더가 `Content-Disposition: form-data; name="..."`이고, 이 `name`이 바로 폼 필드의 이름이다. part가 파일이면 여기에 `filename="..."`이 추가되고, 파일의 종류를 알리는 `Content-Type` 헤더가 따로 붙는다.

```http
------X7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="title"

My Report
------X7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="avatar"; filename="me.png"
Content-Type: image/png

(여기에 PNG 원본 바이트가 그대로)
------X7MA4YWxkTrZu0gW--
```

여기서 눈여겨볼 지점이 몇 가지 있다. 첫째, **텍스트 필드 part에는 `Content-Type`이 없다**(기본 `text/plain`으로 간주). 파일 part에만 `image/png` 같은 타입이 붙는다. 둘째, part 헤더와 본문 사이의 **빈 줄 하나**가 헤더의 끝을 의미한다 — HTTP 메시지 구조 그대로다. 셋째, 줄 끝은 모두 **CRLF(`\r\n`)**이며, 이건 단순한 관습이 아니라 RFC가 규정한 형식이다.

## RFC 7578 — 규격이 정한 것들

`multipart/form-data`는 원래 RFC 2388로 정의됐다가 2015년 **RFC 7578**로 갱신되며 모호했던 부분이 정리됐다. 실무에서 자주 부딪히는 규정 몇 가지만 짚으면 다음과 같다.

- **줄바꿈은 CRLF**: 각 헤더 줄과 boundary 줄은 `\r\n`으로 끝난다. LF만 쓰면 일부 엄격한 파서가 part를 인식하지 못한다.
- **필드 순서 보존**: part는 폼에 나타난 순서대로 전송되며, 서버는 이 순서를 신뢰할 수 있다.
- **파일명 인코딩**: 비ASCII 파일명(한글 등)은 까다로운 영역이다. RFC 7578은 `filename*`(RFC 5987 확장)보다는 UTF-8 그대로 `filename`에 담는 현실적 권고를 한다. 브라우저마다 처리가 달라 서버에서 인코딩을 보정해야 하는 경우가 많다.
- **`Content-Transfer-Encoding`은 사용하지 않음**: 이메일 MIME과 달리 HTTP에서는 base64 같은 전송 인코딩을 쓰지 말고 바이너리를 그대로 실으라고 명시한다. HTTP 자체가 8비트 바이너리를 안전하게 나르기 때문이다.

## 파일 여러 개와 혼합 필드

multipart의 강점은 **여러 파일과 일반 필드를 한 요청에 섞어 보낼 수 있다**는 점이다. 동일한 `name`을 가진 part가 여러 번 등장하면 그 필드는 배열로 해석된다 — 다중 파일 업로드(`<input type="file" multiple>`)가 바로 이 형태다.

```http
------X
Content-Disposition: form-data; name="user_id"

42
------X
Content-Disposition: form-data; name="docs"; filename="a.pdf"
Content-Type: application/pdf

%PDF-1.7 ...(바이너리)
------X
Content-Disposition: form-data; name="docs"; filename="b.pdf"
Content-Type: application/pdf

%PDF-1.7 ...(바이너리)
------X--
```

`user_id`라는 텍스트 필드와 `docs`라는 이름의 파일 두 개가 한 본문에 공존한다. 서버는 이를 `user_id = 42`, `docs = [a.pdf, b.pdf]`로 풀어낸다. 과거에는 다중 파일을 `multipart/mixed`로 한 번 더 감싸는 방식도 있었지만, RFC 7578은 이를 더는 권장하지 않고 위처럼 같은 `name`을 반복하는 평면 구조를 표준으로 정했다.

## 서버 파싱과 스트리밍

서버 입장에서 multipart 본문 처리는 단순한 키-값 파싱이 아니라 **바이트 스트림을 boundary로 쪼개며 읽는 일**이다. 이때 핵심 결정이 하나 있다. 전체 본문을 메모리에 올린 뒤 파싱할 것인가, 아니면 스트리밍하며 part 단위로 처리할 것인가다.

작은 폼이라면 메모리에 통째로 올려도 되지만, 수백 MB짜리 파일이 오면 메모리가 터진다. 그래서 대부분의 서버 프레임워크는 part를 읽으며 일정 크기 이상이면 **임시 파일로 흘려보내는(스트리밍)** 방식을 쓴다. 예를 들어 Node.js에서 `busboy`로 직접 스트림을 다루면 다음과 같다.

```javascript
const Busboy = require('busboy');

app.post('/upload', (req, res) => {
  const bb = Busboy({
    headers: req.headers,
    limits: { fileSize: 10 * 1024 * 1024 }, // 파일당 10MB
  });

  bb.on('file', (name, stream, info) => {
    // 메모리에 모으지 않고 디스크로 흘려보낸다
    stream.pipe(fs.createWriteStream(`/tmp/${info.filename}`));
  });

  bb.on('field', (name, val) => {
    console.log(`텍스트 필드: ${name} = ${val}`);
  });

  bb.on('close', () => res.end('done'));
  req.pipe(bb);
});
```

`file` 이벤트는 파일 part마다, `field` 이벤트는 텍스트 part마다 발생한다. 파일 스트림을 메모리에 모으지 않고 바로 디스크나 S3로 `pipe`하면, 본문 크기와 무관하게 일정한 메모리로 거대한 업로드를 처리할 수 있다. 이것이 multipart가 스트리밍 친화적인 이유다 — boundary가 part의 경계를 알려 주므로, 본문을 끝까지 다 받지 않아도 part 단위로 즉시 처리를 시작할 수 있다.

## 크기 제한 — 413을 만나는 자리

업로드에서 가장 흔한 실전 문제는 **크기 제한**이다. 제한은 여러 계층에 걸쳐 걸리며, 어느 한 곳에서라도 막히면 `413 Content Too Large`(또는 연결 끊김)로 나타난다.

```nginx
http {
    # nginx가 받아들이는 본문 최대 크기 (기본 1MB)
    client_max_body_size 50m;
}
```

nginx의 `client_max_body_size`, 애플리케이션 프레임워크의 본문 크기 옵션(위 `busboy`의 `limits`, Spring의 `spring.servlet.multipart.max-file-size` 등), 그리고 클라우드 게이트웨이의 페이로드 한도까지 — 이 셋이 서로 다른 값으로 설정돼 있으면 가장 작은 값에서 막힌다. "로컬에선 되는데 배포하면 413"의 단골 원인이 바로 앞단 프록시의 기본 1MB 제한이다. 크기 제한은 보안 측면에서도 중요하다. 제한 없는 업로드는 디스크와 메모리를 고갈시키는 DoS 통로가 되므로, part 개수와 part별 크기 양쪽에 상한을 두는 것이 안전하다.

## multipart/form-data vs multipart/byteranges

이름이 비슷해 헷갈리기 쉬운 형제가 있다. `multipart/byteranges`다. 둘 다 MIME 멀티파트 구조(boundary로 part를 나누는)를 공유하지만 **방향과 용도가 정반대**다.

`multipart/form-data`는 **요청** 본문에 쓰여 클라이언트가 서버로 폼 데이터와 파일을 **올릴 때(업로드)** 사용한다. 각 part는 `Content-Disposition: form-data; name=...`을 가진다. 반면 `multipart/byteranges`는 **응답** 본문에 쓰여, 하나의 Range 요청으로 **여러 구간을 한 번에 내려받을 때**(206 Partial Content) 서버가 사용한다. 각 part는 `name`이 아니라 자기 구간을 알리는 `Content-Range: bytes 0-499/1234` 헤더를 가진다.

```http
HTTP/1.1 206 Partial Content
Content-Type: multipart/byteranges; boundary=3d6b6a4

--3d6b6a4
Content-Range: bytes 0-499/1234

(첫 구간 바이트)
--3d6b6a4--
```

요컨대 **form-data는 업로드(요청), byteranges는 부분 다운로드(응답)**다. boundary 메커니즘이라는 같은 골격을 쓰지만 part 헤더가 `Content-Disposition`이냐 `Content-Range`냐로 구분된다. byteranges 쪽은 [Range 요청 글](/posts/http-range-requests/)에서 더 깊이 다뤘다.

## 정리

- 파일(바이너리)을 보내려면 폼 `enctype`은 **`multipart/form-data` 한 가지**뿐이다. urlencoded·text/plain은 바이너리 안전하지 않다.
- 본문은 헤더에 선언된 **boundary**로 part를 나누고, 마지막은 뒤에 `--`를 붙인 **closing boundary**로 끝난다. 줄 끝은 CRLF다.
- 각 part는 `Content-Disposition: form-data; name=...`을 갖고, 파일 part엔 `filename=...`과 별도 `Content-Type`이 붙는다. 같은 `name` 반복으로 다중 파일을 표현한다(RFC 7578).
- 서버는 본문을 **스트리밍으로 파싱**해 큰 파일을 디스크로 흘려보내고, **크기 제한**은 프록시·앱·게이트웨이 여러 계층에 걸려 가장 작은 값에서 413이 난다.
- `multipart/byteranges`는 이름만 비슷할 뿐, 업로드가 아니라 **부분 다운로드 응답**에 쓰는 별개의 형식이다.

---

**지난 글:** [OAuth 2.0을 HTTP 레벨에서 보기](/posts/http-oauth-http-level/)

**다음 글:** [REST 원칙 — 자원, 표현, 무상태](/posts/http-rest-principles/)

<br>
읽어주셔서 감사합니다. 😊
