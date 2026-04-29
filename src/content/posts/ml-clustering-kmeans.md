---
title: "K-평균 군집화: 데이터를 K개 그룹으로 나누는 법"
description: "K-평균 알고리즘의 반복 수렴 원리, 최적 K 선택법(엘보우·실루엣), 초기화 전략 K-means++까지 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["K평균", "군집화", "클러스터링", "엘보우법", "비지도학습"]
featured: false
draft: false
---

[지난 글](/posts/ml-gradient-boosting/)에서 그래디언트 부스팅이 잔차를 순차적으로 교정해 강력한 예측기를 만드는 원리를 배웠다. 지금까지 다룬 모든 알고리즘은 **지도 학습(Supervised Learning)**이었다. 훈련 데이터에 정답 레이블이 있었고, 모델은 그 레이블을 예측하도록 최적화됐다. 이번에는 패러다임을 바꾼다. 레이블이 없는 데이터에서 스스로 구조를 찾아내는 **비지도 학습(Unsupervised Learning)**의 가장 유명한 알고리즘, **K-평균 군집화(K-Means Clustering)**를 탐구한다.

## K-평균 알고리즘의 4단계

K-평균은 데이터를 K개의 군집(Cluster)으로 나누는 가장 기본적인 알고리즘이다.

```
1. 초기화: K개의 중심점(Centroid)을 무작위로 선택
2. 할당:   각 데이터 포인트를 가장 가까운 중심점에 할당
3. 갱신:   각 군집의 평균으로 중심점 재계산
4. 반복:   중심점이 변화하지 않을 때까지 2~3 반복
```

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.preprocessing import StandardScaler

# 군집화 가능한 데이터 생성
X, y_true = make_blobs(
    n_samples=300, centers=4,
    cluster_std=0.8, random_state=42
)
X = StandardScaler().fit_transform(X)

# K-평균 학습
kmeans = KMeans(
    n_clusters=4,
    init='k-means++',   # K-means++ 초기화
    n_init=10,          # 다른 초기값으로 10회 실행 후 최선 선택
    max_iter=300,        # 최대 반복 횟수
    random_state=42
)
kmeans.fit(X)

print("군집 레이블:", kmeans.labels_[:10])
print("중심점:\n", kmeans.cluster_centers_)
print("WCSS (관성):", kmeans.inertia_)
```

![K-평균 알고리즘 반복 수렴 과정](/assets/posts/ml-clustering-kmeans-algorithm.svg)

## K-means++ 초기화: 더 나은 시작점

기본 K-평균은 초기 중심점을 무작위로 선택한다. 이 경우 지역 최솟값(Local Minimum)에 빠져 나쁜 결과가 나올 수 있다. **K-means++**는 이를 개선한 초기화 전략이다.

```
1. 첫 번째 중심점: 무작위 선택
2. 이후 중심점: 기존 중심점과 거리의 제곱에 비례하는 확률로 선택
   (거리가 멀수록 선택될 확률 높음)
3. K개의 중심점이 선택될 때까지 반복
```

```python
from sklearn.cluster import KMeans
import time

# 기본 초기화 vs K-means++ 비교
for init_method in ['random', 'k-means++']:
    start = time.time()
    km = KMeans(n_clusters=4, init=init_method,
                n_init=10, random_state=42)
    km.fit(X)
    elapsed = time.time() - start
    print(f"init={init_method:10s}: "
          f"WCSS={km.inertia_:.2f}, "
          f"시간={elapsed:.3f}s, "
          f"반복={km.n_iter_}회")

# K-means++: 수렴 빠름, 결과 안정적
# scikit-learn 기본값: init='k-means++'
```

## WCSS: 군집 품질을 측정하는 지표

**WCSS (Within-Cluster Sum of Squares)**, 즉 **관성(Inertia)**은 각 데이터 포인트와 소속 군집 중심점 사이의 거리 제곱합이다.

```
WCSS = Σᵢ Σₓ∈Cᵢ ||x - μᵢ||²
```

WCSS가 작을수록 군집 내 응집력이 높다. 하지만 K를 늘리면 WCSS는 항상 감소한다 (K=n이면 WCSS=0). 따라서 적정 K를 찾아야 한다.

## 최적 K 선택: 엘보우 법과 실루엣 계수

### 엘보우 법 (Elbow Method)

K를 늘릴 때 WCSS 감소폭이 급격히 줄어드는 "팔꿈치(Elbow)" 지점의 K를 선택한다.

```python
# 엘보우 법으로 최적 K 탐색
wcss_list = []
k_range = range(1, 11)

