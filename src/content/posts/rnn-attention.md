---
title: "Attention 메커니즘: Seq2Seq 병목을 극복하다"
description: "Bahdanau Attention의 핵심 아이디어—Context Vector를 동적으로 계산하기—와 Luong Attention, Scaled Dot-Product Attention의 차이를 코드와 시각화로 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["Attention", "어텐션메커니즘", "Bahdanau", "Seq2Seq", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/rnn-seq2seq/)에서 Seq2Seq의 병목 문제를 확인했다—입력 전체를 하나의 고정 벡터로 압축하면 긴 문장에서 정보가 손실된다. 2015년 Bahdanau et al.은 단순하지만 강력한 해법을 제안했다: 디코더가 각 출력 토큰을 생성할 때 **인코더의 모든 은닉 상태를 직접 참조**하되, 현재 맥락과 관련 있는 상태에 **더 높은 가중치**를 부여하는 것이다. 이것이 **Attention 메커니즘**의 탄생이다.

## 핵심 아이디어

기존 Seq2Seq는 인코더 마지막 상태만 사용했다. Attention은 **모든 인코더 상태 h₁, h₂, ..., hₙ을 보존**하고, 디코더 상태 s_t를 쿼리로 삼아 각 h_i와의 관련도(attention score)를 계산한다.

![Attention 메커니즘: 병목 문제 해결](/assets/posts/rnn-attention-mechanism.svg)

## Bahdanau (Additive) Attention

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class BahdanauAttention(nn.Module):
    def __init__(self, enc_hid, dec_hid):
        super().__init__()
        self.W_s = nn.Linear(dec_hid, dec_hid, bias=False)
        self.W_h = nn.Linear(enc_hid, dec_hid, bias=False)
        self.v   = nn.Linear(dec_hid, 1, bias=False)

    def forward(self, s, enc_outputs):
        # s: (B, dec_hid), enc_outputs: (B, T, enc_hid)
        s_exp = s.unsqueeze(1)               # (B, 1, dec_hid)
        score = self.v(torch.tanh(
            self.W_s(s_exp) + self.W_h(enc_outputs)
        )).squeeze(-1)                        # (B, T)
        alpha = F.softmax(score, dim=-1)     # (B, T)
        context = (alpha.unsqueeze(-1) * enc_outputs).sum(1)
        return context, alpha                # (B, enc_hid), (B, T)
```

`alpha` 행렬을 시각화하면 디코더가 번역 시 어느 소스 단어에 집중하는지 볼 수 있다—이것이 Attention의 해석 가능성이라는 부가 가치다.

## Luong (Dot-Product) Attention

Luong et al.(2015)은 더 단순한 내적 기반 점수를 제안했다.

```python
class LuongAttention(nn.Module):
    def __init__(self, method="dot"):
        super().__init__()
        self.method = method

    def forward(self, s, enc_outputs):
        # s: (B, 1, hid), enc_outputs: (B, T, hid)
        if self.method == "dot":
            score = torch.bmm(s, enc_outputs.transpose(1, 2))
        elif self.method == "general":
            # self.W = nn.Linear(hid, hid, bias=False)
            score = torch.bmm(s, self.W(enc_outputs).transpose(1, 2))
        score = score.squeeze(1)             # (B, T)
        alpha = F.softmax(score, dim=-1)
        context = torch.bmm(alpha.unsqueeze(1), enc_outputs).squeeze(1)
        return context, alpha
```

## Attention 종류별 비교

![Attention 종류별 점수 계산](/assets/posts/rnn-attention-scores.svg)

| 종류 | 점수 함수 | 추가 파라미터 | 특징 |
|---|---|---|---|
| Additive (Bahdanau) | vᵀ·tanh(W_s·s + W_h·h) | W_s, W_h, v | 가장 표현력 강함 |
| Dot-Product (Luong) | sᵀ·h | 없음 | 가장 단순·빠름 |
| Scaled Dot-Product | (Q·Kᵀ)/√d_k | W_Q, W_K, W_V | Transformer 표준 |

## Attention이 Transformer로 이어지는 과정

Attention 메커니즘의 핵심 통찰은 쿼리(Query), 키(Key), 밸류(Value)의 분리였다. Luong의 내적 Attention에서 한 발 더 나아가:

1. 쿼리(현재 디코더 상태)를 선형 변환 → Q
2. 키(인코더 상태들)를 선형 변환 → K  
3. 밸류(인코더 상태들)를 선형 변환 → V
4. `softmax(Q·Kᵀ / √d_k) · V`

이것이 **Scaled Dot-Product Attention**—Transformer의 심장부다. Vaswani et al.(2017)은 여기서 RNN을 완전히 제거하고 Attention만으로 Seq2Seq를 구성했다.

```python
import math

def scaled_dot_product_attention(Q, K, V, mask=None):
    d_k = Q.size(-1)
    scores = Q @ K.transpose(-2, -1) / math.sqrt(d_k)
    if mask is not None:
        scores = scores.masked_fill(mask, float('-inf'))
    alpha = F.softmax(scores, dim=-1)
    return alpha @ V, alpha   # (B, T, d_v), (B, T, T)
```

Attention은 RNN 계열의 한계를 극복하는 핵심 열쇠였고, 결국 Transformer 혁명의 씨앗이 됐다.

---

**지난 글:** [Seq2Seq: 인코더-디코더로 시퀀스를 시퀀스로](/posts/rnn-seq2seq/)

**다음 글:** [RNN의 한계와 Transformer로의 전환](/posts/rnn-limitations/)

<br>
읽어주셔서 감사합니다. 😊
