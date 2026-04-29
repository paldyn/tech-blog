---
title: "계층적 군집화: 덴드로그램으로 보는 군집 구조"
description: "응집형·분리형 계층 군집화의 원리, 연결 기준(Ward·Complete·Average), 덴드로그램 해석법을 scipy와 scikit-learn으로 실습한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["계층적군집화", "덴드로그램", "응집형군집화", "Ward연결", "비지도학습"]
featured: false
draft: false
---

[지난 글](/posts/ml-clustering-kmeans/)에서 K-평균 군집화가 데이터를 K개 그룹으로 나누는 원리를 살펴봤다. K-평균은 빠르고 간단하지만 한 가지 중요한 약점이 있다. 군집 수 K를 사전에 지정해야 한다는 것이다. 데이터를 처음 탐색하는 단계에서 K가 몇 개인지 미리 알기란 쉽지 않다. **계층적 군집화(Hierarchical Clustering)**는 이 문제를 다르게 풀어낸다. 모든 병합(또는 분리) 과정을 나무 구조로 기록해 두고, 나중에 원하는 수준에서 군집 수를 결정할 수 있다.

## 두 가지 방향: Bottom-up vs. Top-down

계층적 군집화에는 두 가지 접근 방향이 있다.

**응집형(Agglomerative, Bottom-up)**은 각 데이터 포인트를 하나의 군집으로 시작해서 점점 합쳐 나간다. 가장 가까운 두 군집을 반복적으로 합치다 보면 결국 모든 데이터가 하나의 큰 군집이 된다. 실무에서 압도적으로 많이 사용되는 방식이다.

**분리형(Divisive, Top-down)**은 반대로 전체를 하나의 군집으로 시작해서 점점 쪼개 나간다. 재귀적으로 분리를 수행하므로 구현이 복잡하고 계산 비용이 크다. 실용적인 상황에서 분리형은 거의 사용되지 않는다.

이 글에서는 응집형을 중심으로 설명한다.

## 덴드로그램(Dendrogram): 병합 과정의 시각화

응집형 군집화의 전 과정을 시각화한 것이 **덴드로그램**이다. 트리 구조로 생각하면 이해하기 쉽다.

- **잎(Leaf)**: 맨 아래의 개별 데이터 포인트
- **가지(Branch)**: 두 군집이 합쳐지는 지점
- **가로 선의 높이**: 그 병합이 이루어질 때의 거리(비유사도)
- **루트(Root)**: 맨 위의 단일 군집

높이가 높을수록 두 군집이 서로 이질적이라는 뜻이다. 반대로 낮은 높이에서 합쳐진 군집들은 서로 유사한 그룹이다.

![계층적 군집화: 덴드로그램 구조와 해석](/assets/posts/ml-clustering-hierarchical-dendrogram.svg)

## 군집 수 K 결정: 수평 절단선

덴드로그램의 핵심 활용법은 **수평 절단선(horizontal cut)**이다. 적당한 높이에서 수평선을 그으면, 그 선이 자르는 수직 가지의 수가 곧 군집 수 K가 된다.

최적의 절단 위치를 찾는 직관적인 규칙은 **가장 긴 수직 선을 찾아 그 중간을 자르는 것**이다. 긴 수직 선은 두 군집 사이의 거리가 크다는 뜻 — 즉 그 위아래가 자연스러운 군집 경계임을 의미한다.

```python
import numpy as np
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.datasets import make_blobs

# 예제 데이터 생성
X, _ = make_blobs(n_samples=50, centers=3, random_state=42)

# 연결 행렬 계산 (Ward 방법)
Z = linkage(X, method='ward')

# 덴드로그램 그리기
plt.figure(figsize=(12, 6))
plt.title('Hierarchical Clustering Dendrogram')
dendrogram(
    Z,
    truncate_mode='level',  # 일정 레벨까지만 표시
    p=5,
    leaf_rotation=90,
    leaf_font_size=10
)
plt.xlabel('데이터 포인트 인덱스')
plt.ylabel('병합 거리 (Ward)')
plt.axhline(y=10, color='red', linestyle='--', label='K=3 절단선')
plt.legend()
plt.tight_layout()
plt.savefig('dendrogram.png', dpi=100)

# 절단해서 레이블 얻기
labels = fcluster(Z, t=3, criterion='maxclust')  # K=3
print(f"군집 레이블: {np.unique(labels)}")  # [1, 2, 3]
```

## 연결 기준(Linkage Criterion): 군집 간 거리를 어떻게 정의할까

