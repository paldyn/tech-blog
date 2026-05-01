---
title: "순전파와 역전파: 신경망 학습의 핵심 원리"
description: "신경망 학습의 핵심인 순전파(Forward Pass)와 역전파(Backpropagation)를 수식과 코드로 완전히 이해한다. 연쇄 법칙(Chain Rule)이 어떻게 다층 신경망의 기울기를 계산하는지, PyTorch Autograd가 이를 어떻게 자동화하는지를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["역전파", "순전파", "연쇄법칙", "Autograd", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/nn-activation-functions/)에서 활성화 함수가 신경망에 비선형성을 부여한다는 것을 배웠다. 이제 신경망이 **어떻게 학습하는지**를 파헤칠 차례다. 신경망 학습의 핵심은 **역전파(Backpropagation)**다. 역전파가 없었다면 현대 딥러닝은 존재하지 않았을 것이다. 1986년 Rumelhart, Hinton, Williams가 발표한 이 알고리즘은 다층 신경망의 가중치를 효율적으로 학습할 수 있게 해주었다. 이번 글에서는 순전파로 예측을 만들고, 역전파로 기울기를 계산하고, 그 기울기로 파라미터를 업데이트하는 전체 과정을 수식과 코드로 명확히 이해한다.

## 학습의 목표: 손실 최소화

신경망 학습이란 **손실 함수(Loss Function) L을 최소화하는 가중치 W를 찾는 것**이다. 경사하강법(Gradient Descent)을 쓴다:

```
W ← W - η · ∂L/∂W
```

문제는 `∂L/∂W`를 어떻게 효율적으로 계산하느냐다. 수치 미분으로 계산하면 파라미터마다 최소 두 번의 순전파가 필요해 비효율적이다. 역전파는 한 번의 순전파 + 한 번의 역전파로 **모든 파라미터의 기울기를 동시에** 계산한다.

## 순전파 (Forward Pass)

입력 x가 층을 통과하며 예측값을 생성하는 과정이다. 각 층에서:

```python
import torch
import torch.nn as nn

# 단순화된 2층 네트워크 예시
W1 = torch.randn(4, 3, requires_grad=True)
b1 = torch.zeros(4, requires_grad=True)
W2 = torch.randn(1, 4, requires_grad=True)
b2 = torch.zeros(1, requires_grad=True)

x = torch.randn(8, 3)  # 배치 8, 입력 3
y_true = torch.randn(8, 1)

# 순전파 단계별 계산
z1 = x @ W1.t() + b1       # (8, 4) 선형 변환
a1 = torch.relu(z1)         # (8, 4) 활성화
z2 = a1 @ W2.t() + b2      # (8, 1) 선형 변환
y_pred = z2                  # 출력 (회귀: 활성화 없음)

loss = ((y_pred - y_true)**2).mean()  # MSE 손실
print(f"Loss: {loss.item():.4f}")
```

## 역전파의 핵심: 연쇄 법칙

역전파는 **연쇄 법칙(Chain Rule)**의 반복 적용이다.

합성 함수 `y = f(g(x))`의 미분:
$$\frac{dy}{dx} = \frac{dy}{df} \cdot \frac{df}{dg} \cdot \frac{dg}{dx}$$

신경망에서 손실 L이 W₁에 대해 갖는 기울기:
$$\frac{\partial L}{\partial W_1} = \frac{\partial L}{\partial \hat{y}} \cdot \frac{\partial \hat{y}}{\partial a_1} \cdot \frac{\partial a_1}{\partial z_1} \cdot \frac{\partial z_1}{\partial W_1}$$

각 항을 풀어보면:
- `∂L/∂ŷ`: 손실 함수의 미분 (MSE면 `2(ŷ−y)/n`)
- `∂ŷ/∂a₁` = W₂ (두 번째 층의 가중치 행렬)
- `∂a₁/∂z₁` = ReLU'(z₁) = z₁ > 0이면 1, 아니면 0
- `∂z₁/∂W₁` = x (입력)

