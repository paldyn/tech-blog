---
title: "RNN 기초: 순환 신경망의 작동 원리"
description: "순환 신경망(RNN)의 기본 개념부터 셀 구조, 시간에 따른 전개(BPTT), 기울기 소실까지 코드와 시각화로 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["RNN", "순환신경망", "BPTT", "딥러닝", "시퀀스모델"]
featured: false
draft: false
---

[지난 글](/posts/cnn-instance-segmentation/)에서 인스턴스 세그멘테이션으로 CNN 계열의 정점을 살펴봤다. 이미지처럼 공간 구조가 고정된 데이터와 달리, **텍스트·음성·시계열**처럼 순서가 중요한 데이터를 다루려면 다른 접근이 필요하다. 그 해답이 **순환 신경망(Recurrent Neural Network, RNN)**이다.

## RNN이 풀려는 문제

일반 MLP는 입력 벡터 하나를 받아 출력을 내놓는다. 하지만 "나는 오늘 사과를 먹었다"를 처리할 때는 단어 순서가 의미를 결정한다—"먹었다"를 이해하려면 앞 단어들의 맥락이 필요하다. RNN은 이전 타임스텝의 **은닉 상태(hidden state) h_{t-1}** 을 현재 입력 x_t와 함께 받아 새 은닉 상태 h_t를 계산한다. 은닉 상태가 '기억'의 역할을 한다.

![RNN 셀 구조와 시간 전개](/assets/posts/rnn-basics-structure.svg)

## RNN 셀의 수식

RNN 셀 연산은 단 두 줄로 요약된다.

```
h_t = tanh(W_h · h_{t-1}  +  W_x · x_t  +  b)
y_t = W_y · h_t  +  b_y
```

**핵심은 W_h, W_x, b가 모든 타임스텝에서 공유**된다는 점이다. 파라미터 수가 시퀀스 길이와 무관하게 고정되므로, 임의 길이 시퀀스를 처리할 수 있다.

```python
import torch
import torch.nn as nn

# 간단한 RNN 단일 셀 직접 구현
class RNNCell(nn.Module):
    def __init__(self, input_size, hidden_size):
        super().__init__()
        self.W_x = nn.Linear(input_size, hidden_size, bias=False)
        self.W_h = nn.Linear(hidden_size, hidden_size)
        self.tanh = nn.Tanh()

    def forward(self, x, h_prev):
        return self.tanh(self.W_x(x) + self.W_h(h_prev))

# PyTorch 내장 RNN
rnn = nn.RNN(input_size=128, hidden_size=256,
             num_layers=2, batch_first=True)
# 입력: (batch, seq_len, input_size)
x = torch.randn(32, 20, 128)        # batch=32, T=20, d=128
out, h_n = rnn(x)                   # out: (32, 20, 256)
```

## 시간 전개(Unrolling)와 BPTT

RNN 그래프를 각 타임스텝으로 펼치면 매우 깊은 순전파 경로가 나타난다. 역전파도 이 경로를 따라 **시간을 거슬러 올라가야** 한다—이를 **BPTT(Backpropagation Through Time)**라 한다.

![BPTT: 시간을 통한 역전파](/assets/posts/rnn-basics-bptt.svg)

t 스텝에서 손실 L에 대한 h_1의 기울기는 행렬 곱의 연쇄다.

```
∂L/∂h_1 = ∂L/∂h_t · ∏_{k=2}^{t} (∂h_k/∂h_{k-1})
         = ∂L/∂h_t · ∏_{k=2}^{t} W_h · diag(tanh'(·))
```

W_h의 최대 특잇값이 1보다 작으면 곱이 기하급수적으로 → 0(기울기 소실), 1보다 크면 → ∞(기울기 폭발)이 된다.

## 기울기 문제와 Truncated BPTT

기울기 폭발은 **그래디언트 클리핑(Gradient Clipping)**으로 완화할 수 있다.

```python
optimizer.zero_grad()
loss.backward()
# 기울기 폭발 방지: 전체 기울기 노름을 1.0으로 클리핑
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
optimizer.step()
```

기울기 소실은 근본적으로 해결하기 어렵다. 이 문제를 게이트 메커니즘으로 해결한 것이 **LSTM**과 **GRU**다.

긴 시퀀스를 효율적으로 학습하려면 **Truncated BPTT**를 사용한다—시퀀스를 청크로 나눠 각 청크 내에서만 역전파한다.

```python
chunk_size = 50
h = torch.zeros(1, batch, hidden)
for i in range(0, seq_len, chunk_size):
    x_chunk = x[:, i:i+chunk_size, :]
    out, h = rnn(x_chunk, h.detach())  # detach로 이전 그래프 분리
    loss = criterion(out, target[:, i:i+chunk_size])
    loss.backward()
```

## 언제 RNN을 선택하는가

오늘날 대부분의 NLP 태스크에서 Transformer가 RNN을 대체했다. 그러나 **실시간 스트리밍 추론**이나 **극단적으로 메모리가 제한된 환경**에서는 RNN 계열이 여전히 유리하다—인퍼런스 시 O(1) 메모리로 무한 길이 시퀀스를 처리할 수 있기 때문이다.

| 항목 | RNN | Transformer |
|---|---|---|
| 학습 병렬화 | ✗ 순차 | ✓ 완전 병렬 |
| 인퍼런스 메모리 | O(1) 상태 | O(n) KV캐시 |
| 장거리 의존성 | 약 | 강 |

다음 글에서는 기울기 소실을 게이트로 해결한 **LSTM**을 살펴본다.

---

**다음 글:** [LSTM: 장단기 메모리 게이트 완전 해부](/posts/rnn-lstm/)

<br>
읽어주셔서 감사합니다. 😊
