---
title: "그래디언트 부스팅: XGBoost·LightGBM의 기반 원리"
description: "잔차를 학습하는 부스팅의 원리부터 XGBoost·LightGBM·CatBoost 비교까지, 캐글을 지배한 알고리즘을 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["그래디언트부스팅", "XGBoost", "LightGBM", "부스팅", "앙상블학습"]
featured: false
draft: false
---

[지난 글](/posts/ml-random-forest/)에서 랜덤 포레스트가 수백 개의 트리를 **병렬로** 만들어 다수결로 예측하는 방법을 배웠다. 이번에는 전혀 다른 전략을 취하는 **그래디언트 부스팅(Gradient Boosting)**을 다룬다. 부스팅은 트리를 **순차적으로** 쌓되, 각 트리가 이전 트리들이 저지른 실수를 집중적으로 교정하는 방식으로 동작한다. 이 단순한 아이디어에서 XGBoost, LightGBM, CatBoost라는 캐글 플랫폼을 수년간 지배한 알고리즘이 탄생했다.

## 부스팅의 직관: 이전의 실수를 고쳐나가기

부스팅의 핵심 아이디어는 매우 직관적이다. 처음에는 간단한 모델(약한 학습기)을 만들고, 그 모델이 틀린 샘플에 집중해 다음 모델을 학습한다. 이 과정을 반복하면 처음에는 형편없던 모델들의 합이 강력한 예측기로 거듭난다.

가장 오래된 부스팅 알고리즘인 **에이다부스트(AdaBoost, 1997)**는 이 아이디어를 잘못 분류된 샘플의 **가중치**를 높이는 방식으로 구현했다. 각 라운드마다 이전 모델이 오분류한 샘플들에 더 높은 가중치를 부여해 다음 모델이 그 샘플들에 집중하도록 강제한다.

```python
from sklearn.ensemble import AdaBoostClassifier
from sklearn.tree import DecisionTreeClassifier

# AdaBoost: 얕은 트리(깊이 1 = stump)를 순차적으로 부스팅
ada = AdaBoostClassifier(
    estimator=DecisionTreeClassifier(max_depth=1),
    n_estimators=200,
    learning_rate=1.0,
    random_state=42
)
ada.fit(X_train, y_train)
print(f"AdaBoost 정확도: {ada.score(X_test, y_test):.4f}")
```

에이다부스트는 분류 문제에만 자연스럽게 적용되고, 손실 함수를 교체하기 어렵다는 한계가 있었다. 이를 일반화한 것이 **그래디언트 부스팅 머신(GBM, 2001)**이다.

## 그래디언트 부스팅의 수학적 원리: 잔차 학습

그래디언트 부스팅을 이해하는 가장 직관적인 방법은 **잔차(residual)**에서 출발하는 것이다.

회귀 문제를 예로 들자. 실제 값이 $y$이고 첫 번째 트리의 예측이 $\hat{y}_1$이라면 잔차는 $r_1 = y - \hat{y}_1$이다. 두 번째 트리는 $X$를 입력받아 $r_1$을 예측하도록 학습된다. 이 두 트리를 합친 앙상블의 예측은 다음과 같다.

$$\hat{y}_2 = \hat{y}_1 + \text{lr} \cdot h_2(X)$$

여기서 $\text{lr}$은 학습률이고, $h_2$는 두 번째 트리다. 이 과정을 M번 반복하면:

$$\hat{y}_M = \sum_{m=1}^{M} \text{lr} \cdot h_m(X)$$

수학적으로 더 깊이 들어가면, 잔차는 **평균 제곱 오차(MSE)** 손실 함수의 **음의 기울기(Negative Gradient)**와 같다.

$$r_i = -\frac{\partial L(y_i, \hat{y})}{\partial \hat{y}} = y_i - \hat{y}$$

이것이 "그래디언트" 부스팅이라는 이름의 유래다. 그래디언트 부스팅은 손실 함수를 MSE 대신 로그 손실, 절대값 손실, 훌버 손실 등으로 교체할 수 있어 **어떤 미분 가능한 손실 함수에도 적용**할 수 있다.

![그래디언트 부스팅: 순차적 잔차 학습](/assets/posts/ml-gradient-boosting-concept.svg)

## 학습률과 n_estimators: 핵심 트레이드오프

그래디언트 부스팅에서 가장 중요한 두 하이퍼파라미터는 `learning_rate`와 `n_estimators`다.

- **학습률이 작으면**: 각 트리가 조금씩만 기여하므로 더 많은 트리가 필요하다. 대신 더 안정적이고 일반화 성능이 좋다.
- **학습률이 크면**: 적은 트리로 수렴하지만 과적합 위험이 높다.

실전에서는 **학습률을 작게(0.01~0.1) 설정하고 n_estimators를 충분히 크게** 잡은 뒤, 조기 종료로 최적 시점을 찾는 것이 정석이다.

