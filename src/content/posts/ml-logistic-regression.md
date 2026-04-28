---
title: "로지스틱 회귀: 분류 문제의 첫 걸음"
description: "시그모이드 함수, BCE 손실, 결정 경계, 소프트맥스 다중 분류까지 로지스틱 회귀의 원리와 scikit-learn·PyTorch 구현을 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["로지스틱회귀", "LogisticRegression", "시그모이드", "분류", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-linear-regression/)에서 선형 회귀가 연속값 예측 문제를 풀었다. 이번에는 **분류 문제**를 다루는 **로지스틱 회귀(Logistic Regression)**를 살펴본다. 이름에 "회귀"가 붙었지만 분류 알고리즘이다. 선형 회귀의 출력을 시그모이드 함수로 변환해 확률로 만드는 것이 핵심 아이디어다.

## 왜 선형 회귀로 분류하면 안 될까

선형 회귀로 이진 분류(y=0 또는 1)를 시도하면 두 가지 문제가 생긴다.

1. **출력 범위 문제**: 선형 회귀 출력 `ŷ = wx + b`는 (-∞, +∞)인데, 확률은 [0, 1]이어야 한다.
2. **손실 함수 문제**: MSE가 분류에서 비볼록(non-convex)해져 여러 지역 최솟값이 생긴다.

로지스틱 회귀는 시그모이드 함수로 이 두 문제를 동시에 해결한다.

## 시그모이드: 실수를 확률로

**시그모이드 함수**는 어떤 실수값도 (0, 1) 범위로 압축한다.

```
σ(z) = 1 / (1 + e⁻ᶻ)
```

- z → -∞ : σ → 0
- z = 0   : σ = 0.5
- z → +∞  : σ → 1

```python
import numpy as np
import torch
import torch.nn as nn

# 시그모이드 직접 구현
def sigmoid(z):
    return 1 / (1 + np.exp(-z))

z_values = np.array([-6, -3, -1, 0, 1, 3, 6])
probs    = sigmoid(z_values)
for z, p in zip(z_values, probs):
    bar = "█" * int(p * 20)
    print(f"z={z:3d}: σ={p:.4f}  {bar}")
# z=-6: σ=0.0025  
# z= 0: σ=0.5000  ██████████
# z=+6: σ=0.9975  ████████████████████

# PyTorch: nn.Sigmoid() 또는 torch.sigmoid()
z_t = torch.tensor([-6.0, 0.0, 6.0])
print(torch.sigmoid(z_t))  # tensor([0.0025, 0.5000, 0.9975])
```

## 로지스틱 회귀 모델

```
z = w₁x₁ + w₂x₂ + ... + wₙxₙ + b   (선형 결합)
ŷ = σ(z) = P(y=1|x)                  (확률 출력)
```

결정 경계: ŷ ≥ 0.5 → class 1, ŷ < 0.5 → class 0. 이는 z ≥ 0이 class 1과 동치다.

```python
from sklearn.linear_model import LogisticRegression
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report

# 유방암 데이터 (이진 분류)
X, y = load_breast_cancer(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 스케일링 필수 (특성 범위 차이 큼)
scaler  = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test  = scaler.transform(X_test)

# 로지스틱 회귀 학습
clf = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
clf.fit(X_train, y_train)

# 평가
y_pred  = clf.predict(X_test)
y_proba = clf.predict_proba(X_test)[:, 1]  # P(y=1) 확률
print(classification_report(y_test, y_pred))

# 결정 경계 임계값 조정 (기본 0.5)
threshold = 0.3  # 재현율 중시 → 임계값 낮춤
y_pred_adj = (y_proba >= threshold).astype(int)
print(classification_report(y_test, y_pred_adj))
```

## 손실 함수: Binary Cross-Entropy

로지스틱 회귀의 손실 함수는 MSE가 아닌 **BCE(Binary Cross-Entropy)**다.

```
L = -[y·log(ŷ) + (1-y)·log(1-ŷ)]
```

- y=1, ŷ→1: 손실 → 0 (정확한 예측)
- y=1, ŷ→0: 손실 → ∞ (완전히 틀린 예측)
- BCE를 최소화 = MLE (최대 우도 추정) 수행

