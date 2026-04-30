---
title: "K-최근접 이웃(KNN): 가장 직관적인 분류 알고리즘"
description: "KNN의 원리, 거리 지표, 최적 K 선택법, 차원의 저주, KD-tree 가속까지 scikit-learn 코드와 함께 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 17
type: "knowledge"
category: "AI"
tags: ["KNN", "K최근접이웃", "거리지표", "차원의저주", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-logistic-regression/)에서 로지스틱 회귀가 시그모이드로 선형 결정 경계를 만드는 원리를 배웠다. 이번에는 전혀 다른 접근법인 **K-최근접 이웃(K-Nearest Neighbors, KNN)**을 다룬다. KNN은 "비슷한 것끼리는 비슷한 레이블을 가진다"는 간단한 가정 하나로 동작한다. 수학적 최적화도, 파라미터 학습도 없다. 새 데이터가 들어오면 훈련 데이터 중 가장 가까운 K개를 찾아 다수결로 분류한다.

## KNN의 핵심 아이디어

알고리즘은 4단계로 구성된다.

1. 훈련 데이터를 메모리에 저장 (학습 단계가 없음)
2. 새 점 x가 들어오면 훈련 데이터 전체와의 거리를 계산
3. 가장 가까운 K개의 이웃을 선택
4. 이웃들의 다수결(분류) 또는 평균(회귀)으로 예측

이 단순함 때문에 KNN을 **게으른 학습기(Lazy Learner)**라고 부른다. 학습 비용이 없는 대신 예측 비용이 비싸다.

```python
import numpy as np
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, classification_report

# 데이터 준비
X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 중요: KNN은 거리 기반 → 반드시 특성 스케일링!
scaler  = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test  = scaler.transform(X_test)

# K=5, 유클리드 거리
knn = KNeighborsClassifier(n_neighbors=5, metric='euclidean')
knn.fit(X_train, y_train)

y_pred = knn.predict(X_test)
print(f"정확도: {accuracy_score(y_test, y_pred):.4f}")
print(classification_report(y_test, y_pred, target_names=load_iris().target_names))
```

## 거리 지표의 선택

KNN의 "가까움"은 거리 지표로 정의된다.

**유클리드 거리 (기본값)**:
```
d(x, y) = √Σ(xᵢ - yᵢ)²
```
직선 거리. 연속형 수치 특성에 일반적으로 사용한다.

**맨해튼 거리**:
```
d(x, y) = Σ|xᵢ - yᵢ|
```
격자 위에서 이동하는 것처럼 계산. 이상치에 강건하고 고차원에서 유클리드보다 안정적이다.

```python
from sklearn.neighbors import KNeighborsClassifier
import numpy as np

# 거리 지표별 성능 비교
metrics = ['euclidean', 'manhattan', 'chebyshev', 'minkowski']
for metric in metrics:
    knn = KNeighborsClassifier(n_neighbors=5, metric=metric)
    knn.fit(X_train, y_train)
    acc = knn.score(X_test, y_test)
    print(f"{metric:12s}: {acc:.4f}")

# 텍스트/임베딩: 코사인 유사도가 더 적합
# 범주형 특성이 많으면: 해밍 거리 (Hamming)
knn_cos = KNeighborsClassifier(n_neighbors=5, metric='cosine')
```

## 최적 K 선택: 교차 검증

K값이 KNN의 가장 중요한 하이퍼파라미터다.

- **K가 작으면**: 과적합 (K=1이면 훈련 오차=0)
- **K가 크면**: 과소적합 (K=n이면 항상 같은 답)
- **실전 출발점**: K = √n (n: 훈련 데이터 수)

```python
from sklearn.model_selection import cross_val_score
import matplotlib
matplotlib.use('Agg')

# 교차 검증으로 최적 K 탐색
k_range = range(1, 31)
cv_scores = []

for k in k_range:
    knn = KNeighborsClassifier(n_neighbors=k)
    scores = cross_val_score(knn, X_train, y_train, cv=5, scoring='accuracy')
    cv_scores.append(scores.mean())

best_k = k_range[np.argmax(cv_scores)]
print(f"최적 K: {best_k}, CV 점수: {max(cv_scores):.4f}")

# GridSearchCV로 더 체계적인 탐색
from sklearn.model_selection import GridSearchCV

param_grid = {
    'n_neighbors': range(1, 21),
    'metric': ['euclidean', 'manhattan'],
    'weights': ['uniform', 'distance']  # 거리 가중치 여부
}

grid_search = GridSearchCV(
    KNeighborsClassifier(),
    param_grid,
    cv=5,
    scoring='accuracy',
    n_jobs=-1  # 병렬 처리
)
grid_search.fit(X_train, y_train)
print(f"최적 파라미터: {grid_search.best_params_}")
print(f"최적 CV 점수: {grid_search.best_score_:.4f}")
```

