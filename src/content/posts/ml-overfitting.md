---
title: "과대적합 완전 정복: 탐지·진단·해결 전략"
description: "과대적합의 원인과 증상, 학습 곡선·검증 손실로 탐지하는 방법, L1·L2 정규화·드롭아웃·조기 종료·데이터 증강 등 해결 전략을 실전 코드와 함께 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["과대적합", "정규화", "드롭아웃", "조기종료", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-bias-variance/)에서 편향-분산 트레이드오프를 이론적으로 이해했다. 이번에는 실무에서 가장 자주 마주치는 고분산 문제, 즉 **과대적합(Overfitting)**을 탐지하고 해결하는 구체적인 방법들을 집중적으로 다룬다.

## 과대적합의 정체

과대적합은 모델이 훈련 데이터의 **특정 패턴과 노이즈까지 모두 암기**하여 새로운 데이터에서는 일반화에 실패하는 현상이다. 훈련 세트 정확도가 95%인데 테스트 세트 정확도가 72%라면 과대적합을 강하게 의심해야 한다.

과대적합이 발생하는 근본 원인은 세 가지다. 첫째, 모델이 데이터에 비해 너무 복잡하다. 둘째, 훈련 데이터가 너무 적다. 셋째, 훈련을 너무 오래 한다(특히 반복 학습하는 신경망에서).

## 탐지: 학습 곡선과 검증 손실

![과대적합 학습 곡선 진단](/assets/posts/ml-overfitting-curves.svg)

과대적합의 가장 명확한 신호는 **훈련 손실은 계속 감소하는데 검증 손실이 어느 순간 반등하는 것**이다. 이 지점이 Early Stopping의 기준점이 된다. 또한 훈련 점수와 검증 점수의 큰 차이(Gap)도 과대적합의 지표다.

```python
from sklearn.model_selection import learning_curve
import numpy as np

def plot_learning_curve(model, X, y, cv=5):
    sizes = np.linspace(0.1, 1.0, 10)
    train_sizes, train_scores, val_scores = learning_curve(
        model, X, y,
        train_sizes=sizes,
        cv=cv,
        scoring='accuracy',
        n_jobs=-1
    )
    train_mean = train_scores.mean(axis=1)
    val_mean   = val_scores.mean(axis=1)

    # 과대적합 판단
    gap = train_mean[-1] - val_mean[-1]
    if gap > 0.10:
        print(f"과대적합 의심: Train-Val Gap = {gap:.4f}")
        print("→ 정규화 강화 / 데이터 추가 / 모델 단순화 필요")
    elif train_mean[-1] < 0.75:
        print(f"과소적합 의심: Train Acc = {train_mean[-1]:.4f}")
        print("→ 모델 복잡도 증가 / 특성 추가 필요")
    else:
        print(f"양호: Gap={gap:.4f}, Train={train_mean[-1]:.4f}")

    return train_sizes, train_mean, val_mean
```

## L1 · L2 정규화

정규화는 손실 함수에 가중치 크기에 비례한 패널티를 추가해 모델이 불필요하게 복잡해지는 것을 막는다.

**L2 정규화(Ridge)**: 손실 함수에 $\alpha \sum w_i^2$를 더한다. 가중치를 0에 가깝게 줄이지만 완전히 0으로 만들지는 않는다. 모든 특성이 조금씩 기여하는 부드러운 모델을 만든다.

**L1 정규화(Lasso)**: 손실 함수에 $\alpha \sum |w_i|$를 더한다. 일부 가중치를 정확히 0으로 만들어 특성 선택 효과가 있다. 수백 개 특성 중 실제로 중요한 것이 소수일 때 유용하다.

```python
from sklearn.linear_model import Ridge, Lasso, ElasticNet
from sklearn.model_selection import cross_val_score

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42)

# L2: Ridge
for alpha in [0.01, 0.1, 1.0, 10.0, 100.0]:
    ridge = Ridge(alpha=alpha)
    score = cross_val_score(ridge, X_train, y_train,
                            cv=5, scoring='r2').mean()
    print(f"Ridge alpha={alpha:6.2f}: CV R²={score:.4f}")

# L1: Lasso (특성 선택 효과)
lasso = Lasso(alpha=0.1, max_iter=10000)
lasso.fit(X_train, y_train)
nonzero = np.sum(lasso.coef_ != 0)
print(f"Lasso: {nonzero}/{X_train.shape[1]} 특성 사용")

# ElasticNet: L1 + L2 혼합
enet = ElasticNet(alpha=0.1, l1_ratio=0.5)
# l1_ratio=0 → Ridge, l1_ratio=1 → Lasso
```

## 트리 기반 모델의 과대적합 방지

의사결정 트리는 깊이 제한 없이 키우면 훈련 세트를 완벽히 암기한다. 다음 하이퍼파라미터로 복잡도를 제어한다.

