---
title: "레이어 정규화: 트랜스포머가 선택한 정규화"
description: "배치 정규화의 한계를 극복하고 트랜스포머 시대를 이끈 레이어 정규화(Layer Normalization)를 이해한다. BN·LN·IN·GN의 차이, Pre-LN 패턴, RMSNorm까지 정규화 방법을 완전히 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["레이어정규화", "LayerNorm", "RMSNorm", "트랜스포머", "정규화"]
featured: false
draft: false
---

[지난 글](/posts/nn-batch-normalization/)에서 배치 정규화가 내부 공변량 이동을 해결하고 학습을 안정화한다는 것을 배웠다. 그런데 배치 정규화는 배치 크기가 작을 때 불안정하고, 시퀀스 길이가 다른 자연어 처리에서 적용하기 어렵다. 이 문제를 해결하기 위해 2016년 Ba et al.이 제안한 **레이어 정규화(Layer Normalization, LN)**가 등장했다. 현재 GPT, BERT, LLaMA 등 사실상 모든 대규모 언어 모델이 레이어 정규화를 사용한다.

## 배치 정규화의 한계와 레이어 정규화

배치 정규화는 **배치 차원(N)을 따라** 통계를 계산한다. 이는 두 가지 문제를 만든다.

1. **배치 크기 의존성**: 배치 크기가 1이면 분산을 계산할 수 없음
2. **시퀀스 처리 부적합**: 서로 다른 길이의 시퀀스를 같은 배치에 처리하기 어려움

레이어 정규화는 **특성 차원(C)을 따라** 통계를 계산한다. 배치 크기와 무관하게 동작한다.

```python
import torch
import torch.nn as nn

# 입력 텐서: (Batch=4, Seq_len=128, d_model=512)
x = torch.randn(4, 128, 512)

# BatchNorm: 배치 + 공간 방향으로 평균/분산
# → NLP에서는 부적합 (시퀀스 방향의 의미 없는 평균)

# LayerNorm: 마지막 차원(d_model)만 정규화
# → 각 토큰의 512차원 임베딩을 독립적으로 정규화
ln = nn.LayerNorm(512)
out = ln(x)  # shape 유지: (4, 128, 512)

# 각 토큰 위치의 평균과 분산 확인
print(out[0, 0].mean().item())  # ≈ 0.0
print(out[0, 0].std().item())   # ≈ 1.0
```

## 레이어 정규화 수식

배치 내 단일 샘플 x ∈ ℝ^H (H는 특성 수)에 대해:

1. **평균**: μ = (1/H) Σᵢ xᵢ
2. **분산**: σ² = (1/H) Σᵢ (xᵢ − μ)²
3. **정규화**: x̂ᵢ = (xᵢ − μ) / √(σ² + ε)
4. **어파인 변환**: yᵢ = γᵢ · x̂ᵢ + βᵢ

배치 정규화와 동일한 수식이지만, **통계 계산 방향이 다르다**. 배치 차원이 아닌 특성 차원으로 계산하므로 배치 크기에 완전히 독립적이다.

![정규화 방법 비교](/assets/posts/nn-layer-normalization-vs-bn.svg)

## 트랜스포머에서의 Pre-LN 패턴

원래 Transformer (Vaswani et al. 2017)는 Post-LN 구조를 사용했다: Attention → Add → LayerNorm. 하지만 이후 연구에서 **Pre-LN**이 학습 안정성이 더 좋다는 것이 밝혀졌다.

```python
import torch.nn as nn

class TransformerLayer(nn.Module):
    def __init__(self, d_model, n_heads, d_ff, dropout=0.1):
        super().__init__()
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(d_model, n_heads,
                                          batch_first=True)
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Linear(d_ff, d_model),
        )
        self.drop = nn.Dropout(dropout)

    def forward(self, x, mask=None):
        # Pre-LN: LayerNorm BEFORE the sublayer
        # 서브레이어 1: Self-Attention
        x_norm = self.norm1(x)
        attn_out, _ = self.attn(x_norm, x_norm, x_norm,
                                 attn_mask=mask)
        x = x + self.drop(attn_out)   # 잔차 연결

        # 서브레이어 2: Feed-Forward
        x = x + self.drop(self.ff(self.norm2(x)))
        return x
```

Pre-LN의 장점:
- 학습 초기부터 기울기가 안정적 (잔차 경로에 정규화 없음)
- 더 깊은 트랜스포머도 수렴 가능
- GPT-2, GPT-3, LLaMA 등 대부분의 현대 LLM이 사용

## RMSNorm: LLaMA와 Gemma의 선택

**Root Mean Square Layer Normalization (RMSNorm)**은 레이어 정규화에서 평균 빼기를 제거한 단순화 버전이다.

$$\text{RMSNorm}(x) = \frac{x}{\text{RMS}(x)} \cdot \gamma, \quad \text{RMS}(x) = \sqrt{\frac{1}{H}\sum_{i=1}^{H} x_i^2}$$

```python
import torch
import torch.nn as nn

class RMSNorm(nn.Module):
    def __init__(self, dim, eps=1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))  # γ만 있음

    def forward(self, x):
        # 평균 빼기 없이 RMS로만 정규화
        rms = x.pow(2).mean(-1, keepdim=True).add(self.eps).sqrt()
        return x / rms * self.weight

# 사용 예 (LLaMA 스타일)
rmsnorm = RMSNorm(4096)
x = torch.randn(2, 512, 4096)  # (B, T, D)
out = rmsnorm(x)
print(out.shape)  # (2, 512, 4096)
```

RMSNorm의 장점:
- 레이어 정규화보다 약 7~15% 빠름
- 평균 계산 생략으로 수치적으로 더 단순
- LLaMA, Gemma, Mistral, Qwen 등이 채택

![레이어 정규화 코드 구현](/assets/posts/nn-layer-normalization-code.svg)

## 정규화 방법 총정리

| 방법 | 통계 계산 축 | 주요 용도 | 배치 의존성 |
|------|-----------|---------|-----------|
| BatchNorm | N 축 (배치) | CNN, MLP | 있음 |
| LayerNorm | C 축 (특성) | 트랜스포머, RNN | 없음 |
| InstanceNorm | H×W 축 (공간) | 스타일 트랜스퍼 | 없음 |
| GroupNorm | G그룹 × H×W | 소배치 CNN, 탐지 | 없음 |
| RMSNorm | C 축 (RMS만) | LLM (LLaMA 등) | 없음 |

현대 딥러닝의 방향은 명확하다. CNN 계열에서는 BatchNorm, 시퀀스/언어 모델에서는 LayerNorm 또는 RMSNorm이 사실상 표준이 되었다. 특히 LLM에서 RMSNorm이 빠른 속도로 주류가 되고 있다.

---

**지난 글:** [배치 정규화: 내부 공변량 이동을 잡아라](/posts/nn-batch-normalization/)

**다음 글:** [드롭아웃: 과적합을 막는 앙상블 정규화](/posts/nn-dropout/)

<br>
읽어주셔서 감사합니다. 😊
