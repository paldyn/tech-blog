---
title: "Word2Vec: 신경망으로 단어 의미를 학습하다"
description: "CBOW와 Skip-gram 아키텍처부터 네거티브 샘플링, 계층적 소프트맥스, 단어 유추 태스크까지 — Word2Vec의 작동 원리를 수식과 gensim 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["Word2Vec", "임베딩", "CBOW", "Skip-gram", "NLP", "gensim", "단어 벡터"]
featured: false
draft: false
---

[지난 글](/posts/embedding-basics/)에서는 임베딩의 본질을 살펴봤다 — 이산적인 토큰 ID를 고차원 실수 벡터로 변환해 의미 관계를 포착하는 기술이다. 이번 글에서는 그 역사적 출발점으로 거슬러 올라간다. 2013년 구글의 Tomas Mikolov 팀이 발표한 **Word2Vec**은 현대 NLP의 혁명을 알린 신호탄이었다. 단순한 2층 신경망으로 단어의 의미를 수백 차원의 벡터에 압축해 넣고, 그 결과로 "왕 − 남자 + 여자 = 여왕"이라는 놀라운 산술이 가능해진 것이다.

## Word2Vec이 등장하기 전

Word2Vec 이전에도 단어를 벡터로 표현하는 시도는 있었다. 카운트 기반 방법(Count-based Methods)이 대표적이다. TF-IDF나 LSA(잠재 의미 분석)가 여기 해당한다. 그러나 이 방법들은 두 가지 근본적 한계를 가졌다.

첫째, **계산 비용**이 막대하다. 어휘 크기 V가 10만 개라면, V×V 공기 행렬을 구성하고 SVD를 돌려야 한다. 메모리와 연산량 모두 감당하기 어렵다.

둘째, **밀집 표현의 품질**이 제한적이다. LSA는 전역 통계를 활용하지만, 지역 문맥 패턴을 세밀하게 포착하는 데 한계가 있다.

Word2Vec은 이 문제를 전혀 다른 방식으로 해결했다. 행렬을 분해하는 대신, 신경망을 학습해 임베딩을 직접 최적화한다. 목표는 단순하다: **주변 단어를 보고 중심 단어를 예측**하거나, **중심 단어를 보고 주변 단어를 예측**할 수 있는 벡터를 찾아라.

## 두 가지 아키텍처: CBOW와 Skip-gram

Word2Vec은 두 가지 변형 아키텍처를 제시한다.

![CBOW vs Skip-gram 아키텍처](/assets/posts/embedding-word2vec-arch.svg)

### CBOW (Continuous Bag of Words)

CBOW는 **문맥 단어들로 중심 단어를 예측**하는 방식이다. "나는 ___ 먹었다"라는 문장에서 빈칸(밥)을 맞추는 것과 유사하다.

윈도우 크기 `w`를 정하면, 중심 단어 기준으로 앞뒤 `w`개 단어가 입력이 된다. 각 문맥 단어 벡터를 **평균**내어 투영층(projection layer)을 만들고, 소프트맥스로 중심 단어 확률을 계산한다.

```
P(w_t | w_{t-k}, ..., w_{t-1}, w_{t+1}, ..., w_{t+k})
```

CBOW의 장점은 **속도**다. 여러 문맥 단어를 평균내기 때문에 학습이 빠르고, 빈번하게 등장하는 단어의 표현 품질이 우수하다. 소규모 데이터셋에서 상대적으로 안정적으로 동작한다.

### Skip-gram

Skip-gram은 반대로 **중심 단어로 문맥 단어들을 예측**한다. "밥"이라는 단어가 주어졌을 때, "나는", "오늘", "먹었다", "맛있게" 등을 예측하는 것이다.

```
P(w_{t+j} | w_t)  for j ∈ {-k, ..., -1, 1, ..., k}
```

Skip-gram의 목적 함수는 다음과 같이 로그 우도를 최대화하는 방향으로 정의된다:

