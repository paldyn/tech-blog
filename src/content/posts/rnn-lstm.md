---
title: "LSTM: 장단기 메모리 게이트 완전 해부"
description: "LSTM의 세 게이트(Forget·Input·Output)와 셀 상태 흐름을 수식·코드·시각화로 완벽히 이해한다. 기울기 소실을 왜 LSTM이 해결하는지 수학적으로 확인한다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["LSTM", "장단기메모리", "게이트", "RNN", "딥러닝"]
featured: false
draft: false
---

[지난 글](/posts/rnn-basics/)에서 RNN의 핵심 문제—기울기 소실과 긴 의존성 포착의 어려움—를 확인했다. **LSTM(Long Short-Term Memory)**은 1997년 Hochreiter & Schmidhuber가 제안한 구조로, **게이트(gate)** 메커니즘을 통해 정보를 선택적으로 저장하고 삭제한다. 30년 가까이 지난 지금도 시계열, 음성 인식, 임베디드 AI 환경에서 널리 쓰인다.

## LSTM의 핵심 아이디어: 셀 상태

RNN이 은닉 상태 h_t 하나만 갖는 반면, LSTM은 **셀 상태 C_t**를 추가로 유지한다. C_t는 '장기 기억 고속도로'로, 네트워크를 수백 타임스텝 가로질러 흐른다. 이 경로에는 기울기를 죽이는 tanh가 없어 기울기가 살아남는다.

![LSTM 셀: 세 게이트의 역할](/assets/posts/rnn-lstm-gates.svg)

## 세 게이트 수식

LSTM 셀 한 스텝의 계산 순서를 단계별로 살펴본다.

```python
import torch
import torch.nn as nn

# 수식을 그대로 구현한 LSTM 셀
class LSTMCell(nn.Module):
    def __init__(self, input_size, hidden_size):
        super().__init__()
        d = hidden_size
        # 게이트 4개(f, i, g, o)를 하나의 행렬로 합쳐 효율화
        self.W = nn.Linear(input_size + d, 4 * d)

    def forward(self, x, state):
        h, c = state
        combined = torch.cat([h, x], dim=-1)   # [h_{t-1}, x_t]
        gates = self.W(combined).chunk(4, dim=-1)
        f = torch.sigmoid(gates[0])            # Forget gate
        i = torch.sigmoid(gates[1])            # Input gate
        g = torch.tanh(gates[2])               # Candidate
        o = torch.sigmoid(gates[3])            # Output gate
        c_new = f * c + i * g                  # 셀 상태 업데이트
        h_new = o * torch.tanh(c_new)
        return h_new, c_new
```

핵심 수식:

```
f_t = σ(W_f · [h_{t-1}, x_t] + b_f)   # 무엇을 잊을지
i_t = σ(W_i · [h_{t-1}, x_t] + b_i)   # 무엇을 기억할지
g_t = tanh(W_g · [h_{t-1}, x_t] + b_g) # 새 후보 값
C_t = f_t ⊙ C_{t-1} + i_t ⊙ g_t       # 셀 상태 업데이트
o_t = σ(W_o · [h_{t-1}, x_t] + b_o)   # 무엇을 출력할지
h_t = o_t ⊙ tanh(C_t)                  # 은닉 상태
```

## 왜 기울기가 살아남는가

셀 상태 경로의 기울기를 추적하면:

```
∂C_t/∂C_{t-1} = f_t
```

f_t가 1에 가까우면 이전 셀 상태 기울기가 **곱셈 없이** 그대로 전달된다. 기울기가 소실하지 않는 이유가 바로 이것이다. RNN은 tanh'(·) × W_h 를 계속 곱했지만, LSTM은 게이트 값만 곱하며 그 값이 동적으로 변한다.

![LSTM 코드 구현 흐름](/assets/posts/rnn-lstm-cell.svg)

## PyTorch 내장 LSTM 사용

```python
# 실전에서는 nn.LSTM 사용
lstm = nn.LSTM(
    input_size=128,
    hidden_size=256,
    num_layers=2,
    batch_first=True,
    dropout=0.2,
    bidirectional=False,
)

x = torch.randn(32, 50, 128)  # (batch, seq_len, features)
h0 = torch.zeros(2, 32, 256)  # (num_layers, batch, hidden)
c0 = torch.zeros(2, 32, 256)

out, (h_n, c_n) = lstm(x, (h0, c0))
# out: (32, 50, 256) — 모든 타임스텝 출력
# h_n: (2, 32, 256) — 마지막 은닉 상태
# c_n: (2, 32, 256) — 마지막 셀 상태
```

## 실전 팁

**다층 LSTM(Stacked LSTM)**은 레이어 수를 늘려 표현력을 높인다. 단, 레이어가 깊어질수록 dropout 정규화가 중요해진다.

```python
# 다층 LSTM 후 분류 헤드
class TextClassifier(nn.Module):
    def __init__(self, vocab_size, emb_dim, hid, n_classes):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, emb_dim, padding_idx=0)
        self.lstm = nn.LSTM(emb_dim, hid, num_layers=2,
                            batch_first=True, dropout=0.3)
        self.fc = nn.Linear(hid, n_classes)

    def forward(self, x):
        e = self.emb(x)           # (B, T, emb_dim)
        _, (h_n, _) = self.lstm(e)
        return self.fc(h_n[-1])   # 마지막 레이어 마지막 상태
```

## LSTM의 한계

LSTM은 기울기 소실을 완화하지만 **순차 처리** 문제는 해결하지 못한다. 길이 n 시퀀스는 n 스텝을 기다려야 하고, GPU 병렬화가 어렵다. 파라미터 수도 `4 × (input_size + hidden_size) × hidden_size`로 표준 RNN의 4배다. 다음 글에서는 LSTM을 단순화한 **GRU**를 살펴본다.

---

**지난 글:** [RNN 기초: 순환 신경망의 작동 원리](/posts/rnn-basics/)

**다음 글:** [GRU: 게이트 순환 유닛, LSTM의 경량 대안](/posts/rnn-gru/)

<br>
읽어주셔서 감사합니다. 😊
