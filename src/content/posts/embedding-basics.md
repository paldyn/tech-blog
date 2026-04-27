---
title: "임베딩(Embedding)이란 무엇인가 — 의미를 숫자로 바꾸는 기술"
description: "텍스트·이미지·오디오를 고차원 벡터로 표현하는 임베딩의 원리와 코사인 유사도, 실전 활용법을 코드와 시각화로 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-25"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["임베딩", "embedding", "벡터", "코사인유사도", "RAG", "LLM", "AI기초"]
featured: false
draft: false
---

"고양이"와 "강아지"는 비슷한 단어입니다. 그런데 컴퓨터는 어떻게 이 사실을 알 수 있을까요? 텍스트 자체로는 두 단어가 다른 문자열일 뿐입니다. 컴퓨터가 언어의 **의미**를 다루기 위해 탄생한 기술이 바로 **임베딩(Embedding)** 입니다.

임베딩은 RAG, 의미 검색, 추천 시스템, LLM의 입력 처리 등 현대 AI의 핵심 파이프라인에 빠짐없이 등장합니다. 이 글에서는 임베딩이 무엇인지, 어떻게 만들어지는지, 그리고 실제로 어떻게 활용되는지를 코드와 함께 살펴봅니다.

---

## 임베딩이란?

임베딩은 텍스트(혹은 이미지, 오디오 등)를 **고차원의 실수 벡터(숫자 배열)** 로 변환하는 것입니다.

> **임베딩 = "의미를 보존하면서 데이터를 숫자 배열로 변환한 것"**

예를 들어 "고양이"라는 단어는 다음과 같이 표현될 수 있습니다.

```text
"고양이" → [0.231, -0.847, 0.562, 0.129, 0.984, -0.311, ... (총 768개 숫자)]
"강아지" → [0.219, -0.831, 0.578, 0.141, 0.971, -0.298, ... (총 768개 숫자)]
"사과"   → [-0.541, 0.203, -0.112, 0.667, -0.234, 0.891, ... (총 768개 숫자)]
```

"고양이"와 "강아지"의 벡터는 매우 비슷하고, "사과"의 벡터는 많이 다릅니다. 이것이 임베딩의 핵심입니다. **의미가 비슷한 것은 벡터도 비슷**하게 만들어 줍니다.

---

## 왜 필요한가? — 기계는 문자를 이해 못 한다

컴퓨터는 숫자만 계산할 수 있습니다. 텍스트 그 자체는 계산할 수 없습니다. 임베딩 이전에 텍스트를 숫자로 만드는 가장 단순한 방법은 **원핫 인코딩(One-hot encoding)** 이었습니다.

```python
# 원핫 인코딩 예시: 단어를 0/1 벡터로
vocabulary = ["고양이", "강아지", "사과", "바나나"]

# "고양이" → [1, 0, 0, 0]
# "강아지" → [0, 1, 0, 0]
# "사과"   → [0, 0, 1, 0]

import numpy as np

def one_hot(word, vocab):
    vec = np.zeros(len(vocab))
    if word in vocab:
        vec[vocab.index(word)] = 1.0
    return vec

cat = one_hot("고양이", vocabulary)
dog = one_hot("강아지", vocabulary)

# 코사인 유사도: 두 벡터 사이의 각도 (1=동일, 0=무관)
cos_sim = np.dot(cat, dog) / (np.linalg.norm(cat) * np.linalg.norm(dog))
print(f"고양이 vs 강아지 유사도: {cos_sim:.3f}")  # 0.000

# → 원핫은 모든 단어가 '동일하게 다르다'고 봄 — 의미 반영 불가
```

원핫 인코딩의 치명적 한계는 **의미 관계를 전혀 담지 못한다**는 점입니다. "고양이"와 "강아지"의 유사도가 "고양이"와 "사과"의 유사도와 동일하게 0이 됩니다. 그래서 등장한 것이 Word2Vec(2013)을 시작으로 한 **의미 기반 임베딩**입니다.

---

## 임베딩 공간: 의미를 좌표로

![임베딩 벡터 공간 시각화](/assets/posts/embedding-concept.svg)

위 다이어그램에서 볼 수 있듯, 잘 학습된 임베딩 모델이 만든 벡터 공간에서는:
- **같은 카테고리의 단어들이 모여** 클러스터를 형성합니다 (동물, 과일, 도시, 동사)
- **의미적으로 비슷한 단어일수록 거리가 가깝습니다**
- 반대 의미의 단어는 반대 방향에 배치됩니다

더 나아가, 벡터 연산으로 **유추(analogy)** 도 가능합니다.

```python
# 유명한 Word2Vec 유추 실험
# 왕 - 남자 + 여자 ≈ 여왕
king   = embed("왕")
man    = embed("남자")
woman  = embed("여자")

result = king - man + woman
# result 벡터와 가장 가까운 단어 찾기 → "여왕"
```

