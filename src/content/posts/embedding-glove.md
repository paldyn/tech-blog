---
title: "GloVe: 전역 공기 통계로 단어 벡터를 만들다"
description: "GloVe가 공기 행렬의 전역 통계와 국소 문맥 창의 장점을 결합하는 방법, 목적 함수의 수학적 의미, 사전 학습 벡터 활용법을 깊이 있게 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["GloVe", "임베딩", "공기 행렬", "NLP", "단어 벡터", "전역 통계"]
featured: false
draft: false
---

[지난 글](/posts/embedding-word2vec/)에서 Word2Vec이 신경망으로 단어 의미를 학습하는 원리를 살펴봤다. Skip-gram은 지역 문맥 창 안에서 중심 단어와 주변 단어 쌍만을 학습한다. 그런데 여기에는 놓치는 것이 있다. 전체 코퍼스에서 "얼음(ice)"과 "냉기(cold)"가 얼마나 자주 함께 등장하는지, 그 **전역 통계(global statistics)**가 담고 있는 정보다. 2014년 스탠퍼드의 Jeffrey Pennington 팀이 발표한 **GloVe(Global Vectors for Word Representation)**는 이 전역 공기 패턴을 명시적으로 모델링해 더 풍부한 의미 표현을 달성했다.

## 공기 행렬이란 무엇인가

**공기(Co-occurrence)**란 두 단어가 같은 문맥 창 내에 함께 등장하는 것을 말한다. 전체 코퍼스를 훑으며 모든 단어 쌍에 대해 이 빈도를 세면 **공기 행렬(Co-occurrence Matrix) X**가 만들어진다.

```
X_{ij} = 단어 i의 문맥 창 내에 단어 j가 등장한 총 횟수
```

![GloVe 공기 행렬 시각화](/assets/posts/embedding-glove-matrix.svg)

위 시각화에서 "ice"와 "cold"의 공기 빈도가 8.4로 높게 나타나고, "warm"과 "fire"의 공기도 높다. 반면 "ice"와 "fire"는 낮은 공기를 보인다. 이 숫자들이 바로 의미 관계를 담고 있다.

공기 행렬 X에서 파생되는 핵심 값은 **조건부 확률**이다:

```
P(k | i) = X_{ik} / X_i
```

여기서 X_i = Σ_j X_{ij}는 단어 i의 총 문맥 등장 횟수다.

GloVe의 핵심 통찰은 **비율(ratio)**에 있다. 두 단어 i, j와 탐침 단어 k 사이의 관계는 단순한 확률이 아닌 **확률의 비율**로 가장 잘 포착된다:

```
P(k | ice) / P(k | steam)
```

k="cold"라면 이 비율은 크다(얼음은 차갑고, 증기는 뜨거우므로).
k="hot"이라면 이 비율은 작다.
k="water"라면 두 단어 모두 관련이 있어 비율이 1에 가깝다.

이 비율 구조를 벡터 공간에서 표현하는 것이 GloVe의 목표다.

## GloVe의 목적 함수

GloVe 논문은 단어 벡터 w_i, w_j와 단어 편향 b_i, b_j를 학습해 다음 목적 함수를 최소화한다:

```
J = Σ_{i,j=1}^{V} f(X_{ij}) (w_i^T w̃_j + b_i + b̃_j - log X_{ij})^2
```

각 구성 요소를 살펴보자.

**가중치 함수 f(X_{ij})**는 희소 공기 쌍의 과도한 영향을 억제한다:

```
f(x) = (x/x_max)^α  if x < x_max
f(x) = 1            if x >= x_max
```

일반적으로 x_max=100, α=0.75를 사용한다. 빈도가 낮은 공기 쌍은 가중치를 낮게, 빈도가 높아도 일정 이상은 가중치를 1로 고정해 극단값을 방지한다.

**목적**: `w_i^T w̃_j ≈ log X_{ij} - b_i - b̃_j`

즉, 두 단어 벡터의 내적이 그 단어들의 공기 로그 빈도를 근사하도록 학습된다. 이것이 GloVe를 "전역 통계 기반"으로 만드는 핵심이다. 학습 도중 개별 (i, j) 쌍을 샘플링하는 것이 아니라, 미리 구축된 공기 행렬 전체를 한꺼번에 활용한다.

## Word2Vec과의 비교

GloVe와 Word2Vec은 각자 다른 철학에서 출발한다.

**Word2Vec (Skip-gram)**:
- 로컬 문맥 창 내의 단어 쌍을 무작위 샘플링
- 온라인 학습, 대용량 코퍼스 스트리밍 가능
- 희소 단어에서 상대적으로 강함

**GloVe**:
- 전체 코퍼스의 공기 행렬을 사전 계산
- 행렬 전체의 전역 통계 활용
- 빈번한 단어 쌍의 비율 관계를 명시적으로 모델링

실증 연구에서 두 모델의 성능 차이는 데이터셋과 태스크에 따라 다르다. 일반적으로 GloVe는 단어 유추 태스크에서, Word2Vec Skip-gram은 단어 유사도 태스크에서 강세를 보이는 경향이 있다. 실제 프로젝트에서는 두 모델을 모두 시도해보는 것이 권장된다.

## 사전 학습 GloVe 벡터 로드

GloVe는 스탠퍼드에서 위키피디아 + Gigaword, 커먼 크롤 등으로 학습한 사전 학습 벡터를 공개 배포한다.

