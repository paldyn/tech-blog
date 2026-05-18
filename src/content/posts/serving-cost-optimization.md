---
title: "LLM 서빙 비용 최적화: 토큰·GPU·캐싱 전략"
description: "모델 라우팅, 프롬프트 압축, Semantic Cache, 배치 처리, 양자화까지 LLM 서빙 비용을 90% 이상 절감하는 5계층 전략을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["비용최적화", "Semantic Cache", "모델라우팅", "LLM서빙", "GPU비용", "프롬프트압축"]
featured: false
draft: false
---

[지난 글](/posts/serving-rate-limiting/)에서 Rate Limiting으로 서버를 남용으로부터 보호하는 방법을 살펴봤다. 이번 글은 LLM 서빙에서 가장 현실적인 문제인 비용을 다룬다. GPT-4급 API를 아무 최적화 없이 쓰면 금세 수천만 원 청구서가 날아온다. 적절한 전략을 조합하면 동일한 서비스를 10분의 1 비용으로 운영할 수 있다.

## LLM 비용의 구조

LLM 서빙 비용은 크게 두 가지로 나뉜다.

**API 비용** (OpenAI, Claude, Gemini 등 사용 시): 입력 토큰 수 × 가격 + 출력 토큰 수 × 가격. 출력 토큰이 입력 토큰보다 보통 2~4배 비싸다.

**자체 서빙 비용**: GPU 시간 × 가격. A100 80GB 온디맨드 비용은 월 약 300만~500만 원이다. GPU 활용률이 낮으면 그만큼 낭비다.

![LLM 서빙 비용 최적화 레이어](/assets/posts/serving-cost-optimization-layers.svg)

## ① 모델 라우팅: 오버스펙 방지

단순한 질문에 GPT-4o를 쓰는 것은 볼트 조이는 데 전동 드라이버 대신 공장 로봇을 쓰는 격이다. 요청 복잡도를 자동으로 판단해 적절한 모델로 라우팅하면 비용을 40~70% 절감할 수 있다.

```python
from openai import AsyncOpenAI
from enum import Enum

class ComplexityTier(Enum):
    SIMPLE = "simple"    # FAQ, 단순 분류
    MEDIUM = "medium"    # 요약, 번역, 일반 QA
    COMPLEX = "complex"  # 코드 생성, 추론, 창작

MODEL_MAP = {
    ComplexityTier.SIMPLE:  "gpt-4o-mini",           # ~1/20 비용
    ComplexityTier.MEDIUM:  "claude-haiku-4-5-20251001",  # ~1/5 비용
    ComplexityTier.COMPLEX: "claude-opus-4-7",        # 최고 품질
}

async def classify_complexity(query: str, fast_client: AsyncOpenAI) -> ComplexityTier:
    """소형 모델로 복잡도 분류 (비용 거의 무시)"""
    resp = await fast_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""다음 질문의 복잡도를 분류하세요.
질문: {query}
답: simple, medium, complex 중 하나만 출력"""
        }],
        max_tokens=10,
    )
    label = resp.choices[0].message.content.strip().lower()
    return ComplexityTier(label) if label in ComplexityTier._value2member_map_ else ComplexityTier.MEDIUM

async def route_and_generate(query: str, messages: list) -> str:
    """복잡도에 따라 최적 모델 선택 후 생성"""
    client = AsyncOpenAI()
    tier = await classify_complexity(query, client)
    model = MODEL_MAP[tier]

    resp = await client.chat.completions.create(
        model=model,
        messages=messages,
    )
    return resp.choices[0].message.content
```

## ② 프롬프트 최적화: 입력 토큰 절감

입력 토큰을 줄이는 것이 비용 절감의 가장 직접적인 방법이다.