```python
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

# 단일 트리: 깊이 제한
tree = DecisionTreeClassifier(
    max_depth=6,            # 트리 최대 깊이
    min_samples_split=20,   # 분기 위한 최소 샘플 수
    min_samples_leaf=10,    # 리프 노드 최소 샘플 수
    max_features='sqrt',    # 분기 시 고려할 특성 수
    ccp_alpha=0.01          # 비용-복잡도 가지치기
)

# Random Forest: 배깅 + 특성 랜덤화
rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=8,
    min_samples_leaf=5,
    max_features='sqrt',
    random_state=42
)

# GBM: 부스팅, 낮은 학습률로 과대적합 방지
gbm = GradientBoostingClassifier(
    n_estimators=500,
    max_depth=3,            # 얕은 트리
    learning_rate=0.05,     # 낮은 학습률
    subsample=0.8,          # 각 트리 훈련에 80% 샘플
    min_samples_leaf=10
)
```

## 조기 종료(Early Stopping)

반복 학습하는 모델(신경망, 경사 하강법 기반 모델)에서는 검증 손실이 더 이상 개선되지 않을 때 학습을 멈추는 것이 효과적이다.

![과대적합 방지 기법 코드](/assets/posts/ml-overfitting-remedies.svg)

```python
from sklearn.neural_network import MLPClassifier
from sklearn.linear_model import SGDClassifier

# MLPClassifier Early Stopping
mlp = MLPClassifier(
    hidden_layer_sizes=(256, 128),
    max_iter=1000,
    early_stopping=True,        # 자동 Early Stop
    validation_fraction=0.1,    # 10%를 검증에 사용
    n_iter_no_change=20,        # 20 에폭 동안 개선 없으면 종료
    tol=1e-4,
    random_state=42
)
mlp.fit(X_train, y_train)
print(f"실제 학습 에폭 수: {mlp.n_iter_}")
print(f"최종 검증 점수: {mlp.best_validation_score_:.4f}")
```

## 데이터 증강: 데이터를 늘려 분산 줄이기

훈련 데이터 자체를 늘리는 것이 과대적합의 가장 근본적인 해결책이다. 새 데이터를 수집하기 어려울 때는 기존 데이터를 변형해 만드는 데이터 증강을 사용한다.

```python
import numpy as np
from sklearn.utils import resample

# 방법 1: 노이즈 추가 (수치 데이터)
def add_noise_augmentation(X, y, noise_std=0.05, n_aug=3):
    X_aug_list = [X]
    y_aug_list = [y]
    for _ in range(n_aug):
        noise = np.random.randn(*X.shape) * noise_std
        X_aug_list.append(X + noise)
        y_aug_list.append(y)
    return np.vstack(X_aug_list), np.hstack(y_aug_list)

X_aug, y_aug = add_noise_augmentation(X_train, y_train,
                                       noise_std=0.02, n_aug=5)
print(f"원본: {len(X_train)} → 증강: {len(X_aug)}")

# 방법 2: 보간법 (SMOTE 원리)
# 두 샘플 사이를 랜덤 보간
def simple_interpolation(X, y, n_aug=2):
    X_list, y_list = [X], [y]
    for _ in range(n_aug):
        idx1 = np.random.randint(0, len(X), len(X))
        idx2 = np.random.randint(0, len(X), len(X))
        lam  = np.random.rand(len(X), 1)
        X_interp = X[idx1] * lam + X[idx2] * (1 - lam)
        y_interp = (lam.ravel() >= 0.5).astype(int) * y[idx1] \
                 + (lam.ravel() < 0.5).astype(int) * y[idx2]
        X_list.append(X_interp)
        y_list.append(y_interp)
    return np.vstack(X_list), np.hstack(y_list)
```

## 체크리스트: 과대적합 해결 우선순위

| 단계 | 전략 | 언제 사용 |
|------|------|-----------|
| 1 | 더 많은 훈련 데이터 수집 | 항상 최선 |
| 2 | 데이터 증강 | 이미지·텍스트·수치 모두 적용 가능 |
| 3 | 모델 복잡도 축소 | 트리 깊이·레이어 수·파라미터 수 줄이기 |
| 4 | 정규화 (L1/L2) | 선형 모델·신경망 |
| 5 | Dropout | 신경망 |
| 6 | Early Stopping | 반복 학습 모델 |
| 7 | 앙상블 (배깅) | 고분산 단일 모델 대체 |
| 8 | 특성 개수 축소 | PCA, 중요도 기반 선택 |

---

**지난 글:** [편향-분산 트레이드오프: 과소적합과 과대적합의 근본 원인](/posts/ml-bias-variance/)

**다음 글:** [분류 모델 평가 지표 완전 정복: 정확도·정밀도·재현율·F1](/posts/ml-classification-metrics/)

<br>
읽어주셔서 감사합니다. 😊
