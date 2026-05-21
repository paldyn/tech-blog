---
title: "딥러닝 추천 시스템: NCF·Wide&Deep·DIN 완전 해설"
description: "Neural Collaborative Filtering·Wide&Deep·Deep Interest Network 아키텍처, 임베딩 기반 추천, 행동 시퀀스 모델링, Python PyTorch NCF 구현까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["딥러닝추천", "NCF", "Wide&Deep", "DIN", "신경망추천", "임베딩추천", "행동시퀀스", "추천시스템"]
featured: false
draft: false
---

[지난 글](/posts/recsys-matrix-factorization/)에서 행렬 분해(SVD, ALS, FunkSVD)가 사용자-아이템 상호작용을 저차원 잠재 공간으로 압축해 추천을 만들어낸다는 것을 배웠다. 행렬 분해는 강력하지만 근본적인 한계가 있다. 잠재 요인 간 상호작용을 **선형 내적**으로만 모델링한다는 점이다. 실제 사용자 선호는 훨씬 복잡한 비선형 패턴을 가진다. 이번 글에서는 딥러닝을 도입해 이 한계를 극복하는 세 가지 핵심 아키텍처—NCF, Wide&Deep, DIN—를 완전히 해설한다.

## 딥러닝 추천의 핵심: 임베딩

딥러닝 추천 시스템의 출발점은 **임베딩(Embedding)**이다. 사용자 ID와 아이템 ID처럼 카테고리형 데이터를 밀집 벡터(dense vector)로 변환하는 기법이다.

사용자가 100만 명이라면 단순 원-핫 인코딩은 100만 차원 벡터가 된다. 메모리도 낭비고 계산도 비효율적이다. 임베딩은 이를 64~256차원의 밀집 벡터로 압축한다. 이 과정에서 **유사한 사용자는 가까운 벡터, 다른 사용자는 먼 벡터**가 되도록 학습이 진행된다.

```python
import torch.nn as nn

# 100만 사용자를 64차원 공간으로 임베딩
user_emb = nn.Embedding(num_embeddings=1_000_000, embedding_dim=64)

# 500만 아이템을 64차원 공간으로 임베딩
item_emb = nn.Embedding(num_embeddings=5_000_000, embedding_dim=64)
```

임베딩 공간에서 내적(dot product)이 크면 선호도가 높다. 이 직관은 행렬 분해와 동일하지만, 딥러닝에서는 임베딩 위에 **비선형 변환 레이어를 쌓아** 훨씬 복잡한 패턴을 잡아낸다. 임베딩 벡터는 학습 가능한 파라미터이므로 훈련 과정에서 최적의 표현을 자동으로 학습한다.

## Neural Collaborative Filtering (NCF)

![딥러닝 추천 아키텍처 비교](/assets/posts/recsys-deep-learning-architecture.svg)

NCF는 2017년 He et al.이 발표한 논문으로, 행렬 분해를 신경망으로 일반화한 프레임워크다. 핵심 아이디어는 사용자와 아이템 임베딩을 내적 대신 **MLP(다층 퍼셉트론)**로 결합하는 것이다.

### GMF: 일반화된 행렬 분해

GMF(Generalized Matrix Factorization)는 기존 행렬 분해를 신경망 관점에서 재해석한다. 사용자 임베딩과 아이템 임베딩을 **원소별 곱(element-wise product)**하고, 선형 레이어를 통과시켜 예측값을 만든다.

```python
# GMF: 원소별 곱으로 상호작용 모델링
u = user_emb(user_id)   # (B, D)
i = item_emb(item_id)   # (B, D)
interaction = u * i      # (B, D) 원소별 곱
score = linear(interaction)  # (B, 1)
```

GMF는 행렬 분해와 수학적으로 동일하지만, 가중치를 학습할 수 있어 단순 행렬 분해보다 표현력이 높다.

### MLP: 비선형 상호작용 학습

MLP 부분은 사용자와 아이템 임베딩을 **연결(concatenate)**한 뒤 여러 완전 연결층을 통과시킨다. ReLU 활성화 함수가 비선형성을 부여해 훨씬 복잡한 상호작용 패턴을 학습할 수 있다.

```python
# MLP: 연결 후 비선형 변환
x = torch.cat([u, i], dim=-1)  # (B, 2D)
x = relu(linear1(x))            # (B, 128)
x = relu(linear2(x))            # (B, 64)
score = sigmoid(linear3(x))     # (B, 1)
```

