---
title: "HTTP 압축 완전 정복 — gzip과 Brotli"
description: "Accept-Encoding 협상과 Vary의 역할, gzip(DEFLATE)과 Brotli의 알고리즘 차이, 정적 사전 압축 vs 동적 실시간 압축 전략, nginx 설정과 압축 금지 대상까지 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["HTTP압축", "gzip", "Brotli", "AcceptEncoding", "Vary", "DEFLATE", "사전압축"]
featured: false
draft: false
---

[지난 글](/posts/http-transfer-vs-content-encoding/)에서 Content-Encoding이 "표현의 일부"라는 위치를 확인했다. 이번 글은 그 자리에 실제로 들어가는 알고리즘들 — 30년 넘게 웹을 지켜온 **gzip**과, 그보다 20% 이상 더 줄여주는 **Brotli** 이야기다. 텍스트 자원은 압축하면 보통 1/3~1/4로 줄어든다. 웹 성능 최적화 중 이만큼 싸고 확실한 수단이 없다.

## 협상 — 누가 어떤 압축을 정하나

압축 알고리즘은 클라이언트와 서버의 **콘텐츠 협상**으로 결정된다.

![압축 협상 흐름](/assets/posts/http-compression-gzip-brotli-negotiation.svg)

```http
# 클라이언트: 내가 풀 수 있는 알고리즘들
GET /app.js HTTP/1.1
Accept-Encoding: gzip, deflate, br, zstd

# 서버: 그중 하나로 압축해 응답
HTTP/1.1 200 OK
Content-Encoding: br
Vary: Accept-Encoding
```

규칙은 단순하다. 서버는 **클라이언트가 선언한 것 중에서만** 고를 수 있고, 겹치는 게 없으면 무압축(identity)으로 보낸다. `br;q=0.9, gzip;q=0.8`처럼 q값으로 선호도를 표현할 수도 있지만, 실무에서는 서버가 자체 우선순위(보통 br > zstd > gzip)로 고른다.

**`Vary: Accept-Encoding`은 선택이 아니라 필수다.** 같은 URL이 브라우저에 따라 br 응답일 수도, gzip 응답일 수도 있다. 중간 캐시(CDN)가 이 사실을 모르면 br 응답을 캐시해 뒀다가 **br을 못 푸는 클라이언트에게 그대로 줘 버린다.** 화면에 바이너리 깨진 글자가 쏟아지는 사고의 전형적인 원인이다.

## gzip — DEFLATE의 다른 이름

`Content-Encoding: gzip`의 실체는 **DEFLATE 알고리즘**(+gzip 헤더/체크섬)이다. DEFLATE는 두 단계로 동작한다.

```
1단계 LZ77: 반복 문자열을 (거리, 길이) 참조로 치환
   "<div class=\"item\"><div class=\"item\">"
   → "<div class=\"item\">" + (거리 19, 길이 19)

2단계 허프만 부호화: 자주 나오는 심볼에 짧은 비트 할당
```

HTML/JS/CSS처럼 같은 패턴이 반복되는 텍스트가 잘 줄어드는 이유가 1단계에, 텍스트가 바이너리보다 잘 줄어드는 이유가 2단계에 있다. gzip의 한계도 구조에서 나온다 — **참조 윈도가 32KB**라서, 32KB보다 멀리 떨어진 반복은 활용하지 못한다.

압축 레벨은 1~9. 레벨이 높을수록 더 열심히 반복을 찾지만 CPU를 더 쓴다. **동적 압축은 4~6**이 압축률/CPU의 균형점으로 통한다 (nginx 기본값은 1이라 명시적으로 올려주는 편이 좋다).

## Brotli — 웹을 위해 다시 설계된 압축

2015년 구글이 내놓은 Brotli(`br`)는 DEFLATE 계보를 잇되 세 가지를 크게 바꿨다.

- **참조 윈도 최대 16MB** — 32KB 너머의 반복도 잡는다. 큰 번들 JS에서 특히 유리.
- **컨텍스트 모델링** — 직전 바이트들의 맥락에 따라 다른 확률 모델을 적용.
- **정적 사전 내장** — HTML 태그, 영어 단어, CSS 속성 등 웹에서 흔한 문자열 13,000여 개가 사양에 포함돼 있다. `"function"`이나 `<div class="`는 처음 등장해도 사전 참조 한 번으로 끝난다.

![gzip vs Brotli 비교](/assets/posts/http-compression-gzip-brotli-compare.svg)

레벨은 0~11. 여기서 실무적으로 중요한 비대칭이 있다.

