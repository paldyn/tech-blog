---
title: "MQA와 GQA: KV Cache 경량화 전략"
description: "Multi-Query Attention과 Grouped-Query Attention이 KV 헤드 수를 줄여 추론 시 KV Cache 메모리와 디코딩 지연을 극적으로 줄이는 원리와 실전 적용을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["MQA", "GQA", "KV Cache", "트랜스포머", "LLM 추론", "LLaMA"]
featured: false
draft: false
---

[지난 글](/posts/transformer-flash-attention/)에서 FlashAttention이 IO 최적화로 어텐션 연산 속도를 끌어올리는 방법을 살펴봤다. 이번에는 LLM 추론의 또 다른 핵심 병목인 **KV Cache 메모리**를 줄이는 두 가지 기법, MQA(Multi-Query Attention)와 GQA(Grouped-Query Attention)를 다룬다. LLaMA 3, Mistral, Qwen2 등 2023년 이후 등장한 거의 모든 오픈 LLM이 GQA를 채택했다.

## KV Cache가 왜 문제인가

자동회귀 디코딩에서는 새 토큰을 생성할 때마다 이전 모든 토큰의 K, V를 다시 계산하지 않고 캐시해 재사용한다. 이 KV Cache가 없으면 토큰당 어텐션 복잡도가 O(t²)가 된다. 캐시 덕분에 O(t)가 되지만, 캐시 자체가 메모리를 대량으로 차지한다.

LLaMA 3 70B 기준으로 MHA(Multi-Head Attention)를 그대로 쓰면:
```
KV Cache = 2 × 64(KV heads) × 128(head_dim)
         × 8192(seq_len) × 80(layers) × 2(bf16 bytes)
         ≈ 160 GB
```

A100 80GB GPU 두 장을 KV Cache만으로 꽉 채운다. 모델 파라미터(70B × 2bytes ≈ 140GB)보다 크다. 이 상태에서는 배치 크기 1도 간신히 처리할 수 있다.

## Multi-Query Attention (MQA)

2019년 Shazeer가 제안한 MQA는 간단한 아이디어다. **K와 V 투영을 헤드별로 분리하지 않고 모든 Q 헤드가 동일한 K, V를 공유**하게 한다.

```python
class MultiQueryAttention(nn.Module):
    def __init__(self, d_model, num_heads, head_dim):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = head_dim
        # Q: 헤드별로 분리
        self.W_q = nn.Linear(d_model, num_heads * head_dim)
        # K, V: 단 1개 헤드 (모든 Q 헤드가 공유)
        self.W_k = nn.Linear(d_model, head_dim)
        self.W_v = nn.Linear(d_model, head_dim)
        self.W_o = nn.Linear(num_heads * head_dim, d_model)

    def forward(self, x, mask=None):
        B, T, _ = x.shape
        q = self.W_q(x).view(B, T, self.num_heads, self.head_dim)
        k = self.W_k(x).view(B, T, 1, self.head_dim)
        v = self.W_v(x).view(B, T, 1, self.head_dim)
        # k, v를 num_heads 차원으로 브로드캐스트
        k = k.expand(-1, -1, self.num_heads, -1)
        v = v.expand(-1, -1, self.num_heads, -1)
        # ... 이하 표준 어텐션
```

KV Cache 크기가 **H배 절감**(H = num_heads)된다. 그러나 K, V 표현력 감소로 긴 문서나 복잡한 추론에서 품질 저하가 관찰된다. PaLM, Falcon, StarCoder가 채택했다.

## Grouped-Query Attention (GQA)

![MHA, MQA, GQA 구조 비교](/assets/posts/transformer-mqa-gqa-diagram.svg)

2023년 Ainslie et al.이 제안한 GQA는 MQA와 MHA 사이의 균형점이다. Q 헤드를 G개 그룹으로 나누고, **같은 그룹 내 Q 헤드들만 하나의 KV 헤드를 공유**한다. 그룹 수 G는 1이면 MQA, H이면 MHA와 동일하다.

