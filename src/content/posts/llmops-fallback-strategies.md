---
title: "LLM Fallback 전략: 장애에도 살아남는 서비스 설계"
description: "Circuit Breaker 패턴, 다중 LLM 제공자 Fallback, Exponential Backoff 재시도, 그레이스풀 디그레이데이션으로 LLM 서비스의 가용성을 높이는 실전 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["LLMOps", "Fallback", "CircuitBreaker", "고가용성", "LiteLLM", "재시도전략", "그레이스풀디그레이데이션"]
featured: false
draft: false
---

[지난 글](/posts/llmops-cache/)에서 시맨틱 캐시로 비용을 줄이는 방법을 다뤘다. 이번 글은 가용성이다. LLM API는 외부 서비스다. 언제든 느려지거나, 다운되거나, 할당량을 초과할 수 있다. 이때 서비스가 통째로 멈추면 안 된다. **Fallback 전략**은 장애를 우아하게 처리하는 방법이다.

2023년 ChatGPT 출시 이후 OpenAI API는 수차례 서비스 중단을 경험했다. Claude API도 예외는 아니다. 단일 LLM 제공자에 의존하는 시스템은 그 제공자의 장애가 곧 자신의 장애가 된다. 결제 시스템이나 재고 조회처럼 대체 수단이 없는 시스템과 달리, LLM은 여러 제공자로 Fallback할 수 있다는 강점이 있다.

## Circuit Breaker + Fallback 체인

![Circuit Breaker + Fallback 체인](/assets/posts/llmops-fallback-circuit-breaker.svg)

Circuit Breaker 패턴은 전기 차단기에서 이름을 따온 개념이다. 오류가 임계값을 초과하면 회로를 "열어" 더 이상 시도하지 않는다. 서비스가 회복되면 "반열림" 상태로 전환해 조금씩 트래픽을 흘려본다.

```python
import time
from enum import Enum
from threading import Lock

class State(Enum):
    CLOSED = "closed"      # 정상: 모든 요청 통과
    OPEN = "open"          # 차단: 모든 요청 즉시 실패
    HALF_OPEN = "half_open"  # 회복 시도: 일부 요청만 통과

class CircuitBreaker:
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        
        self.state = State.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0.0
        self.lock = Lock()

    def call(self, func, *args, **kwargs):
        with self.lock:
            if self.state == State.OPEN:
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = State.HALF_OPEN
                    self.success_count = 0
                else:
                    raise Exception("Circuit OPEN: 서비스 일시 차단 중")

        try:
            result = func(*args, **kwargs)
            with self.lock:
                if self.state == State.HALF_OPEN:
                    self.success_count += 1
                    if self.success_count >= self.success_threshold:
                        self.state = State.CLOSED
                        self.failure_count = 0
                elif self.state == State.CLOSED:
                    self.failure_count = 0
            return result

        except Exception as e:
            with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                if self.failure_count >= self.failure_threshold:
                    self.state = State.OPEN
            raise
```

## 다중 제공자 Fallback

```python
import anthropic
import openai
from typing import Callable

class LLMFallbackChain:
    """여러 LLM 제공자를 순서대로 시도하는 Fallback 체인"""

    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout
        self.claude = anthropic.Anthropic()
        self.openai = openai.OpenAI()
        
        self.breakers = {
            "claude": CircuitBreaker(failure_threshold=3, recovery_timeout=120),
            "openai": CircuitBreaker(failure_threshold=5, recovery_timeout=60),
        }

    def _call_claude(self, prompt: str) -> str:
        response = self.claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            timeout=self.timeout,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text

    def _call_openai(self, prompt: str) -> str:
        response = self.openai.chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            timeout=self.timeout,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content

    def _call_ollama(self, prompt: str) -> str:
        import requests
        r = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "llama3.2", "prompt": prompt, "stream": False},
            timeout=30,
        )
        return r.json()["response"]

    def chat(self, prompt: str) -> dict:
        providers = [
            ("claude", self._call_claude),
            ("openai", self._call_openai),
            ("ollama", self._call_ollama),
        ]

        last_error = None
        for name, func in providers:
            breaker = self.breakers.get(name, CircuitBreaker())
            try:
                result = breaker.call(func, prompt)
                return {"response": result, "provider": name}
            except Exception as e:
                last_error = e
                print(f"[Fallback] {name} 실패: {e}, 다음 제공자 시도...")
                continue

        # 모든 제공자 실패 시 정적 메시지 반환
        return {
            "response": "현재 서비스 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
            "provider": "static_fallback",
            "error": str(last_error),
        }
```

