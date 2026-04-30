---
title: "클러스터링 평가 지표: 실루엣·DB·칼린스키-하라바시"
description: "레이블 없이 클러스터링 품질을 측정하는 내부 지표(실루엣·Davies-Bouldin·Calinski-Harabász), 정답 레이블을 사용하는 외부 지표(ARI·NMI), 최적 K 선택 방법을 실전 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["클러스터링평가", "실루엣계수", "ARI", "비지도학습", "모델평가"]
featured: false
draft: false
---

[지난 글](/posts/ml-ranking-metrics/)에서 랭킹 모델을 평가하는 NDCG·MAP·MRR을 배웠다. 이번에는 비지도 학습인 클러스터링의 성능을 평가하는 방법으로 넘어간다. 클러스터링은 정답 레이블이 없으므로 평가 방법도 지도 학습과 근본적으로 다르다. 클러스터 자체의 내부 구조를 측정하는 **내부 지표**와, 정답 레이블과 비교하는 **외부 지표**로 나뉜다.

## 좋은 클러스터링의 조건

좋은 클러스터링이란 무엇인가? 직관적으로 두 가지 조건이 필요하다.

- **응집도(Cohesion)**: 같은 클러스터 내 포인트들이 서로 가까워야 한다
- **분리도(Separation)**: 서로 다른 클러스터는 멀리 떨어져 있어야 한다

이 두 조건을 수치화하는 방식이 내부 평가 지표의 핵심이다.

## 실루엣 계수: 가장 직관적인 내부 지표

**실루엣 계수(Silhouette Coefficient)**는 각 샘플에 대해 두 거리를 계산한다.

- **a(x)**: 같은 클러스터 내 다른 모든 포인트까지의 평균 거리 (응집도)
- **b(x)**: 가장 가까운 다른 클러스터 내 모든 포인트까지의 평균 거리 (분리도)

```
s(x) = (b(x) - a(x)) / max(a(x), b(x))
```

![실루엣 계수 원리](/assets/posts/ml-clustering-metrics-silhouette.svg)

범위는 -1~+1이다. +1에 가까울수록 해당 샘플이 올바른 클러스터에 배정되어 있고, 0은 경계선, -1에 가까울수록 잘못된 클러스터에 있다는 의미다.

```python
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, silhouette_samples
from sklearn.datasets import make_blobs
import numpy as np

X, y_true = make_blobs(n_samples=300, centers=4,
                        cluster_std=0.8, random_state=42)

# 최적 K 탐색
for k in range(2, 8):
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)
    score  = silhouette_score(X, labels)
    print(f"K={k}: Silhouette = {score:.4f}")

# 샘플별 실루엣 점수 (이상치 탐지)
best_k = 4
labels = KMeans(n_clusters=best_k, random_state=42,
                n_init=10).fit_predict(X)
sample_scores = silhouette_samples(X, labels)

# 클러스터별 평균
for c in range(best_k):
    mask = labels == c
    print(f"군집 {c}: 샘플 수={mask.sum()}, "
          f"평균 실루엣={sample_scores[mask].mean():.4f}")
```

## Davies-Bouldin 지수: 최악의 쌍을 기준으로

**Davies-Bouldin(DB) 지수**는 각 클러스터에 대해 "자신과 가장 비슷한 다른 클러스터"와의 비율을 구하고 이를 평균한다.

```
DB = (1/n) Σᵢ maxⱼ≠ᵢ [(σᵢ + σⱼ) / d(cᵢ, cⱼ)]
```

여기서 σᵢ는 클러스터 i의 평균 내부 거리, d(cᵢ, cⱼ)는 두 클러스터 중심 간 거리다. **낮을수록 좋다** (0에 가까울수록 이상적).

```python
from sklearn.metrics import davies_bouldin_score

for k in range(2, 8):
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)
    db  = davies_bouldin_score(X, labels)
    sil = silhouette_score(X, labels)
    print(f"K={k}: DB={db:.4f} (낮을수록 좋음)  "
          f"Sil={sil:.4f} (높을수록 좋음)")
```

## Calinski-Harabász 지수: 클러스터 간/내 분산비

**Calinski-Harabász(CH) 지수**는 클러스터 간 분산과 클러스터 내 분산의 비율로 계산된다. **높을수록 좋다**.

```
CH = [B / (k-1)] / [W / (n-k)]
```

B는 클러스터 간 분산, W는 클러스터 내 분산, k는 클러스터 수, n은 전체 샘플 수다.