for k in k_range:
    km = KMeans(n_clusters=k, init='k-means++',
                n_init=10, random_state=42)
    km.fit(X)
    wcss_list.append(km.inertia_)

# 감소율 계산
for i in range(1, len(wcss_list)):
    drop = (wcss_list[i-1] - wcss_list[i]) / wcss_list[i-1] * 100
    print(f"K={i+1}: WCSS={wcss_list[i]:.2f}, "
          f"감소율={drop:.1f}%")

# 감소율이 크게 줄어드는 K가 최적
```

### 실루엣 계수 (Silhouette Score)

```python
from sklearn.metrics import silhouette_score, silhouette_samples

# 실루엣 계수: -1(나쁨) ~ 0(경계) ~ 1(좋음)
silhouette_scores = []
for k in range(2, 11):
    km = KMeans(n_clusters=k, init='k-means++',
                n_init=10, random_state=42)
    labels = km.fit_predict(X)
    score = silhouette_score(X, labels)
    silhouette_scores.append(score)
    print(f"K={k}: 실루엣 계수={score:.4f}")

best_k = range(2, 11)[np.argmax(silhouette_scores)]
print(f"\n최적 K: {best_k}")
```

![최적 K 선택: 엘보우 법과 실루엣 계수](/assets/posts/ml-clustering-kmeans-selection.svg)

## K-평균 실전: 고객 세그멘테이션

```python
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

# 고객 데이터 (RFM 분석)
data = {
    'recency':   [10, 90, 5, 120, 15, 200, 8, 45],   # 최근 구매일
    'frequency': [12, 2, 20, 1, 15, 1, 18, 5],        # 구매 빈도
    'monetary':  [500, 50, 800, 20, 600, 10, 750, 100] # 구매 금액
}
df = pd.DataFrame(data)

# 스케일링 (K-평균은 거리 기반 → 필수)
scaler = StandardScaler()
X_rfm = scaler.fit_transform(df)

# K=3으로 군집화 (VIP/일반/이탈 위험)
km = KMeans(n_clusters=3, init='k-means++',
            n_init=10, random_state=42)
df['cluster'] = km.fit_predict(X_rfm)

# 군집별 평균 특성
print(df.groupby('cluster').mean().round(1))
```

## Mini-Batch K-Means: 대용량 데이터 처리

데이터가 수십만 건 이상이면 전체 데이터를 매 반복마다 처리하는 표준 K-평균은 느리다.

```python
from sklearn.cluster import MiniBatchKMeans
import numpy as np

# 100만 건의 데이터 시뮬레이션
X_large, _ = make_blobs(n_samples=1_000_000, centers=10,
                         random_state=42)

# Mini-Batch K-Means: 배치 단위로 처리
mb_kmeans = MiniBatchKMeans(
    n_clusters=10,
    batch_size=1024,    # 배치 크기
    n_init=3,
    random_state=42
)
mb_kmeans.fit(X_large)
print("Mini-Batch 완료. WCSS:", mb_kmeans.inertia_)

# 표준 KMeans보다 빠름 (수초 vs 수분)
# WCSS는 약간 더 높을 수 있음 (속도-정확도 트레이드오프)
```

## K-평균의 한계

**한계 1: 구형(Spherical) 군집만 잘 찾음**

비구형(초승달, 링) 모양의 군집은 K-평균이 실패한다. 이런 경우 DBSCAN이나 계층적 군집화가 낫다.

**한계 2: 이상치에 민감**

이상치가 중심점을 크게 왜곡한다. 전처리 단계에서 이상치 제거 또는 K-Medoids(PAM) 사용을 고려한다.

**한계 3: K를 사전에 지정해야 함**

데이터를 보기 전에 K를 정해야 하는 것은 실무에서 불편하다. DBSCAN은 K 없이 군집 수를 자동 결정한다.

**한계 4: 초기값 의존성**

K-means++로 많이 완화됐지만, `n_init`을 높게 설정해 여러 번 실행하는 것이 안전하다.

K-평균은 단순하고 빠르며 해석이 쉽다는 장점 때문에 여전히 군집화의 기본 도구로 널리 쓰인다. 다음 글에서는 K를 미리 정하지 않아도 되는 **계층적 군집화**를 살펴본다.

---

**지난 글:** [그래디언트 부스팅: XGBoost·LightGBM의 기반 원리](/posts/ml-gradient-boosting/)

**다음 글:** [계층적 군집화: 덴드로그램으로 보는 군집 구조](/posts/ml-clustering-hierarchical/)

<br>
읽어주셔서 감사합니다. 😊
