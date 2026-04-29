---
title: "결정 트리: 질문의 연쇄로 만드는 분류 모델"
description: "엔트로피, 지니 불순도, 정보 이득을 이해하고, 결정 트리의 학습 원리와 과적합 제어를 scikit-learn으로 실습한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["결정트리", "엔트로피", "정보이득", "지니불순도", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-svm/)에서 서포트 벡터 머신이 마진을 최대화하는 초평면을 찾아 분류하는 원리를 배웠다. 이번에 살펴볼 **결정 트리(Decision Tree)**는 SVM과 완전히 다른 방식으로 작동한다. "나이가 30세 미만인가?", "소득이 5만 달러 이상인가?"처럼 일련의 예/아니오 질문을 연쇄적으로 던지며 데이터를 분기해 나가는 구조다. 마치 스무고개를 하듯 질문을 좁혀가며 결론에 도달하기 때문에, 전문가가 아니어도 모델이 왜 이 예측을 했는지 직관적으로 이해할 수 있다.

## 결정 트리의 직관: 스무고개처럼 분류

결정 트리의 구조는 세 종류의 노드로 이루어진다.

- **루트 노드(Root Node)**: 트리의 최상단. 전체 데이터를 처음 분기하는 질문
- **내부 노드(Internal Node)**: 중간 분기점. 조건에 따라 왼쪽 또는 오른쪽 하위 트리로 데이터를 보냄
- **리프 노드(Leaf Node)**: 트리의 끝. 최종 예측 클래스(또는 회귀값)가 저장됨

Iris 데이터셋을 예로 들면, "꽃잎 길이 ≤ 2.45?"라는 루트 노드 질문에 "예"라고 답하면 즉시 Setosa로 분류된다. "아니오"라면 "꽃잎 너비 ≤ 1.75?"라는 두 번째 질문으로 넘어가 Versicolor 또는 Virginica를 가린다. 불과 두 번의 질문으로 세 클래스를 거의 완벽하게 분리할 수 있다.

![결정 트리 구조: 루트 노드부터 리프 노드까지](/assets/posts/ml-decision-tree-structure.svg)

## 불순도(Impurity): 엔트로피 vs. 지니 계수

결정 트리가 "좋은 질문"을 고르는 기준이 **불순도(Impurity)**다. 한 노드 안에 여러 클래스가 뒤섞여 있으면 불순도가 높고, 하나의 클래스만 존재하면 불순도가 0(순수)이다.

### 엔트로피 (Entropy)

정보 이론에서 빌려온 개념으로, 불확실성의 정도를 나타낸다.

```
H = -Σ pᵢ · log₂(pᵢ)
```

클래스 비율이 p일 때, p = 0 또는 p = 1이면 H = 0(순수), p = 0.5이면 H = 1.0(최대 불확실성)이다. ID3, C4.5 알고리즘이 엔트로피를 사용한다.

### 지니 계수 (Gini Impurity)

```
G = 1 - Σ pᵢ²
```

계산이 더 단순하다. p = 0.5일 때 G = 0.5(최대), p = 0 또는 1일 때 G = 0이다. scikit-learn의 `DecisionTreeClassifier` 기본값이며, CART(Classification And Regression Trees) 알고리즘이 지니 계수를 사용한다.

두 지표는 대부분의 경우 비슷한 트리를 만들어낸다. 엔트로피가 log 연산으로 인해 계산 비용이 약간 높지만, 실전에서 성능 차이는 미미하다. 일반적으로 지니 계수를 기본값으로 두고 교차 검증으로 비교해 보는 것이 권장된다.

## 정보 이득(Information Gain)으로 분기 결정

결정 트리는 각 후보 분기점에서 **정보 이득(Information Gain)**을 계산해 가장 높은 분기를 선택한다.

```
IG(부모, 분기) = H(부모) - Σ (자식 샘플 수 / 전체) × H(자식)
```

즉, 분기 전 불순도에서 분기 후 자식들의 가중 평균 불순도를 뺀 값이다. 이 값이 클수록 해당 분기가 데이터를 더 "잘" 나눈다는 의미다.

```python
import numpy as np

def entropy(y):
    """클래스 레이블 배열로부터 엔트로피 계산"""
    classes, counts = np.unique(y, return_counts=True)
    probs = counts / len(y)
    return -np.sum(probs * np.log2(probs + 1e-9))

def information_gain(y, y_left, y_right):
    """분기 전후 정보 이득 계산"""
    n = len(y)
    n_l, n_r = len(y_left), len(y_right)
    gain = entropy(y) - (n_l/n * entropy(y_left) + n_r/n * entropy(y_right))
    return gain

# 예시: 10개 샘플 [5개 클래스A, 5개 클래스B]
y = np.array([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
# 분기 후: 왼쪽 [4A, 1B], 오른쪽 [1A, 4B]
y_left  = np.array([0, 0, 0, 0, 1])
y_right = np.array([0, 1, 1, 1, 1])

ig = information_gain(y, y_left, y_right)
print(f"정보 이득: {ig:.4f}")  # 0.2780 — 분기가 유효함
```

