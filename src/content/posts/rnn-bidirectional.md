---
title: "양방향 RNN: 과거와 미래를 동시에 보기"
description: "양방향 RNN(Bidirectional RNN)이 Forward·Backward 두 방향으로 시퀀스를 처리해 각 토큰에 풍부한 문맥을 부여하는 원리와 구현을 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["양방향RNN", "BiLSTM", "BiGRU", "NER", "딥러닝"]
featured: false
draft: false
---

[지난 글](/posts/rnn-gru/)에서 GRU가 LSTM을 경량화한 방법을 살펴봤다. 단방향 RNN은 항상 왼쪽에서 오른쪽으로 읽는다—토큰을 처리할 때 아직 보지 못한 미래 토큰의 맥락은 알 수 없다. **양방향 RNN(Bidirectional RNN)**은 두 개의 RNN을 동시에 실행해 이 한계를 극복한다. 하나는 왼→오른쪽(Forward), 다른 하나는 오른→왼쪽(Backward) 방향으로 시퀀스를 처리하고, 두 은닉 상태를 이어 붙여(concatenate) 각 토큰의 완전한 문맥 표현을 만든다.

## 구조

각 타임스텝 t에서 두 RNN의 출력을 연결한다.

```
h̄_t = Forward_RNN(x_t, h̄_{t-1})    # 과거 문맥
h̃_t = Backward_RNN(x_t, h̃_{t+1})   # 미래 문맥
y_t = [h̄_t ; h̃_t]                  # 2 × hidden 벡터
```

![양방향 RNN 구조](/assets/posts/rnn-bidirectional-structure.svg)

## 왜 양방향이 필요한가: NER 예시

"Apple은 팀 쿡이 이끄는 회사다"에서 "Apple"이 과일인지 기업인지 판단하려면 **뒤의 "회사"**를 먼저 봐야 한다. Forward-only RNN은 "Apple"을 처리할 시점에 아직 "회사"를 보지 못했다. Backward RNN이 오른쪽에서 왼쪽으로 읽으면서 "Apple" 위치에 이미 "회사" 정보를 담고 있다.

![양방향 RNN 활용 예시](/assets/posts/rnn-bidirectional-usecase.svg)

## PyTorch 구현

```python
import torch
import torch.nn as nn

# bidirectional=True 한 줄로 활성화
bilstm = nn.LSTM(
    input_size=128,
    hidden_size=128,      # 각 방향 128 → concat 후 256
    num_layers=2,
    batch_first=True,
    dropout=0.3,
    bidirectional=True,
)

x = torch.randn(32, 50, 128)
out, (h_n, c_n) = bilstm(x)
# out: (32, 50, 256)  ← hidden_size * 2
# h_n: (4, 32, 128)  ← num_layers * 2 (방향별 분리)

# Forward/Backward 분리
h_forward  = h_n[0::2]   # 짝수 인덱스: forward 마지막 레이어
h_backward = h_n[1::2]   # 홀수 인덱스: backward 마지막 레이어
h_combined = torch.cat([h_forward[-1], h_backward[-1]], dim=-1)
```

## 시퀀스 레이블링 (NER) 예제

```python
class BiLSTM_NER(nn.Module):
    def __init__(self, vocab_size, emb_dim, hid, n_labels):
        super().__init__()
        self.emb  = nn.Embedding(vocab_size, emb_dim, padding_idx=0)
        self.lstm = nn.LSTM(emb_dim, hid, batch_first=True,
                            bidirectional=True)
        self.fc   = nn.Linear(hid * 2, n_labels)

    def forward(self, x):
        e = self.emb(x)           # (B, T, emb_dim)
        out, _ = self.lstm(e)     # (B, T, hid*2)
        return self.fc(out)       # (B, T, n_labels)

# 각 토큰마다 레이블 예측 → BIO 태깅
```

## 중요한 주의사항: 생성 태스크에는 사용 불가

양방향 RNN은 **학습 시에만** 사용할 수 있다. 미래 토큰을 참조하기 때문에, 자기회귀 텍스트 생성(GPT 스타일)에는 적용할 수 없다. 적합한 태스크는 다음과 같다.

| 태스크 | 양방향 RNN | 단방향 RNN |
|---|---|---|
| NER, POS 태깅 | ✓ 권장 | △ 가능 |
| 텍스트 분류 | ✓ 권장 | △ 가능 |
| 텍스트 생성 | ✗ 불가 | ✓ 사용 |
| Seq2Seq 인코더 | ✓ 권장 | △ 가능 |
| Seq2Seq 디코더 | ✗ 불가 | ✓ 사용 |

BERT는 양방향 Transformer를 사용해 같은 원리를 훨씬 효과적으로 구현한다.

---

**지난 글:** [GRU: 게이트 순환 유닛, LSTM의 경량 대안](/posts/rnn-gru/)

**다음 글:** [Seq2Seq: 인코더-디코더로 시퀀스를 시퀀스로](/posts/rnn-seq2seq/)

<br>
읽어주셔서 감사합니다. 😊