![K-최근접 이웃: 직관적 분류 원리](/assets/posts/ml-knn-visualization.svg)

## 차원의 저주

KNN의 가장 큰 약점은 **차원의 저주(Curse of Dimensionality)**다. 차원(특성 수)이 증가할수록 모든 점이 서로 멀어져 "가장 가까운 이웃"의 의미가 희석된다.

```python
import numpy as np

# 차원에 따른 거리 분포 변화 시뮬레이션
for d in [2, 10, 100, 1000]:
    # 균등 분포에서 샘플링
    samples = np.random.uniform(0, 1, (1000, d))
    query   = np.zeros(d)  # 원점
    
    distances = np.linalg.norm(samples - query, axis=1)
    print(f"차원 d={d:4d}: 평균 거리={distances.mean():.3f}, "
          f"std={distances.std():.4f}, "
          f"max/min 비율={distances.max()/distances.min():.2f}")

# d=2:    평균 0.52, max/min 비율 크게 다름
# d=1000: 평균 18.3, 모든 점이 비슷한 거리 → KNN 무의미
```

해결책:
1. **특성 선택**: 중요한 특성만 남기기
2. **PCA 전처리**: 핵심 차원으로 축소 후 KNN
3. **다른 알고리즘 고려**: 고차원에서는 트리 계열 알고리즘이 더 효과적

## 예측 속도 개선: KD-tree와 Ball-tree

기본 KNN은 예측 시 모든 훈련 데이터와 거리를 계산한다 (O(n·d)). 데이터가 많으면 매우 느리다.

```python
# KD-tree: 저차원(d<20)에서 효과적, O(log n) 탐색
knn_kd = KNeighborsClassifier(
    n_neighbors=5,
    algorithm='kd_tree',   # 또는 'ball_tree', 'brute'
    leaf_size=30
)

# Ball-tree: 고차원에서 KD-tree보다 빠를 수 있음
knn_ball = KNeighborsClassifier(
    n_neighbors=5,
    algorithm='ball_tree'
)

# 대규모 데이터 (백만 이상): FAISS, Annoy 같은 근사 최근접 이웃
# from annoy import AnnoyIndex
# 또는
# import faiss

# 자동 선택: 데이터 크기와 차원에 따라 최적 알고리즘 선택
knn_auto = KNeighborsClassifier(n_neighbors=5, algorithm='auto')
knn_auto.fit(X_train, y_train)
```

## KNN 회귀

KNN은 분류뿐만 아니라 회귀에도 사용할 수 있다. K개 이웃의 평균을 예측값으로 사용한다.

```python
from sklearn.neighbors import KNeighborsRegressor
from sklearn.metrics import mean_squared_error

# 집값 예측 같은 연속값 문제
knn_reg = KNeighborsRegressor(
    n_neighbors=5,
    weights='distance'  # 가까운 이웃에 더 큰 가중치
)
knn_reg.fit(X_train, y_train)  # y: 연속값

y_pred = knn_reg.predict(X_test)
rmse   = mean_squared_error(y_test, y_pred) ** 0.5
print(f"RMSE: {rmse:.4f}")

# weights='distance': d(x,xᵢ)에 반비례하는 가중치
# 매우 가까운 이웃이 예측에 더 큰 영향
```

![KNN 거리 지표와 scikit-learn 구현](/assets/posts/ml-knn-distance.svg)

## KNN을 언제 사용할까

**적합한 상황**:
- 데이터가 많지 않고 (수천~수만 샘플)
- 특성이 많지 않으며 (수십 특성)
- 결정 경계가 복잡하고 비선형일 때
- 빠른 프로토타이핑이 필요할 때
- 추천 시스템 (유사 사용자/상품 찾기)

**피해야 할 상황**:
- 대용량 데이터 (수백만 샘플) → 예측이 너무 느림
- 고차원 데이터 (수백 특성) → 차원의 저주
- 실시간 예측 요구 → 레이턴시 문제
- 범주형 특성이 많은 경우 → 거리 정의가 어색

KNN은 그 자체로도 유용하지만, 임베딩 기반 유사도 검색의 기반 아이디어이기도 하다. 벡터 DB(Pinecone, Weaviate)에서 수행하는 "가장 유사한 문서 검색"은 결국 고차원 임베딩 공간에서의 KNN이다.

---

**지난 글:** [로지스틱 회귀: 분류 문제의 첫 걸음](/posts/ml-logistic-regression/)

<br>
읽어주셔서 감사합니다. 😊
