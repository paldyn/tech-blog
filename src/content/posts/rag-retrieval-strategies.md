---
title: "RAG 검색 전략 완전 정복: Sparse·Dense·Hybrid 검색 비교"
description: "RAG의 검색 품질을 결정하는 다양한 검색 전략을 완전히 이해한다. BM25 희소 검색, 벡터 밀집 검색, 하이브리드 검색의 원리와 장단점, RRF 융합 알고리즘, 그리고 실전 구현 방법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["RAG검색", "BM25", "하이브리드검색", "Dense검색", "Sparse검색", "RRF", "RAG"]
featured: false
draft: false
---

[지난 글](/posts/rag-embedding-models/)에서 RAG 시스템의 검색 품질을 결정하는 임베딩 모델을 완전히 비교했다. 좋은 임베딩 모델을 골랐다면, 다음으로 중요한 것은 **어떻게 검색하느냐**다. 같은 벡터 인덱스를 사용하더라도 검색 전략에 따라 결과가 크게 달라진다. 이번 글에서는 RAG에서 사용되는 세 가지 검색 패러다임, BM25 희소 검색, 벡터 밀집 검색, 그리고 두 가지를 결합한 하이브리드 검색을 완전히 이해하고 구현한다.

## 검색의 두 가지 철학: 정확 매칭 vs 의미 이해

정보 검색 역사는 두 가지 철학의 경쟁이었다.

**정확 매칭(Exact Match)**: 사용자가 입력한 키워드가 문서에 정확히 있어야 검색된다. 구글 검색 초기, 도서관 카탈로그, 전통적인 전문 검색 엔진이 이 방식이다.

**의미 검색(Semantic Search)**: 사용자의 의도와 문서의 의미를 이해해 관련 있으면 검색된다. "자동차"를 검색해도 "승용차", "차량"이 포함된 문서가 나온다.

각각의 방식은 강점과 약점이 명확하고, 현대 RAG 시스템은 두 방식을 결합한 하이브리드 검색을 표준으로 채택하고 있다.

![RAG 검색 전략 비교](/assets/posts/rag-retrieval-strategies-comparison.svg)

## BM25: 희소 검색의 원리

BM25(Best Match 25)는 TF-IDF를 개선한 확률론적 검색 알고리즘으로, 1990년대에 개발됐지만 2024년 현재도 정확 매칭 검색의 기준으로 사용된다.

BM25 점수 공식:

```
score(D, Q) = Σ IDF(qᵢ) · [TF(qᵢ,D) · (k₁+1)] / [TF(qᵢ,D) + k₁·(1-b+b·|D|/avgdl)]
```

- **TF(qᵢ, D)**: 문서 D에서 쿼리 단어 qᵢ의 출현 빈도
- **IDF(qᵢ)**: 전체 문서에서 qᵢ가 드물수록 높아지는 역문서 빈도
- **|D|/avgdl**: 문서 길이 정규화 (긴 문서 불이익)
- **k₁, b**: 튜닝 파라미터 (보통 k₁=1.5, b=0.75)

BM25의 핵심 특징은 **희소 벡터(Sparse Vector)**를 사용한다는 점이다. 어휘 크기(V)의 벡터에서 문서에 실제로 등장한 단어 위치만 0이 아닌 값을 가진다. 10만 개의 어휘 중 실제 등장 단어가 50개라면 벡터의 99.95%가 0이다. 이 희소성 덕분에 역색인(Inverted Index)을 통해 매우 빠른 검색이 가능하다.

```python
from rank_bm25 import BM25Okapi
import re

def tokenize_korean(text: str) -> list[str]:
    """
    한국어 BM25를 위한 토크나이저.
    형태소 분석기(Mecab, Kkma)를 쓰면 더 정확하다.
    """
    # 기본: 공백 분리 + 특수문자 제거
    tokens = re.sub(r"[^\w\s]", "", text).split()
    return [t for t in tokens if len(t) > 1]

# 코퍼스 준비
corpus_texts = [c.page_content for c in chunks]
tokenized_corpus = [tokenize_korean(t) for t in corpus_texts]

# BM25 인덱스 생성
bm25 = BM25Okapi(tokenized_corpus)

# 검색
query = "연차 휴가는 며칠인가요"
tokenized_query = tokenize_korean(query)
scores = bm25.get_scores(tokenized_query)

# Top-5 검색 결과
top_k = 5
top_indices = scores.argsort()[::-1][:top_k]
for idx in top_indices:
    print(f"점수: {scores[idx]:.4f}")
    print(f"청크: {corpus_texts[idx][:80]}...")
    print()
```

