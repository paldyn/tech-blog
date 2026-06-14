---
title: "HTTP 리다이렉트 완전 정복 — 3xx와 Location"
description: "3xx 상태 코드와 Location 헤더로 동작하는 리다이렉트의 원리, 브라우저 주소창 변화, 리다이렉트 체인과 무한 루프, HTTPS 강제와 www 정규화, SEO와 RTT 비용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["리다이렉트", "3xx", "Location", "301", "302", "HSTS", "SEO"]
featured: false
draft: false
---

[지난 글](/posts/http-range-requests/)에서 "필요한 부분만 잘라서 받는" Range 요청을 다뤘다면, 이번엔 응답이 콘텐츠 대신 "다른 곳으로 가라"고 말하는 경우, 곧 **리다이렉트(3xx)**를 다룬다. 주소창에 `example.com`을 치면 어느새 `https://www.example.com`으로 바뀌어 있고, 옮겨진 옛 페이지 URL을 눌러도 새 위치로 자동 이동한다. 이 모든 동작은 서버가 본문 대신 `3xx` 상태 코드와 `Location` 헤더 하나를 돌려주고, 브라우저가 그 주소로 다시 요청하는 단순한 약속 위에 있다.

## 3xx와 Location — 리다이렉트의 뼈대

리다이렉트 응답의 정체는 본문이 거의 없는 가벼운 응답이다. 상태 코드는 `3xx`, 그리고 **다음에 가야 할 주소를 `Location` 헤더**에 담는다.

```http
GET /old-page HTTP/1.1
Host: example.com

HTTP/1.1 301 Moved Permanently
Location: https://example.com/new-page
Content-Length: 0
```

브라우저는 이 응답을 화면에 그리지 않는다. 대신 `Location` 값을 읽어 **그 URL로 새 요청을 자동으로 발사**한다. 사용자 눈에는 페이지가 한 번에 바뀐 것처럼 보이지만 실제로는 두 번의 왕복이 일어난 것이다.

![GET /old → 301 → GET /new → 200 흐름](/assets/posts/http-redirects-flow.svg)

대표적인 3xx 코드는 다음과 같다. 각 코드가 메서드·본문 보존에서 미묘하게 다른데, 그 정밀한 구분은 다음 글의 주제이므로 여기서는 개요만 잡는다.

```
301 Moved Permanently   영구 이동 (브라우저·검색엔진이 기억)
302 Found               임시 이동 (가장 흔히 쓰이는 임시 리다이렉트)
303 See Other           POST 처리 후 GET 페이지로 보낼 때
307 Temporary Redirect  302의 메서드 보존 버전
308 Permanent Redirect  301의 메서드 보존 버전
304 Not Modified        캐시 검증용 (리다이렉트 아님)
```

## 브라우저 동작 — 주소창은 어떻게 바뀌나

리다이렉트를 따라가면 브라우저 **주소창의 URL이 최종 목적지로 바뀐다**. `example.com/old`를 입력해 301로 `/new`에 도착하면 주소창에는 `/new`가 남는다. 사용자가 북마크하거나 복사하는 것은 항상 최종 URL이다. 이 점이 리다이렉트와 (서버가 내부적으로 다른 파일을 응답하는) 내부 rewrite의 결정적 차이다. rewrite는 주소창이 그대로지만, 리다이렉트는 브라우저가 실제로 새 주소로 이동한다.

리다이렉트 응답에는 보통 본문이 없거나 아주 짧은 안내 HTML만 들어간다. 자바스크립트가 꺼진 환경을 위해 `<a href>` 한 줄을 담기도 하지만, 정상 브라우저라면 본문을 볼 일이 없다.

## 절대 Location vs 상대 Location

`Location`에는 절대 URL과 상대 URL을 모두 쓸 수 있다. 과거 RFC는 절대 URL을 요구했지만 현행 표준(RFC 7231 이후)은 상대 참조를 허용하고, 브라우저는 현재 요청 URL을 기준으로 이를 해석(resolve)한다.

```http
# 절대 URL — 호스트·스킴까지 명시 (가장 명확)
Location: https://example.com/new-page

# 상대 경로 — 현재 호스트 기준으로 해석됨
Location: /new-page

# 같은 디렉터리 기준 상대 참조
Location: ../account/login
```

