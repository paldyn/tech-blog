---
title: "미적분학: AI 학습을 가능하게 하는 수학"
description: "도함수, 편미분, 연쇄 법칙, 야코비안까지 ML에 필요한 미적분학 핵심을 PyTorch 자동 미분 코드와 함께 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["미적분학", "도함수", "편미분", "연쇄법칙", "역전파", "AI수학"]
featured: false
draft: false
---

[지난 글](/posts/ai-information-theory/)에서 정보 이론이 AI의 손실 함수와 평가 지표의 수학적 기반임을 살펴봤다. 이번에는 AI가 그 손실을 실제로 줄이는 과정, 즉 **모델 학습을 가능하게 하는 미적분학**을 다룬다. 딥러닝 연구자들이 흔히 하는 말이 있다. "역전파(Backpropagation)는 사실 연쇄 법칙(Chain Rule)이 전부다." 이 한 문장이 참임을 이해하는 것이 이번 글의 목표다.

## 도함수: 변화의 속도를 측정하다

**도함수(Derivative)**는 함수 f(x)가 x의 변화에 얼마나 민감하게 반응하는지를 나타낸다.

```
f′(x) = df/dx = lim[Δx→0] (f(x+Δx) − f(x)) / Δx
```

기하학적으로는 x에서의 **접선의 기울기**다. ML에서 도함수는 "파라미터 θ를 살짝 바꿨을 때 손실 L이 얼마나 변하는가"를 알려준다. 이 정보로 파라미터를 어느 방향으로 얼마만큼 움직여야 손실이 줄어드는지 결정한다.

```python
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# 수치 미분: 도함수 정의에서 직접 계산
def numerical_derivative(f, x, h=1e-5):
    return (f(x + h) - f(x - h)) / (2 * h)

# 예시: f(x) = x³ - 3x
f = lambda x: x**3 - 3*x
df = lambda x: 3*x**2 - 3  # 해석적 도함수

x0 = 2.0
print(f"수치 미분:  {numerical_derivative(f, x0):.6f}")
print(f"해석적 미분: {df(x0):.6f}")
# 둘 다 9.000000 ← 일치
```

ML에서 자주 쓰이는 도함수를 외워두면 유용하다.

| 함수 | 도함수 | 비고 |
|------|--------|------|
| xⁿ | n·xⁿ⁻¹ | 거듭제곱 규칙 |
| eˣ | eˣ | 지수 함수는 자기 자신 |
| ln(x) | 1/x | 로그 손실 미분 시 활용 |
| sigmoid(x) | σ(x)·(1−σ(x)) | 이진 분류 출력층 |
| tanh(x) | 1 − tanh²(x) | RNN 활성화 함수 |
| ReLU(x) | 0 (x≤0), 1 (x>0) | 현대 딥러닝의 기본 |

## 편미분과 그래디언트: 다차원으로 확장

신경망의 파라미터는 수백만 개다. 변수가 여러 개일 때 한 변수에 대해서만 미분하는 것이 **편미분(Partial Derivative)**이다.

```
∂f/∂xᵢ : 다른 변수는 상수로 취급하고 xᵢ만 변화시킬 때의 변화율
```

모든 편미분을 벡터로 모은 것이 **그래디언트(Gradient, ∇f)**다.

```python
import torch

# PyTorch로 편미분 계산
w1 = torch.tensor(2.0, requires_grad=True)
w2 = torch.tensor(3.0, requires_grad=True)

# L = w1² + 2·w1·w2 + w2²
L = w1**2 + 2*w1*w2 + w2**2
L.backward()  # 그래디언트 계산

print(f"∂L/∂w1 = {w1.grad:.1f}")  # 2w1 + 2w2 = 4+6 = 10
print(f"∂L/∂w2 = {w2.grad:.1f}")  # 2w1 + 2w2 = 4+6 = 10 (대칭)
# → 그래디언트 벡터 ∇L = [10, 10]
```

그래디언트 ∇f는 **f가 가장 가파르게 증가하는 방향**을 가리킨다. 손실 최소화를 위해서는 그래디언트의 반대 방향(-∇f)으로 파라미터를 업데이트한다. 이것이 경사 하강법의 핵심이다.

## 연쇄 법칙: 역전파의 수학

**연쇄 법칙(Chain Rule)**은 합성 함수를 미분하는 규칙이다.

```
z = f(g(x)) 일 때:
dz/dx = dz/dy · dy/dx   (y = g(x))
```

딥러닝에서 신경망은 수백 개의 연산이 중첩된 합성 함수다. 역전파(Backpropagation)는 연쇄 법칙을 체계적으로 적용해 출력 손실에서 각 파라미터까지의 그래디언트를 효율적으로 계산한다.