```python
import numpy as np

# GloVe 텍스트 파일 로드
def load_glove(path):
    vecs = {}
    for line in open(path, encoding="utf-8"):
        w, *v = line.split()
        vecs[w] = np.array(v, dtype=float)
    return vecs

# glove.6B.300d.txt (6억 단어, 300차원)
glove = load_glove("glove.6B.300d.txt")

# 단어 벡터 접근
print(glove["python"].shape)  # (300,)

# 코사인 유사도 계산
def cos_sim(a, b):
    return (a @ b) / (np.linalg.norm(a) * np.linalg.norm(b))

sim = cos_sim(glove["cat"], glove["dog"])
print(f"cat-dog 유사도: {sim:.4f}")  # ≈ 0.92

# 단어 유추
def analogy(a, b, c, vecs, topn=5):
    target = vecs[b] - vecs[a] + vecs[c]
    target /= np.linalg.norm(target)
    exclude = {a, b, c}
    scored = [
        (w, cos_sim(target, v / np.linalg.norm(v)))
        for w, v in vecs.items()
        if w not in exclude
    ]
    return sorted(scored, key=lambda x: -x[1])[:topn]

# king - man + woman = ?
result = analogy("man", "woman", "king", glove)
print(result[0])  # ('queen', 0.85...) 예상
```

![GloVe 벡터 로드 코드](/assets/posts/embedding-glove-code.svg)

## 단어 유추와 선형 구조

GloVe도 Word2Vec처럼 단어 유추 태스크를 잘 처리한다. 이는 GloVe의 목적 함수 자체에서 자연스럽게 유도된다.

비율 관계 `P(k|ice)/P(k|steam)`이 벡터 차이 `w_ice - w_steam`으로 인코딩되어야 한다는 것이 GloVe 논문의 동기였다. 이 수학적 요구사항이 결과적으로 선형 구조를 낳고, "왕 − 남자 + 여자 = 여왕" 같은 유추 연산을 가능하게 한다.

더 나아가, 공기 확률 비율의 **로그** 값이 내적으로 근사되기 때문에, 의미 관계가 벡터 방향(direction)과 크기(magnitude)에 동시에 인코딩된다. 빈도가 높은 단어들은 벡터 크기가 작아지는 경향이 있는데, 이는 "the", "a" 같은 기능어가 의미적으로 낮은 정보를 담음에도 어디서나 등장하는 특성을 반영한다.

## Keras/TensorFlow로 GloVe 임베딩 레이어 만들기

사전 학습 GloVe 벡터를 딥러닝 모델의 임베딩 초기값으로 사용할 수 있다:

```python
import numpy as np
import tensorflow as tf

def build_embedding_matrix(word_index, glove, dim=300):
    vocab_size = len(word_index) + 1
    matrix = np.zeros((vocab_size, dim))
    for word, i in word_index.items():
        vec = glove.get(word)
        if vec is not None:
            matrix[i] = vec
    return matrix

# 임베딩 레이어 생성 (초기값으로 GloVe 사용)
embedding_matrix = build_embedding_matrix(word_index, glove)
embedding_layer = tf.keras.layers.Embedding(
    input_dim=vocab_size,
    output_dim=300,
    weights=[embedding_matrix],
    trainable=False,  # 고정 or True로 미세조정
)
```

`trainable=False`로 고정하면 빠른 수렴과 과적합 방지 효과를 얻는다. 데이터가 풍부하면 `trainable=True`로 두어 도메인에 맞게 미세조정할 수 있다.

## PyTorch에서 GloVe 임베딩 초기화

```python
import torch
import torch.nn as nn

class GloVeTextClassifier(nn.Module):
    def __init__(self, vocab_size, embed_dim, num_classes, glove_matrix):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        # GloVe 벡터로 초기화
        self.embedding.weight.data.copy_(
            torch.tensor(glove_matrix, dtype=torch.float)
        )
        self.embedding.weight.requires_grad = False
        self.fc = nn.Linear(embed_dim, num_classes)

    def forward(self, x):
        # x: [batch, seq_len]
        emb = self.embedding(x).mean(dim=1)  # mean pooling
        return self.fc(emb)
```

## GloVe의 한계와 이후 발전

GloVe는 Word2Vec보다 전역 정보를 잘 활용하지만, 공통된 한계를 여전히 가진다.

첫째, **다의어 문제**가 해결되지 않는다. "bank"는 금융 기관과 강변이라는 두 의미가 있지만, GloVe도 하나의 벡터에 두 의미를 뭉개버린다. 공기 행렬은 전체 코퍼스 평균을 내기 때문에, 문맥에 따른 의미 변화를 담지 못한다.

둘째, **OOV 처리 불가**다. GloVe는 사전 학습 어휘에 없는 단어에 대한 벡터를 생성할 수 없다.

셋째, **메모리 요구량**이 크다. V×V 공기 행렬을 구성해야 하므로, 어휘 크기가 수십만~수백만이면 행렬 자체가 수십 GB에 달할 수 있다. (실제로는 희소 행렬로 표현해 완화한다.)

다음 글에서 살펴볼 **FastText**는 부분 단어(subword) 개념으로 OOV 문제를 해결하고, 한국어처럼 형태론이 복잡한 언어에서 뛰어난 성능을 발휘한다.

## 마무리

GloVe는 "왜 공기 확률의 비율이 의미 관계를 포착하는가"라는 명쾌한 이론적 동기에서 출발해, 이를 잘 정의된 목적 함수로 구현한 우아한 모델이다. Word2Vec의 지역 문맥 샘플링과 대비되는 전역 통계 활용은 오늘날에도 임베딩 연구에서 중요한 시각을 제공한다. 사전 학습 GloVe 벡터는 여전히 많은 NLP 파이프라인에서 강력한 기준선(baseline) 역할을 한다.

---

**지난 글:** [Word2Vec: 신경망으로 단어 의미를 학습하다](/posts/embedding-word2vec/)

**다음 글:** [FastText: 부분 단어로 OOV를 정복하다](/posts/embedding-fasttext/)

<br>
읽어주셔서 감사합니다. 😊
