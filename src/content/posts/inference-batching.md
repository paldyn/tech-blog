---
title: "LLM 추론 배치 전략: Continuous Batching과 KV 캐시 완전 해설"
description: "정적 배치의 한계, Continuous Batching의 동작 원리, PagedAttention과 KV 캐시 메모리 관리, GQA·KV Cache 양자화 최적화, vLLM 실전 튜닝."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["Continuous Batching", "PagedAttention", "KV캐시", "vLLM", "LLM추론", "GPU최적화"]
featured: false
draft: false
---

[지난 글](/posts/inference-tgi/)에서 TGI의 아키텍처와 사용법을 살펴봤다. 이번 글은 vLLM·TGI·SGLang 등 모든 GPU 추론 엔진이 공통으로 적용하는 핵심 기술을 깊이 다룬다. Continuous Batching과 KV 캐시 관리를 이해하면 추론 엔진의 성능이 왜 전통적 방식보다 몇 배씩 높은지, 그리고 실제 서비스에서 어떻게 튜닝해야 하는지가 명확해진다.

## LLM 추론의 두 단계: Prefill과 Decode

LLM 추론은 두 단계로 나뉜다. 이 구분을 이해하는 것이 배치 전략의 출발점이다.

**Prefill(프리필)**: 입력 프롬프트 전체를 한 번의 Forward Pass로 처리한다. Transformer의 병렬 처리 덕분에 1000 토큰 프롬프트도 한 번에 처리하고, 각 레이어의 Key·Value를 계산해 KV 캐시에 저장한다. **연산량(FLOP) 바운드** 구간이다.

**Decode(디코드)**: 토큰을 한 번에 하나씩 생성한다. 각 스텝에서 이전 KV 캐시를 읽어 새 토큰의 Key·Value를 추가한다. 메모리에서 거대한 KV 캐시를 읽어야 하므로 **메모리 대역폭 바운드** 구간이다. 배치가 커져도 추가 연산이 거의 없기 때문에 배치를 크게 하면 처리량이 선형으로 늘어난다.

```python
# Prefill + Decode 단계 이해 (개략적)
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-1B")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-1B")

# Prefill: 프롬프트 처리 (KV 캐시 생성)
inputs = tok("한국의 수도는", return_tensors="pt")
with torch.no_grad():
    out = model(**inputs, use_cache=True)
    past_kv = out.past_key_values  # KV 캐시 저장

# Decode: 토큰 하나씩 생성 (KV 캐시 재사용)
next_token_logits = out.logits[:, -1, :]
next_token = next_token_logits.argmax(dim=-1, keepdim=True)
for _ in range(50):
    with torch.no_grad():
        out = model(next_token, past_key_values=past_kv, use_cache=True)
    past_kv = out.past_key_values  # KV 캐시 확장
    next_token = out.logits[:, -1, :].argmax(dim=-1, keepdim=True)
```

## 정적 배치의 문제

전통적 배치에서는 배치 내 모든 요청이 동시에 시작하고 동시에 끝나야 한다. 길이가 다른 요청들을 한 배치에 넣으려면 짧은 요청에 **패딩(padding)**을 추가해야 한다. 100 토큰 요청과 1000 토큰 요청이 한 배치에 있으면, 100 토큰 요청 완료 후 GPU 슬롯이 비지만 1000 토큰 요청이 끝날 때까지 다음 요청을 넣을 수 없다.

![정적 배치 vs Continuous Batching](/assets/posts/inference-batching-static-vs-continuous.svg)

## Continuous Batching: Iteration-level Scheduling

**Continuous Batching(Yu et al., 2022)**의 핵심 아이디어는 각 Forward Pass(iteration) 단위로 배치를 재구성하는 것이다. 한 iteration이 끝난 후:

1. 완료된 요청(EOS 토큰 생성 또는 max_tokens 도달)을 배치에서 제거
2. 대기 큐에서 새 요청을 빈 슬롯에 추가
3. 다음 iteration 실행