```python
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

X, y = make_classification(n_samples=5000, n_features=20,
                            n_informative=10, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# sklearn GradientBoosting: 개념 학습용
gbm = GradientBoostingClassifier(
    n_estimators=300,
    learning_rate=0.05,    # 작은 학습률
    max_depth=4,           # 트리 깊이
    subsample=0.8,         # 서브샘플링 (확률적 GBM)
    min_samples_leaf=20,   # 리프 최소 샘플
    random_state=42
)
gbm.fit(X_train, y_train)
print(f"GBM 정확도: {accuracy_score(y_test, gbm.predict(X_test)):.4f}")
```

## 서브샘플링으로 과적합 방지

`subsample < 1.0`으로 설정하면 각 트리를 훈련할 때 훈련 데이터의 일부만 무작위로 사용한다. 이를 **확률적 그래디언트 부스팅(Stochastic GBM)**이라 한다.

서브샘플링의 두 가지 효과:
1. **분산 감소**: 각 트리가 다른 서브셋을 보므로 다양성이 증가한다.
2. **속도 향상**: 더 작은 데이터로 각 트리를 학습한다.

일반적으로 `subsample=0.8`, `colsample_bytree=0.8` (특성 서브샘플링)을 기본값으로 사용하고 데이터에 맞게 조정한다.

## XGBoost: 정규화 + 병렬 처리 + 결측치 처리

**XGBoost(eXtreme Gradient Boosting, 2014)**는 Chen과 Guestrin이 개발해 2016년 캐글을 석권한 라이브러리다. 기존 GBM에 세 가지 핵심 개선을 더했다.

**1. 내장 정규화**: 손실 함수에 $L_1$ (alpha)과 $L_2$ (lambda) 정규화 항을 추가해 과적합을 줄인다.

$$\tilde{L} = L + \alpha \sum|w_j| + \frac{\lambda}{2} \sum w_j^2$$

**2. 결측치 자동 처리**: 각 분기에서 결측값을 왼쪽/오른쪽 중 어느 방향으로 보낼지 자동으로 학습한다. 별도의 전처리 없이 결측치가 있는 데이터를 바로 사용할 수 있다.

**3. 병렬 처리**: 각 트리 내부의 분기점 탐색을 CPU 병렬로 수행해 속도를 크게 높였다.

```python
import xgboost as xgb
from sklearn.model_selection import cross_val_score

model_xgb = xgb.XGBClassifier(
    n_estimators=500,
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,          # L1 정규화
    reg_lambda=1.0,         # L2 정규화
    use_label_encoder=False,
    eval_metric='logloss',
    random_state=42,
    n_jobs=-1
)

# 5-fold 교차 검증
scores = cross_val_score(model_xgb, X_train, y_train, cv=5,
                         scoring='accuracy')
print(f"XGBoost CV 평균: {scores.mean():.4f} ± {scores.std():.4f}")
```

## LightGBM: Leaf-wise 성장과 히스토그램 기법

**LightGBM(2017, Microsoft)**은 XGBoost보다 빠른 것이 최대 장점이다. 두 가지 핵심 기법이 속도를 끌어올린다.

**Leaf-wise 트리 성장**: XGBoost가 레벨 단위로 트리를 키우는 것과 달리, LightGBM은 현재 가장 손실을 줄이는 **리프 하나를 선택해 분기**한다. 같은 리프 수에서 더 낮은 손실을 달성하지만, 소규모 데이터에서 과적합에 주의해야 한다.

**히스토그램 기법**: 연속형 특성값을 이산 구간(bin)으로 묶어 히스토그램을 만들고, 히스토그램 단위로 분기점을 탐색한다. 정확한 분기점을 탐색하는 XGBoost에 비해 메모리와 연산량이 크게 줄어든다.

```python
import lightgbm as lgb

model_lgb = lgb.LGBMClassifier(
    n_estimators=500,
    learning_rate=0.05,
    num_leaves=31,          # Leaf-wise: max_depth 대신 num_leaves 조정
    max_depth=-1,           # -1이면 num_leaves로만 제한
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_samples=20,   # 리프 최소 샘플 (과적합 방지)
    reg_alpha=0.1,
    reg_lambda=1.0,
    random_state=42,
    n_jobs=-1,
    verbose=-1
)
model_lgb.fit(X_train, y_train)
print(f"LightGBM 정확도: {model_lgb.score(X_test, y_test):.4f}")
```

LightGBM은 `num_leaves`가 핵심 하이퍼파라미터다. `num_leaves = 2^max_depth`를 기준으로 조정하되, 소규모 데이터에서는 `min_child_samples`를 높여 과적합을 방지한다.

## CatBoost: 범주형 특성 자동 처리

**CatBoost(2017, Yandex)**는 범주형 특성이 많은 데이터에 특히 강하다. 기존 방법에서는 범주형 특성에 원-핫 인코딩이나 레이블 인코딩을 수동으로 적용해야 했지만, CatBoost는 **Ordered Target Statistics**라는 기법으로 타깃 누출 없이 범주형 변수를 자동으로 처리한다.

