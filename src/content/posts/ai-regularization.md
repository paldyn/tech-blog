---
title: "정규화: 과적합을 막는 AI의 방패"
description: "L1·L2 정규화, 드롭아웃, 배치 정규화, 레이어 정규화까지 주요 정규화 기법의 원리와 PyTorch 구현을 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 13
type: "knowledge"
category: "AI"
tags: ["정규화", "Regularization", "드롭아웃", "배치정규화", "과적합"]
featured: false
draft: false
---

[지난 글](/posts/ai-loss-functions/)에서 손실 함수가 모델의 학습 목표를 정의한다고 배웠다. 이번에는 모델이 훈련 데이터에만 지나치게 최적화되는 **과적합(Overfitting)**을 방지하는 다양한 **정규화(Regularization)** 기법을 다룬다. 과적합은 딥러닝에서 가장 흔한 문제이며, 이를 해결하지 않으면 실제 환경에서 모델 성능이 크게 저하된다.

## 편향-분산 트레이드오프

정규화를 이해하려면 먼저 **편향-분산 트레이드오프(Bias-Variance Tradeoff)**를 알아야 한다.

- **과소적합(Underfitting)**: 모델이 너무 단순해서 훈련 데이터조차 잘 학습하지 못하는 상태. 높은 편향(Bias), 낮은 분산(Variance). 해결책: 모델 복잡도 증가, 더 많은 특성.
- **과적합(Overfitting)**: 모델이 훈련 데이터의 잡음까지 암기해 새 데이터에서 성능이 떨어지는 상태. 낮은 편향, 높은 분산. 해결책: 정규화.
- **적절한 적합**: 훈련 성능과 검증 성능이 비슷하게 높은 이상적인 상태.

```python
import torch
from sklearn.model_selection import train_test_split

# 과적합 감지: 훈련 손실은 줄지만 검증 손실이 증가
def train_epoch(model, loader, optimizer, criterion, train=True):
    model.train() if train else model.eval()
    total_loss = 0
    with torch.set_grad_enabled(train):
        for X, y in loader:
            if train:
                optimizer.zero_grad()
            out = model(X)
            loss = criterion(out, y)
            if train:
                loss.backward()
                optimizer.step()
            total_loss += loss.item()
    return total_loss / len(loader)

# 훈련 손실 < 검증 손실 & 차이 증가 → 과적합 신호
# 해결: 아래 정규화 기법 적용
```

## L2 정규화 (Weight Decay)

가장 기본적인 정규화. 손실 함수에 파라미터의 제곱 합을 패널티로 추가한다.

```
L_total = L + λ·Σ wᵢ²
```

큰 가중치에 페널티를 부여해 모든 가중치를 0에 가깝게 유지한다. 가중치가 작으면 모델이 특정 특성에 과도하게 의존하지 않아 일반화가 좋아진다.

```python
import torch.optim as optim

# AdamW의 weight_decay가 곧 L2 정규화
optimizer = optim.AdamW(
    model.parameters(),
    lr=3e-4,
    weight_decay=1e-2   # λ 값 (보통 1e-4 ~ 1e-2)
)

# 단, Bias와 LayerNorm은 L2 정규화 제외가 관례
no_decay  = ['bias', 'LayerNorm.weight', 'layernorm.weight']
params_wd = [
    {'params': [p for n, p in model.named_parameters()
                if not any(nd in n for nd in no_decay)],
     'weight_decay': 1e-2},
    {'params': [p for n, p in model.named_parameters()
                if any(nd in n for nd in no_decay)],
     'weight_decay': 0.0},
]
optimizer = optim.AdamW(params_wd, lr=3e-4)
```

## 드롭아웃 (Dropout)

2014년 Srivastava 등이 제안. 학습 중 무작위로 뉴런을 비활성화해 특정 뉴런에 과의존하는 것을 방지한다.

```python
import torch.nn as nn

# 완전 연결 네트워크에서 드롭아웃
class MLPWithDropout(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim, dropout=0.5):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(p=dropout),       # 50% 뉴런 무작위 비활성화
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(p=dropout),
            nn.Linear(hidden_dim, output_dim)
        )
    
    def forward(self, x):
        return self.net(x)

model = MLPWithDropout(784, 512, 10, dropout=0.5)

# 핵심: 학습/추론 모드 전환 필수!
model.train()   # 드롭아웃 활성화
output = model(x_train)

model.eval()    # 드롭아웃 비활성화 (추론 시)
with torch.no_grad():
    output = model(x_test)
```

드롭아웃의 직관: 학습 때 매번 다른 서브네트워크를 훈련하는 앙상블 효과를 낸다. 추론 시에는 모든 뉴런을 사용하되 드롭 확률만큼 출력을 스케일한다.

- 완전 연결층: `p=0.5` 전통적 기본값
- 트랜스포머/CNN: `p=0.1` (더 낮은 값)
- 출력층 직전에는 드롭아웃 사용 금지

