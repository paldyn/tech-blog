---
title: "배치 정규화: 내부 공변량 이동을 잡아라"
description: "2015년 딥러닝 학습을 혁신한 배치 정규화(Batch Normalization)의 작동 원리, 수식, PyTorch 구현, 훈련/추론 모드 차이, 배치 크기의 영향, Pre-BN vs Post-BN 선택까지 실전 중심으로 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["배치정규화", "BatchNorm", "내부공변량이동", "딥러닝안정화", "정규화"]
featured: false
draft: false
---

[지난 글](/posts/nn-weight-init/)에서 가중치 초기화가 분산 유지에 중요하다는 것을 배웠다. 그러나 초기화를 아무리 잘해도 학습이 진행되면서 각 층의 입력 분포가 계속 변한다. 이 문제를 **내부 공변량 이동(Internal Covariate Shift)**이라 하고, 2015년 Ioffe와 Szegedy가 발표한 **배치 정규화(Batch Normalization, BN)**가 이를 해결했다. 배치 정규화는 딥러닝 학습을 획기적으로 안정화시켜 더 깊은 네트워크 학습을 가능하게 했다.

## 내부 공변량 이동이란

신경망을 학습할 때 파라미터가 업데이트되면, 이전 층의 출력 분포가 변한다. 다음 층 입장에서는 입력 분포가 계속 바뀌는 셈이다. 이것이 내부 공변량 이동이다.

```python
# 각 층의 활성값 분포 변화 확인
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(784, 256), nn.ReLU(),
    nn.Linear(256, 256), nn.ReLU(),
    nn.Linear(256, 256), nn.ReLU(),
)

x = torch.randn(64, 784)
activations = []

h = x
for i, layer in enumerate(model.children()):
    h = layer(h)
    if isinstance(layer, nn.ReLU):
        activations.append((h.mean().item(), h.std().item()))

for i, (mean, std) in enumerate(activations):
    print(f"Layer {i+1}: mean={mean:.3f}, std={std:.3f}")
# Layer 1: mean=0.315, std=0.412
# Layer 2: mean=0.201, std=0.289  ← 분포가 변화함
# Layer 3: mean=0.118, std=0.174  ← 계속 변화
```

층이 깊어질수록 분포가 점점 좁아지거나 달라진다. 이 때문에 학습률을 크게 설정하기 어렵고, 초기화에 매우 민감해진다.

## 배치 정규화의 수식

배치 정규화는 **미니배치 단위**로 각 특성(feature)을 정규화한다.

주어진 미니배치 B = {x₁, ..., x_B}에 대해:

1. **배치 평균**: μ_B = (1/B) Σxᵢ
2. **배치 분산**: σ²_B = (1/B) Σ(xᵢ − μ_B)²
3. **정규화**: x̂ᵢ = (xᵢ − μ_B) / √(σ²_B + ε)
4. **스케일·이동**: yᵢ = γ · x̂ᵢ + β

γ (gamma)와 β (beta)는 **학습 가능한 파라미터**다. 정규화 후 복원(re-scale)을 허용하여 표현력을 유지한다. 초기값은 γ=1, β=0.

![배치 정규화 프로세스](/assets/posts/nn-batch-normalization-process.svg)

## PyTorch 구현

```python
import torch
import torch.nn as nn

# 1D 데이터 (FC 레이어 후): BatchNorm1d
# 2D 이미지 (Conv 레이어 후): BatchNorm2d
class BNModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(784, 256),
            nn.BatchNorm1d(256),   # 256개 특성 정규화
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Linear(128, 10),
        )

    def forward(self, x):
        return self.layers(x)

model = BNModel()

# 배치 정규화 레이어의 파라미터 확인
bn = model.layers[1]
print(f"gamma shape: {bn.weight.shape}")  # torch.Size([256])
print(f"beta  shape: {bn.bias.shape}")    # torch.Size([256])
print(f"running_mean: {bn.running_mean[:3]}")  # 학습 중 누적
print(f"running_var:  {bn.running_var[:3]}")   # 학습 중 누적
```

## 훈련 vs 추론 모드: 핵심 차이

배치 정규화를 사용할 때 가장 많이 하는 실수가 훈련/추론 모드 전환을 빠뜨리는 것이다.

```python
# 훈련 모드: 배치 통계(μ_B, σ²_B) 사용
model.train()
output_train = model(x_batch)

# 추론 모드: 훈련 중 누적된 running 통계 사용
model.eval()
with torch.no_grad():
    output_eval = model(x_single)
# model.eval()을 빠뜨리면 단일 샘플 추론 시 분산=0이 되어 문제 발생

# Running statistics 업데이트 공식
# μ_run ← (1 - momentum) * μ_run + momentum * μ_batch
# 기본 momentum = 0.1 (PyTorch 기본값)
print(f"BN momentum: {bn.momentum}")  # 0.1
```

![배치 정규화 코드 구현](/assets/posts/nn-batch-normalization-code.svg)

## 배치 크기와 배치 정규화

배치 정규화는 배치 크기에 민감하다. 배치 크기가 작을수록 배치 통계의 분산이 커져 학습이 불안정해진다.

```python
# 배치 크기별 BN 동작 실험
for batch_size in [2, 8, 32, 128]:
    x = torch.randn(batch_size, 256)
    bn = nn.BatchNorm1d(256)
    bn.train()
    out = bn(x)
    print(f"B={batch_size:3d}: mean={out.mean():.4f},"
          f" std={out.std():.4f}")
    # B=2:   통계 불안정, std 편차 큼
    # B=128: 안정적, std ≈ 1.0

# 권장 배치 크기: 32 이상
# 배치 크기가 매우 작은 경우 → LayerNorm, GroupNorm 사용 권장
```

## Pre-BN vs Post-BN

배치 정규화를 어디에 배치할지에 대한 논쟁이 있다.

**Post-BN (원논문)**: Linear → BN → ReLU
- 전통적 방식
- 일반 MLP, CNN에서 많이 사용

**Pre-BN**: LayerNorm → Linear (트랜스포머에서 사용)
- 트랜스포머 논문의 수정 버전
- 학습 안정성이 더 좋음
- 잔차 연결(Residual Connection)과 함께 사용 시 더 효과적

```python
# Pre-BN 패턴 (트랜스포머 스타일)
class PreNormBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.norm = nn.LayerNorm(dim)
        self.ff = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.GELU(),
            nn.Linear(dim * 4, dim),
        )

    def forward(self, x):
        # 정규화 먼저, 그 다음 변환
        return x + self.ff(self.norm(x))  # 잔차 연결 포함
```

## 배치 정규화의 한계

배치 정규화가 강력하지만 모든 상황에 완벽한 것은 아니다. 배치 크기가 작을 때 통계가 불안정하고, 순서가 있는 시퀀스 데이터에서 배치 간 의존성 문제가 생긴다. 이러한 한계 때문에 다음 글에서 배울 **레이어 정규화(Layer Normalization)**가 등장한다. 특히 트랜스포머 기반 LLM은 대부분 레이어 정규화를 사용한다.

---

**지난 글:** [가중치 초기화: Xavier, He, 그리고 수렴의 비밀](/posts/nn-weight-init/)

**다음 글:** [레이어 정규화: 트랜스포머가 선택한 정규화](/posts/nn-layer-normalization/)

<br>
읽어주셔서 감사합니다. 😊
