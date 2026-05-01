---
title: "MLP: 다층 퍼셉트론으로 임의의 함수를 근사하다"
description: "다층 퍼셉트론(MLP)의 구조와 보편 근사 정리를 이해한다. 깊이와 너비의 트레이드오프, MNIST 분류기 완전 구현, 하이퍼파라미터 선택 가이드까지 실전 중심으로 MLP를 완전히 파악한다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["MLP", "다층퍼셉트론", "보편근사정리", "딥러닝기초", "MNIST"]
featured: false
draft: false
---

[지난 글](/posts/nn-forward-backward/)에서 역전파가 연쇄 법칙을 통해 모든 층의 기울기를 계산한다는 것을 배웠다. 이 역전파로 학습할 수 있는 가장 기본적인 신경망 구조가 **다층 퍼셉트론(Multi-Layer Perceptron, MLP)**이다. MLP는 딥러닝의 출발점이자 가장 이해하기 쉬운 형태다. 이번 글에서는 MLP의 구조, **보편 근사 정리(Universal Approximation Theorem)**, 깊이와 너비의 트레이드오프, 그리고 MNIST 손글씨 분류기 완전 구현을 다룬다.

## MLP란

MLP는 **완전 연결 층(Fully Connected Layer)을 여러 개 쌓은 신경망**이다. 단일 퍼셉트론과 달리 은닉층을 가지며, 비선형 활성화 함수를 통해 선형 분리 불가능한 문제도 해결할 수 있다.

- **입력층**: 원시 특성을 받음
- **은닉층(≥1개)**: 특성을 변환하며 패턴을 학습
- **출력층**: 최종 예측을 생성

XOR 문제를 예로 들면, MLP는 다음과 같이 해결한다:

```python
import torch
import torch.nn as nn

# XOR 데이터
X = torch.tensor([[0.,0.],[0.,1.],[1.,0.],[1.,1.]])
y = torch.tensor([[0.],[1.],[1.],[0.]])

# 단층 퍼셉트론: XOR 해결 불가
# 2층 MLP: 해결 가능
model = nn.Sequential(
    nn.Linear(2, 4),   # 은닉층: 2차원을 4차원으로
    nn.ReLU(),
    nn.Linear(4, 1),   # 출력층
    nn.Sigmoid(),
)

optimizer = torch.optim.Adam(model.parameters(), lr=0.1)
criterion = nn.BCELoss()

for _ in range(1000):
    optimizer.zero_grad()
    loss = criterion(model(X), y)
    loss.backward()
    optimizer.step()

pred = (model(X) > 0.5).float()
print(pred.t())  # tensor([[0., 1., 1., 0.]]) — XOR 해결!
```

## 보편 근사 정리

**보편 근사 정리(Universal Approximation Theorem, Hornik 1989)**:

> 충분히 많은 뉴런을 가진 1개의 은닉층 MLP는, 임의의 연속 함수를 임의의 정밀도로 근사할 수 있다.

이것이 MLP가 강력한 이유다. 이론적으로 어떤 함수든 근사할 수 있다. 단, 이 정리는 **존재 증명**이다. 파라미터 수가 충분하면 존재는 하지만, 역전파로 실제로 그 파라미터를 찾을 수 있는지는 별개의 문제다.

실용적 시사점:
- 복잡한 문제일수록 더 큰 은닉층이 필요
- 단, 너무 크면 과적합(Overfitting)이 발생
- 깊은 네트워크가 같은 파라미터 수에서 더 효율적인 경우가 많음

![MLP 구조와 보편 근사 정리](/assets/posts/nn-mlp-architecture.svg)

## 깊이(Depth) vs 너비(Width)

```python
import torch.nn as nn

# 좁고 깊은 네트워크 (파라미터 약 5만)
deep_narrow = nn.Sequential(
    nn.Linear(784, 64), nn.ReLU(),
    nn.Linear(64, 64),  nn.ReLU(),
    nn.Linear(64, 64),  nn.ReLU(),
    nn.Linear(64, 64),  nn.ReLU(),
    nn.Linear(64, 10),
)

# 넓고 얕은 네트워크 (파라미터 약 20만)
wide_shallow = nn.Sequential(
    nn.Linear(784, 256), nn.ReLU(),
    nn.Linear(256, 10),
)

# 실무 결론:
# - 같은 파라미터 수면 깊은 네트워크가 유리 (계층적 특성 학습)
# - 너무 깊으면 기울기 소실/폭발 위험 (→ ResNet, BatchNorm 필요)
# - 일반적으로 깊이 3~7 + 드롭아웃이 좋은 시작점
```

실제 연구 결과에 따르면, 깊은 네트워크는 **계층적(hierarchical) 특성**을 학습한다. 첫 층은 단순한 패턴, 중간 층은 조합된 패턴, 마지막 층은 추상적 개념을 표현하는 경향이 있다.

## MNIST 분류기 완전 구현

```python
import torch
import torch.nn as nn
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

# 데이터 준비
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,))
])
train_data = datasets.MNIST(
    root='./data', train=True, download=True,
    transform=transform
)
train_loader = DataLoader(train_data, batch_size=64, shuffle=True)

# 모델 정의
class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(784, 512), nn.ReLU(),
            nn.Linear(512, 256), nn.ReLU(),
            nn.Linear(256, 10),
        )
    def forward(self, x):
        return self.net(x)

model = MLP()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
criterion = nn.CrossEntropyLoss()

# 학습
for epoch in range(5):
    model.train()
    total_loss, correct = 0, 0
    for X, y in train_loader:
        optimizer.zero_grad()
        out = model(X)
        loss = criterion(out, y)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
        correct += (out.argmax(1) == y).sum().item()
    print(f"Epoch {epoch+1} | Loss: {total_loss/len(train_loader):.3f}"
          f" | Acc: {correct/len(train_data):.3f}")
```

![MLP MNIST 구현](/assets/posts/nn-mlp-code.svg)

## 하이퍼파라미터 선택 가이드

MLP 설계 시 결정해야 하는 주요 하이퍼파라미터:

| 하이퍼파라미터 | 일반적 시작점 | 조정 방법 |
|-------------|------------|---------|
| 은닉층 수 | 2~4개 | 과소적합 시 증가 |
| 은닉층 크기 | 64~512 | 2의 거듭제곱 권장 |
| 활성화 함수 | ReLU | GELU도 좋음 |
| 학습률 | 1e-3 (Adam) | LR Scheduler 사용 |
| 배치 크기 | 32~256 | GPU 메모리에 맞게 |
| 정규화 | Dropout(0.3~0.5) | 과적합 시 추가 |

## MLP의 한계

MLP는 강력하지만 이미지, 시퀀스 데이터에는 비효율적이다. 28×28 이미지를 784차원 벡터로 펼치면 **공간적 구조 정보를 잃는다**. 인접한 픽셀이 관련 있다는 사실을 전혀 활용하지 못한다. 이것이 이미지에 **CNN(Convolutional Neural Network)**, 시퀀스에 **RNN**이나 **Transformer**를 사용하는 이유다.

MLP는 여전히 분류 헤드(classifier head), 피드포워드 레이어(FFN), 임베딩 변환 등 다양한 곳에서 핵심 구성 요소로 사용된다.

---

**지난 글:** [순전파와 역전파: 신경망 학습의 핵심 원리](/posts/nn-forward-backward/)

**다음 글:** [가중치 초기화: Xavier, He, 그리고 수렴의 비밀](/posts/nn-weight-init/)

<br>
읽어주셔서 감사합니다. 😊