상대 Location은 짧지만 함정이 있다. HTTP→HTTPS 전환처럼 **스킴이나 호스트를 바꿔야 할 때는 반드시 절대 URL**을 써야 한다. 상대 경로는 현재 스킴을 그대로 물려받기 때문이다. 프록시나 로드밸런서 뒤에서는 서버가 인지하는 호스트와 사용자가 친 호스트가 다를 수 있어, 이런 경우에도 명시적 절대 URL이 사고를 줄인다.

## 메서드와 본문 보존 — 개요

리다이렉트에서 가장 많은 버그가 나는 지점이 "**원래 메서드와 본문이 따라가느냐**"다. 역사적 이유로 301·302를 받은 브라우저는 POST 요청을 GET으로 바꿔 따라가는 일이 흔했다. 그래서 결제 POST가 리다이렉트되며 본문을 잃고 GET으로 변질되는 사고가 생긴다.

이를 정확히 제어하려고 만든 것이 **307·308**로, 이들은 원래 메서드와 본문을 그대로 보존한다. 반대로 **303 See Other**는 "POST를 처리했으니 결과 페이지를 GET으로 보라"는 의도를 명시한다(PRG 패턴). 다섯 코드의 정확한 표는 다음 글에서 깊게 파고들 것이므로, 여기서는 "코드 선택이 메서드 보존을 좌우한다"는 사실만 기억하면 된다.

## curl로 리다이렉트 따라가기

curl은 기본적으로 리다이렉트를 따라가지 **않는다**. 3xx 응답을 그대로 보여 줄 뿐이다. 따라가게 하려면 `-L`을 붙인다.

```bash
# 기본: 301 응답 자체를 본다 (따라가지 않음)
curl -sI http://example.com/old
# HTTP/1.1 301 Moved Permanently
# Location: https://example.com/new

# -L: Location 을 끝까지 따라간다
curl -sIL http://example.com/old | grep -iE 'HTTP/|location'
# HTTP/1.1 301 Moved Permanently
# location: https://example.com/new
# HTTP/1.1 200 OK

# 리다이렉트 횟수 제한 (무한 루프 방어)
curl -sL --max-redirs 5 https://example.com/
```

`-I`(HEAD)와 `-L`을 함께 쓰면 각 홉의 상태 코드와 `Location`이 차례로 찍혀, 체인 전체를 한눈에 디버깅할 수 있다.

## 리다이렉트 체인과 무한 루프

리다이렉트는 한 번에 끝나지 않을 수 있다. `A → B → C`처럼 여러 홉을 거치는 **체인**이 생기기도 한다. 흔한 예가 "HTTP에서 HTTPS로, 다시 non-www에서 www로" 두 단계를 따로 걸어 둔 경우다.

![리다이렉트 체인과 무한 루프](/assets/posts/http-redirects-chain.svg)

체인이 자기 자신으로 돌아오면 **무한 리다이렉트 루프**가 된다. `A → B → A → B …`가 끝없이 반복되는 것이다. 브라우저는 이를 감지해 일정 횟수(보통 20회)를 넘기면 `ERR_TOO_MANY_REDIRECTS` 오류를 띄우고 멈춘다.

```bash
# 루프 의심 시 홉을 모두 추적
curl -sIL --max-redirs 10 https://example.com/ \
  | grep -iE 'HTTP/|location'
# ... 같은 Location 이 반복되면 루프
```

루프의 단골 원인은 두 가지다. 하나는 **www↔non-www 규칙이 서로를 가리키는** 설정 충돌이고, 다른 하나는 프록시 뒤에서 서버가 항상 HTTP로 인식해 "HTTPS로 보내라"는 리다이렉트를 무한히 반복하는 경우다. 후자는 `X-Forwarded-Proto` 같은 헤더로 원래 스킴을 판별하도록 고쳐야 한다.

## HTTPS 강제와 HSTS

가장 흔한 리다이렉트 용도는 **HTTP로 들어온 요청을 HTTPS로 올려보내는 것**이다.

```nginx
# nginx: 80 포트의 모든 요청을 https 로 301
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}
```

그런데 이 리다이렉트에는 빈틈이 있다. 첫 `http://` 요청 자체가 암호화되지 않은 채 네트워크를 흐르므로, 그 사이 공격자가 가로채 가짜 사이트로 보낼 여지(SSL stripping)가 있다. 이 첫 평문 왕복마저 없애는 장치가 **HSTS(HTTP Strict Transport Security)**다.

