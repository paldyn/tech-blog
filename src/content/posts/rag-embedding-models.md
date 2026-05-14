---
title: "RAG 임베딩 모델 선택 가이드: 성능·비용·언어 지원 완전 비교"
description: "RAG 시스템의 검색 품질을 결정하는 임베딩 모델을 완전히 이해한다. OpenAI, Cohere, BGE, E5, 한국어 특화 모델(KLUE-RoBERTa, KoSimCSE)의 성능 비교와 모델 선택 기준, 실전 구현 방법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["임베딩모델", "RAG", "OpenAI", "BGE", "E5", "한국어임베딩", "시맨틱검색"]
featured: false
draft: false
---

[지난 글](/posts/rag-chunking-strategies/)에서 문서를 적절한 크기의 청크로 나누는 전략을 완전히 살펴봤다. 이제 그 청크들을 벡터로 변환하는 핵심 단계, **임베딩 모델** 선택으로 넘어간다. RAG 시스템에서 임베딩 모델은 검색의 품질을 결정하는 가장 중요한 단일 요소다. 어떤 임베딩 모델을 쓰느냐에 따라 동일한 질문에 대해 전혀 다른 청크가 검색되고, 결과적으로 LLM의 답변 품질이 크게 달라진다.

## 임베딩 모델이 RAG에서 하는 일

임베딩 모델은 텍스트를 고차원 실수 벡터로 변환한다. 핵심은 **의미적으로 비슷한 텍스트는 벡터 공간에서 가깝게 위치**하도록 학습된다는 점이다.

RAG에서 임베딩 모델은 두 번 사용된다.
1. **인덱싱 시**: 모든 청크를 벡터로 변환해 저장
2. **쿼리 시**: 사용자 질문을 벡터로 변환

두 번 모두 **동일한 모델**을 써야 한다. 청크를 A 모델로 인덱싱하고 쿼리를 B 모델로 변환하면, 벡터 공간 자체가 달라서 유사도 계산이 무의미해진다.

![임베딩 모델 비교표](/assets/posts/rag-embedding-models-comparison.svg)

## 주요 임베딩 모델 상세 비교

### OpenAI: text-embedding-3 시리즈

2024년 1월에 출시된 3세대 모델로, OpenAI의 현재 최고 성능 임베딩이다.

**text-embedding-3-large**
- 차원: 3072 (Matryoshka 표현으로 축소 가능)
- 최대 토큰: 8,191
- MTEB 점수: 64.6 (2024년 기준 최고 수준)
- 비용: $0.13/1M 토큰

**text-embedding-3-small**
- 차원: 1536
- MTEB 점수: 62.3
- 비용: $0.02/1M 토큰 (large 대비 1/6)
- **실무에서 가장 많이 선택되는 모델**: 비용 대비 성능이 탁월

흥미로운 기능인 **차원 축소(Matryoshka)**가 있다. `dimensions` 파라미터로 출력 차원을 줄일 수 있다. 3072-dim을 256-dim으로 줄여도 성능이 크게 저하되지 않아 저장 비용을 대폭 절감할 수 있다.

```python
from openai import OpenAI

client = OpenAI()

def embed_texts(
    texts: list[str],
    model: str = "text-embedding-3-small",
    dimensions: int = 1536,  # 축소 가능: 256, 512, 1024
) -> list[list[float]]:
    """
    OpenAI 임베딩 API를 배치로 호출한다.
    최대 2048개 텍스트를 한 번에 처리할 수 있다.
    """
    # 빈 텍스트 필터링 (API 오류 방지)
    cleaned = [t.strip() or " " for t in texts]

    response = client.embeddings.create(
        input=cleaned,
        model=model,
        dimensions=dimensions,  # 3-large에서만 유효
    )
    return [item.embedding for item in response.data]

# 단일 쿼리 임베딩
query_vector = embed_texts(["연차 휴가는 며칠인가요?"])[0]
print(f"벡터 차원: {len(query_vector)}")  # 1536

# 배치 청크 임베딩 (비용 최적화)
chunk_texts = [c.page_content for c in chunks]
chunk_vectors = embed_texts(chunk_texts)  # 한 번의 API 호출로 처리
```

### BAAI: BGE-M3 (오픈소스 최강자)

**B**EIJING **A**cademy of **A**rtificial **I**ntelligence에서 개발한 오픈소스 모델이다. 세 가지 검색 방식을 하나의 모델에서 지원하는 것이 독보적인 특징이다.

- **Dense Retrieval**: 벡터 유사도 검색 (일반적인 임베딩)
- **Sparse Retrieval**: SPLADE 방식의 희소 벡터 검색 (BM25와 유사한 효과)
- **Multi-vector (ColBERT)**: 토큰 레벨 상호작용 검색

