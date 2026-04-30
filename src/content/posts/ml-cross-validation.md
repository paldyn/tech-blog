---
title: "교차 검증: K-Fold로 모델 성능을 더 정확히 추정하기"
description: "K-겹 교차 검증의 원리와 편향-분산 트레이드오프, Stratified·Time-Series·Leave-One-Out 등 다양한 변형, GridSearchCV와의 결합까지 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["교차검증", "K-Fold", "StratifiedKFold", "하이퍼파라미터튜닝", "모델평가"]
featured: false
draft: false
---

[지난 글](/posts/ml-train-val-test/)에서 훈련·검증·테스트 세트를 나누는 원칙을 배웠다. 그런데 단순 홀드아웃 방식은 분할 방법에 따라 성능 수치가 크게 흔들릴 수 있다. 데이터가 적을 때는 특히 심각해서, 운 좋게 쉬운 샘플이 검증 세트에 들어오면 성능이 과대평가되고, 반대 경우엔 과소평가된다. **교차 검증(Cross-Validation)**은 이 분산을 줄이고 더 안정적인 성능 추정을 제공한다.

## K-겹 교차 검증의 원리

K-Fold CV의 아이디어는 간단하다. 전체 데이터를 K개의 동일한 크기 덩어리(Fold)로 나눈 뒤, K번 반복하면서 매번 다른 Fold를 검증 세트로 쓰고 나머지 K-1개 Fold로 훈련한다. K번의 점수를 평균 내면 최종 CV 점수가 된다.

![5-겹 교차 검증 구조](/assets/posts/ml-cross-validation-kfold.svg)

K=5 기준, 각 반복에서 20%의 데이터가 검증에 사용되며 데이터 전체가 정확히 한 번씩 검증 세트에 포함된다. 결국 모든 샘플이 평가에 기여하므로 단일 분할보다 훨씬 안정적인 추정이 가능하다.

## 기본 구현

```python
from sklearn.model_selection import cross_val_score, KFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import load_breast_cancer
import numpy as np

X, y = load_breast_cancer(return_X_y=True)
model = RandomForestClassifier(n_estimators=100, random_state=42)

# 가장 간단한 방법: cv=5 (StratifiedKFold 자동 적용)
scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')

print(f"각 Fold 점수: {scores}")
print(f"평균: {scores.mean():.4f}")
print(f"표준편차: {scores.std():.4f}")
# 표준편차가 작을수록 안정적인 모델

# 여러 지표를 동시에 계산
from sklearn.model_selection import cross_validate

results = cross_validate(model, X, y, cv=5,
    scoring=['accuracy', 'f1', 'roc_auc'],
    return_train_score=True)

print(f"Train Acc: {results['train_accuracy'].mean():.4f}")
print(f"Val Acc:   {results['test_accuracy'].mean():.4f}")
print(f"Val F1:    {results['test_f1'].mean():.4f}")
print(f"Val ROC:   {results['test_roc_auc'].mean():.4f}")
```

`cross_validate`는 여러 지표를 한 번에 계산하면서 훈련 점수도 함께 반환한다. 훈련 점수와 검증 점수 차이가 크면 과대적합을 의심할 수 있다.

## K 값은 어떻게 선택하나

K=5와 K=10이 가장 흔히 사용된다. K가 크면 각 반복에서 훈련 데이터가 많아지므로 편향이 줄지만, 반복 횟수가 늘어 계산 비용이 증가하고 각 검증 세트가 작아져 분산이 커진다.

| K 값 | 편향 | 분산 | 계산 비용 | 권장 상황 |
|------|------|------|-----------|-----------|
| 3 | 높음 | 낮음 | 낮음 | 데이터 많고 학습 오래 걸릴 때 |
| 5 | 중간 | 중간 | 중간 | **일반 상황 (기본값)** |
| 10 | 낮음 | 높음 | 높음 | 데이터 적을 때 |
| n (LOOCV) | 최소 | 최대 | 매우 높음 | 소규모 데이터 (<100) |

K=n은 **LOOCV(Leave-One-Out Cross-Validation)**로, 한 번에 샘플 하나를 검증 세트로 쓴다. 편향이 가장 낮지만 n번 학습해야 한다.

## StratifiedKFold: 클래스 불균형 처리

일반 K-Fold는 Fold를 무작위로 나누므로 어떤 Fold는 특정 클래스 샘플이 너무 적거나 많을 수 있다. 클래스 불균형 데이터에서는 이 문제가 심각해진다. `StratifiedKFold`는 각 Fold의 클래스 비율을 원본과 동일하게 유지한다.

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score

# 불균형 클래스 데이터 (양성 5%, 음성 95%)
skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# cross_val_score에 cv 객체를 직접 전달
scores = cross_val_score(model, X, y,
    cv=skf,
    scoring='f1_weighted')