## CART 알고리즘

scikit-learn의 결정 트리는 **CART(Classification And Regression Trees)** 알고리즘을 사용한다. CART의 핵심 특징은 다음과 같다.

- **이진 분기**: 항상 두 개의 자식 노드로만 분기 (다중 분기 없음)
- **탐욕적 탐색**: 매 분기마다 지역 최적(Local Optimum) 선택. 전역 최적을 보장하지 않음
- **회귀 지원**: 분류뿐 아니라 회귀 문제에도 사용 (지니 → MSE/MAE)
- **연속/범주형 특성 모두 처리**: 범주형은 더미화 없이도 처리 가능

## 과적합과 가지치기

결정 트리의 가장 큰 약점은 **과적합(Overfitting)**이다. 제약 없이 성장하면 훈련 데이터의 모든 패턴(잡음 포함)을 기억하는 복잡한 트리가 만들어진다. 이를 제어하는 방법이 **가지치기(Pruning)**다.

### Pre-pruning (사전 가지치기)

트리가 자라는 도중에 성장을 멈추는 방법이다. scikit-learn이 지원하는 주요 파라미터들이 여기에 해당한다.

| 파라미터 | 역할 | 기본값 |
|---|---|---|
| `max_depth` | 트리 최대 깊이 | None (무제한) |
| `min_samples_split` | 내부 노드 분기 최소 샘플 수 | 2 |
| `min_samples_leaf` | 리프 노드 최소 샘플 수 | 1 |
| `max_leaf_nodes` | 최대 리프 노드 수 | None |
| `min_impurity_decrease` | 분기로 인한 최소 불순도 감소량 | 0.0 |

### Post-pruning (사후 가지치기)

트리를 완전히 성장시킨 후 다시 잘라내는 방법이다. scikit-learn은 **비용-복잡도 가지치기(Cost-Complexity Pruning)**를 지원한다.

```python
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import cross_val_score
import numpy as np

# 최적 ccp_alpha 탐색
clf_full = DecisionTreeClassifier(random_state=42)
clf_full.fit(X_train, y_train)

# 가지치기 경로 계산
path = clf_full.cost_complexity_pruning_path(X_train, y_train)
ccp_alphas = path.ccp_alphas[:-1]  # 마지막은 루트만 남은 극단적 트리

cv_scores = []
for alpha in ccp_alphas:
    clf = DecisionTreeClassifier(ccp_alpha=alpha, random_state=42)
    scores = cross_val_score(clf, X_train, y_train, cv=5)
    cv_scores.append(scores.mean())

best_alpha = ccp_alphas[np.argmax(cv_scores)]
print(f"최적 ccp_alpha: {best_alpha:.4f}")
```

## scikit-learn 구현 및 트리 시각화

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, plot_tree, export_text
from sklearn.metrics import accuracy_score, classification_report
import matplotlib.pyplot as plt

# 데이터 준비
X, y = load_iris(return_X_y=True)
feature_names = load_iris().feature_names
class_names   = load_iris().target_names

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 모델 훈련 (Pre-pruning 적용)
clf = DecisionTreeClassifier(
    criterion='gini',
    max_depth=4,
    min_samples_split=10,
    min_samples_leaf=4,
    random_state=42
)
clf.fit(X_train, y_train)

# 평가
y_pred = clf.predict(X_test)
print(f"정확도: {accuracy_score(y_test, y_pred):.4f}")
print(classification_report(y_test, y_pred, target_names=class_names))

# 텍스트 형식 트리 출력
print(export_text(clf, feature_names=list(feature_names)))

# matplotlib 시각화
fig, ax = plt.subplots(figsize=(14, 6))
plot_tree(
    clf,
    feature_names=feature_names,
    class_names=class_names,
    filled=True,       # 클래스별 색상
    rounded=True,      # 노드 모서리 둥글게
    fontsize=10,
    ax=ax
)
plt.savefig('decision_tree.png', dpi=150, bbox_inches='tight')
```

## 특성 중요도(Feature Importance)

결정 트리는 학습 후 각 특성이 불순도 감소에 얼마나 기여했는지를 **특성 중요도**로 제공한다. 이 값은 0~1 사이로 정규화되어 합이 1이 된다.

```python
import pandas as pd

