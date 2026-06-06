---
title: "CDN 심화 — 엣지 로직·다계층 캐시·Anycast·성능 최적화"
description: "CDN의 다계층 캐시(Shield), Anycast vs GeoDNS, 엣지 컴퓨팅(Cloudflare Workers), 캐시 워밍과 Stale-While-Revalidate 전략을 깊이 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["CDN심화", "Anycast", "GeoDNS", "TieredCache", "EdgeComputing", "CloudflareWorkers", "CacheWarming", "Origin Shield"]
featured: false
draft: false
---

[지난 글](/posts/network-cdn/)에서 CDN의 기본 구조와 Cache HIT/MISS 흐름을 다뤘다. 이번 글은 실제 CDN 제공사 내부에서 어떤 일이 벌어지는지, 어떻게 레이턴시를 더 줄이고 Origin 부하를 최소화하는지를 파고든다.

## 다계층 캐시 (Tiered Cache / Origin Shield)

CDN PoP가 전 세계 수백 개 있을 때, 동일 파일에 대해 수백 개 PoP 각각이 Origin에 요청하면 Origin에 엄청난 부하가 걸린다. 이를 해결하는 구조가 **미드티어(Mid-tier) 캐시**다.

![CDN 다계층 캐시 구조](/assets/posts/network-cdn-deep-edge-cache.svg)

- **L1 엣지(PoP)**: 사용자와 가장 가까운 서버. 인메모리 캐시, TTL이 짧고 빠르다.
- **L2 미드티어**: 여러 L1 PoP가 공유하는 중간 계층. 대용량 SSD 캐시. L1 MISS 시 여기로 요청이 간다.
- **Origin**: L2 MISS 시에만 요청이 도달한다.

결과적으로 수백 개 PoP가 Origin을 직접 두드리는 대신, 소수의 미드티어가 집약해서 Origin 요청을 95% 이상 줄인다.

```
# Cloudflare Tiered Cache 설정
Cache Rules → Tiered Cache Topology: Smart
# "Smart" 모드는 HIT율 데이터를 기반으로 최적 미드티어 자동 선택
```

## Anycast vs GeoDNS

CDN이 사용자를 가장 가까운 PoP로 보내는 방법은 두 가지가 있다.

![Anycast vs GeoDNS 비교](/assets/posts/network-cdn-deep-anycast.svg)

### Anycast

동일한 IP 주소를 여러 PoP에서 BGP로 광고한다. 인터넷 라우터가 BGP 경로를 보고 자동으로 가장 짧은 경로의 PoP를 선택한다.

- **장점**: DNS 캐싱 문제 없음, 빠른 장애 복구(BGP 재수렴), 진정한 네트워크 최근접
- **단점**: BGP 설정 복잡, IP 변경 어려움
- **사용**: Cloudflare, Fastly, Google DNS(8.8.8.8)

### GeoDNS (지오그래픽 DNS)

DNS 서버가 클라이언트 IP 기반으로 지역을 파악해 해당 지역 PoP의 IP를 반환한다.

```
# AWS Route 53 지리적 라우팅
api.example.com → 클라이언트가 아시아 → 1.2.3.4 (도쿄 NLB)
api.example.com → 클라이언트가 유럽 → 5.6.7.8 (프랑크푸르트 NLB)
```

- **장점**: 유연한 트래픽 제어, 가중치·헬스 체크 연동
- **단점**: DNS TTL만큼 반응 지연, DNS 리졸버 위치가 클라이언트 위치와 다를 수 있음

## 엣지 컴퓨팅 (Edge Computing)

최신 CDN은 단순 파일 서빙을 넘어 **엣지 서버에서 코드를 직접 실행**한다.

```javascript
// Cloudflare Workers 예시 — A/B 테스트 엣지에서 처리
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const cookie = request.headers.get('Cookie') || '';
  const variant = cookie.includes('variant=B') ? 'B' : 'A';

  // 엣지에서 분기 — Origin 요청 없이 처리
  const url = new URL(request.url);
  url.pathname = `/pages/${variant}${url.pathname}`;
  return fetch(url.toString());
}
```

엣지에서 처리할 수 있는 작업:
- A/B 테스트, 카나리 배포
- 인증 토큰 검증
- 요청/응답 헤더 수정
- 이미지 리사이징 (on-the-fly)
- Bot 탐지 및 차단

## 캐시 워밍 (Cache Warming)

트래픽이 급증하기 전(예: 제품 런칭, 영상 배포) 미리 PoP 캐시를 채워두는 전략이다.

```bash
# 스크립트로 모든 PoP 워밍
POPS=("edge-seoul.cdn.example.com" "edge-tokyo.cdn.example.com" "edge-nyc.cdn.example.com")
URLS=("https://cdn.example.com/video.mp4" "https://cdn.example.com/poster.jpg")

for pop in "${POPS[@]}"; do
  for url in "${URLS[@]}"; do
    curl -s -o /dev/null --resolve "cdn.example.com:443:$pop" "$url" &
  done
done
wait
echo "Cache warming complete"
```

## Stale-While-Revalidate

캐시가 만료됐을 때 즉시 Origin에 요청하면 레이턴시 스파이크가 생긴다. **SWR**은 만료된 캐시를 일단 사용자에게 반환하면서 백그라운드에서 Origin을 재검증한다.

```
# Origin 응답 헤더
Cache-Control: public, max-age=60, stale-while-revalidate=30

# 동작
# 0~60s: 신선한 캐시 즉시 반환
# 61~90s: 만료됐지만 SWR 기간 → 구버전 즉시 반환 + 백그라운드 재검증
# 91s+:   재검증 완료 후 새 버전 캐시 사용
```

SWR의 장점: 캐시 만료 시점에 레이턴시 스파이크가 없다. 사용자는 항상 빠른 응답을 받는다.

## CDN 성능 지표

| 지표 | 의미 | 목표값 |
|---|---|---|
| **Cache Hit Ratio** | 전체 요청 중 HIT 비율 | > 90% |
| **TTFB** | Time to First Byte | < 100ms |
| **Origin Offload** | Origin 트래픽 절감 비율 | > 85% |
| **Edge RTT** | 사용자↔엣지 왕복 지연 | < 20ms |

Hit Ratio가 낮으면 캐시 키 설계나 TTL 설정을 점검해야 한다. 쿼리스트링을 과도하게 캐시 키에 포함하거나 TTL이 지나치게 짧은 경우가 주범이다.

---

**지난 글:** [CDN 완전 정복 — 엣지 서버와 캐싱 전략](/posts/network-cdn/)

**다음 글:** [ss · netstat로 네트워크 연결 상태 파악하기](/posts/network-ss-netstat/)

<br>
읽어주셔서 감사합니다. 😊