## 배치 정규화 (Batch Normalization)

2015년 Ioffe와 Szegedy가 제안. 각 미니배치에서 활성화 값을 정규화해 **Internal Covariate Shift**를 줄인다.

```python
# BatchNorm: 미니배치 평균·분산으로 정규화 후 학습 가능한 γ, β로 스케일
model = nn.Sequential(
    nn.Linear(256, 128),
    nn.BatchNorm1d(128),   # 배치 차원에서 정규화
    nn.ReLU(),
    nn.Linear(128, 10)
)

# CNN에서
conv_model = nn.Sequential(
    nn.Conv2d(3, 64, 3, padding=1),
    nn.BatchNorm2d(64),    # 채널 차원 유지, H×W에서 정규화
    nn.ReLU()
)

# 주의: BatchNorm은 배치 크기에 의존 → 배치=1이면 비정상 동작
# 해결: GroupNorm 또는 LayerNorm 사용
```

배치 정규화의 효과:
1. **더 높은 학습률** 가능 — 그래디언트 폭발/소실 방지
2. **정규화 효과** — 드롭아웃 없이도 과적합 억제
3. **가중치 초기화 민감도 감소**

![과적합 vs 과소적합 vs 적절한 적합](/assets/posts/ai-regularization-overfitting.svg)

## 레이어 정규화 (Layer Normalization)

트랜스포머와 LLM의 표준. BatchNorm이 배치 차원에서 정규화하는 것과 달리, **각 샘플 내 특성 차원에서** 정규화한다.

```python
# LayerNorm: 각 토큰/샘플의 특성 차원에서 정규화
# 배치 크기에 독립적 → 시퀀스 처리와 LLM에 적합
class TransformerBlock(nn.Module):
    def __init__(self, d_model, n_heads, dropout=0.1):
        super().__init__()
        self.attn    = nn.MultiheadAttention(d_model, n_heads)
        self.ff      = nn.Sequential(
            nn.Linear(d_model, 4*d_model),
            nn.GELU(),
            nn.Linear(4*d_model, d_model)
        )
        self.norm1   = nn.LayerNorm(d_model)  # Attention 후 정규화
        self.norm2   = nn.LayerNorm(d_model)  # FFN 후 정규화
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x):
        # Pre-LayerNorm 패턴 (GPT-2 이후 표준)
        attn_out, _ = self.attn(self.norm1(x), self.norm1(x), self.norm1(x))
        x = x + self.dropout(attn_out)
        x = x + self.dropout(self.ff(self.norm2(x)))
        return x
```

| 정규화 방법 | 정규화 차원 | 주 사용처 |
|-----------|-----------|---------|
| BatchNorm | 배치 차원 | CNN, MLP |
| LayerNorm | 특성 차원 | Transformer, LLM |
| GroupNorm | 채널 그룹 | 소배치 CNN |
| RMSNorm | 특성 차원 (평균 없음) | LLaMA, Mistral |

## 조기 종료 (Early Stopping)

가장 간단한 정규화 기법. 검증 손실이 개선되지 않으면 학습을 멈춘다.

```python
best_val_loss = float('inf')
patience = 5       # 5 에폭 연속 개선 없으면 중단
no_improve = 0

for epoch in range(1000):
    train_loss = train_epoch(model, train_loader, optimizer, criterion)
    val_loss   = evaluate(model, val_loader, criterion)
    
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        torch.save(model.state_dict(), 'best_model.pt')  # 최적 모델 저장
        no_improve = 0
    else:
        no_improve += 1
    
    if no_improve >= patience:
        print(f"Early stopping at epoch {epoch}")
        model.load_state_dict(torch.load('best_model.pt'))  # 최적 복원
        break
```

![L1·L2 정규화와 드롭아웃 구현](/assets/posts/ai-regularization-l1l2.svg)

## 데이터 증강 (Data Augmentation)

가장 효과적인 정규화 방법 중 하나. 기존 데이터를 변환해 학습 데이터를 늘린다.

```python
from torchvision import transforms

# 이미지 데이터 증강
train_transform = transforms.Compose([
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(degrees=15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.RandomCrop(224, padding=28),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# NLP 데이터 증강: 동의어 교체, 역번역, 랜덤 삽입/삭제
# LLM 파인튜닝: 합성 데이터 생성 (Teacher-Student)
```

정규화 기법들은 서로 보완적이다. 실제 LLM 학습에서는 LayerNorm + Dropout + AdamW weight decay + 데이터 증강(합성 데이터) + 조기 종료를 조합해서 사용한다.

---

**지난 글:** [손실 함수 완전 정복: 무엇을 최소화하는가](/posts/ai-loss-functions/)

**다음 글:** [지도학습 vs 비지도학습: 머신러닝의 두 패러다임](/posts/ml-supervised-vs-unsupervised/)

<br>
읽어주셔서 감사합니다. 😊
