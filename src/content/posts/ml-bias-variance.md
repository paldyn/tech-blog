---
title: "편향-분산 트레이드오프: 과소적합과 과대적합의 근본 원인"
description: "편향과 분산의 수학적 정의, 모델 복잡도와의 관계, 학습 곡선으로 진단하는 방법, 편향·분산을 각각 줄이는 실전 전략을 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["편향분산트레이드오프", "과소적합", "과대적합", "모델복잡도", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-cross-validation/)에서 교차 검증으로 더 안정적인 성능을 추정하는 방법을 살펴봤다. 이번에는 한 걸음 더 들어가, 왜 어떤 모델은 훈련에서는 완벽하지만 새 데이터에서 망가지고, 다른 모델은 훈련·검증 모두에서 성능이 낮은지 그 근본 원인을 살펴본다. **편향-분산 트레이드오프**는 머신러닝 이론 전체를 관통하는 핵심 개념이다.

## 기대 오차의 분해

머신러닝 모델의 기대 오차(Expected Error)는 세 가지 요소로 분해할 수 있다.

```
E[오차²] = 편향² + 분산 + 환원불가 오차(ε)
```

**편향(Bias)**은 모델이 데이터의 실제 패턴을 얼마나 잘못 가정하는지를 나타낸다. 비선형 관계를 선형 모델로 학습하면 아무리 많은 데이터가 있어도 일정 수준 이상으로 정확해지지 않는다. 이 "구조적 오류"가 편향이다.

**분산(Variance)**은 모델이 다른 훈련 데이터를 봤을 때 얼마나 다른 예측을 하는지를 나타낸다. 복잡한 모델은 훈련 데이터의 노이즈까지 학습하므로 훈련 세트가 조금만 달라져도 예측이 크게 흔들린다.

**환원불가 오차(Irreducible Error)**는 데이터 자체의 노이즈(측정 오류, 개인차 등)로, 어떤 모델을 써도 줄일 수 없다.

## 시각적 이해: 과녁 비유

편향과 분산을 직관적으로 이해하는 데 과녁 비유가 유용하다. 중앙이 정답, 각 점이 서로 다른 훈련 세트에서 만든 모델의 예측이라 하자.

- **낮은 편향 + 낮은 분산**: 점들이 중앙 근처에 모여 있음 (이상적)
- **높은 편향 + 낮은 분산**: 점들이 한쪽에 모여 있지만 중앙과 멀리 떨어짐 (과소적합)
- **낮은 편향 + 높은 분산**: 점들이 중앙 근처지만 넓게 퍼져 있음 (과대적합)
- **높은 편향 + 높은 분산**: 점들이 분산되고 중앙과 멀리 있음 (최악)

## 모델 복잡도와의 관계

![편향-분산 트레이드오프 곡선](/assets/posts/ml-bias-variance-tradeoff.svg)

모델 복잡도(파라미터 수, 트리 깊이, 다항식 차수 등)를 높이면 편향은 줄어들지만 분산은 커진다. 이 두 힘의 균형점에서 총 오차가 최소화된다. 이것이 트레이드오프의 본질이다.

단순한 선형 모델은 높은 편향(데이터의 비선형 패턴을 포착 못함)과 낮은 분산(데이터가 바뀌어도 비슷한 직선을 그림)을 갖는다. 반대로 깊은 의사결정 트리는 거의 모든 점을 정확히 예측(낮은 편향)하지만 훈련 데이터가 조금만 달라져도 완전히 다른 트리가 만들어진다(높은 분산).

## 실제 데이터로 확인하기

```python
import numpy as np
import matplotlib
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score

# 비선형 데이터 생성
np.random.seed(42)
X = np.linspace(0, 10, 200).reshape(-1, 1)
y = np.sin(X.ravel()) + np.random.randn(200) * 0.3

# 다항식 차수별 편향·분산 비교
for degree in [1, 3, 10, 20]:
    pipe = Pipeline([
        ('poly',  PolynomialFeatures(degree=degree)),
        ('model', LinearRegression())
    ])
    # 훈련 점수 vs 검증 점수로 편향·분산 진단
    train_scores = cross_val_score(pipe, X, y, cv=5,
                                   scoring='neg_mean_squared_error',
                                   return_train_score=False)
    # 참고: cross_validate로 train score 포함 계산
    from sklearn.model_selection import cross_validate
    cv_res = cross_validate(pipe, X, y, cv=5,
                            scoring='neg_mean_squared_error',
                            return_train_score=True)
    train_mse = -cv_res['train_score'].mean()
    val_mse   = -cv_res['test_score'].mean()
    gap = val_mse - train_mse

    print(f"Degree {degree:2d}: "
          f"Train MSE={train_mse:.4f}  "
          f"Val MSE={val_mse:.4f}  "
          f"Gap={gap:.4f}")
```

