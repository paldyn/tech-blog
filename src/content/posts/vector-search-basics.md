---
title: "벡터 검색 완전 정복: 의미 기반 검색의 동작 원리"
description: "벡터 검색의 핵심 개념과 동작 원리를 이해한다. 키워드 검색과의 차이, 임베딩부터 인덱싱·쿼리까지 전체 파이프라인, 그리고 Python 구현 예시까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["벡터검색", "임베딩", "시맨틱검색", "벡터DB", "ANN", "유사도검색", "RAG"]
featured: false
draft: false
---

[지난 글](/posts/prompt-evaluation/)에서 프롬프트 평가 파이프라인을 갖추면 LLM 시스템의 품질을 데이터로 통제할 수 있음을 확인했다. 이번 글부터는 그 시스템의 중요한 축인 **벡터 검색(Vector Search)**을 깊이 파헤친다. RAG(검색 증강 생성), 시맨틱 검색, 추천 시스템의 공통 근간이 바로 벡터 검색이기 때문이다.

## 키워드 검색의 한계

전통적인 검색 엔진은 **역색인(Inverted Index)** 방식을 사용한다. 사용자가 "강아지 음식"을 검색하면 이 단어들이 포함된 문서를 찾아 반환한다. 단어가 정확히 일치해야 결과가 나온다. "반려견 사료"나 "펫 푸드"는 의미상 동일하더라도 검색되지 않는다.

이 문제를 **어휘 불일치(Vocabulary Mismatch)** 문제라고 한다. 키워드 검색의 세 가지 핵심 한계는 다음과 같다.

1. **동의어 처리 불가**: "자동차"와 "차량"이 같은 문맥이어도 서로를 검색하지 못함
2. **의미 이해 부재**: "나 배고파"라는 쿼리로 "음식점 추천"을 찾을 수 없음
3. **다국어 장벽**: "dog food"로 "강아지 음식"을 검색할 수 없음

![키워드 검색 vs 벡터 검색](/assets/posts/vector-search-basics-comparison.svg)

## 벡터 검색의 핵심 아이디어

벡터 검색은 텍스트, 이미지, 코드 등 모든 데이터를 **고차원 숫자 벡터(embedding)** 로 변환한다. 의미가 유사한 데이터는 벡터 공간에서 가깝게 위치한다. 검색은 쿼리 벡터와 가장 가까운 벡터들을 찾는 **최근접 이웃(Nearest Neighbor)** 탐색으로 이루어진다.

핵심 직관은 이것이다: **의미의 유사성 = 벡터 공간에서의 거리**. "강아지 음식"과 "반려견 사료"는 문자열은 다르지만 같은 고차원 공간의 근처에 표현된다.

## 전체 파이프라인

벡터 검색 시스템은 **인덱싱 단계**와 **쿼리 단계**로 나뉜다.

![벡터 검색 파이프라인](/assets/posts/vector-search-basics-pipeline.svg)

### 인덱싱 단계 (오프라인)

1. **문서 수집**: 텍스트, PDF, 웹페이지 등 원본 데이터를 가져온다
2. **청킹(Chunking)**: 긴 문서를 적절한 크기로 나눈다 (보통 256~512 토큰)
3. **임베딩 생성**: 임베딩 모델로 각 청크를 벡터로 변환한다
4. **벡터 저장**: 벡터 DB에 저장하고 ANN 인덱스를 구축한다

### 쿼리 단계 (온라인)

1. **쿼리 임베딩**: 사용자 쿼리를 같은 임베딩 모델로 벡터화한다
2. **ANN 탐색**: 벡터 DB에서 쿼리 벡터와 가장 유사한 벡터들을 찾는다
3. **결과 반환**: 유사도 순으로 정렬된 문서들을 반환한다

## Python으로 구현하는 벡터 검색

가장 기본적인 벡터 검색을 NumPy만으로 구현해보자.

```python
import numpy as np
from typing import List, Tuple

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """두 벡터 간 코사인 유사도 계산"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

class SimpleVectorStore:
    """단순 선형 탐색 벡터 저장소"""

    def __init__(self):
        self.vectors: List[np.ndarray] = []
        self.documents: List[str] = []

    def add(self, text: str, vector: np.ndarray):
        self.documents.append(text)
        self.vectors.append(vector / np.linalg.norm(vector))  # 정규화

    def search(
        self,
        query_vector: np.ndarray,
        top_k: int = 5,
    ) -> List[Tuple[str, float]]:
        """선형 탐색으로 상위 k개 결과 반환"""
        query_norm = query_vector / np.linalg.norm(query_vector)
        scores = [
            cosine_similarity(query_norm, vec)
            for vec in self.vectors
        ]
        # 유사도 내림차순 정렬
        ranked = sorted(
            zip(self.documents, scores),
            key=lambda x: x[1],
            reverse=True,
        )
        return ranked[:top_k]
```

실제 프로덕션에서는 OpenAI나 Anthropic의 임베딩 API를 사용한다.

```python
import openai

client = openai.OpenAI()

def embed_text(text: str) -> np.ndarray:
    """OpenAI text-embedding-3-small로 임베딩 생성"""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return np.array(response.data[0].embedding)

def build_index(documents: List[str]) -> SimpleVectorStore:
    """문서 리스트로 벡터 인덱스 구축"""
    store = SimpleVectorStore()
    for doc in documents:
        vec = embed_text(doc)
        store.add(doc, vec)
    return store

# 사용 예시
docs = [
    "강아지 음식 추천 가이드",
    "반려견 사료 선택 방법",
    "펫 푸드 영양 성분 분석",
    "고양이 간식 종류",
    "Python 프로그래밍 기초",
]

store = build_index(docs)
query = "강아지한테 뭘 먹여야 하나요?"
results = store.search(embed_text(query), top_k=3)

for doc, score in results:
    print(f"[{score:.3f}] {doc}")
# [0.912] 강아지 음식 추천 가이드
# [0.894] 반려견 사료 선택 방법
# [0.871] 펫 푸드 영양 성분 분석
```

