---
title: "LLM 시맨틱 캐시: 반복 요청 비용 제로화 전략"
description: "Exact Cache·시맨틱 캐시·프롬프트 캐시를 다층으로 쌓아 LLM 응답 비용을 줄이는 캐싱 아키텍처를 구체적인 구현 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["시맨틱캐시", "LLMOps", "프롬프트캐싱", "GPTCache", "Redis", "비용최적화", "pgvector"]
featured: false
draft: false
---

[지난 글](/posts/llmops-cost-tracking/)에서 LLM 비용 구조와 최적화 전략을 살펴봤다. 그 중 캐싱은 단연 가장 극적인 효과를 낸다. 이번 글에서는 세 종류의 캐시를 계층적으로 구성하는 **다층 LLM 캐시 아키텍처**를 구현 코드와 함께 상세히 다룬다.

LLM 서비스의 트래픽을 분석하면 흥미로운 패턴이 나타난다. 사용자 질문의 상당수는 의미적으로 중복된다. FAQ 챗봇이라면 "환불 정책이 뭔가요?"와 "환불은 어떻게 하나요?"는 사실상 같은 답변을 원한다. 이 반복 요청에 매번 LLM API를 호출하는 것은 낭비다.

## 다층 캐시 아키텍처

![다층 LLM 캐시 아키텍처](/assets/posts/llmops-cache-architecture.svg)

세 계층의 캐시를 순서대로 통과한다. 앞 단계에서 히트하면 후속 단계를 건너뛴다.

- **L1 (Exact Cache)**: 해시 기반 완전 일치. 응답시간 1ms 이하, 비용 0
- **L2 (Semantic Cache)**: 임베딩 기반 의미 유사도. 응답시간 10~30ms, 비용 0
- **L3 (Prompt Cache)**: Claude 서버 측 프롬프트 캐싱. LLM 호출은 하지만 토큰 비용 90% 절감

## L1: Redis Exact Cache

```python
import redis
import hashlib
import json
from typing import Optional

class ExactCache:
    def __init__(self, ttl_seconds: int = 3600):
        self.r = redis.Redis(host="localhost", port=6379, decode_responses=True)
        self.ttl = ttl_seconds

    def _key(self, prompt: str, model: str) -> str:
        content = f"{model}:{prompt}"
        return f"llm:exact:{hashlib.sha256(content.encode()).hexdigest()}"

    def get(self, prompt: str, model: str) -> Optional[str]:
        val = self.r.get(self._key(prompt, model))
        return json.loads(val) if val else None

    def set(self, prompt: str, model: str, response: str):
        key = self._key(prompt, model)
        self.r.setex(key, self.ttl, json.dumps(response))
```

## L2: 시맨틱 캐시

![시맨틱 캐시: 유사 질문 클러스터링](/assets/posts/llmops-cache-semantic.svg)

시맨틱 캐시는 임베딩 벡터 유사도를 사용해 의미가 같은 질문을 탐지한다.

```python
import numpy as np
from sentence_transformers import SentenceTransformer
import psycopg2
from psycopg2.extras import execute_values

class SemanticCache:
    def __init__(self, threshold: float = 0.92, ttl_hours: int = 24):
        self.model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        self.threshold = threshold
        self.conn = psycopg2.connect("postgresql://localhost/llmcache")
        self._init_table()

    def _init_table(self):
        with self.conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS semantic_cache (
                    id SERIAL PRIMARY KEY,
                    embedding vector(384),
                    query TEXT,
                    response TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    expires_at TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_embedding
                    ON semantic_cache USING ivfflat (embedding vector_cosine_ops);
            """)
            self.conn.commit()

    def get(self, query: str) -> Optional[str]:
        emb = self.model.encode(query).tolist()
        with self.conn.cursor() as cur:
            cur.execute("""
                SELECT response, 1 - (embedding <=> %s::vector) AS similarity
                FROM semantic_cache
                WHERE expires_at > NOW()
                ORDER BY embedding <=> %s::vector
                LIMIT 1
            """, (emb, emb))
            row = cur.fetchone()
        if row and row[1] >= self.threshold:
            return row[0]
        return None

    def set(self, query: str, response: str, ttl_hours: int = 24):
        emb = self.model.encode(query).tolist()
        with self.conn.cursor() as cur:
            cur.execute("""
                INSERT INTO semantic_cache (embedding, query, response, expires_at)
                VALUES (%s::vector, %s, %s, NOW() + %s * INTERVAL '1 hour')
            """, (emb, query, response, ttl_hours))
            self.conn.commit()
```