# 분류 문제에서 cross_val_score(cv=5)는
# 자동으로 StratifiedKFold를 사용한다
```

## 시계열 데이터: TimeSeriesSplit

시간 순서가 있는 데이터는 미래 정보가 과거 예측에 사용되지 않도록 Fold를 시간 순서대로 구성해야 한다.

![교차 검증 종류 비교 코드](/assets/posts/ml-cross-validation-types.svg)

`TimeSeriesSplit`은 훈련 구간이 점점 커지는 방식으로 분할한다. 반복 1에서는 처음 20% 훈련 + 다음 20% 검증, 반복 2에서는 처음 40% 훈련 + 다음 20% 검증 식으로 진행된다.

```python
from sklearn.model_selection import TimeSeriesSplit

tscv = TimeSeriesSplit(n_splits=5)

for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
    X_tr, X_v = X[train_idx], X[val_idx]
    y_tr, y_v = y[train_idx], y[val_idx]

    model.fit(X_tr, y_tr)
    score = model.score(X_v, y_v)
    print(f"Fold {fold+1}: train=[0:{len(train_idx)}] "
          f"val=[{len(train_idx)}:{len(train_idx)+len(val_idx)}] "
          f"score={score:.4f}")
```

## GroupKFold: 동일 그룹 분리 방지

같은 환자의 여러 측정값, 같은 사용자의 여러 거래처럼 관련 샘플들이 있을 때 같은 그룹이 훈련과 검증에 동시에 들어가면 성능이 과대평가된다.

```python
from sklearn.model_selection import GroupKFold
import numpy as np

# groups: 각 샘플이 속한 그룹 ID
# (예: 환자 ID, 사용자 ID, 문서 ID 등)
groups = np.array([1,1,2,2,3,3,4,4,5,5] * 10)

gkf = GroupKFold(n_splits=5)
for train_idx, val_idx in gkf.split(X, y, groups=groups):
    # train_idx와 val_idx는 서로 다른 그룹만 포함
    assert len(set(groups[train_idx]) & set(groups[val_idx])) == 0
```

## GridSearchCV: 교차 검증으로 하이퍼파라미터 튜닝

교차 검증의 핵심 응용은 하이퍼파라미터 탐색이다. `GridSearchCV`는 모든 파라미터 조합을 K-Fold CV로 평가해 최적 조합을 찾는다.

```python
from sklearn.model_selection import GridSearchCV
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('svc',    SVC())
])

param_grid = {
    'svc__C':     [0.1, 1, 10, 100],
    'svc__gamma': ['scale', 'auto', 0.01, 0.001],
    'svc__kernel': ['rbf', 'linear']
}

# cv=5: 각 조합을 5-Fold CV로 평가
# n_jobs=-1: 모든 CPU 코어 사용
grid = GridSearchCV(pipe, param_grid,
    cv=5,
    scoring='accuracy',
    n_jobs=-1,
    verbose=1)

grid.fit(X_train, y_train)

print(f"최적 파라미터: {grid.best_params_}")
print(f"최적 CV 점수: {grid.best_score_:.4f}")

# 최종 평가는 테스트 세트로
test_score = grid.score(X_test, y_test)
print(f"테스트 점수: {test_score:.4f}")
```

**주의**: `GridSearchCV`는 내부적으로 교차 검증을 사용하므로 별도 검증 세트가 필요 없다. `grid.fit(X_train, y_train)` 후 `grid.score(X_test, y_test)`로 최종 평가하면 된다.

## Nested Cross-Validation: 진정한 비편향 평가

하이퍼파라미터 튜닝까지 CV로 수행하고 싶다면 중첩 교차 검증(Nested CV)을 사용한다. 외부 루프는 성능 추정, 내부 루프는 하이퍼파라미터 탐색을 담당한다.

```python
from sklearn.model_selection import cross_val_score, GridSearchCV

inner_cv = KFold(n_splits=3)
outer_cv = KFold(n_splits=5)

grid = GridSearchCV(model, param_grid, cv=inner_cv, n_jobs=-1)

# outer_cv로 grid(내부 튜닝 포함)를 평가
nested_scores = cross_val_score(
    grid, X, y, cv=outer_cv, scoring='accuracy'
)
print(f"Nested CV: {nested_scores.mean():.4f} ± {nested_scores.std():.4f}")
```

## 교차 검증의 한계

CV는 편향을 줄여주지만 계산 비용이 K배 증가한다. 딥러닝처럼 학습에 수 시간이 걸리는 경우 5-Fold CV는 비현실적이다. 이때는 단순 홀드아웃을 쓰되 여러 random_state로 반복해 평균을 취하는 **Repeated Holdout**을 사용하기도 한다.

---

**지난 글:** [훈련·검증·테스트 세트 분리: 올바른 모델 평가의 기초](/posts/ml-train-val-test/)

**다음 글:** [편향-분산 트레이드오프: 과소적합과 과대적합의 근본 원인](/posts/ml-bias-variance/)

<br>
읽어주셔서 감사합니다. 😊