이를 통해 GPU가 항상 최대 배치로 가동된다. 짧은 요청은 완료 즉시 새 요청으로 대체되므로 지연도 최소화된다.

```python
# Continuous Batching 개념 (의사코드)
class ContinuousBatcher:
    def __init__(self, max_batch_size, model):
        self.active = []      # 현재 처리 중인 요청들
        self.waiting = []     # 대기 중인 요청들
        self.model = model
        self.max_batch = max_batch_size

    def step(self):
        # 1. 완료된 요청 제거
        self.active = [req for req in self.active
                       if not req.is_done()]

        # 2. 빈 슬롯에 대기 요청 추가
        while len(self.active) < self.max_batch and self.waiting:
            self.active.append(self.waiting.pop(0))

        # 3. 한 번의 Forward Pass로 모든 활성 요청 처리
        if self.active:
            self._batch_forward(self.active)

    def _batch_forward(self, requests):
        # Prefill과 Decode 요청이 섞일 수 있음
        # 각 요청의 상태(prefill/decode)에 따라 처리
        for req in requests:
            if req.is_prefill:
                req.process_prefill(self.model)
            else:
                req.process_decode(self.model)
```

## KV 캐시: 추론의 핵심 메모리 자원

Transformer의 각 레이어는 모든 이전 토큰의 Key·Value를 저장한다. 이 KV 캐시가 메모리를 얼마나 차지하는지 계산해보면 놀랍다.

![KV 캐시 크기와 최적화](/assets/posts/inference-batching-kv-cache.svg)

Llama-3.1-8B를 배치 32, 시퀀스 8192로 서빙하면 KV 캐시만 34GB다. 모델 가중치(BF16 기준 16GB)보다 훨씬 크다. 이것이 LLM 서빙에서 GPU 메모리 관리가 중요한 이유다.

## PagedAttention: 가상 메모리로 KV 캐시 관리

vLLM이 도입한 **PagedAttention**은 OS의 가상 메모리 페이징을 KV 캐시에 적용한다.

- **물리 블록(Physical Block)**: 고정 크기(예: 16 토큰)의 KV 캐시 단위
- **논리-물리 매핑 테이블**: 각 요청의 논리 슬롯이 어떤 물리 블록을 가리키는지 저장
- **동적 할당**: 요청이 새 토큰을 생성할 때 필요한 물리 블록만 할당
- **블록 공유**: 같은 시스템 프롬프트를 가진 요청들이 물리 블록을 공유 (Prefix Caching)

```python
from vllm import LLM, SamplingParams

# PagedAttention + Prefix Caching 활성화
llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    enable_prefix_caching=True,    # 공통 프리픽스 KV 재사용
    gpu_memory_utilization=0.90,
    max_num_seqs=256,              # 최대 동시 시퀀스 수
    max_model_len=8192,
    kv_cache_dtype="fp8",          # KV 캐시를 FP8로 양자화 (메모리 50% 절감)
)

# 동일 시스템 프롬프트로 여러 요청 (Prefix Caching 효과)
system = "당신은 한국어 전문가입니다. 항상 상세히 설명하세요."
prompts = [
    f"{system}\n\n한글 맞춤법이란?",
    f"{system}\n\n존댓말의 종류는?",
    f"{system}\n\n사투리의 특징은?",
]
results = llm.generate(prompts, SamplingParams(max_tokens=200))
```

## Prefix Caching: 공통 프롬프트 재사용

RAG나 에이전트처럼 긴 시스템 프롬프트가 반복되는 경우, **Prefix Caching**으로 프리필 비용을 크게 줄일 수 있다.

