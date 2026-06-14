---
title: "Range 요청 완전 정복 — 부분 전송과 이어받기"
description: "Range·Accept-Ranges 헤더와 206 Partial Content, Content-Range로 동작하는 부분 전송의 원리부터 다운로드 이어받기, 멀티파트 byteranges, If-Range 조건부, 비디오 시킹과 nginx 설정까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["Range", "PartialContent", "206", "ContentRange", "이어받기", "byteranges", "스트리밍"]
featured: false
draft: false
---

[지난 글](/posts/http-compression-zstd/)에서 압축으로 전송량 자체를 줄이는 이야기를 마무리했다면, 이번엔 "파일을 통째로 받지 않고 필요한 부분만 잘라서 받는" 다른 축, **Range 요청**을 다룬다. 대용량 다운로드가 끊겼을 때 처음부터 다시 받지 않고 이어받는 기능, 동영상의 임의 지점으로 점프하는 시킹(seeking), 큰 파일을 여러 조각으로 병렬 다운로드하는 가속기 — 이 모두가 HTTP의 Range 메커니즘 위에서 돌아간다. 헤더 몇 개로 이루어진 단순한 약속이지만, 잘못 다루면 깨진 파일이나 무한 재시작으로 이어진다.

## Accept-Ranges — 서버가 부분 전송을 지원하는가

모든 것은 서버가 "나는 바이트 단위로 잘라 줄 수 있다"고 광고하는 데서 시작한다. 클라이언트가 일반 GET을 보내면 서버는 응답에 `Accept-Ranges` 헤더를 실어 자신의 능력을 알린다.

```http
HEAD /video.mp4 HTTP/1.1
Host: cdn.example.com

HTTP/1.1 200 OK
Accept-Ranges: bytes
Content-Length: 73400320
```

`Accept-Ranges: bytes`는 "바이트 단위 Range를 받겠다"는 뜻이고, `Accept-Ranges: none`이거나 헤더 자체가 없으면 부분 전송을 기대하지 말아야 한다. 정적 파일을 서빙하는 대부분의 서버(nginx, Apache, CDN)는 기본적으로 `bytes`를 지원한다. 반면 즉석에서 생성되는 동적 응답(스트리밍 압축 결과 등)은 지원하지 않는 경우가 많다.

## Range 요청 보내기 — bytes= 문법

클라이언트는 원하는 바이트 구간을 `Range` 요청 헤더에 담는다. 가장 기본은 시작-끝을 명시하는 형태다.

```http
GET /video.mp4 HTTP/1.1
Range: bytes=0-1023
```

세 가지 표기를 구분하는 것이 핵심이다.

![Range 바이트 범위 시각화](/assets/posts/http-range-requests-bytes.svg)

```http
Range: bytes=0-1023      # 처음 1024바이트 (0~1023, 끝 포함)
Range: bytes=1024-       # 1024바이트부터 파일 끝까지
Range: bytes=-500        # 파일의 마지막 500바이트
Range: bytes=0-0         # 첫 1바이트만 (존재 확인용)
```

오프셋은 **0부터 시작**하고 끝 오프셋은 **포함(inclusive)**이다. 즉 `bytes=0-1023`은 정확히 1024바이트다. `bytes=1024-`처럼 끝을 비우면 "거기서부터 끝까지", `bytes=-500`처럼 앞을 비우고 음수처럼 쓰면 "끝에서부터 N바이트"를 의미한다 — 이어받기와 꼬리 읽기에서 각각 단골로 쓰인다.

## 206 Partial Content와 Content-Range

서버가 Range를 받아들이면 `200 OK`가 아니라 **`206 Partial Content`**로 응답하고, 어떤 구간을 전체 중 어디에서 잘라 보냈는지를 `Content-Range`로 알려 준다.

![Range 요청-응답 흐름](/assets/posts/http-range-requests-flow.svg)

```http
GET /video.mp4 HTTP/1.1
Range: bytes=0-1023

HTTP/1.1 206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 0-1023/73400320
Content-Length: 1024
Content-Type: video/mp4
```

