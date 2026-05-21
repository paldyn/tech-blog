---
title: "협업 필터링: 유사 사용자·아이템 기반 추천 완전 해설"
description: "사용자 기반·아이템 기반 협업 필터링 원리, 코사인 유사도·피어슨 상관계수, 메모리 기반 vs 모델 기반 CF, Python 구현 코드까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["협업필터링", "추천시스템", "사용자기반CF", "아이템기반CF", "코사인유사도", "피어슨상관계수", "추천알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/multimodal-evaluation/)에서는 멀티모달 AI 모델을 평가하는 다양한 벤치마크를 살펴봤습니다. 이번에는 완전히 다른 분야로 이동합니다. 여러분이 넷플릭스에서 영화를 보고 나면 "당신이 좋아할 것 같은 영화"가 뜨고, 아마존에서 상품을 구경하면 "이 상품을 구매한 고객이 함께 구매한 상품"이 나타납니다. 이 모든 것의 뒤에는 추천 시스템(Recommender System)이 있으며, 그 핵심 알고리즘 중 하나가 바로 **협업 필터링(Collaborative Filtering, CF)**입니다.

## 협업 필터링이란?

협업 필터링의 핵심 아이디어는 단순하면서도 강력합니다. **"비슷한 취향을 가진 사람들은 새로운 것에 대해서도 비슷한 반응을 보인다."** 영화 A, B, C를 모두 좋아하는 두 사람이 있다면, 한 사람이 영화 D를 좋아할 경우 다른 사람도 D를 좋아할 가능성이 높다는 것입니다. 이 원리를 수학적으로 구현한 것이 협업 필터링입니다.

협업 필터링의 핵심 데이터 구조는 **사용자-아이템 행렬(User-Item Matrix)**입니다. 행은 사용자, 열은 아이템(영화, 상품, 음악 등)을 나타내며, 각 셀에는 해당 사용자가 해당 아이템에 부여한 평점(또는 클릭, 구매 여부 등의 암시적 피드백)이 들어갑니다.

```python
# 사용자-아이템 행렬 예시
#         영화A  영화B  영화C  영화D  영화E
# 사용자1:   5     3     ?     1     4
# 사용자2:   4     ?     4     1     2
# 사용자3:   1     1     ?     5     4
# 사용자4:   ?     3     ?     4     3
# 사용자5:   2     1     5     ?     ?
```

이 행렬에서 `?`는 아직 평가하지 않은 아이템입니다. 협업 필터링의 목표는 이 빈칸을 정확히 예측해 각 사용자에게 가장 좋아할 만한 아이템을 추천하는 것입니다. 실제 서비스에서 이 행렬은 엄청난 희소성(sparsity)을 보입니다. 넷플릭스 같은 플랫폼에서 사용자 수 × 콘텐츠 수의 조합 중 실제로 평가된 비율은 1% 미만인 경우가 많습니다.

## 사용자 기반 협업 필터링

![협업 필터링 개념 다이어그램](/assets/posts/recsys-collaborative-filtering-concept.svg)

**사용자 기반 CF(User-based CF)**는 가장 직관적인 접근법입니다. 추천 대상 사용자와 유사한 취향을 가진 다른 사용자들을 찾아, 그들이 좋아하지만 대상 사용자는 아직 보지 않은 아이템을 추천합니다.

유사도 측정에 가장 많이 쓰이는 두 가지 방법을 살펴봅시다.

**코사인 유사도(Cosine Similarity)**는 두 사용자의 평점 벡터를 고차원 공간의 벡터로 보고, 그 사이의 각도를 측정합니다. 절대적인 평점 크기보다 패턴의 방향을 비교하는 것이 핵심입니다.

```python
import numpy as np

def cosine_similarity_manual(u, v):
    """
    두 사용자 벡터 간 코사인 유사도 계산
    0으로 표시된 미평가 항목은 무시
    """
    # 둘 다 평가한 항목만 사용
    rated = (u != 0) & (v != 0)
    u_r, v_r = u[rated], v[rated]
    
    if len(u_r) == 0:
        return 0.0
    
    dot_product = np.dot(u_r, v_r)
    norm_u = np.linalg.norm(u_r)
    norm_v = np.linalg.norm(v_r)
    
    return dot_product / (norm_u * norm_v + 1e-8)
```

**피어슨 상관계수(Pearson Correlation Coefficient)**는 코사인 유사도보다 한 단계 발전한 방법입니다. 사용자마다 평점 기준이 다를 수 있다는 점을 보정합니다. 어떤 사람은 3점이 보통이고 어떤 사람은 4점이 보통일 수 있는데, 피어슨 상관계수는 각자의 평균을 빼서 이 차이를 제거합니다.