응집형 군집화에서 "두 군집 사이의 거리"를 어떻게 측정하느냐에 따라 결과가 크게 달라진다. 이 측정 방식을 **연결 기준(Linkage Criterion)**이라고 한다.

### Single Linkage: 가장 가까운 두 점

두 군집 사이에서 **가장 가까운 점 쌍의 거리**를 군집 간 거리로 사용한다.

```
d(A, B) = min { dist(a, b) | a ∈ A, b ∈ B }
```

- 장점: 사슬 모양처럼 늘어진 비구형 군집도 탐지 가능
- 단점: **연쇄 효과(Chaining Effect)** — 이상치 하나가 두 군집을 연결해버릴 수 있음. 노이즈에 매우 취약하다.

### Complete Linkage: 가장 먼 두 점

두 군집 사이에서 **가장 먼 점 쌍의 거리**를 사용한다.

```
d(A, B) = max { dist(a, b) | a ∈ A, b ∈ B }
```

- 장점: 컴팩트하고 균일한 크기의 구형 군집을 선호
- 단점: 이상치가 군집 간 거리를 과대평가하게 만들 수 있음

### Average Linkage: 모든 쌍의 평균 거리

두 군집의 **모든 점 쌍 거리의 평균**을 사용한다.

```
d(A, B) = (1/|A||B|) Σ dist(a, b)
```

- 장점: Single과 Complete의 중간 특성. 이상치 영향을 어느 정도 완화
- 단점: 두 방법의 중간 정도의 성능을 보임

### Ward Linkage: 분산 최소화 ★

병합 후 **군집 내 분산의 증가량**을 최소화하는 방향으로 군집을 합친다. 즉, 합쳤을 때 "가장 손해가 적은" 두 군집을 선택한다.

```
ΔW(A, B) = |A||B| / (|A|+|B|) × dist(μA, μB)²
```

여기서 μA, μB는 각 군집의 중심점이다. 합병으로 인한 SSE(Sum of Squared Errors) 증가량을 계산한다.

- 장점: **균일하고 컴팩트한 구형 군집** 생성. 실전에서 가장 좋은 결과를 내는 경우가 많음
- 단점: 유클리드 거리에만 적용 가능. 비유클리드 공간에서는 사용 불가

```python
from scipy.cluster.hierarchy import linkage
import numpy as np

# 네 가지 연결 방법 비교
methods = ['single', 'complete', 'average', 'ward']

for method in methods:
    Z = linkage(X, method=method)
    # Z의 각 행: [군집1, 군집2, 거리, 합쳐진 포인트 수]
    print(f"\n[{method.upper()}] 마지막 5번의 병합:")
    for row in Z[-5:]:
        print(f"  군집 {int(row[0])} + 군집 {int(row[1])} "
              f"→ 거리: {row[2]:.3f}, 크기: {int(row[3])}")
```

![연결 기준 비교: Single, Complete, Ward](/assets/posts/ml-clustering-hierarchical-linkage.svg)

## scikit-learn으로 실습: AgglomerativeClustering

```python
from sklearn.cluster import AgglomerativeClustering
from sklearn.datasets import make_blobs
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import numpy as np

# 데이터 준비
X, y_true = make_blobs(n_samples=200, centers=4,
                       cluster_std=0.8, random_state=42)
X_scaled = StandardScaler().fit_transform(X)

# Ward 연결로 K=4 군집화
model = AgglomerativeClustering(
    n_clusters=4,
    linkage='ward',        # 'single', 'complete', 'average', 'ward'
    metric='euclidean'     # Ward는 euclidean만 지원
)
labels = model.fit_predict(X_scaled)

# 실루엣 점수로 품질 평가
score = silhouette_score(X_scaled, labels)
print(f"실루엣 점수: {score:.4f}")  # 1에 가까울수록 좋음

# 최적 K 탐색: 실루엣 점수 비교
scores = []
k_range = range(2, 10)

for k in k_range:
    agg = AgglomerativeClustering(n_clusters=k, linkage='ward')
    lbl = agg.fit_predict(X_scaled)
    scores.append(silhouette_score(X_scaled, lbl))

best_k = k_range[np.argmax(scores)]
print(f"최적 K: {best_k}, 실루엣 점수: {max(scores):.4f}")
```

## K-평균 vs. 계층적 군집화: 무엇을 선택할까

| 항목 | K-평균 | 계층적 (Ward) |
|------|--------|---------------|
| K 사전 지정 | 필수 | 불필요 (나중에 결정) |
| 계산 복잡도 | O(n·K·iter) | O(n² log n) |
| 메모리 | O(n) | O(n²) |
| 군집 모양 | 구형만 | 주로 구형 (Ward 기준) |
| 결정론적 | 아니오 (초기화 의존) | 예 |
| 해석 | 중심점 | 덴드로그램 |
| 대규모 데이터 | 적합 | 비적합 (n > 10,000) |

