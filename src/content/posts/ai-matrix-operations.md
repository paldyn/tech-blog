---
title: "행렬 연산 완전 정복: AI에서 쓰이는 핵심 연산 5가지"
description: "행렬 곱셈부터 전치, 역행렬, 브로드캐스팅까지 AI 실무에서 반드시 알아야 할 행렬 연산을 PyTorch와 함께 정리한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["선형대수", "행렬", "PyTorch", "NumPy", "텐서", "AI수학"]
featured: false
draft: false
---

[지난 글](/posts/ai-linear-algebra-essentials/)에서 스칼라·벡터·행렬·텐서의 개념을 잡고 내적과 코사인 유사도를 살펴봤다. 이번에는 행렬 연산 자체에 집중한다. "행렬을 곱한다"는 게 정확히 무슨 의미인지, AI 코드에서 `@` 연산자나 `torch.matmul()`이 어떻게 작동하는지를 시각적으로 이해하고, 실제 AI 코드에서 어떻게 쓰이는지 살펴본다.

## 행렬 곱셈: 선형 변환의 합성

행렬 곱셈은 덧셈이나 스칼라 곱과 달리 **특별한 규칙**이 있다. (m×k) 크기의 행렬 A와 (k×n) 크기의 행렬 B를 곱하면 (m×n) 크기의 결과가 나온다. 핵심은 **앞 행렬의 열 수와 뒤 행렬의 행 수가 같아야 한다**는 것이다.

```python
import numpy as np
import torch

# 규칙 검증
A = np.array([[1, 2, 3],
              [4, 5, 6]])   # (2, 3)

B = np.array([[7,  8],
              [9,  10],
              [11, 12]])   # (3, 2)

# (2×3) @ (3×2) = (2×2) ← 가능
C = A @ B
print(C)
# [[ 58  64]
#  [139 154]]

# C[0][0] = 1×7 + 2×9 + 3×11 = 7 + 18 + 33 = 58
# C[0][1] = 1×8 + 2×10 + 3×12 = 8 + 20 + 36 = 64

# 불가능한 경우:
# (2×3) @ (2×3) → 오류!
# A @ A  # ValueError: matmul shape mismatch
```

![행렬 곱셈 시각화](/assets/posts/ai-matrix-operations-visual.svg)

결과 행렬의 각 원소는 **A의 해당 행과 B의 해당 열의 내적**이다. 직관적으로 보면 행렬 곱셈은 벡터 내적을 모든 행-열 조합에 대해 한꺼번에 수행하는 것이다.

## 전치 (Transpose): 행과 열을 바꾼다

전치는 행렬의 행과 열을 뒤집는 연산이다. (m×n) 행렬의 전치는 (n×m)이 된다.

```python
import torch

A = torch.tensor([[1, 2, 3],
                  [4, 5, 6]])  # (2, 3)

# 전치 방법들
A_T = A.T                          # (3, 2)
A_T = A.transpose(0, 1)            # 같은 결과
A_T = torch.transpose(A, 0, 1)    # 같은 결과

print(A_T)
# tensor([[1, 4],
#         [2, 5],
#         [3, 6]])
```

Attention 메커니즘에서 `Q @ K.transpose(-2, -1)`은 Query 행렬과 Key 행렬의 전치를 곱해 각 토큰 쌍의 유사도 점수를 계산한다. 역전파(Backpropagation)에서도 그래디언트를 계산할 때 전치가 핵심적으로 등장한다.

## 브로드캐스팅: 크기가 다른 텐서의 연산

딥러닝 코드에서 가장 혼란스러운 개념 중 하나가 **브로드캐스팅(Broadcasting)**이다. 크기가 다른 텐서들 사이의 연산을 자동으로 처리하는 메커니즘이다.