이 결과가 가능한 이유는, 임베딩 공간에서 "왕-남자" 벡터(= 왕족이라는 개념)와 "여왕-여자" 벡터가 거의 동일한 방향을 가리키기 때문입니다. 임베딩은 단순한 숫자 변환이 아니라 의미 구조 자체를 수학적으로 포착합니다.

---

## 유사도 측정: 코사인 유사도

임베딩 벡터들이 "얼마나 비슷한지" 측정하는 표준 방법은 **코사인 유사도(Cosine Similarity)** 입니다.

```python
import numpy as np

def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """두 벡터 사이의 코사인 유사도를 반환합니다. 범위: [-1, 1]"""
    dot_product = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot_product / (norm_a * norm_b)


# 예시: 임베딩 벡터 (실제로는 모델이 생성)
cat = np.array([0.231, -0.847, 0.562, 0.129, 0.984])
dog = np.array([0.219, -0.831, 0.578, 0.141, 0.971])
apple = np.array([-0.541, 0.203, -0.112, 0.667, -0.234])

print(f"고양이 vs 강아지: {cosine_similarity(cat, dog):.4f}")   # ~0.999
print(f"고양이 vs 사과:   {cosine_similarity(cat, apple):.4f}") # ~0.100
```

코사인 유사도는 벡터의 **방향**을 비교합니다. 크기(길이)가 달라도 방향이 같으면 1에 가깝게 나옵니다. 이것이 텍스트 임베딩에 적합한 이유입니다. 문장이 짧든 길든 핵심 의미가 같으면 높은 유사도를 보입니다.

---

## 실제 임베딩 모델 사용하기

최신 임베딩 모델은 단어 하나가 아니라 **문장 전체의 의미**를 하나의 벡터로 표현합니다. API를 통해 바로 사용할 수 있습니다.

### OpenAI text-embedding-3 사용 예시

```python
from openai import OpenAI
import numpy as np

client = OpenAI()  # OPENAI_API_KEY 환경변수 필요

def get_embedding(text: str, model: str = "text-embedding-3-small") -> list[float]:
    """텍스트를 임베딩 벡터로 변환합니다."""
    response = client.embeddings.create(
        input=text,
        model=model,
    )
    return response.data[0].embedding


# 예시
cat_vec = get_embedding("고양이")
dog_vec = get_embedding("강아지")
apple_vec = get_embedding("사과")

cat = np.array(cat_vec)
dog = np.array(dog_vec)
apple = np.array(apple_vec)

def cosine_sim(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

print(f"고양이 vs 강아지: {cosine_sim(cat, dog):.4f}")   # 높음 (~0.85 이상)
print(f"고양이 vs 사과:   {cosine_sim(cat, apple):.4f}") # 낮음 (~0.3 미만)
print(f"벡터 차원: {len(cat_vec)}")                       # 1536
```

### sentence-transformers (로컬 실행)

API 비용 없이 로컬에서 바로 실행할 수 있는 오픈소스 모델도 있습니다.

```bash
# 패키지 설치
pip install sentence-transformers
```

```python
from sentence_transformers import SentenceTransformer
import numpy as np

# 한국어 지원 다국어 모델
model = SentenceTransformer("BAAI/bge-m3")

sentences = [
    "고양이는 독립적인 동물입니다.",
    "고양이는 스스로 행동하는 것을 좋아합니다.",
    "오늘 점심으로 피자를 먹었습니다.",
]

# 한 번에 여러 문장 임베딩
embeddings = model.encode(sentences)
print(f"임베딩 shape: {embeddings.shape}")  # (3, 1024)

# 첫 두 문장 유사도 (의미 유사) vs 첫-세 번째 (의미 무관)
def cosine_sim(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

print(f"문장 1 vs 2: {cosine_sim(embeddings[0], embeddings[1]):.4f}")  # 높음
print(f"문장 1 vs 3: {cosine_sim(embeddings[0], embeddings[2]):.4f}")  # 낮음
```

---

## 임베딩의 핵심 활용: 의미 검색 파이프라인

임베딩이 가장 빛을 발하는 곳은 **의미 기반 검색(Semantic Search)** 입니다. 키워드 매칭이 아니라 의미로 검색합니다.

```python
쿼리: "강아지 배변 훈련"
문서: "반려견 대소변 가리기 방법"    # 키워드는 다르지만 의미는 동일
→ 키워드 검색: 불일치 (놓침)
→ 의미 검색:   높은 유사도 (올바르게 검색됨)
```

아래 파이프라인은 RAG(검색 증강 생성) 시스템의 핵심 구조이기도 합니다.

![임베딩 기반 유사 문서 검색 파이프라인](/assets/posts/embedding-pipeline.svg)

전체 코드로 구현하면 다음과 같습니다.

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("BAAI/bge-m3")

# 문서 데이터베이스
documents = [
    "고양이 사료 선택 방법과 영양소 가이드",
    "강아지 훈련 기초: 앉아, 기다려 명령어",
    "주식 투자 초보자를 위한 종목 선택 전략",
    "파이썬 기초 문법: 변수와 함수 정리",
    "반려묘 건강 관리와 정기 검진 체크리스트",
]

