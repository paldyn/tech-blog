---
title: "API Rate Limiting: 토큰 버킷·슬라이딩 윈도우·분산 환경 구현"
description: "Fixed Window·Sliding Window·Token Bucket·Leaky Bucket 알고리즘 비교, Redis 기반 분산 구현, 계층별 Rate Limit 설계, 429 응답 표준화, GraphQL/배치 공격 방어를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["RateLimiting", "TokenBucket", "SlidingWindow", "Redis", "DDoS", "API보안", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-graphql-security/)에서 GraphQL 보안의 배치 공격 방어로 Rate Limiting을 언급했다. 이번 글에서는 Rate Limiting을 심층적으로 다룬다. Rate Limiting은 단순한 DDoS 방어 도구가 아니다. 자격증명 브루트포스, 크리덴셜 스터핑, 자원 남용, API 스크래핑을 막는 다목적 방어 계층이다.

## Rate Limiting이 없으면 어떤 일이 생기나

2016년 Pinterest는 Rate Limit 없는 이메일 탐색 API로 수억 개의 이메일 주소가 수집됐다. 2023년 OpenAI API는 Rate Limit 우회 패턴으로 비용이 폭발적으로 증가하는 사례가 보고됐다. 단순히 서버 보호를 넘어 **비용 통제**가 Rate Limiting의 중요한 비즈니스 이유다.

![Rate Limiting 알고리즘 비교](/assets/posts/websec-rate-limit-algorithms.svg)

## 알고리즘 선택 기준

**Fixed Window**는 구현이 가장 간단하지만, 창 경계 공격에 취약하다. 분 경계 직전 100회 + 직후 100회로 사실상 2배 요청이 가능하다.

**Sliding Window Log**는 가장 정확하지만 모든 요청 타임스탬프를 Redis ZSET에 저장해야 해서 메모리 사용이 높다. 사용자당 시간창 크기만큼의 데이터를 유지한다.

**Token Bucket**은 AWS API Gateway, nginx(`limit_req`)의 기본 알고리즘이다. 평상시 토큰을 축적해 두었다가 버스트 트래픽을 소화할 수 있어 UX가 자연스럽다.

**Leaky Bucket**은 출력 속도를 일정하게 유지해 다운스트림 서비스를 보호한다. API 게이트웨이 뒤의 마이크로서비스 보호에 적합하다.

## Redis 기반 분산 구현

![Redis 기반 분산 Rate Limiting 구현](/assets/posts/websec-rate-limit-implementation.svg)

단일 서버 Rate Limiting은 로드밸런서 뒤에서 효과가 없다. 서버 A의 카운터가 서버 B와 공유되지 않기 때문이다. Redis를 공유 저장소로 사용하는 것이 표준 패턴이다.

```python
# FastAPI Rate Limiting 미들웨어
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_url: str):
        super().__init__(app)
        self.redis = redis.from_url(redis_url)

    async def dispatch(self, request: Request, call_next):
        # 엔드포인트별 다른 제한
        limits = {
            "/api/auth/login": (5, 60),    # 분당 5회
            "/api/auth/register": (3, 3600),  # 시간당 3회
            "/api/": (100, 60),            # 기본: 분당 100회
        }
        path = request.url.path
        limit, window = next(
            ((l, w) for p, (l, w) in limits.items() if path.startswith(p)),
            (1000, 60)
        )
        # 사용자 인증 여부에 따른 키
        user_id = getattr(request.state, "user_id", None)
        key = f"rl:{path}:{user_id or request.client.host}"

        allowed = await check_rate_limit_async(key, limit, window)
        if not allowed:
            raise HTTPException(
                status_code=429,
                headers={"Retry-After": str(window)},
                detail={"code": "RATE_LIMITED", "retry_in": window}
            )
        return await call_next(request)
```

## 계층별 Rate Limit 설계

단일 레이트 리미터로는 부족하다. 여러 차원에서 동시에 제한해야 한다.

```python
# 다차원 Rate Limiting
async def check_multilayer_rate_limit(request: Request) -> bool:
    ip = request.client.host
    user_id = getattr(request.state, "user_id", None)
    endpoint = request.url.path

    checks = [
        # IP 기반: DDoS, 스캔 방어
        (f"rl:ip:{ip}", 300, 60),             # IP: 분당 300
        # 사용자 기반: 계정 남용
        (f"rl:user:{user_id}", 100, 60) if user_id else None,
        # 엔드포인트 기반
        (f"rl:ep:{endpoint}:{ip}", 10, 60) if "auth" in endpoint else None,
    ]

    for check in filter(None, checks):
        key, limit, window = check
        if not await check_rate_limit_async(key, limit, window):
            return False
    return True
```

## 429 응답 표준화

429 응답에 클라이언트가 재시도 시점을 알 수 있는 정보를 포함한다. RFC 6585에 따라 `Retry-After` 헤더를 사용한다.

```python
# 429 응답 표준 형식
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        headers={
            "X-RateLimit-Limit": str(exc.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": str(int(time.time()) + exc.retry_after),
            "Retry-After": str(exc.retry_after),
        },
        content={
            "code": "RATE_LIMITED",
            "message": "요청 한도를 초과했습니다.",
            "retry_after_seconds": exc.retry_after,
        }
    )
```

## 분산 환경 원자성 보장

여러 프로세스가 동시에 카운터를 확인하고 증가시키면 경쟁 조건이 생긴다. Lua 스크립트로 원자적 실행을 보장한다.

```lua
-- Redis Lua: 원자적 Token Bucket
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])  -- 초당 토큰 수
local now = tonumber(ARGV[3])

local bucket = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(bucket[1] or capacity)
local last_refill = tonumber(bucket[2] or now)

-- 토큰 보충
local elapsed = now - last_refill
local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

if new_tokens >= 1 then
    redis.call("HMSET", key, "tokens", new_tokens - 1, "last_refill", now)
    redis.call("EXPIRE", key, capacity / refill_rate + 1)
    return 1  -- 허용
else
    return 0  -- 거부
end
```

Rate Limiting은 설정 값이 핵심이다. 너무 엄격하면 정상 사용자를 차단하고, 너무 느슨하면 공격을 막지 못한다. 실제 트래픽 패턴을 분석해 P99 요청 수를 기준으로 제한값을 설정하고, 중요 API(인증, 결제)는 일반 API보다 5~10배 엄격하게 설정하는 것이 실무 기준이다.

---

**지난 글:** [GraphQL 보안: 인트로스펙션·깊이 제한·배치 공격·인가 취약점 방어](/posts/websec-graphql-security/)

**다음 글:** [API 키 관리: 생성·배포·로테이션·폐기 전략 완전 가이드](/posts/websec-api-key-management/)

<br>
읽어주셔서 감사합니다. 😊