```python
import torch

# 배치(32개 샘플) × 시퀀스(10 토큰) × 임베딩(768차원)
embeddings = torch.randn(32, 10, 768)

# 각 임베딩을 정규화하는 스케일 팩터 (768차원 벡터)
scale = torch.ones(768)

# 브로드캐스팅: (32, 10, 768) × (768,) → (32, 10, 768)
# scale이 (32, 10, 768)으로 자동 확장됨
scaled = embeddings * scale

# Attention score 스케일링
# scores: (32, 10, 10), d_k: 스칼라
d_k = 64
scores = torch.randn(32, 10, 10)
scores = scores / (d_k ** 0.5)  # 스칼라가 모든 원소에 적용
```

## 소프트맥스: 점수를 확률로 변환

행렬 연산의 결과로 나온 점수(score)들을 확률 분포로 변환할 때 소프트맥스를 사용한다.

```python
import torch
import torch.nn.functional as F

# Attention 점수 행렬 (배치×헤드×시퀀스×시퀀스)
scores = torch.randn(2, 8, 10, 10)

# 소프트맥스: 각 행이 합계 1인 확률 분포가 됨
attention_weights = F.softmax(scores, dim=-1)
print(attention_weights[0, 0, 0].sum())  # ≈ 1.0

# 마스킹된 Attention (미래 토큰 숨기기)
mask = torch.triu(torch.ones(10, 10), diagonal=1).bool()
scores.masked_fill_(mask, float('-inf'))
attention_weights = F.softmax(scores, dim=-1)
```

## Self-Attention의 전체 행렬 연산

Transformer 이해의 핵심인 Self-Attention을 행렬 연산으로 구현하면 다음과 같다.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SimpleSelfAttention(nn.Module):
    def __init__(self, d_model, d_k):
        super().__init__()
        # 입력을 Q, K, V로 선형 변환하는 가중치
        self.W_q = nn.Linear(d_model, d_k)
        self.W_k = nn.Linear(d_model, d_k)
        self.W_v = nn.Linear(d_model, d_k)

    def forward(self, x):
        # x: (배치, 시퀀스 길이, d_model)
        Q = self.W_q(x)   # (B, T, d_k) — 행렬곱
        K = self.W_k(x)   # (B, T, d_k) — 행렬곱
        V = self.W_v(x)   # (B, T, d_k) — 행렬곱

        # 유사도 점수: (B, T, T)
        scores = Q @ K.transpose(-2, -1) / (K.size(-1) ** 0.5)

        # 확률 가중치
        weights = F.softmax(scores, dim=-1)

        # 가중 합산: (B, T, d_k)
        return weights @ V
```

![PyTorch 텐서 연산 실습](/assets/posts/ai-matrix-operations-pytorch.svg)

## reshape와 view: 텐서 모양 변환

멀티헤드 Attention에서 자주 쓰이는 연산으로, 텐서의 내용은 유지하면서 모양만 바꾼다.

```python
# (배치, 시퀀스, d_model) → 멀티헤드용 형태 변환
batch, seq, d_model = 2, 10, 512
num_heads = 8
d_k = d_model // num_heads  # 64

x = torch.randn(batch, seq, d_model)

# 헤드 분리: (2, 10, 512) → (2, 10, 8, 64) → (2, 8, 10, 64)
x_heads = x.reshape(batch, seq, num_heads, d_k)
x_heads = x_heads.transpose(1, 2)  # (2, 8, 10, 64)

# 각 헤드에서 독립적으로 Attention 수행 가능
print(x_heads.shape)  # torch.Size([2, 8, 10, 64])
```

행렬 연산은 처음에는 추상적으로 느껴지지만, "입력 벡터를 다른 공간으로 선형 변환한다"는 직관을 잡으면 이후 신경망, Attention, 역전파 모두 같은 언어로 이해할 수 있다. 이 시리즈에서 앞으로 등장하는 모든 딥러닝 코드는 결국 이 행렬 연산의 조합이다.

---

**지난 글:** [AI를 위한 선형대수 핵심: 벡터와 행렬부터 시작하자](/posts/ai-linear-algebra-essentials/)

**다음 글:** [AI를 위한 확률론 기초: 불확실성을 다루는 언어](/posts/ai-probability-basics/)

<br>
읽어주셔서 감사합니다. 😊
