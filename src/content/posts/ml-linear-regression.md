---
title: "선형 회귀: 예측 모델의 출발점"
description: "최소 제곱법, 경사 하강법, 다중 선형 회귀, Ridge/Lasso 정규화까지 선형 회귀의 수학적 원리를 scikit-learn과 PyTorch 코드로 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["선형회귀", "LinearRegression", "최소제곱법", "Ridge", "Lasso", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-supervised-vs-unsupervised/)에서 지도 학습의 개념을 살펴봤다. 이번에는 지도 학습의 가장 기본적인 알고리즘인 **선형 회귀(Linear Regression)**를 다룬다. 1800년대 Legendre와 Gauss가 천문학 문제를 풀기 위해 개발한 이 방법은, 200년이 지난 지금도 실무에서 가장 먼저 시도해야 할 베이스라인 모델이다. 단순하지만 해석 가능성이 높고, 신경망의 선형 레이어도 결국 이 연산이다.

## 선형 회귀란

입력 변수 X와 출력 변수 y 사이에 **선형 관계**가 있다고 가정하고, 그 관계를 나타내는 직선(또는 초평면)을 찾는 알고리즘이다.

```
단순 선형 회귀: ŷ = w·x + b
다중 선형 회귀: ŷ = w₁x₁ + w₂x₂ + ... + wₙxₙ + b
행렬 형태:      ŷ = Xw + b
```

- **w (가중치/계수)**: 각 특성이 y에 미치는 영향
- **b (편향/절편)**: x=0일 때의 y 값
- **ŷ**: 예측값 (실제값 y와 구분)

목표: 예측값 ŷ와 실제값 y의 차이(잔차)를 최소화하는 w, b를 찾는다.

## 손실 함수와 최소 제곱법

선형 회귀의 손실 함수는 **평균 제곱 오차(MSE)**다.

```python
import numpy as np
from sklearn.datasets import make_regression
from sklearn.model_selection import train_test_split

# 회귀 데이터 생성: y = 3x₁ + 2x₂ + noise
X, y = make_regression(n_samples=200, n_features=2, noise=10, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# MSE 손실 = (1/n) Σ (ŷᵢ - yᵢ)²
def mse_loss(w, b, X, y):
    y_hat = X @ w + b
    return np.mean((y_hat - y) ** 2)

# 수동 그래디언트 계산
def compute_gradients(w, b, X, y):
    n = len(y)
    y_hat = X @ w + b
    residual = y_hat - y
    dw = (2/n) * X.T @ residual   # ∂MSE/∂w
    db = (2/n) * np.mean(residual) # ∂MSE/∂b
    return dw, db
```

MSE를 w에 대해 미분하고 0으로 놓으면 **해석적 해(Closed-form Solution)**를 구할 수 있다.

```python
# 최소 제곱법 (Ordinary Least Squares, OLS)
# w* = (XᵀX)⁻¹ Xᵀy
# numpy를 이용한 직접 계산

X_aug = np.column_stack([X_train, np.ones(len(X_train))])  # 편향 추가
w_ols = np.linalg.lstsq(X_aug, y_train, rcond=None)[0]    # 안정적인 OLS
print(f"OLS 해: w={w_ols[:-1]}, b={w_ols[-1]:.3f}")

# 주의: (XᵀX)⁻¹은 특성이 많으면 계산 비쌈 (O(n³)) → 대규모에서는 GD 선호
```

## scikit-learn으로 빠르게 구현

```python
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import numpy as np

# 특성 스케일링 (선형 회귀에 권장)
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

# 1. 기본 선형 회귀
lr = LinearRegression()
lr.fit(X_train_s, y_train)
pred_lr = lr.predict(X_test_s)

print(f"Linear:  R²={r2_score(y_test, pred_lr):.4f}, RMSE={mean_squared_error(y_test, pred_lr)**0.5:.2f}")
print(f"계수: {lr.coef_}, 절편: {lr.intercept_:.3f}")

# 2. Ridge (L2 정규화): 다중공선성 문제 해결
ridge = Ridge(alpha=1.0)
ridge.fit(X_train_s, y_train)
pred_ridge = ridge.predict(X_test_s)
print(f"Ridge:   R²={r2_score(y_test, pred_ridge):.4f}")

# 3. Lasso (L1 정규화): 특성 선택 효과 (일부 계수 → 0)
lasso = Lasso(alpha=0.1, max_iter=5000)
lasso.fit(X_train_s, y_train)
pred_lasso = lasso.predict(X_test_s)
print(f"Lasso:   R²={r2_score(y_test, pred_lasso):.4f}")
print(f"0인 계수 수: {(lasso.coef_ == 0).sum()}")  # 특성 선택 확인
```

