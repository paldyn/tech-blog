---
title: "FastText: 부분 단어로 OOV를 정복하다"
description: "FastText가 문자 n-gram 기반의 부분 단어 모델로 OOV 문제를 해결하는 방법, 한국어 형태론에서의 강점, 실전 학습과 추론 코드를 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["FastText", "임베딩", "OOV", "부분 단어", "NLP", "한국어", "문자 n-gram"]
featured: false
draft: false
---

[지난 글](/posts/embedding-glove/)에서 GloVe가 전역 공기 통계로 단어 벡터를 만드는 원리를 살펴봤다. Word2Vec과 GloVe는 모두 우수한 임베딩을 만들지만, 공통된 맹점이 있다. **학습 어휘에 없는 단어(OOV, Out-of-Vocabulary)**가 등장하면 속수무책이다. 한국어로 생각해보자. "학습", "학습하다", "학습한", "학습했다", "학습시키다"는 모두 "학습"이라는 어근을 공유하지만, 학습 어휘에 "학습시키다"가 없으면 벡터를 생성할 수 없다. 2016년 페이스북 AI 연구팀(FAIR)이 발표한 **FastText**는 이 문제를 **문자 n-gram(character n-gram)** 기반의 부분 단어 모델로 해결했다.

## OOV 문제는 왜 심각한가

실제 서비스 환경에서 OOV는 피할 수 없다.

**신조어**: 매일 새로운 단어가 생겨난다. "오마카세", "갓생", "N포세대" 같은 단어들이 2010년대 이후 급증했고, AI 관련 용어도 매달 새로 생겨난다.

**전문 용어**: 의학, 법률, 금융 도메인에는 일반 코퍼스에 없는 전문 용어가 가득하다.

**교착어의 어형 변화**: 한국어, 터키어, 핀란드어처럼 접사로 의미를 변형하는 교착어(agglutinative language)는 단어 형태 수가 폭발적으로 늘어난다. 한국어 동사 "공부하다" 하나만 해도 "공부하고", "공부했으니", "공부하겠지만", "공부시키셨던" 등 수십~수백 가지 활용형이 존재한다. 이 모두를 어휘에 담을 수는 없다.

Word2Vec과 GloVe는 이런 단어에 `KeyError`를 던진다. FastText는 이것을 근본적으로 다른 방식으로 다룬다.

## 부분 단어 모델의 핵심 아이디어

FastText의 핵심은 단어를 **문자 n-gram의 집합**으로 표현하는 것이다. 단어 경계를 나타내는 특수 기호 `<`, `>`를 추가해 n-gram을 구성한다.

"학습한다"에 대해 2~4-gram을 구성하면:

```
<학습한다>의 문자 n-gram (n=2~4):
<학, 학습, 습한, 한다, 다>
<학습, 학습한, 습한다, 한다>
<학습한, 학습한다, 습한다>
전체 단어: <학습한다>
```

![FastText 부분 단어 분해](/assets/posts/embedding-fasttext-subword.svg)

각 n-gram은 독립적인 임베딩 벡터를 가진다. 단어의 최종 벡터는 이 n-gram 벡터들의 **합(sum)**으로 만들어진다:

```
v("학습한다") = Σ_{g ∈ G("학습한다")} z_g
```

여기서 G(w)는 단어 w에서 추출된 n-gram 집합, z_g는 n-gram g의 임베딩 벡터다.

## OOV 단어 처리 원리

학습 중 보지 못한 "새로운단어"가 등장하면:

1. 단어를 n-gram으로 분해한다
2. 각 n-gram에 대한 벡터를 테이블에서 조회한다 (이미 학습됨)
3. 알려진 n-gram 벡터들을 합산해 새 단어의 벡터를 생성한다

