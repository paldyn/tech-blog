---
title: "Positional Encoding: 트랜스포머에 순서를 알려주는 방법"
description: "Self-Attention이 순서를 모르는 이유, 사인·코사인 함수로 위치 정보를 인코딩하는 원리, 그리고 PyTorch 직접 구현까지 단계별로 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["트랜스포머", "Positional Encoding", "딥러닝", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-multi-head/)에서 Multi-Head Attention이 서로 다른 관점에서 병렬로 어텐션을 계산하는 방식을 살펴봤다. 그런데 Self-Attention에는 치명적인 약점이 하나 있다. "나는 AI를 공부한다"와 "AI를 나는 공부한다"를 완전히 같은 입력으로 본다. 단어 집합은 동일하고 어텐션은 순열에 불변(permutation-invariant)하기 때문이다. 이 문제를 해결하는 것이 **Positional Encoding(PE)**이다.

## Self-Attention은 왜 순서를 모르는가

행렬 곱셈 `Q·K^T`는 각 토큰 쌍의 유사도를 계산하지만, 어느 위치에서 왔는지는 반영하지 않는다. RNN은 이전 은닉 상태를 이어받아 순서를 자연스럽게 담지만, 트랜스포머는 모든 위치를 동시에 병렬 처리하므로 별도로 위치 정보를 주입해야 한다.

## 사인·코사인 인코딩

원래 논문 *Attention Is All You Need*에서 제안한 고정(fixed) PE는 아래 공식을 사용한다.

```
PE(pos, 2i)   = sin( pos / 10000^(2i/d_model) )
PE(pos, 2i+1) = cos( pos / 10000^(2i/d_model) )
```

- **pos**: 시퀀스 내 토큰 위치 (0, 1, 2, …)  
- **i**: 임베딩 차원 인덱스 (0 ≤ i < d_model/2)  
- **d_model**: 임베딩 크기 (예: 512)

![Positional Encoding 공식과 주파수 비교](/assets/posts/transformer-positional-encoding-formula.svg)

각 차원이 서로 다른 주파수를 갖는 덕분에, 낮은 차원은 인접한 위치를 세밀하게 구분하고, 높은 차원은 장거리 위치 관계를 담는다. 차원 수가 늘어날수록 주기가 기하급수적으로 길어져 최대 `2π × 10000` (약 6만 3천)까지 확장된다.

## 왜 sin/cos를 쓰는가

- **학습 파라미터 없음**: 별도 가중치 행렬 없이 수식으로 계산.  
- **임의 길이 일반화**: 학습 때 보지 않은 더 긴 시퀀스에도 적용 가능.  
- **상대 위치 인코딩 가능**: `PE(pos+k)`는 `PE(pos)`의 선형 변환으로 표현되어, 두 위치의 내적이 상대 거리를 포착한다.

## 임베딩에 더하는 방법

PE는 토큰 임베딩과 **같은 shape**(`seq_len × d_model`)을 가지며, 단순히 element-wise 덧셈으로 결합된다. 이후 Dropout을 적용하고 Encoder/Decoder 첫 번째 레이어로 전달된다.

![PE 더하기 흐름 — 토큰 임베딩 + 위치 정보](/assets/posts/transformer-positional-encoding-addition.svg)

## PyTorch 구현

```python
import torch
import math
import torch.nn as nn

class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 5000, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(max_len).unsqueeze(1)            # (max_len, 1)
        div = torch.exp(
            torch.arange(0, d_model, 2) * -(math.log(10000.0) / d_model)
        )                                                   # (d_model/2,)
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer('pe', pe)                      # 학습 제외 상수

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, d_model)
        x = x + self.pe[:x.size(1)]
        return self.dropout(x)
```

`register_buffer`로 등록하면 `state_dict`에 포함되지만 `optimizer`에는 넘어가지 않아, GPU 이동과 저장이 자동으로 처리된다.

## 학습형 PE와의 비교

| 구분 | 고정 PE (sin/cos) | 학습형 PE |
|------|------------------|-----------|
| 파라미터 | 없음 | `max_len × d_model` |
| 길이 일반화 | 가능 | 최대 길이 제한 |
| 예시 모델 | 원논문 트랜스포머 | BERT, GPT-2 |
| 학습 비용 | 추가 비용 없음 | 약간 증가 |

BERT와 GPT 계열은 학습형 PE를 선택해 데이터에서 위치 표현을 익히게 했다. 최근에는 **RoPE**(Rotary Position Embedding)나 **ALiBi** 같은 상대적 위치 인코딩 방식이 긴 컨텍스트 모델에서 더 널리 쓰인다 (이후 편에서 다룬다).

## 정리

- Self-Attention은 순열 불변이므로 위치 정보를 별도로 주입해야 한다.  
- 원논문의 sin/cos PE는 파라미터 없이 임의 길이를 지원하며 상대 위치까지 암묵적으로 인코딩한다.  
- 토큰 임베딩과 같은 shape으로 단순 덧셈해 합산하며, 이후 레이어에 전달된다.

---

**다음 글:** [Transformer Encoder: 문맥을 이해하는 핵심 블록](/posts/transformer-encoder/)

<br>
읽어주셔서 감사합니다. 😊