```
J(θ) = 1/T * Σ_{t=1}^{T} Σ_{-k≤j≤k, j≠0} log P(w_{t+j} | w_t)
```

Skip-gram은 CBOW보다 느리지만, **희소 단어(rare words)**에서 월등한 성능을 보인다. 중심 단어 하나가 여러 쌍을 만들어내기 때문에, 드물게 등장하는 단어도 충분한 학습 신호를 받는다. 대규모 코퍼스에서 Skip-gram이 CBOW보다 일반적으로 더 좋은 임베딩을 만든다.

## 왜 소프트맥스가 문제인가

초기 Word2Vec은 소프트맥스를 사용했다. 소프트맥스는 단어 확률을 계산할 때 **전체 어휘**를 분모에 포함한다:

```
P(w_O | w_I) = exp(v'_{w_O}^T · v_{w_I}) / Σ_{w=1}^{V} exp(v'_w^T · v_{w_I})
```

어휘 크기 V가 100만 개라면, 매 스텝마다 100만 번의 내적을 계산해야 한다. 이는 학습을 실용적으로 불가능하게 만든다.

### 해결책 1: 계층적 소프트맥스 (Hierarchical Softmax)

허프만 이진 트리를 활용한다. 각 단어를 트리의 잎 노드로 배치하되, 빈번한 단어를 루트에 가깝게 배치한다. 예측은 루트에서 잎까지의 경로를 따라 이진 분류를 반복하는 것이다. 계산 복잡도가 O(V)에서 O(log V)로 줄어든다.

### 해결책 2: 네거티브 샘플링 (Negative Sampling)

더 실용적이고 널리 쓰이는 방법이다. 매 학습 스텝에서 전체 어휘를 보는 대신, **올바른 문맥 단어 1개** + **무작위로 고른 노이즈 단어 k개**만 사용한다.

목적 함수가 다음처럼 단순화된다:

```
J = log σ(v'_{w_O}^T · v_{w_I}) + Σ_{i=1}^{k} E_{w_i ~ P_n(w)} [log σ(-v'_{w_i}^T · v_{w_I})]
```

실제로는 어휘 빈도의 3/4 거듭제곱에 비례하는 확률로 노이즈 단어를 샘플링한다. 이렇게 하면 빈번한 단어가 너무 자주 선택되는 것을 완화한다. k는 보통 5~20개 정도가 적당하다.

## 단어 유추 태스크: 벡터 공간의 기하학

Word2Vec이 화제가 된 결정적 이유는 **단어 유추(Word Analogy)** 태스크의 놀라운 성능이었다.

```
왕 − 남자 + 여자 ≈ 여왕
파리 − 프랑스 + 한국 ≈ 서울
```

이는 임베딩 공간에 실제로 의미적 관계가 벡터 방향으로 인코딩되어 있다는 증거다. "남자"에서 "여자"로의 벡터 변위가, "왕"에서 "여왕"으로의 변위와 거의 일치하는 것이다.

gensim에서는 이를 `most_similar`의 `positive`, `negative` 인자로 테스트할 수 있다:

```python
model.wv.most_similar(
    positive=["여왕", "남자"],
    negative=["왕"]
)
# → [("여자", 0.85), ...]
```

이 현상은 언어 자체에 관계 구조가 내재되어 있음을 시사한다. 모델은 단순히 주변 단어 예측 과제를 학습하면서, 부산물로 이 구조를 벡터 공간에 포착하게 된다.

## gensim으로 Word2Vec 학습하기

실제로 Word2Vec을 학습해보자. gensim은 고성능의 Word2Vec 구현체를 제공한다.

