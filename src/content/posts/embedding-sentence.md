---
title: "문장 임베딩: SBERT와 의미 검색"
description: "단어 임베딩이 문장을 표현할 수 없는 이유, SBERT 샴 네트워크로 문장을 단일 벡터로 인코딩하는 원리, 코사인 유사도 기반 의미 검색 구현까지 sentence-transformers 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["문장 임베딩", "SBERT", "의미 검색", "sentence-transformers", "NLP", "RAG", "코사인 유사도"]
featured: false
draft: false
---

[지난 글](/posts/embedding-contextual/)에서 ELMo와 BERT가 문맥에 따라 다른 벡터를 생성하는 문맥적 임베딩을 살펴봤다. 이제 현실적인 질문이 남는다. "AI 기술이 발전했다"와 "인공지능이 급속히 성장하고 있다" — 이 두 문장이 의미상 비슷한가? BERT는 문장의 각 토큰에 문맥적 벡터를 만들어주지만, **문장 전체를 하나의 벡터로** 표현하는 것은 별도의 문제다. 문서 검색, 의미 유사도 측정, RAG(Retrieval-Augmented Generation)의 핵심인 **문장 임베딩**이 바로 이 공백을 메운다. 그 중심에는 2019년 Reimers & Gurevych가 발표한 **SBERT(Sentence-BERT)**가 있다.

## 왜 BERT를 그대로 쓰면 안 되는가

BERT로 두 문장의 유사도를 측정하는 가장 직관적인 방법은 두 문장을 함께 입력하는 것이다:

```
[CLS] 문장A [SEP] 문장B [SEP]
```

이 방식은 크로스 어텐션으로 두 문장의 관계를 깊이 모델링해 정확하다. 문제는 **계산 비용**이다. N개의 문장 중 가장 유사한 것을 찾으려면 O(N²) 번의 BERT 추론이 필요하다. 10,000개 문장이면 5,000만 번 — 실시간 검색에서는 사실상 불가능하다.

다른 방법은 각 문장을 독립적으로 BERT에 넣고 [CLS] 토큰 벡터를 추출하는 것이다:

```python
# 나쁜 방법: [CLS] 벡터를 그냥 사용
out = bert(sentence)
vec = out.last_hidden_state[:, 0, :]  # [CLS] 토큰
```

이 방식은 빠르지만 품질이 낮다. 원래 BERT는 [CLS] 토큰이 문장 전체의 의미를 담도록 학습되지 않았다. 실험 결과, 이렇게 얻은 벡터의 유사도는 평균 풀링보다도 나쁜 경우가 많다.

평균 풀링(mean pooling)은 조금 낫다:

```python
# 평균 풀링
hidden = out.last_hidden_state  # [1, seq_len, 768]
mask = inputs["attention_mask"].unsqueeze(-1)  # [1, seq_len, 1]
vec = (hidden * mask).sum(dim=1) / mask.sum(dim=1)
```

하지만 이것도 BERT가 문장 유사도를 위해 최적화된 것이 아니기 때문에, 실제 의미 유사도와 벡터 유사도가 잘 일치하지 않는다.

## SBERT: 샴 네트워크로 문장을 비교하다

SBERT의 핵심 아이디어는 간단하다. BERT를 **샴 네트워크(Siamese Network)** 구조로 파인튜닝해, 문장의 의미 유사도를 직접 최적화하는 것이다.

![SBERT 샴 네트워크 아키텍처](/assets/posts/embedding-sentence-sbert.svg)

### 샴 네트워크 구조

두 개의 BERT 인코더가 **가중치를 공유**하면서 독립적으로 두 문장을 인코딩한다:

```
문장 A → BERT(shared) → 풀링 → 벡터 u ∈ R^768
문장 B → BERT(shared) → 풀링 → 벡터 v ∈ R^768
```

가중치 공유가 핵심이다. 두 인코더가 같은 파라미터를 가지므로, 동일한 의미는 동일한 방향의 벡터로 인코딩되어야 한다는 제약이 자연스럽게 생긴다.

### 풀링 전략

SBERT는 여러 풀링 전략을 실험했다:

```python
def pool(hidden_states, attention_mask, strategy="mean"):
    if strategy == "cls":
        return hidden_states[:, 0, :]
    elif strategy == "mean":
        mask = attention_mask.unsqueeze(-1).float()
        return (hidden_states * mask).sum(1) / mask.sum(1)
    elif strategy == "max":
        mask = attention_mask.unsqueeze(-1).float()
        hidden_states[mask == 0] = -1e9
        return hidden_states.max(1).values
```