`Content-Range: bytes 0-1023/73400320`은 "전체 73400320바이트 중 0~1023 구간"이라는 뜻이다. 전체 크기를 모를 때는 `bytes 0-1023/*`처럼 `*`를 쓸 수 있다. 그리고 **`Content-Length`는 전체 파일 크기가 아니라 이번에 보낸 조각의 크기(1024)**라는 점을 헷갈리지 말아야 한다. 전체 크기는 `Content-Range`의 슬래시 뒤에 있다.

curl로 직접 확인해 보면 감이 잡힌다.

```bash
# 처음 1KB만 받기 (-r 은 --range 의 단축)
curl -r 0-1023 -o head.bin https://cdn.example.com/video.mp4

# 마지막 500바이트만
curl -r -500 https://cdn.example.com/video.mp4 -o tail.bin

# 응답 상태와 Content-Range 헤더 확인
curl -s -D - -r 0-1023 -o /dev/null https://cdn.example.com/video.mp4 \
  | grep -iE 'HTTP/|content-range|content-length'
# HTTP/1.1 206 Partial Content
# Content-Range: bytes 0-1023/73400320
# Content-Length: 1024
```

## 416 — 요청한 범위가 파일을 벗어났을 때

파일이 1000바이트뿐인데 `Range: bytes=5000-6000`을 요청하면 서버는 줄 수 있는 게 없다. 이때 **`416 Range Not Satisfiable`**로 응답하고, `Content-Range`에 전체 크기만 담아 "유효 범위는 여기까지"라고 알린다.

```http
GET /small.txt HTTP/1.1
Range: bytes=5000-6000

HTTP/1.1 416 Range Not Satisfiable
Content-Range: bytes */1000
```

클라이언트는 이 응답을 보고 잘못된 오프셋을 보정해야 한다. 참고로 `bytes=0-99999999`처럼 끝이 파일 크기를 넘기만 한 경우는 416이 아니라, 서버가 가진 끝까지 잘라 정상적으로 206을 준다. 416은 **시작 오프셋부터 범위 밖일 때**만 발생한다.

## 다운로드 이어받기와 일시정지

이어받기의 원리는 단순하다. 이미 받은 바이트 수를 세고, 그 다음 바이트부터 `Range`로 요청하면 된다. 다운로드 매니저가 하는 일이 정확히 이것이다.

```bash
# 50MB까지 받다 끊긴 partial.bin 을 이어받기
already=$(stat -c%s partial.bin)        # 예: 52428800
curl -r "${already}-" \
     -o partial.bin --continue-at - \
     https://cdn.example.com/big.iso

# curl 의 -C - 옵션은 위 과정을 자동화한다
curl -C - -o big.iso https://cdn.example.com/big.iso
```

일시정지는 곧 "연결을 끊고 받은 바이트 수를 기억하는 것"이고, 재개는 "그 지점부터 `bytes=N-`을 요청하는 것"이다. 같은 메커니즘으로 한 파일을 여러 구간으로 쪼개 **병렬 다운로드**하면 다운로드 가속기가 된다 — `0-`, `중간-`, `끝-`을 동시에 여러 커넥션으로 받아 합치는 것이다.

## If-Range — 이어받는 사이 파일이 바뀌었다면

이어받기에는 함정이 하나 있다. 50MB를 받은 뒤 잠시 멈춘 사이 서버의 파일이 새 버전으로 교체됐다면? 앞부분은 구버전, 이어받은 뒤는 신버전이 섞여 **파일이 조용히 깨진다**. 이를 막는 조건부 헤더가 `If-Range`다.

```http
GET /big.iso HTTP/1.1
Range: bytes=52428800-
If-Range: "v3-9f8a2c"            # 처음 받을 때의 ETag
```

`If-Range`에 처음 받았을 때의 **ETag(또는 Last-Modified)**를 실어 보내면, 서버는 그 값이 현재 파일과 일치할 때만 206으로 이어 주고, 파일이 바뀌었으면 Range를 무시하고 **`200 OK`로 전체를 처음부터** 보낸다. 클라이언트는 200이 오면 "받던 걸 버리고 새로 받아야 한다"고 판단하면 된다. 부분 응답인 줄 알고 받았는데 200이 왔다면 그게 신호다.

## 멀티파트 byteranges — 여러 구간을 한 번에

하나의 요청으로 **여러 구간**을 동시에 받을 수도 있다. 쉼표로 범위를 나열하면 된다.

