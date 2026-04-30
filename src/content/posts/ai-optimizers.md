---
title: "옵티마이저 완전 정복: SGD에서 AdamW까지"
description: "Momentum, AdaGrad, RMSProp, Adam, AdamW의 원리와 차이를 수식과 PyTorch 코드로 비교하고, 상황별 최적 옵티마이저 선택법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 11
type: "knowledge"
category: "AI"
tags: ["옵티마이저", "Adam", "AdamW", "SGD", "Momentum", "학습률"]
featured: false
draft: false
---

[지난 글](/posts/ai-gradient-descent/)에서 경사 하강법의 기본 원리를 익혔다. 이번에는 그 기본형에서 발전한 **다양한 옵티마이저(Optimizer)**를 비교한다. 옵티마이저는 "어떻게 파라미터를 업데이트할 것인가"에 대한 알고리즘이다. 기본 SGD의 두 가지 약점 — 모든 파라미터에 동일한 학습률을 적용한다, 최솟값까지의 경로가 비효율적이다 — 을 해결하기 위해 다양한 방법이 개발되었다.

## SGD + Momentum: 관성으로 가속

기본 SGD는 각 스텝에서 현재 그래디언트만 고려한다. **모멘텀(Momentum)**은 이전 업데이트 방향을 관성으로 유지해 수렴을 가속한다.

```python
import torch.optim as optim

# SGD with Momentum
optimizer = optim.SGD(
    model.parameters(),
    lr=0.01,
    momentum=0.9,   # 이전 속도의 90%를 유지
    weight_decay=1e-4,
    nesterov=True   # Nesterov Momentum: 미래 위치에서 그래디언트 계산
)
```

물리학의 공과 경사면 비유를 생각해보자. 모멘텀 없이는 공이 굴러갈 때 매번 현재 위치의 기울기만 보고 방향을 바꾼다. 모멘텀이 있으면 이전에 굴러온 방향의 관성이 남아 더 빠르고 부드럽게 움직인다.

```
v ← β·v − η·∇L(θ)   # 속도 업데이트 (β=0.9)
θ ← θ + v           # 파라미터 업데이트
```

모멘텀의 효과:
- **평탄한 방향**: 누적 관성으로 가속
- **진동하는 방향**: 반대 방향 그래디언트가 누적을 상쇄해 안정화

## AdaGrad: 파라미터별 적응형 학습률

기본 SGD는 모든 파라미터에 동일한 학습률을 쓴다. 하지만 자주 업데이트되는 파라미터와 드물게 업데이트되는 파라미터는 다른 학습률이 필요하다. NLP의 임베딩처럼 희소 특성을 다룰 때 특히 중요하다.

```python
# AdaGrad: 파라미터별 누적 제곱 그래디언트로 학습률 조정
optimizer = optim.Adagrad(
    model.parameters(),
    lr=0.01,
    eps=1e-10  # 분모가 0이 되는 것 방지
)
```

```
G ← G + ∇L²
θ ← θ − (η / √(G + ε)) · ∇L
```

자주 업데이트된 파라미터는 G가 커져 학습률이 줄고, 드물게 업데이트된 파라미터는 G가 작아 학습률이 상대적으로 크다.

**AdaGrad의 문제**: G가 단조 증가해서 학습이 진행될수록 학습률이 0에 수렴한다.

## RMSProp: 지수 가중 이동 평균으로 개선

```python
# RMSProp: G의 지수 가중 이동 평균 사용
optimizer = optim.RMSprop(
    model.parameters(),
    lr=0.001,
    alpha=0.99,  # 감쇠율 (이전 G의 비중)
    eps=1e-8
)
```

```
v ← α·v + (1−α)·∇L²   # 지수 가중 이동 평균 (누적 없음)
θ ← θ − (η / √(v + ε)) · ∇L
```

지수 평균을 쓰기 때문에 오래된 그래디언트의 영향이 줄어들고 학습률이 0으로 수렴하지 않는다. RNN 학습에 효과적이며 Hinton이 제안했다.

![옵티마이저 계보와 핵심 아이디어](/assets/posts/ai-optimizers-comparison.svg)

## Adam: 현대 딥러닝의 표준

**Adam(Adaptive Moment Estimation)**은 모멘텀과 RMSProp을 결합한 알고리즘이다. 2015년 Kingma와 Ba가 제안했다.

```python
# Adam: β₁=0.9(1차 모멘텀), β₂=0.999(2차 모멘텀)
optimizer = optim.Adam(
    model.parameters(),
    lr=1e-3,
    betas=(0.9, 0.999),  # (β₁, β₂)
    eps=1e-8,
    weight_decay=0       # L2 정규화 (Adam에서는 효과가 다름)
)
```

