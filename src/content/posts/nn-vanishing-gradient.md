---
title: "기울기 소실과 폭발: 깊은 네트워크의 고질적 문제"
description: "깊은 신경망 학습을 방해하는 기울기 소실(Vanishing Gradient)과 기울기 폭발(Exploding Gradient)의 수학적 원인을 이해한다. ReLU, 잔차 연결, 배치 정규화, Gradient Clipping 등 현대적 해결책을 코드와 함께 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["기울기소실", "기울기폭발", "VanishingGradient", "잔차연결", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/nn-dropout/)에서 드롭아웃이 과적합을 막는 앙상블 정규화임을 배웠다. 이번 글에서는 깊은 신경망 학습의 가장 근본적인 난제인 **기울기 소실(Vanishing Gradient)**과 **기울기 폭발(Exploding Gradient)**을 다룬다. 이 두 문제는 1990년대에 처음 발견되었고, 2012년 딥러닝 붐 이전까지 깊은 네트워크 학습을 사실상 불가능하게 만들었다. 오늘날 ResNet, LSTM, Transformer 등 현대 아키텍처들은 모두 이 문제의 해결책을 내포하고 있다.

## 기울기 소실의 수학적 원인

역전파는 연쇄 법칙으로 기울기를 계산한다. N층 네트워크에서 첫 번째 층의 기울기는:

$$\frac{\partial L}{\partial W_1} = \frac{\partial L}{\partial a_N} \cdot \prod_{k=2}^{N} \frac{\partial a_k}{\partial a_{k-1}} \cdot \frac{\partial a_1}{\partial W_1}$$

각 층의 로컬 기울기 `∂aₖ/∂aₖ₋₁ = W^(k) · f'(z^(k-1))`를 곱한다.

**Sigmoid를 사용하는 경우**:
- σ'(z) = σ(z)(1−σ(z)) ≤ 0.25
- N층이면 최대 기울기 ≤ 0.25ᴺ
- 10층이면 최대 0.25¹⁰ ≈ 10⁻⁶ (사실상 0)

```python
import torch
import torch.nn as nn
import matplotlib.pyplot as plt

# Sigmoid 기울기 소실 실험
def check_gradient_flow(model, x):
    y = model(x)
    loss = y.sum()
    loss.backward()
    grad_norms = []
    for name, param in model.named_parameters():
        if param.grad is not None and 'weight' in name:
            grad_norms.append(param.grad.norm().item())
    return grad_norms

# Sigmoid 20층 네트워크
sigmoid_model = nn.Sequential(
    *[layer for _ in range(20)
      for layer in [nn.Linear(64, 64), nn.Sigmoid()]]
)

x = torch.randn(32, 64)
grads = check_gradient_flow(sigmoid_model, x)
for i, g in enumerate(grads):
    print(f"층 {i+1:2d}: 기울기 norm = {g:.2e}")
# 층 20: 기울기 norm = 2.15e-01
# 층 15: 기울기 norm = 3.47e-03
# 층 10: 기울기 norm = 1.82e-05
# 층  1: 기울기 norm = 4.23e-09  ← 사실상 0!
```

## 기울기 폭발

반대로 가중치 행렬의 최대 특이값(spectral norm)이 1보다 크면 기울기가 지수적으로 증가한다.

```python
# 기울기 폭발 시뮬레이션
import torch

# 큰 가중치를 가진 선형 변환 반복
x = torch.tensor([1.0])
W = torch.tensor([[2.0]])  # |W| = 2 > 1

for i in range(20):
    x = W @ x
    print(f"Step {i+1:2d}: x = {x.item():.2e}")
# Step  1: x = 2.00e+00
# Step  5: x = 3.20e+01
# Step 10: x = 1.02e+03
# Step 20: x = 1.05e+06  → 폭발

# RNN에서 시퀀스 길이만큼 반복되므로 특히 심각
```

기울기 폭발은 NaN이나 Inf가 파라미터에 나타나며 학습이 완전히 망가진다.

![기울기 소실과 폭발 문제](/assets/posts/nn-vanishing-gradient-problem.svg)

## 해결책 1: ReLU 활성화

ReLU의 미분은 z > 0이면 1, z ≤ 0이면 0이다. 양수 영역에서 기울기가 그대로 통과되어 소실이 일어나지 않는다.

