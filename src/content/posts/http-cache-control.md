---
title: "Cache-Control 완전 정복 — 캐시 지시어 완전 해설"
description: "Cache-Control 헤더의 요청/응답 지시어(max-age, no-cache, no-store, private, public, s-maxage, immutable) 전체를 실무 예시 중심으로 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["CacheControl", "HTTP캐시", "max-age", "no-cache", "no-store", "immutable", "CDN캐시"]
featured: false
draft: false
---

[지난 글](/posts/http-sessions/)에서 HTTP 세션 관리를 살펴봤다. 이번 글에서는 HTTP 성능 최적화의 핵심인 **Cache-Control 헤더**의 모든 지시어를 완전히 해설한다. "no-cache가 캐시 안 함"이라는 오해도 여기서 완전히 바로잡는다.

## HTTP 캐시 구조

![Cache-Control 지시어 분류](/assets/posts/http-cache-control-directives.svg)

HTTP 캐시는 세 위치에 존재한다.

```
클라이언트 → [브라우저 캐시] → [공유 캐시(CDN/프록시)] → 원본 서버
```

- **브라우저 캐시(Private Cache)**: 특정 사용자만을 위한 캐시. 개인화 응답에 적합.
- **공유 캐시(Shared Cache, CDN)**: 여러 사용자가 공유. 정적 리소스에 적합.
- **원본 서버**: 캐시 히트 실패 시 최종 요청 대상.

Cache-Control 지시어는 이 캐시들이 어떻게 동작할지를 제어한다.

## 응답 지시어 (서버 → 캐시)

### max-age=N

캐시가 응답을 **N초 동안 신선(fresh)한 것으로 취급**한다. 이 기간에는 원본 서버에 재요청 없이 캐시에서 즉시 반환한다.

```http
Cache-Control: max-age=3600       # 1시간 캐시
Cache-Control: max-age=86400      # 1일 캐시
Cache-Control: max-age=31536000   # 1년 캐시
Cache-Control: max-age=0          # 항상 재검증 필요
```

### s-maxage=N

**공유 캐시(CDN)** 전용 TTL이다. max-age보다 우선한다. 브라우저 캐시에는 영향을 주지 않는다.

```http
# 브라우저: max-age=60 (1분)
# CDN: s-maxage=3600 (1시간)
Cache-Control: max-age=60, s-maxage=3600, public
```

CDN에서 오래 캐시해두고 브라우저는 자주 갱신하도록 할 때 유용하다.

### public

브라우저와 CDN **모두** 캐시 가능하다. 인증 없이 공개된 콘텐츠에 적합하다.

```http
Cache-Control: public, max-age=3600
```

기본적으로 인증이 필요한 응답(`Authorization` 헤더 포함 요청)은 공유 캐시에 저장되지 않는다. `public`을 명시하면 강제로 허용할 수 있다—하지만 매우 주의해야 한다.

### private

**브라우저 캐시만** 저장 가능하다. CDN은 저장할 수 없다. 사용자별 개인화 응답에 사용한다.

```http
Cache-Control: private, max-age=600
```

로그인한 사용자의 프로필 페이지처럼 사용자마다 다른 콘텐츠에 설정한다.

### no-cache

**캐시에 저장은 하되, 사용 전에 원본 서버에 재검증**을 요청한다. "캐시 안 함"이 아니다.

```http
Cache-Control: no-cache
```

```
동작 흐름:
1. 브라우저가 캐시된 응답을 가지고 있음
2. 요청 시 캐시를 바로 사용하지 않고 서버에 "아직 유효한가?" 확인
3. 서버: 변경 없으면 304 Not Modified → 캐시된 응답 사용
4. 서버: 변경됐으면 200 OK + 새 응답
```

`no-cache`는 매번 네트워크 왕복이 발생하지만, 304 응답으로 **전송 데이터를 최소화**할 수 있다.

### no-store

캐시에 **전혀 저장하지 말 것**을 지시한다. 민감한 데이터(금융 정보, 개인정보, 의료 기록)에 사용한다.

```http
Cache-Control: no-store, no-cache   # 강조를 위해 함께 사용하기도 함
```

no-store는 응답의 어떤 부분도 디스크나 메모리에 저장하지 않는다. 요청할 때마다 원본 서버에서 새로 가져온다.

### immutable

콘텐츠가 **절대 변경되지 않는다**고 선언한다. 브라우저가 max-age 기간 동안 재검증 요청을 완전히 생략한다.