계층적 군집화가 특히 유용한 상황:
- 데이터 탐색 초기 단계에서 K를 알 수 없을 때
- 군집 간의 계층적 관계 자체가 분석 목적일 때 (예: 유전자 발현 분석, 문서 분류 체계)
- 비교적 소규모 데이터셋 (수백~수천 개)

K-평균이 더 나은 상황:
- n > 10,000 이상의 대규모 데이터
- 실시간 또는 반복적인 재군집화가 필요할 때
- K가 도메인 지식으로 어느 정도 알려진 경우

## scipy로 덴드로그램 고급 활용

```python
from scipy.cluster.hierarchy import (
    dendrogram, linkage, fcluster,
    cophenet, inconsistent
)
from scipy.spatial.distance import pdist
import numpy as np

X = np.random.randn(30, 2)  # 예제 데이터
Z = linkage(X, method='ward')

# 1. 공표적 상관계수 (Cophenetic Correlation)
#    덴드로그램이 원본 거리를 얼마나 잘 보존하는지 측정
c, coph_dists = cophenet(Z, pdist(X))
print(f"공표적 상관계수: {c:.4f}")  # 0.9 이상이면 우수

# 2. 비일관성 계수 (Inconsistency Coefficient)
#    각 병합의 '비정상성'을 측정 → 절단 위치 결정에 활용
incon = inconsistent(Z, d=2)
print("비일관성 상위 5:")
print(incon[-5:])

# 3. 원하는 거리 임계값으로 절단
labels_dist = fcluster(Z, t=5.0, criterion='distance')
# 4. 원하는 군집 수로 절단
labels_k = fcluster(Z, t=3, criterion='maxclust')
print(f"거리 기준: {len(np.unique(labels_dist))}개 군집")
print(f"K 기준: {len(np.unique(labels_k))}개 군집")
```

## 실전 팁: 전처리와 주의사항

**스케일링은 필수다.** 계층적 군집화도 거리 기반이므로, 특성 간 스케일 차이가 크면 큰 값의 특성이 거리를 지배한다.

```python
from sklearn.preprocessing import StandardScaler, RobustScaler

# 이상치가 없다면: StandardScaler
X_std = StandardScaler().fit_transform(X)

# 이상치가 있다면: RobustScaler (중앙값·IQR 기반)
X_rob = RobustScaler().fit_transform(X)

# Ward + 유클리드: StandardScaler 권장
# Complete/Average + 맨해튼: RobustScaler도 무방
```

**범주형 특성 처리.** 연속형 수치 외의 데이터에는 다른 거리 지표가 필요하다.

```python
from sklearn.cluster import AgglomerativeClustering

# 맨해튼 거리로 변경 (Ward는 euclidean만 지원)
model_manhattan = AgglomerativeClustering(
    n_clusters=3,
    linkage='average',    # Ward 외 방법
    metric='manhattan'
)
```

**메모리 주의.** 응집형 군집화는 n×n 거리 행렬을 저장해야 하므로 n이 크면 메모리 부족이 발생한다. n > 10,000에서는 mini-batch K-평균이나 BIRCH 같은 대안을 검토해야 한다.

## 계층적 군집화의 장단점 요약

**장점**
- K를 미리 정하지 않아도 된다 — 덴드로그램을 보고 사후에 결정 가능
- 결정론적: 같은 데이터에 항상 같은 결과
- 군집 간의 계층 구조 자체가 정보가 됨
- 다양한 연결 기준으로 다양한 군집 형태 처리 가능

**단점**
- 시간 복잡도 O(n² log n), 메모리 O(n²): 대규모 데이터에 부적합
- 한번 합쳐진 군집은 되돌릴 수 없음 (greedy 방식)
- Ward 기준도 결국 구형 군집을 선호 — 매우 불규칙한 형태의 군집에는 한계

다음 글에서는 완전히 다른 접근법인 **밀도 기반 군집화**를 다룬다. DBSCAN은 K를 지정할 필요도 없고, 비구형 군집도 자연스럽게 찾아내며, 이상치를 자동으로 걸러낸다.

---

**지난 글:** [K-평균 군집화: 데이터를 K개 그룹으로 나누는 법](/posts/ml-clustering-kmeans/)

**다음 글:** [DBSCAN: 밀도로 찾는 군집과 이상치](/posts/ml-dbscan/)

<br>
읽어주셔서 감사합니다. 😊
