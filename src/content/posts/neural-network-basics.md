---
title: "신경망 기초: 층, 파라미터, 순전파의 모든 것"
description: "신경망의 구성 요소인 층(Layer), 가중치(Weight), 편향(Bias), 활성화 함수를 수학과 코드로 이해한다. 순전파(Forward Pass)가 어떻게 예측을 만드는지, 파라미터 수는 어떻게 계산하는지를 완전히 파악한다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["신경망기초", "딥러닝", "순전파", "가중치", "PyTorch"]
featured: false
draft: false
---

[지난 글](/posts/nn-perceptron/)에서 단일 퍼셉트론이 XOR을 풀지 못하는 한계를 확인했다. 이 한계를 깨기 위해 퍼셉트론을 여러 층으로 쌓은 것이 **다층 퍼셉트론(Multi-Layer Perceptron, MLP)**, 즉 현대적 의미의 **신경망(Neural Network)**이다. 이번 글에서는 신경망의 기본 구성 요소를 하나씩 해부한다. 층이 무엇인지, 파라미터가 어디서 나오는지, 데이터가 입력에서 출력까지 어떤 계산을 거치는지를 수식과 코드로 완전히 이해한다.

## 신경망의 세 가지 층 유형

신경망은 크게 세 종류의 층으로 구성된다.

**입력층(Input Layer)**: 원시 데이터를 받는 층. 실제 계산은 수행하지 않고 데이터를 네트워크에 전달하는 역할만 한다. 노드 수 = 특성(feature) 수.

**은닉층(Hidden Layer)**: 입력층과 출력층 사이의 모든 층. 이 층들이 데이터의 복잡한 패턴을 학습한다. 층의 수와 각 층의 노드 수가 신경망의 "용량(capacity)"을 결정한다.

**출력층(Output Layer)**: 최종 예측값을 생성하는 층. 문제 유형에 따라 출력 노드 수가 달라진다.
- 이진 분류: 노드 1개 (시그모이드 출력)
- 다중 분류: 클래스 수만큼 노드 (소프트맥스)
- 회귀: 노드 1개 (선형 출력)

![신경망 기본 구조](/assets/posts/neural-network-basics-architecture.svg)

## 층의 수학: 행렬 곱과 편향

하나의 완전 연결 층(Fully Connected Layer, Dense Layer)이 하는 연산을 수식으로 표현하면:

```
z⁽ˡ⁾ = W⁽ˡ⁾ · a⁽ˡ⁻¹⁾ + b⁽ˡ⁾
a⁽ˡ⁾ = f(z⁽ˡ⁾)
```

- `W⁽ˡ⁾`: l번째 층의 가중치 행렬 (형상: n_out × n_in)
- `b⁽ˡ⁾`: l번째 층의 편향 벡터 (형상: n_out)
- `a⁽ˡ⁻¹⁾`: 이전 층의 출력 (형상: n_in)
- `f`: 활성화 함수

배치(batch) 단위로 처리할 때는 `X ∈ ℝ^(B×n_in)`이 되고, 결과는 `Z ∈ ℝ^(B×n_out)`이 된다.

## 파라미터 수 계산

신경망의 학습 가능한 파라미터(가중치 + 편향)의 수를 계산하는 방법:

```python
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(784, 256),   # 784*256 + 256 = 201,216
    nn.ReLU(),
    nn.Linear(256, 128),   # 256*128 + 128 = 32,896
    nn.ReLU(),
    nn.Linear(128, 10),    # 128*10 + 10 = 1,290
)

# 파라미터 수 계산
total = sum(p.numel() for p in model.parameters())
trainable = sum(
    p.numel() for p in model.parameters()
    if p.requires_grad
)
print(f"전체 파라미터: {total:,}")     # 235,402
print(f"학습 가능:     {trainable:,}") # 235,402

# 각 층별 파라미터 확인
for name, param in model.named_parameters():
    print(f"{name:15s}: {param.shape} = {param.numel():,}")
```

## 순전파(Forward Pass) 상세

