---
title: "RNN의 한계와 Transformer로의 전환"
description: "RNN 계열(RNN·LSTM·GRU)의 세 가지 본질적 한계—기울기 소실, 순차 처리, 장거리 의존성—를 정리하고, Transformer가 어떻게 이를 한꺼번에 해결하는지 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["RNN한계", "Transformer", "순차처리", "기울기소실", "딥러닝역사"]
featured: false
draft: false
---

[지난 글](/posts/rnn-attention/)에서 Attention 메커니즘이 Seq2Seq의 병목을 해결했지만, 인코더와 디코더 자체는 여전히 RNN이었다. 2017년 이전까지 NLP 커뮤니티는 RNN 계열이 갖는 세 가지 본질적 한계를 해결하지 못하고 있었다. 이 한계들이 무엇이고, Transformer가 어떻게 동시에 해결했는지 총정리한다.

## 한계 1: 기울기 소실 (Vanishing Gradient)

BPTT에서 기울기는 타임스텝 수만큼 행렬 곱을 통과한다.

```
∂L/∂h_1 = ∂L/∂h_T · ∏_{t=2}^{T} W_h · diag(σ'(·))
```

W_h의 특잇값이 1보다 작으면 기울기는 기하급수적으로 0으로 수렴한다. LSTM/GRU는 이를 **완화**했지만 완전히 해결하지 못했다—매우 긴 시퀀스(T>1000)에서는 여전히 초기 토큰의 기울기가 소실된다.

![RNN의 한계: 기울기 소실과 병렬화 불가](/assets/posts/rnn-limitations-gradient.svg)

## 한계 2: 순차 처리 — 병렬화 불가

h_t는 반드시 h_{t-1}이 계산된 후에 구할 수 있다. 이는 **GPU 병렬화의 근본적 장벽**이다.

```python
# RNN: T 스텝을 순서대로 처리 — GPU 활용 불가
for t in range(T):
    h_t = rnn_cell(x_t, h_{t-1})  # h_{t-1} 완료 전까지 대기

# Transformer: 모든 위치를 동시에 처리
out = attention(Q, K, V)           # (B, T, d) 한 번에 계산
```

길이 1000 토큰 시퀀스를 처리할 때, RNN은 1000번의 직렬 연산이 필요하지만 Transformer는 단 하나의 행렬 곱으로 모든 위치를 동시에 처리한다. 이것이 Transformer가 동등한 하드웨어에서 수십 배 빨리 학습하는 이유다.

## 한계 3: 장거리 의존성 (Long-Range Dependency)

단방향 RNN에서 t=1 토큰이 t=500 토큰에 영향을 미치려면 498번의 중간 상태를 거쳐야 한다. 각 단계에서 정보가 변형되므로 t=1의 정보가 희석된다.

```python
# 장거리 의존성 문제를 실험적으로 확인
import torch

# 500토큰 시퀀스에서 첫 토큰과 마지막 토큰의 코사인 유사도
def check_long_range(model, seq_len=500):
    x = torch.randn(1, seq_len, 64)
    out, _ = model(x)
    first = out[0, 0, :]    # t=1 출력
    last  = out[0, -1, :]   # t=500 출력
    cos_sim = torch.cosine_similarity(first.unsqueeze(0),
                                      last.unsqueeze(0))
    return cos_sim.item()
# RNN: 낮은 유사도, Transformer Self-Attention: O(1) 직접 연결
```

Transformer의 Self-Attention은 모든 토큰 쌍을 **직접** 연결한다. t=1과 t=500 사이의 경로 길이가 O(1)이다.

## RNN vs LSTM vs Transformer 종합 비교

![RNN vs LSTM vs Transformer 비교](/assets/posts/rnn-limitations-comparison.svg)

## Transformer가 모두 해결하는 방법

| 한계 | RNN/LSTM 대응 | Transformer 해결책 |
|---|---|---|
| 기울기 소실 | LSTM 게이트 (완화) | Residual + LayerNorm (완전 해결) |
| 순차 처리 | 해결 불가 | Self-Attention (완전 병렬) |
| 장거리 의존성 | 완화 | O(1) 직접 연결 |
| 계산 복잡도 | O(n) | O(n²) — 단점 |

Transformer의 유일한 약점은 시퀀스 길이 n에 대한 O(n²) 메모리/계산 복잡도다. 이를 해결하기 위해 FlashAttention, Sliding Window Attention, Linear Attention 등 다양한 효율화 기법이 등장했다.

## 역사적 맥락

```
2013: Word2Vec (정적 임베딩)
2014: Seq2Seq (RNN + 인코더-디코더)
2015: Attention (Bahdanau, Luong)
2017: Transformer "Attention Is All You Need"
2018: BERT (양방향 Transformer 사전학습)
2019: GPT-2 (대규모 Transformer 언어모델)
2020~: GPT-3, PaLM, LLaMA...
```

RNN은 완전히 사라진 것이 아니다. 2023년 이후 Mamba(S4/SSM 계열)처럼 RNN의 O(1) 추론 메모리와 Transformer의 병렬 학습 장점을 결합하려는 시도가 이어지고 있다. RNN을 이해하는 것은 여전히 중요한 기반 지식이다.

---

**지난 글:** [Attention 메커니즘: Seq2Seq 병목을 극복하다](/posts/rnn-attention/)

**다음 글:** [Transformer 기초: Attention Is All You Need](/posts/transformer-basics/)

<br>
읽어주셔서 감사합니다. 😊
