---
title: "드롭아웃: 과적합을 막는 앙상블 정규화"
description: "2014년 Srivastava et al.이 제안한 드롭아웃(Dropout)의 원리, Inverted Dropout 구현, 훈련/추론 모드 차이, Dropout2d·DropPath 변형, 실무 사용 가이드를 코드와 함께 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["드롭아웃", "Dropout", "과적합방지", "정규화", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/nn-layer-normalization/)에서 레이어 정규화가 학습 안정화에 기여한다는 것을 배웠다. 신경망의 또 다른 중요한 정규화 기법인 **드롭아웃(Dropout)**을 이번 글에서 다룬다. 2014년 Srivastava et al.이 발표한 드롭아웃은 매우 단순한 아이디어임에도 과적합 방지에 매우 효과적이다. 훈련 시 무작위로 뉴런을 끄는 것만으로 실질적인 앙상블 효과를 낸다.

## 드롭아웃의 아이디어

드롭아웃의 핵심 아이디어는 단순하다: 훈련 중 각 미니배치마다 뉴런을 확률 p로 무작위로 비활성화(출력을 0으로)한다.

```python
import torch
import torch.nn as nn

# 기본 사용
dropout = nn.Dropout(p=0.5)  # p: 비활성화 확률

x = torch.ones(3, 10)  # 배치 크기 3, 특성 10

# 훈련 모드: p=0.5로 랜덤 마스킹
dropout.train()
out_train = dropout(x)
print(out_train)
# tensor([[0., 2., 0., 2., 0., 2., 0., 2., 0., 2.],
#         [2., 0., 2., 0., 2., 0., 2., 0., 2., 0.],
#         ...])
# → 약 50%가 0, 나머지는 1/(1-0.5)=2로 스케일

# 추론 모드: 모든 뉴런 활성, 스케일 없음
dropout.eval()
out_eval = dropout(x)
print(out_eval)
# tensor([[1., 1., 1., 1., 1., 1., 1., 1., 1., 1.], ...])
```

## Inverted Dropout (역 드롭아웃)

나이브한 드롭아웃은 훈련 시 뉴런을 끄면 추론 시 기대값이 달라지는 문제가 있다. 이를 해결하기 위해 **Inverted Dropout**을 사용한다: 훈련 시 남겨진 뉴런의 출력을 1/(1-p)로 스케일업하여 기대값을 유지한다.

```python
def inverted_dropout(x, p, training=True):
    if not training or p == 0:
        return x
    # Bernoulli 마스크: p 확률로 0 (비활성화)
    mask = (torch.rand_like(x) > p).float()
    # Inverted: 1/(1-p)로 스케일하여 기대값 유지
    return x * mask / (1.0 - p)

# 기대값 확인
x = torch.ones(10000)
out = inverted_dropout(x, p=0.3, training=True)
print(f"기대값: {out.mean():.4f}")  # ≈ 1.0 (유지!)

# 추론 시 스케일 보정 필요 없음
out_eval = inverted_dropout(x, p=0.3, training=False)
print(f"추론 기대값: {out_eval.mean():.4f}")  # 1.0 (동일)
```

PyTorch `nn.Dropout`은 자동으로 Inverted Dropout을 구현한다. 훈련 시 스케일업, 추론 시 통과(no-op).

![드롭아웃 메커니즘](/assets/posts/nn-dropout-network.svg)

## 앙상블로서의 드롭아웃

드롭아웃을 다른 관점에서 바라볼 수 있다. n개의 뉴런이 있을 때 p=0.5 드롭아웃을 적용하면 이론적으로 2ⁿ가지 서로 다른 서브네트워크가 존재한다. 훈련 중 매 스텝마다 다른 서브네트워크를 학습하는 것은 사실상 수많은 모델을 동시에 앙상블 학습하는 것과 유사하다.

추론 시 모든 뉴런을 사용하는 것은 이 앙상블 모델들의 **기하 평균(geometric mean)** 예측을 근사하는 것이다.

## 실전 구현: MLP with Dropout

