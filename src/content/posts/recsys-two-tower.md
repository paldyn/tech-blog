---
title: "투타워 모델: 대규모 추천 시스템 구조 완전 해설"
description: "투타워(Two-Tower) 아키텍처 원리, 사용자·아이템 타워 구조, ANN 근사 최근접 이웃 검색, FAISS 벡터 검색, 실시간 서빙 파이프라인, Python 구현까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["투타워모델", "Two-Tower", "추천시스템", "ANN", "FAISS", "벡터검색", "실시간추천", "대규모추천"]
featured: false
draft: false
---

[지난 글](/posts/recsys-deep-learning/)에서 NCF, Wide&Deep, DIN 같은 딥러닝 추천 모델들이 비선형 상호작용을 어떻게 학습하는지 살펴보았다. 그런데 이 모델들은 공통적인 문제가 있다. 사용자와 아이템을 **쌍으로 함께** 입력해야 점수를 계산할 수 있다는 것이다. 사용자 1명, 아이템 1억 개라면 1억 번의 모델 추론이 필요하다. 이를 수십 밀리초 안에 해결해야 하는 실시간 추천에서는 불가능한 방식이다. 이번 글에서는 이 문제를 우아하게 해결하는 **투타워(Two-Tower) 모델**의 아키텍처와 실시간 서빙 파이프라인을 완전히 해설한다.

## 대규모 추천의 도전

Netflix는 2억 명 이상의 구독자에게 수천만 편의 콘텐츠를 추천한다. TikTok은 수십억 개의 동영상 풀에서 사용자 한 명이 피드를 열 때마다 수백 ms 안에 최적 콘텐츠를 뽑아낸다. 단순 DNN 방식으로는 절대 불가능한 규모다.

현대 대규모 추천 시스템은 **2단계 파이프라인**으로 이 문제를 해결한다.

**1단계 - 후보 생성(Retrieval/Recall)**: 수십억 개 아이템 중 수백~수천 개의 후보를 빠르게 추린다. 정밀도보다 재현율(recall)이 중요하다. 투타워 모델이 이 역할을 담당한다.

**2단계 - 랭킹(Ranking)**: 후보 수백 개를 정교한 모델로 다시 순위를 매긴다. Wide&Deep, DLRM 같은 복잡한 모델을 사용할 수 있다. 후보가 적으니 계산 비용이 허용된다.

```
전체 아이템 (수십억)
        ↓ 투타워 + ANN 검색
  후보 아이템 (수백~수천)
        ↓ 랭킹 모델
  최종 추천 (수십 개)
```

이 구조를 통해 정밀도와 속도를 동시에 달성한다.

## 투타워 아키텍처

![투타워 모델 아키텍처 & 서빙 파이프라인](/assets/posts/recsys-two-tower-architecture.svg)

투타워 모델의 핵심 아이디어는 **사용자와 아이템을 완전히 독립된 두 개의 신경망으로 처리**하는 것이다. 두 네트워크의 출력(임베딩)을 내적(dot product)으로 결합해 선호도 점수를 계산한다.

### 사용자 타워 (User Tower)

사용자 타워는 사용자 관련 모든 특성을 입력받아 고정 차원의 사용자 임베딩을 출력하는 DNN이다.

```python
class UserTower(nn.Module):
    def __init__(self, user_feat_dim, emb_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(user_feat_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, emb_dim),
        )
        self.norm = nn.functional.normalize  # L2 정규화

    def forward(self, user_features):
        emb = self.net(user_features)
        return nn.functional.normalize(emb, dim=-1)
```

입력 특성에는 사용자 ID 임베딩, 인구통계 정보(나이, 지역), 최근 행동 이력(클릭·구매), 시간대 등이 들어간다. 출력은 64~256차원의 L2 정규화된 벡터다.

### 아이템 타워 (Item Tower)

아이템 타워는 아이템 관련 특성으로 아이템 임베딩을 만든다.

```python
class ItemTower(nn.Module):
    def __init__(self, item_feat_dim, emb_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(item_feat_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, emb_dim),
        )

    def forward(self, item_features):
        emb = self.net(item_features)
        return nn.functional.normalize(emb, dim=-1)
```

아이템 특성에는 아이템 ID 임베딩, 카테고리, 태그, 제목 텍스트 인코딩, 가격, 클릭률(CTR) 통계 등이 포함된다.

### 두 임베딩의 결합: 내적

두 타워의 출력 임베딩을 내적으로 결합해 선호도 점수를 계산한다. L2 정규화된 벡터의 내적은 코사인 유사도와 동일하므로, 유사한 사용자-아이템 쌍은 높은 점수를 받는다.