### NCF = GMF + MLP

최종 NCF는 GMF의 출력과 MLP의 출력을 합쳐(concatenate) 최종 예측을 만든다. GMF는 선형 상호작용을, MLP는 비선형 상호작용을 각각 담당하므로 두 가지 보완적인 관점이 결합된다.

NCF는 MovieLens, Pinterest 등의 벤치마크에서 기존 행렬 분해보다 지속적으로 높은 성능을 보였으며, 딥러닝 추천 시스템의 기초가 되었다.

## Wide & Deep Learning

Wide&Deep은 2016년 Google이 Google Play 앱 스토어 추천을 위해 발표한 아키텍처다. 핵심 통찰은 추천에는 두 가지 상반된 능력이 필요하다는 것이다.

**암기(Memorization)**: "사용자가 A를 샀으면 B도 산다"처럼 과거 데이터에서 직접 공동 출현 패턴을 기억하는 능력이다. 선형 모델이 잘한다.

**일반화(Generalization)**: 이전에 본 적 없는 새로운 조합에도 합리적인 예측을 내리는 능력이다. DNN이 잘한다.

```python
# Wide 파트: 선형 모델 (암기 담당)
wide_input = cross_product_features(user_feats, item_feats)
wide_out = torch.matmul(wide_input, wide_weights)  # 선형

# Deep 파트: DNN (일반화 담당)
deep_input = torch.cat([user_emb, item_emb, context_feats], dim=-1)
deep_out = deep_network(deep_input)  # 비선형 변환

# 두 파트 합산 후 Sigmoid
logit = wide_out + deep_out
prob = torch.sigmoid(logit)
```

Wide 파트에는 교차 특성(cross-product features)이 입력된다. 예를 들어 "사용자 언어 = 한국어 AND 설치 앱 = 카카오톡" 같은 조합 특성이다. Deep 파트에는 임베딩으로 변환된 범주형 특성과 수치 특성이 모두 입력된다.

Google Play에 실제 배포되어 앱 다운로드 전환율을 크게 높인 검증된 아키텍처로, 이후 DeepFM, DCN 등 수많은 변형 모델의 출발점이 되었다.

## Deep Interest Network (DIN)

DIN은 2018년 Alibaba가 광고 추천 시스템을 위해 발표한 모델이다. 기존 추천 모델의 약점을 정확히 짚어냈다. 사용자의 모든 과거 행동을 **동등하게** 처리해서는 안 된다는 것이다.

예를 들어 사용자가 지금 보는 광고가 "스포츠 운동화"라면, 그 사용자의 과거 클릭 이력 중 "농구화 구매", "달리기화 조회"는 높은 관련성이 있지만 "요리책 구매"는 거의 무관하다. DIN은 **Attention 메커니즘**으로 이 차이를 모델링한다.

```python
def din_attention(query_item_emb, behavior_seq_embs):
    # query_item_emb: (B, D) - 현재 광고 임베딩
    # behavior_seq_embs: (B, T, D) - 과거 행동 시퀀스

    # 각 행동과 쿼리 아이템의 관련성 계산
    query_exp = query_item_emb.unsqueeze(1)  # (B, 1, D)
    attn_input = torch.cat(
        [query_exp.expand_as(behavior_seq_embs),
         behavior_seq_embs,
         query_exp * behavior_seq_embs], dim=-1
    )
    attn_score = attn_net(attn_input)  # (B, T, 1)
    attn_score = torch.softmax(attn_score, dim=1)

    # 가중 합산으로 사용자 관심 표현
    user_interest = (attn_score * behavior_seq_embs).sum(dim=1)
    return user_interest  # (B, D)
```

Alibaba의 Taobao(타오바오) 광고 시스템에 실제 배포되어 CTR(클릭률)을 크게 향상시켰다. 이후 DIEN(관심사 진화 네트워크), DSIN(세션 기반 관심사 네트워크) 등 시퀀스 모델링 계열 추천 모델들의 선구자가 되었다.

## 시퀀스 기반 추천

DIN 이후 사용자의 행동 **순서(sequence)**에서 의미를 추출하는 모델들이 등장했다.