# 특성 중요도 확인
importance_df = pd.DataFrame({
    'feature': feature_names,
    'importance': clf.feature_importances_
}).sort_values('importance', ascending=False)

print(importance_df)
# feature              importance
# petal length (cm)    0.9198
# petal width (cm)     0.0543
# sepal length (cm)    0.0259
# sepal width (cm)     0.0000

# 중요도가 0인 특성은 트리에서 한 번도 사용되지 않은 것
# → 특성 선택(Feature Selection)의 참고 자료로 활용
```

주의: MDI(Mean Decrease in Impurity) 방식의 특성 중요도는 **카디널리티가 높은 특성(연속형, 많은 범주)을 과대평가**하는 경향이 있다. 더 신뢰할 수 있는 평가를 원한다면 **Permutation Importance**를 사용하자.

```python
from sklearn.inspection import permutation_importance

perm_imp = permutation_importance(
    clf, X_test, y_test,
    n_repeats=30,
    random_state=42,
    n_jobs=-1
)

perm_df = pd.DataFrame({
    'feature': feature_names,
    'importance_mean': perm_imp.importances_mean,
    'importance_std': perm_imp.importances_std
}).sort_values('importance_mean', ascending=False)

print(perm_df)
```

![불순도 비교와 DecisionTreeClassifier 파라미터](/assets/posts/ml-decision-tree-impurity.svg)

## 핵심 하이퍼파라미터 튜닝 가이드

실전에서 결정 트리를 튜닝할 때의 전략을 정리한다.

```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'max_depth': [3, 5, 7, 10, None],
    'min_samples_split': [2, 5, 10, 20],
    'min_samples_leaf': [1, 2, 4, 8],
    'criterion': ['gini', 'entropy']
}

grid_search = GridSearchCV(
    DecisionTreeClassifier(random_state=42),
    param_grid,
    cv=5,
    scoring='accuracy',
    n_jobs=-1,
    verbose=1
)
grid_search.fit(X_train, y_train)

print(f"최적 파라미터: {grid_search.best_params_}")
print(f"CV 정확도: {grid_search.best_score_:.4f}")

best_clf = grid_search.best_estimator_
test_acc = best_clf.score(X_test, y_test)
print(f"테스트 정확도: {test_acc:.4f}")
```

**튜닝 전략**:
1. `max_depth`부터 시작. 3~5 정도로 작게 잡으면 빠르게 과적합을 제어할 수 있다.
2. `min_samples_split`과 `min_samples_leaf`는 데이터 크기에 비례해 설정. 데이터가 많을수록 큰 값 사용.
3. `criterion`은 두 값을 모두 시도해보되, 성능 차이가 크지 않으면 빠른 `gini`를 선택.
4. `ccp_alpha`는 마지막에 사후 가지치기용으로 시도.

## 결정 트리의 장단점

### 장점

**해석 가능성(Interpretability)**: 모델의 결정 과정을 사람이 직접 읽을 수 있다. 의료, 금융처럼 "왜 이 예측을 했는가?"가 중요한 분야에서 강점이다.

**전처리 불필요**: 특성 스케일링(StandardScaler 등)이 필요 없다. 결정 트리는 특성의 절대값이 아니라 분기 임계값을 기준으로 작동하기 때문이다.

**결측치 처리**: 일부 구현에서 결측치를 자동으로 처리할 수 있다.

**비선형 관계 처리**: 선형 모델로는 포착하기 어려운 비선형 패턴을 자연스럽게 학습한다.

### 단점

**높은 분산(High Variance)**: 훈련 데이터의 작은 변화에도 완전히 다른 구조의 트리가 만들어질 수 있다. 이것이 결정 트리의 가장 큰 약점이다.

**불안정성**: 데이터를 조금만 바꿔도 트리 구조가 크게 달라진다.

**직교 결정 경계**: 결정 트리의 분기는 항상 하나의 특성을 기준으로 수직/수평으로 나눈다. 대각선 방향의 결정 경계를 표현하려면 깊은 트리가 필요하다.

**과적합**: 제약 없이 성장하면 훈련 오차가 0에 가까워지지만, 테스트 성능은 급격히 떨어진다.

이러한 단점들, 특히 높은 분산 문제는 다음 글에서 다룰 **랜덤 포레스트**가 해결한다. 수백 개의 결정 트리를 앙상블하면 개별 트리의 분산이 평균화되어 훨씬 안정적인 모델이 만들어진다.

---

**지난 글:** [서포트 벡터 머신(SVM): 최대 마진 분류기의 원리](/posts/ml-svm/)

**다음 글:** [랜덤 포레스트: 앙상블 학습의 교과서](/posts/ml-random-forest/)

<br>
읽어주셔서 감사합니다. 😊