```python
# 내적으로 유사도 계산
user_emb = user_tower(user_features)  # (B, D)
item_emb = item_tower(item_features)  # (B, D)
score = (user_emb * item_emb).sum(dim=-1)  # (B,)
```

## 학습 방법

투타워 모델을 효과적으로 학습하는 방법은 여러 가지가 있다.

### Pointwise 학습

각 (사용자, 아이템) 쌍에 절대적인 레이블(클릭=1, 미클릭=0)을 부여하고 이진 분류로 학습한다. 구현이 간단하지만 데이터 불균형(클릭은 전체의 1% 미만)과 네거티브 샘플 품질 문제가 있다.

```python
# BCE Loss (Binary Cross Entropy)
criterion = nn.BCEWithLogitsLoss()
loss = criterion(scores, labels)
```

### Pairwise 학습: Sampled Softmax

더 효과적인 방법은 **Sampled Softmax**다. 정답 아이템(사용자가 실제 클릭한 아이템)을 분모에 있는 랜덤 샘플된 후보들과 비교해 정답이 높은 점수를 받도록 학습한다.

```python
def sampled_softmax_loss(user_emb, pos_item_emb, neg_item_embs):
    # pos_item_emb: (B, D)
    # neg_item_embs: (B, K, D) - K개 네거티브 샘플
    pos_score = (user_emb * pos_item_emb).sum(-1, keepdim=True)  # (B, 1)
    neg_scores = torch.bmm(neg_item_embs,
                           user_emb.unsqueeze(-1)).squeeze(-1)    # (B, K)
    logits = torch.cat([pos_score, neg_scores], dim=-1)          # (B, K+1)
    labels = torch.zeros(logits.size(0), dtype=torch.long)        # 0 = 정답
    return nn.CrossEntropyLoss()(logits, labels)
```

Google의 YouTube 논문(2019)에서 Sampled Softmax 방식을 사용한 투타워 모델이 소개되어 업계 표준이 되었다.

### Negative Sampling 전략

네거티브 샘플을 어떻게 고르느냐가 모델 품질에 큰 영향을 미친다. 무작위 샘플링보다 **인기도 기반 샘플링(popularity-based negative sampling)**이 효과적이다. 인기 있는 아이템일수록 더 자주 네거티브로 사용해 모델이 인기 편향을 극복하도록 한다.

```python
# 인기도에 비례한 샘플링 (자주 등장할수록 네거티브로 더 많이)
sampling_prob = item_popularity ** 0.75  # 제곱근으로 스무딩
sampling_prob /= sampling_prob.sum()
neg_items = np.random.choice(n_items, size=K, p=sampling_prob)
```

## ANN 근사 최근접 이웃 검색

투타워 모델을 학습하고 나면 아이템 임베딩을 오프라인으로 미리 계산할 수 있다. 실시간에는 사용자 임베딩만 계산하고, 사전 인덱싱된 아이템 임베딩에서 가장 가까운 K개를 찾으면 된다. 이것이 **ANN(Approximate Nearest Neighbor) 검색**이다.

수십억 개 아이템과 정확한 최근접 이웃(Exact NN)을 찾으려면 선형 탐색이 필요해 O(N·D) 시간이 걸린다. ANN은 약간의 정확도를 희생하고 대신 O(log N) 또는 O(D·√N) 수준으로 속도를 높인다.

### FAISS (Facebook AI Similarity Search)

Meta(Facebook)가 오픈소스로 공개한 FAISS는 GPU까지 지원하는 고성능 ANN 라이브러리다.

```python
import faiss

# IndexFlatIP: 정확한 내적 검색 (소규모용)
index_exact = faiss.IndexFlatIP(64)

# IVF + PQ: 대규모 근사 검색 (수십억 아이템용)
# 클러스터 수: 보통 sqrt(N)
nlist = 1000  # 클러스터 수
m = 8         # PQ 서브벡터 수
index_approx = faiss.IndexIVFPQ(
    faiss.IndexFlatIP(64), 64, nlist, m, 8
)
index_approx.train(item_embeddings)
index_approx.add(item_embeddings)
index_approx.nprobe = 50  # 검색할 클러스터 수
```

### HNSW (Hierarchical Navigable Small World)

HNSW는 그래프 기반 ANN 알고리즘으로, FAISS에도 포함되어 있다. IVF-PQ보다 검색 정확도가 높고 온라인 삽입(새 아이템 추가)이 빠르다는 장점이 있다.

```python
# HNSW 인덱스 (높은 정확도 + 빠른 검색)
index_hnsw = faiss.IndexHNSWFlat(64, 32)  # M=32 연결
index_hnsw.add(item_embeddings)
# 검색
scores, indices = index_hnsw.search(user_emb, k=100)
```