```
                  압축 속도        압축률 (대략)
gzip -6           ~40MB/s 급      기준
brotli -4         gzip -6과 비슷  gzip보다 ~5-10% 작음
brotli -11        ~0.5MB/s 급     gzip -9보다 ~20-25% 작음
```

**brotli -11은 실시간 압축용이 아니다.** 요청이 올 때마다 -11로 압축하면 TTFB가 압축 시간만큼 밀린다. -11의 용도는 **빌드 타임 사전 압축**이다. 압축은 한 번, 전송은 수백만 번이니 느려도 상관없다. 해제 속도는 레벨과 무관하게 빠르므로 클라이언트는 손해 보지 않는다.

## 실전 전략 — 정적은 미리, 동적은 즉석에서

```nginx
# ── 동적 응답: 실시간 압축 (적당한 레벨) ──
gzip on;
gzip_comp_level 5;
gzip_types text/css application/javascript application/json
           image/svg+xml;
gzip_min_length 1024;        # 1KB 미만은 압축 안 함
gzip_vary on;                # Vary: Accept-Encoding 자동 추가

# ngx_brotli 모듈 사용 시
brotli on;
brotli_comp_level 5;
brotli_types text/css application/javascript application/json;

# ── 정적 자산: 빌드 때 만들어 둔 .br/.gz를 그대로 서빙 ──
brotli_static on;            # app.js.br이 있으면 그걸 전송
gzip_static on;              # 폴백: app.js.gz
```

빌드 파이프라인에서 미리 압축해 두는 부분:

```bash
# 빌드 산출물을 최고 레벨로 사전 압축
find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \
  -o -name '*.svg' \) -exec brotli -q 11 -k {} \; -exec gzip -9 -k {} \;

# dist/app.js  dist/app.js.br  dist/app.js.gz  세 벌이 생긴다
```

결과 확인:

```bash
curl -sI -H 'Accept-Encoding: br' https://example.com/app.js \
  | grep -iE 'content-encoding|content-length|vary'
# content-encoding: br
# content-length: 290816
# vary: Accept-Encoding
```

## 압축하면 안 되는 것들

**이미 압축된 포맷.** JPEG, PNG, WebP, MP4, woff2, zip — 이들을 gzip에 또 넣으면 CPU만 쓰고 오히려 커질 수 있다. `gzip_types`에 텍스트 계열만 나열하는 이유다.

**너무 작은 응답.** 수백 바이트짜리는 gzip 헤더 오버헤드와 CPU가 절약분을 잠식한다. `gzip_min_length 1024` 같은 하한을 둔다.

**HTTPS + 비밀값 + 공격자 입력이 한 응답에 섞이는 경우.** 압축 크기가 내용을 누설하는 부채널이 된다. 공격자가 주입한 문자열이 응답 속 비밀(CSRF 토큰 등)과 일치하면 LZ77 참조 덕에 응답이 미세하게 작아지고, 크기 변화만 관찰해 비밀을 한 글자씩 맞출 수 있다 — 이것이 **BREACH 공격**(2013)이다. 대응은 토큰을 요청마다 마스킹하거나, 민감 응답만 압축을 끄는 것. TLS 계층 압축이 같은 원리(CRIME 공격) 때문에 완전히 제거된 역사도 있다.

## 정리

- 압축은 `Accept-Encoding`(클라이언트 광고) ↔ `Content-Encoding`(서버 선택)의 협상이고, **`Vary: Accept-Encoding`이 캐시 사고를 막는다.**
- gzip = DEFLATE(LZ77 + 허프만), 윈도 32KB, 만능 호환. 동적 압축은 레벨 4~6.
- Brotli = 큰 윈도 + 컨텍스트 모델 + 웹 특화 내장 사전. **정적 자산은 빌드 때 -11로 사전 압축**이 정석.
- 이미 압축된 미디어와 초소형 응답은 건드리지 말 것. 비밀값+공격자 입력이 섞인 응답은 BREACH를 기억할 것.

다음 글에서는 `Accept-Encoding: zstd`로 슬쩍 등장했던 막내 — 페이스북이 만든 **Zstandard(zstd)**가 HTTP 압축의 판도를 어떻게 바꾸고 있는지 다룬다.

---

**지난 글:** [Transfer-Encoding vs Content-Encoding — 두 인코딩의 차이 완전 정복](/posts/http-transfer-vs-content-encoding/)

**다음 글:** [Zstandard(zstd) 압축 완전 정복 — 차세대 HTTP 압축](/posts/http-compression-zstd/)

<br>
읽어주셔서 감사합니다. 😊
