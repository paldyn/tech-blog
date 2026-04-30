---
title: "랭킹 모델 평가: NDCG·MAP·MRR 이해하기"
description: "검색·추천 시스템의 랭킹 품질을 평가하는 NDCG·MAP·MRR의 계산 원리, 각각의 적용 시나리오, Python 구현 코드를 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["랭킹평가", "NDCG", "MAP", "MRR", "추천시스템"]
featured: false
draft: false
---

[지난 글](/posts/ml-regression-metrics/)에서 회귀 모델을 평가하는 방법을 배웠다. 이번에는 검색 엔진, 추천 시스템, 광고 랭킹처럼 **결과의 순서**가 중요한 시스템을 어떻게 평가하는지 살펴본다. 이 분야에서는 분류나 회귀 지표로는 랭킹 품질을 제대로 측정할 수 없다. 결과 목록에서 어떤 문서가 몇 번째에 오느냐가 핵심이기 때문이다.

## 왜 랭킹 전용 지표가 필요한가

사용자가 "파이썬 입문"이라고 검색했을 때, 검색 엔진은 수천 개의 결과 중 상위 10개를 보여준다. 이때 관련도 높은 문서가 1위~5위에 오는 모델과 6위~10위에 오는 모델은 단순 정밀도(관련 문서가 10개 중 몇 개인지)가 같아도 사용자 경험은 완전히 다르다. 높은 순위에 좋은 결과가 올수록 더 좋은 시스템이다. 랭킹 지표는 이 **순서의 질**을 수치화한다.

## NDCG: 등급별 관련도와 순위 가중치

**NDCG(Normalized Discounted Cumulative Gain)**는 세 단계로 계산된다.

**1. DCG (Discounted Cumulative Gain)**: 각 위치의 관련도 점수에 순위 할인을 적용해 합산한다.

```
DCG@k = Σᵢ₌₁ᵏ (2^relᵢ - 1) / log₂(i + 1)
```

분모 `log₂(i+1)`이 순위 할인을 적용한다. 1위 분모는 log₂(2)=1, 2위는 log₂(3)≈1.58, 5위는 log₂(6)≈2.58로 순위가 낮아질수록 커진다.

**2. IDCG (Ideal DCG)**: 관련도를 내림차순으로 정렬했을 때의 이상적인 DCG다.

**3. NDCG = DCG / IDCG**: 0~1 사이로 정규화. 1.0이면 완벽한 순위.

![NDCG 계산 과정](/assets/posts/ml-ranking-metrics-ndcg.svg)

```python
import numpy as np

def dcg_at_k(relevances, k):
    """DCG@k 계산"""
    relevances = np.array(relevances[:k], dtype=float)
    if len(relevances) == 0:
        return 0.0
    gains = (2 ** relevances - 1)
    discounts = np.log2(np.arange(2, len(relevances) + 2))
    return (gains / discounts).sum()

def ndcg_at_k(relevances, k):
    """NDCG@k 계산"""
    dcg  = dcg_at_k(relevances, k)
    idcg = dcg_at_k(sorted(relevances, reverse=True), k)
    if idcg == 0:
        return 0.0
    return dcg / idcg

# 예시: 관련도 [3, 2, 3, 0, 1]
rel = [3, 2, 3, 0, 1]
print(f"DCG@5:  {dcg_at_k(rel, 5):.4f}")
print(f"NDCG@5: {ndcg_at_k(rel, 5):.4f}")

# sklearn으로 직접 계산
from sklearn.metrics import ndcg_score

y_true = np.array([[3, 2, 3, 0, 1]])  # 실제 관련도
y_score = np.array([[0.9, 0.8, 0.7, 0.4, 0.3]])  # 모델 예측 점수

ndcg = ndcg_score(y_true, y_score, k=5)
print(f"sklearn NDCG@5: {ndcg:.4f}")
```

## MAP: 여러 쿼리에 걸친 전반적 랭킹 품질

**MAP(Mean Average Precision)**는 여러 쿼리에 대한 AP(Average Precision)의 평균이다. AP는 관련 문서가 나타날 때마다의 Precision을 평균한 것이다.

```
AP = (1/R) Σₖ P@k × rel(k)
```

여기서 R은 전체 관련 문서 수, P@k는 k번째까지의 정밀도, rel(k)는 k번째 결과의 관련 여부(0 또는 1)다.

![MAP · MRR 비교](/assets/posts/ml-ranking-metrics-map.svg)