```http
GET /movie.mp4 HTTP/1.1
Range: bytes=0-499, 1000-1499

HTTP/1.1 206 Partial Content
Content-Type: multipart/byteranges; boundary=3d6b6a4
Content-Length: 1741
```

이때 응답 본문은 MIME 멀티파트 형식으로, 각 파트가 자기 `Content-Range`를 헤더로 달고 boundary로 구분된다. 다만 파싱이 번거롭고 모든 서버가 지원하지는 않으며 오버헤드도 있어, 실무에서는 **구간마다 별도의 단일 Range 요청을 보내는 쪽**이 흔하다. 멀티파트 byteranges가 온다는 신호는 `Content-Type: multipart/byteranges`이므로, 클라이언트는 이를 보고 본문 파싱 방식을 분기해야 한다.

## 비디오 스트리밍과 시킹

웹 동영상 플레이어가 진행 바를 클릭해 임의 지점으로 점프할 수 있는 것이 바로 Range 덕분이다. `<video>` 요소는 처음에 `Range: bytes=0-`으로 받기 시작하다가, 사용자가 30분 지점을 클릭하면 해당 바이트 오프셋을 계산해 **새 Range 요청**으로 그 부분만 받아 재생을 이어 간다.

```http
# 사용자가 영상 중반으로 시킹했을 때
GET /movie.mp4 HTTP/1.1
Range: bytes=40000000-

HTTP/1.1 206 Partial Content
Content-Range: bytes 40000000-73400319/73400320
```

그래서 브라우저에서 동영상 시킹이 안 된다면 십중팔구 서버가 `Accept-Ranges: bytes`를 주지 않거나 206을 못 내는 경우다. 동영상을 동적으로 프록시하거나 즉석 변환해 내보내면서 Range를 잃어버리는 구성이 대표적인 함정이다.

## nginx에서의 동작과 설정

nginx는 정적 파일에 대해 **별도 설정 없이 기본으로** byte-range를 지원한다. `sendfile`로 파일을 서빙하면 Range 처리가 자동으로 붙는다. 주의할 지점은 압축·캐시와의 상호작용이다.

```nginx
location /downloads/ {
    # 정적 파일은 기본으로 Accept-Ranges: bytes 제공
    sendfile on;

    # gzip 은 응답을 가변 길이로 바꿔 Range 와 충돌할 수 있어
    # 대용량 다운로드 경로에서는 끄는 편이 안전하다
    gzip off;
}

# 캐시에 담긴 파일도 부분 응답이 가능하도록
proxy_cache_path /var/cache keys_zone=z:10m;
location / {
    proxy_cache z;
    proxy_force_ranges on;   # 업스트림이 안 줘도 캐시에서 Range 제공
}
```

핵심은 **압축이 Range를 방해할 수 있다**는 것이다. 동적으로 gzip된 응답은 길이가 미리 정해지지 않아 바이트 오프셋이 무의미해지므로, 대용량 파일 다운로드 경로에서는 압축을 끄거나 미리 압축한 정적 파일을 서빙하는 게 안전하다.

## 정리

- **Accept-Ranges: bytes**로 서버가 부분 전송을 광고하고, 클라이언트는 **`Range: bytes=`**로 구간을 요청한다.
- 성공 시 **206 Partial Content + Content-Range**, 범위 초과 시 **416**. `Content-Length`는 보낸 조각 크기, 전체 크기는 `Content-Range`의 슬래시 뒤에 있다.
- 이어받기는 받은 바이트 수만큼을 `bytes=N-`으로 요청하는 것이고, 그 사이 파일이 바뀌는 위험은 **If-Range + ETag**로 막는다.
- 비디오 시킹·병렬 다운로드·다운로드 매니저가 모두 이 메커니즘 하나를 공유한다. 압축·동적 프록시가 Range를 깨뜨리지 않는지 점검하는 것이 실무의 단골 포인트다.

다음 글에서는 전송 자체가 아니라 "다른 곳으로 보내는" 응답, **HTTP 리다이렉트(3xx)**로 이어진다.

---

**지난 글:** [Zstandard(zstd) 압축 완전 정복 — 차세대 HTTP 압축](/posts/http-compression-zstd/)

**다음 글:** [HTTP 리다이렉트 완전 정복 — 3xx와 Location](/posts/http-redirects/)

<br>
읽어주셔서 감사합니다. 😊
