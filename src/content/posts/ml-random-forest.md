---
title: "랜덤 포레스트: 앙상블 학습의 교과서"
description: "배깅과 랜덤 서브스페이스로 수백 개의 결정 트리를 합치는 랜덤 포레스트의 원리와 실전 튜닝 가이드를 다룬다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["랜덤포레스트", "앙상블학습", "배깅", "부트스트랩", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-decision-tree/)에서 결정 트리가 높은 해석 가능성을 가지지만 분산이 크고 과적합에 취약하다는 단점을 확인했다. **랜덤 포레스트(Random Forest)**는 바로 이 약점을 정면으로 해결하는 알고리즘이다. 아이디어는 단순하다. 하나의 결정 트리는 불안정하지만, 서로 다른 수백 개의 트리를 만들어 다수결로 예측하면 개별 트리의 오류가 서로 상쇄되어 훨씬 안정적이고 강건한 모델이 된다. 이것이 **앙상블(Ensemble) 학습**의 핵심이다.

## 앙상블(Ensemble)이란? 약한 학습기를 모아 강하게

앙상블의 철학은 "집단 지성"이다. 하나의 전문가보다 여러 명의 평범한 전문가가 독립적으로 판단하고 투표할 때 더 좋은 결정이 내려진다는 것이다. 머신러닝에서는 이를 두 가지 방식으로 구현한다.

- **배깅(Bagging)**: 여러 모델을 병렬로 독립 학습 → 평균/다수결
- **부스팅(Boosting)**: 이전 모델의 실수를 다음 모델이 보완하며 순차 학습

랜덤 포레스트는 배깅 방식을 사용하며, 여기에 **랜덤 서브스페이스** 기법을 추가해 트리 간의 상관도를 낮춘다. 다음 글에서 다룰 XGBoost, LightGBM은 부스팅 방식에 해당한다.

## 배깅(Bagging): Bootstrap Aggregating

배깅의 절차는 세 단계다.

1. **부트스트랩 샘플링**: 원본 훈련 데이터 N개에서 복원 추출로 N개를 샘플링한다. 평균적으로 전체의 약 63.2%가 선택되고, 나머지 36.8%는 선택되지 않는다.
2. **독립 모델 학습**: 각 부트스트랩 샘플로 독립적인 결정 트리를 학습한다.
3. **집계(Aggregation)**: 분류는 다수결 투표, 회귀는 평균으로 최종 예측을 만든다.

배깅이 분산을 줄이는 이유는 통계적으로 명확하다. 동일한 분포에서 독립적으로 추출한 B개의 예측값의 평균 분산은 단일 예측값 분산의 1/B다. 트리들이 완전히 독립이라면 말이다. 랜덤 포레스트가 트리 간 상관도를 낮추려 노력하는 것도 이 때문이다.

![랜덤 포레스트 앙상블 흐름: 부트스트랩 → 개별 트리 → 집계](/assets/posts/ml-random-forest-ensemble.svg)

## 랜덤 서브스페이스: 각 분기에서 무작위 특성 선택

단순 배깅의 한계는 모든 트리가 비슷한 중요 특성을 선택해 서로 높은 상관도를 보인다는 점이다. 상관된 예측을 평균해도 분산 감소 효과가 제한된다.

랜덤 포레스트는 각 노드를 분기할 때 **전체 특성 중 무작위로 일부만 후보로 고려**하는 방식으로 이를 해결한다. 이것이 **랜덤 서브스페이스(Random Subspace)** 기법이다.

- **분류 문제 기본값**: `max_features='sqrt'` — √d개 선택 (d: 전체 특성 수)
- **회귀 문제 기본값**: `max_features=1.0` — 전체 사용 (보통 d/3 권장)

이렇게 하면 중요한 특성 하나가 지배하던 트리들이 다양한 특성 조합을 학습하게 되어 트리 간 상관도가 낮아진다. 다양성이 높아지면 집계 효과가 극대화된다.

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import numpy as np

# 데이터 준비
X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 랜덤 포레스트 학습
rf = RandomForestClassifier(
    n_estimators=200,       # 트리 개수
    max_features='sqrt',    # 분기 시 후보 특성 수
    max_depth=None,         # 각 트리는 완전히 성장
    min_samples_leaf=1,
    oob_score=True,         # OOB 정확도 계산
    n_jobs=-1,              # 병렬 처리
    random_state=42
)
rf.fit(X_train, y_train)

print(f"OOB 정확도: {rf.oob_score_:.4f}")
print(f"테스트 정확도: {accuracy_score(y_test, rf.predict(X_test)):.4f}")
print(classification_report(y_test, rf.predict(X_test),
                             target_names=load_iris().target_names))