속도 vs 정확도 트레이드오프: nprobe(IVF), efSearch(HNSW) 파라미터로 조절한다. 프로덕션에서는 P99 레이턴시 목표(예: 20ms)를 맞추는 범위에서 파라미터를 튜닝한다.

## 실전 서빙 파이프라인

투타워 모델의 가장 큰 장점은 **사용자와 아이템 계산을 완전히 분리**할 수 있다는 것이다.

**오프라인(배치)**: 아이템 타워로 전체 아이템 임베딩을 계산한다. 매일 또는 매주 배치 작업으로 실행한다. 새 아이템이 추가되면 해당 임베딩만 계산해 FAISS 인덱스에 추가한다.

**온라인(실시간)**: 사용자 요청이 들어오면 사용자 타워만 실행해 사용자 임베딩을 즉시 계산한다. 그런 다음 FAISS ANN 검색으로 Top-K 후보를 수십 ms 안에 찾는다.

```
[오프라인]
item_tower(모든 아이템) → 임베딩 배열
→ FAISS 인덱스 구축 → 인덱스 파일 저장

[온라인 - 수십 ms]
user_tower(사용자 특성) → 사용자 임베딩 (단 1회 추론)
→ FAISS.search(user_emb, k=100) → Top-100 후보 ID
→ 랭킹 모델(Wide&Deep 등) → Top-10 최종 추천
```

## 실전 코드: FAISS 투타워 추론

![FAISS 기반 투타워 추론](/assets/posts/recsys-two-tower-code.svg)

전체 추론 파이프라인을 Python 코드로 구현해보자.

```python
import faiss
import numpy as np
import torch

# 사전 계산된 아이템 임베딩 (오프라인)
item_embeddings = np.load("item_embeddings.npy")
# (N_items, D) float32

# FAISS 인덱스 구축
d = item_embeddings.shape[1]  # 임베딩 차원
index = faiss.IndexFlatIP(d)  # 내적 유사도
faiss.normalize_L2(item_embeddings)
index.add(item_embeddings)

# 실시간 추천: 사용자 임베딩 → Top-K 검색
user_emb = user_tower(user_features)  # (1, D)
user_emb = user_emb.detach().numpy()
faiss.normalize_L2(user_emb)

k = 100  # 후보 아이템 수
scores, indices = index.search(user_emb, k)
print(f"추천 아이템 ID: {indices[0][:10]}")
# → [2341, 8820, 441, 9901, ...] 상위 10개
```

실제 프로덕션에서는 FAISS 인덱스를 Redis나 전용 벡터 DB(Milvus, Weaviate)에 올려두고, gRPC 서비스로 노출해 추천 서버에서 호출하는 구조를 사용한다.

## 넥스트 스텝: 랭킹 모델

투타워 후보 생성으로 수백 개로 좁힌 후보에 **랭킹 모델**을 적용해 최종 순위를 결정한다.

**Wide&Deep / DCN**: 앞선 글에서 소개한 아키텍처가 그대로 사용된다. 이번에는 전체 아이템이 아닌 수백 개 후보에만 적용하므로 복잡한 특성 교차(feature cross)와 컨텍스트 정보를 충분히 활용할 수 있다.

**DLRM (Deep Learning Recommendation Model)**: Meta가 공개한 대규모 랭킹 모델로, 수천 개의 희소 특성(sparse feature)과 밀집 특성을 효율적으로 처리한다.

YouTube의 추천 시스템은 투타워로 Top-수백 후보를 생성하고, 별도의 랭킹 DNN으로 최종 Top-수십 개를 결정한다. TikTok은 여기에 추가로 **재순위(Re-ranking)** 단계를 두어 다양성과 신선도까지 고려한다.

```
후보 생성 (투타워 + FAISS) → 100~1000개
        ↓
  1차 랭킹 (Wide&Deep, DLRM) → 50~100개
        ↓
  재순위 (다양성·신선도 고려) → 최종 10~20개
        ↓
  사용자 피드 노출
```

투타워 모델은 구현이 비교적 단순하고 확장성이 뛰어나 현재 거의 모든 대형 추천 플랫폼의 후보 생성 레이어로 자리 잡았다. 오프라인 임베딩 계산과 온라인 ANN 검색의 조합은 수십억 규모의 아이템 풀에서도 실시간 추천을 가능하게 하는 핵심 기술이다.

---

**지난 글:** [딥러닝 추천 시스템: NCF·Wide&Deep·DIN 완전 해설](/posts/recsys-deep-learning/)

<br>
읽어주셔서 감사합니다. 😊
