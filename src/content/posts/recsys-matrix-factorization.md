---
title: "행렬 분해(MF): SVD·ALS·FunkSVD 추천 알고리즘 완전 해설"
description: "잠재 요인 모델·행렬 분해 원리, SVD·FunkSVD·ALS·BPR 알고리즘, SGD 최적화, Python Surprise 라이브러리 실전 코드까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["행렬분해", "SVD", "ALS", "FunkSVD", "BPR", "잠재요인모델", "추천시스템", "MF"]
featured: false
draft: false
---

[지난 글](/posts/recsys-content-based/)에서 아이템의 특성을 벡터로 표현해 유사한 콘텐츠를 추천하는 콘텐츠 기반 필터링을 살펴봤다. 이번에는 협업 필터링과 콘텐츠 기반 필터링 모두의 진화된 형태이자, 2009년 Netflix Prize를 통해 추천 시스템의 판도를 바꾼 기법인 **행렬 분해(Matrix Factorization, MF)**를 깊이 파헤친다. 행렬 분해는 단순히 "비슷한 사람 찾기"나 "비슷한 아이템 찾기"를 넘어, 사용자와 아이템을 동일한 잠재 공간에 투영해 평점을 예측한다. 이 발상의 전환이 추천 시스템 정확도를 획기적으로 끌어올렸다.

## 잠재 요인 모델이란?

영화 평점 데이터를 보면 흥미로운 패턴이 숨어 있다. SF 영화를 좋아하는 사람들은 서로 모르는 사이여도 비슷한 영화에 높은 점수를 준다. 이 패턴을 만드는 **관찰되지 않은 숨겨진 특성**이 바로 잠재 요인(Latent Factor)이다.

잠재 요인 모델은 이렇게 가정한다. 각 사용자는 k개의 잠재 요인에 대한 선호도 벡터를 갖고, 각 아이템은 k개의 잠재 요인에 대한 특성 벡터를 갖는다. 사용자의 아이템 평점은 두 벡터의 내적(dot product)으로 근사할 수 있다.

예를 들어 k=3이라고 하면 잠재 요인이 "SF 선호도", "로맨스 선호도", "액션 선호도"처럼 해석될 수 있다. 하지만 중요한 것은 **이 요인들은 명시적으로 레이블링되지 않는다**. 모델이 데이터로부터 자동으로 발견한다. 사람이 이름을 붙이는 것은 사후 해석에 불과하다.

## 행렬 분해 원리

사용자-아이템 평점 행렬 R을 두 개의 작은 행렬로 분해하는 것이 핵심이다.

![행렬 분해(Matrix Factorization) 개념](/assets/posts/recsys-matrix-factorization-concept.svg)

R (m×n 행렬) ≈ P (m×k 행렬) × Q^T (k×n 행렬)

- **m**: 사용자 수
- **n**: 아이템 수
- **k**: 잠재 요인 수 (하이퍼파라미터, 보통 10~200)
- **P[u]**: 사용자 u의 잠재 요인 벡터
- **Q[i]**: 아이템 i의 잠재 요인 벡터

사용자 u가 아이템 i에 줄 것으로 예측되는 평점은 다음과 같이 계산된다.

$$\hat{r}_{ui} = P_u \cdot Q_i^T = \sum_{f=1}^{k} P_{uf} \cdot Q_{if}$$

### 손실 함수

알려진 평점들에 대해 예측값과 실제값의 차이를 최소화한다. 과적합 방지를 위해 정규화 항을 추가한다.

$$\mathcal{L} = \sum_{(u,i) \in \mathcal{K}} (r_{ui} - P_u \cdot Q_i^T)^2 + \lambda(\|P_u\|^2 + \|Q_i\|^2)$$

여기서 K는 관찰된 평점의 집합, λ는 정규화 계수다.

```python
import numpy as np

def mf_loss(R, P, Q, lambda_reg=0.02):
    """관찰된 평점에 대한 MSE + L2 정규화"""
    mask = R > 0  # 관찰된 평점 위치
    R_hat = P @ Q.T
    mse = np.sum((R[mask] - R_hat[mask]) ** 2)
    reg = lambda_reg * (np.sum(P**2) + np.sum(Q**2))
    return mse + reg
```

잠재 요인 k가 너무 작으면 정보 손실이 크고(언더피팅), 너무 크면 과적합된다. k를 선택할 때는 교차 검증으로 최적값을 찾는다.

## SVD와 FunkSVD

### 일반 SVD의 문제

수학적 SVD(Singular Value Decomposition)는 완전한 행렬에 대해 정확한 분해를 제공한다. 하지만 실제 평점 행렬은 **99% 이상이 비어 있는 극도로 희소한(sparse)** 행렬이다. 빈 값을 0으로 채우면 "관심 없음"과 "평점 안 매김"을 구별할 수 없어 예측이 크게 왜곡된다.

### Netflix Prize의 FunkSVD

