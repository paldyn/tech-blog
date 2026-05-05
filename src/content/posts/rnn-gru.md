---
title: "GRU: 게이트 순환 유닛, LSTM의 경량 대안"
description: "GRU(Gated Recurrent Unit)의 Reset·Update 게이트 구조를 LSTM과 비교해 이해하고, 언제 GRU를 선택해야 하는지 실용적 기준을 제시한다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["GRU", "게이트순환유닛", "LSTM", "RNN", "딥러닝"]
featured: false
draft: false
---

[지난 글](/posts/rnn-lstm/)에서 LSTM의 세 게이트 구조를 살펴봤다. 2014년 Cho et al.은 더 간단한 구조로도 LSTM과 비슷한 성능을 낼 수 있다는 것을 보였다—그것이 **GRU(Gated Recurrent Unit)**다. LSTM의 Forget·Input·Output 세 게이트를 **Reset·Update** 두 게이트로 압축하고, 셀 상태(C_t)를 없애 은닉 상태 하나만 유지한다.

## GRU 수식

```
r_t = σ(W_r · [h_{t-1}, x_t])      # Reset gate
z_t = σ(W_z · [h_{t-1}, x_t])      # Update gate
h̃_t = tanh(W · [r_t ⊙ h_{t-1}, x_t])  # 후보 은닉 상태
h_t = (1 - z_t) ⊙ h̃_t  +  z_t ⊙ h_{t-1}
```

최종 업데이트 수식이 핵심이다. z_t가 1에 가까우면 이전 은닉 상태를 그대로 유지(LSTM의 Forget gate), 0에 가까우면 새 후보 h̃_t를 전적으로 반영한다. 이 하나의 수식이 LSTM의 Forget + Input 게이트를 동시에 수행한다.

![GRU: 두 게이트로 단순화된 LSTM](/assets/posts/rnn-gru-gates.svg)

## PyTorch 구현

```python
import torch
import torch.nn as nn

# 수식 직접 구현
class GRUCell(nn.Module):
    def __init__(self, input_size, hidden_size):
        super().__init__()
        d = hidden_size
        self.W_r = nn.Linear(input_size + d, d)
        self.W_z = nn.Linear(input_size + d, d)
        self.W   = nn.Linear(input_size + d, d)

    def forward(self, x, h):
        c = torch.cat([h, x], dim=-1)
        r = torch.sigmoid(self.W_r(c))
        z = torch.sigmoid(self.W_z(c))
        h_tilde = torch.tanh(self.W(torch.cat([r * h, x], -1)))
        return (1 - z) * h_tilde + z * h

# PyTorch 내장 GRU
gru = nn.GRU(input_size=128, hidden_size=256,
             num_layers=2, batch_first=True, dropout=0.2)

x = torch.randn(32, 50, 128)
out, h_n = gru(x)  # 셀 상태 없음: 반환값 두 개뿐
# out: (32, 50, 256), h_n: (2, 32, 256)
```

## GRU vs LSTM 상세 비교

![GRU vs LSTM 비교](/assets/posts/rnn-gru-vs-lstm.svg)

파라미터 수를 계산해보면:

```python
import torch.nn as nn

def count_params(m):
    return sum(p.numel() for p in m.parameters())

lstm = nn.LSTM(128, 256, batch_first=True)
gru  = nn.GRU(128, 256, batch_first=True)

print(f"LSTM 파라미터: {count_params(lstm):,}")  # ≈ 394,240
print(f"GRU  파라미터: {count_params(gru):,}")   # ≈ 295,680  (약 25% 적음)
```

파라미터가 25% 적으므로 같은 계산 예산에서 GRU는 더 큰 hidden_size를 쓰거나 더 많은 레이어를 쌓을 수 있다.

## Reset Gate의 직관

r_t의 역할을 문장으로 이해하면 이렇다. "안녕하세요"를 처리하다가 새 주제 "사과 가격"이 등장했을 때:

- **r_t ≈ 0**: 이전 은닉 상태(인사 관련 기억)를 무시하고 새 문맥부터 시작
- **r_t ≈ 1**: 이전 기억을 그대로 가져와 새 입력과 합산

LSTM의 Forget gate와 비슷하지만, GRU는 이것을 **후보 상태 계산 내부**에서 처리한다.

## 언제 GRU, 언제 LSTM?

```
데이터가 작거나 빠른 실험이 목표   → GRU
복잡한 장기 의존성(예: 소설 생성) → LSTM
대부분의 실무 NLP (2024~)         → Transformer 우선 검토
임베디드/엣지 AI, 스트리밍 추론   → GRU (파라미터↓, 상태 단순)
```

최신 연구(2024)에서 Mamba 등 **State Space Model(SSM)**이 RNN과 Transformer의 장점을 결합하는 방향으로 발전하고 있다. 기본 GRU의 아이디어—게이트를 이용한 선택적 기억—는 이러한 최신 모델에도 그대로 이어진다.

---

**지난 글:** [LSTM: 장단기 메모리 게이트 완전 해부](/posts/rnn-lstm/)

**다음 글:** [양방향 RNN: 과거와 미래를 동시에 보기](/posts/rnn-bidirectional/)

<br>
읽어주셔서 감사합니다. 😊
