---
title: "LLM API 속도 제한: Rate Limiting 전략과 구현"
description: "Token Bucket·Sliding Window·Fixed Window 알고리즘 비교, LLM 특화 토큰 기반 Rate Limiting, Redis 분산 구현, FastAPI 미들웨어 통합까지 완전 가이드."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["Rate Limiting", "속도제한", "Token Bucket", "Sliding Window", "Redis", "FastAPI", "LLM서빙"]
featured: false
draft: false
---

[지난 글](/posts/serving-streaming/)에서 SSE 스트리밍으로 LLM 응답을 실시간 전송하는 방법을 다뤘다. API 서버를 외부에 노출하면 반드시 마주치는 문제가 있다. 악의적인 사용자의 남용, 단일 클라이언트의 과도한 요청, 갑작스러운 트래픽 폭주가 전체 서비스를 다운시킬 수 있다. Rate Limiting은 이를 방어하는 필수 메커니즘이다.

## LLM API의 Rate Limiting이 특별한 이유

일반 API와 달리 LLM API는 **요청 하나가 소비하는 자원이 크게 다르다**. 10토큰짜리 질문과 4096토큰짜리 문서 요약은 요청 수로는 동일하지만, GPU 연산과 메모리 사용량은 수백 배 차이가 난다. 따라서 LLM Rate Limiting은 요청 수뿐 아니라 **토큰 수(입력+출력)**를 함께 제한해야 한다.

```
LLM Rate Limiting 주요 차원
├── 요청 수 (RPM: Requests Per Minute)
│   예: 60 RPM → 분당 최대 60번 호출
├── 입력 토큰 (Input TPM: Tokens Per Minute)
│   예: 100,000 TPM → 분당 최대 100K 입력 토큰
├── 출력 토큰 (Output TPM)
│   예: 50,000 TPM → 분당 최대 50K 출력 토큰
└── 동시 요청 (Concurrency)
    예: 최대 10개 요청 동시 처리
```

![Rate Limiting 알고리즘 비교](/assets/posts/serving-rate-limiting-algorithms.svg)

## 주요 알고리즘 비교

### Token Bucket (토큰 버킷)

가장 유연하고 널리 쓰이는 알고리즘이다. 버킷에 토큰이 일정 속도로 채워지고, 요청이 올 때마다 토큰을 소비한다. 버킷이 꽉 차면 초과 토큰은 버려진다. 버스트 트래픽을 자연스럽게 허용하면서도 평균 처리율을 제한할 수 있다.

```python
import time
import asyncio

class TokenBucket:
    def __init__(self, rate: float, capacity: float):
        """
        rate: 초당 토큰 보충 속도
        capacity: 버킷 최대 용량
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: float = 1.0) -> bool:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            
            # 경과 시간만큼 토큰 보충
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.rate
            )
            self.last_refill = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True  # 허용
            return False  # 거부

# 사용 예
bucket = TokenBucket(rate=10, capacity=100)  # 초당 10, 최대 100 버스트

async def handle_request():
    if await bucket.acquire(tokens=1):
        return "처리됨"
    return "429 Too Many Requests"
```

### Sliding Window Counter (슬라이딩 윈도우)

현재 시각을 기준으로 지난 N분 내 요청 수를 정확히 추적한다. Fixed Window와 달리 창의 경계에서 버스트가 발생하지 않는다. Redis의 Sorted Set을 사용하면 분산 환경에서도 정확하게 구현할 수 있다.

```python
import redis.asyncio as aioredis
import time

class SlidingWindowRL:
    def __init__(self, redis_url: str, limit: int, window_secs: int):
        self.r = aioredis.from_url(redis_url)
        self.limit = limit
        self.window = window_secs

    async def is_allowed(self, key: str) -> tuple[bool, int]:
        """(허용 여부, 남은 요청 수) 반환"""
        now = time.time()
        window_start = now - self.window

        pipe = self.r.pipeline()
        # 윈도우 밖 오래된 항목 제거
        pipe.zremrangebyscore(key, 0, window_start)
        # 현재 요청 타임스탬프 추가
        pipe.zadd(key, {f"{now}-{id(pipe)}": now})
        # 윈도우 내 요청 수 카운트
        pipe.zcard(key)
        # TTL 설정 (메모리 누수 방지)
        pipe.expire(key, self.window)
        _, _, count, _ = await pipe.execute()

        allowed = count <= self.limit
        remaining = max(0, self.limit - count)
        return allowed, remaining

    async def get_headers(self, key: str) -> dict:
        """Rate Limit 정보를 응답 헤더에 포함"""
        allowed, remaining = await self.is_allowed(key)
        return {
            "X-RateLimit-Limit": str(self.limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(int(time.time()) + self.window),
        }
```

## LLM 특화 토큰 기반 Rate Limiting

요청 수와 토큰 수를 동시에 제한하는 LLM 전용 Rate Limiter를 구현한다.

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class RateLimitConfig:
    rpm: int = 60              # 분당 요청 수
    input_tpm: int = 100_000   # 분당 입력 토큰
    output_tpm: int = 50_000   # 분당 출력 토큰
    max_concurrent: int = 10   # 최대 동시 요청