```python
import torch.nn as nn

class MLPWithDropout(nn.Module):
    def __init__(self, in_dim, hidden_dims, out_dim,
                 dropout_p=0.5):
        super().__init__()
        layers = []
        prev_dim = in_dim
        for h_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, h_dim),
                nn.BatchNorm1d(h_dim),
                nn.ReLU(),
                nn.Dropout(p=dropout_p),
            ])
            prev_dim = h_dim
        # 출력층에는 드롭아웃 적용하지 않음
        layers.append(nn.Linear(prev_dim, out_dim))
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)

model = MLPWithDropout(784, [512, 256, 128], 10, dropout_p=0.4)

# 훈련 루프
model.train()
optimizer = torch.optim.Adam(model.parameters())
criterion = nn.CrossEntropyLoss()

# 평가 루프 — model.eval() 필수!
model.eval()
with torch.no_grad():
    preds = model(X_test)
```

## Monte Carlo Dropout: 추론 시 불확실성 추정

드롭아웃을 추론 시에도 활성화하면 **베이지안 추론**의 근사로 사용할 수 있다. 동일한 입력에 여러 번 순전파하여 예측의 분산을 측정한다.

```python
def mc_dropout_predict(model, x, n_samples=50):
    model.train()  # 드롭아웃 활성화 (추론 시에도)
    preds = []
    with torch.no_grad():
        for _ in range(n_samples):
            preds.append(torch.softmax(model(x), dim=-1))
    preds = torch.stack(preds)  # (n_samples, B, C)
    mean = preds.mean(0)        # 평균 예측
    std  = preds.std(0)         # 불확실성 (표준편차)
    return mean, std

# 불확실성이 높은 샘플 탐지
mean_pred, uncertainty = mc_dropout_predict(model, X_test[:10])
print(f"예측 불확실성: {uncertainty.max(1).values}")
# 높은 값 → 모델이 확신하지 못하는 샘플
```

![드롭아웃 코드 구현](/assets/posts/nn-dropout-code.svg)

## 드롭아웃 변형들

```python
# Dropout2d: CNN에서 채널 단위로 비활성화
# (공간 전체 채널을 끔 — 특성 맵 단위 정규화)
conv_dropout = nn.Dropout2d(p=0.2)
feat_map = torch.randn(8, 64, 16, 16)  # (B, C, H, W)
out = conv_dropout(feat_map)

# DropPath (Stochastic Depth): 잔차 경로 단위로 끔
# — 샘플별로 전체 블록을 스킵 (ViT, DeiT에서 사용)
import torch

def drop_path(x, drop_prob, training):
    if not training or drop_prob == 0:
        return x
    keep = 1 - drop_prob
    shape = (x.shape[0],) + (1,) * (x.ndim - 1)
    mask = x.new_empty(shape).bernoulli_(keep) / keep
    return x * mask
```

## p 값 선택 가이드

| 적용 위치 | 권장 p | 이유 |
|---------|-------|------|
| FC 은닉층 (MLP) | 0.4~0.5 | 과적합 강하게 방지 |
| CNN 마지막 FC | 0.3~0.5 | 과적합 방지 |
| CNN 컨볼루션 후 | 0.1~0.2 | 낮게 (공간 의존성) |
| 트랜스포머 FFN | 0.1~0.2 | 너무 크면 성능 저하 |
| DropPath (ViT) | 0.0~0.2 | 모델 깊이에 따라 |
| 출력층 | 0 (적용 안 함) | 마지막 예측에 노이즈 금지 |

드롭아웃은 단순하고 효과적이지만, 배치 정규화와 함께 사용할 때 주의가 필요하다. 둘 다 훈련/추론 모드에 따라 다르게 동작하므로 반드시 `model.train()`과 `model.eval()`을 적절히 전환해야 한다.

---

**지난 글:** [레이어 정규화: 트랜스포머가 선택한 정규화](/posts/nn-layer-normalization/)

**다음 글:** [기울기 소실과 폭발: 깊은 네트워크의 고질적 문제](/posts/nn-vanishing-gradient/)

<br>
읽어주셔서 감사합니다. 😊