**BM25의 강점**:
- 고유명사, 제품 코드, 법률 조항 번호처럼 **정확한 용어 매칭**이 중요할 때 압도적
- 역색인 기반이라 **검색 속도**가 매우 빠름
- 모델 학습이 불필요하며 **해석이 명확**함

**BM25의 한계**:
- "연차"와 "유급 휴가"가 다른 단어이므로 동의어를 모름
- "I don't like it"의 부정 의도를 이해하지 못함
- 오타나 표현 변형에 취약함

## Dense 검색: 벡터 유사도 검색의 원리

Dense 검색(밀집 벡터 검색)은 임베딩 모델이 생성한 1024~3072차원의 밀집 벡터(Dense Vector)를 사용한다. 모든 차원이 의미를 가진다.

핵심 유사도 측정 방법:

```python
import numpy as np

def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    """코사인 유사도: 벡터 방향의 유사성 (크기 무관)"""
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

def dot_product(v1: np.ndarray, v2: np.ndarray) -> float:
    """내적: L2 정규화된 벡터에서 코사인과 동일"""
    return np.dot(v1, v2)

# L2 정규화된 벡터라면 내적 = 코사인 유사도
v1 = np.array([0.3, 0.7, -0.5, 0.2])
v1_norm = v1 / np.linalg.norm(v1)  # L2 정규화

# pgvector나 FAISS는 정규화된 벡터의 내적 계산이 더 빠름
```

실제 대규모 RAG 시스템에서는 정확한 최근접 이웃 탐색이 아니라 **ANN(Approximate Nearest Neighbor)** 알고리즘을 사용한다.

**HNSW (Hierarchical Navigable Small World)**: pgvector와 Qdrant의 기본 인덱스로, 계층적 그래프 구조를 사용해 O(log n) 복잡도로 근사 검색한다. 검색 속도와 정확도의 균형이 탁월하다.

**IVF-PQ (Inverted File + Product Quantization)**: FAISS에서 많이 쓰이며, 벡터를 양자화해 메모리를 크게 절약한다.

```python
import faiss
import numpy as np

def build_hnsw_index(
    vectors: np.ndarray,
    M: int = 32,         # 연결 수 (클수록 정확, 메모리 증가)
    ef_construction: int = 200,
) -> faiss.IndexHNSWFlat:
    """HNSW 인덱스를 구축한다."""
    dim = vectors.shape[1]
    index = faiss.IndexHNSWFlat(dim, M)
    index.hnsw.efConstruction = ef_construction
    index.add(vectors.astype(np.float32))
    return index

def search_hnsw(
    index: faiss.IndexHNSWFlat,
    query_vector: np.ndarray,
    k: int = 5,
    ef_search: int = 50,  # 클수록 정확, 느림
) -> tuple[np.ndarray, np.ndarray]:
    """HNSW로 Top-K 검색"""
    index.hnsw.efSearch = ef_search
    distances, indices = index.search(
        query_vector.reshape(1, -1).astype(np.float32), k
    )
    return distances[0], indices[0]

# 실제 사용
all_vectors = np.array(chunk_vectors)  # (N, 1536)
hnsw_index = build_hnsw_index(all_vectors)

query_vec = np.array(query_vector)
distances, indices = search_hnsw(hnsw_index, query_vec, k=5)
for dist, idx in zip(distances, indices):
    print(f"유사도: {1 - dist:.4f}")  # L2 거리 → 유사도 변환
    print(f"청크: {corpus_texts[idx][:80]}")
```

## Hybrid 검색과 RRF 융합 알고리즘

하이브리드 검색은 BM25와 Dense 검색의 결과를 합쳐 각 방식의 강점을 취한다. 두 결과를 어떻게 합치느냐가 핵심인데, 가장 효과적인 방법이 **RRF(Reciprocal Rank Fusion)**다.

![하이브리드 검색 아키텍처](/assets/posts/rag-retrieval-strategies-hybrid.svg)

### RRF 알고리즘 원리

RRF는 각 검색 방법에서의 순위(rank)를 역수로 변환해 합산한다.

```
RRF_score(d) = Σ 1 / (k + rank_i(d))
```

- `k`: 상수 (보통 60), 높은 순위에 지나치게 큰 가중치를 주는 것을 방지
- `rank_i(d)`: 검색 방법 i에서 문서 d의 순위 (1이 최고)