순전파는 입력 데이터가 층을 통과하며 예측값을 생성하는 과정이다.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class ThreeLayerNet(nn.Module):
    def __init__(self, d_in, d_h1, d_h2, d_out):
        super().__init__()
        self.fc1 = nn.Linear(d_in, d_h1)
        self.fc2 = nn.Linear(d_h1, d_h2)
        self.fc3 = nn.Linear(d_h2, d_out)

    def forward(self, x):
        # 각 층: 선형 변환 → 활성화
        z1 = self.fc1(x)           # (B, d_h1)
        a1 = F.relu(z1)            # 비선형 변환
        z2 = self.fc2(a1)          # (B, d_h2)
        a2 = F.relu(z2)
        z3 = self.fc3(a2)          # (B, d_out)
        return z3                  # 로짓(logit) 반환

model = ThreeLayerNet(4, 5, 4, 3)
x = torch.randn(8, 4)             # 배치 크기 8, 입력 차원 4
output = model(x)                  # (8, 3) 출력
print(output.shape)               # torch.Size([8, 3])
```

![층별 행렬 연산](/assets/posts/neural-network-basics-layer-math.svg)

## 활성화 함수가 필요한 이유

활성화 함수 없이 층을 쌓으면 어떻게 될까? 선형 변환을 아무리 많이 쌓아도 결국 하나의 선형 변환과 같다.

```python
# 활성화 없이 두 층을 쌓으면
# y = W2(W1 x + b1) + b2
#   = (W2W1)x + (W2b1 + b2)
#   = W_eff x + b_eff
# → 결국 하나의 선형 변환과 동일!

W1 = torch.tensor([[2.0, 1.0], [0.0, 3.0]])
W2 = torch.tensor([[1.0, -1.0]])
W_eff = W2 @ W1          # [[2, -2]] — 단일 행렬로 표현 가능
print(W_eff)
```

비선형 활성화 함수가 있어야 신경망이 선형 변환 이상의 복잡한 함수를 표현할 수 있다. 이것이 활성화 함수의 존재 이유다.

## 완전 연결층 vs 다른 층 종류

신경망에는 완전 연결층 외에도 다양한 층이 있다.

| 층 유형 | 특징 | 주로 쓰이는 곳 |
|--------|------|-------------|
| Linear (FC) | 모든 입력-출력 연결 | MLP, 분류 헤드 |
| Conv2d | 지역적 패턴 학습, 가중치 공유 | 이미지 처리 |
| LSTM/GRU | 시퀀스 상태 유지 | 자연어, 시계열 |
| Attention | 위치별 중요도 가중합 | 트랜스포머 |
| Embedding | 정수 → 벡터 룩업 | NLP 토큰 |

## 신경망 학습 흐름

신경망 학습의 전체 사이클은 4단계로 이루어진다.

```python
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
criterion = nn.CrossEntropyLoss()

for epoch in range(100):
    for X_batch, y_batch in dataloader:
        # 1. 순전파 → 예측
        pred = model(X_batch)
        # 2. 손실 계산
        loss = criterion(pred, y_batch)
        # 3. 역전파 → 그래디언트 계산
        optimizer.zero_grad()
        loss.backward()
        # 4. 파라미터 업데이트
        optimizer.step()
```

이 사이클에서 순전파는 예측을 만들고, 역전파(backpropagation)는 각 파라미터에 대한 손실의 기울기를 계산한다. 파라미터 업데이트는 옵티마이저가 담당한다. 역전파는 다음 글에서 자세히 다룬다.

## 정리

신경망의 핵심 구성 요소를 정리하면: 층(Layer)은 선형 변환(가중치 행렬 × 입력 + 편향)과 비선형 활성화 함수로 이루어진다. 여러 층을 쌓으면 복잡한 함수를 근사할 수 있는 능력이 생긴다. 파라미터 수는 층간 연결 수 + 편향 수로 계산한다. 순전파는 입력에서 출력으로 데이터가 흐르며 예측을 생성하는 과정이다.

---

**지난 글:** [퍼셉트론: 딥러닝의 기원이 된 인공 뉴런](/posts/nn-perceptron/)

**다음 글:** [활성화 함수: ReLU, Sigmoid, GELU의 모든 것](/posts/nn-activation-functions/)

<br>
읽어주셔서 감사합니다. 😊
