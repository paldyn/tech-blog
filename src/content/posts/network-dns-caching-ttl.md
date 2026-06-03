---
title: "DNS 캐싱과 TTL: 빠른 응답의 비밀"
description: "DNS 캐시 히트·미스 동작 원리, TTL 설계 전략, 네거티브 캐싱(NXDOMAIN/NODATA)까지 완전 정리"
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["DNS", "캐싱", "TTL", "NXDOMAIN", "네트워크"]
featured: false
draft: false
---

## DNS 캐싱이란?

DNS 해석 결과를 **일정 시간 동안 로컬 또는 리졸버에 저장**해 동일한 질의를 다시 받았을 때 권한 서버까지 왕복하지 않고 즉시 응답하는 메커니즘입니다. 이 덕분에 `dig example.com` 응답이 1ms 이내에 돌아오기도 합니다.

## 캐시 히트 vs 미스

![DNS 캐싱과 TTL 동작 흐름](/assets/posts/network-dns-caching-ttl-flow.svg)

- **Cache HIT**: 리졸버가 TTL 유효한 레코드를 보유 → 클라이언트에 즉시 반환
- **Cache MISS**: 레코드 없거나 TTL 만료 → 권한 서버까지 재귀 질의 후 새 TTL로 저장

두 경우의 응답 시간 차이는 수 ms vs 수십 ms 수준입니다.

```bash
# 첫 번째 질의 (MISS) — 권한 서버 왕복
dig example.com A
;; Query time: 52 msec

# 두 번째 질의 (HIT) — 리졸버 캐시 반환
dig example.com A
;; Query time: 1 msec
```

## TTL (Time To Live)

TTL은 응답 레코드에 포함된 초 단위 숫자로, **캐시 유효 기간**을 나타냅니다. 리졸버는 레코드를 저장할 때 TTL을 카운트다운하며, 0에 도달하면 캐시를 폐기합니다.

```
example.com.  3600  IN  A  93.184.216.34
              ^^^^
              TTL = 3600초 (1시간)
```

클라이언트가 중간에 조회하면 **남은 TTL**이 줄어든 값으로 응답됩니다.

## 레코드별 TTL 권장값

![TTL 권장값 및 네거티브 캐싱](/assets/posts/network-dns-caching-ttl-values.svg)

| 레코드 | 권장 TTL | 이유 |
|--------|----------|------|
| A / AAAA | 300 ~ 3600s | IP 변경이 필요할 때 빠른 전파 |
| CNAME | 3600 ~ 86400s | 별칭은 자주 바뀌지 않음 |
| MX | 3600 ~ 86400s | 메일 라우팅 안정성 |
| NS | 86400s | 거의 변경 없음 |

### TTL 설계 원칙

- **마이그레이션 전**: TTL을 300s로 낮춰 전파 대기 시간 단축
- **안정 운영 중**: TTL을 3600~86400s로 높여 캐시 효율 향상
- **너무 낮은 TTL(< 60s)**: 권한 서버 부하 급증 위험

## 네거티브 캐싱

존재하지 않는 도메인 질의도 매번 권한 서버까지 가면 낭비입니다. RFC 2308은 **부정 응답(NXDOMAIN/NODATA)도 캐시**하도록 정의합니다.

| 구분 | 의미 | TTL 기준 |
|------|------|----------|
| NXDOMAIN | 도메인 자체 없음 | SOA MINIMUM (최대 10800s) |
| NODATA | 도메인은 있지만 해당 타입 없음 | SOA MINIMUM |

SOA 레코드의 마지막 필드인 MINIMUM이 이 TTL을 결정합니다.

```
example.com. SOA ns1.example.com. admin.example.com. (
    2024010101  ; serial
    3600        ; refresh
    900         ; retry
    604800      ; expire
    3600        ; MINIMUM (네거티브 캐시 TTL)
)
```

## 다계층 캐시

DNS 캐시는 한 곳에만 있지 않습니다.

```
브라우저 캐시
  → OS 스텁 리졸버 (nscd, systemd-resolved)
    → ISP/기업 리졸버 캐시
      → 루트·TLD·권한 서버
```

`dig` 결과에 `Query time: 0 msec`가 나오면 OS 레벨에서 이미 캐시 히트된 것입니다.

### OS 캐시 확인 및 초기화

```bash
# macOS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

# systemd-resolved (Linux)
sudo resolvectl flush-caches

# Windows
ipconfig /flushdns
```

## TTL과 전파 시간

DNS 레코드 변경 시 "전파 시간"은 사실 **이전 TTL 만료 시간**과 같습니다. TTL이 86400s(24h)인 레코드를 변경하면 최대 24시간 동안 일부 사용자가 구 IP를 받을 수 있습니다.

전파 전략:
1. 변경 최소 1 TTL 전에 TTL을 300s로 낮춤
2. TTL 전파 대기(기존 TTL 시간)
3. 레코드 변경
4. 안정화 후 TTL 복원

---

**이전 글:** [DNS 재귀 vs 반복 질의](/posts/network-dns-recursive-iterative/)

**다음 글:** [DNSSEC: DNS 보안 확장](/posts/network-dnssec/)