위 예시에서 "강아지한테 뭘 먹여야 하나요?"라는 쿼리가 "반려견 사료"나 "펫 푸드"를 포함하는 문서도 높은 유사도로 찾아낸다는 점이 핵심이다. 단어가 달라도 의미가 같기 때문이다.

## 임베딩 모델 선택 기준

임베딩 모델은 벡터 검색의 품질을 결정하는 핵심 요소다. 주요 선택지를 비교하면 다음과 같다.

| 모델 | 차원 | 언어 | 특징 |
|------|------|------|------|
| text-embedding-3-small | 1536 | 다국어 | 저비용·고성능 균형 |
| text-embedding-3-large | 3072 | 다국어 | 최고 성능, 고비용 |
| BGE-m3 | 1024 | 다국어 | 오픈소스 최강 |
| KoSimCSE | 768 | 한국어 특화 | 한국어 최적화 |
| E5-large | 1024 | 다국어 | Mistral 기반 우수 |

한국어 문서가 많다면 **BGE-m3** 또는 **KoSimCSE** 같은 한국어에 강한 모델을 선택하는 것이 좋다. OpenAI의 text-embedding-3 시리즈도 한국어를 잘 지원한다.

## 선형 탐색 vs ANN

문서가 수백만 개라면 모든 벡터와 일일이 유사도를 계산하는 **선형 탐색(Brute Force)** 은 너무 느리다. 1백만 개 벡터 × 1536차원이라면 한 번의 쿼리에 수십 초가 걸릴 수 있다.

실제 프로덕션에서는 **근사 최근접 이웃(ANN, Approximate Nearest Neighbor)** 알고리즘을 사용한다. 정확도를 약간 희생하는 대신 수십~수백 배 빠른 탐색이 가능하다. HNSW, IVF, LSH가 대표적인 ANN 알고리즘이며, 다음 글에서 유사도 지표를 먼저 다루고 그 다음에 ANN 알고리즘을 상세히 살펴볼 것이다.

## 벡터 검색의 한계와 보완

벡터 검색도 완벽하지 않다. 몇 가지 주요 한계를 알아야 한다.

**임베딩 모델 의존성**: 검색 품질은 임베딩 모델의 학습 데이터와 도메인에 크게 의존한다. 의료나 법률처럼 전문 도메인에서는 범용 모델이 부족할 수 있다.

**정확한 단어 검색 약점**: 제품 코드("SKU-12345")나 고유명사처럼 정확한 문자열 일치가 중요한 경우 키워드 검색이 더 낫다.

**하이브리드 검색**: 그래서 실전에서는 **키워드 검색 + 벡터 검색을 결합한 하이브리드 검색**이 자주 쓰인다. BM25 점수와 벡터 유사도를 가중 합산(RRF, Reciprocal Rank Fusion)하는 방식이 특히 효과적이다.

```python
from rank_bm25 import BM25Okapi

def hybrid_search(
    query: str,
    docs: List[str],
    store: SimpleVectorStore,
    alpha: float = 0.5,  # 벡터 검색 가중치
    top_k: int = 5,
) -> List[Tuple[str, float]]:
    """BM25 + 벡터 유사도 하이브리드 검색"""
    # BM25 키워드 점수
    tokenized = [doc.split() for doc in docs]
    bm25 = BM25Okapi(tokenized)
    kw_scores = bm25.get_scores(query.split())

    # 벡터 유사도 점수
    q_vec = embed_text(query)
    vec_results = {doc: score for doc, score in store.search(q_vec, len(docs))}

    # 결합 점수 (정규화 후 가중합)
    kw_max = max(kw_scores) or 1
    combined = []
    for i, doc in enumerate(docs):
        kw = kw_scores[i] / kw_max
        vec = vec_results.get(doc, 0)
        combined.append((doc, alpha * vec + (1 - alpha) * kw))

    return sorted(combined, key=lambda x: x[1], reverse=True)[:top_k]
```

## 마무리: 벡터 검색이 필요한 시점

벡터 검색 도입을 고려해야 할 때는 다음과 같다.

- **시맨틱 검색**: 의미 기반 검색이 필요할 때 (FAQ 검색, 지식베이스)
- **RAG 구축**: LLM에 외부 지식을 주입할 컨텍스트를 검색할 때
- **추천 시스템**: 비슷한 상품·콘텐츠를 찾을 때
- **중복 감지**: 유사한 문서나 이슈를 찾을 때
- **다국어 검색**: 다른 언어로 된 문서를 의미 기반으로 검색할 때

반대로 정확한 단어 매칭, 구조화된 필드 필터링, 매우 소규모 데이터셋에는 전통적인 관계형 DB + 키워드 검색이 여전히 적합하다.

---

**지난 글:** [프롬프트 평가: 좋은 프롬프트를 측정하는 방법](/posts/prompt-evaluation/)

**다음 글:** [벡터 유사도 지표: 코사인·유클리드·내적의 모든 것](/posts/vector-similarity-metrics/)

<br>
읽어주셔서 감사합니다. 😊
