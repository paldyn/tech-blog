---
title: "RAG 리랭킹: 검색 품질을 한 단계 끌어올리는 기술"
description: "RAG의 검색 결과를 정밀하게 재정렬하는 리랭킹의 원리와 Cross-Encoder 모델, Cohere·BGE·Jina 등 주요 리랭커 비교, 실전 구현까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["RAG", "리랭킹", "Reranking", "CrossEncoder", "BGE", "Cohere"]
featured: false
draft: false
---

[지난 글](/posts/rag-retrieval-strategies/)에서 BM25·벡터·하이브리드 검색이라는 세 가지 검색 전략을 완전히 파악했다. 이제 한 단계 더 나아가, 1차 검색으로 뽑아낸 수십 개의 후보 문서를 **더 정확한 기준으로 다시 정렬**하는 **리랭킹(Reranking)**을 다룬다. 리랭킹을 추가하면 동일한 검색 인덱스를 사용하더라도 LLM에 전달되는 컨텍스트 품질이 눈에 띄게 올라가고, 결과적으로 최종 답변의 정확성도 함께 높아진다.

## 왜 리랭킹이 필요한가

Bi-Encoder 기반 벡터 검색은 속도가 빠르지만 근본적인 한계가 있다. 쿼리와 문서를 **각각 독립적으로** 인코딩한 뒤 벡터 간 유사도를 측정하기 때문에, 두 텍스트 사이의 세밀한 언어 상호작용을 포착하지 못한다. 예를 들어 "Python 설치 방법"을 검색할 때 "Python 제거 방법"이 높은 유사도를 기록하는 경우가 있다. 두 문서의 단어 분포가 비슷하기 때문이다.

Cross-Encoder 기반 리랭커는 이 문제를 해결한다. 쿼리와 문서를 **함께** 하나의 시퀀스로 입력해 어텐션 메커니즘이 두 텍스트 사이의 관계를 직접 학습하게 한다. 정확도는 훨씬 높지만 문서 임베딩을 사전 계산할 수 없으므로 속도가 느리다. 리랭킹은 이 트레이드오프를 영리하게 활용한다 — **1차 검색으로 후보를 좁히고, 리랭커로 정밀하게 순위를 매긴다.**

![RAG 리랭킹 파이프라인](/assets/posts/rag-reranking-pipeline.svg)

## Bi-Encoder vs Cross-Encoder 구조

**Bi-Encoder**: `encode(query)` → `encode(doc)` → `cosine_similarity`
- 문서 임베딩을 오프라인에 미리 계산해 저장
- 쿼리 인코딩 1회 + ANN 검색으로 수백만 문서도 밀리초 단위 검색
- 단점: 쿼리-문서 상호작용 어텐션 없음

**Cross-Encoder**: `encode([query, doc])` → `relevance_score`
- 쿼리와 문서가 함께 트랜스포머에 입력됨
- 상호작용 어텐션으로 세밀한 관련성 판단 가능
- 단점: 문서마다 추론을 실행해야 하므로 대규모 검색에 직접 적용 불가

```python
from sentence_transformers import CrossEncoder

# bge-reranker-v2-m3: 한국어 포함 다국어 지원
reranker = CrossEncoder('BAAI/bge-reranker-v2-m3')

query = "AI 규제 현황과 주요 법안"
# 1차 검색: Top-50 후보 확보 (벡터 검색)
candidates = vector_search(query, top_k=50)

# 리랭킹: 쿼리-문서 쌍 점수화
pairs = [(query, doc.text) for doc in candidates]
scores = reranker.predict(pairs)

# 점수 내림차순 정렬 → Top-5 선택
ranked = sorted(zip(candidates, scores), key=lambda x: -x[1])
top5 = [doc for doc, _ in ranked[:5]]

# LLM에는 Top-5만 전달
context = "\n\n".join(doc.text for doc in top5)
```

## Cohere Rerank API 활용

오픈소스 모델 대신 Cohere의 상용 리랭킹 API를 사용하면 구현이 훨씬 간단하다.

```python
import cohere

co = cohere.Client("YOUR_API_KEY")

results = co.rerank(
    model="rerank-multilingual-v3.0",  # 한국어 포함 다국어
    query="AI 규제 현황과 주요 법안",
    documents=[doc.text for doc in candidates],
    top_n=5,
    return_documents=True
)

for hit in results.results:
    print(f"점수: {hit.relevance_score:.4f} | {hit.document.text[:80]}...")
```

Cohere Rerank는 호출당 과금이지만 인프라를 관리할 필요가 없어 프로토타입이나 소규모 서비스에 유리하다. 대규모 서비스에서는 오픈소스 모델을 GPU에 올려 자체 운영하는 편이 비용 효율적이다.

## LangChain 통합

LangChain에서는 `ContextualCompressionRetriever`와 `CrossEncoderReranker`를 조합해 리랭킹을 손쉽게 추가한다.

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder

# 1. 기본 벡터 검색기
base_retriever = vectorstore.as_retriever(search_kwargs={"k": 30})

# 2. 리랭커 래퍼
model = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3")
compressor = CrossEncoderReranker(model=model, top_n=5)

# 3. 압축 검색기 (검색 → 리랭킹 자동 처리)
compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=base_retriever
)

docs = compression_retriever.invoke("AI 규제 현황은?")
```

## 주요 리랭커 모델 비교

![주요 리랭커 모델 비교](/assets/posts/rag-reranking-models.svg)

리랭커 선택 시 가장 중요한 기준은 **지원 언어**와 **배포 방식**이다.

- **한국어 RAG**: `bge-reranker-v2-m3`(BAAI) 또는 `jina-reranker-v2`를 로컬에서 실행하는 것이 비용 효율적이다
- **영어 고성능**: Cohere Rerank API는 간편하고 성능이 검증돼 있다
- **경량 영어**: `cross-encoder/ms-marco-MiniLM-L-6-v2`는 빠르고 가볍지만 한국어 성능이 낮다

## 성능 vs 비용 트레이드오프

| 설정 | 검색 정확도 | 지연시간 | 비용 |
|-----|-----------|---------|-----|
| 벡터 검색만 (Top-5) | 보통 | 매우 낮음 | 낮음 |
| 벡터 검색 Top-50 + 리랭킹 Top-5 | 높음 | 낮음~보통 | 중간 |
| 하이브리드 검색 + 리랭킹 | 매우 높음 | 보통 | 높음 |

현업에서는 **벡터 검색 Top-30~50 + Cross-Encoder 리랭킹 Top-5** 패턴이 품질과 속도의 최적점으로 자주 채택된다. 여기에 하이브리드 검색(BM25 + 벡터)을 추가하면 Recall을 더 높일 수 있다.

## 정리

리랭킹은 RAG 파이프라인에서 가장 간단하면서도 효과가 확실한 개선 방법이다. 기존 벡터 인덱스를 그대로 두고 리랭커 한 개만 추가하면 되기 때문에 레거시 시스템에 통합하기도 쉽다. 핵심은 1차 검색에서 넉넉하게(Top-30~100) 후보를 뽑고, 리랭커가 비용을 지불할 만한 Top-5 정도로 좁히는 구조를 유지하는 것이다.

---

**지난 글:** [RAG 검색 전략 완전 정복: Sparse·Dense·Hybrid 검색 비교](/posts/rag-retrieval-strategies/)

**다음 글:** [RAG 쿼리 재작성: 검색 품질을 높이는 쿼리 변환 기법](/posts/rag-query-rewriting/)

<br>
읽어주셔서 감사합니다. 😊
