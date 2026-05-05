---
title: "Multi-Head Attention: 여러 관점으로 동시에 보기"
description: "Multi-Head Attention이 단일 어텐션 헤드의 한계를 넘어 다양한 언어 관계를 병렬로 포착하는 원리를 이해하고, PyTorch로 처음부터 구현한다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["MultiHeadAttention", "Transformer", "셀프어텐션", "딥러닝", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-self-attention/)에서 Scaled Dot-Product Attention의 원리를 수식부터 코드까지 완전히 이해했다. 단일 어텐션 헤드는 하나의 표현 공간에서 토큰 간 관계를 계산한다. 하지만 하나의 관점만으로는 충분하지 않다—"나는 사과를 먹었다"라는 문장에서 "먹었다"와 "나는"의 **주어-동사** 관계, "먹었다"와 "사과를"의 **동사-목적어** 관계, "사과"와 "붉다(이전 문장)"의 **대명사 참조** 관계를 동시에 포착해야 한다. **Multi-Head Attention(MHA)**은 이를 위해 h개의 독립적 어텐션 헤드를 병렬로 실행하는 구조다.

## 핵심 아이디어

단일 어텐션은 d_model 차원에서 한 번 계산한다. MHA는 이를 h개의 **더 낮은 차원 부분 공간(d_k = d_model / h)**으로 나눠 각각 독립적으로 어텐션을 계산한다.

```
d_model=512, h=8 → 각 헤드: d_k = 64
```

각 헤드는 자신만의 W_Q, W_K, W_V를 학습하므로, 서로 다른 관계 패턴을 포착하게 된다.

![Multi-Head Attention 구조](/assets/posts/transformer-multi-head-structure.svg)

## 수식

```
head_i = Attention(X·W_Qi, X·W_Ki, X·W_Vi)
MultiHead(X) = Concat(head_1, ..., head_h) · W_O
```

W_O ∈ R^{(h·d_v) × d_model} 은 h개 헤드의 출력을 다시 d_model 차원으로 투영한다.

## 처음부터 구현

```python
import math
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model=512, num_heads=8, dropout=0.1):
        super().__init__()
        assert d_model % num_heads == 0
        self.h  = num_heads
        self.dk = d_model // num_heads
        # W_Q, W_K, W_V, W_O
        self.W_Q = nn.Linear(d_model, d_model)
        self.W_K = nn.Linear(d_model, d_model)
        self.W_V = nn.Linear(d_model, d_model)
        self.W_O = nn.Linear(d_model, d_model)
        self.drop = nn.Dropout(dropout)

    def split_heads(self, x, B, T):
        # (B, T, d_model) → (B, h, T, d_k)
        return x.view(B, T, self.h, self.dk).transpose(1, 2)

    def forward(self, Q, K, V, mask=None):
        B, T, _ = Q.shape
        q = self.split_heads(self.W_Q(Q), B, Q.size(1))
        k = self.split_heads(self.W_K(K), B, K.size(1))
        v = self.split_heads(self.W_V(V), B, V.size(1))
        # Scaled dot-product per head
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.dk)
        if mask is not None:
            scores = scores.masked_fill(mask, float('-inf'))
        alpha = self.drop(F.softmax(scores, dim=-1))
        ctx   = (alpha @ v)                      # (B, h, T, d_k)
        # Concat + W_O
        ctx = ctx.transpose(1, 2).contiguous()   # (B, T, h, d_k)
        ctx = ctx.view(B, -1, self.h * self.dk)  # (B, T, d_model)
        return self.W_O(ctx), alpha
```

## 헤드별 역할: 실제 관찰 결과

![Multi-Head: 헤드별 역할 분담 예시](/assets/posts/transformer-multi-head-concat.svg)

Vig & Belinkov(2019) 연구에 따르면 BERT 헤드들은 자동으로 특화된다.

- **Head 1~2**: 인접 토큰 관계 (bigram 패턴)
- **Head 3~4**: 동사와 목적어 연결
- **Head 5**: 대명사와 선행사 연결
- **Head 6~8**: 문장 전체 구조 파악

이 특화는 명시적으로 지시된 것이 아니라 **언어 모델링 목표만으로** 자동 학습된다.

## 파라미터 수와 계산 비용

```python
# MHA 파라미터 분석
d_model = 512
num_heads = 8
d_k = d_model // num_heads  # 64

# 각 W_Q, W_K, W_V: d_model × d_model = 512 × 512
# W_O: d_model × d_model
params_per_mha = 4 * d_model * d_model
print(f"MHA 파라미터: {params_per_mha:,}")          # 1,048,576
print(f"헤드당 파라미터: {params_per_mha//num_heads:,}")  # 131,072

# PyTorch 내장 검증
mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
total = sum(p.numel() for p in mha.parameters())
print(f"PyTorch MHA 파라미터: {total:,}")            # ≈ 1,049,600
```

## 메모리 최적화: GQA와 MQA

GPT-3(175B)가 h=96 헤드를 쓸 때 메모리가 매우 크다. 이를 줄이기 위해:

- **MQA(Multi-Query Attention)**: K, V를 모든 헤드가 공유 (Q만 헤드별)
- **GQA(Grouped Query Attention)**: K, V를 그룹별 공유 (LLaMA 2, Mistral 채택)

```
MHA: Q(h×d_k), K(h×d_k), V(h×d_k)
GQA: Q(h×d_k), K(g×d_k), V(g×d_k)  g < h
MQA: Q(h×d_k), K(1×d_k), V(1×d_k)
```

GQA는 품질은 MHA에 가깝게 유지하면서 추론 속도를 2~4배 향상시킨다.

## 이 시리즈의 다음 단계

Multi-Head Attention을 이해했으니, 앞으로 다룰 주제들이 훨씬 명확해진다. Positional Encoding이 왜 필요한지(위치 정보가 없는 Self-Attention), 인코더·디코더 Masking이 어떻게 작동하는지, BERT와 GPT가 같은 Transformer를 어떻게 다르게 활용하는지—모두 이 글에서 쌓은 이해 위에서 전개된다.

---

**지난 글:** [Self-Attention: 모든 토큰이 모든 토큰과 대화한다](/posts/transformer-self-attention/)

<br>
읽어주셔서 감사합니다. 😊
