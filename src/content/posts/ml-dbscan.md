---
title: "DBSCAN: 밀도로 찾는 군집과 이상치"
description: "핵심 포인트·경계 포인트·잡음 포인트의 개념, epsilon과 min_samples 튜닝, 이상치 탐지까지 DBSCAN의 모든 것을 scikit-learn으로 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["DBSCAN", "밀도기반군집화", "이상치탐지", "군집화", "비지도학습"]
featured: false
draft: false
---

[지난 글](/posts/ml-clustering-hierarchical/)에서 계층적 군집화가 덴드로그램을 통해 군집의 계층 구조를 보여주는 방식을 공부했다. 이번엔 군집화를 완전히 다른 시각으로 바라보는 알고리즘을 소개한다. **DBSCAN(Density-Based Spatial Clustering of Applications with Noise)**은 "밀도가 높은 영역은 하나의 군집"이라는 직관에서 출발한다. K-평균처럼 군집 수를 사전에 지정하지 않아도 되고, 비구형 군집도 자연스럽게 탐지하며, 이상치(noise)를 자동으로 걸러낸다는 세 가지 특징을 동시에 갖는다.

## 밀도 기반 군집화의 직관

K-평균은 데이터를 K개 구형 그룹으로 나눈다. 이 방식은 원형 군집에는 잘 맞지만 달 모양, 링 모양, 나선형 같은 복잡한 구조에서는 완전히 실패한다. 이유는 간단하다. K-평균의 결정 경계가 선형(Voronoi 다이어그램)이기 때문이다.

DBSCAN은 발상을 바꾼다. "군집이란 빽빽하게 모여 있는 영역"이다. 점들이 밀집한 구역은 군집이고, 희박한 구역은 군집과 군집 사이의 빈 공간 또는 이상치다. 이 정의 덕분에 어떤 모양의 군집도 탐지할 수 있다.

## 두 가지 핵심 파라미터

DBSCAN의 모든 것은 두 파라미터로 결정된다.

**ε (epsilon, eps)**: 이웃 반경. 한 점의 "이웃"을 정의하는 반경이다. 이 원 안에 있는 점들이 그 점의 이웃이다.

**MinPts (min_samples)**: 핵심 포인트가 되기 위한 최소 이웃 수. ε 반경 안에 MinPts개 이상의 이웃이 있어야 핵심 포인트가 된다. 자기 자신을 포함하는지 여부는 구현에 따라 다르다. scikit-learn은 자기 자신을 포함하여 계산한다.

## 세 가지 포인트 유형

ε과 MinPts를 기준으로 모든 데이터 포인트를 세 유형으로 분류한다.

**핵심 포인트(Core Point)**: ε 반경 내에 MinPts개 이상의 점이 있는 포인트. 군집의 씨앗 역할을 한다.

**경계 포인트(Border Point)**: 자신의 ε 반경 내에는 MinPts가 안 되지만, 어떤 핵심 포인트의 ε 반경 안에는 들어가는 포인트. 군집에 속하지만 핵심은 아닌 점들이다.

**잡음 포인트(Noise Point)**: 어떤 핵심 포인트의 ε 반경에도 속하지 않는 포인트. 군집에 속하지 않으며, 이상치(outlier)로 취급된다. DBSCAN은 이 점들에 레이블 -1을 할당한다.

```python
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.datasets import make_moons
from sklearn.preprocessing import StandardScaler

# 달 모양 비선형 데이터 생성
X, _ = make_moons(n_samples=300, noise=0.05, random_state=42)
X = StandardScaler().fit_transform(X)

# DBSCAN 적용
db = DBSCAN(eps=0.3, min_samples=5)
db.fit(X)

labels = db.labels_
n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise    = np.sum(labels == -1)

print(f"발견된 군집 수: {n_clusters}")
print(f"잡음 포인트 수: {n_noise}")
print(f"군집 레이블: {np.unique(labels)}")  # [-1, 0, 1]

# 핵심, 경계, 잡음 포인트 구분
core_mask   = np.zeros(len(labels), dtype=bool)
core_mask[db.core_sample_indices_] = True

border_mask = (~core_mask) & (labels != -1)
noise_mask  = labels == -1

print(f"핵심 포인트: {core_mask.sum()}개")
print(f"경계 포인트: {border_mask.sum()}개")
print(f"잡음 포인트: {noise_mask.sum()}개")
```

![DBSCAN: 핵심·경계·잡음 포인트 시각화](/assets/posts/ml-dbscan-concept.svg)

## 군집 형성 과정: 밀도 연결

DBSCAN이 군집을 만드는 과정을 단계별로 살펴보자.

1. **임의의 미방문 포인트 p를 선택**
2. **p의 이웃 계산**: ε 반경 내의 모든 점을 찾는다
3. **핵심 포인트 판단**: 이웃 수 ≥ MinPts이면 핵심 포인트
4. **군집 확장**: 핵심 포인트 p로부터 도달 가능한 모든 포인트를 같은 군집에 추가. 이때 새로 추가된 핵심 포인트들의 이웃도 재귀적으로 탐색
5. **비핵심 처리**: 이웃 수 < MinPts이면 잡음으로 임시 분류
6. **반복**: 모든 포인트를 방문할 때까지 1-5 반복