```

## OOB (Out-of-Bag) 오류: 별도 검증 세트 없이 평가

부트스트랩 샘플링에서 선택되지 않은 약 37%의 샘플이 **OOB(Out-of-Bag) 샘플**이다. 각 트리는 자신의 OOB 샘플에 대해 예측을 수행하고, 이를 집계하면 별도의 검증 세트 없이도 모델의 일반화 성능을 추정할 수 있다.

이 OOB 오류 추정은 교차 검증과 유사한 신뢰도를 가지면서, 별도의 분할 없이 훈련 데이터를 100% 활용할 수 있다는 장점이 있다. 데이터가 부족한 상황에서 특히 유용하다.

![OOB 오류 추정과 RandomForestClassifier 파라미터](/assets/posts/ml-random-forest-oob.svg)

## 특성 중요도와 Permutation Importance

랜덤 포레스트는 여러 트리에서 계산한 특성 중요도의 평균을 제공한다. 단일 결정 트리보다 훨씬 안정적인 값을 보여준다.

```python
import pandas as pd
from sklearn.inspection import permutation_importance

feature_names = load_iris().feature_names

# MDI 특성 중요도
mdi_df = pd.DataFrame({
    'feature': feature_names,
    'importance': rf.feature_importances_
}).sort_values('importance', ascending=False)
print("=== MDI 특성 중요도 ===")
print(mdi_df.to_string(index=False))

# Permutation Importance (더 신뢰할 수 있는 방법)
perm_result = permutation_importance(
    rf, X_test, y_test,
    n_repeats=30,
    random_state=42,
    n_jobs=-1
)

perm_df = pd.DataFrame({
    'feature': feature_names,
    'mean': perm_result.importances_mean,
    'std': perm_result.importances_std
}).sort_values('mean', ascending=False)
print("\n=== Permutation Importance ===")
print(perm_df.to_string(index=False))
```

MDI는 훈련 데이터에 대한 불순도 감소를 기반으로 하므로 카디널리티가 높은 특성을 과대평가하는 경향이 있다. Permutation Importance는 테스트 세트에서 특성 값을 무작위로 섞었을 때 성능이 얼마나 떨어지는지를 측정하므로 더 공정하다.

## 하이퍼파라미터 튜닝 가이드

```python
from sklearn.model_selection import RandomizedSearchCV
from scipy.stats import randint

# 탐색 공간 정의
param_dist = {
    'n_estimators': randint(100, 500),       # 트리 개수
    'max_depth': [None, 5, 10, 15, 20],      # 트리 최대 깊이
    'max_features': ['sqrt', 'log2', 0.5],   # 후보 특성 수
    'min_samples_split': randint(2, 20),     # 최소 분기 샘플 수
    'min_samples_leaf': randint(1, 10),      # 리프 최소 샘플 수
}

# RandomizedSearchCV: GridSearch보다 효율적
random_search = RandomizedSearchCV(
    RandomForestClassifier(oob_score=True, n_jobs=-1, random_state=42),
    param_distributions=param_dist,
    n_iter=50,              # 랜덤 조합 50번 시도
    cv=5,
    scoring='accuracy',
    n_jobs=-1,
    random_state=42,
    verbose=1
)
random_search.fit(X_train, y_train)

print(f"최적 파라미터: {random_search.best_params_}")
print(f"CV 정확도: {random_search.best_score_:.4f}")
best_rf = random_search.best_estimator_
print(f"OOB 정확도: {best_rf.oob_score_:.4f}")
```

**파라미터별 튜닝 전략**:

| 파라미터 | 권장 범위 | 효과 |
|---|---|---|
| `n_estimators` | 100~500 | 클수록 안정적, 수확 체감 있음 |
| `max_features` | `'sqrt'` (분류), `0.33` (회귀) | 작을수록 트리 다양성 ↑ |
| `max_depth` | None 또는 10~30 | 제한하면 훈련 속도 ↑ |
| `min_samples_leaf` | 1~5 | 클수록 과적합 ↓ |

## 랜덤 포레스트 vs 단일 결정 트리

```python
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import cross_val_score

# 단일 결정 트리
dt = DecisionTreeClassifier(random_state=42)
dt_scores = cross_val_score(dt, X_train, y_train, cv=10)
print(f"단일 트리 CV: {dt_scores.mean():.4f} (±{dt_scores.std():.4f})")

# 랜덤 포레스트
rf_basic = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
rf_scores = cross_val_score(rf_basic, X_train, y_train, cv=10)
print(f"랜덤 포레스트 CV: {rf_scores.mean():.4f} (±{rf_scores.std():.4f})")

# 일반적으로 표준편차(std)가 크게 줄어드는 것을 확인할 수 있다
# 분산이 줄어든 만큼 더 신뢰할 수 있는 모델이 됨
```

실제 데이터에서 랜덤 포레스트는 단일 트리에 비해 평균 정확도도 높지만, **표준편차가 크게 줄어드는** 효과가 더 중요하다. 예측의 일관성이 높아진다는 의미다.

## ExtraTreesClassifier: 극도로 무작위화된 트리

`ExtraTrees(Extremely Randomized Trees)`는 랜덤 포레스트보다 한 발 더 무작위화한 방법이다.

- **랜덤 포레스트**: 후보 특성 중 최적 임계값 탐색
- **ExtraTrees**: 후보 특성 중 임계값도 무작위 선택

```python
from sklearn.ensemble import ExtraTreesClassifier

