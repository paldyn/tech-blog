---
title: "경사 하강법: AI 학습의 엔진"
description: "경사 하강법의 직관부터 배치 GD·SGD·미니배치 SGD의 차이, 학습률 선택, 실전 PyTorch 학습 루프까지 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["경사하강법", "GradientDescent", "최적화", "학습률", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/ai-calculus-for-ml/)에서 도함수와 그래디언트가 "어느 방향이 가장 가파른가"를 알려준다고 배웠다. 이번에는 그 정보를 사용해 모델 파라미터를 실제로 업데이트하는 알고리즘인 **경사 하강법(Gradient Descent)**을 다룬다. 딥러닝의 수십억 파라미터를 효율적으로 최적화하는 모든 방법의 뿌리가 여기에 있다.

## 경사 하강법의 직관

산에서 눈을 감고 내려오는 상황을 상상해보자. 발 아래를 느껴 가장 가파르게 내려가는 방향을 찾고, 그 방향으로 한 걸음 내딛는다. 이를 반복하면 결국 골짜기(최솟값)에 도달한다.

이 직관을 수식으로 표현하면:

```
θ ← θ − η · ∇_θ L(θ)
```

- **θ**: 모델 파라미터 (가중치, 편향)
- **η (eta)**: 학습률 — 한 걸음의 크기
- **∇_θ L(θ)**: 손실에 대한 파라미터의 그래디언트
- **−**: 그래디언트의 반대 방향 (손실이 줄어드는 방향)

핵심은 **그래디언트의 반대 방향**으로 이동한다는 점이다. 그래디언트는 손실이 증가하는 방향이므로, 그 반대로 가면 손실이 감소한다.

```python
import torch
import torch.nn as nn

# 경사 하강법 수동 구현
def manual_gradient_descent(params, lr=0.01):
    with torch.no_grad():
        for p in params:
            if p.grad is not None:
                p -= lr * p.grad   # θ ← θ − η·∇L
                p.grad.zero_()     # 그래디언트 초기화

# 간단한 2차 함수 최적화: f(x) = (x-3)²
x = torch.tensor([10.0], requires_grad=True)
for i in range(20):
    loss = (x - 3.0) ** 2
    loss.backward()
    with torch.no_grad():
        x -= 0.1 * x.grad
        x.grad.zero_()
    if i % 5 == 0:
        print(f"Step {i:2d}: x={x.item():.4f}, loss={loss.item():.4f}")
# x가 10에서 3으로 수렴
```

## 학습률: 가장 중요한 하이퍼파라미터

학습률 η는 딥러닝에서 가장 영향력 있는 하이퍼파라미터다.

**학습률이 너무 크면**: 골짜기를 건너뛰어 발산한다. 손실이 NaN이 되거나 진동한다.

**학습률이 너무 작으면**: 수렴이 극도로 느리고 지역 최솟값(local minimum)에 갇힐 수 있다.

**적절한 학습률**: 빠르고 안정적으로 전역 최솟값(global minimum)에 수렴한다.

```python
import torch

def run_gd(lr, steps=50):
    x = torch.tensor([10.0], requires_grad=True)
    losses = []
    for _ in range(steps):
        loss = (x - 3.0) ** 2
        loss.backward()
        with torch.no_grad():
            x -= lr * x.grad
            x.grad.zero_()
        losses.append(loss.item())
    return x.item(), losses[-1]

for lr in [0.001, 0.1, 0.9, 1.1]:
    final_x, final_loss = run_gd(lr)
    status = "✓" if final_loss < 0.01 else "✗"
    print(f"{status} lr={lr:.3f}: x→{final_x:.3f}, loss→{final_loss:.4f}")
# lr=0.001: 느린 수렴 / lr=0.1: 성공 / lr=0.9: 느린 진동 / lr=1.1: 발산
```

실전에서는 `lr=1e-3` (Adam) 또는 `lr=1e-2` (SGD+Momentum)를 시작점으로 쓰고, 학습률 스케줄러로 점차 줄이는 방식을 쓴다.

## 세 가지 경사 하강법 변형

데이터를 얼마만큼씩 쓰느냐에 따라 세 가지 변형이 있다.