```python
def compress_system_prompt(system: str) -> str:
    """시스템 프롬프트 압축 (중복·관사 제거)"""
    import re
    # 연속 공백·빈 줄 제거
    system = re.sub(r'\n{3,}', '\n\n', system)
    system = re.sub(r'[ \t]+', ' ', system)
    # 불필요한 서론 제거 ("당신은 ... 입니다. 당신의 역할은 ...")
    system = re.sub(r'당신은.+?입니다\.\s*', '', system)
    return system.strip()

def truncate_history(
    messages: list[dict],
    max_tokens: int = 4000,
    keep_system: bool = True
) -> list[dict]:
    """대화 히스토리 토큰 수 제한"""
    # tiktoken으로 토큰 수 계산
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")

    result = []
    total = 0
    system_msgs = [m for m in messages if m["role"] == "system"]
    other_msgs = [m for m in messages if m["role"] != "system"]

    if keep_system:
        for m in system_msgs:
            tokens = len(enc.encode(m["content"]))
            total += tokens
            result.append(m)

    # 최신 메시지부터 역순으로 추가
    for m in reversed(other_msgs):
        tokens = len(enc.encode(m["content"]))
        if total + tokens > max_tokens:
            break
        total += tokens
        result.insert(len(system_msgs), m)

    return result

# RAG 컨텍스트 압축 (관련성 낮은 청크 제거)
def filter_context_by_relevance(chunks: list[str], query: str, top_k: int = 3) -> list[str]:
    """임베딩 유사도로 가장 관련 있는 청크만 선택"""
    from sentence_transformers import SentenceTransformer, util
    model = SentenceTransformer("all-MiniLM-L6-v2")
    q_emb = model.encode(query)
    c_embs = model.encode(chunks)
    scores = util.cos_sim(q_emb, c_embs)[0]
    top_indices = scores.topk(min(top_k, len(chunks))).indices
    return [chunks[i] for i in sorted(top_indices.tolist())]
```

## ③ 응답 캐싱: 중복 요청 제거

캐싱은 비용 절감 효과가 가장 크다. FAQ 챗봇처럼 비슷한 질문이 반복되는 서비스에서는 80% 이상의 요청을 캐시로 처리할 수 있다.

![Semantic Cache 구조](/assets/posts/serving-cost-optimization-cache.svg)

```python
from sentence_transformers import SentenceTransformer
import numpy as np
import json
import redis.asyncio as aioredis

class SemanticCache:
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        model_name: str = "all-MiniLM-L6-v2",
        similarity_threshold: float = 0.95,
        ttl_seconds: int = 3600,
    ):
        self.r = aioredis.from_url(redis_url)
        self.model = SentenceTransformer(model_name)
        self.threshold = similarity_threshold
        self.ttl = ttl_seconds

    async def get(self, query: str) -> str | None:
        """유사한 캐시된 응답 반환, 없으면 None"""
        query_vec = self.model.encode(query)

        # Redis에서 모든 캐시 키 가져오기 (소규모 구현)
        # 대규모에는 pgvector, Qdrant, Redis VSS 사용
        keys = await self.r.keys("scache:*")
        best_score, best_response = 0, None

        for key in keys:
            data = await self.r.get(key)
            if not data:
                continue
            entry = json.loads(data)
            cached_vec = np.array(entry["vector"])
            score = float(np.dot(query_vec, cached_vec) /
                         (np.linalg.norm(query_vec) * np.linalg.norm(cached_vec)))
            if score > best_score:
                best_score, best_response = score, entry["response"]

        if best_score >= self.threshold:
            return best_response
        return None

    async def set(self, query: str, response: str) -> None:
        """질문-응답 쌍을 벡터와 함께 저장"""
        vector = self.model.encode(query).tolist()
        cache_key = f"scache:{hash(query)}"
        await self.r.setex(
            cache_key,
            self.ttl,
            json.dumps({"query": query, "vector": vector, "response": response}),
        )

# 캐시 적용된 LLM 호출
async def cached_llm_call(query: str, client, cache: SemanticCache) -> dict:
    # 1. 캐시 조회
    cached = await cache.get(query)
    if cached:
        return {"response": cached, "source": "cache", "cost": 0}

    # 2. LLM 호출
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": query}],
    )
    response_text = resp.choices[0].message.content

    # 3. 캐시 저장
    await cache.set(query, response_text)
    tokens_used = resp.usage.total_tokens
    return {"response": response_text, "source": "llm", "cost": tokens_used}
```

## ④ 배치 처리: GPU 활용률 극대화

실시간성이 불필요한 작업(문서 분류, 일괄 번역, 데이터 추출)은 배치로 처리하면 처리량당 비용이 2~5배 줄어든다.

