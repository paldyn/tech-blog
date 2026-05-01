---
title: "가중치 초기화: Xavier, He, 그리고 수렴의 비밀"
description: "신경망 학습 성패를 좌우하는 가중치 초기화를 완전히 이해한다. 제로 초기화의 위험, Xavier/Glorot 초기화, He/Kaiming 초기화의 수학적 근거와 PyTorch 구현, 실무 선택 기준을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["가중치초기화", "Xavier", "He초기화", "Kaiming", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/nn-mlp/)에서 다층 퍼셉트론을 구현하고 학습시켰다. 그런데 신경망이 학습을 시작하기 전, 가중치의 초기값을 어떻게 설정하느냐가 학습 성패를 크게 좌우한다. 잘못된 초기화는 기울기 소실이나 폭발을 유발해 학습 자체를 불가능하게 만들 수 있다. 이번 글에서는 **가중치 초기화(Weight Initialization)**의 수학적 근거와 실무 사용법을 다룬다.

## 왜 초기화가 중요한가

신경망의 층을 통과하면서 활성값의 분산이 어떻게 변하는지 생각해보자. 입력 x의 분산이 σ²_x, 가중치의 분산이 σ²_w라면, 선형 조합 z = Σwᵢxᵢ의 분산은:

$$\text{Var}(z) = n \cdot \sigma^2_w \cdot \sigma^2_x$$

여기서 n은 입력 뉴런 수다. **층마다 n · σ²_w의 인수만큼 분산이 변한다.**

```python
import torch
import torch.nn as nn
import matplotlib.pyplot as plt

# 분산 변화 실험
def activation_variance_experiment(W_std):
    x = torch.randn(1000, 500)
    stds = [x.std().item()]
    for _ in range(10):
        W = torch.randn(500, 500) * W_std
        x = torch.tanh(x @ W)
        stds.append(x.std().item())
    return stds

# 너무 작은 std: 분산이 소멸
print(activation_variance_experiment(0.01))
# [1.00, 0.071, 0.014, 0.003, ...]  → 0으로 수렴

# 너무 큰 std: 포화 발생
print(activation_variance_experiment(1.0))
# [1.00, 1.00, 1.00, ...]  → tanh 포화 (기울기≈0)
```

## 제로 초기화의 치명적 문제

직관적으로 W=0으로 초기화하면 대칭적이어서 좋을 것 같지만, 실제로는 **대칭성 파괴(Symmetry Breaking)**가 일어나지 않아 학습이 불가능하다.

```python
# 제로 초기화 실험
model_zero = nn.Linear(10, 10)
nn.init.zeros_(model_zero.weight)

# 순전파 후 역전파
x = torch.randn(5, 10)
loss = model_zero(x).sum()
loss.backward()

# 모든 뉴런이 동일한 기울기 → 영원히 동일하게 업데이트
print(model_zero.weight.grad[:3])
# 모든 행이 동일! — 사실상 뉴런이 1개인 것과 동일
```

모든 뉴런이 같은 출력을 내면 같은 기울기를 받고, 같은 방향으로 업데이트되어 영원히 구별되지 않는다. 이를 **대칭성 문제(Symmetry Problem)**라 한다.

## Xavier / Glorot 초기화 (2010)

Xavier Glorot와 Yoshua Bengio가 제안한 초기화 방법이다. **각 층의 입력과 출력 분산이 같게 유지**되도록 설계한다.

분산 유지 조건: σ²_w = 2 / (n_in + n_out)

균등 분포 버전: W ~ Uniform(-√(6/(n_in+n_out)), +√(6/(n_in+n_out)))

![가중치 초기화 방법 비교](/assets/posts/nn-weight-init-methods.svg)

```python
import torch.nn as nn

# Xavier 초기화 (Tanh, Sigmoid 활성화에 적합)
layer = nn.Linear(256, 128)
nn.init.xavier_uniform_(layer.weight)
nn.init.zeros_(layer.bias)

# 분산 확인
print(f"분산: {layer.weight.var().item():.6f}")
expected = 2 / (256 + 128)
print(f"기대값: {expected:.6f}")  # 매우 근사
```