**배치 GD (Batch Gradient Descent)**: 전체 데이터로 그래디언트를 계산한다. 안정적이지만 데이터가 수백만 개라면 한 번 업데이트에 너무 많은 시간이 걸린다.

**확률적 GD (Stochastic GD, SGD)**: 1개 샘플마다 업데이트한다. 빠르지만 그래디언트에 잡음이 많아 경로가 불안정하다.

**미니배치 SGD**: 32~512개 배치로 업데이트한다. 속도와 안정성의 균형을 잡으며, GPU 병렬화와도 잘 맞아 실제 딥러닝에서 사용하는 방식이다.

```python
import torch
from torch.utils.data import DataLoader, TensorDataset

# 미니배치 SGD 학습 루프
X = torch.randn(1000, 10)
y = torch.randn(1000, 1)
dataset = TensorDataset(X, y)
loader  = DataLoader(dataset, batch_size=32, shuffle=True)

model     = torch.nn.Linear(10, 1)
optimizer = torch.optim.SGD(model.parameters(), lr=0.01, momentum=0.9)
criterion = torch.nn.MSELoss()

for epoch in range(5):
    total_loss = 0.0
    for X_batch, y_batch in loader:
        optimizer.zero_grad()          # 그래디언트 초기화
        pred = model(X_batch)          # 순전파
        loss = criterion(pred, y_batch)
        loss.backward()                # 역전파
        optimizer.step()               # 파라미터 업데이트
        total_loss += loss.item()
    print(f"Epoch {epoch+1}: avg_loss={total_loss/len(loader):.4f}")
```

![경사 하강법: 손실 최소화 과정 시각화](/assets/posts/ai-gradient-descent-landscape.svg)

## 지역 최솟값과 안장점 문제

손실 함수 지형에는 골짜기(최솟값)만 있지 않다.

**지역 최솟값(Local Minimum)**: 주변보다 낮지만 전역 최솟값이 아닌 지점. 이론적으로 문제지만 고차원 딥러닝에서는 대부분의 지역 최솟값이 전역 최솟값에 가깝다.

**안장점(Saddle Point)**: 한 방향에서는 최솟값이지만 다른 방향에서는 최댓값인 지점. 고차원에서 더 흔하며, 순수 GD로는 탈출이 어렵다.

**고원(Plateau)**: 그래디언트가 0에 가까운 평탄한 구간. 학습이 멈춘 것처럼 보인다.

미니배치의 무작위성(stochasticity)이 이런 지점에서 탈출하는 데 도움을 준다. 모멘텀을 사용하면 관성으로 안장점을 더 쉽게 통과한다.

## 그래디언트 클리핑

RNN이나 깊은 네트워크에서 그래디언트가 폭발적으로 커지는 **그래디언트 폭발(Gradient Explosion)** 문제가 생긴다.

```python
import torch.nn.utils as utils

# 역전파 후 파라미터 업데이트 전에 클리핑
loss.backward()
utils.clip_grad_norm_(model.parameters(), max_norm=1.0)  # 그래디언트 L2 norm 제한
optimizer.step()

# max_norm=1.0: 전체 그래디언트 벡터의 L2 norm이 1을 넘으면 축소
# Transformer, LSTM 학습에서 거의 필수
```

그래디언트 폭발은 손실이 갑자기 NaN이 되거나 학습이 불안정해지는 증상으로 나타난다. `clip_grad_norm_`으로 간단히 해결할 수 있다.

![경사 하강법 학습 루프 구현](/assets/posts/ai-gradient-descent-steps.svg)

## 경사 하강법이 없으면 AI 학습도 없다

경사 하강법은 단순한 아이디어지만 딥러닝 학습의 핵심 엔진이다. "그래디언트의 반대 방향으로 파라미터를 움직인다"는 원칙 하나로 수십억 파라미터를 가진 LLM을 학습시킨다. 다음 글에서는 이 기본 경사 하강법을 개선한 다양한 **옵티마이저**들을 살펴본다.

---

**지난 글:** [미적분학: AI 학습을 가능하게 하는 수학](/posts/ai-calculus-for-ml/)

**다음 글:** [옵티마이저 완전 정복: SGD에서 AdamW까지](/posts/ai-optimizers/)

<br>
읽어주셔서 감사합니다. 😊