```python
class GroupedQueryAttention(nn.Module):
    def __init__(self, d_model, num_heads, num_kv_heads, head_dim):
        super().__init__()
        assert num_heads % num_kv_heads == 0
        self.num_heads = num_heads
        self.num_kv_heads = num_kv_heads
        self.groups = num_heads // num_kv_heads  # 그룹당 Q 헤드 수

        self.W_q = nn.Linear(d_model, num_heads * head_dim, bias=False)
        self.W_k = nn.Linear(d_model, num_kv_heads * head_dim, bias=False)
        self.W_v = nn.Linear(d_model, num_kv_heads * head_dim, bias=False)
        self.W_o = nn.Linear(num_heads * head_dim, d_model, bias=False)

    def forward(self, x, freqs_cos, freqs_sin):
        B, T, _ = x.shape
        q = self.W_q(x).view(B, T, self.num_heads, -1)
        k = self.W_k(x).view(B, T, self.num_kv_heads, -1)
        v = self.W_v(x).view(B, T, self.num_kv_heads, -1)
        # KV를 그룹 크기만큼 반복해 Q와 shape 맞춤
        k = k.repeat_interleave(self.groups, dim=2)
        v = v.repeat_interleave(self.groups, dim=2)
        # 이후 표준 어텐션 (FlashAttention 적용 가능)
```

`repeat_interleave` 대신 실제 구현에서는 추론 시 KV를 복제하지 않고 인덱싱으로 처리해 메모리를 아낀다.

## KV Cache 메모리 수치 비교

![KV Cache 메모리 계산](/assets/posts/transformer-mqa-gqa-kvcache.svg)

LLaMA 3 70B(64 Q heads, 8 KV heads, 80 layers, head_dim 128)에서:

| 방식 | KV 헤드 수 | KV Cache (seq=8K) | 절감 |
|------|-----------|------------------|-----|
| MHA | 64 | ~160 GB | — |
| GQA | 8 | ~20 GB | 8× |
| MQA | 1 | ~2.5 GB | 64× |

GQA는 MHA 수준 품질을 유지하면서 8배 절감을 달성한다. MQA는 절감 폭이 크지만 품질 저하가 있다. 그룹 비율 H/G = 8이 업계 표준으로 자리잡았다.

## MHA에서 GQA로 업사이클링

기존 MHA 모델을 GQA로 변환하는 방법도 있다. Ainslie et al.은 그룹 내 KV 헤드를 **평균 풀링(Mean Pooling)**해 초기화한 후 소량 파인튜닝하는 업사이클링을 제안했다. 전체 재학습 없이 GQA의 효율을 얻을 수 있다.

```python
def mha_to_gqa(w_k, num_heads, num_kv_heads):
    # w_k: (num_heads * head_dim, d_model)
    head_dim = w_k.shape[0] // num_heads
    w_k = w_k.view(num_heads, head_dim, -1)
    group_size = num_heads // num_kv_heads
    # 그룹별 평균으로 KV 헤드 초기화
    w_k_gqa = w_k.view(num_kv_heads, group_size, head_dim, -1).mean(dim=1)
    return w_k_gqa.view(num_kv_heads * head_dim, -1)
```

## 모델별 GQA 설정

| 모델 | Q heads | KV heads | 비율 |
|------|---------|----------|-----|
| LLaMA 3 8B | 32 | 8 | 4× |
| LLaMA 3 70B | 64 | 8 | 8× |
| Mistral 7B | 32 | 8 | 4× |
| Qwen2 72B | 64 | 8 | 8× |
| Gemma 2 9B | 16 | 8 | 2× |

GQA는 KV Cache 절감뿐 아니라 **디코딩 속도**도 향상시킨다. KV 읽기 IO가 줄어 메모리 대역폭 병목이 완화되기 때문이다. 다음 글에서 다룰 MoE는 파라미터 수와 연산 비용의 분리라는 또 다른 차원의 효율화 전략이다.

---

**지난 글:** [FlashAttention: IO-Aware 어텐션 연산](/posts/transformer-flash-attention/)

**다음 글:** [Mixture of Experts: 희소 활성화로 거대 모델 만들기](/posts/transformer-moe/)

<br>
읽어주셔서 감사합니다. 😊