```python
from sklearn.metrics import calinski_harabasz_score

for k in range(2, 8):
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)
    ch = calinski_harabasz_score(X, labels)
    print(f"K={k}: CH={ch:.1f} (높을수록 좋음)")
```

CH는 계산이 빠르고(O(n)) 대용량 데이터에 적합하지만, 볼록(convex)한 클러스터에서 더 잘 작동한다. DBSCAN처럼 임의 형태의 클러스터에서는 신뢰성이 떨어질 수 있다.

## 외부 지표: 정답 레이블과 비교

정답 레이블이 있을 때는 클러스터링 결과와의 일치도를 측정할 수 있다.

![클러스터링 평가 지표 코드](/assets/posts/ml-clustering-metrics-comparison.svg)

**ARI(Adjusted Rand Index)**는 두 레이블 할당의 유사도를 랜덤 기준선으로 보정해 측정한다. -1~+1 범위로, 1은 완벽한 일치, 0은 랜덤 수준이다.

**NMI(Normalized Mutual Information)**는 정보 이론적 관점에서 두 군집 간 상호 정보를 측정한다. 0~1 범위로, 1은 완벽한 일치다.

```python
from sklearn.metrics import (adjusted_rand_score,
                              normalized_mutual_info_score,
                              homogeneity_score,
                              completeness_score,
                              v_measure_score)

# K-Means 클러스터링
kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
labels_pred = kmeans.fit_predict(X)

# 외부 지표: 정답(y_true)과 예측(labels_pred) 비교
ari = adjusted_rand_score(y_true, labels_pred)
nmi = normalized_mutual_info_score(y_true, labels_pred)

# 동질성 · 완전성 · V-measure
homo = homogeneity_score(y_true, labels_pred)
comp = completeness_score(y_true, labels_pred)
vmes = v_measure_score(y_true, labels_pred)

print(f"ARI:          {ari:.4f}  (보정 랜드 지수)")
print(f"NMI:          {nmi:.4f}  (정규화 상호 정보)")
print(f"Homogeneity:  {homo:.4f} (군집=단일 클래스?)")
print(f"Completeness: {comp:.4f} (클래스=단일 군집?)")
print(f"V-measure:    {vmes:.4f} (동질성·완전성 조화평균)")
```

## 세 내부 지표로 최적 K 선택

```python
from sklearn.cluster import KMeans
from sklearn.metrics import (silhouette_score,
                              calinski_harabasz_score,
                              davies_bouldin_score)
import numpy as np

results = []
for k in range(2, 11):
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    lbl = km.fit_predict(X)

    sil = silhouette_score(X, lbl)
    ch  = calinski_harabasz_score(X, lbl)
    db  = davies_bouldin_score(X, lbl)
    results.append({'k': k, 'sil': sil, 'ch': ch, 'db': db})

# 세 지표가 동시에 좋은 K 선택
best = sorted(results, key=lambda r: r['sil'], reverse=True)
print(f"\n실루엣 기준 상위 3개:")
for r in best[:3]:
    print(f"  K={r['k']}: Sil={r['sil']:.4f}  "
          f"CH={r['ch']:.1f}  DB={r['db']:.4f}")
```

## 지표 선택 가이드

| 상황 | 권장 지표 | 이유 |
|------|-----------|------|
| 정답 레이블 없음, 일반 사용 | 실루엣 계수 | 직관적, -1~1 범위 |
| 정답 레이블 없음, 대용량 | Calinski-Harabász | 계산 빠름 (O(n)) |
| 정답 레이블 없음, 볼록 클러스터 | Davies-Bouldin | 클러스터 쌍 유사도 |
| 정답 레이블 있음 | ARI + NMI | 보정된 일치도 측정 |
| 비구형 클러스터 (DBSCAN) | 실루엣 (주의) | CH는 부적합 |

분류·회귀·랭킹에 이어 클러스터링까지 머신러닝의 주요 평가 지표를 모두 살펴봤다. 각 작업에 맞는 지표를 선택하고, 단일 숫자에만 의존하지 않고 여러 지표를 종합적으로 해석하는 것이 실무 머신러닝 엔지니어의 핵심 역량이다.

---

**지난 글:** [랭킹 모델 평가: NDCG·MAP·MRR 이해하기](/posts/ml-ranking-metrics/)

<br>
읽어주셔서 감사합니다. 😊