BGE-M3 하나로 하이브리드 검색을 구현할 수 있다는 의미다.

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel(
    "BAAI/bge-m3",
    use_fp16=True,  # FP16으로 메모리 절반 사용
)

# 인덱싱: Dense + Sparse + ColBERT 동시 생성
corpus_embeddings = model.encode(
    chunk_texts,
    batch_size=12,
    max_length=512,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=False,  # 메모리 절약
)

print(corpus_embeddings["dense_vecs"].shape)
# (청크수, 1024)

print(len(corpus_embeddings["lexical_weights"][0]))
# 희소 벡터: 비제로 토큰 수 (보통 20~100)

# 쿼리 임베딩
query_embedding = model.encode(
    ["연차 휴가 정책"],
    return_dense=True,
    return_sparse=True,
)

# Dense 유사도 계산
import numpy as np

dense_scores = np.dot(
    corpus_embeddings["dense_vecs"],
    query_embedding["dense_vecs"][0],
)

# Sparse 유사도 계산 (BGE-M3 내장 메서드)
sparse_scores = model.compute_lexical_matching_score(
    corpus_embeddings["lexical_weights"],
    query_embedding["lexical_weights"][0],
)

# 하이브리드 점수 (α=0.5로 균등 결합)
alpha = 0.5
hybrid_scores = alpha * dense_scores + (1 - alpha) * sparse_scores
top_k_indices = np.argsort(hybrid_scores)[::-1][:5]
```

### Microsoft: E5 시리즈

E5(Embeddings from bidirectional Encoder representations) 시리즈의 특징은 **쿼리와 문서에 다른 접두사를 붙여야 한다**는 점이다.

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("intfloat/multilingual-e5-large")

# E5의 핵심: 접두사 구분
# - 쿼리: "query: " 접두사
# - 문서/청크: "passage: " 접두사
def embed_query(text: str) -> list[float]:
    return model.encode(
        f"query: {text}",
        normalize_embeddings=True,
    ).tolist()

def embed_passage(text: str) -> list[float]:
    return model.encode(
        f"passage: {text}",
        normalize_embeddings=True,
    ).tolist()

# 잘못된 사용 (접두사 없음 → 성능 저하)
bad_vec = model.encode("연차 휴가 정책")  # X

# 올바른 사용
good_query = embed_query("연차 휴가는 며칠인가요?")   # O
good_chunk = embed_passage("연차 휴가는 15일이다.")  # O
```

접두사를 빠뜨리면 성능이 크게 떨어지므로 반드시 래퍼 함수로 감싸서 사용해야 한다.

### 한국어 특화 모델

한국어가 주 언어인 RAG 시스템에서는 한국어 특화 모델이 다국어 범용 모델을 압도하는 경우가 많다.

**KURE-v1 (권장)**
- HuggingFace에서 무료 제공
- 한국어 MTEB 벤치마크 최고 성능
- 1024-dim, 최대 512 토큰

**KoSimCSE-roberta**
- SimCSE 방식으로 한국어 문장 유사도 특화
- 상대적으로 가벼운 모델

```python
from sentence_transformers import SentenceTransformer
import torch

# KURE-v1 로드 (처음 실행 시 다운로드)
model = SentenceTransformer(
    "upskyy/kure-roberta-small",
    device="cuda" if torch.cuda.is_available() else "cpu",
)

korean_chunks = [
    "연차 휴가는 입사 첫 해에 11일이 부여된다.",
    "재택근무는 주 2회까지 가능하다.",
    "병가는 유급으로 최대 60일 사용할 수 있다.",
]

korean_embeddings = model.encode(
    korean_chunks,
    batch_size=32,
    normalize_embeddings=True,
    show_progress_bar=True,
)

# 한국어 쿼리 검색
query = "재택근무를 며칠 할 수 있나요?"
query_vec = model.encode(
    query, normalize_embeddings=True
)

# 코사인 유사도 (정규화된 벡터는 내적 = 코사인 유사도)
scores = korean_embeddings @ query_vec
best_idx = scores.argmax()
print(f"최고 유사도: {scores[best_idx]:.4f}")
print(f"검색 결과: {korean_chunks[best_idx]}")
# → "재택근무는 주 2회까지 가능하다."
```

## 임베딩 파이프라인 최적화

![임베딩 파이프라인](/assets/posts/rag-embedding-models-pipeline.svg)

대량 문서를 임베딩할 때는 처리 속도와 비용 최적화가 중요하다.