## L3: Claude 프롬프트 캐싱

```python
import anthropic

client = anthropic.Anthropic()

class PromptCachedClient:
    """시스템 프롬프트를 Claude 서버 측에 캐싱하는 래퍼"""

    def __init__(self, system_prompt: str, model: str = "claude-sonnet-4-6"):
        self.system = system_prompt
        self.model = model

    def chat(self, user_message: str, context: str = "") -> dict:
        messages = []
        if context:
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"참고 컨텍스트:\n{context}",
                        "cache_control": {"type": "ephemeral"},  # 컨텍스트도 캐싱
                    },
                    {"type": "text", "text": user_message},
                ],
            })
        else:
            messages.append({"role": "user", "content": user_message})

        response = client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": self.system,
                    "cache_control": {"type": "ephemeral"},  # 시스템 프롬프트 캐싱
                }
            ],
            messages=messages,
        )
        
        usage = response.usage
        return {
            "text": response.content[0].text,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cache_creation_tokens": getattr(usage, "cache_creation_input_tokens", 0),
            "cache_read_tokens": getattr(usage, "cache_read_input_tokens", 0),
        }
```

## 캐시 오케스트레이터 (전체 통합)

```python
class LLMCacheOrchestrator:
    def __init__(self, system_prompt: str):
        self.exact = ExactCache(ttl_seconds=3600)
        self.semantic = SemanticCache(threshold=0.92)
        self.llm = PromptCachedClient(system_prompt)

    def query(self, user_input: str, context: str = "") -> dict:
        # L1: Exact match
        exact_hit = self.exact.get(user_input, self.llm.model)
        if exact_hit:
            return {"response": exact_hit, "source": "exact_cache", "cost": 0}

        # L2: Semantic match
        semantic_hit = self.semantic.get(user_input)
        if semantic_hit:
            self.exact.set(user_input, self.llm.model, semantic_hit)  # L1에 추가
            return {"response": semantic_hit, "source": "semantic_cache", "cost": 0}

        # L3 + LLM 호출
        result = self.llm.chat(user_input, context)
        response = result["text"]

        # 결과를 L1, L2에 저장
        self.exact.set(user_input, self.llm.model, response)
        self.semantic.set(user_input, response)

        return {
            "response": response,
            "source": "llm",
            "input_tokens": result["input_tokens"],
            "cache_read_tokens": result["cache_read_tokens"],
        }
```

## 캐시 무효화 전략

캐시에서 가장 어려운 문제는 무효화다. 언제 캐시를 비워야 할까?

```python
class CacheInvalidator:
    def __init__(self, exact: ExactCache, semantic: SemanticCache):
        self.exact = exact
        self.semantic = semantic

    def invalidate_by_tag(self, tag: str):
        """특정 도메인 관련 캐시 전체 삭제 (예: 가격 정책 변경 시)"""
        # Redis 패턴 삭제
        keys = self.exact.r.keys(f"llm:*:{tag}:*")
        if keys:
            self.exact.r.delete(*keys)

        # pgvector: 태그 기반 삭제
        with self.semantic.conn.cursor() as cur:
            cur.execute("DELETE FROM semantic_cache WHERE query LIKE %s", (f"%{tag}%",))
            self.semantic.conn.commit()

    def invalidate_on_prompt_change(self, new_version: str):
        """프롬프트 버전이 바뀌면 전체 시맨틱 캐시 초기화"""
        with self.semantic.conn.cursor() as cur:
            cur.execute("TRUNCATE semantic_cache")
            self.semantic.conn.commit()
```

## 히트율 모니터링

```python
from prometheus_client import Counter

cache_hits = Counter("llm_cache_hits_total", "Cache hits", ["level"])
cache_misses = Counter("llm_cache_misses_total", "Cache misses")

# 캐시 히트율 대시보드 쿼리 (Prometheus)
# sum(rate(llm_cache_hits_total[1h])) / 
# (sum(rate(llm_cache_hits_total[1h])) + sum(rate(llm_cache_misses_total[1h])))
```

캐시 히트율이 30% 이상이면 의미 있는 비용 절감이다. FAQ·고객 지원 챗봇처럼 반복 질문이 많은 도메인에서는 60~80%까지도 달성할 수 있다.

---

**지난 글:** [LLM 비용 추적: 토큰 낭비 없이 운영하기](/posts/llmops-cost-tracking/)

**다음 글:** [LLM Fallback 전략: 장애에도 살아남는 서비스 설계](/posts/llmops-fallback-strategies/)

<br>
읽어주셔서 감사합니다. 😊