출력 예시:
```
Degree  1: Train MSE=0.4235  Val MSE=0.4260  Gap=0.0025  ← 高편향
Degree  3: Train MSE=0.0920  Val MSE=0.0985  Gap=0.0065  ← 균형
Degree 10: Train MSE=0.0112  Val MSE=0.1240  Gap=0.1128  ← 高분산
Degree 20: Train MSE=0.0041  Val MSE=0.5800  Gap=0.5759  ← 極高분산
```

차수 1(선형)은 훈련과 검증 모두 오차가 높고(고편향), 차수 20은 훈련 오차는 극히 낮지만 검증 오차가 폭발한다(고분산).

## 학습 곡선으로 진단하기

학습 곡선(Learning Curve)은 훈련 샘플 수를 늘려가면서 훈련·검증 점수 변화를 보여주는 도구다. 편향·분산 문제를 시각적으로 확인하는 가장 직접적인 방법이다.

```python
from sklearn.model_selection import learning_curve
import numpy as np

def diagnose_model(model, X, y):
    train_sizes, train_scores, val_scores = learning_curve(
        model, X, y,
        train_sizes=np.linspace(0.1, 1.0, 10),
        cv=5,
        scoring='neg_mean_squared_error',
        n_jobs=-1
    )
    train_mean = -train_scores.mean(axis=1)
    val_mean   = -val_scores.mean(axis=1)

    # 진단
    final_gap = val_mean[-1] - train_mean[-1]
    if train_mean[-1] > 0.2 and final_gap < 0.05:
        print("→ 高편향 (과소적합): 모델 복잡도를 높이거나 특성 추가")
    elif final_gap > 0.1:
        print("→ 高분산 (과대적합): 데이터 추가 또는 정규화 강화")
    else:
        print("→ 균형 상태: 배포 가능")

    return train_mean, val_mean, train_sizes
```

![과소적합 · 적정 적합 · 과대적합 비교](/assets/posts/ml-bias-variance-examples.svg)

**고편향 모델의 학습 곡선**: 훈련 오차와 검증 오차가 모두 높은 채로 수렴한다. 데이터를 더 추가해도 거의 개선되지 않는다.

**고분산 모델의 학습 곡선**: 훈련 오차는 낮지만 검증 오차가 훨씬 높다. 데이터를 추가하면 검증 오차가 점점 낮아지는 경향이 있다.

## 편향을 줄이는 전략

고편향(과소적합) 문제를 해결하려면 모델의 표현력을 키워야 한다.

```python
# 전략 1: 더 복잡한 모델 사용
from sklearn.ensemble import GradientBoostingRegressor
model_complex = GradientBoostingRegressor(
    n_estimators=200,
    max_depth=5,          # 트리 깊이 증가
    learning_rate=0.05
)

# 전략 2: 다항 특성 추가
from sklearn.preprocessing import PolynomialFeatures
poly = PolynomialFeatures(degree=3, include_bias=False)
X_poly = poly.fit_transform(X_train)

# 전략 3: 정규화 완화 (C 증가 = 패널티 감소)
from sklearn.svm import SVR
svr_less_reg = SVR(C=100)    # default C=1

# 전략 4: 새로운 피처 엔지니어링
# 데이터에 없는 패턴을 수동으로 추가
```

## 분산을 줄이는 전략

고분산(과대적합) 문제는 모델을 단순화하거나 데이터를 늘리거나 정규화를 강화한다.

```python
# 전략 1: 더 많은 훈련 데이터
# (항상 최선이지만 항상 가능하지 않음)

# 전략 2: 정규화 강화
from sklearn.linear_model import Ridge, Lasso

ridge = Ridge(alpha=10)    # alpha 증가 = 정규화 강화
lasso = Lasso(alpha=0.1)

# 전략 3: 앙상블 (배깅)
from sklearn.ensemble import RandomForestRegressor
rf = RandomForestRegressor(
    n_estimators=200,
    max_depth=5,           # 트리 깊이 제한
    min_samples_leaf=10    # 리프 최소 샘플 수 증가
)

# 전략 4: Dropout (딥러닝)
# 전략 5: 특성 개수 축소 (PCA, 선택적 제거)
```

## 앙상블 알고리즘의 이론적 기반

배깅(Bagging)과 부스팅(Boosting)은 편향-분산 트레이드오프를 조작하는 방식으로 이해할 수 있다.

**배깅(Random Forest 등)**: 독립적인 고분산 모델(깊은 트리)을 여러 개 만들고 평균을 낸다. 평균 연산이 분산을 $k$개 모델의 경우 $1/k$로 줄이는 효과가 있다. 편향은 거의 변하지 않는다.

**부스팅(XGBoost 등)**: 고편향 모델(얕은 트리)을 순차적으로 쌓아 이전 모델의 잔차(오차)를 학습한다. 편향을 점진적으로 줄이는 방식이다. 분산은 약간 증가할 수 있어 과대적합 위험이 있다.

---

**지난 글:** [교차 검증: K-Fold로 모델 성능을 더 정확히 추정하기](/posts/ml-cross-validation/)

**다음 글:** [과대적합 완전 정복: 탐지·진단·해결 전략](/posts/ml-overfitting/)

<br>
읽어주셔서 감사합니다. 😊
