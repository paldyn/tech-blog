---
title: "LLM 비용 추적: 토큰 낭비 없이 운영하기"
description: "LLM 서비스의 토큰 비용 구조를 이해하고, 프롬프트 캐싱·시맨틱 캐싱·모델 라우팅·배치 API로 품질을 유지하면서 비용을 절감하는 LLMOps 실전 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["LLM비용", "LLMOps", "프롬프트캐싱", "시맨틱캐싱", "모델라우팅", "배치API", "토큰최적화"]
featured: false
draft: false
---

[지난 글](/posts/llmops-observability/)에서 LLM 시스템의 관측성을 구축하는 방법을 살펴봤다. 관측성이 제대로 갖춰지면 자연스럽게 보이는 것이 있다. **비용**이다. 토큰이 어디서 얼마나 쓰이는지 측정하지 않으면 월 청구서를 보고 나서야 놀라게 된다.

프로덕션 LLM 시스템에서 비용은 사용자 수와 거의 선형으로 증가한다. 스케일업할수록 비용이 기하급수적으로 커지는 구조다. 하루 100개 요청일 때는 문제없던 비용 구조가 하루 10만 개 요청이 되면 월 수천 달러 청구서로 돌아온다. 이 글에서는 품질을 희생하지 않고 LLM 비용을 체계적으로 줄이는 방법을 다룬다.

## 비용 구조 이해

![LLM 비용 구조 분해](/assets/posts/llmops-cost-tracking-breakdown.svg)

LLM API 비용의 공식은 단순하다: `(입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가)`. 그러나 실무에서는 이 간단한 공식 안에 세 가지 숨겨진 비용 드라이버가 있다.

**시스템 프롬프트**: 수백~수천 토큰의 시스템 프롬프트가 모든 요청에 반복 청구된다. 하루 1만 건 요청에 500토큰 시스템 프롬프트면 하루 500만 토큰이 순수하게 반복 비용이다.

**RAG 컨텍스트**: 검색된 청크가 프롬프트에 들어가면서 입력 토큰이 급증한다. top-k=10에 청크당 500토큰이면 요청당 5000토큰이 컨텍스트만으로 소비된다.

**출력 토큰**: 입력보다 단가가 3~5배 비싸다. 불필요하게 긴 출력이 비용을 폭발적으로 키운다.

## 전략 1: 프롬프트 캐싱 (가장 임팩트 큼)

Claude API는 `cache_control`로 프롬프트 캐싱을 지원한다. 캐시 히트 시 캐시된 토큰은 원래 입력 단가의 10%만 청구한다. 90% 할인이다.

```python
import anthropic

client = anthropic.Anthropic()

# 긴 시스템 프롬프트를 캐시 대상으로 지정
SYSTEM_PROMPT = """당신은 법률 문서 분석 전문가입니다.
다음 지침을 따르세요:
1. 모든 법적 용어는 한국어로 설명합니다.
2. 계약 위험 사항은 반드시 표시합니다.
3. ...
[매우 긴 지침 - 2000토큰]"""

def analyze_contract(document: str) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},  # 캐시 지정
            }
        ],
        messages=[{"role": "user", "content": f"다음 계약서를 분석하세요:\n\n{document}"}],
    )
    # 첫 호출: 시스템 프롬프트 2000토큰 전액 청구
    # 이후 호출: 2000토큰 중 10%만 청구 (= 200토큰 가격)
    return response.content[0].text
```

캐시는 5분간 유지된다. 동일 시스템 프롬프트를 쓰는 다중 사용자 환경에서 효과가 극대화된다.

## 전략 2: 시맨틱 캐싱

의미적으로 동일한 질문에 이미 생성한 답변을 재사용한다. "파이썬이란?"과 "파이썬이 뭔가요?"는 동일한 답변을 돌려줄 수 있다.

```python
import numpy as np
from functools import lru_cache

class SemanticCache:
    def __init__(self, threshold: float = 0.92):
        self.threshold = threshold
        self.cache: list[dict] = []  # {embedding, response}
        self.embed_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

    def _cosine(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    def get(self, query: str) -> str | None:
        q_emb = self.embed_model.encode(query)
        for entry in self.cache:
            sim = self._cosine(q_emb, entry["embedding"])
            if sim >= self.threshold:
                return entry["response"]
        return None

    def set(self, query: str, response: str):
        self.cache.append({
            "embedding": self.embed_model.encode(query),
            "response": response,
        })

cache = SemanticCache()

def cached_llm_call(query: str) -> str:
    hit = cache.get(query)
    if hit:
        return hit  # LLM 호출 없이 반환 → 비용 0
    
    response = llm_generate(query)
    cache.set(query, response)
    return response
```