```python
import asyncio
from vllm import LLM, SamplingParams

async def batch_process(
    items: list[str],
    batch_size: int = 64,
    model: str = "meta-llama/Llama-3.1-8B-Instruct",
) -> list[str]:
    """대량 항목을 배치로 처리"""
    llm = LLM(
        model=model,
        gpu_memory_utilization=0.95,   # 배치 처리에서는 높게 설정
        max_num_seqs=batch_size,
    )
    params = SamplingParams(temperature=0, max_tokens=256)

    results = []
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        outputs = llm.generate(batch, params)
        results.extend([o.outputs[0].text for o in outputs])
        print(f"진행: {min(i + batch_size, len(items))}/{len(items)}")

    return results

# OpenAI Batch API 활용 (비동기, 50% 할인)
from openai import AsyncOpenAI
import json

async def openai_batch_process(prompts: list[str]) -> list[str]:
    client = AsyncOpenAI()

    # 배치 파일 생성
    batch_requests = [
        {"custom_id": f"req-{i}", "method": "POST",
         "url": "/v1/chat/completions",
         "body": {"model": "gpt-4o-mini",
                  "messages": [{"role": "user", "content": p}],
                  "max_tokens": 256}}
        for i, p in enumerate(prompts)
    ]

    # JSONL 형식으로 업로드
    import tempfile, os
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
        for req in batch_requests:
            f.write(json.dumps(req) + '\n')
        fname = f.name

    with open(fname, 'rb') as f:
        file_obj = await client.files.create(file=f, purpose="batch")

    batch = await client.batches.create(
        input_file_id=file_obj.id,
        endpoint="/v1/chat/completions",
        completion_window="24h",  # 최대 24시간 (비용 50% 절감)
    )
    os.unlink(fname)
    return batch.id  # 나중에 결과 폴링
```

## ⑤ 인프라 최적화

```python
# 자체 서빙 시: 양자화로 GPU 비용 절감
from vllm import LLM

# INT4 양자화: A100 1장으로 70B 모델 서빙 가능
llm_quantized = LLM(
    model="meta-llama/Llama-3.1-70B-Instruct",
    quantization="awq",          # AWQ INT4: 75% VRAM 절감
    gpu_memory_utilization=0.92,
    max_num_seqs=256,
)

# 스팟 인스턴스 활용 (비용 70% 절감, 단 중단 가능)
# AWS EC2 Spot, GCP Preemptible, Azure Spot VMs
# 재시작 복원 로직 + 요청 큐 필수
```

## 비용 모니터링

```python
import time
from dataclasses import dataclass, field
from collections import defaultdict

@dataclass
class CostTracker:
    # 모델별 토큰당 비용 (USD, 2025년 기준 근사치)
    PRICES = {
        "gpt-4o": {"input": 2.5e-6, "output": 10e-6},
        "gpt-4o-mini": {"input": 0.15e-6, "output": 0.6e-6},
        "claude-opus-4-7": {"input": 15e-6, "output": 75e-6},
        "claude-haiku-4-5-20251001": {"input": 0.8e-6, "output": 4e-6},
    }
    daily_cost: float = 0.0
    model_usage: dict = field(default_factory=lambda: defaultdict(float))

    def track(self, model: str, input_tokens: int, output_tokens: int):
        if model not in self.PRICES:
            return
        cost = (input_tokens * self.PRICES[model]["input"] +
                output_tokens * self.PRICES[model]["output"])
        self.daily_cost += cost
        self.model_usage[model] += cost

    def report(self):
        print(f"오늘 총 비용: ${self.daily_cost:.4f}")
        for model, cost in sorted(self.model_usage.items(), key=lambda x: -x[1]):
            print(f"  {model}: ${cost:.4f}")
```

## 정리

LLM 비용 최적화는 계층적으로 접근해야 한다. 단계별 적용으로 기대할 수 있는 절감 효과:

1. **모델 라우팅**: 복잡도별 최적 모델 선택 → 40~70% 절감
2. **프롬프트 압축**: 불필요한 토큰 제거 → 20~40% 절감
3. **Semantic Cache**: 중복 요청 차단 → 30~80% 절감
4. **배치 처리**: GPU 활용률 극대화 → 처리량 2~5배
5. **양자화**: VRAM 50~75% 절감 → GPU 비용 절감

이 다섯 가지를 모두 적용하면 최초 대비 10% 미만의 비용으로 동일한 서비스를 운영하는 것이 가능하다.

---

**지난 글:** [LLM API 속도 제한: Rate Limiting 전략과 구현](/posts/serving-rate-limiting/)

**다음 글:** [AI 에이전트와 MCP: 자율적으로 행동하는 AI 시스템](/posts/ai-agents-and-mcp/)

<br>
읽어주셔서 감사합니다. 😊