중요한 개념이 **밀도 연결(Density-Connected)**이다. 두 점 p, q가 어떤 핵심 포인트 o를 통해 연결될 수 있으면 "밀도 연결"되었다고 한다. DBSCAN은 밀도 연결된 모든 점을 하나의 군집으로 묶는다.

## ε 튜닝: k-거리 그래프

DBSCAN의 성능은 ε 선택에 크게 의존한다. ε이 너무 작으면 대부분의 포인트가 잡음이 되고, 너무 크면 모든 포인트가 하나의 군집이 된다.

가장 널리 사용되는 ε 추정법은 **k-거리 그래프(k-distance graph)**다.

```python
from sklearn.neighbors import NearestNeighbors
import numpy as np

# MinPts = min_samples로 설정
min_samples = 5
k = min_samples  # 보통 min_samples와 동일하게 설정

# 각 포인트에서 k번째 가장 가까운 이웃까지의 거리 계산
nbrs = NearestNeighbors(n_neighbors=k).fit(X)
distances, _ = nbrs.kneighbors(X)

# k번째 거리만 추출하고 정렬
k_distances = distances[:, -1]
k_distances_sorted = np.sort(k_distances)[::-1]

# 그래프를 보면 "팔꿈치(elbow)" 지점을 찾는다
# 팔꿈치 지점의 y값 ≈ 최적 ε
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

plt.figure(figsize=(8, 4))
plt.plot(k_distances_sorted)
plt.xlabel('데이터 포인트 (정렬됨)')
plt.ylabel(f'{k}-번째 이웃까지의 거리')
plt.title('k-거리 그래프: ε 선택 가이드')
plt.axhline(y=0.3, color='red', linestyle='--', label='선택된 ε=0.3')
plt.legend()
plt.tight_layout()
plt.savefig('k_distance.png', dpi=100)

print("그래프에서 급격히 꺾이는 지점의 y값을 ε로 선택")
```

MinPts의 기본 선택 규칙은 `MinPts ≥ 차원 수 + 1`이다. 2차원 데이터에서는 보통 4~5, 고차원 데이터에서는 더 크게 설정한다. 데이터에 노이즈가 많을수록 MinPts를 크게 하면 더 견고한 군집을 얻을 수 있다.

## K-평균과의 비교

![K-평균 vs DBSCAN: 비구형 군집 처리](/assets/posts/ml-dbscan-comparison.svg)

```python
from sklearn.cluster import KMeans, DBSCAN
from sklearn.datasets import make_moons, make_circles
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import adjusted_rand_score
import numpy as np

# 달 모양 데이터
X_moons, y_moons = make_moons(n_samples=300, noise=0.05, random_state=42)
X_moons = StandardScaler().fit_transform(X_moons)

# 링 데이터
X_circles, y_circles = make_circles(n_samples=300, noise=0.05,
                                    factor=0.5, random_state=42)
X_circles = StandardScaler().fit_transform(X_circles)

datasets = [("달 모양", X_moons, y_moons),
            ("링 모양", X_circles, y_circles)]

for name, X, y_true in datasets:
    # K-평균
    km = KMeans(n_clusters=2, random_state=42, n_init=10)
    km_labels = km.fit_predict(X)
    km_ari = adjusted_rand_score(y_true, km_labels)

    # DBSCAN
    db = DBSCAN(eps=0.3, min_samples=5)
    db_labels = db.fit_predict(X)
    db_ari = adjusted_rand_score(y_true, db_labels)

    print(f"\n[{name}]")
    print(f"  K-평균 ARI: {km_ari:.4f}")
    print(f"  DBSCAN ARI: {db_ari:.4f}")
    # 달·링 모양: K-평균 ≈ 0.3, DBSCAN ≈ 1.0
```

조정 랜드 지수(ARI)는 1.0에 가까울수록 정답 레이블과 일치한다. 비구형 데이터에서 DBSCAN이 K-평균을 압도하는 것을 확인할 수 있다.

## 이상치 탐지(Anomaly Detection) 활용

DBSCAN의 강력한 부산물은 잡음 포인트를 이상치로 활용할 수 있다는 점이다.

```python
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

# 신용카드 거래 이상치 탐지 예시
np.random.seed(42)

# 정상 거래 (두 군집)
normal_1 = np.random.randn(200, 2) * [0.5, 10] + [2, 100]
normal_2 = np.random.randn(200, 2) * [1.0, 20] + [5, 500]

# 이상 거래 (희박하게 분산)
anomalies = np.random.uniform(low=[-5, -200], high=[15, 800], size=(10, 2))

X_all = np.vstack([normal_1, normal_2, anomalies])
X_scaled = StandardScaler().fit_transform(X_all)

# DBSCAN으로 이상치 탐지
db = DBSCAN(eps=0.5, min_samples=10)
labels = db.fit_predict(X_scaled)

# 레이블 -1 = 이상치
anomaly_indices = np.where(labels == -1)[0]
anomaly_ratio   = len(anomaly_indices) / len(X_all)

print(f"탐지된 이상 거래: {len(anomaly_indices)}건")
print(f"이상치 비율: {anomaly_ratio:.2%}")
print(f"실제 이상 거래 위치: {anomaly_indices[anomaly_indices >= 400]}")
```

