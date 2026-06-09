---
title: "캐시 신선도와 재검증 완전 정복 — max-age, Age, stale-while-revalidate"
description: "HTTP 캐시의 신선도 판단 알고리즘, Age 헤더 계산, 발견적 캐싱, ETag·Last-Modified 기반 조건부 요청, stale-while-revalidate까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["캐시신선도", "캐시재검증", "Age헤더", "ETag", "LastModified", "304응답", "조건부요청"]
featured: false
draft: false
---

[지난 글](/posts/http-cache-control/)에서 Cache-Control 지시어를 살펴봤다. 이번 글에서는 캐시가 **"지금 이 응답이 아직 유효한가"**를 판단하는 신선도 알고리즘과, 만료된 캐시를 효율적으로 갱신하는 **재검증(Validation)** 메커니즘을 완전히 해설한다.

## 신선도(Freshness)란

캐시된 응답이 아직 원본 서버의 응답과 동일하다고 간주되는 상태를 **신선(Fresh)**하다고 한다. 신선하지 않으면 **낡은(Stale)**이라고 한다.

RFC 7234에서 정의된 신선도 계산 알고리즘:

```
freshness_lifetime  = 신선도 유지 시간 (max-age 또는 Expires로 계산)
age                 = 응답이 원본 서버에서 생성된 이후 경과 시간

if age < freshness_lifetime:
    응답은 Fresh → 캐시에서 즉시 반환
else:
    응답은 Stale → 서버에 재검증 필요
```

![캐시 신선도 판단 알고리즘](/assets/posts/http-cache-freshness-validation-freshness.svg)

## freshness_lifetime 계산

우선순위순으로 적용한다.

```
1. Cache-Control: max-age=N    → freshness_lifetime = N
2. Cache-Control: s-maxage=N   → 공유 캐시에만 적용, max-age 대체
3. Expires: HTTP-date          → freshness_lifetime = Expires - Date
4. 발견적 캐싱                  → Last-Modified 기반 계산
```

```http
# 예시 응답
HTTP/1.1 200 OK
Date: Mon, 09 Jun 2026 10:00:00 GMT
Cache-Control: max-age=3600
Expires: Mon, 09 Jun 2026 11:00:00 GMT   # max-age가 우선이므로 무시

# freshness_lifetime = 3600초 = 1시간
```

Cache-Control: max-age와 Expires가 동시에 있으면 **max-age가 우선**한다.

## Age 헤더

응답이 캐시에서 얼마나 오래됐는지를 초 단위로 나타낸다.

```http
HTTP/1.1 200 OK
Date: Mon, 09 Jun 2026 10:00:00 GMT
Cache-Control: max-age=3600
Age: 120     # 이 응답은 캐시에서 2분 동안 보관됨
```

Age는 CDN이나 프록시가 설정한다. 브라우저 캐시에서는 일반적으로 없다.

```
현재 시각: 10:10:00 (Date로부터 600초 경과)
Age: 120 (캐시가 10:08:00에 원본에서 가져옴 → 2분 보관)
apparent_age = current_time - date_value = 600초
corrected_age_value = max(apparent_age, age_value) = 600초

신선도 판단:
  freshness_lifetime = 3600
  age = 600
  600 < 3600 → Fresh ✓
```

## 발견적 캐싱 (Heuristic Caching)

서버가 Cache-Control이나 Expires를 제공하지 않을 때, 캐시는 **발견적 방법**으로 freshness_lifetime을 추정한다.

```
Last-Modified가 있을 때:
  freshness_lifetime = (Date - Last-Modified) × 0.1
  
예시:
  Date: 2026-06-09T10:00:00Z
  Last-Modified: 2026-06-01T10:00:00Z
  차이 = 8일 = 691200초
  freshness_lifetime = 691200 × 0.1 = 69120초 ≈ 19시간
  
  즉 "19시간 전에 변경됐으니, 8일 만에 한 번 변경되는 리소스는
  앞으로 ~19시간 정도 유효할 것"이라고 추정
```

브라우저와 CDN마다 구현이 다를 수 있으며, RFC는 발견적 TTL의 상한을 24시간으로 권장한다.

**실무 권장**: 모든 캐시 가능한 응답에 `Cache-Control: max-age=N`을 명시해 발견적 캐싱에 의존하지 않도록 하라.

## 조건부 요청 (Conditional Requests)

캐시된 응답이 Stale이 되면, 전체 응답을 다시 받는 대신 **"아직도 같은 내용인가?"** 를 확인하는 조건부 요청을 보낸다.

![조건부 요청과 304 Not Modified](/assets/posts/http-cache-freshness-validation-conditional.svg)

### 검증자 (Validators)

서버는 응답에 검증자를 포함시킨다.

```http
# 강한 검증자: ETag (권장)
ETag: "a1b2c3d4e5f6"

# 약한 검증자: Last-Modified
Last-Modified: Mon, 09 Jun 2026 10:00:00 GMT
```

**ETag**는 리소스의 현재 버전을 나타내는 불투명 식별자다. 내용이 조금이라도 바뀌면 값이 달라진다.