```python
def pearson_correlation(u, v):
    """피어슨 상관계수 기반 유사도"""
    rated = (u != 0) & (v != 0)
    u_r, v_r = u[rated], v[rated]
    
    if len(u_r) < 2:
        return 0.0
    
    u_mean = np.mean(u_r)
    v_mean = np.mean(v_r)
    
    numerator = np.sum((u_r - u_mean) * (v_r - v_mean))
    denominator = (np.sqrt(np.sum((u_r - u_mean)**2)) *
                   np.sqrt(np.sum((v_r - v_mean)**2)) + 1e-8)
    
    return numerator / denominator
```

**평점 예측 공식**은 Top-K 유사 사용자들의 가중 평균을 사용합니다. 유사도가 높은 사용자일수록 예측에 더 큰 영향을 미칩니다.

$$\hat{r}_{u,i} = \bar{r}_u + \frac{\sum_{v \in N(u)} \text{sim}(u,v) \cdot (r_{v,i} - \bar{r}_v)}{\sum_{v \in N(u)} |\text{sim}(u,v)|}$$

여기서 $N(u)$는 사용자 u의 K명의 유사 이웃, $\bar{r}_u$는 사용자 u의 평균 평점입니다.

## 아이템 기반 협업 필터링

**아이템 기반 CF(Item-based CF)**는 사용자 간 유사도 대신 아이템 간 유사도를 계산합니다. "이 영화와 비슷한 영화는 무엇인가?"를 먼저 파악하고, 사용자가 본 영화와 유사한 영화를 추천합니다. 아마존의 "이 상품을 구매한 고객이 함께 구매한 상품"이 대표적인 예입니다.

```python
from sklearn.metrics.pairwise import cosine_similarity

def item_based_recommend(ratings, user_id, top_n=5):
    """
    아이템 기반 CF 추천
    ratings: (n_users, n_items) 행렬
    """
    # 아이템 간 유사도 (열 방향으로 계산)
    item_sim = cosine_similarity(ratings.T)
    
    user_ratings = ratings[user_id]
    unrated_items = np.where(user_ratings == 0)[0]
    
    predictions = {}
    for item in unrated_items:
        # 해당 사용자가 평가한 아이템들
        rated_items = np.where(user_ratings > 0)[0]
        
        # 유사 아이템들의 가중 평균
        sim_scores = item_sim[item, rated_items]
        rated_scores = user_ratings[rated_items]
        
        if sim_scores.sum() > 0:
            predictions[item] = (
                np.dot(sim_scores, rated_scores) / sim_scores.sum()
            )
    
    # 예측 평점 높은 순으로 정렬
    recommended = sorted(
        predictions.items(), key=lambda x: x[1], reverse=True
    )
    return recommended[:top_n]
```

아이템 기반 CF가 사용자 기반 CF보다 실용적인 이유가 있습니다. 첫째, **아이템 수는 사용자 수보다 훨씬 적고 변화도 느립니다**. 신규 사용자는 매일 수만 명이 가입하지만, 넷플릭스의 영화 수는 상대적으로 안정적입니다. 아이템 간 유사도를 미리 계산해두면 실시간 추천 속도가 빨라집니다. 둘째, 아이템 유사도는 사용자가 추가되더라도 크게 변하지 않으므로 **캐싱과 재사용이 용이**합니다.

## 메모리 기반 vs 모델 기반 CF

지금까지 살펴본 방식은 **메모리 기반 CF(Memory-based CF)**입니다. 전체 사용자-아이템 행렬을 메모리에 저장하고, 추천 시 직접 유사도를 계산합니다. 이해하기 쉽고 구현이 단순하지만, 데이터가 커질수록 계산 비용이 급격히 증가합니다.

**모델 기반 CF(Model-based CF)**는 데이터에서 패턴을 학습한 모델을 통해 추천합니다. 대표적인 방법이 **행렬 분해(Matrix Factorization)**입니다.

```python
# SVD 기반 행렬 분해 (Surprise 라이브러리)
from surprise import SVD, Dataset, Reader
from surprise.model_selection import cross_validate

# 데이터 준비
reader = Reader(rating_scale=(1, 5))
data = Dataset.load_from_df(
    df[['user_id', 'item_id', 'rating']], reader
)

# SVD 모델 학습
algo = SVD(n_factors=50, n_epochs=20, lr_all=0.005, reg_all=0.02)
results = cross_validate(algo, data, measures=['RMSE', 'MAE'], cv=5)

print(f"RMSE: {results['test_rmse'].mean():.4f}")
print(f"MAE:  {results['test_mae'].mean():.4f}")
```

행렬 분해는 사용자 행렬 U와 아이템 행렬 V로 원래 행렬을 분해합니다. 각 사용자와 아이템을 k차원의 잠재 벡터(latent vector)로 표현하고, 두 벡터의 내적으로 평점을 예측합니다. 이 잠재 공간에서 가까운 사용자끼리, 가까운 아이템끼리 비슷한 취향이나 속성을 공유하게 됩니다.

## CF의 한계

협업 필터링은 강력하지만 몇 가지 근본적인 한계가 있습니다.