"새로운단어"의 일부 n-gram("새로", "로운", "운단" 등)은 학습 코퍼스에서 다른 단어들을 통해 학습되어 있을 가능성이 높다. 따라서 OOV라도 완전히 무의미한 벡터가 아닌, **의미 있는 추정치**를 얻을 수 있다.

## Skip-gram with Character N-grams

FastText는 기본적으로 Skip-gram 학습 방식을 사용하되, 단어 벡터 대신 n-gram 벡터의 합을 사용한다. 목적 함수는 다음과 같다:

```
J = Σ_{t=1}^{T} Σ_{c ∈ C_t} (
    log σ(s(w_t, w_c))
    + Σ_{n=1}^{N} log σ(-s(w_n, w_c))
)
```

여기서 `s(w, c)`는 단어 w의 n-gram 표현 벡터와 문맥 단어 c 벡터의 내적이다:

```
s(w, c) = (Σ_{g ∈ G(w)} z_g)^T · v_c
```

네거티브 샘플링은 Word2Vec과 동일하게 적용된다.

## 한국어에서의 강점

한국어는 교착어의 특성상 FastText가 특히 빛난다. 어근 "공부"를 중심으로 파생되는 단어들:

- 공부하다, 공부했다, 공부하겠다
- 공부시키다, 공부시켰다
- 공부꾼, 공부벌레

이 모든 단어가 "공부"를 포함하는 n-gram을 공유하기 때문에, FastText는 자동으로 이들 사이의 의미 유사성을 포착한다. Word2Vec에서 개별적으로 학습해야 했던 파생어들이, FastText에서는 n-gram 공유를 통해 자연스럽게 연결된다.

영어와 비교하면 차이가 더욱 극명하다. 영어는 "run", "running", "runner" 정도이지만, 한국어는 동사 하나에서 수백 가지 형태가 파생될 수 있다. 이런 형태론적 복잡성은 FastText에게 오히려 유리한 학습 환경을 만든다.

## gensim으로 FastText 학습하기

gensim은 FastText 학습도 Word2Vec과 유사한 API로 제공한다.

```python
from gensim.models import FastText

# FastText 학습
model = FastText(
    sentences=corpus,
    vector_size=300,
    window=5,
    min_count=1,    # OOV 처리를 위해 낮게 설정
    min_n=2,        # 최소 n-gram 크기
    max_n=6,        # 최대 n-gram 크기
    sg=1,           # Skip-gram
    epochs=10,
    workers=4,
)

# 학습된 단어 벡터
print(model.wv["공부"].shape)  # (300,)

# OOV 단어도 처리 가능!
oov_vec = model.wv["딥러닝시키기"]  # 학습 어휘에 없어도 OK
print(oov_vec.shape)  # (300,)

# 유사 단어 조회
sim = model.wv.most_similar("학습", topn=5)
print(sim)
```

![FastText 학습 코드](/assets/posts/embedding-fasttext-code.svg)

### 주요 파라미터

| 파라미터 | 의미 | 권장값 |
|----------|------|--------|
| `min_n` | 최소 n-gram 크기 | 2~3 |
| `max_n` | 최대 n-gram 크기 | 5~6 |
| `min_count` | 최소 등장 횟수 | 1~5 |
| `bucket` | n-gram 해시 테이블 크기 | 200만 (기본값) |

한국어는 문자 단위 n-gram이 영어 문자보다 더 의미 있는 단위를 만들어내므로, `min_n=2`, `max_n=5` 정도가 적절하다.

## 공식 FastText 라이브러리 사용

페이스북이 공개한 C++ 기반 fasttext 라이브러리도 Python에서 사용할 수 있다.

```python
import fasttext

# 학습 (입력: 텍스트 파일)
model = fasttext.train_unsupervised(
    "corpus.txt",
    model="skipgram",
    dim=300,
    ws=5,
    minCount=1,
    minn=2,
    maxn=6,
    epoch=10,
)

# 단어 벡터
vec = model.get_word_vector("학습")

# OOV 처리
oov_vec = model.get_word_vector("알고리즘최적화기법")

# 유사 단어
neighbors = model.get_nearest_neighbors("딥러닝")

# 모델 저장
model.save_model("ko_fasttext.bin")
```