```http
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

한 번 이 헤더를 받은 브라우저는 이후 일정 기간(`max-age`) 동안 해당 도메인을 **요청 전에 알아서 HTTPS로 바꿔** 보낸다. 즉 평문 리다이렉트를 거치지 않고 처음부터 HTTPS로 간다. HSTS의 자세한 동작은 보안 주제로 따로 다룰 만하지만, 리다이렉트와 함께 HTTPS 강제를 완성하는 짝이라는 점만 기억하면 된다.

## www↔non-www 정규화

`example.com`과 `www.example.com`을 둘 다 살아 있게 두면, 같은 콘텐츠가 두 URL로 존재하게 된다. 검색엔진에는 중복 콘텐츠로 보이고, 쿠키와 캐시도 분리된다. 그래서 **한쪽을 표준(canonical)으로 정하고 다른 쪽을 301로 보내는** 정규화가 관행이다.

```nginx
# www 를 떼고 apex 도메인으로 통일
server {
    server_name www.example.com;
    return 301 https://example.com$request_uri;
}
```

방향은 어느 쪽이든 무방하지만 **한 방향으로 일관**되어야 한다. 두 서버 블록이 서로를 가리키면 앞서 본 무한 루프가 된다.

## SEO 관점 — 301은 영구, 302는 임시

검색엔진은 301과 302를 전혀 다르게 취급한다. **301(영구)**은 "이 URL은 영원히 저쪽으로 옮겨졌다"는 신호여서, 검색엔진은 기존 URL이 쌓아 둔 평가(랭킹 시그널)를 새 URL로 이전하고 색인을 갱신한다. 사이트 구조를 바꾸거나 도메인을 옮길 때는 반드시 301을 써야 누적된 SEO 자산을 잃지 않는다.

반면 **302(임시)**는 "원래 URL은 그대로지만 지금만 잠깐 저기로 보낸다"는 의미라, 검색엔진은 기존 URL을 계속 색인에 둔다. 영구 이전인데 실수로 302를 쓰면 평가가 새 URL로 넘어가지 않아 순위가 떨어질 수 있다. **"영구 이전이면 301, 잠깐이면 302"**가 SEO의 기본 원칙이다.

## 리다이렉트의 비용 — 추가 RTT

리다이렉트는 공짜가 아니다. 매 홉마다 **DNS·TCP·TLS 핸드셰이크와 한 번의 왕복(RTT)**이 더 든다. 모바일 네트워크처럼 지연이 큰 환경에서는 홉 하나가 수백 밀리초를 잡아먹는다.

```
요청 흐름과 비용
─────────────────────────────────────────
http://example.com/old   → 301  (+1 RTT)
https://example.com/old  → 301  (+1 RTT)   www 정규화까지 끼면
https://example.com/new  → 200            누적 지연이 커진다
```

그래서 **체인은 최대한 짧게** 유지해야 한다. "HTTP→HTTPS→www 제거→실제 페이지"처럼 홉이 쌓이면, 가능하면 한 번의 리다이렉트로 최종 정규 URL에 바로 보내도록 규칙을 합치는 것이 좋다. 리소스 안에 박힌 옛 URL도 처음부터 최종 URL을 쓰게 고치면 불필요한 홉을 없앨 수 있다.

## 정리

- 리다이렉트는 **3xx 상태 코드 + Location 헤더**이고, 브라우저는 그 주소로 자동 재요청하며 주소창도 최종 URL로 바뀐다.
- `Location`은 절대·상대 모두 가능하지만, **스킴·호스트를 바꿀 때는 절대 URL**이 안전하다. 메서드 보존 여부는 코드(301/302 vs 307/308)가 좌우한다(다음 글 상세).
- 체인은 짧게, **무한 루프**(www 규칙 충돌·프록시 스킴 오판)를 경계한다. HTTPS 강제는 301 + **HSTS**로 완성한다.
- SEO에서는 **영구 이전 301, 임시 302**가 원칙이고, 각 홉은 RTT를 더하므로 비용을 의식해 규칙을 합쳐야 한다.

다음 글에서는 여기서 개요만 잡은 **301·302·303·307·308**의 차이를 메서드·본문·캐시 관점에서 정확히 구분한다.

---

**지난 글:** [Range 요청 완전 정복 — 부분 전송과 이어받기](/posts/http-range-requests/)

**다음 글:** [리다이렉트 심화 — 301·302·303·307·308 정확히 구분하기](/posts/http-redirect-types-deep/)

<br>
읽어주셔서 감사합니다. 😊