**SASRec(Self-Attentive Sequential Recommendation, 2018)**은 Transformer의 자기 주의(self-attention) 메커니즘을 추천에 적용했다. 과거 행동 시퀀스 전체를 병렬로 처리하며 장거리 의존성을 효과적으로 포착한다.

```python
# SASRec 핵심: Transformer 인코더로 시퀀스 모델링
item_seq_embs = item_emb(item_sequence)  # (B, T, D)
# Positional Encoding 추가
item_seq_embs += pos_emb(positions)
# Self-Attention으로 순서 패턴 학습
output = transformer_encoder(item_seq_embs)  # (B, T, D)
# 마지막 위치 = 다음 아이템 예측
next_item_score = dot_product(output[:, -1, :], candidate_embs)
```

**BERT4Rec(2019)**은 BERT의 마스크 언어 모델(MLM) 방식을 차용했다. 시퀀스 중간의 아이템을 무작위로 마스킹하고 예측하는 방식으로 학습한다. 양방향 문맥을 활용해 SASRec보다 더 풍부한 표현을 학습한다.

이러한 시퀀스 추천 모델들은 사용자의 단기적인 관심 변화와 장기적인 취향을 동시에 포착할 수 있어 현대 추천 시스템의 핵심이 되었다.

## 실전 코드: PyTorch NCF 구현

![PyTorch NCF 구현](/assets/posts/recsys-deep-learning-code.svg)

NCF의 전체 구현을 살펴보자. 사용자와 아이템 임베딩을 결합해 클릭 확률을 예측하는 기본 모델이다.

```python
import torch
import torch.nn as nn

class NCF(nn.Module):
    def __init__(self, n_users, n_items, emb_dim=64):
        super().__init__()
        self.user_emb = nn.Embedding(n_users, emb_dim)
        self.item_emb = nn.Embedding(n_items, emb_dim)
        self.mlp = nn.Sequential(
            nn.Linear(emb_dim * 2, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, user_ids, item_ids):
        u = self.user_emb(user_ids)   # (B, D)
        i = self.item_emb(item_ids)   # (B, D)
        x = torch.cat([u, i], dim=-1) # (B, 2D)
        return self.mlp(x).squeeze(-1)

# 학습 예시
model = NCF(n_users=10000, n_items=50000, emb_dim=64)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
criterion = nn.BCELoss()

# 포지티브 샘플 (실제 상호작용): label=1
# 네거티브 샘플 (랜덤 미상호작용): label=0
for user_ids, item_ids, labels in dataloader:
    preds = model(user_ids, item_ids)
    loss = criterion(preds, labels.float())
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

실제 적용 시에는 **네거티브 샘플링** 전략이 중요하다. 사용자가 상호작용하지 않은 아이템 중 일부를 부정적 사례로 사용하는데, 인기 아이템을 더 많이 샘플링하는 인기도 기반 샘플링이 균등 샘플링보다 성능이 좋다.

## 딥러닝 추천 vs 행렬 분해 비교

| 비교 항목 | 행렬 분해 | 딥러닝 추천 |
|-----------|-----------|-------------|
| **상호작용 모델링** | 선형 내적 | 비선형 MLP |
| **표현력** | 제한적 | 높음 |
| **부가 특성 활용** | 어려움 | 자연스러움 |
| **계산 비용** | 낮음 | 높음 |
| **데이터 요구량** | 적음 | 많음 |
| **해석 가능성** | 높음 | 낮음 |
| **시퀀스 모델링** | 불가 | 가능 (DIN, SASRec) |

딥러닝 추천은 표현력이 높지만 학습 데이터가 충분해야 한다. 인터랙션 데이터가 수천만 건 이상인 대형 플랫폼에서 진가를 발휘하며, 그 이하 규모에서는 행렬 분해 계열이 오히려 더 나은 성능을 보이기도 한다.

현대 산업 추천 시스템은 대부분 딥러닝 기반으로 진화했다. 다음 글에서는 수십억 아이템에서 실시간으로 추천을 제공하는 **투타워(Two-Tower) 모델**의 구조와 서빙 파이프라인을 살펴본다.

---

**지난 글:** [행렬 분해(MF): SVD·ALS·FunkSVD 추천 알고리즘 완전 해설](/posts/recsys-matrix-factorization/)

**다음 글:** [투타워 모델: 대규모 추천 시스템 구조 완전 해설](/posts/recsys-two-tower/)

<br>
읽어주셔서 감사합니다. 😊