class LLMRateLimiter:
    def __init__(self, redis_url: str, config: RateLimitConfig):
        self.r = aioredis.from_url(redis_url)
        self.cfg = config
        self._semaphore = asyncio.Semaphore(config.max_concurrent)
        self._sw = SlidingWindowRL(redis_url, config.rpm, 60)

    async def check_and_reserve(
        self,
        api_key: str,
        estimated_input_tokens: int,
    ) -> tuple[bool, dict]:
        """요청 전 사전 검사 및 예약"""
        # 1. 요청 수 제한
        allowed, remaining_req = await self._sw.is_allowed(f"rpm:{api_key}")
        if not allowed:
            return False, {"error": "RPM limit exceeded", "retry_after": 60}

        # 2. 입력 토큰 제한
        tok_key = f"tpm:{api_key}"
        current_tpm = int(await self.r.get(tok_key) or 0)
        if current_tpm + estimated_input_tokens > self.cfg.input_tpm:
            return False, {"error": "TPM limit exceeded", "retry_after": 60}

        # 토큰 예약 (요청 완료 후 실제 토큰 수로 정산)
        await self.r.incrby(tok_key, estimated_input_tokens)
        await self.r.expire(tok_key, 60)
        return True, {"remaining_requests": remaining_req}

    async def settle(self, api_key: str, actual_tokens: int, estimated: int):
        """요청 완료 후 실제 토큰으로 정산"""
        diff = actual_tokens - estimated
        if diff > 0:
            await self.r.incrby(f"tpm:{api_key}", diff)
        elif diff < 0:
            await self.r.decrby(f"tpm:{api_key}", -diff)
```

## FastAPI 미들웨어 통합

![Redis 분산 Rate Limiting 구현](/assets/posts/serving-rate-limiting-implementation.svg)

```python
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

app = FastAPI()
rl_cfg = RateLimitConfig(rpm=60, input_tpm=100_000, max_concurrent=20)
limiter = LLMRateLimiter("redis://localhost:6379", rl_cfg)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # 헬스체크는 제외
    if request.url.path in {"/health", "/v1/models"}:
        return await call_next(request)

    api_key = request.headers.get("Authorization", "")[7:]  # Bearer 제거
    if not api_key:
        return JSONResponse({"error": "API key required"}, status_code=401)

    # 사전 예약 (입력 토큰 추정: 헤더에서 파악하거나 기본값 사용)
    allowed, info = await limiter.check_and_reserve(api_key, estimated_input_tokens=1000)
    if not allowed:
        return JSONResponse(
            {"error": info["error"]},
            status_code=429,
            headers={
                "Retry-After": str(info.get("retry_after", 60)),
                "X-RateLimit-Reason": info["error"],
            },
        )

    response = await call_next(request)
    # 실제 토큰 수 정산은 응답 후 비동기 처리
    return response
```

## 계층별 Rate Limiting 전략

실전에서는 여러 계층에 Rate Limiting을 배치한다.

```
클라이언트 → Nginx → API 게이트웨이 → FastAPI → vLLM

Nginx 레벨:   IP별 연결 수 제한 (DDoS 방어)
              limit_conn_zone $binary_remote_addr zone=llm:10m;
              limit_conn llm 20;

게이트웨이:   API 키별 RPM/TPM 제한 (비즈니스 로직)
              → Redis 슬라이딩 윈도우

FastAPI:      동시성 제한 (GPU 과부하 방지)
              → asyncio.Semaphore(max_concurrent=50)

vLLM:         max_num_seqs 설정 (KV 캐시 보호)
              → max_num_seqs=256
```

## 429 응답과 클라이언트 재시도

Rate Limit을 초과했을 때 클라이언트가 올바르게 처리하려면 응답 헤더가 중요하다.

```python
# 서버: 명확한 Rate Limit 헤더 포함
def rate_limit_exceeded_response() -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "message": "Rate limit exceeded. Please slow down.",
                "type": "rate_limit_error",
                "code": "rate_limit_exceeded",
            }
        },
        headers={
            "Retry-After": "60",
            "X-RateLimit-Limit-Requests": "60",
            "X-RateLimit-Remaining-Requests": "0",
            "X-RateLimit-Reset-Requests": str(int(time.time()) + 60),
        },
    )

# 클라이언트: 지수 백오프 재시도
import asyncio

async def call_with_retry(client, messages, max_retries=5):
    for attempt in range(max_retries):
        try:
            return await client.chat.completions.create(
                model="llama-3.1-8b-instruct",
                messages=messages,
            )
        except Exception as e:
            if "429" in str(e) or "rate_limit" in str(e).lower():
                wait = min(2 ** attempt, 64)  # 최대 64초
                print(f"Rate limit. {wait}초 후 재시도...")
                await asyncio.sleep(wait)
            else:
                raise
    raise RuntimeError("최대 재시도 초과")
```

## 정리

LLM API Rate Limiting의 핵심:

- **요청 수(RPM) + 토큰 수(TPM)** 두 차원을 함께 제한한다
- **Sliding Window Counter + Redis**가 분산 환경 최적 조합
- **계층별 방어**: Nginx(IP) → 게이트웨이(API 키) → 애플리케이션(동시성) → 엔진(KV 캐시)
- **429 응답**에 `Retry-After` 헤더를 반드시 포함해 클라이언트 재시도를 안내한다

---

**지난 글:** [LLM 스트리밍 완전 가이드: SSE부터 WebSocket까지](/posts/serving-streaming/)

**다음 글:** [LLM 서빙 비용 최적화: 토큰·GPU·캐싱 전략](/posts/serving-cost-optimization/)

<br>
읽어주셔서 감사합니다. 😊
