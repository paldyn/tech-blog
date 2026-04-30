---
title: "회귀 모델 평가 지표: MAE·MSE·RMSE·R² 완전 이해"
description: "MAE·MSE·RMSE·MAPE·R²의 공식·특성·적용 조건, 이상치 민감도 비교, Adjusted R²·Huber 손실, 잔차 분석으로 모델 진단하는 방법을 실전 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["회귀평가", "MAE", "RMSE", "R2", "모델평가"]
featured: false
draft: false
---

[지난 글](/posts/ml-roc-auc/)에서 분류 모델의 임계값 독립적 평가 방법을 배웠다. 이번에는 분류와 다른 방식으로 성능을 측정해야 하는 **회귀(Regression)** 모델의 평가 지표로 넘어간다. 회귀 모델이 예측한 값이 실제 값과 얼마나 가까운지를 다양한 방법으로 정량화한다.

## 오차의 다섯 가지 측정 방법

회귀 오차 `e_i = y_i - ŷ_i`를 집계하는 방식에 따라 지표가 달라진다.

![회귀 평가 지표 비교](/assets/posts/ml-regression-metrics-overview.svg)

각 지표는 서로 다른 질문에 답한다. **MAE**는 "평균적으로 얼마나 틀렸나?", **RMSE**는 "큰 오차를 강조하면 얼마나 틀렸나?", **MAPE**는 "비율로는 얼마나 틀렸나?", **R²**는 "모델이 데이터의 변동을 얼마나 설명하나?"를 묻는다.

## MAE: 직관적이고 강건한 지표

**MAE(Mean Absolute Error)**는 오차의 절댓값 평균이다.

```
MAE = (1/n) Σ|y_i - ŷ_i|
```

원래 타겟 변수와 같은 단위를 가지므로 해석이 직관적이다. 주택 가격 예측에서 MAE=200만이면 "평균적으로 200만 원 오차"라는 뜻이다. 이상치(매우 큰 오차)가 있어도 제곱이 아닌 절댓값을 사용하기 때문에 지나치게 큰 패널티를 주지 않아 **이상치에 강건**하다.

단점은 절댓값 함수가 0에서 미분 불가능해 경사 하강법에 바로 사용하기 어렵다는 것이다. 이때는 Huber 손실(아래 참고)을 대신 사용한다.

## MSE와 RMSE: 큰 오차에 더 큰 패널티

**MSE(Mean Squared Error)**는 오차를 제곱해 평균 낸다.

```
MSE = (1/n) Σ(y_i - ŷ_i)²
```

제곱 덕분에 미분이 쉬워 대부분의 회귀 알고리즘이 손실 함수로 사용한다. 하지만 제곱하면 원래 단위와 달라지고 이상치에 극도로 민감해진다.

**RMSE(Root MSE)**는 MSE에 제곱근을 취해 원래 단위로 돌려놓은 것이다. MAE보다 이상치에 더 민감하면서도 단위가 직관적이라 가장 널리 사용되는 회귀 지표다.

RMSE ≥ MAE 는 항상 성립한다. 둘의 차이가 클수록 이상치(큰 오차)가 많다는 신호다.

```python
import numpy as np
from sklearn.metrics import (mean_absolute_error,
                              mean_squared_error, r2_score,
                              mean_absolute_percentage_error)
from sklearn.datasets import fetch_california_housing
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# 캘리포니아 주택 가격 데이터
X, y = fetch_california_housing(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42)

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('gbm',    GradientBoostingRegressor(n_estimators=200,
               random_state=42))
])
pipe.fit(X_train, y_train)
y_pred = pipe.predict(X_test)

mae  = mean_absolute_error(y_test, y_pred)
mse  = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
mape = mean_absolute_percentage_error(y_test, y_pred) * 100
r2   = r2_score(y_test, y_pred)

print(f"MAE:  {mae:.4f}")    # 단위: 10만 달러
print(f"RMSE: {rmse:.4f}")
print(f"MAPE: {mape:.2f}%")
print(f"R²:   {r2:.4f}")
print(f"RMSE/MAE 비율: {rmse/mae:.2f}")  # 1에 가까울수록 이상치 적음
```

![회귀 지표 코드](/assets/posts/ml-regression-metrics-code.svg)

## MAPE: 단위 독립적 비율 오차

**MAPE**는 오차를 실제 값의 비율로 표현한다.

```
MAPE = (100/n) Σ|y_i - ŷ_i| / |y_i|  (%)
```

MAPE의 장점은 단위가 없어 서로 다른 규모의 데이터나 다른 모델 간 비교가 쉽다는 것이다. 주택 가격과 자동차 가격 모두 "12% 오차"라고 비교할 수 있다. 단점은 `y_i ≈ 0`인 샘플이 있으면 값이 무한대로 발산하고, 음수 타겟 값에서는 의미가 없다는 것이다.