## 전략 3: 지능형 모델 라우팅

![비용 최적화: 지능형 모델 라우팅](/assets/posts/llmops-cost-tracking-routing.svg)

```python
def classify_complexity(question: str) -> str:
    """질문을 복잡도에 따라 분류"""
    word_count = len(question.split())
    
    # 단순 규칙 기반 분류
    simple_patterns = ["번역해", "요약해", "정의해", "뭐야", "알려줘"]
    complex_patterns = ["분석해", "설계해", "비교해서", "왜", "어떻게 최적화"]
    
    is_simple = any(p in question for p in simple_patterns) and word_count < 30
    is_complex = any(p in question for p in complex_patterns) or word_count > 100
    
    if is_simple:
        return "haiku"
    elif is_complex:
        return "opus"
    return "sonnet"

MODEL_MAP = {
    "haiku": "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-6",
    "opus": "claude-opus-4-7",
}

def smart_llm_call(question: str, messages: list) -> str:
    tier = classify_complexity(question)
    model = MODEL_MAP[tier]
    
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=messages,
    )
    log_cost(model=model, usage=response.usage, feature="smart_routing")
    return response.content[0].text
```

## 전략 4: 배치 API 활용

실시간 응답이 필요 없는 태스크(리포트 생성, 대량 번역, 오프라인 분류)는 배치 API를 사용한다.

```python
# Claude Message Batches API (최대 50% 할인)
import anthropic

client = anthropic.Anthropic()

# 배치 요청 생성
batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": f"doc-{i}",
            "params": {
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 512,
                "messages": [{"role": "user", "content": f"다음을 3줄로 요약: {doc}"}],
            },
        }
        for i, doc in enumerate(documents)
    ]
)

# 비동기로 결과 폴링 (최대 24시간)
import time
while batch.processing_status == "in_progress":
    time.sleep(60)
    batch = client.messages.batches.retrieve(batch.id)

# 결과 수집
for result in client.messages.batches.results(batch.id):
    if result.result.type == "succeeded":
        print(result.custom_id, result.result.message.content[0].text)
```

## 비용 대시보드 구성

```python
from dataclasses import dataclass, field
from collections import defaultdict
import datetime

@dataclass
class CostTracker:
    daily_costs: dict = field(default_factory=lambda: defaultdict(float))
    feature_costs: dict = field(default_factory=lambda: defaultdict(float))
    
    PRICES = {
        "claude-haiku-4-5-20251001": {"input": 0.8e-6, "output": 4.0e-6},
        "claude-sonnet-4-6": {"input": 3.0e-6, "output": 15.0e-6},
        "claude-opus-4-7": {"input": 15.0e-6, "output": 75.0e-6},
    }

    def record(self, model: str, input_tokens: int, output_tokens: int, feature: str):
        p = self.PRICES.get(model, self.PRICES["claude-sonnet-4-6"])
        cost = input_tokens * p["input"] + output_tokens * p["output"]
        
        today = datetime.date.today().isoformat()
        self.daily_costs[today] += cost
        self.feature_costs[feature] += cost

        if self.daily_costs[today] > 20.0:
            self._alert(f"일일 비용 ${self.daily_costs[today]:.2f} 초과")

    def report(self) -> dict:
        return {
            "daily_total": dict(self.daily_costs),
            "by_feature": dict(self.feature_costs),
        }
```

## 최적화 효과 측정

| 전략 | 적용 대상 | 절감 효과 |
|------|----------|----------|
| 프롬프트 캐싱 | 반복되는 긴 시스템 프롬프트 | 50~70% |
| 시맨틱 캐싱 | FAQ·반복 질문 많은 서비스 | 20~40% |
| 모델 라우팅 | 다양한 난이도의 요청 | 40~60% |
| 배치 API | 비실시간 대량 처리 | 50% |
| 프롬프트 압축 | 긴 컨텍스트 | 10~30% |

---

**지난 글:** [LLMOps 관측성: 프로덕션 LLM 시스템 들여다보기](/posts/llmops-observability/)

**다음 글:** [LLM 시맨틱 캐시: 반복 요청 비용 제로화 전략](/posts/llmops-cache/)

<br>
읽어주셔서 감사합니다. 😊