```http
Cache-Control: public, max-age=31536000, immutable
```

콘텐츠 해시가 파일명에 포함된 정적 에셋(예: `app.a1b2c3.js`, `logo.4f5e6d.png`)에 사용한다. 파일이 변경되면 URL 자체가 바뀌므로 캐시 무효화가 자동으로 이루어진다.

### stale-while-revalidate=N

캐시가 만료(Stale)됐어도 **N초 동안은 낡은 응답을 반환하면서 배경에서 재검증**한다.

```http
Cache-Control: max-age=60, stale-while-revalidate=86400
```

```
동작:
- 0~60초: 신선한 캐시 반환
- 61초~86460초(1일): 낡은 캐시 즉시 반환 + 배경 재검증
- 86460초 이후: 낡은 캐시 더 이상 사용 불가, 반드시 재검증
```

페이지 로드 지연 없이 최신 데이터를 유지할 수 있는 강력한 패턴이다.

### stale-if-error=N

원본 서버 오류(5xx) 시 **N초 동안 낡은 캐시를 폴백**으로 반환한다.

```http
Cache-Control: max-age=3600, stale-if-error=86400
```

서버 장애 시에도 사용자에게 캐시된 페이지를 보여줄 수 있다.

## 요청 지시어 (클라이언트 → 서버)

클라이언트가 캐시 동작을 제어하려면 요청 Cache-Control을 사용한다.

```http
# 캐시 무시하고 원본에서 강제 갱신
Cache-Control: no-cache

# 캐시만 사용, 원본 접근 금지 (오프라인 모드)
Cache-Control: only-if-cached

# 최소 N초 이상 신선한 캐시만 사용
Cache-Control: min-fresh=300

# 최대 N초까지 만료된 캐시도 허용
Cache-Control: max-stale=600
```

브라우저의 강제 새로고침(Ctrl+F5)은 내부적으로 `Cache-Control: no-cache`를 요청에 추가한다.

## 실무 캐싱 전략

![캐시 저장 흐름](/assets/posts/http-cache-control-flow.svg)

### 리소스 유형별 캐싱 전략

```http
# HTML 페이지 (자주 변경, 최신성 중요)
Cache-Control: no-cache
Vary: Accept-Encoding

# 콘텐츠 해시 정적 에셋 (app.a1b2c3.js)
Cache-Control: public, max-age=31536000, immutable

# CDN 공유 이미지 (드물게 변경)
Cache-Control: public, max-age=86400, s-maxage=604800
Vary: Accept   # WebP 지원 여부에 따라 다른 이미지

# API 응답 (사용자별 개인화)
Cache-Control: private, max-age=300, stale-while-revalidate=3600

# 민감 데이터
Cache-Control: no-store, no-cache
Pragma: no-cache   # HTTP/1.0 호환
```

### Nginx 설정 예시

```nginx
server {
    # HTML 파일: no-cache
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }
    
    # 해시 에셋: 1년 immutable
    location ~* \.(js|css)$ {
        if ($uri ~* "[a-f0-9]{8}") {
            add_header Cache-Control "public, max-age=31536000, immutable";
        }
    }
    
    # 이미지: 1주일
    location ~* \.(jpg|jpeg|png|gif|webp|svg)$ {
        add_header Cache-Control "public, max-age=604800";
    }
}
```

### Cache-Control vs Expires

```http
# HTTP/1.0: Expires (절대 날짜)
Expires: Thu, 01 Jan 2027 00:00:00 GMT

# HTTP/1.1: Cache-Control (상대값, 더 강력)
Cache-Control: max-age=86400
```

`Cache-Control: max-age`가 `Expires`보다 **우선**한다. 둘 다 있으면 Cache-Control이 적용된다. 현대 서버는 Cache-Control만 사용해도 충분하다.

### no-cache vs no-store 헷갈리지 않기

```
no-cache  ≠ "캐시 없음"
         = "캐시는 하되, 사용 전 서버에 확인"
         → 304로 대역폭 절감 가능

no-store  = "절대 저장 금지"
         → 매번 원본에서 완전히 새로 받음
         → 민감 정보에 사용
```

---

**지난 글:** [HTTP 세션 관리 완전 정복](/posts/http-sessions/)

**다음 글:** [캐시 신선도와 재검증 완전 정복](/posts/http-cache-freshness-validation/)

<br>
읽어주셔서 감사합니다. 😊