Xavier 초기화는 **대칭 활성화 함수(Tanh, Sigmoid)**에 최적화되어 있다. 이 함수들은 입력이 작을 때 거의 선형 동작을 하므로 분산 유지 가정이 성립한다.

## He / Kaiming 초기화 (2015)

Kaiming He가 제안한 방법으로, **ReLU 활성화 함수**에 최적화되어 있다.

ReLU는 음수 입력을 0으로 만들어 분산을 절반으로 줄인다. 이를 보정하기 위해:

σ²_w = **2 / n_in** (fan_in 기준)

```python
# He / Kaiming 초기화 (ReLU 활성화에 적합)
layer = nn.Linear(256, 128)
nn.init.kaiming_normal_(
    layer.weight,
    mode='fan_in',           # 입력 뉴런 수로 정규화
    nonlinearity='relu'      # ReLU 보정
)
nn.init.zeros_(layer.bias)

# 전체 모델에 적용: model.apply()
def init_he(m):
    if isinstance(m, (nn.Linear, nn.Conv2d)):
        nn.init.kaiming_normal_(
            m.weight, nonlinearity='relu'
        )
        if m.bias is not None:
            nn.init.zeros_(m.bias)

model = nn.Sequential(
    nn.Linear(784, 512), nn.ReLU(),
    nn.Linear(512, 256), nn.ReLU(),
    nn.Linear(256, 10),
)
model.apply(init_he)
```

## 실험으로 확인하기

```python
import torch

def forward_pass_variance(model, n_samples=1000, n_features=100):
    x = torch.randn(n_samples, n_features)
    variances = [x.var().item()]
    for layer in model.children():
        x = layer(x) if not isinstance(layer, nn.ReLU) else layer(x)
        variances.append(x.var().item())
    return variances

# Xavier 초기화: 분산 안정
model_xavier = nn.Sequential(
    nn.Linear(100, 100), nn.Tanh(),
    nn.Linear(100, 100), nn.Tanh(),
    nn.Linear(100, 100), nn.Tanh(),
)
for m in model_xavier.modules():
    if isinstance(m, nn.Linear):
        nn.init.xavier_normal_(m.weight)

vars_xavier = forward_pass_variance(model_xavier)
print(vars_xavier)  # [1.0, ~1.0, ~1.0, ~1.0] — 안정!
```

![가중치 초기화 코드 구현](/assets/posts/nn-weight-init-code.svg)

## 특수 케이스

| 상황 | 권장 초기화 |
|------|-----------|
| ReLU 계열 은닉층 | He/Kaiming Normal (mode=fan_in) |
| Sigmoid/Tanh 은닉층 | Xavier Uniform/Normal |
| 트랜스포머 | N(0, 0.02) 또는 Xavier |
| 출력층 | N(0, 0.01) 또는 Xavier |
| 임베딩 층 | N(0, 1) 또는 N(0, d_model^-0.5) |

## 배치 정규화의 영향

배치 정규화(Batch Normalization)를 사용하면 초기화의 중요도가 크게 감소한다. 배치 정규화가 각 층의 입력을 자동으로 정규화하여 분산 문제를 완화하기 때문이다. 현대 딥러닝에서는 배치 정규화나 레이어 정규화를 함께 사용하는 경우가 많아, 초기화의 영향이 줄어들었다. 하지만 **정규화 레이어가 없는 네트워크**에서는 여전히 초기화가 매우 중요하다.

---

**지난 글:** [MLP: 다층 퍼셉트론으로 임의의 함수를 근사하다](/posts/nn-mlp/)

**다음 글:** [배치 정규화: 내부 공변량 이동을 잡아라](/posts/nn-batch-normalization/)

<br>
읽어주셔서 감사합니다. 😊