et = ExtraTreesClassifier(
    n_estimators=200,
    max_features='sqrt',
    n_jobs=-1,
    random_state=42
)
et.fit(X_train, y_train)

et_scores = cross_val_score(et, X_train, y_train, cv=10)
print(f"ExtraTrees CV: {et_scores.mean():.4f} (±{et_scores.std():.4f})")
```

임계값을 탐색하지 않으므로 **학습 속도가 빠르고**, 추가적인 무작위성으로 **분산이 더 낮아질 수 있다**. 단, 편향이 약간 높아질 수 있다. 실전에서는 랜덤 포레스트와 함께 비교해보고 선택하면 된다.

## 실전 활용: 결측치 강건, 스케일링 불필요

랜덤 포레스트가 실무에서 자주 선택되는 이유는 전처리 부담이 적기 때문이다.

**스케일링 불필요**: 결정 트리 기반이므로 특성의 스케일이 결과에 영향을 미치지 않는다. `StandardScaler`, `MinMaxScaler` 없이도 동작한다.

**결측치 강건**: 특성 값이 일부 누락되어도 다른 특성을 이용한 분기가 가능하다. 완전한 결측치 처리는 아니지만, 단순 대치(imputation) 정도면 충분한 경우가 많다.

**범주형 특성**: 사이킷런에서는 원-핫 인코딩이 필요하지만, R의 `randomForest` 패키지나 `CatBoost`는 범주형을 직접 처리한다.

```python
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer

# 수치형 + 범주형 혼합 데이터 파이프라인 예시
numeric_features = ['age', 'income', 'score']
categorical_features = ['city', 'occupation']

numeric_transformer = SimpleImputer(strategy='median')
categorical_transformer = Pipeline([
    ('imputer', SimpleImputer(strategy='most_frequent')),
    ('onehot', OneHotEncoder(handle_unknown='ignore'))
])

preprocessor = ColumnTransformer([
    ('num', numeric_transformer, numeric_features),
    ('cat', categorical_transformer, categorical_features)
])

rf_pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier(
        n_estimators=200,
        oob_score=True,
        n_jobs=-1,
        random_state=42
    ))
])
# rf_pipeline.fit(X_train, y_train)
```

## 단점: 해석 어려움, 메모리 사용량

강력한 성능의 대가로 랜덤 포레스트에는 몇 가지 단점이 있다.

**블랙박스화**: 수백 개 트리의 앙상블이므로, 단일 결정 트리처럼 "왜 이 예측을 했는가?"를 직관적으로 설명하기 어렵다. 해석이 필요하다면 SHAP(SHapley Additive exPlanations) 값을 활용한다.

```python
# SHAP으로 개별 예측 설명
# pip install shap
import shap

explainer = shap.TreeExplainer(rf)
shap_values = explainer.shap_values(X_test)

# 특정 예측에 대한 설명
shap.force_plot(
    explainer.expected_value[1],
    shap_values[1][0, :],
    X_test[0, :],
    feature_names=feature_names
)
```

**메모리 사용량**: 트리 수 × 트리 크기만큼 메모리를 사용한다. 대용량 데이터에서 n_estimators를 크게 설정하면 수 GB의 메모리가 필요할 수 있다. `max_depth`를 제한하거나 `n_estimators`를 적절히 조정해야 한다.

**예측 속도**: 훈련은 병렬화(`n_jobs=-1`)로 빠르지만, 예측 시에도 모든 트리를 거쳐야 한다. 실시간 서빙에서는 단일 트리보다 느리다.

**연속적 업데이트 어려움**: 새 데이터가 들어왔을 때 증분 학습(Incremental Learning)이 기본적으로 지원되지 않는다.

랜덤 포레스트는 "첫 번째로 시도해볼 강력한 알고리즘"으로 자리잡고 있다. 하이퍼파라미터에 그다지 민감하지 않고, 스케일링도 불필요하며, OOB로 빠르게 성능을 확인할 수 있다. 단, 최고 성능을 뽑아내려면 다음 글에서 다룰 **그래디언트 부스팅(Gradient Boosting)**—특히 XGBoost, LightGBM—이 한 수 위인 경우가 많다. 부스팅은 배깅보다 편향까지 줄여주기 때문이다.

---

**지난 글:** [결정 트리: 질문의 연쇄로 만드는 분류 모델](/posts/ml-decision-tree/)

**다음 글:** [그래디언트 부스팅: XGBoost·LightGBM의 기반 원리](/posts/ml-gradient-boosting/)

<br>
읽어주셔서 감사합니다. 😊
