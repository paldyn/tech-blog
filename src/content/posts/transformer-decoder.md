---
title: "Transformer Decoder: 문장을 생성하는 블록"
description: "Masked Self-Attention, Cross-Attention, FFN으로 구성된 디코더 블록의 원리와 Teacher Forcing 학습 방식, 자기 회귀 추론 흐름을 PyTorch 코드와 함께 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["트랜스포머", "Decoder", "Cross-Attention", "자기회귀", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-encoder/)에서 인코더가 입력 시퀀스 전체를 읽어 문맥 표현을 만드는 과정을 살펴봤다. **Decoder**는 그 문맥 표현을 참고하면서 출력 시퀀스를 한 토큰씩 생성하는 역할을 한다. 기계 번역에서는 소스 언어 문장 전체를 인코더가 처리하고, 디코더가 타깃 언어 문장을 생성한다.

## 세 개의 서브레이어

디코더 블록은 인코더보다 서브레이어가 하나 더 많다.

1. **Masked Multi-Head Self-Attention** — 이미 생성된 토큰끼리 관계를 파악. 미래 토큰은 마스킹.  
2. **Cross-Attention (Encoder-Decoder Attention)** — 소스 문맥(인코더 출력)을 참조.  
3. **Feed-Forward Network** — 위치별 비선형 변환.

각 서브레이어 뒤에 Add & Norm이 따른다.

![Transformer Decoder 블록 구조](/assets/posts/transformer-decoder-block.svg)

## Masked Self-Attention: 미래를 보지 않는다

디코더의 Self-Attention에 **Causal Mask(인과 마스크)**를 적용하는 이유는 두 가지다.

- **추론 일관성**: 토큰 `i`를 생성할 때 `i+1` 이후는 아직 생성되지 않았다.  
- **학습 병렬화**: Teacher Forcing으로 정답 시퀀스를 한 번에 입력하면, 마스크가 없으면 미래 정답이 현재 예측에 "새어" 들어간다.

하삼각 행렬 형태의 마스크를 어텐션 점수에 더해 상삼각 영역 위치의 Softmax 값을 0으로 만든다.

```python
import torch

def causal_mask(size: int) -> torch.Tensor:
    # True인 위치의 어텐션을 차단
    mask = torch.triu(torch.ones(size, size, dtype=torch.bool), diagonal=1)
    return mask   # shape: (size, size)

# nn.MultiheadAttention에서는 attn_mask 파라미터로 전달
# True이면 -inf로 처리됨
```

## Cross-Attention: 인코더와의 연결

Cross-Attention에서 세 행렬의 출처가 다르다.

- **Q (Query)** ← 디코더 현재 상태 (Masked MHA 출력)  
- **K, V (Key, Value)** ← 인코더 최종 출력 (디코딩 내내 고정)

디코더가 "지금 이 단어를 생성하려면 소스 문장의 어느 위치를 봐야 할까?"를 학습하는 메커니즘이다. 번역 품질이 높을수록 K, V와 Q 사이의 어텐션 패턴이 언어 간 의미적 정렬을 보인다.

![자기 회귀 생성 흐름 — 번역 예시](/assets/posts/transformer-decoder-generation.svg)

## Teacher Forcing과 자기 회귀 생성

| 구분 | 학습 | 추론 |
|------|------|------|
| 입력 | 정답 시퀀스 (시프트) | 이전 출력 토큰 |
| 병렬성 | 전체 시퀀스 동시 처리 | 한 번에 한 토큰 |
| 마스크 | Causal mask 필수 | 자연스럽게 불필요 |

**Teacher Forcing**: 학습 때 정답 시퀀스 `[<BOS>, w1, w2, ..., wN]`을 디코더에 그대로 입력하고, 예측 결과와 `[w1, w2, ..., wN, <EOS>]`를 비교해 Cross-Entropy 손실을 계산한다. Causal Mask 덕분에 위치 `i`의 예측이 `i+1` 이후 정답을 보지 않고 이루어진다.

## PyTorch 구현

```python
import torch.nn as nn

class DecoderLayer(nn.Module):
    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.masked_attn = nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True)
        self.cross_attn  = nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True)
        self.ff   = FFN(d_model, d_ff, dropout)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        self.drop  = nn.Dropout(dropout)

    def forward(self, tgt, memory, tgt_mask=None, memory_key_padding_mask=None):
        # ① Masked Self-Attention
        x, _ = self.masked_attn(tgt, tgt, tgt, attn_mask=tgt_mask)
        tgt = self.norm1(tgt + self.drop(x))
        # ② Cross-Attention (Q=tgt, K=V=memory)
        x, _ = self.cross_attn(tgt, memory, memory,
                                key_padding_mask=memory_key_padding_mask)
        tgt = self.norm2(tgt + self.drop(x))
        # ③ FFN
        tgt = self.norm3(tgt + self.drop(self.ff(tgt)))
        return tgt
```

## KV Cache: 추론 속도 최적화

자기 회귀 생성에서 매 스텝마다 전체 시퀀스를 다시 처리하면 시간 낭비가 크다. **KV Cache**는 이미 계산한 K, V 행렬을 저장해 두고, 새 토큰에 해당하는 부분만 추가 계산한다. 추론 속도가 선형 복잡도에서 상수 추가 비용으로 줄어든다.

## 정리

- 디코더 = Masked Self-Attention + Cross-Attention + FFN, 세 겹 Add & Norm  
- Causal Mask가 미래 토큰 누설을 막아 학습(Teacher Forcing)과 추론 모두 올바르게 동작  
- Cross-Attention이 인코더 출력을 K, V로 사용해 소스 문장과 연결  
- 추론은 자기 회귀 방식, KV Cache로 속도를 높임

---

**지난 글:** [Transformer Encoder: 문맥을 이해하는 핵심 블록](/posts/transformer-encoder/)

**다음 글:** [Encoder-Decoder 구조: 번역에서 요약까지](/posts/transformer-encoder-decoder/)

<br>
읽어주셔서 감사합니다. 😊