![선형 회귀: 최소 제곱법과 경사 하강법](/assets/posts/ml-linear-regression-fit.svg)

## PyTorch로 처음부터 구현

신경망도 결국 선형 레이어들의 조합이다. PyTorch로 선형 회귀를 구현하면 신경망 학습의 기본 구조를 이해할 수 있다.

```python
import torch
import torch.nn as nn
import torch.optim as optim

# 데이터를 텐서로 변환
X_t = torch.FloatTensor(X_train_s)
y_t = torch.FloatTensor(y_train).unsqueeze(1)

# 모델 정의: y = w₁x₁ + w₂x₂ + b
model = nn.Linear(in_features=2, out_features=1)
criterion = nn.MSELoss()
optimizer = optim.SGD(model.parameters(), lr=0.01)

# 학습 루프
for epoch in range(1000):
    model.train()
    optimizer.zero_grad()
    
    pred = model(X_t)
    loss = criterion(pred, y_t)
    loss.backward()
    optimizer.step()
    
    if epoch % 200 == 0:
        print(f"Epoch {epoch:4d}: Loss={loss.item():.4f}")

# 학습된 파라미터 확인
print(f"\n학습된 가중치: {model.weight.data}")
print(f"학습된 편향: {model.bias.data}")
```

## 다항 회귀: 비선형 관계 처리

특성을 변환해 선형 모델로 비선형 관계를 학습할 수 있다.

```python
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import Pipeline

# y ≈ x² + 2x + 1 같은 비선형 관계 모델링
poly_model = Pipeline([
    ('poly', PolynomialFeatures(degree=2, include_bias=False)),
    ('scaler', StandardScaler()),
    ('lr', LinearRegression())
])

# 단변수 데이터 예시
X_1d = np.array([1, 2, 3, 4, 5, 6, 7, 8]).reshape(-1, 1)
y_1d = np.array([1.2, 5.1, 9.8, 17.0, 25.1, 36.2, 49.0, 64.1])

poly_model.fit(X_1d, y_1d)
print(f"다항 회귀 R²: {poly_model.score(X_1d, y_1d):.4f}")  # ≈ 0.9998
# degree=2 특성: [x, x²] → 실제 관계 포착
```

## 평가 지표

```python
from sklearn.metrics import mean_absolute_error

pred = model_eval(X_test_s)  # 임의 모델 예측

mse  = mean_squared_error(y_test, pred)
rmse = mse ** 0.5
mae  = mean_absolute_error(y_test, pred)
r2   = r2_score(y_test, pred)

print(f"MSE:  {mse:.2f}  (평균 제곱 오차)")
print(f"RMSE: {rmse:.2f}  (원래 단위와 같음 → 해석 용이)")
print(f"MAE:  {mae:.2f}  (이상치에 덜 민감)")
print(f"R²:   {r2:.4f}  (0~1, 높을수록 좋음)")
# R² = 1 - Σ(y-ŷ)² / Σ(y-ȳ)²
# "모델이 y 분산의 몇 %를 설명하는가"
```

![선형 회귀 scikit-learn / PyTorch 구현](/assets/posts/ml-linear-regression-formula.svg)

## 언제 선형 회귀를 쓸까

선형 회귀는 여전히 실무에서 첫 번째로 시도해야 할 알고리즘이다.

**써야 할 때**:
- 빠른 베이스라인이 필요할 때
- 계수의 해석이 중요할 때 (의학, 경제 연구)
- 데이터가 선형 관계를 따를 때
- 특성이 많고 샘플이 적을 때 (Ridge/Lasso)

**다른 방법이 필요할 때**:
- 명확히 비선형 관계 → 랜덤 포레스트, XGBoost, 신경망
- 이미지, 텍스트 → CNN, Transformer
- 극도로 복잡한 패턴 → 딥러닝

선형 회귀가 잘 안 된다면, 그것 자체가 중요한 정보다. 데이터가 선형이 아니거나, 특성 엔지니어링이 필요하다는 신호다.

---

**지난 글:** [지도학습 vs 비지도학습: 머신러닝의 두 패러다임](/posts/ml-supervised-vs-unsupervised/)

**다음 글:** [로지스틱 회귀: 분류 문제의 첫 걸음](/posts/ml-logistic-regression/)

<br>
읽어주셔서 감사합니다. 😊
