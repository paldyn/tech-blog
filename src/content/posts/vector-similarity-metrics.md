---
title: "벡터 유사도 지표: 코사인·유클리드·내적의 모든 것"
description: "벡터 검색의 핵심인 유사도 측정 방법을 완벽히 이해한다. 코사인 유사도, 유클리드 거리, 내적(Dot Product)의 수식과 특성, 언제 어떤 지표를 쓸지 결정하는 실전 가이드를 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["코사인유사도", "유클리드거리", "내적", "벡터유사도", "임베딩", "벡터검색"]
featured: false
draft: false
---

[지난 글](/posts/vector-search-basics/)에서 벡터 검색의 전체 파이프라인을 살펴봤다. 임베딩 모델이 텍스트를 고차원 벡터로 변환하고, 유사한 의미를 가진 벡터는 공간에서 가깝게 위치한다는 개념을 이해했다. 그렇다면 "가깝다"는 것을 정확히 어떻게 측정할까? 그것이 바로 **유사도 지표(Similarity Metric)** 의 역할이다.

## 왜 유사도 지표가 중요한가

벡터 검색 시스템을 설계할 때 유사도 지표는 두 가지 이유에서 결정적이다.

첫째, **검색 품질에 직접 영향**을 준다. 같은 임베딩 벡터라도 어떤 지표를 사용하느냐에 따라 결과 순위가 달라진다. 잘못된 지표를 선택하면 관련 없는 문서가 상위에 오를 수 있다.

둘째, **인덱스 구조와 연결**된다. 벡터 DB는 특정 유사도 지표에 최적화된 인덱스를 구축한다. pgvector의 `vector_cosine_ops`, Qdrant의 `Cosine` 설정이 그 예다. 인덱스 생성 후에는 지표를 바꾸려면 인덱스를 재구축해야 한다.

## 세 가지 핵심 지표

![세 가지 벡터 유사도 지표 비교](/assets/posts/vector-similarity-metrics-overview.svg)

### 1. 코사인 유사도 (Cosine Similarity)

두 벡터가 이루는 **각도의 코사인 값**으로 유사도를 측정한다. 벡터의 크기(magnitude)는 무시하고 방향만 비교한다.

$$\text{cosine}(A, B) = \frac{A \cdot B}{|A||B|} = \frac{\sum_{i=1}^{n} a_i b_i}{\sqrt{\sum a_i^2} \cdot \sqrt{\sum b_i^2}}$$

- **범위**: -1 (완전 반대) ~ 0 (직교) ~ 1 (완전 동일)
- **특성**: 벡터 크기에 불변(invariant)
- **사용처**: 텍스트 임베딩, 문서 유사도, 대부분의 NLP 태스크

```python
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """코사인 유사도: -1 ~ 1, 높을수록 유사"""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

# 코사인 거리 (벡터 DB에서 자주 쓰는 형식)
def cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """코사인 거리: 0 (동일) ~ 2 (완전 반대)"""
    return 1.0 - cosine_similarity(a, b)

# 예시
v1 = np.array([1.0, 0.0, 0.0])
v2 = np.array([0.0, 1.0, 0.0])  # 직교
v3 = np.array([0.7, 0.7, 0.0])  # 45도

print(cosine_similarity(v1, v2))   # 0.0 (직교)
print(cosine_similarity(v1, v3))   # ~0.707 (45도)
print(cosine_similarity(v1, v1))   # 1.0 (동일)

# 벡터 크기 불변성 확인
v4 = v1 * 100  # v1을 100배 스케일링
print(cosine_similarity(v1, v4))   # 1.0 (크기가 달라도 방향 같으면 동일)
```

### 2. 유클리드 거리 (Euclidean Distance)

두 벡터 사이의 **직선 거리**다. n차원 공간에서의 피타고라스 정리 확장이다.

$$d(A, B) = \sqrt{\sum_{i=1}^{n} (a_i - b_i)^2}$$