논문 결과, **평균 풀링(mean pooling)**이 [CLS] 풀링과 최대 풀링보다 일반적으로 우수했다.

### 학습 목표

SBERT는 두 가지 주요 학습 방식을 사용한다.

**1. NLI (Natural Language Inference) 방식**

문장 쌍의 관계(함의/중립/모순)를 분류하도록 학습한다:

```
분류기 입력 = [u; v; |u-v|]  (연결)
출력 = softmax(W · [u; v; |u-v|])
```

이 방식으로 파인튜닝하면 BERT는 문장 간 논리적 관계를 벡터 공간에 반영하도록 학습된다.

**2. STS (Semantic Textual Similarity) 방식**

문장 쌍의 유사도 점수(0~5)를 직접 회귀하도록 학습한다:

```
예측값 = cos(u, v) * 5
손실 = MSE(예측값, 정답 점수)
```

**3. 트리플렛 손실 (Triplet Loss)**

```
L = max(cos(a, n) - cos(a, p) + ε, 0)
```

앵커(a), 양성 예시(p), 음성 예시(n) 세 문장을 사용해, 앵커와 양성 예시가 음성 예시보다 가까워지도록 학습한다.

## 코사인 유사도로 의미 검색하기

SBERT의 진짜 위력은 사전 계산(pre-computation)에 있다. N개의 문서에 대한 임베딩을 미리 계산해두면, 쿼리 문장 하나의 임베딩과 코사인 유사도를 계산해 O(N) 시간에 검색할 수 있다.

```python
from sentence_transformers import (
    SentenceTransformer,
    util,
)
import torch

# 한국어 SBERT 로드
model = SentenceTransformer(
    "jhgan/ko-sroberta-multitask"
)

# 문서 임베딩 사전 계산
corpus = [
    "AI가 의료 진단에 혁명을 일으키고 있다",
    "기계 학습으로 질병을 예측한다",
    "자율주행 자동차의 안전성 연구",
    "딥러닝이 이미지 인식을 바꾸다",
    "오늘 점심 뭐 먹을까",
]
corpus_embeddings = model.encode(corpus, convert_to_tensor=True)

# 쿼리 문장
query = "인공지능이 의학에 미치는 영향"
query_embedding = model.encode(query, convert_to_tensor=True)

# 코사인 유사도로 검색
scores = util.cos_sim(query_embedding, corpus_embeddings)[0]
top_results = torch.topk(scores, k=3)

print("검색 결과:")
for score, idx in zip(top_results.values, top_results.indices):
    print(f"  {score:.4f}: {corpus[idx]}")
# → 0.87: AI가 의료 진단에 혁명을 일으키고 있다
# → 0.79: 기계 학습으로 질병을 예측한다
# → 0.45: 딥러닝이 이미지 인식을 바꾸다
```

![SBERT 문장 임베딩 코드](/assets/posts/embedding-sentence-code.svg)

## 주요 한국어 SBERT 모델

sentence-transformers 라이브러리에서 사용할 수 있는 대표적인 한국어 문장 임베딩 모델:

| 모델명 | 특징 | 임베딩 차원 |
|--------|------|------------|
| `jhgan/ko-sroberta-multitask` | 다양한 태스크 학습, 범용 | 768 |
| `snunlp/KR-SBERT-V40K-klueNLI-augSTS` | KLUE NLI + STS | 768 |
| `BM-K/KoSimCSE-roberta` | SimCSE 방식, 대조 학습 | 768 |
| `upskyy/kf-deberta-multitask` | DeBERTa 기반 | 768 |

## 의미 검색 시스템 구축: FAISS 활용

문서 수가 수십만 건 이상이면 단순한 행렬 곱으로 충분하지 않을 수 있다. 이때 Facebook의 **FAISS(Facebook AI Similarity Search)** 라이브러리가 유용하다:

```python
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("jhgan/ko-sroberta-multitask")

# 대규모 코퍼스 임베딩
corpus = [...]  # 수십만 문장
embeddings = model.encode(corpus, batch_size=128, show_progress_bar=True)
embeddings = np.array(embeddings, dtype=np.float32)

# FAISS 인덱스 구축
dimension = embeddings.shape[1]  # 768
index = faiss.IndexFlatIP(dimension)  # 내적(=정규화 후 코사인 유사도)

# L2 정규화 후 추가
faiss.normalize_L2(embeddings)
index.add(embeddings)
print(f"인덱스에 {index.ntotal}개 문서 추가됨")

# 검색
query = "인공지능 의료 진단"
query_vec = model.encode([query], normalize_embeddings=True)
D, I = index.search(query_vec, k=5)  # 상위 5개

for dist, idx in zip(D[0], I[0]):
    print(f"유사도 {dist:.4f}: {corpus[idx][:50]}")
```