# 1. 문서 전체를 미리 임베딩 (DB 구축 단계)
doc_embeddings = model.encode(documents)

def semantic_search(query: str, top_k: int = 3) -> list[tuple[float, str]]:
    """쿼리와 의미적으로 가장 유사한 문서 top_k개를 반환합니다."""

    # 2. 쿼리 임베딩
    query_vec = model.encode([query])[0]

    # 3. 코사인 유사도 계산
    scores = []
    for doc_vec, doc in zip(doc_embeddings, documents):
        score = float(
            np.dot(query_vec, doc_vec)
            / (np.linalg.norm(query_vec) * np.linalg.norm(doc_vec))
        )
        scores.append((score, doc))

    # 4. 유사도 높은 순 정렬 후 반환
    return sorted(scores, reverse=True)[:top_k]


# 실행
results = semantic_search("고양이 키우는 법", top_k=3)

for rank, (score, doc) in enumerate(results, 1):
    print(f"#{rank} (유사도: {score:.3f}) {doc}")

# 출력 예시:
# #1 (유사도: 0.912) 고양이 사료 선택 방법과 영양소 가이드
# #2 (유사도: 0.874) 반려묘 건강 관리와 정기 검진 체크리스트
# #3 (유사도: 0.623) 강아지 훈련 기초: 앉아, 기다려 명령어
```

---

## 임베딩 DB (벡터 스토어)

실제 서비스에서는 수백만~수억 개의 문서를 임베딩하고 빠르게 검색해야 합니다. 이를 위해 **벡터 데이터베이스(Vector Store)** 를 사용합니다.

```python
# Chroma DB 예시 (가장 간단한 로컬 벡터 DB)
import chromadb
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-m3")
client = chromadb.Client()
collection = client.create_collection("my_docs")

# 문서 추가
documents = [
    "고양이 사료 선택 방법",
    "강아지 훈련 기초",
    "주식 투자 전략",
]
embeddings = model.encode(documents).tolist()

collection.add(
    documents=documents,
    embeddings=embeddings,
    ids=["doc1", "doc2", "doc3"],
)

# 검색
results = collection.query(
    query_embeddings=model.encode(["고양이 키우기"]).tolist(),
    n_results=2,
)
print(results["documents"])
```

대규모 환경에서는 **Pinecone, Weaviate, Qdrant, pgvector** 같은 전용 벡터 DB가 사용되며, 수백만 벡터에서도 밀리초 단위 검색이 가능합니다.

---

## 임베딩 모델 선택 가이드

```text
목적                   추천 모델
────────────────────────────────────────────────────
영어 전용, 빠른 속도    all-MiniLM-L6-v2 (384차원)
다국어 (한국어 포함)    BAAI/bge-m3 (1024차원)
한국어 특화             jhgan/ko-sroberta-multitask
API 사용 (비용 OK)     text-embedding-3-small (1536차원)
고성능 API              text-embedding-3-large (3072차원)
```

차원이 높을수록 더 많은 의미 정보를 담을 수 있지만, 저장 공간과 계산 비용도 증가합니다. 실제로는 용도에 맞는 균형점을 찾아야 합니다.

---

## 임베딩과 LLM의 차이

임베딩 모델과 LLM(GPT, Claude 등)은 종종 혼동됩니다. 핵심 차이는 다음과 같습니다.

| 구분 | 임베딩 모델 | LLM |
|------|------------|-----|
| 출력 | 숫자 벡터 (고정 크기) | 텍스트 (가변 길이) |
| 목적 | 의미 표현, 유사도 계산 | 텍스트 생성, 대화 |
| 대표 활용 | 의미 검색, 클러스터링 | 질문 답변, 요약, 코딩 |
| 비용 | 매우 저렴 | 비교적 높음 |

RAG 시스템은 두 가지를 조합합니다. **임베딩 모델**로 관련 문서를 검색하고, **LLM**으로 최종 답변을 생성합니다. 이전 시리즈 글 "RAG 기초"에서 이 흐름을 자세히 다뤘습니다.

---

## 정리

임베딩은 "의미를 수학적으로 표현하는 기술"입니다.

- **텍스트 → 벡터**: 의미 보존, 수학 연산 가능
- **의미 유사 → 벡터 유사**: 코사인 유사도로 측정
- **활용**: 의미 검색, RAG, 추천, 클러스터링, 분류

임베딩은 단독으로도 강력하지만, LLM과 결합될 때 진가를 발휘합니다. 다음 글에서는 LLM이 가진 근본적인 한계 — **환각(Hallucination)** 과 **지식 컷오프** 문제 — 를 살펴봅니다.

---

**지난 글:** [토크나이저와 토큰: LLM이 텍스트를 읽는 방법](/posts/tokenizer-and-tokens/)

**다음 글:** [프롬프트 엔지니어링 — AI에게 제대로 말 거는 법](/posts/prompt-engineering/)

<br>
읽어주셔서 감사합니다. 😊