- **범위**: 0 (동일) ~ ∞ (거리 무제한)
- **특성**: 벡터 크기(절대값)에 민감
- **사용처**: 클러스터링(K-Means), 절대적 거리가 의미 있는 경우

```python
def euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    """유클리드 거리: 0이 가장 유사, 클수록 다름"""
    return float(np.linalg.norm(a - b))

def euclidean_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """유클리드 거리를 유사도로 변환 (0 ~ 1)"""
    return 1.0 / (1.0 + euclidean_distance(a, b))

# 정규화 벡터에서 코사인과 유클리드의 관계
a = np.array([1.0, 0.0])
b = np.array([0.707, 0.707])  # 정규화된 45도 벡터

cos_sim = cosine_similarity(a, b)
euc_dist = euclidean_distance(a, b)

# 정규화 벡터에서: d² = 2(1 - cosine)
print(f"코사인 유사도: {cos_sim:.3f}")
print(f"유클리드 거리: {euc_dist:.3f}")
print(f"관계 확인: d² ≈ 2(1-cos) = {2*(1-cos_sim):.3f}, d² = {euc_dist**2:.3f}")
```

### 3. 내적 (Dot Product / Inner Product)

두 벡터의 **원소별 곱의 합**이다. 방향과 크기를 모두 반영한다.

$$A \cdot B = \sum_{i=1}^{n} a_i b_i = |A||B|\cos(\theta)$$

- **범위**: -∞ ~ ∞
- **특성**: 벡터 크기에 민감, 코사인×크기
- **사용처**: MIPS(최대 내적 탐색), 추천 시스템, 정규화된 벡터에서는 코사인과 동일

```python
def dot_product(a: np.ndarray, b: np.ndarray) -> float:
    """내적: 정규화 벡터에서는 코사인 유사도와 동일"""
    return float(np.dot(a, b))

# 정규화 벡터에서 내적 = 코사인 유사도
a_norm = a / np.linalg.norm(a)
b_norm = b / np.linalg.norm(b)

print(dot_product(a_norm, b_norm))      # 코사인 유사도와 동일
print(cosine_similarity(a_norm, b_norm)) # 위와 같은 값

# 미정규화 벡터에서 내적의 위험성
a_big = a * 100
b_small = b * 0.01

# 내적: a_big이 압도적으로 높은 점수
print(dot_product(a_big, b_small))     # 0.707 (크기 영향)
print(cosine_similarity(a_big, b_small)) # 0.707 (크기 무관)
```

## 지표 간 수학적 관계

세 지표는 독립적인 것이 아니라 서로 연결되어 있다.

**정규화 벡터(단위 벡터)에서:**
- 내적 = 코사인 유사도
- 유클리드 거리² = 2 × (1 - 코사인 유사도)

따라서 정규화된 벡터를 사용한다면, 코사인·내적·유클리드 중 무엇을 써도 **동일한 순위**를 얻을 수 있다. 다만 계산 속도가 다를 수 있다. 내적은 SIMD 명령어로 최적화가 가장 쉬워 일반적으로 가장 빠르다.

```python
def verify_equivalence():
    """정규화 벡터에서 세 지표의 동치 관계 검증"""
    n_trials = 1000
    dim = 128

    for _ in range(n_trials):
        a = np.random.randn(dim)
        b = np.random.randn(dim)

        # 정규화
        a_n = a / np.linalg.norm(a)
        b_n = b / np.linalg.norm(b)

        cos = cosine_similarity(a_n, b_n)
        dot = dot_product(a_n, b_n)
        euc = euclidean_distance(a_n, b_n)

        # 내적 == 코사인
        assert abs(cos - dot) < 1e-9, "dot != cos"
        # 유클리드² == 2(1 - 코사인)
        assert abs(euc**2 - 2*(1-cos)) < 1e-9, "euc != 2(1-cos)"

    print("정규화 벡터에서 세 지표 동치 관계 검증 완료!")

verify_equivalence()
```