2006년 Netflix Prize 경진대회에서 Simon Funk(실명 Brandon Fried)가 공개한 접근이 판도를 바꿨다. 핵심 아이디어는 단순하다. **관찰된 평점에 대해서만** 경사 하강법(SGD)으로 P와 Q를 업데이트하면, 희소 행렬 문제를 자연스럽게 피할 수 있다.

```python
def funk_svd_update(r_ui, p_u, q_i, lr=0.005, reg=0.02):
    """SGD로 잠재 벡터 업데이트"""
    err = r_ui - np.dot(p_u, q_i)  # 예측 오차
    # 그래디언트 계산 및 업데이트
    p_u_new = p_u + lr * (err * q_i - reg * p_u)
    q_i_new = q_i + lr * (err * p_u - reg * q_i)
    return p_u_new, q_i_new
```

FunkSVD는 또한 **바이어스 항(Bias Term)**을 추가해 정확도를 높인다. 어떤 사용자는 원래 평점을 짜게 주고, 어떤 아이템은 전반적으로 높은 평점을 받는 경향이 있다. 이를 전역 평균 μ, 사용자 바이어스 b_u, 아이템 바이어스 b_i로 모델링한다.

$$\hat{r}_{ui} = \mu + b_u + b_i + P_u \cdot Q_i^T$$

```python
# 바이어스 포함 예측
def predict(mu, b_u, b_i, p_u, q_i):
    return mu + b_u + b_i + np.dot(p_u, q_i)
```

## ALS (Alternating Least Squares)

SGD가 한 번에 하나의 샘플을 업데이트하는 것과 달리, ALS는 P와 Q를 **번갈아 가며 최소 제곱법**으로 한꺼번에 최적화한다.

아이디어: Q를 고정하면 각 사용자의 P_u를 독립적으로 최적화할 수 있다. 반대로 P를 고정하면 각 아이템의 Q_i를 독립적으로 최적화할 수 있다.

```python
def als_update_user(R, Q, lambda_reg):
    """Q 고정 상태에서 P 최적화 (닫힌 형태 해)"""
    k = Q.shape[1]
    P = np.zeros((R.shape[0], k))
    for u in range(R.shape[0]):
        # 유저 u가 평가한 아이템 인덱스
        rated = R[u, :].nonzero()[0]
        if len(rated) == 0:
            continue
        Q_u = Q[rated, :]
        r_u = R[u, rated]
        # 최적 P_u: (Q_u^T Q_u + λI)^-1 Q_u^T r_u
        A = Q_u.T @ Q_u + lambda_reg * np.eye(k)
        b = Q_u.T @ r_u
        P[u, :] = np.linalg.solve(A, b)
    return P
```

### ALS의 장점: 분산 처리

SGD는 순차적 업데이트가 필요해 병렬화가 어렵다. 반면 ALS는 각 사용자/아이템 벡터를 **독립적으로** 계산하므로 완벽한 병렬화가 가능하다. Apache Spark의 MLlib에서 ALS를 지원하는 이유가 바로 이것이다.

### Implicit Feedback ALS

명시적 평점(1~5점)이 아닌 클릭, 구매, 재생 횟수 같은 **암묵적 피드백(Implicit Feedback)**에는 Hu et al.(2008)의 ALS 변형이 효과적이다. 관찰 횟수 c_ui를 신뢰도(confidence)로 변환해 가중치로 활용한다.

```python
def confidence(count, alpha=40):
    """구매/클릭 횟수를 신뢰도로 변환"""
    return 1 + alpha * count
# count=0: confidence=1 (관찰 안됨, 약한 부정)
# count=5: confidence=201 (5번 구매, 강한 긍정)
```

## BPR (Bayesian Personalized Ranking)

명시적 평점이 없고 클릭·구매 이진 데이터만 있는 상황에서, BPR은 다른 접근을 취한다. **"절대 점수"를 예측하는 대신 "쌍별 선호(pairwise preference)"를 학습**한다.

"사용자 u가 아이템 i를 구매했고, j는 구매하지 않았다면, u는 i를 j보다 선호할 가능성이 높다"

이 가정을 베이지안 관점으로 공식화하면, 최적화 목표는 다음과 같다.

$$\text{BPR-OPT} = \sum_{(u,i,j) \in D_S} \ln \sigma(\hat{r}_{ui} - \hat{r}_{uj}) - \lambda_\theta \|\Theta\|^2$$

```python
def bpr_update(p_u, q_i, q_j, lr=0.01, reg=0.01):
    """BPR 쌍별 업데이트 (i: 구매, j: 미구매)"""
    x_uij = np.dot(p_u, q_i) - np.dot(p_u, q_j)
    sigmoid = 1 / (1 + np.exp(x_uij))  # ∂σ/∂x_uij

    p_u  += lr * (sigmoid * (q_i - q_j) - reg * p_u)
    q_i  += lr * (sigmoid * p_u - reg * q_i)
    q_j  += lr * (-sigmoid * p_u - reg * q_j)
    return p_u, q_i, q_j
```