**콜드 스타트 문제(Cold Start Problem)**는 가장 잘 알려진 한계입니다. 신규 사용자는 아직 아무것도 평가하지 않았으므로, 유사 사용자를 찾을 수 없습니다. 마찬가지로 새로 추가된 아이템은 아직 누군가가 평가하지 않았으므로, 아이템 기반 CF에서도 추천되기 어렵습니다. 이를 해결하기 위해 신규 사용자에게는 인구통계학적 정보나 설문을 활용하고, 신규 아이템에는 콘텐츠 기반 필터링을 병행하는 하이브리드 접근이 일반적입니다.

**데이터 희소성(Data Sparsity)**은 특히 긴 꼬리(long tail) 아이템에서 두드러집니다. 인기 없는 아이템은 평가 수가 적어 유사도 계산이 부정확해지고, 결국 추천에서 배제됩니다.

**인기 편향(Popularity Bias)**은 많은 사람이 평가한 인기 아이템이 유사도 계산에서 유리한 위치를 점하는 현상입니다. 결과적으로 이미 인기 있는 아이템이 더 많이 추천되는 자기 강화 루프가 생깁니다. 사용자 입장에서는 '새로운 발견'이 줄어드는 문제로 이어집니다.

**확장성(Scalability)** 문제도 무시할 수 없습니다. 사용자가 1억 명이고 아이템이 100만 개라면, 유사도 행렬만 해도 수 테라바이트에 달합니다. 실시간으로 모든 유사도를 계산하는 것은 불가능에 가깝습니다.

## 실전 코드

![User-based CF 구현 코드](/assets/posts/recsys-collaborative-filtering-code.svg)

위 코드에서 핵심 흐름을 짚어보면, sklearn의 `cosine_similarity`로 전체 사용자 간 유사도 행렬을 한 번에 계산하고, `np.argsort`로 가장 유사한 사용자 K명을 선택한 후, 그들의 평점 평균으로 미평가 아이템의 예측 평점을 구합니다. 이 간단한 구현으로도 소규모 데이터셋에서는 충분히 의미 있는 추천 결과를 얻을 수 있습니다.

```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

ratings = np.array([
    [5, 3, 0, 1, 4],
    [4, 0, 4, 1, 2],
    [1, 1, 0, 5, 4],
    [0, 3, 0, 4, 3],
    [2, 1, 5, 0, 0],
])

sim = cosine_similarity(ratings)

# 사용자 0의 아이템 2 예측 평점
user_id, item_id = 0, 2
k = 3
similar = np.argsort(sim[user_id])[-k-1:-1][::-1]
pred = np.mean(ratings[similar, item_id])
print(f"예측 평점: {pred:.2f}")
```

주의할 점은 미평가(0) 항목을 그대로 사용하면 코사인 유사도가 왜곡된다는 것입니다. 실제 구현에서는 0을 제외하거나, 평균 평점으로 대체하거나, 마스킹 처리를 해야 더 정확한 결과를 얻을 수 있습니다.

## 실용 라이브러리: Surprise, LightFM

연구나 빠른 프로토타이핑을 위해 검증된 라이브러리를 활용하는 것이 효율적입니다.

**Surprise**는 Python의 CF 전용 라이브러리로, KNN 기반 CF부터 SVD, NMF 등 다양한 알고리즘을 지원합니다. scikit-learn과 유사한 API 덕분에 진입 장벽이 낮습니다.

```python
from surprise import KNNBasic, Dataset, Reader
from surprise.model_selection import train_test_split
from surprise import accuracy

reader = Reader(rating_scale=(1, 5))
data = Dataset.load_from_df(df[['user', 'item', 'rating']], reader)
trainset, testset = train_test_split(data, test_size=0.2)

# User-based KNN CF
algo = KNNBasic(k=40, sim_options={
    'name': 'cosine',
    'user_based': True  # False로 바꾸면 Item-based CF
})
algo.fit(trainset)

predictions = algo.test(testset)
print(f"RMSE: {accuracy.rmse(predictions):.4f}")
```

**LightFM**은 명시적 피드백(평점)과 암시적 피드백(클릭, 구매)을 모두 처리할 수 있으며, 사용자와 아이템의 메타데이터(특성 정보)를 결합한 하이브리드 모델도 지원합니다. 콜드 스타트 문제를 어느 정도 완화할 수 있어, 실제 프로덕션 환경에서 자주 선택됩니다.

협업 필터링은 추천 시스템의 출발점이자 여전히 강력한 기법입니다. 다음 글에서는 사용자 간 유사도 대신 아이템 자체의 속성을 분석해 추천하는 콘텐츠 기반 필터링을 알아보겠습니다.

---

**지난 글:** [멀티모달 AI 평가: MMBench·MMMU·VQA 벤치마크 완전 해설](/posts/multimodal-evaluation/)

**다음 글:** [콘텐츠 기반 필터링: 아이템 특성으로 추천하는 방법 완전 해설](/posts/recsys-content-based/)

<br>
읽어주셔서 감사합니다. 😊