```python
import asyncio
from openai import AsyncOpenAI
import time

aclient = AsyncOpenAI()

async def embed_batch(
    texts: list[str],
    model: str = "text-embedding-3-small",
) -> list[list[float]]:
    """단일 배치 비동기 임베딩"""
    response = await aclient.embeddings.create(
        input=texts,
        model=model,
    )
    return [item.embedding for item in response.data]

async def embed_all_chunks(
    all_texts: list[str],
    batch_size: int = 100,
    max_concurrent: int = 5,
) -> list[list[float]]:
    """
    대량 텍스트를 배치로 나눠 비동기 병렬 처리한다.
    Rate Limit을 고려해 동시 요청 수를 제한한다.
    """
    batches = [
        all_texts[i:i + batch_size]
        for i in range(0, len(all_texts), batch_size)
    ]

    semaphore = asyncio.Semaphore(max_concurrent)

    async def embed_with_semaphore(batch):
        async with semaphore:
            try:
                return await embed_batch(batch)
            except Exception as e:
                # 지수 백오프 재시도
                await asyncio.sleep(2)
                return await embed_batch(batch)

    tasks = [embed_with_semaphore(b) for b in batches]
    results = await asyncio.gather(*tasks)

    # 배치 결과를 단일 리스트로 평탄화
    return [vec for batch in results for vec in batch]

# 실행
all_texts = [c.page_content for c in chunks]
start = time.time()
vectors = asyncio.run(embed_all_chunks(all_texts))
elapsed = time.time() - start
print(f"{len(vectors)}개 임베딩 완료: {elapsed:.1f}초")
```

## 모델 선택 의사결정 트리

실무에서 어떤 모델을 선택할지 판단할 때 참고할 기준이다.

```
질문 1. 한국어가 주 언어인가?
  → YES: KURE-v1 (최우선) 또는 BGE-M3 (다국어 병행)
  → NO: 다음 질문으로

질문 2. 운영 비용이 중요한가?
  → YES (오픈소스 필요): BGE-M3 > E5-large > BGE-large
  → NO (API 사용 가능): 다음 질문으로

질문 3. 최고 성능이 필요한가?
  → YES: text-embedding-3-large
  → NO (균형): text-embedding-3-small (권장)

질문 4. 하이브리드 검색이 필요한가?
  → YES: BGE-M3 (Dense + Sparse 동시 지원)
  → NO: 위 결정에 따름
```

## 임베딩 캐시로 비용 절감

동일한 텍스트를 반복 임베딩하면 비용 낭비다. 간단한 해시 기반 캐시로 해결한다.

```python
import hashlib
import json
import os

class EmbeddingCache:
    def __init__(self, cache_file: str = "embed_cache.json"):
        self.cache_file = cache_file
        self.cache: dict = {}
        if os.path.exists(cache_file):
            with open(cache_file) as f:
                self.cache = json.load(f)

    def get(self, text: str) -> list[float] | None:
        key = hashlib.md5(text.encode()).hexdigest()
        return self.cache.get(key)

    def set(self, text: str, vector: list[float]):
        key = hashlib.md5(text.encode()).hexdigest()
        self.cache[key] = vector
        with open(self.cache_file, "w") as f:
            json.dump(self.cache, f)

cache = EmbeddingCache()

def embed_with_cache(text: str) -> list[float]:
    cached = cache.get(text)
    if cached:
        return cached  # 캐시 히트
    vector = embed_texts([text])[0]
    cache.set(text, vector)
    return vector
```

## 임베딩 모델 평가: MTEB 벤치마크

임베딩 모델의 성능은 **MTEB(Massive Text Embedding Benchmark)**로 평가된다. MTEB는 다양한 언어와 태스크(검색, 분류, 클러스터링, 의미 유사도 등)에서 모델을 평가한다.

한국어 RAG 전용으로는 **KoMTEB**를 참고하면 된다. KoMTEB는 한국어 특화 평가 데이터셋으로, 다국어 모델과 한국어 특화 모델을 공정하게 비교할 수 있다.

중요한 것은 **벤치마크 성능이 항상 실무 성능과 일치하지 않는다**는 점이다. 최종적으로는 자신의 실제 도메인 데이터로 검색 품질을 직접 평가해야 한다. `ragas` 라이브러리의 `context_precision`과 `context_recall` 지표가 이때 유용하다.

다음 글에서는 청크를 실제로 검색하는 **검색 전략**을 다룬다. BM25 희소 검색, 벡터 밀집 검색, 하이브리드 검색의 원리와 RRF 융합 알고리즘까지 완전히 해설한다.

---

**지난 글:** [RAG 청킹 전략 완전 정복: 문서를 어떻게 나눠야 하는가](/posts/rag-chunking-strategies/)

**다음 글:** [RAG 검색 전략 완전 정복: Sparse·Dense·Hybrid 검색 비교](/posts/rag-retrieval-strategies/)

<br>
읽어주셔서 감사합니다. 😊