```python
def average_precision(relevant_mask):
    """
    relevant_mask: [True, False, True, False, True]
    True = 관련 문서, False = 무관련 문서
    """
    relevant_mask = np.array(relevant_mask, dtype=bool)
    n_relevant = relevant_mask.sum()
    if n_relevant == 0:
        return 0.0

    precisions = []
    hits = 0
    for i, rel in enumerate(relevant_mask):
        if rel:
            hits += 1
            precisions.append(hits / (i + 1))

    return np.mean(precisions)

def mean_average_precision(queries_results):
    """
    queries_results: [[True,False,True,...], ...]
    각 쿼리별 관련 문서 마스크 리스트
    """
    aps = [average_precision(r) for r in queries_results]
    return np.mean(aps)

# 예시: 3개 쿼리
results = [
    [True, False, True, False, True],   # 쿼리 1
    [False, True, False, True, False],   # 쿼리 2
    [True, True, False, False, False],   # 쿼리 3
]

for i, r in enumerate(results):
    ap = average_precision(r)
    print(f"쿼리 {i+1} AP: {ap:.4f}")

map_score = mean_average_precision(results)
print(f"MAP: {map_score:.4f}")
```

## MRR: 첫 번째 정답의 순위

**MRR(Mean Reciprocal Rank)**는 각 쿼리에서 첫 번째 관련 문서의 순위 역수를 평균한다.

```
MRR = (1/|Q|) Σₖ 1 / rank_k
```

1위에 관련 문서가 있으면 1.0, 2위면 0.5, 3위면 0.33, k위면 1/k을 기여한다. 관련 문서가 전혀 없으면 0을 기여한다.

```python
def reciprocal_rank(relevant_mask):
    """첫 번째 관련 문서의 순위 역수"""
    for i, rel in enumerate(relevant_mask):
        if rel:
            return 1.0 / (i + 1)
    return 0.0

def mean_reciprocal_rank(queries_results):
    """MRR 계산"""
    rrs = [reciprocal_rank(r) for r in queries_results]
    return np.mean(rrs)

queries = [
    [True,  False, False, False],  # 1위 정답 → RR=1.0
    [False, False, True,  False],  # 3위 정답 → RR=0.33
    [False, True,  False, False],  # 2위 정답 → RR=0.5
]

for i, q in enumerate(queries):
    rr = reciprocal_rank(q)
    print(f"쿼리 {i+1}: 첫 관련={q.index(True)+1}위 RR={rr:.4f}")

mrr = mean_reciprocal_rank(queries)
print(f"MRR: {mrr:.4f}")  # (1.0 + 0.333 + 0.5) / 3 = 0.611
```

## 세 지표 비교와 선택 기준

```python
# 실전 비교: 두 모델의 랭킹 성능
import numpy as np
from sklearn.metrics import ndcg_score

# 실제 관련도 (0~3 등급)
y_true = np.array([[3, 0, 2, 1, 3, 0, 2, 1, 0, 3]])

# 모델 A: 상위에 고관련 문서 배치
scores_a = np.array([[0.95, 0.10, 0.88, 0.60,
                       0.92, 0.15, 0.75, 0.55, 0.20, 0.90]])

# 모델 B: 고관련 문서가 중간에 분산
scores_b = np.array([[0.80, 0.40, 0.70, 0.60,
                       0.50, 0.30, 0.85, 0.55, 0.20, 0.45]])

for k in [3, 5, 10]:
    ndcg_a = ndcg_score(y_true, scores_a, k=k)
    ndcg_b = ndcg_score(y_true, scores_b, k=k)
    print(f"NDCG@{k}: A={ndcg_a:.4f}  B={ndcg_b:.4f}")
```

| 지표 | 최적 사용 시나리오 | 관련 문서 수 | 등급 구분 |
|------|------------------|------------|---------|
| NDCG | 검색 엔진, 추천 시스템 | 다수 | 있음 (0~5) |
| MAP | 정보 검색, 문서 랭킹 | 다수 | 없음 (이진) |
| MRR | QA 시스템, 단답형 검색 | 소수(주로 1개) | 없음 |

---

**지난 글:** [회귀 모델 평가 지표: MAE·MSE·RMSE·R² 완전 이해](/posts/ml-regression-metrics/)

**다음 글:** [클러스터링 평가 지표: 실루엣·DB·칼린스키-하라바시](/posts/ml-clustering-metrics/)

<br>
읽어주셔서 감사합니다. 😊