## 실전 지표 선택 가이드

![유사도 지표 선택 가이드](/assets/posts/vector-similarity-metrics-usecases.svg)

### 코사인 유사도를 선택하는 경우

**텍스트 임베딩 검색의 기본 선택**이다. 임베딩 모델은 의미 방향을 인코딩하도록 학습되었다. 벡터 크기는 의미와 무관한 경우가 많다. 대부분의 벡터 DB(Pinecone, Weaviate, pgvector)의 기본값이 코사인이다.

```python
# OpenAI 임베딩 → 코사인 유사도 사용
from openai import OpenAI

client = OpenAI()

def semantic_search(query: str, docs: list[str], top_k: int = 3):
    """코사인 유사도 기반 시맨틱 검색"""
    all_texts = [query] + docs
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=all_texts,
    )
    embeddings = [np.array(r.embedding) for r in response.data]
    q_emb = embeddings[0]
    doc_embs = embeddings[1:]

    scores = [cosine_similarity(q_emb, d) for d in doc_embs]
    ranked = sorted(zip(docs, scores), key=lambda x: x[1], reverse=True)
    return ranked[:top_k]
```

### 유클리드 거리를 선택하는 경우

**절대적 거리가 의미 있는 경우**다. 예를 들어 k-Means 클러스터링, 이미지 임베딩처럼 크기 자체가 의미를 담는 경우다. 단, 임베딩 전에 **정규화(L2 normalize)** 를 적용하면 코사인과 동일한 결과를 빠르게 얻을 수 있다.

### 내적을 선택하는 경우

**속도 최우선이고 벡터가 정규화되어 있을 때**가 최적이다. 행렬 곱셈 연산으로 BLAS/SIMD 최적화가 잘 되어 있다. Faiss의 `IndexFlatIP`, pgvector의 `vector_ip_ops`가 내적 기반이다.

**추천 시스템**에서 아이템·사용자 임베딩이 정규화되지 않은 경우에도 쓴다. 이때는 내적이 인기도(크기)와 관련성(방향)을 동시에 반영한다.

## 코사인 거리 vs 코사인 유사도

벡터 DB에서 종종 혼동되는 개념이 있다. 대부분의 ANN 인덱스는 내부적으로 **최소 거리**를 찾도록 최적화되어 있다. 따라서 코사인 유사도(클수록 유사)가 아닌 **코사인 거리**(작을수록 유사)를 사용한다.

```
코사인 거리 = 1 - 코사인 유사도
코사인 거리 범위: 0 ~ 2

pgvector: embedding <=> query  → 코사인 거리 반환
유사도로 변환: 1 - (embedding <=> query)
```

이 관계를 잘못 이해하면 결과를 내림차순으로 정렬해야 하는 것을 오름차순으로 정렬하는 버그가 생긴다. 반드시 사용하는 DB의 연산자 정의를 확인하자.

## 정밀도 벤치마크

실제 검색 데이터셋(BEIR)에서 지표별 성능 차이는 임베딩 모델이 정규화를 어떻게 처리했는지에 달려 있다. 최신 임베딩 모델(text-embedding-3, BGE-m3)은 단위 벡터를 출력하도록 학습되어 있어 세 지표 모두 거의 동일한 결과를 낸다. 차이는 주로 **속도와 구현 편의성**에서 발생한다.

따라서 실전 권고사항은 간단하다: **기본적으로 코사인 유사도를 사용하고, 속도가 병목이라면 정규화 후 내적으로 전환하라.**

---

**지난 글:** [벡터 검색 완전 정복: 의미 기반 검색의 동작 원리](/posts/vector-search-basics/)

**다음 글:** [ANN 알고리즘 완전 정복: HNSW·IVF·LSH 비교 분석](/posts/vector-ann-algorithms/)

<br>
읽어주셔서 감사합니다. 😊