```python
from catboost import CatBoostClassifier

# 범주형 특성 인덱스를 명시하면 자동 처리
cat_features = [0, 3, 7]  # 범주형 열의 인덱스

model_cat = CatBoostClassifier(
    iterations=500,
    learning_rate=0.05,
    depth=6,
    cat_features=cat_features,  # 범주형 명시
    eval_metric='Accuracy',
    random_seed=42,
    verbose=0
)
model_cat.fit(X_train, y_train)
print(f"CatBoost 정확도: {model_cat.score(X_test, y_test):.4f}")
```

![XGBoost · LightGBM · CatBoost 비교](/assets/posts/ml-gradient-boosting-libraries.svg)

## 조기 종료(Early Stopping)

학습률을 낮추고 n_estimators를 크게 잡으면 몇 번째 트리에서 멈춰야 할지 알 수 없다. 이를 위해 **조기 종료(Early Stopping)**를 사용한다. 검증 손실이 `early_stopping_rounds` 동안 개선되지 않으면 학습을 자동으로 중단한다.

```python
import xgboost as xgb
from sklearn.model_selection import train_test_split

X_tr, X_val, y_tr, y_val = train_test_split(
    X_train, y_train, test_size=0.1, random_state=42
)

model_es = xgb.XGBClassifier(
    n_estimators=2000,      # 충분히 크게
    learning_rate=0.02,     # 작게
    max_depth=6,
    subsample=0.8,
    eval_metric='logloss',
    early_stopping_rounds=50,  # 50 라운드 개선 없으면 중단
    random_state=42,
    n_jobs=-1
)

model_es.fit(
    X_tr, y_tr,
    eval_set=[(X_val, y_val)],
    verbose=False
)
print(f"최적 트리 수: {model_es.best_iteration}")
print(f"검증 점수: {model_es.score(X_test, y_test):.4f}")
```

## 실전 하이퍼파라미터 튜닝 전략

그래디언트 부스팅의 하이퍼파라미터는 많지만, 체계적으로 접근하면 효율적으로 튜닝할 수 있다.

**1단계: n_estimators를 크게, early stopping으로 최적점 찾기**

```python
# 1단계: 기본 설정 + Early Stopping
model = xgb.XGBClassifier(
    n_estimators=3000,
    learning_rate=0.05,
    max_depth=6,
    early_stopping_rounds=50,
    eval_metric='logloss',
    n_jobs=-1
)
model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
best_n = model.best_iteration
print(f"최적 n_estimators: {best_n}")
```

**2단계: 트리 구조 파라미터 GridSearch**

```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'max_depth': [4, 6, 8],
    'min_child_weight': [1, 3, 5],  # 리프 최소 가중치 합
}
grid = GridSearchCV(
    xgb.XGBClassifier(n_estimators=best_n, learning_rate=0.05,
                      eval_metric='logloss', n_jobs=-1),
    param_grid, cv=5, scoring='accuracy'
)
grid.fit(X_train, y_train)
print(f"최적: {grid.best_params_}")
```

**3단계: 서브샘플링 → 정규화 → 학습률 미세 조정**

일반적인 최적 범위:
- `learning_rate`: 0.01 ~ 0.1 (작을수록 좋지만 느림)
- `max_depth`: 3 ~ 8 (깊을수록 복잡한 패턴, 과적합 위험)
- `subsample`: 0.6 ~ 0.9
- `colsample_bytree`: 0.6 ~ 0.9
- `reg_alpha`, `reg_lambda`: 0.0 ~ 1.0

## 랜덤 포레스트 vs 그래디언트 부스팅 선택 기준

두 앙상블 방법은 서로 다른 상황에서 빛난다.

| 상황 | 추천 |
|------|------|
| 빠른 프로토타이핑 | 랜덤 포레스트 (파라미터 적음) |
| 최고 성능이 목표 | 그래디언트 부스팅 (XGBoost/LightGBM) |
| 대용량 데이터 (수백만 행) | LightGBM |
| 범주형 특성이 많음 | CatBoost |
| 노이즈 많은 데이터 | 랜덤 포레스트 (부스팅은 노이즈에 민감) |
| 병렬화·분산 학습 | XGBoost, LightGBM |
| 해석 가능성 중요 | 둘 다 특성 중요도 제공 |

```python
# 특성 중요도 추출 및 상위 10개 확인
import numpy as np

importances = model_lgb.feature_importances_
indices = np.argsort(importances)[::-1]

print("상위 10개 특성:")
for i in range(min(10, len(indices))):
    print(f"  {i+1}. 특성 {indices[i]}: {importances[indices[i]]:.4f}")
```

그래디언트 부스팅은 정형 데이터(tabular data)에서 딥러닝보다 여전히 강력하다. 2024년 이후에도 캐글 정형 데이터 대회의 상위권은 XGBoost 또는 LightGBM 기반 솔루션으로 채워져 있다. 다음 글에서는 레이블 없는 데이터에서 패턴을 찾는 **비지도 학습**의 첫 번째 주인공, K-평균 군집화를 알아본다.

---

**지난 글:** [랜덤 포레스트: 앙상블 학습의 교과서](/posts/ml-random-forest/)

**다음 글:** [K-평균 군집화: 데이터를 K개 그룹으로 나누는 법](/posts/ml-clustering-kmeans/)

<br>
읽어주셔서 감사합니다. 😊
