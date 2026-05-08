---
title: "Transformer Encoder: 문맥을 이해하는 핵심 블록"
description: "트랜스포머 인코더 블록의 내부 구조를 Multi-Head Self-Attention, FFN, 잔차 연결, Layer Normalization으로 나누어 살펴보고 PyTorch로 직접 구현한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["트랜스포머", "Encoder", "Self-Attention", "딥러닝", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-positional-encoding/)에서 토큰의 순서 정보를 sin/cos 함수로 주입하는 방법을 배웠다. 이 정보를 담은 입력 벡터가 가장 먼저 통과하는 구조가 바로 **Encoder**다. 인코더는 입력 시퀀스 전체를 동시에 읽어 각 토큰에 '문맥이 반영된 표현'을 부여한다.

## 인코더 블록의 구조

Encoder 한 블록은 두 개의 서브레이어로 이루어진다.

1. **Multi-Head Self-Attention** — 모든 위치가 서로를 참조해 관련성을 계산한다.
2. **Position-wise Feed-Forward Network (FFN)** — 위치별로 독립적인 비선형 변환을 적용한다.

각 서브레이어에는 **잔차 연결(Residual Connection)**과 **Layer Normalization**이 뒤따른다.

```
output = LayerNorm( x + Sublayer(x) )
```

이 패턴을 **Add & Norm**이라 부르며, 잔차 경로가 그래디언트를 직접 이전 레이어까지 전달해 깊은 네트워크도 안정적으로 학습된다.

![Transformer Encoder 블록 구조](/assets/posts/transformer-encoder-block.svg)

## Self-Attention: Q = K = V

인코더의 Self-Attention에서는 Query, Key, Value가 모두 같은 입력 `x`에서 만들어진다. 결과적으로 각 토큰이 시퀀스 전체를 참조해 자신의 표현을 업데이트한다. 예를 들어 "그 선수는 은메달을 땄다"에서 "그"가 "선수"와 강하게 연결되는 어텐션 패턴이 생성된다.

패딩 토큰(`<PAD>`)의 어텐션을 막기 위해 **Padding Mask**를 사용한다. 이 마스크는 `<PAD>` 위치의 어텐션 점수를 −∞로 설정해 Softmax 이후 값이 0에 수렴하도록 만든다.

## Feed-Forward Network

FFN은 두 개의 선형 변환 사이에 비선형 활성화를 끼워 넣은 구조다.

```python
FFN(x) = max(0, x @ W1 + b1) @ W2 + b2
# 또는 GELU 활성화 사용 (BERT, GPT-2 등)
```

내부 차원 `d_ff`는 `d_model`의 4배가 기본값이다. 원논문에서 `d_model=512`, `d_ff=2048`을 사용했다. FFN은 위치별로 **독립적으로** 적용되므로 병렬 처리가 용이하다.

## 스택 구조: N개 레이어 쌓기

인코더 블록 하나를 N번 반복해 쌓는다. 레이어가 깊어질수록 표현이 더 추상화된다.

- **얕은 레이어**: 품사, 어휘 관계 같은 표층 정보  
- **중간 레이어**: 구 구조, 문법 패턴  
- **깊은 레이어**: 의미, 장거리 의존 관계

![Encoder 스택과 문맥 표현](/assets/posts/transformer-encoder-stack.svg)

## PyTorch 구현

```python
import torch.nn as nn
import torch.nn.functional as F

class FFN(nn.Module):
    def __init__(self, d_model: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.fc1 = nn.Linear(d_model, d_ff)
        self.fc2 = nn.Linear(d_ff, d_model)
        self.drop = nn.Dropout(dropout)

    def forward(self, x):
        return self.fc2(self.drop(F.gelu(self.fc1(x))))

class EncoderLayer(nn.Module):
    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.attn  = nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True)
        self.ff    = FFN(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.drop  = nn.Dropout(dropout)

    def forward(self, x, src_key_padding_mask=None):
        attn_out, _ = self.attn(x, x, x, key_padding_mask=src_key_padding_mask)
        x = self.norm1(x + self.drop(attn_out))   # Add & Norm
        x = self.norm2(x + self.drop(self.ff(x))) # Add & Norm
        return x

class Encoder(nn.Module):
    def __init__(self, d_model: int, n_heads: int, d_ff: int, n_layers: int):
        super().__init__()
        self.layers = nn.ModuleList(
            [EncoderLayer(d_model, n_heads, d_ff) for _ in range(n_layers)]
        )
        self.norm = nn.LayerNorm(d_model)

    def forward(self, x, mask=None):
        for layer in self.layers:
            x = layer(x, src_key_padding_mask=mask)
        return self.norm(x)
```

## Layer Normalization vs Batch Normalization

원논문과 BERT는 **Pre-Norm** 대신 **Post-Norm** 방식(서브레이어 통과 후 정규화)을 사용했다. 최근 모델들은 잔차 경로를 깨끗하게 유지하는 **Pre-Norm**(서브레이어 전 정규화)을 선호한다.

| 구분 | Post-Norm | Pre-Norm |
|------|-----------|----------|
| 공식 | LayerNorm(x + Sub(x)) | x + Sub(LayerNorm(x)) |
| 학습 안정성 | 깊어지면 불안정할 수 있음 | 더 안정적 |
| 성능 | 원논문 스타일 | GPT-3, LLaMA 등 채택 |

## 정리

- Encoder 블록 = Self-Attention + FFN, 각각 Add & Norm으로 감쌈  
- Self-Attention이 전역 문맥을, FFN이 위치별 비선형 변환을 담당  
- N개 레이어를 쌓아 점점 추상적인 표현을 생성  
- 최종 출력은 각 토큰에 문맥이 반영된 `(seq_len × d_model)` 행렬

---

**지난 글:** [Positional Encoding: 트랜스포머에 순서를 알려주는 방법](/posts/transformer-positional-encoding/)

**다음 글:** [Transformer Decoder: 문장을 생성하는 블록](/posts/transformer-decoder/)

<br>
읽어주셔서 감사합니다. 😊