**Last-Modified**는 1초 단위의 시간 해상도 때문에 1초 내 변경을 감지하지 못하는 한계가 있다. ETag가 더 정확하다.

### If-None-Match / If-Modified-Since

캐시는 검증자를 다음 조건부 헤더로 서버에 전달한다.

```http
GET /page.html HTTP/1.1
If-None-Match: "a1b2c3d4e5f6"           # ETag 기반
If-Modified-Since: Mon, 09 Jun 2026 10:00:00 GMT  # Last-Modified 기반

# 응답: 변경 없음
HTTP/1.1 304 Not Modified
Cache-Control: max-age=3600     # TTL 갱신
ETag: "a1b2c3d4e5f6"           # 동일한 ETag
                                 # 바디 없음!

# 응답: 변경됨
HTTP/1.1 200 OK
Cache-Control: max-age=3600
ETag: "x9y8z7w6v5u4"           # 새 ETag
Content-Type: text/html
[새 바디]
```

**304 Not Modified**는 바디 없이 헤더만 포함한다. 캐시는 304를 받으면 저장된 응답의 헤더를 업데이트하고 본문은 기존 캐시에서 사용한다. 대역폭을 크게 절감한다.

If-None-Match와 If-Modified-Since 모두 있으면 **If-None-Match 우선**이다.

### ETag 유형

```http
# 강한 ETag (Strong): 바이트 단위 동일
ETag: "abc123"

# 약한 ETag (Weak): 의미적으로 동일 (세부 표현 차이 허용)
ETag: W/"abc123"
```

약한 ETag는 gzip 압축 여부 등 인코딩이 달라도 같은 콘텐츠면 동일하게 취급한다.

## stale-while-revalidate

캐시가 만료됐을 때 재검증 동안 사용자를 기다리게 하는 대신, **낡은 응답을 즉시 반환하면서 배경에서 비동기 재검증**을 한다.

```http
Cache-Control: max-age=60, stale-while-revalidate=600
```

```
시간대별 동작:
  0~60초:   Fresh → 즉시 반환
  61~660초: Stale → 기존 캐시 즉시 반환 + 배경 재검증
  660초 이후: Stale 허용 시간 초과 → 반드시 재검증 완료 후 반환
```

사용자는 항상 즉각적인 응답을 받으면서, 최신 데이터로 조용히 갱신된다. SWR(Stale-While-Revalidate) 패턴은 React의 `useSWR` 라이브러리 이름의 어원이기도 하다.

## Cache-Busting 전략

서버에서 업데이트를 즉시 반영해야 할 때 캐시된 버전을 무효화하는 방법들:

```html
<!-- 1. 파일명에 콘텐츠 해시 포함 (권장) -->
<script src="/app.a1b2c3d4.js"></script>
<link rel="stylesheet" href="/styles.e5f6g7h8.css">

<!-- 2. 쿼리 스트링 버전 파라미터 -->
<script src="/app.js?v=2.3.1"></script>

<!-- 3. CDN/프록시 퍼지(Purge) API -->
# Cloudflare 캐시 퍼지
curl -X DELETE "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"files":["https://example.com/page.html"]}'
```

파일명 해시 방식이 가장 안정적이다. CDN이 파일을 1년 캐시해도 파일명이 바뀌면 새 URL로 즉시 갱신된다.

## 캐시 헤더 디버깅

```bash
# curl로 캐시 헤더 확인
curl -sv https://example.com/page.html 2>&1 | grep -E "(cache|age|etag|last-mod)" -i

# 응답 예시
< cache-control: public, max-age=3600
< age: 450         # 7.5분 된 캐시 응답
< etag: "abc123"
< last-modified: Mon, 09 Jun 2026 09:00:00 GMT

# 캐시 히트 여부 확인
< cf-cache-status: HIT    # Cloudflare
< x-cache: Hit from cloudfront   # AWS CloudFront
< x-cache-hits: 12        # Varnish
```

```python
# Python requests로 조건부 요청 구현
import requests

def conditional_get(url: str, cached_etag: str = None, 
                    cached_last_modified: str = None) -> dict:
    headers = {}
    if cached_etag:
        headers['If-None-Match'] = cached_etag
    if cached_last_modified:
        headers['If-Modified-Since'] = cached_last_modified
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 304:
        return {"cached": True, "data": None}
    
    return {
        "cached": False,
        "data": response.json(),
        "etag": response.headers.get('ETag'),
        "last_modified": response.headers.get('Last-Modified')
    }
```

## 실무 캐시 전략 정리

```
리소스 유형        | max-age    | 재검증     | 비고
─────────────────────────────────────────────────────
HTML 페이지        | 0 / no-cache | ETag      | 항상 최신
API 응답 (공개)    | 60~300초   | ETag      | stale-while-revalidate 활용
API 응답 (사용자) | 0           | 없음       | private
정적 에셋 (해시)  | 1년         | 없음       | immutable
정적 에셋 (버전X) | 1시간~1일  | ETag      | 캐시 버스팅 필요
민감 데이터        | no-store   | -          | 저장 금지
```

---

**지난 글:** [Cache-Control 완전 정복 — 캐시 지시어 해설](/posts/http-cache-control/)

<br>
읽어주셔서 감사합니다. 😊
