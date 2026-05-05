---
title: "Seq2Seq: 인코더-디코더로 시퀀스를 시퀀스로"
description: "Seq2Seq 아키텍처의 인코더-디코더 구조, Teacher Forcing, Beam Search를 이해하고, 기계 번역·요약·대화 시스템에 어떻게 적용하는지 코드로 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["Seq2Seq", "인코더디코더", "기계번역", "TeacherForcing", "BeamSearch"]
featured: false
draft: false
---

[지난 글](/posts/rnn-bidirectional/)에서 양방향 RNN이 각 토큰의 문맥을 풍부하게 만드는 방법을 살펴봤다. 이제 입력과 출력의 **길이가 다를 수 있는** 더 어려운 문제를 다뤄보자. 기계 번역("안녕하세요" → "Hello"), 문서 요약, 대화 응답 생성이 모두 그러한 문제다. 2014년 Sutskever et al.이 제안한 **Seq2Seq(Sequence-to-Sequence)** 아키텍처는 두 RNN을 직렬로 연결해 이 문제를 풀었다.

## 인코더-디코더 구조

**인코더**는 가변 길이 입력 시퀀스를 읽어 마지막 은닉 상태—**Context Vector**—로 압축한다. **디코더**는 이 Context Vector를 초기 상태로 받아 출력 토큰을 하나씩 생성한다.

![Seq2Seq: 인코더-디코더 구조](/assets/posts/rnn-seq2seq-architecture.svg)

```python
import torch
import torch.nn as nn

class Encoder(nn.Module):
    def __init__(self, vocab_size, emb_dim, hid):
        super().__init__()
        self.emb  = nn.Embedding(vocab_size, emb_dim)
        self.lstm = nn.LSTM(emb_dim, hid, batch_first=True)

    def forward(self, src):
        e = self.emb(src)
        _, (h, c) = self.lstm(e)  # 마지막 h, c만 사용
        return h, c

class Decoder(nn.Module):
    def __init__(self, vocab_size, emb_dim, hid):
        super().__init__()
        self.emb  = nn.Embedding(vocab_size, emb_dim)
        self.lstm = nn.LSTM(emb_dim, hid, batch_first=True)
        self.fc   = nn.Linear(hid, vocab_size)

    def forward(self, tgt, state):
        e = self.emb(tgt)
        out, state = self.lstm(e, state)
        logits = self.fc(out)
        return logits, state
```

## Teacher Forcing vs 자기회귀 추론

![Teacher Forcing vs 자기회귀 디코딩](/assets/posts/rnn-seq2seq-inference.svg)

**Teacher Forcing**: 학습 시 이전 스텝 예측값 대신 **정답 토큰**을 디코더 입력으로 제공한다. 학습이 빠르지만 훈련-추론 불일치(Exposure Bias)가 생긴다.

```python
def train_step(encoder, decoder, src, tgt, optimizer, criterion):
    optimizer.zero_grad()
    h, c = encoder(src)
    # tgt[:,:-1]: 입력 (SOS~마지막-1), tgt[:,1:]: 정답 (1~EOS)
    logits, _ = decoder(tgt[:, :-1], (h, c))
    # (B, T-1, vocab) vs (B, T-1)
    loss = criterion(logits.reshape(-1, logits.size(-1)),
                     tgt[:, 1:].reshape(-1))
    loss.backward()
    torch.nn.utils.clip_grad_norm_(
        list(encoder.parameters()) + list(decoder.parameters()), 1.0
    )
    optimizer.step()
    return loss.item()
```

**자기회귀 추론**: 이전 예측 토큰을 다음 입력으로 사용한다.

```python
@torch.no_grad()
def generate(encoder, decoder, src, sos_id, eos_id, max_len=50):
    h, c = encoder(src)
    token = torch.tensor([[sos_id]])
    output = []
    for _ in range(max_len):
        logits, (h, c) = decoder(token, (h, c))
        token = logits.argmax(-1)  # 탐욕 디코딩
        if token.item() == eos_id:
            break
        output.append(token.item())
    return output
```

## Beam Search

탐욕 디코딩은 각 스텝에서 확률이 가장 높은 토큰 하나만 선택한다. **Beam Search**는 상위 k개(beam_size) 후보를 동시에 유지해 전체 시퀀스 확률을 높인다.

```
beam_size=4 일 때 각 스텝:
Step 1: SOS → [A(0.6), B(0.3), C(0.08), D(0.02)] 상위 4개 유지
Step 2: A → [AA, AB, AC, AD] / B → [BA, BB, ...] → 전체 16개 중 상위 4개
...EOS 도달까지 반복, log-probability 합 기준 최적 시퀀스 선택
```

실제 구현은 `transformers` 라이브러리의 `model.generate(num_beams=4)`로 간단히 적용할 수 있다.

## Seq2Seq의 병목 문제

Context Vector가 고정 크기이므로 **긴 시퀀스의 정보를 모두 담기 어렵다**. 입력이 100 토큰이면 이 모든 정보를 단 하나의 벡터(예: 256차원)에 욱여넣어야 한다. 실험적으로 번역 품질이 문장 길이에 따라 급격히 떨어지는 현상이 관찰됐다. 이 문제를 해결하기 위해 등장한 것이 **Attention 메커니즘**이다—다음 글의 주제다.

---

**지난 글:** [양방향 RNN: 과거와 미래를 동시에 보기](/posts/rnn-bidirectional/)

**다음 글:** [Attention 메커니즘: Seq2Seq 병목을 극복하다](/posts/rnn-attention/)

<br>
읽어주셔서 감사합니다. 😊
