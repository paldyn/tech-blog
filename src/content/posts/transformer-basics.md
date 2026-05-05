---
title: "Transformer 기초: Attention Is All You Need"
description: "2017년 Vaswani et al.이 발표한 Transformer 아키텍처의 전체 구조—인코더, 디코더, Self-Attention, FFN, Positional Encoding, Add & Norm—을 처음부터 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["Transformer", "셀프어텐션", "인코더디코더", "딥러닝", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/rnn-limitations/)에서 RNN의 세 가지 본질적 한계—기울기 소실, 순차 처리, 장거리 의존성—를 정리하고 Transformer가 이를 해결한다는 것을 확인했다. 2017년 Google의 Vaswani et al.이 발표한 논문 "Attention Is All You Need"는 제목 그대로 RNN을 완전히 제거하고 **Attention만으로** 시퀀스 변환을 수행하는 혁명적 아키텍처를 제시했다. BERT, GPT, T5, LLaMA 등 현재 모든 대형 언어 모델의 기반이다.

## 전체 아키텍처 개요

Transformer는 N개의 **인코더 레이어**와 N개의 **디코더 레이어**로 구성된다. 원 논문에서 N=6이었다.

![Transformer 전체 아키텍처](/assets/posts/transformer-basics-architecture.svg)

## 인코더 레이어 구조

인코더 한 레이어는 두 서브레이어로 구성된다.

```
Layer(x) = LayerNorm(x + SubLayer(x))  ← 잔차 연결 + 정규화
```

1. **Multi-Head Self-Attention**: 같은 시퀀스 내 모든 위치 쌍의 관계를 계산
2. **Feed-Forward Network(FFN)**: 각 위치 독립적으로 2층 MLP 적용

```python
import torch
import torch.nn as nn

class EncoderLayer(nn.Module):
    def __init__(self, d_model=512, nhead=8, d_ff=2048, dropout=0.1):
        super().__init__()
        self.self_attn = nn.MultiheadAttention(d_model, nhead,
                                               batch_first=True)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.drop  = nn.Dropout(dropout)

    def forward(self, x, src_key_padding_mask=None):
        # 1. Self-Attention + 잔차
        attn_out, _ = self.self_attn(x, x, x,
            key_padding_mask=src_key_padding_mask)
        x = self.norm1(x + self.drop(attn_out))
        # 2. FFN + 잔차
        x = self.norm2(x + self.drop(self.ffn(x)))
        return x
```

## 디코더 레이어 구조

디코더는 세 서브레이어를 갖는다.

```python
class DecoderLayer(nn.Module):
    def __init__(self, d_model=512, nhead=8, d_ff=2048, dropout=0.1):
        super().__init__()
        self.self_attn  = nn.MultiheadAttention(d_model, nhead,
                                                batch_first=True)
        self.cross_attn = nn.MultiheadAttention(d_model, nhead,
                                                batch_first=True)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.drop  = nn.Dropout(dropout)

    def forward(self, tgt, mem, tgt_mask=None):
        # 1. Masked Self-Attention (미래 마스킹)
        a, _ = self.self_attn(tgt, tgt, tgt, attn_mask=tgt_mask)
        tgt  = self.norm1(tgt + self.drop(a))
        # 2. Cross-Attention (인코더 출력 참조)
        a, _ = self.cross_attn(tgt, mem, mem)
        tgt  = self.norm2(tgt + self.drop(a))
        # 3. FFN
        tgt  = self.norm3(tgt + self.drop(self.ffn(tgt)))
        return tgt
```

## 핵심 구성 요소 4가지

![Transformer 핵심 구성 요소](/assets/posts/transformer-basics-components.svg)

### 1. Positional Encoding

Transformer는 순서 정보가 없다. 위치 인코딩을 임베딩에 더해 순서를 주입한다.

```python
import math

def get_sinusoidal_encoding(seq_len, d_model):
    pe = torch.zeros(seq_len, d_model)
    pos = torch.arange(seq_len).unsqueeze(1)          # (T, 1)
    div = torch.exp(torch.arange(0, d_model, 2) *
                    (-math.log(10000.0) / d_model))    # (d/2,)
    pe[:, 0::2] = torch.sin(pos * div)
    pe[:, 1::2] = torch.cos(pos * div)
    return pe  # (T, d_model)
```

### 2. FFN: d_ff = 4 × d_model

FFN은 각 토큰 독립적으로 적용된다. d_ff는 d_model의 4배가 표준이다(512→2048). FFN이 모델 파라미터의 약 2/3를 차지하며, **지식 저장소** 역할을 한다는 해석이 있다.

## PyTorch 내장 Transformer

```python
transformer = nn.Transformer(
    d_model=512, nhead=8,
    num_encoder_layers=6, num_decoder_layers=6,
    dim_feedforward=2048, dropout=0.1,
    batch_first=True,
)
src = torch.randn(32, 10, 512)   # (B, src_len, d_model)
tgt = torch.randn(32, 8, 512)    # (B, tgt_len, d_model)
out = transformer(src, tgt)       # (32, 8, 512)
```

## Transformer 변형의 계보

원 논문의 인코더-디코더 구조에서 후속 모델들은 필요에 따라 부분만 사용한다.

- **인코더만**: BERT 계열 (분류·이해 태스크)
- **디코더만**: GPT 계열 (생성 태스크)
- **인코더-디코더**: T5, BART (번역·요약 태스크)

다음 글에서는 Transformer의 심장부인 **Self-Attention** 메커니즘을 수식부터 구현까지 완전히 해부한다.

---

**지난 글:** [RNN의 한계와 Transformer로의 전환](/posts/rnn-limitations/)

**다음 글:** [Self-Attention: 모든 토큰이 모든 토큰과 대화한다](/posts/transformer-self-attention/)

<br>
읽어주셔서 감사합니다. 😊