```
m ← β₁·m + (1−β₁)·∇L         # 1차 모멘트 (그래디언트의 지수 평균)
v ← β₂·v + (1−β₂)·∇L²        # 2차 모멘트 (제곱 그래디언트의 지수 평균)
m̂ = m/(1−β₁ᵗ)                 # 편향 보정 (초기 단계에서 0으로 치우침 방지)
v̂ = v/(1−β₂ᵗ)
θ ← θ − η · m̂ / (√v̂ + ε)    # 파라미터 업데이트
```

Adam의 장점: 각 파라미터마다 적응형 학습률 + 모멘텀 효과 + 편향 보정. 하이퍼파라미터에 덜 민감해서 튜닝 부담이 적다.

## AdamW: LLM 학습의 실제 표준

Adam의 `weight_decay`는 사실 L2 정규화와 동일하지 않다. 적응형 학습률로 인해 가중치 감쇠 효과가 왜곡된다. **AdamW**는 가중치 감쇠를 그래디언트 업데이트와 **분리**해 이를 올바르게 구현한다.

```python
# AdamW: GPT, BERT, LLaMA 등 거의 모든 LLM의 표준
optimizer = optim.AdamW(
    model.parameters(),
    lr=3e-4,
    betas=(0.9, 0.999),
    eps=1e-8,
    weight_decay=0.01   # Bias, LayerNorm 파라미터는 제외해야 함
)

# 실전: no_decay 파라미터 그룹 분리
no_decay = ['bias', 'LayerNorm.weight']
optimizer_grouped = [
    {'params': [p for n, p in model.named_parameters()
                if not any(nd in n for nd in no_decay)],
     'weight_decay': 0.01},
    {'params': [p for n, p in model.named_parameters()
                if any(nd in n for nd in no_decay)],
     'weight_decay': 0.0},
]
optimizer = optim.AdamW(optimizer_grouped, lr=3e-4)
```

## 학습률 스케줄러

옵티마이저와 함께 학습률을 조절하는 **스케줄러(Scheduler)**를 사용하면 학습이 안정적으로 수렴한다.

```python
from torch.optim.lr_scheduler import CosineAnnealingLR, LinearLR, SequentialLR

# Warmup + Cosine Decay (LLM 학습 표준)
warmup = LinearLR(optimizer, start_factor=0.1, end_factor=1.0, total_iters=100)
cosine = CosineAnnealingLR(optimizer, T_max=900, eta_min=1e-6)
scheduler = SequentialLR(optimizer, schedulers=[warmup, cosine], milestones=[100])

for epoch in range(1000):
    train(model, optimizer)
    scheduler.step()
    print(f"Epoch {epoch}: lr = {optimizer.param_groups[0]['lr']:.2e}")
```

| 스케줄러 | 특징 | 사용처 |
|---------|------|--------|
| Step LR | 주기적으로 lr을 γ배 감소 | CNN 학습 |
| Cosine Annealing | 코사인 곡선으로 서서히 감소 | LLM, 트랜스포머 |
| Warmup + Cosine | 초기 워밍업 후 코사인 감소 | GPT, LLaMA 학습 |
| Polynomial | 다항식으로 감소 | BERT 파인튜닝 |
| ReduceLROnPlateau | 검증 손실이 개선되지 않으면 감소 | 실험 단계 |

![Adam/AdamW 구현과 학습률 스케줄러](/assets/posts/ai-optimizers-adam.svg)

## 옵티마이저별 성능 비교

실제로 어떤 옵티마이저를 써야 할까?

- **LLM/대형 트랜스포머**: AdamW + 코사인 스케줄이 표준
- **CNN 이미지 분류 (ImageNet)**: SGD + Momentum + StepLR이 최고 성능
- **일반 딥러닝 프로토타입**: Adam으로 시작하면 대부분 잘 동작
- **희소 임베딩 (NLP 초기 단계)**: AdaGrad 또는 Adam
- **RNN/시계열**: RMSProp

Adam은 범용성이 높지만 일반화 성능에서 SGD+Momentum에 밀리는 경우가 있다. 특히 컴퓨터 비전에서 최고 성능을 원한다면 SGD+Momentum+학습률 스케줄을 시도해볼 가치가 있다.

---

**지난 글:** [경사 하강법: AI 학습의 엔진](/posts/ai-gradient-descent/)

**다음 글:** [손실 함수 완전 정복: 무엇을 최소화하는가](/posts/ai-loss-functions/)

<br>
읽어주셔서 감사합니다. 😊