BPR은 암묵적 피드백에서 클릭·구매 여부만으로 순위를 학습하므로, 실제 전자상거래나 스트리밍 서비스처럼 명시적 평점이 없는 환경에 강하다.

## 실전 코드

Python의 `Surprise` 라이브러리로 SVD를 쉽게 구현할 수 있다.

![Surprise SVD 라이브러리 실전 코드](/assets/posts/recsys-matrix-factorization-code.svg)

위 코드는 `MovieLens 100K` 데이터셋 기준으로 RMSE 약 0.87 수준을 달성한다. `n_factors`(잠재 요인 수)와 `reg_all`(정규화 강도)이 성능에 가장 큰 영향을 미치는 하이퍼파라미터다.

```python
from surprise import SVD, Dataset
from surprise.model_selection import GridSearchCV

# 하이퍼파라미터 그리드 탐색
param_grid = {
    'n_factors': [20, 50, 100],
    'n_epochs': [20, 30],
    'lr_all': [0.005, 0.01],
    'reg_all': [0.02, 0.1]
}

gs = GridSearchCV(SVD, param_grid,
                  measures=['rmse'], cv=3)
gs.fit(data)
print(gs.best_params['rmse'])
# {'n_factors': 100, 'n_epochs': 30,
#  'lr_all': 0.005, 'reg_all': 0.02}
```

실제 서비스에서는 Surprise 대신 대규모 데이터를 처리할 수 있는 **Spark MLlib ALS** 또는 **implicit** 라이브러리를 사용한다.

## 평가: RMSE vs 랭킹 지표

### RMSE와 MAE (평점 예측 정확도)

RMSE(Root Mean Square Error)와 MAE(Mean Absolute Error)는 평점 예측의 정확도를 측정한다.

$$\text{RMSE} = \sqrt{\frac{1}{|\mathcal{T}|}\sum_{(u,i) \in \mathcal{T}} (r_{ui} - \hat{r}_{ui})^2}$$

MovieLens 100K에서 SVD의 RMSE는 약 0.87, 무작위 추천은 약 1.5~1.7이다. 하지만 RMSE가 낮다고 추천 목록이 실제로 유용한지는 별개 문제다.

### Precision@K와 Recall@K (랭킹 품질)

실제 서비스에서 중요한 것은 "Top-K 추천 목록에 실제로 좋아할 아이템이 얼마나 포함되어 있느냐"다.

```python
def precision_at_k(recommended, relevant, k=10):
    """추천 상위 K개 중 실제 좋아한 비율"""
    top_k = recommended[:k]
    hits = len(set(top_k) & set(relevant))
    return hits / k

def recall_at_k(recommended, relevant, k=10):
    """실제 좋아한 아이템 중 추천된 비율"""
    top_k = recommended[:k]
    hits = len(set(top_k) & set(relevant))
    return hits / len(relevant) if relevant else 0
```

### NDCG@K (순위 품질)

Normalized Discounted Cumulative Gain은 추천 순위도 고려한다. 좋아하는 아이템이 1등에 있으면 점수가 높고, 10등에 있으면 점수가 낮다.

```python
import numpy as np

def ndcg_at_k(recommended, relevant, k=10):
    """순위 가중 추천 품질 지표"""
    top_k = recommended[:k]
    dcg = sum(
        1 / np.log2(rank + 2)
        for rank, item in enumerate(top_k)
        if item in relevant
    )
    ideal = sum(1 / np.log2(i + 2) for i in range(min(len(relevant), k)))
    return dcg / ideal if ideal > 0 else 0
```

현업에서는 RMSE보다 **Precision@10**, **NDCG@10**, **Hit Rate** 같은 랭킹 지표를 주요 KPI로 사용한다. 평점 예측 정확도와 실제 클릭·구매 증가 사이의 상관관계가 생각보다 약하기 때문이다. 더 나아가 온라인 A/B 테스트를 통한 CTR(클릭률), CVR(전환율) 측정이 최종 진실에 가장 가깝다.

행렬 분해는 현재도 추천 시스템의 핵심 구성 요소로 사용되지만, 더 복잡한 패턴을 포착하기 위해 딥러닝과 결합되는 방향으로 발전하고 있다. 다음 글에서는 신경망이 추천에 어떻게 활용되는지, NCF·Wide&Deep·DIN 같은 딥러닝 추천 모델을 다룬다.

---

**지난 글:** [콘텐츠 기반 필터링: 아이템 특성으로 추천하는 방법 완전 해설](/posts/recsys-content-based/)

**다음 글:** [딥러닝 추천 시스템: NCF·Wide&Deep·DIN 완전 해설](/posts/recsys-deep-learning/)

<br>
읽어주셔서 감사합니다. 😊
