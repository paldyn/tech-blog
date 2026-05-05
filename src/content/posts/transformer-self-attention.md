---
title: "Self-Attention: 모든 토큰이 모든 토큰과 대화한다"
description: "Scaled Dot-Product Self-Attention의 Q·K·V 계산 과정을 수식, 코드, 시각화로 완전히 이해한다. √d_k 스케일링이 왜 필요한지, 어텐션 행렬을 어떻게 해석하는지 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["SelfAttention", "ScaledDotProduct", "QKV", "Transformer", "딥러닝"]
featured: false
draft: false
---

[지난 글](/posts/transformer-basics/)에서 Transformer의 전체 아키텍처를 조감했다. 이번 글에서는 그 핵심 연산—**Self-Attention**—을 분자 단위로 해부한다. Self-Attention을 진정으로 이해하면 BERT가 어떻게 문맥을 포착하는지, GPT가 어떻게 다음 토큰을 예측하는지, 그리고 수천 가지 변형 모델의 구조적 차이가 무엇인지 한눈에 파악할 수 있다.

## 왜 'Self' Attention인가

앞에서 본 Bahdanau Attention은 **서로 다른** 두 시퀀스(인코더 vs 디코더) 사이의 관계를 계산했다. **Self-Attention**은 **같은** 시퀀스 내에서 각 토큰이 다른 모든 토큰과의 관계를 스스로 계산한다. "나는 사과를 먹었다"에서 "먹었다"라는 토큰이 "나는", "사과를"과 얼마나 관련 있는지 수치화하는 것이다.

## Q, K, V: 세 역할의 분리

![Self-Attention: Q, K, V 계산 과정](/assets/posts/transformer-self-attention-qkv.svg)

입력 행렬 X ∈ R^{n × d_model} 에서 세 행렬을 만든다.

```
Q = X · W_Q    ← Query: "나는 무엇을 찾는가?"
K = X · W_K    ← Key:   "나는 무엇을 제공하는가?"
V = X · W_V    ← Value: "나의 실제 내용은 무엇인가?"
```

데이터베이스 비유: Q는 검색어, K는 인덱스, V는 실제 데이터다. 검색어(Q)가 인덱스(K)와 얼마나 일치하는지 점수를 계산하고, 그 점수에 비례해 데이터(V)를 가져온다.

## Scaled Dot-Product Attention

```python
import math
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V, mask=None):
    """
    Q, K: (B, T, d_k)
    V:    (B, T, d_v)
    """
    d_k = Q.size(-1)
    # 1. Q·Kᵀ 점수 행렬: (B, T, T)
    scores = Q @ K.transpose(-2, -1) / math.sqrt(d_k)
    # 2. 마스킹 (디코더용, 선택적)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))
    # 3. Softmax → 어텐션 가중치
    alpha = F.softmax(scores, dim=-1)   # (B, T, T)
    # 4. 가중 합산
    out = alpha @ V                     # (B, T, d_v)
    return out, alpha
```

## √d_k 스케일링: 왜 필요한가

![Scaled Dot-Product Attention 흐름](/assets/posts/transformer-self-attention-scaled.svg)

Q와 K의 각 원소가 평균 0, 분산 1의 분포를 따른다고 가정하면:

```
Var(Q·K) = d_k  →  std(Q·K) = √d_k
```

d_k=64일 때 내적 값의 표준편차가 8이다. 이 값을 softmax에 넣으면 가장 큰 값에 모든 확률이 쏠려 **softmax가 포화**된다. 이 상태에서 기울기는 거의 0이 된다.

```python
# 스케일링 효과 실험
import torch

d_k = 64
q = torch.randn(100, d_k)
k = torch.randn(100, d_k)
scores_raw    = q @ k.T
scores_scaled = q @ k.T / math.sqrt(d_k)

print(f"Raw    std: {scores_raw.std():.2f}")     # ≈ 8.0
print(f"Scaled std: {scores_scaled.std():.2f}")  # ≈ 1.0
print(f"Raw    softmax entropy: {(-F.softmax(scores_raw,-1)*F.log_softmax(scores_raw,-1)).sum(-1).mean():.3f}")
print(f"Scaled softmax entropy: {(-F.softmax(scores_scaled,-1)*F.log_softmax(scores_scaled,-1)).sum(-1).mean():.3f}")
```

## 어텐션 행렬 해석

어텐션 행렬 α ∈ R^{n × n}은 강력한 해석 도구다. `α[i][j]`는 토큰 i가 토큰 j에 얼마나 '주목'하는지를 나타낸다.

```python
# Hugging Face로 어텐션 시각화
from transformers import BertModel, BertTokenizer

tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
model     = BertModel.from_pretrained("bert-base-uncased",
                                       output_attentions=True)

inputs = tokenizer("The cat sat on the mat", return_tensors="pt")
with torch.no_grad():
    out = model(**inputs)

# out.attentions: 12 레이어 × (1, 12heads, T, T)
attn_l0 = out.attentions[0][0]  # (12, T, T) — 첫 레이어
```

연구에 따르면 BERT 헤드들은 대명사 공참조(head가 "it" → "cat"), 동사-목적어 관계, 위치적 패턴 등 서로 다른 언어 현상을 자동으로 포착한다.

## 계산 복잡도

| 연산 | 복잡도 |
|---|---|
| Q·Kᵀ (행렬 곱) | O(n² · d_k) |
| 전체 메모리 | O(n²) — 어텐션 행렬 |
| 최대 경로 길이 | O(1) — 어떤 두 토큰도 직접 연결 |

O(n²) 복잡도는 긴 시퀀스의 병목이 된다. n=8192 토큰이면 어텐션 행렬 크기가 8192² = 67M 원소다. FlashAttention은 타일 기반 연산으로 메모리를 O(n)으로 줄인다.

---

**지난 글:** [Transformer 기초: Attention Is All You Need](/posts/transformer-basics/)

**다음 글:** [Multi-Head Attention: 여러 관점으로 동시에 보기](/posts/transformer-multi-head/)

<br>
읽어주셔서 감사합니다. 😊
