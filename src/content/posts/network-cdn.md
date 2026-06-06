---
title: "CDN 완전 정복 — 엣지 서버와 캐싱 전략"
description: "CDN(콘텐츠 전송 네트워크)의 구조, PoP(Point of Presence), Cache Hit/Miss 동작 원리, Cache-Control 헤더와의 관계를 실무 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["CDN", "엣지서버", "PoP", "CacheHit", "CacheMiss", "CacheControl", "콘텐츠전송네트워크", "글로벌배포"]
featured: false
draft: false
---

[지난 글](/posts/network-load-balancing-l4-l7/)에서 서버 간 트래픽 분산을 다뤘다. 그런데 로드 밸런서로 아무리 서버를 늘려도 해결할 수 없는 문제가 있다. 서울 IDC에 있는 서버로 뉴욕 사용자가 요청을 보내면, 네트워크 거리 때문에 300ms 이상의 레이턴시가 발생한다. 이 문제를 해결하는 것이 **CDN(Content Delivery Network)**이다.

## CDN이란

CDN은 **전 세계 여러 지점(PoP)에 서버를 두고 사용자에게 가장 가까운 서버에서 콘텐츠를 제공**하는 분산 네트워크다. 원본 콘텐츠는 Origin 서버 한 곳에 있지만, 엣지(Edge) 서버가 그 복사본을 캐시해두고 사용자에게 직접 응답한다.

핵심 이점:

- **레이턴시 감소**: 사용자 근처 서버에서 응답하므로 RTT가 극적으로 줄어든다.
- **Origin 부하 경감**: 캐시 히트율이 높으면 Origin에 요청이 거의 안 간다.
- **가용성 향상**: 일부 PoP가 장애여도 다른 PoP가 서비스한다.
- **대역폭 비용 절감**: 비싼 IDC 대역폭 대신 CDN 제공사의 피어링 네트워크 활용.

![CDN 글로벌 엣지 네트워크 구조](/assets/posts/network-cdn-architecture.svg)

## PoP(Point of Presence)

PoP는 **CDN 제공사가 물리적으로 서버를 배치한 거점**이다. 서울, 도쿄, 싱가포르, 런던, 버지니아 등 주요 도시와 인터넷 교환소(IXP)에 있다. 각 PoP에는 엣지 서버(Edge Server)가 수십~수백 대 있으며, 로컬 스토리지에 캐시된 콘텐츠를 보관한다.

사용자가 `cdn.example.com/image.jpg`를 요청하면:
1. DNS Anycast가 사용자 위치를 보고 가장 가까운 PoP의 IP를 반환한다.
2. 사용자는 그 PoP의 엣지 서버에 연결된다.
3. 엣지가 캐시를 갖고 있으면 즉시 응답 (Cache HIT).
4. 없으면 Origin에서 가져와 캐시한 뒤 응답 (Cache MISS).

## Cache HIT와 Cache MISS

![CDN Cache Hit vs Cache Miss 흐름](/assets/posts/network-cdn-cache-flow.svg)

### Cache HIT

엣지 서버가 요청된 콘텐츠를 캐시에 갖고 있는 경우. Origin에 요청이 가지 않으므로 응답이 매우 빠르다. 응답 헤더에 `X-Cache: HIT`가 붙는 경우가 많다.

```
$ curl -I https://cdn.example.com/image.jpg
HTTP/2 200
X-Cache: HIT
Age: 3600          # 3600초 전에 캐시됨
Cache-Control: public, max-age=86400
```

### Cache MISS

엣지가 캐시를 갖고 있지 않은 경우. 엣지가 Origin에 요청을 보내고, 응답을 캐시한 뒤 클라이언트에 전달한다.

```
$ curl -I https://cdn.example.com/new-image.jpg
HTTP/2 200
X-Cache: MISS      # 처음 요청 → Origin에서 가져옴
Age: 0
Cache-Control: public, max-age=86400
```

## Cache-Control 헤더로 캐시 수명 제어

CDN이 얼마나 오래 콘텐츠를 캐시할지는 **Origin 서버의 응답 헤더**가 결정한다.

```
# 정적 파일 (버전닝된 URL)
Cache-Control: public, max-age=31536000, immutable
# → 1년간 캐시, 내용 변경 없음 선언

# HTML (자주 변경)
Cache-Control: public, max-age=300, stale-while-revalidate=60
# → 5분 캐시, 재검증 중에도 60초는 구버전 서비스

# 민감 데이터 (캐시 금지)
Cache-Control: private, no-store
# → CDN이 절대 캐시하지 않음
```

### 캐시 키 (Cache Key)

CDN은 요청 URL 전체(또는 일부)를 키로 캐시를 저장한다. 기본적으로 `Host + Path + Query String`이 키가 된다.

```
# 이 두 요청은 서로 다른 캐시 키
GET /api/search?q=hello  (key1)
GET /api/search?q=world  (key2)
```

쿼리스트링을 무시하도록 설정하거나, 특정 헤더(Accept-Language 등)를 키에 포함하는 방식을 Vary 설정이라 한다.

```
# Origin 응답
Vary: Accept-Encoding
# → Accept-Encoding 헤더가 다르면 별도 캐시 항목 생성
```

## CDN 캐시 무효화 (Purge)

배포 후 낡은 캐시를 즉시 제거해야 할 때 사용한다.

```bash
# Cloudflare API로 특정 파일 Purge
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -d '{"files":["https://example.com/image.jpg"]}'

# AWS CloudFront Invalidation
aws cloudfront create-invalidation \
  --distribution-id EDFDVBD6EXAMPLE \
  --paths "/images/*" "/index.html"
```

Purge는 모든 PoP에 전파되는 데 수~수십 초가 걸린다. 빠른 무효화가 필요하면 파일명에 해시를 포함하는 **파일명 버전닝** 전략이 더 안정적이다.

```
# 버전닝 전략 — Purge 없이 즉시 반영
image-v1.jpg  → image-abc123.jpg (빌드 시 해시 포함)
```

## CDN 사용 범위

| 콘텐츠 | 적합성 | 비고 |
|---|---|---|
| 이미지, 폰트, CSS, JS | 최적 | `max-age` 길게 설정 |
| HTML 페이지 | 조건부 | 자주 변경되면 짧은 TTL |
| API 응답 | 주의 | 사용자별 데이터는 `private` |
| 라이브 스트리밍 | 가능 | 세그먼트 파일 캐시 |
| 개인화 콘텐츠 | 비적합 | 캐시하면 데이터 노출 위험 |

---

**지난 글:** [L4 · L7 로드 밸런서 완전 정복](/posts/network-load-balancing-l4-l7/)

**다음 글:** [CDN 심화 — 엣지 로직·Anycast·성능 최적화](/posts/network-cdn-deep/)

<br>
읽어주셔서 감사합니다. 😊