```python
# PyTorch Autograd로 위 계산 자동화
loss.backward()  # 한 줄로 모든 기울기 계산

print(f"W1.grad shape: {W1.grad.shape}")  # (4, 3)
print(f"W2.grad shape: {W2.grad.shape}")  # (1, 4)

# 수동 계산과 비교 검증
dL_dpred = 2 * (y_pred - y_true) / y_pred.shape[0]
dL_dW2_manual = (dL_dpred * a1).sum(dim=0).unsqueeze(0)
print(torch.allclose(W2.grad, dL_dW2_manual, atol=1e-6))
# → True (자동/수동 결과 동일)
```

![순전파와 역전파 흐름](/assets/posts/nn-forward-backward-graph.svg)

## 실전 PyTorch 학습 루프

```python
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(10, 64),
    nn.ReLU(),
    nn.Linear(64, 32),
    nn.ReLU(),
    nn.Linear(32, 1),
)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
criterion = nn.MSELoss()

X = torch.randn(100, 10)
y = torch.randn(100, 1)

for epoch in range(200):
    # 1) 이전 기울기 초기화 (누적 방지)
    optimizer.zero_grad()
    # 2) 순전파
    pred = model(X)
    loss = criterion(pred, y)
    # 3) 역전파 (기울기 계산)
    loss.backward()
    # 4) 파라미터 업데이트
    optimizer.step()

    if epoch % 50 == 0:
        print(f"Epoch {epoch:3d} | Loss: {loss.item():.4f}")
```

반드시 `optimizer.zero_grad()`를 먼저 호출해야 한다. PyTorch는 기본적으로 기울기를 **누적**하기 때문에, 이전 스텝의 기울기가 남아있으면 잘못된 업데이트가 일어난다.

## 계산 그래프와 Autograd

PyTorch는 `requires_grad=True`인 텐서를 포함한 연산을 수행할 때 자동으로 **계산 그래프(Computational Graph)**를 구성한다. `backward()`를 호출하면 이 그래프를 역방향으로 순회하며 기울기를 계산한다.

```python
# 계산 그래프 확인
x = torch.tensor([2.0], requires_grad=True)
y = x ** 3 + 2 * x + 1
print(y)  # tensor([13.], grad_fn=<AddBackward0>)

y.backward()
print(x.grad)  # tensor([14.]) ← dy/dx = 3x²+2 = 3*4+2=14

# gradient_fn으로 그래프 탐색
print(y.grad_fn)       # AddBackward0
print(y.grad_fn.next_functions)  # 이전 연산들
```

![PyTorch Autograd](/assets/posts/nn-forward-backward-code.svg)

## 기울기가 잘못될 때 디버깅

```python
# 흔한 실수 1: zero_grad 누락
for epoch in range(3):
    pred = model(X)
    loss = criterion(pred, y)
    # optimizer.zero_grad() 빠뜨림!
    loss.backward()
    optimizer.step()
    # → 기울기가 매 스텝 누적되어 엉뚱한 방향으로 업데이트

# 흔한 실수 2: detach 없이 루프에서 loss 누적
losses = []
for batch in dataloader:
    loss = criterion(model(batch[0]), batch[1])
    losses.append(loss)           # 계산 그래프 전체 보존 → 메모리 폭발
    losses.append(loss.item())    # 올바른 방법: 값만 추출
```

## 역전파의 비용

역전파는 순전파와 비슷한 계산량을 갖는다. 따라서 전체 학습 비용은 대략 "순전파 + 역전파 ≈ 순전파의 2~3배"다. 이것이 추론(inference)보다 학습이 더 많은 메모리와 시간을 필요로 하는 이유다. 또한 역전파는 순전파 시 계산된 중간 활성값을 기억해야 하므로, 배치 크기가 클수록 메모리 사용량이 늘어난다.

---

**지난 글:** [활성화 함수: ReLU·Sigmoid·GELU의 모든 것](/posts/nn-activation-functions/)

**다음 글:** [MLP: 다층 퍼셉트론으로 임의의 함수를 근사하다](/posts/nn-mlp/)

<br>
읽어주셔서 감사합니다. 😊