신용카드 사기, 네트워크 침입 탐지, 센서 이상 감지 등 실무에서 DBSCAN 기반 이상치 탐지를 폭넓게 활용한다.

## HDBSCAN: 계층적 DBSCAN

DBSCAN의 가장 큰 단점 중 하나는 **균일한 밀도를 가정**한다는 점이다. 밀도가 서로 다른 두 군집이 있을 때, 하나의 ε 값으로는 두 군집을 동시에 잘 탐지하기 어렵다.

**HDBSCAN(Hierarchical DBSCAN)**은 이 문제를 해결한다. DBSCAN을 다양한 ε 값에서 실행한 결과를 계층적으로 정리해서, 각 군집에 가장 적합한 ε을 자동으로 선택한다.

```python
# pip install hdbscan
import hdbscan
import numpy as np
from sklearn.datasets import make_blobs

# 밀도가 다른 두 군집
X1, _ = make_blobs(n_samples=100, centers=[[0, 0]], cluster_std=0.3)
X2, _ = make_blobs(n_samples=100, centers=[[5, 5]], cluster_std=1.5)
X = np.vstack([X1, X2])

# HDBSCAN: min_cluster_size만 설정하면 됨
clusterer = hdbscan.HDBSCAN(
    min_cluster_size=10,    # 군집의 최소 크기
    min_samples=5,          # 핵심 포인트 기준 (생략 가능)
    cluster_selection_epsilon=0.0  # 0이면 계층 구조 그대로 사용
)
labels = clusterer.fit_predict(X)

print(f"군집 수: {len(set(labels)) - (1 if -1 in labels else 0)}")
print(f"잡음 포인트: {(labels == -1).sum()}개")

# 각 포인트가 군집에 속할 확률도 제공
print(f"멤버십 확률 평균: {clusterer.probabilities_.mean():.4f}")
```

HDBSCAN은 최근 많은 실무 프로젝트에서 DBSCAN의 자리를 대신하고 있다.

## 실전 주의사항

**고차원 데이터에서 성능 저하.** 차원이 높아질수록 모든 점 사이의 거리가 비슷해지는 차원의 저주 때문에 ε 설정이 어려워진다. PCA나 UMAP으로 차원을 축소한 뒤 DBSCAN을 적용하는 것이 일반적인 해법이다.

```python
from sklearn.decomposition import PCA
from sklearn.cluster import DBSCAN

# 고차원 데이터: PCA로 축소 후 DBSCAN
pca = PCA(n_components=2)
X_2d = pca.fit_transform(X_high_dim)

db = DBSCAN(eps=0.5, min_samples=5)
labels = db.fit_predict(X_2d)
```

**스케일링은 반드시 필요하다.** ε은 절대적인 거리 값이다. 특성의 스케일이 다르면 ε의 의미가 특성마다 달라진다. StandardScaler 또는 MinMaxScaler로 전처리한 뒤 DBSCAN을 실행해야 한다.

**계산 복잡도.** 기본 DBSCAN의 시간 복잡도는 O(n log n) (k-d 트리 사용 시)에서 최악 O(n²)다. scikit-learn의 구현은 내부적으로 k-d 트리 또는 볼 트리를 사용하므로 중간 규모(수만 개)까지는 무리 없이 동작한다.

```python
from sklearn.cluster import DBSCAN

# 대용량 데이터 최적화 옵션
db = DBSCAN(
    eps=0.5,
    min_samples=5,
    algorithm='ball_tree',  # 'auto', 'ball_tree', 'kd_tree', 'brute'
    n_jobs=-1               # 병렬 처리
)
```

## DBSCAN 알고리즘 장단점 총정리

**장점**
- K(군집 수)를 사전에 지정하지 않아도 됨
- 비구형, 비볼록(non-convex) 군집도 탐지
- 이상치를 자동으로 식별 (레이블 -1)
- 결정론적: 초기화에 무관하게 동일한 결과
- 군집 크기가 불균등해도 잘 작동

**단점**
- ε과 MinPts 설정이 결과에 크게 영향 — 적절한 튜닝 필요
- 밀도가 군집마다 크게 다를 경우 단일 ε으로 처리 어려움 → HDBSCAN으로 해결
- 고차원 데이터에서 차원의 저주로 성능 저하
- 시간 복잡도 최악 O(n²): 초대규모 데이터 처리 한계

---

**지난 글:** [계층적 군집화: 덴드로그램으로 보는 군집 구조](/posts/ml-clustering-hierarchical/)

**다음 글:** [PCA: 고차원 데이터를 압축하는 차원 축소](/posts/ml-pca/)

<br>
읽어주셔서 감사합니다. 😊