FAISS의 `IndexFlatIP`는 정확한 최근접 이웃 탐색이다. 속도가 더 필요하다면 `IndexIVFFlat` (클러스터링 기반 근사 탐색)이나 `IndexHNSWFlat` (그래프 기반 근사 탐색)을 사용한다.

## RAG에서의 문장 임베딩

현재 가장 실용적인 문장 임베딩 응용은 **RAG(Retrieval-Augmented Generation)**다.

```
[사용자 질문] → [문장 임베딩] → [FAISS 검색] → [관련 문서 N개]
    ↓
[LLM에게 질문 + 관련 문서를 함께 전달]
    ↓
[근거 기반의 정확한 답변 생성]
```

LLM의 한계(환각, 최신 정보 미지원)를 보완하는 RAG에서 문장 임베딩 품질이 전체 시스템 성능을 좌우한다. 같은 의미의 질문이라도 다른 표현으로 들어올 때, 올바른 문서를 찾아낼 수 있어야 한다.

```python
from sentence_transformers import SentenceTransformer, util

class SimpleRAG:
    def __init__(self, embed_model, llm_fn):
        self.model = SentenceTransformer(embed_model)
        self.llm = llm_fn
        self.corpus = []
        self.embeddings = None

    def add_documents(self, docs):
        self.corpus.extend(docs)
        new_embs = self.model.encode(docs, convert_to_tensor=True)
        if self.embeddings is None:
            self.embeddings = new_embs
        else:
            self.embeddings = torch.cat([self.embeddings, new_embs])

    def retrieve(self, query, top_k=3):
        q_emb = self.model.encode(query, convert_to_tensor=True)
        scores = util.cos_sim(q_emb, self.embeddings)[0]
        top = torch.topk(scores, k=top_k)
        return [self.corpus[i] for i in top.indices]

    def answer(self, query):
        context = self.retrieve(query)
        prompt = f"문서:\n" + "\n".join(context) + f"\n\n질문: {query}"
        return self.llm(prompt)
```

## SBERT 기반 중복 문장 탐지

문장 임베딩의 또 다른 실용적 응용은 대규모 텍스트 데이터에서 **중복(또는 유사) 문장 탐지**다:

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer("jhgan/ko-sroberta-multitask")
sentences = [
    "오늘 날씨가 맑다",
    "날씨가 오늘 좋네요",
    "인공지능 기술이 발전했다",
    "AI 기술 수준이 크게 향상됐다",
    "내일 비가 올 예정이다",
]

embeddings = model.encode(sentences, convert_to_tensor=True)
cosine_scores = util.cos_sim(embeddings, embeddings)

# 유사도가 0.8 이상인 쌍 탐지
for i in range(len(sentences)):
    for j in range(i+1, len(sentences)):
        if cosine_scores[i][j] > 0.8:
            print(f"유사 쌍 ({cosine_scores[i][j]:.2f}):")
            print(f"  {sentences[i]}")
            print(f"  {sentences[j]}")
```

## 마무리: 임베딩 시리즈를 돌아보며

이 시리즈에서 우리는 임베딩의 진화를 함께 따라왔다.

**Word2Vec** — 신경망으로 지역 문맥을 학습해 의미 벡터를 최초로 실용화했다.

**GloVe** — 전역 공기 통계를 명시적으로 활용해 더 풍부한 의미 관계를 포착했다.

**FastText** — 문자 n-gram으로 OOV 문제를 해결하고 교착어 처리를 혁신했다.

**ELMo / BERT** — 정적 임베딩의 한계를 넘어, 문맥에 따라 동적으로 변하는 임베딩을 실현했다.

**SBERT** — 문장 수준의 의미를 하나의 벡터로 효율적으로 인코딩해, 의미 검색과 RAG의 기반을 만들었다.

다음 글에서는 이 임베딩의 지평을 텍스트 너머로 확장한다. 이미지와 텍스트를 **같은 벡터 공간에** 배치하는 멀티모달 임베딩 — CLIP과 그 후속 모델들 — 이 기다리고 있다.

---

**지난 글:** [문맥적 임베딩: ELMo부터 BERT까지](/posts/embedding-contextual/)

**다음 글:** [멀티모달 임베딩: 텍스트와 이미지를 같은 공간에](/posts/embedding-multimodal/)

<br>
읽어주셔서 감사합니다. 😊