```python
# SGLang의 Radix Cache (더 발전된 Prefix Caching)
# 트리 구조로 공통 프리픽스를 공유

# vLLM에서 Prefix Caching 효과 측정
import time

# 첫 번째 호출: Prefix Cache Miss (프리필 비용 발생)
start = time.time()
_ = llm.generate([f"긴_시스템_프롬프트...\n\n질문 1"], SamplingParams(max_tokens=100))
first_latency = time.time() - start

# 두 번째 호출: Prefix Cache Hit (프리필 비용 없음)
start = time.time()
_ = llm.generate([f"긴_시스템_프롬프트...\n\n질문 2"], SamplingParams(max_tokens=100))
cached_latency = time.time() - start

print(f"첫 번째: {first_latency:.2f}s")
print(f"캐시 히트: {cached_latency:.2f}s")
# 캐시 히트 시 TTFT(첫 토큰 지연)가 80% 이상 감소
```

## GQA: KV 캐시 크기 자체를 줄이기

**Grouped Query Attention(GQA)**은 여러 Query 헤드가 하나의 KV 헤드를 공유한다. Llama-3 계열이 GQA를 채택해 KV 캐시 크기를 MHA 대비 크게 줄였다.

```
MHA (Multi-Head Attention): n_heads = n_kv_heads
  → 32 Query 헤드, 32 KV 헤드
  → KV 캐시 = 2 × 32 × head_dim × seq_len

GQA (Llama-3.1-8B): n_kv_heads = 8, n_heads = 32
  → 32 Query 헤드, 8 KV 헤드 (4 Query가 1 KV 공유)
  → KV 캐시 = 2 × 8 × head_dim × seq_len  (4배 절감)
```

## 실전 vLLM 배치 튜닝

```python
from vllm import LLM, SamplingParams
from vllm.engine.arg_utils import AsyncEngineArgs

# 고처리량 서빙 설정
engine_args = AsyncEngineArgs(
    model="meta-llama/Llama-3.1-8B-Instruct",
    # 메모리
    gpu_memory_utilization=0.92,
    kv_cache_dtype="fp8",           # KV 캐시 FP8 양자화
    enable_prefix_caching=True,     # Prefix 재사용
    # 배치
    max_num_seqs=512,               # 최대 동시 시퀀스
    max_num_batched_tokens=32768,   # 배치당 최대 토큰
    # 모델
    quantization="awq",             # 가중치 AWQ
    max_model_len=8192,
    # 속도
    enable_chunked_prefill=True,    # 긴 프리필을 청크로 나눔
)
```

## 처리량 vs 지연 트레이드오프

배치 전략에는 항상 처리량과 지연의 트레이드오프가 있다.

| 설정 | 처리량 | 지연(P99) | 적합한 상황 |
|---|---|---|---|
| 배치 크기 ↑ | ↑ | ↑ | 오프라인 배치 처리 |
| 배치 크기 ↓ | ↓ | ↓ | 실시간 챗봇 |
| max_tokens ↑ | ↑ (배치 효율) | ↑ | 긴 문서 생성 |
| Prefix Cache | ↑ | ↓ (캐시 히트 시) | RAG·에이전트 |
| KV FP8 | ↑ (배치 더 가능) | ≈ 동등 | 대부분의 경우 |

## 정리

LLM 추론 최적화의 핵심 기술을 요약하면:

- **Continuous Batching**: 슬롯 완료 즉시 새 요청 투입 → GPU 100% 가동
- **PagedAttention**: OS 페이징으로 KV 캐시 단편화 제거 → 배치 크기 2~4× 증가
- **Prefix Caching**: 반복 프롬프트 KV 재사용 → TTFT 80% 감소
- **GQA**: KV 헤드 수 줄이기 → KV 캐시 4× 절감
- **KV FP8**: KV 캐시 양자화 → 메모리 50% 절감

이 시리즈의 모델 최적화 파트(양자화·증류·프루닝·투기적 디코딩)와 추론 엔진 파트(vLLM·TGI·llama.cpp·Ollama·배치 전략)를 모두 이해했다면, 실제 서비스에서 LLM을 비용 효율적으로 운영할 수 있는 기반이 마련된 것이다.

---

**지난 글:** [TGI 완전 가이드: Hugging Face의 프로덕션급 LLM 서빙](/posts/inference-tgi/)

<br>
읽어주셔서 감사합니다. 😊