## 재시도 전략: Exponential Backoff with Jitter

![재시도 전략: Exponential Backoff with Jitter](/assets/posts/llmops-fallback-retry.svg)

```python
import random
import time
from functools import wraps

def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 32.0,
    retryable_exceptions: tuple = (Exception,),
):
    """재시도 데코레이터: Exponential Backoff + Full Jitter"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    if attempt == max_retries:
                        raise
                    delay = min(max_delay, base_delay * (2 ** attempt))
                    jittered = delay * (0.5 + random.random() * 0.5)
                    print(f"[Retry] {attempt+1}/{max_retries} 실패: {e}. {jittered:.1f}초 후 재시도")
                    time.sleep(jittered)
        return wrapper
    return decorator

@retry_with_backoff(
    max_retries=3,
    base_delay=1.0,
    retryable_exceptions=(anthropic.RateLimitError, anthropic.APIStatusError),
)
def call_claude(prompt: str) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text
```

## LiteLLM으로 다중 제공자 통합

직접 구현하는 대신 **LiteLLM**을 사용하면 한 인터페이스로 100개 이상의 LLM을 통합 관리할 수 있다.

```python
from litellm import completion, Router

# 가중치 기반 라우팅 + Fallback 설정
router = Router(
    model_list=[
        {
            "model_name": "my-claude",
            "litellm_params": {"model": "claude-sonnet-4-6"},
            "rpm": 50,  # 분당 요청 한도
        },
        {
            "model_name": "my-gpt4o",
            "litellm_params": {"model": "gpt-4o"},
            "rpm": 60,
        },
        {
            "model_name": "my-claude-haiku",
            "litellm_params": {"model": "claude-haiku-4-5-20251001"},
            "rpm": 200,
        },
    ],
    fallbacks=[
        {"my-claude": ["my-gpt4o", "my-claude-haiku"]},  # claude 실패 시 순서대로
    ],
    retry_policy={
        "AuthenticationErrorRetries": 0,
        "TimeoutErrorRetries": 2,
        "RateLimitErrorRetries": 3,
    },
    allowed_fails=2,  # circuit breaker threshold
)

def chat(prompt: str) -> str:
    response = router.completion(
        model="my-claude",
        messages=[{"role": "user", "content": prompt}],
        timeout=10,
    )
    return response.choices[0].message.content
```

## 그레이스풀 디그레이데이션

모든 LLM이 실패해도 서비스가 완전히 멈추지 않도록 **단계적 기능 축소**를 설계한다.

```python
from enum import Enum

class ServiceMode(Enum):
    FULL = "full"          # 모든 기능 정상
    DEGRADED = "degraded"  # 핵심 기능만 (소형 모델)
    MINIMAL = "minimal"    # 캐시된 응답만
    OFFLINE = "offline"    # 정적 안내 메시지

def get_service_mode() -> ServiceMode:
    if claude_breaker.state == State.CLOSED:
        return ServiceMode.FULL
    elif openai_breaker.state != State.OPEN:
        return ServiceMode.DEGRADED
    elif cache.has_recent_responses():
        return ServiceMode.MINIMAL
    return ServiceMode.OFFLINE

def handle_request(query: str) -> str:
    mode = get_service_mode()
    match mode:
        case ServiceMode.FULL:
            return call_claude(query)
        case ServiceMode.DEGRADED:
            return call_openai(query)  # 비용은 높지만 가용성 확보
        case ServiceMode.MINIMAL:
            return cache.get_best_match(query) or "유사한 이전 답변입니다."
        case ServiceMode.OFFLINE:
            return "서비스 점검 중입니다. support@company.com으로 문의 바랍니다."
```

## Fallback 모니터링

```python
from prometheus_client import Counter

fallback_counter = Counter(
    "llm_fallback_total",
    "Number of times fallback was triggered",
    ["from_provider", "to_provider", "reason"],
)

# Fallback 발생 시 기록
fallback_counter.labels(
    from_provider="claude",
    to_provider="openai",
    reason="rate_limit",
).inc()
```

Fallback 발생 빈도가 높아지면 Primary 제공자에 문제가 생겼다는 신호다. 이를 대시보드에서 추세로 모니터링하고, 임계값을 초과하면 온콜 알림을 보낸다.

---

**지난 글:** [LLM 시맨틱 캐시: 반복 요청 비용 제로화 전략](/posts/llmops-cache/)

**다음 글:** [AI 안전성 개요: 신뢰할 수 있는 AI를 만들기 위한 기반](/posts/ai-safety-overview/)

<br>
읽어주셔서 감사합니다. 😊