```python
import torch
import torch.nn as nn

# 간단한 2-레이어 네트워크로 연쇄 법칙 확인
x = torch.tensor([[1.0, 2.0, 3.0]])  # 입력

layer1 = nn.Linear(3, 4, bias=False)
layer2 = nn.Linear(4, 1, bias=False)
relu   = nn.ReLU()

# 순전파: z = layer2(relu(layer1(x)))
h = relu(layer1(x))  # 은닉층 출력
z = layer2(h)        # 최종 출력

# 역전파: 연쇄 법칙 자동 적용
z.backward()

# ∂z/∂layer1.weight = ∂z/∂h · ∂h/∂layer1 (연쇄 법칙)
print("layer1 grad shape:", layer1.weight.grad.shape)  # [4, 3]
print("layer2 grad shape:", layer2.weight.grad.shape)  # [1, 4]
```

![연쇄 법칙: 역전파의 수학적 기반](/assets/posts/ai-calculus-for-ml-chain-rule.svg)

## 야코비안과 헤시안: 고차원 미분

벡터→벡터 함수의 미분은 **야코비안 행렬(Jacobian Matrix)**이다.

```
f: Rⁿ → Rᵐ 일 때
J[i,j] = ∂fᵢ/∂xⱼ   → (m×n) 행렬
```

배치 학습에서 효율적인 그래디언트 계산에 야코비안-벡터 곱(JVP)과 벡터-야코비안 곱(VJP)이 사용된다. PyTorch의 자동 미분(Autograd)은 내부적으로 VJP를 사용한다.

**헤시안 행렬(Hessian)**은 이차 도함수로 손실 함수의 곡률을 나타낸다. 2차 최적화 방법(Newton's method, L-BFGS)에서 사용되지만, 파라미터 수가 많으면 계산이 너무 비싸 딥러닝에서는 잘 쓰이지 않는다.

```python
import torch

# 야코비안 계산 예시
x = torch.randn(3, requires_grad=True)
f = torch.stack([x[0]**2 + x[1], x[1]*x[2], x[2]**3])

# torch.autograd.functional.jacobian 사용
from torch.autograd.functional import jacobian

def func(x):
    return torch.stack([x[0]**2 + x[1], x[1]*x[2], x[2]**3])

x0 = torch.tensor([1.0, 2.0, 3.0])
J = jacobian(func, x0)
print("Jacobian:\n", J)
# [[2x₀,   1, 0],
#  [0,    x₂, x₁],
#  [0,     0, 3x₂²]]
```

## PyTorch Autograd: 자동 미분 엔진

현대 딥러닝 프레임워크는 **자동 미분(Automatic Differentiation)**으로 연쇄 법칙을 자동 적용한다. 수치 미분(느리고 부정확)이나 기호 미분(표현식 폭발) 대신, 실제 값으로 그래디언트를 정확하게 계산한다.

```python
import torch

# 자동 미분의 핵심: 계산 그래프 (Computation Graph)
x = torch.tensor(2.0, requires_grad=True)
y = torch.tensor(3.0, requires_grad=True)

# 복잡한 계산도 그래프로 기록됨
z = (x * y + x**2).exp()  # z = exp(xy + x²)
z.backward()

# 해석적: dz/dx = z·(y + 2x) = exp(10)·(3+4) = exp(10)·7
print(f"∂z/∂x = {x.grad:.4f}")
print(f"기대값 = {(z * (y + 2*x)).item():.4f}")  # 동일

# gradient accumulation: optimizer.zero_grad() 필수!
optimizer = torch.optim.SGD([x, y], lr=0.01)
optimizer.zero_grad()   # 이전 그래디언트 초기화
z.backward()
optimizer.step()        # 파라미터 업데이트
```

![미적분학: 도함수와 편미분](/assets/posts/ai-calculus-for-ml-derivative.svg)

## 미적분학이 없다면 AI는 없다

미적분학은 AI 학습의 엔진이다. 도함수는 "어느 방향으로 가야 하는가"를 알려주고, 편미분은 수백만 파라미터 각각의 방향을 알려주며, 연쇄 법칙은 이를 효율적으로 계산한다. PyTorch의 `loss.backward()` 한 줄 뒤에는 수십 년간 쌓인 수치 미분 이론이 동작하고 있다.

---

**지난 글:** [정보 이론: AI가 불확실성을 측정하는 방법](/posts/ai-information-theory/)

**다음 글:** [경사 하강법: AI 학습의 엔진](/posts/ai-gradient-descent/)

<br>
읽어주셔서 감사합니다. 😊