공식 라이브러리는 gensim보다 빠르고, 특히 대규모 코퍼스(수 GB 이상)에서 효율적이다.

## 분류 태스크에서의 FastText

FastText는 비지도 임베딩 학습 외에 **지도 학습 텍스트 분류**도 지원한다. 놀랍도록 빠르면서 정확도도 뛰어난 것으로 알려져 있다.

```python
import fasttext

# 분류 학습 (label __label__클래스명 형식)
# 학습 파일 예: "__label__긍정 이 제품 정말 좋아요"
classifier = fasttext.train_supervised(
    "train.txt",
    epoch=25,
    lr=0.5,
    wordNgrams=2,
    dim=100,
)

# 예측
pred, prob = classifier.predict("이 영화 정말 재미있었어요")
print(pred)   # ('__label__긍정',)
print(prob)   # (0.97,)

# 검증
result = classifier.test("test.txt")
print(f"정밀도: {result[1]:.4f}, 재현율: {result[2]:.4f}")
```

FastText 분류기가 딥러닝보다 수십~수백 배 빠르면서도, 많은 벤치마크에서 정확도가 크게 뒤지지 않는다. 실시간 처리가 필요하거나 컴퓨팅 자원이 제한된 환경에서 강력한 선택지다.

## FastText vs Word2Vec: 언제 무엇을 쓸까

| 상황 | 권장 모델 |
|------|----------|
| OOV가 중요한 문제 | FastText |
| 한국어/터키어 등 교착어 | FastText |
| 신조어, 은어, 도메인 특화어 | FastText |
| 빈번 단어 위주, 어휘 안정적 | Word2Vec (CBOW) |
| 빠른 학습이 필요 | CBOW |
| 대용량 코퍼스, 희소 단어 많음 | Skip-gram |

## FastText의 한계

FastText는 OOV 문제를 해결했지만, Word2Vec/GloVe와 공통된 한계를 여전히 가진다.

**여전히 정적 임베딩**이다. 단어(또는 n-gram 집합)에 고정된 벡터가 할당된다. "배"가 "선박"인지 "과일"인지 "복부"인지는 구분하지 못한다.

**n-gram 해시 충돌**: 모든 n-gram을 독립 벡터로 저장하면 메모리가 폭발한다. 따라서 실제로는 해시 함수로 n-gram을 고정 크기 테이블에 매핑한다. 다른 n-gram이 같은 버킷에 매핑되는 **충돌(collision)**이 발생할 수 있다.

**전역 통계 무시**: GloVe와 달리, 여전히 지역 문맥 창 기반 학습을 한다.

이 중 정적 임베딩의 한계 — 즉, 문맥에 따른 의미 변화를 표현할 수 없다는 문제 — 는 다음 글의 주제인 **문맥적 임베딩(Contextual Embeddings)**이 해결한다. ELMo부터 BERT까지, 같은 단어도 문맥에 따라 다른 벡터를 생성하는 혁신이 기다리고 있다.

## 마무리

FastText는 Word2Vec의 단순 확장이지만, 그 효과는 극적이다. 문자 n-gram 부분 단어 모델은 OOV 문제를 우아하게 해결하고, 교착어 언어에서 뛰어난 성능을 발휘한다. 실용적인 NLP 파이프라인, 특히 한국어 처리에서 FastText는 여전히 첫 번째로 시도해볼 만한 임베딩 기법이다.

---

**지난 글:** [GloVe: 전역 공기 통계로 단어 벡터를 만들다](/posts/embedding-glove/)

**다음 글:** [문맥적 임베딩: ELMo부터 BERT까지](/posts/embedding-contextual/)

<br>
읽어주셔서 감사합니다. 😊