```python
import torch
import torch.nn as nn
import torch.optim as optim

# PyTorch로 처음부터 구현
class LogisticRegressionPyTorch(nn.Module):
    def __init__(self, input_dim):
        super().__init__()
        self.linear = nn.Linear(input_dim, 1)  # wx + b
    
    def forward(self, x):
        return self.linear(x)  # logit 반환 (sigmoid 없음)

model = LogisticRegressionPyTorch(input_dim=X_train.shape[1])

# BCEWithLogitsLoss = sigmoid + BCE (수치적으로 더 안정)
criterion = nn.BCEWithLogitsLoss()
optimizer = optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

X_t = torch.FloatTensor(X_train)
y_t = torch.FloatTensor(y_train).unsqueeze(1)

for epoch in range(200):
    model.train()
    optimizer.zero_grad()
    logits = model(X_t)
    loss   = criterion(logits, y_t)
    loss.backward()
    optimizer.step()

# 추론: sigmoid로 확률 변환
model.eval()
with torch.no_grad():
    logits  = model(torch.FloatTensor(X_test))
    probs   = torch.sigmoid(logits).squeeze().numpy()
    preds   = (probs >= 0.5).astype(int)
```

![로지스틱 회귀: 시그모이드와 결정 경계](/assets/posts/ml-logistic-regression-sigmoid.svg)

## 다중 분류: Softmax

클래스가 3개 이상이면 **소프트맥스(Softmax)**를 사용한다.

```python
# Softmax: P(class=k) = e^zₖ / Σⱼ e^zⱼ
# 모든 클래스 확률의 합 = 1

from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression

X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# multi_class='auto' → 3클래스에서 softmax 자동 사용
clf_mc = LogisticRegression(multi_class='auto', solver='lbfgs', max_iter=500)
clf_mc.fit(X_train, y_train)

# 각 클래스의 확률
proba = clf_mc.predict_proba(X_test[:5])
print("클래스별 확률 (행 합=1):")
for row in proba:
    print([f"{p:.3f}" for p in row])

# PyTorch: CrossEntropyLoss = Softmax + Log + NLL
criterion = nn.CrossEntropyLoss()  # 내부에 Softmax 포함
# 마지막 레이어는 Softmax 없이 logit 출력
model_mc = nn.Linear(4, 3)  # 3 클래스
logits   = model_mc(torch.FloatTensor(X_train))
loss     = criterion(logits, torch.LongTensor(y_train))
```

## 규제화와 클래스 불균형

```python
# C 파라미터: 정규화 역강도 (C=1/λ)
# C 작을수록 강한 규제 → 더 단순한 모델
for C in [0.01, 0.1, 1.0, 10.0]:
    clf = LogisticRegression(C=C, max_iter=500)
    clf.fit(X_train, y_train)
    acc = clf.score(X_test, y_test)
    print(f"C={C:.2f}: 검증 정확도 = {acc:.4f}")

# 클래스 불균형 대응
clf_balanced = LogisticRegression(
    class_weight='balanced',   # 소수 클래스에 자동 가중치
    C=1.0, max_iter=500
)
clf_balanced.fit(X_train, y_train)
# 또는 수동: class_weight={0: 1, 1: 10}
```

![로지스틱 회귀 구현 및 다중 분류](/assets/posts/ml-logistic-regression-boundary.svg)

## 로지스틱 회귀의 장점과 한계

**장점**:
- 확률 출력 → 해석 용이, 불확실성 정량화
- 학습 빠름, 특성 중요도 파악 가능 (계수 크기)
- 작은 데이터에서 과적합 적음
- 딥러닝의 출력 레이어로 그대로 사용

**한계**:
- 결정 경계가 선형 → 비선형 문제에 약함
- 특성 간 상호작용 자동 학습 불가
- 이미지, 텍스트 같은 고차원 비정형 데이터에 직접 적용 어려움

로지스틱 회귀는 딥러닝의 마지막 레이어(분류 헤드)와 수학적으로 동일하다. 따라서 이 알고리즘을 이해하면 신경망의 출력 레이어도 자연스럽게 이해된다.

---

**지난 글:** [선형 회귀: 예측 모델의 출발점](/posts/ml-linear-regression/)

**다음 글:** [K-최근접 이웃(KNN): 가장 직관적인 분류 알고리즘](/posts/ml-knn/)

<br>
읽어주셔서 감사합니다. 😊