직접 점수를 합산하는 것보다 RRF가 좋은 이유는 **점수 스케일 정규화** 때문이다. BM25 점수는 0~20 범위, 코사인 유사도는 0~1 범위로 서로 다른 스케일이라 직접 합산이 불공평하다. RRF는 순위만 사용하므로 스케일 차이가 없다.

```python
from collections import defaultdict
from typing import Any

def reciprocal_rank_fusion(
    result_lists: list[list[tuple[str, float]]],
    k: int = 60,
) -> list[tuple[str, float]]:
    """
    여러 검색 결과를 RRF로 융합한다.
    
    Args:
        result_lists: [(doc_id, score)] 리스트의 리스트
        k: RRF 상수 (보통 60)
    
    Returns:
        [(doc_id, rrf_score)] 정렬된 융합 결과
    """
    rrf_scores: dict[str, float] = defaultdict(float)

    for results in result_lists:
        # 점수 기준 내림차순 정렬 후 순위 부여
        sorted_results = sorted(
            results, key=lambda x: x[1], reverse=True
        )
        for rank, (doc_id, _) in enumerate(sorted_results, start=1):
            rrf_scores[doc_id] += 1.0 / (k + rank)

    # RRF 점수 기준 내림차순 정렬
    return sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

# 실제 사용 예시
bm25_results = [
    ("chunk_001", 8.3),
    ("chunk_045", 7.1),
    ("chunk_012", 5.2),
    ("chunk_089", 4.8),
]

dense_results = [
    ("chunk_045", 0.92),
    ("chunk_089", 0.88),
    ("chunk_003", 0.81),
    ("chunk_001", 0.79),
]

fused = reciprocal_rank_fusion([bm25_results, dense_results])
print("RRF 융합 결과:")
for doc_id, score in fused[:5]:
    print(f"  {doc_id}: {score:.4f}")
# chunk_045: 0.0328  (두 방법 모두 상위권)
# chunk_001: 0.0309  (BM25 1위, Dense 4위)
# chunk_089: 0.0306  (BM25 4위, Dense 2위)
```

`chunk_045`가 1위인 이유는 BM25(2위)와 Dense(1위) 양쪽에서 모두 상위권이기 때문이다. 이것이 하이브리드 검색의 핵심 이점이다.

## LangChain으로 하이브리드 검색 구현

```python
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Qdrant
from qdrant_client import QdrantClient

# Dense 검색용 Qdrant 설정
qdrant_client = QdrantClient(url="http://localhost:6333")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

vectorstore = Qdrant(
    client=qdrant_client,
    collection_name="company_docs",
    embeddings=embeddings,
)
dense_retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 10},  # 더 많이 가져와서 RRF로 재정렬
)

# Sparse 검색용 BM25
bm25_retriever = BM25Retriever.from_documents(chunks)
bm25_retriever.k = 10

# 앙상블 (내부적으로 RRF 사용)
ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, dense_retriever],
    weights=[0.5, 0.5],  # 동등 가중치 (도메인에 따라 조정)
)

# 최종 질의
results = ensemble_retriever.invoke("연차 휴가 기간은?")
for doc in results[:3]:
    print(f"출처: {doc.metadata.get('source', '?')}")
    print(f"내용: {doc.page_content[:100]}\n")
```

가중치 조정 가이드:
- 키워드 검색이 중요한 도메인 (법률, 기술 문서): BM25 비중 높임 (0.6:0.4)
- 의미 검색이 중요한 도메인 (FAQ, 일반 문의): Dense 비중 높임 (0.3:0.7)
- 확신이 없을 때: 동등 (0.5:0.5)

## pgvector로 하이브리드 검색 구현

pgvector 0.7+부터 내장 하이브리드 검색을 지원한다.