## R²: 모델이 설명하는 분산의 비율

**R²(결정 계수)**는 모델이 데이터의 전체 변동(분산)을 얼마나 설명하는지를 0~1 사이로 표현한다.

```
SS_res = Σ(y_i - ŷ_i)²   # 잔차 제곱합
SS_tot = Σ(y_i - ȳ)²      # 전체 분산
R² = 1 - SS_res / SS_tot
```

R²=0.80이면 모델이 타겟 변동의 80%를 설명한다는 뜻이다. 기준 모델(모든 예측을 평균으로 하는 모델)은 R²=0이고, 완벽한 예측은 R²=1이다. 음수도 가능한데, 이는 평균으로 예측하는 것보다 성능이 나쁜 경우다.

```python
# Adjusted R²: 특성 수에 패널티
n = len(y_test)
p = X_test.shape[1]  # 특성 수
r2_adj = 1 - (1 - r2) * (n - 1) / (n - p - 1)
print(f"R²:      {r2:.4f}")
print(f"Adj R²:  {r2_adj:.4f}")
# 특성이 많을수록 R² > Adj R²
# 과적합된 경우 둘의 차이가 커짐
```

R²는 절대적 기준이 없다. 주택 가격처럼 변동성이 큰 데이터는 R²=0.85도 우수하고, 온도 예측처럼 단순한 문제는 R²=0.99를 기대할 수 있다.

## 잔차 분석: 지표 너머의 진단

숫자 지표만으로는 모델의 체계적 오류를 발견하기 어렵다. **잔차(Residual) 분석**으로 더 깊이 진단한다.

```python
import numpy as np

residuals = y_test - y_pred

# 1. 잔차의 기술 통계
print(f"잔차 평균: {residuals.mean():.4f}")   # ≈0이어야 정상
print(f"잔차 표준편차: {residuals.std():.4f}")
print(f"최대 과소예측: {residuals.min():.4f}")
print(f"최대 과대예측: {residuals.max():.4f}")

# 2. 이상치 개수 (잔차 > 3σ)
sigma = residuals.std()
outlier_count = np.sum(np.abs(residuals) > 3 * sigma)
print(f"이상치 (>3σ): {outlier_count}개 "
      f"({100*outlier_count/len(residuals):.1f}%)")

# 3. 정규성 검정 (잔차가 정규분포인지)
from scipy import stats
stat, pvalue = stats.shapiro(residuals[:500])  # 최대 5000개
print(f"Shapiro-Wilk p-value: {pvalue:.4f}")
# p > 0.05: 정규분포 가정 기각 불가
```

잔차가 평균 0에 가깝고, 예측값에 따른 패턴이 없으며, 정규분포에 가까울수록 좋은 모델이다. 잔차가 특정 범위에서 한쪽으로 치우치면 모델이 그 구간의 패턴을 제대로 포착하지 못하고 있다는 신호다.

## Huber 손실: MAE와 MSE의 장점 결합

이상치가 있을 때 손실 함수로 MSE를 그대로 사용하면 모델이 이상치를 과도하게 따라가게 된다. **Huber 손실**은 오차가 작을 때는 MSE처럼, 클 때는 MAE처럼 동작해 두 지표의 장점을 결합한다.

```python
from sklearn.linear_model import HuberRegressor
from sklearn.metrics import mean_absolute_error

# Huber Regressor: 이상치에 강건한 회귀
huber = HuberRegressor(epsilon=1.35)  # epsilon: MAE/MSE 전환점
huber.fit(X_train, y_train)
y_pred_huber = huber.predict(X_test)

print(f"Huber MAE: {mean_absolute_error(y_test, y_pred_huber):.4f}")
# 이상치가 많을 때 일반 LinearRegression보다 MAE가 낮음
```

## 지표 선택 가이드

| 우선순위 | 지표 | 적합한 상황 |
|---------|------|-----------|
| 해석 용이성 | MAE | 비즈니스 보고, 이상치 있는 데이터 |
| 학습 안정성 | MSE/RMSE | 경사 하강법 손실, 큰 오차 페널티 중요 |
| 단위 독립 비교 | MAPE | 여러 데이터셋 또는 모델 간 비교 |
| 설명력 요약 | R² | 얼마나 잘 맞는지 직관적 소통 |

---

**지난 글:** [ROC 곡선과 AUC: 임계값 독립적 분류 성능 평가](/posts/ml-roc-auc/)

**다음 글:** [랭킹 모델 평가: NDCG·MAP·MRR 이해하기](/posts/ml-ranking-metrics/)

<br>
읽어주셔서 감사합니다. 😊