```python
# ReLU vs Sigmoid 기울기 비교
relu_model = nn.Sequential(
    *[layer for _ in range(20)
      for layer in [nn.Linear(64, 64), nn.ReLU()]]
)
nn.init.kaiming_normal_(relu_model[0].weight)

x = torch.randn(32, 64)
grads_relu = check_gradient_flow(relu_model, x)
# 층 20: 기울기 norm = 2.15e-01
# 층  1: 기울기 norm = 1.87e-01  ← 소실 없음!

# Dying ReLU: 모든 입력이 음수면 기울기 = 0
# → Leaky ReLU, ELU, He 초기화로 완화
```

## 해결책 2: 잔차 연결 (Residual Connection)

2015년 He et al.이 제안한 ResNet의 핵심 아이디어. 서브레이어의 출력에 입력을 더한다.

```python
class ResidualBlock(nn.Module):
    def __init__(self, dim, dropout=0.1):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(dim, dim),
            nn.LayerNorm(dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(dim, dim),
        )
        self.norm = nn.LayerNorm(dim)

    def forward(self, x):
        # 잔차 연결: f(x) + x
        # 기울기: ∂L/∂x = ∂L/∂y · (I + ∂f/∂x)
        # I (항등 행렬)로 인해 항상 최소 기울기 1 보장
        return self.norm(self.layers(x) + x)

# 100층도 안정적으로 학습 가능
deep_resnet = nn.Sequential(
    nn.Linear(784, 256),
    *[ResidualBlock(256) for _ in range(50)],
    nn.Linear(256, 10),
)
print(f"파라미터: {sum(p.numel() for p in deep_resnet.parameters()):,}")
```

잔차 연결이 있으면 기울기가 `f(x) + x → x` 경로를 통해 **직접** 초기 층까지 흐를 수 있다. 이것이 ResNet이 100층, 200층도 학습 가능한 이유다.

## 해결책 3: Gradient Clipping

기울기 폭발은 주로 RNN/LSTM에서 발생한다. Gradient Clipping은 기울기 벡터의 노름이 임계값을 초과하면 스케일다운한다.

```python
import torch.nn as nn

model = nn.LSTM(input_size=128, hidden_size=256,
                num_layers=4, batch_first=True)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

for batch in dataloader:
    optimizer.zero_grad()
    out, _ = model(batch)
    loss = criterion(out, targets)
    loss.backward()

    # 기울기 노름 계산 및 클리핑
    total_norm = nn.utils.clip_grad_norm_(
        model.parameters(),
        max_norm=1.0  # 임계값
    )

    if total_norm > 10:  # 폭발 감지
        print(f"Warning: grad norm = {total_norm:.2f}")

    optimizer.step()
```

## 기울기 모니터링

```python
def log_gradient_norms(model, step, writer=None):
    total_norm = 0.0
    for name, param in model.named_parameters():
        if param.grad is None:
            continue
        norm = param.grad.data.norm(2).item()
        total_norm += norm ** 2
        if writer:
            writer.add_scalar(f"grad/{name}", norm, step)
    total_norm = total_norm ** 0.5

    if total_norm < 1e-6:
        print(f"Step {step}: 기울기 소실 의심 ({total_norm:.2e})")
    elif total_norm > 100:
        print(f"Step {step}: 기울기 폭발 의심 ({total_norm:.2e})")
    return total_norm
```

![기울기 소실 해결책 코드](/assets/posts/nn-vanishing-gradient-solutions.svg)

## 현대 아키텍처의 종합적 해결책

| 문제 | 해결책 | 적용된 아키텍처 |
|------|-------|--------------|
| 기울기 소실 | ReLU/GELU 활성화 | 모든 현대 네트워크 |
| 기울기 소실 | 잔차 연결 | ResNet, Transformer |
| 기울기 소실 | 배치/레이어 정규화 | ResNet, Transformer |
| 기울기 소실 | He/Xavier 초기화 | 모든 현대 네트워크 |
| 기울기 폭발 | Gradient Clipping | RNN, Transformer 학습 |
| 기울기 소실/폭발 | LSTM/GRU 게이트 | 순환 신경망 |

기울기 소실·폭발 문제는 완전히 "해결"된 것이 아니라, 적절한 기법들의 조합으로 관리되는 것이다. 현대 딥러닝의 여러 설계 결정들—ReLU, 잔차 연결, 배치 정규화, 신중한 초기화—이 모두 이 문제를 염두에 두고 개발되었다. 이로써 신경망 기초 시리즈가 마무리된다. 다음 단계는 이미지를 위한 합성곱 신경망(CNN)이다.

---

**지난 글:** [드롭아웃: 과적합을 막는 앙상블 정규화](/posts/nn-dropout/)

**다음 글:** [합성곱 연산: CNN의 핵심 원리](/posts/cnn-convolution-basics/)

<br>
읽어주셔서 감사합니다. 😊
