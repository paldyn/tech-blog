---
title: "KV 캐시 완전 해설: LLM 추론 메모리의 핵심"
description: "Transformer의 Key-Value 캐시 구조, 메모리 계산, FP8 양자화·GQA·Prefix Caching·PagedAttention 등 4대 최적화 전략을 코드와 함께 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["KV캐시", "PagedAttention", "GQA", "Prefix Caching", "LLM추론", "vLLM", "GPU메모리"]
featured: false
draft: false
---

[지난 글](/posts/inference-batching/)에서 Continuous Batching과 KV 캐시 기초를 다뤘다. 이번 글은 KV 캐시 자체를 훨씬 깊이 파고든다. LLM 추론에서 GPU 메모리의 절반 이상을 차지하는 이 구조를 제대로 이해해야 비용 효율적인 서빙이 가능하다.

## KV 캐시란 무엇인가

Transformer의 Self-Attention은 입력 시퀀스의 모든 토큰에 대해 Query(Q), Key(K), Value(V) 행렬을 계산한다. Decode 단계에서 새 토큰을 하나씩 생성할 때마다 이전 모든 토큰의 K·V가 필요한데, 이를 매번 재계산하면 시퀀스가 길어질수록 연산량이 제곱으로 증가한다. KV 캐시는 이 문제를 해결하기 위해 Prefill 단계에서 계산한 K·V를 GPU 메모리에 보관하고 재사용한다.

![KV 캐시 구조와 메모리](/assets/posts/inference-kv-cache-structure.svg)

## KV 캐시 메모리 크기 계산

KV 캐시가 얼마나 큰지 직접 계산해보면 그 중요성이 실감된다.

```python
def kv_cache_memory_gb(
    n_layers: int,
    n_kv_heads: int,
    head_dim: int,
    seq_len: int,
    batch_size: int,
    dtype_bytes: int = 2  # FP16 = 2 bytes
) -> float:
    """KV 캐시 메모리 계산 (GB)"""
    # 2 = K + V 두 행렬
    total_bytes = (
        2 * n_layers * n_kv_heads
        * head_dim * seq_len
        * batch_size * dtype_bytes
    )
    return total_bytes / (1024**3)

# Llama-3.1-8B (GQA: n_kv_heads=8)
mem = kv_cache_memory_gb(
    n_layers=32, n_kv_heads=8,
    head_dim=128, seq_len=8192,
    batch_size=32, dtype_bytes=2  # FP16
)
print(f"KV 캐시: {mem:.1f} GB")  # ≈ 34 GB

# FP8 적용 시 (dtype_bytes=1)
mem_fp8 = kv_cache_memory_gb(
    n_layers=32, n_kv_heads=8,
    head_dim=128, seq_len=8192,
    batch_size=32, dtype_bytes=1
)
print(f"FP8 KV 캐시: {mem_fp8:.1f} GB")  # ≈ 17 GB
```

Llama-3.1-8B를 배치 32, 시퀀스 8192로 서빙하면 KV 캐시만 34 GB다. 모델 가중치(BF16 기준 16 GB)의 두 배가 넘는다. 이것이 LLM 서빙에서 GPU 메모리 관리가 핵심인 이유다.

## 4대 최적화 전략

KV 캐시 메모리를 줄이는 전략은 크게 네 가지다.

![KV 캐시 4대 최적화 전략](/assets/posts/inference-kv-cache-optimization.svg)

### ① FP8 양자화: 50% 메모리 절감

KV 캐시를 FP16에서 FP8로 양자화하면 메모리가 절반으로 줄어든다. 품질 손실은 대부분의 태스크에서 무시할 수 있는 수준이다.

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    kv_cache_dtype="fp8",           # FP16 → FP8 (50% 절감)
    gpu_memory_utilization=0.92,
)

# 추론 실행
params = SamplingParams(temperature=0.7, max_tokens=512)
outputs = llm.generate(["한국어 문법을 설명해줘"], params)
print(outputs[0].outputs[0].text)
```

### ② GQA(Grouped Query Attention): 4× 절감

MHA(Multi-Head Attention)는 32개 Query 헤드마다 32개 KV 헤드를 가진다. GQA는 여러 Query가 하나의 KV 헤드를 공유한다. Llama-3 계열은 32 Query 헤드에 8 KV 헤드를 사용해 KV 캐시를 4분의 1로 줄였다.

```python
# Transformers로 GQA 확인
from transformers import AutoConfig

config = AutoConfig.from_pretrained("meta-llama/Llama-3.1-8B")
print(f"Query 헤드: {config.num_attention_heads}")    # 32
print(f"KV 헤드:    {config.num_key_value_heads}")    # 8
print(f"KV 절감:    {config.num_attention_heads // config.num_key_value_heads}×")  # 4×

# MQA(Multi-Query): 극단적 GQA, n_kv_heads=1
# GQA(Grouped): 중간 균형, n_kv_heads=n_heads//4 ~ n_heads//8
# MHA(Multi-Head): 전통, n_kv_heads=n_heads
```

### ③ Prefix Caching: 반복 프롬프트 재사용

RAG나 에이전트처럼 긴 시스템 프롬프트가 반복되는 경우, 한 번 계산한 KV를 해시 키로 저장하고 같은 프리픽스가 들어오면 재계산 없이 재사용한다. 첫 토큰 지연(TTFT)을 최대 80% 줄일 수 있다.

```python
from vllm import LLM, SamplingParams
import time

llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    enable_prefix_caching=True,      # Prefix Caching 활성화
)

# 긴 시스템 프롬프트 (공통 프리픽스)
system = "당신은 한국어 법률 전문가입니다. " * 200  # 약 600 토큰

questions = ["계약서 해제 조건은?", "위약금 계산 방법은?", "소멸시효는?"]

for i, q in enumerate(questions):
    prompt = f"{system}\n\n{q}"
    start = time.time()
    out = llm.generate([prompt], SamplingParams(max_tokens=200))
    elapsed = time.time() - start
    status = "MISS" if i == 0 else "HIT"
    print(f"[{status}] {elapsed:.2f}s: {out[0].outputs[0].text[:50]}...")
# [MISS] 2.34s: ...  (Prefill 비용 발생)
# [HIT]  0.31s: ...  (캐시 재사용, ~7× 빠름)
# [HIT]  0.29s: ...
```

### ④ PagedAttention: 메모리 단편화 제거

전통적 KV 캐시는 최대 시퀀스 길이만큼 연속 메모리를 선점한다. 대부분의 요청이 훨씬 짧게 끝나도 메모리를 반납하지 않아 단편화가 심하다. PagedAttention은 고정 크기 **블록(block)**으로 KV를 나눠 필요한 만큼만 동적 할당한다.

```python
# vLLM PagedAttention 설정 (내부 동작 이해용)
from vllm import LLM

llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    block_size=16,                   # KV 블록 크기 (16 토큰)
    max_num_seqs=256,                # 최대 동시 시퀀스
    gpu_memory_utilization=0.92,
    enable_prefix_caching=True,
    kv_cache_dtype="fp8",
)

# 메모리 사용량 확인
import torch
before = torch.cuda.memory_allocated() / 1e9
_ = llm.generate(["테스트"], SamplingParams(max_tokens=10))
after = torch.cuda.memory_allocated() / 1e9
print(f"KV 캐시 할당: {after - before:.1f} GB")
```

블록 단위 할당의 또 다른 장점은 **Prefix Sharing**이다. 같은 시스템 프롬프트를 가진 여러 요청이 동일한 물리 블록을 공유(Copy-on-Write)하므로 메모리 효율이 더욱 높아진다.

## 멀티 GPU 환경: Tensor Parallelism과 KV 캐시

여러 GPU로 모델을 분산할 때 KV 캐시도 같이 분산된다. Tensor Parallelism에서는 각 GPU가 전체 KV 헤드의 1/N을 담당한다.

```python
from vllm import LLM

# 2-GPU Tensor Parallelism
llm = LLM(
    model="meta-llama/Llama-3.1-70B-Instruct",
    tensor_parallel_size=2,          # 2 GPU로 분산
    gpu_memory_utilization=0.90,
    kv_cache_dtype="fp8",
    enable_prefix_caching=True,
)
# GPU 0: Layer 0~31의 KV 헤드 0~3
# GPU 1: Layer 0~31의 KV 헤드 4~7
# → 각 GPU의 KV 캐시 크기 절반
```

## KV 캐시 크기 vs 배치 처리량 트레이드오프

```
GPU 메모리 80 GB (A100 예시)
├── 모델 가중치:  약 16 GB (8B, BF16)
├── 활성화 텐서:  약 4  GB (배치·시퀀스 의존)
└── KV 캐시:     약 60 GB (나머지)

gpu_memory_utilization=0.92 → KV 캐시로 약 55 GB 사용
FP8 적용 시 → 동일 메모리에서 배치 2×, 처리량 2×
GQA(32→8) → KV 크기 4× 감소, 배치 4× 확대 가능
```

## 실전 최적화 체크리스트

```python
# 프로덕션 서빙 권장 설정
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3.1-8B-Instruct",
    # KV 캐시 최적화
    kv_cache_dtype="fp8",            # ① 메모리 50% 절감
    enable_prefix_caching=True,      # ③ Prefix 재사용
    # 메모리 관리
    gpu_memory_utilization=0.92,     # GPU 메모리 92% 활용
    max_num_seqs=512,                # 최대 동시 시퀀스
    max_model_len=8192,              # 최대 컨텍스트
    # 배치 전략
    enable_chunked_prefill=True,     # 긴 Prefill 청크 분리
    max_num_batched_tokens=32768,    # 배치당 최대 토큰
)
```

GQA 지원 여부는 모델 아키텍처에 따라 결정되므로 별도 설정 없이 자동 적용된다. FP8 KV 캐시, Prefix Caching, PagedAttention(vLLM 기본)은 직접 활성화해야 한다.

## 정리

KV 캐시는 LLM 추론의 메모리 병목이자 최적화의 핵심이다. 네 가지 전략을 조합하면:

- **FP8 양자화** → 메모리 50% 절감, 거의 무손실
- **GQA** → KV 캐시 크기 4× 감소 (모델 설계 단계)
- **Prefix Caching** → 반복 프롬프트 TTFT 80% 절감
- **PagedAttention** → 단편화 제거로 배치 2~4× 증가

이 네 가지를 모두 적용하면 동일한 GPU에서 처리할 수 있는 동시 요청 수가 10배 이상 늘어난다.

---

**지난 글:** [LLM 추론 배치 전략: Continuous Batching과 KV 캐시 완전 해설](/posts/inference-batching/)

**다음 글:** [LLM 서빙 API 설계: OpenAI 호환 인터페이스 구축](/posts/serving-api-design/)

<br>
읽어주셔서 감사합니다. 😊