```python
from gensim.models import Word2Vec

# 말뭉치 준비 (문장 리스트의 리스트)
corpus = [
    ["나는", "오늘", "밥을", "먹었다"],
    ["오늘", "날씨가", "좋다"],
    # ...
]

# Skip-gram 모델 학습
model = Word2Vec(
    sentences=corpus,
    vector_size=300,   # 임베딩 차원
    window=5,          # 문맥 창 크기
    min_count=5,       # 최소 등장 빈도
    sg=1,              # 1=Skip-gram, 0=CBOW
    negative=10,       # 네거티브 샘플 수
    epochs=10,
    workers=4,
)

# 단어 벡터 확인
print(model.wv["음식"])   # shape: (300,)

# 유사 단어 조회
similar = model.wv.most_similar("왕", topn=5)
print(similar)
# → [('황제', 0.87), ('군주', 0.84), ...]

# 단어 유추
result = model.wv.most_similar(
    positive=["여왕", "남자"],
    negative=["왕"],
    topn=3
)
```

![Gensim Word2Vec 학습 코드](/assets/posts/embedding-word2vec-code.svg)

### 주요 하이퍼파라미터

| 파라미터 | 권장값 | 설명 |
|----------|--------|------|
| `vector_size` | 100~300 | 임베딩 차원 수 |
| `window` | 5~10 | 문맥 창 크기 |
| `min_count` | 5~10 | 최소 등장 빈도 |
| `sg` | 0 or 1 | 0=CBOW, 1=Skip-gram |
| `negative` | 5~20 | 네거티브 샘플 수 |
| `epochs` | 5~15 | 학습 반복 횟수 |

데이터 크기가 작다면 CBOW와 높은 에포크 수를, 대규모 코퍼스라면 Skip-gram을 선택하는 것이 일반적인 전략이다.

## 사전 학습 모델 활용

직접 학습이 어렵다면, 사전 학습된 모델을 활용할 수 있다. 한국어의 경우 다양한 공개 Word2Vec 모델이 존재한다.

```python
from gensim.models import KeyedVectors

# 사전 학습 벡터 로드
wv = KeyedVectors.load_word2vec_format(
    "ko.bin", binary=True
)

# 유사도 계산
similarity = wv.similarity("컴퓨터", "노트북")
print(f"유사도: {similarity:.4f}")  # ≈ 0.78
```

## Word2Vec의 한계

Word2Vec은 혁신적이었지만 근본적인 한계가 있다.

**정적 임베딩(Static Embeddings)**: 단어 하나에 벡터 하나가 고정된다. "배"가 "배(선박)"인지 "배(복부)"인지 "배(과일)"인지 문맥에 따라 다른 의미를 갖지만, Word2Vec은 이를 하나의 벡터로 평균낸다.

**OOV(Out-of-Vocabulary) 문제**: 학습 어휘에 없는 단어는 벡터를 만들 수 없다. 한국어처럼 조사와 어미가 다양하게 결합하는 교착어에서 특히 심각하다.

**전역 통계 무시**: Word2Vec은 지역 문맥(로컬 윈도우)만 사용한다. 전체 코퍼스에 걸친 전역 공기 패턴을 활용하지 못한다.

이 한계들이 이후 GloVe, FastText, BERT 등 더 발전된 임베딩 기법들의 탄생 배경이 된다.

## 마무리

Word2Vec은 단순한 아이디어 — 주변 단어로 중심 단어 예측 — 를 대규모로 효율적으로 구현함으로써 NLP의 패러다임을 바꿨다. CBOW와 Skip-gram의 차이, 네거티브 샘플링의 필요성, 그리고 벡터 공간의 기하학적 성질을 이해하면 이후 모든 임베딩 기술의 기초를 갖추게 된다.

다음 글에서는 Word2Vec이 무시했던 **전역 공기 통계**를 활용하는 GloVe를 살펴본다.

---

**지난 글:** [임베딩 기초: 단어를 벡터 공간에 배치하다](/posts/embedding-basics/)

**다음 글:** [GloVe: 전역 공기 통계로 단어 벡터를 만들다](/posts/embedding-glove/)

<br>
읽어주셔서 감사합니다. 😊