```sql
-- pgvector + pg_trgm 하이브리드 검색
-- 1. Dense 벡터 검색 결과 (CTE)
WITH dense AS (
    SELECT
        id,
        content,
        metadata,
        ROW_NUMBER() OVER (
            ORDER BY embedding <=> $1::vector
        ) AS dense_rank
    FROM documents
    ORDER BY embedding <=> $1::vector
    LIMIT 20
),
-- 2. BM25 전문 검색 결과 (CTE)
sparse AS (
    SELECT
        id,
        content,
        metadata,
        ROW_NUMBER() OVER (
            ORDER BY ts_rank(
                to_tsvector('korean', content),
                plainto_tsquery('korean', $2)
            ) DESC
        ) AS sparse_rank
    FROM documents
    WHERE to_tsvector('korean', content)
          @@ plainto_tsquery('korean', $2)
    LIMIT 20
),
-- 3. RRF 융합
rrf AS (
    SELECT
        COALESCE(d.id, s.id) AS id,
        COALESCE(d.content, s.content) AS content,
        COALESCE(d.metadata, s.metadata) AS metadata,
        COALESCE(1.0/(60 + d.dense_rank), 0) +
        COALESCE(1.0/(60 + s.sparse_rank), 0) AS rrf_score
    FROM dense d
    FULL OUTER JOIN sparse s ON d.id = s.id
)
SELECT id, content, metadata, rrf_score
FROM rrf
ORDER BY rrf_score DESC
LIMIT 5;
```

파라미터: `$1` = 쿼리 임베딩 벡터, `$2` = 쿼리 텍스트

## 검색 품질 향상을 위한 추가 기법

### 재순위 (Reranking)

BM25 + Dense 하이브리드로 Top-20을 가져온 후, Cross-encoder 모델로 최종 Top-5를 선정한다. Cross-encoder는 쿼리와 문서를 동시에 입력받아 관련도를 정밀하게 평가한다.

```python
from sentence_transformers import CrossEncoder

# Cross-encoder 재순위 모델
reranker = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L-6-v2",
    max_length=512,
)

def rerank_results(
    query: str,
    docs: list,
    top_n: int = 5,
) -> list:
    """
    Cross-encoder로 검색 결과를 재순위한다.
    초기 검색보다 정밀도가 크게 향상된다.
    """
    if not docs:
        return []

    pairs = [[query, doc.page_content] for doc in docs]
    scores = reranker.predict(pairs)

    # 점수 기준 내림차순 정렬
    ranked = sorted(
        zip(docs, scores),
        key=lambda x: x[1],
        reverse=True,
    )
    return [doc for doc, _ in ranked[:top_n]]

# 파이프라인: 하이브리드 검색(Top-20) → 재순위(Top-5)
initial_results = ensemble_retriever.invoke("연차 정책")
final_results = rerank_results(
    "연차 정책", initial_results, top_n=5
)
```

Cross-encoder 재순위의 효과: 검색 정밀도(Precision@5)가 평균 15~25% 향상되는 것으로 보고된다.

## 검색 전략 성능 비교 요약

| 전략 | 구현 복잡도 | 검색 정밀도 | 키워드 강점 | 의미 이해 | 추천 환경 |
|------|-----------|------------|------------|----------|----------|
| BM25만 | 낮음 | 중간 | 최고 | 없음 | 레거시 시스템 |
| Dense만 | 중간 | 중간 | 낮음 | 최고 | 일반 QA |
| Hybrid (RRF) | 중간 | 높음 | 높음 | 높음 | **프로덕션 기본** |
| Hybrid + Rerank | 높음 | 최고 | 높음 | 최고 | 고품질 요구 |

## 마치며: RAG 시리즈 완결

이번 글을 끝으로 RAG 완전 정복 시리즈를 마친다. 이 시리즈에서 다룬 내용을 정리하면 다음과 같다.

1. **RAG 기초**: LLM의 한계와 RAG의 동작 원리
2. **RAG 아키텍처**: Naive → Advanced → Modular RAG 발전 단계
3. **청킹 전략**: 고정 크기, 재귀적, 시맨틱, 구조 기반 청킹
4. **임베딩 모델**: OpenAI, BGE-M3, E5, 한국어 특화 모델 비교
5. **검색 전략**: BM25, Dense, Hybrid 검색과 RRF 융합 (이번 글)

RAG 시스템의 품질을 결정하는 핵심은 세 가지다. **좋은 청킹**(의미를 보존하면서 적절한 크기로), **적합한 임베딩 모델**(도메인과 언어에 맞는), **강력한 검색 전략**(하이브리드 + 재순위). 이 세 가지를 잘 갖추고, `ragas`로 지속적으로 품질을 측정하며 개선해 나간다면 실무에서 탁월한 RAG 시스템을 구축할 수 있다.

---

**지난 글:** [RAG 임베딩 모델 선택 가이드: 성능·비용·언어 지원 완전 비교](/posts/rag-embedding-models/)

<br>
읽어주셔서 감사합니다. 😊
