---
title: "콘텐츠 기반 필터링: 아이템 특성으로 추천하는 방법 완전 해설"
description: "TF-IDF·아이템 특성 벡터화, 코사인 유사도 기반 콘텐츠 추천, 사용자 프로파일 구축, CF와의 비교, Python 영화 추천 구현까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["콘텐츠기반필터링", "추천시스템", "TF-IDF", "코사인유사도", "아이템프로파일", "사용자프로파일", "CBF"]
featured: false
draft: false
---

[지난 글](/posts/recsys-collaborative-filtering/)에서 협업 필터링이 "나와 비슷한 사람들이 좋아한 것"을 추천하는 방식임을 살펴봤다. 그런데 서비스 초기에 사용자가 거의 없다면? 새로 온보딩된 사용자의 행동 데이터가 전혀 없다면? 협업 필터링 혼자서는 이 상황을 해결하기 어렵다. 이 빈자리를 메우는 접근이 바로 **콘텐츠 기반 필터링(Content-Based Filtering, CBF)** 이다. "이 영화를 좋아했으니, 비슷한 장르·감독·배우가 등장하는 영화 어때요?"라는 논리로 추천한다. 다른 사용자의 행동 데이터 없이, 오직 아이템 자체의 특성만으로 개인화를 구현한다는 점에서 CF와 본질적으로 다른 접근이다.

## 콘텐츠 기반 필터링이란?

콘텐츠 기반 필터링은 **아이템의 특성(콘텐츠)**을 기반으로 유사한 아이템을 추천하는 방식이다. 사용자가 이미 좋아한 아이템들의 공통 특성을 파악하고, 그 특성과 가장 잘 맞는 새 아이템을 찾아 추천한다.

협업 필터링(CF)과의 핵심 차이는 다음과 같다.

| 항목 | 협업 필터링 | 콘텐츠 기반 필터링 |
|---|---|---|
| 추천 근거 | 다른 사용자의 행동 패턴 | 아이템의 내용·속성 |
| 필요 데이터 | 사용자 간 상호작용 | 아이템 메타데이터 |
| 콜드 스타트 | 취약(신규 사용자/아이템) | 신규 아이템에 강함 |
| 다양성 | 상대적으로 높음 | 과도한 유사 추천 가능성 |
| 설명 가능성 | 낮음 | 높음("SF 장르라서 추천") |

CBF는 협업 필터링의 보완재로 자주 사용되며, 실제 서비스에서는 두 방식을 결합한 하이브리드 접근이 표준이 됐다.

## 아이템 특성 표현

추천의 품질은 아이템을 얼마나 잘 숫자로 표현하느냐에 달려 있다. 대표적인 세 가지 방법을 살펴보자.

### TF-IDF: 텍스트 설명 벡터화

TF-IDF(Term Frequency-Inverse Document Frequency)는 텍스트를 수치 벡터로 변환하는 고전적인 방법이다. 영화의 줄거리, 장르 태그, 감독·배우 이름 등을 하나의 텍스트 문서로 만들고 이를 벡터화한다.

- **TF(단어 빈도)**: 한 문서에서 특정 단어가 나타난 횟수
- **IDF(역 문서 빈도)**: 전체 문서에서 희귀한 단어에 높은 가중치를 부여

'SF'라는 단어가 모든 영화에 등장한다면 IDF가 낮아 가중치가 작아지고, '크리스토퍼 놀란'처럼 특정 영화에만 등장하는 단어는 IDF가 높아 더 강한 특성이 된다.

```python
from sklearn.feature_extraction.text import TfidfVectorizer

# 영화 설명 텍스트 목록
descriptions = [
    "SF 우주 시간 여행 블랙홀 과학",
    "SF 우주 화성 생존 과학",
    "SF 우주 재난 궤도 생존",
    "슈퍼히어로 액션 어벤져스 팀",
    "슈퍼히어로 로봇 아이언수트 천재"
]

tfidf = TfidfVectorizer()
matrix = tfidf.fit_transform(descriptions)
print(matrix.shape)  # (5, 고유단어수)
```

### 원-핫 인코딩: 카테고리형 특성

장르, 등급, 국가처럼 이산적인 카테고리를 표현할 때 사용한다. 각 카테고리를 하나의 열로 만들고 해당 여부를 0/1로 표시한다.

```python
import pandas as pd

df = pd.DataFrame({
    'title': ['인터스텔라', '어벤져스'],
    'genre': ['SF', '액션']
})

encoded = pd.get_dummies(df['genre'])
print(encoded)
# SF  액션
#  1    0
#  0    1
```

원-핫 인코딩은 직관적이지만, 카테고리 수가 많아지면 희소(sparse) 행렬이 된다는 단점이 있다.

### 임베딩: 딥러닝 기반 특성 추출

BERT나 Sentence-Transformers 같은 딥러닝 모델로 텍스트를 밀집(dense) 벡터로 변환하면, 단순 키워드 매칭을 넘어 **의미적 유사성**을 포착할 수 있다. "우주 탐험"과 "외계 행성 여행"이 다른 단어지만 의미상 가깝다는 것을 임베딩 벡터가 자동으로 반영한다.

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
descriptions = ["SF 우주 블랙홀 여행", "외계 행성 탐험 과학"]
embeddings = model.encode(descriptions)
print(embeddings.shape)  # (2, 384)
```

## 사용자 프로파일 구축

아이템 특성을 벡터로 만들었다면, 이제 사용자의 선호도를 같은 공간에 표현해야 한다. 이를 **사용자 프로파일(User Profile)**이라 부른다.

![콘텐츠 기반 필터링 파이프라인](/assets/posts/recsys-content-based-concept.svg)

### 좋아한 아이템 특성의 가중 평균

가장 단순한 방법은 사용자가 좋아한 아이템들의 특성 벡터를 평균내는 것이다. 평점이 있다면 평점을 가중치로 사용한다.

```python
import numpy as np

# 사용자가 좋아한 아이템의 TF-IDF 벡터들
liked_vectors = tfidf_matrix[[0, 1, 2]]  # 인터스텔라, 마션, 그래비티

# 평점 기반 가중 평균
ratings = np.array([5.0, 4.5, 4.0])
weights = ratings / ratings.sum()

user_profile = np.average(
    liked_vectors.toarray(),
    axis=0,
    weights=weights
)
```

### 시간 감쇠 (Time Decay)

사람의 취향은 변한다. 3년 전에 좋아한 영화와 지난주에 좋아한 영화는 현재 선호를 반영하는 정도가 다르다. **시간 감쇠(Time Decay)** 기법은 최근 행동에 더 높은 가중치를 부여한다.

```python
import math
from datetime import datetime

def time_decay_weight(timestamp, half_life_days=30):
    """최근일수록 높은 가중치 반환"""
    days_ago = (datetime.now() - timestamp).days
    return math.exp(-0.693 * days_ago / half_life_days)

# 30일 전 행동은 가중치 0.5, 60일 전은 0.25
```

반감기(half-life)를 도메인에 맞게 조정한다. 뉴스처럼 빠르게 변하는 도메인은 반감기를 짧게(1~3일), 영화·음악처럼 취향이 지속적인 도메인은 길게(30~90일) 설정한다.

## 유사도 계산과 추천

사용자 프로파일과 모든 아이템 벡터 사이의 유사도를 계산해 순위를 매기면 추천 목록이 완성된다.

### 코사인 유사도

CBF에서 가장 널리 쓰이는 유사도 지표다. 두 벡터의 크기(magnitude)가 아니라 **방향(angle)**을 비교하기 때문에, 텍스트 길이가 다른 문서도 공정하게 비교할 수 있다.

$$\text{cosine}(A, B) = \frac{A \cdot B}{\|A\| \cdot \|B\|}$$

값 범위는 -1에서 1이며, 1에 가까울수록 유사하다. TF-IDF 벡터처럼 양수만 포함된 벡터에서는 0~1 범위를 갖는다.

### 사용자-아이템 매칭 점수 계산

```python
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# user_profile: (1, n_features)
# item_vectors: (n_items, n_features)
scores = cosine_similarity(
    user_profile.reshape(1, -1),
    item_vectors
).flatten()

# 이미 본 영화는 제외
already_seen = {0, 1, 2}
candidates = [
    (i, s) for i, s in enumerate(scores)
    if i not in already_seen
]
recommendations = sorted(candidates, key=lambda x: x[1], reverse=True)
```

## 실전 코드

TF-IDF를 사용한 영화 추천 시스템을 처음부터 구현해보자.

![TF-IDF 기반 영화 추천 구현](/assets/posts/recsys-content-based-code.svg)

위 다이어그램의 코드를 실행하면 '인터스텔라'(idx=0)와 가장 유사한 영화로 '마션'과 '그래비티'가 출력된다. 두 영화 모두 SF, 우주, 과학이라는 태그를 공유하기 때문이다. 반면 '어벤져스'와 '아이언맨'은 슈퍼히어로·액션 계열이라 코사인 유사도가 낮게 나온다.

```python
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

movies = pd.DataFrame({
    'title': ['인터스텔라', '마션', '그래비티', '어벤져스', '아이언맨'],
    'tags': [
        'SF 우주 과학 시간',
        'SF 우주 과학 생존',
        'SF 우주 재난',
        '슈퍼히어로 액션',
        '슈퍼히어로 로봇 액션'
    ]
})

tfidf = TfidfVectorizer()
tfidf_matrix = tfidf.fit_transform(movies['tags'])
sim = cosine_similarity(tfidf_matrix)

# '인터스텔라'와 유사한 영화 추천
idx = 0
scores = sorted(enumerate(sim[idx]), key=lambda x: x[1], reverse=True)
top_titles = [movies['title'][i] for i, _ in scores[1:3]]
print(top_titles)
# ['마션', '그래비티']
```

실제 서비스에서는 태그 외에도 줄거리(plot synopsis), 감독 이름, 수상 이력 등 다양한 텍스트를 합쳐 하나의 특성 문서로 만들면 추천 품질이 크게 향상된다.

## CBF의 장단점

### 장점

**콜드 스타트 일부 해결**: 신규 아이템이 추가되더라도 메타데이터만 있으면 바로 추천에 포함시킬 수 있다. CF처럼 다른 사용자의 상호작용이 쌓일 때까지 기다릴 필요가 없다.

**설명 가능성**: "SF 장르이고 우주를 배경으로 하기 때문에 추천합니다"처럼 추천 이유를 사용자에게 명확히 설명할 수 있다. 이는 사용자 신뢰와 클릭률을 높이는 데 도움이 된다.

**프라이버시 보호**: 다른 사용자 데이터를 전혀 사용하지 않으므로 개인정보 관련 우려가 적다.

**개별 도메인 전문화**: 기술 문서 추천처럼 특수 도메인에서, 아이템 메타데이터가 충분하면 CF보다 더 정밀한 추천이 가능하다.

### 단점

**오버-스페셜라이제이션(Over-Specialization)**: 사용자가 좋아한 아이템과 극도로 유사한 것만 추천한다. "SF만 봐왔으니 SF만 추천"하는 식으로, 새로운 장르나 스타일을 발견할 기회가 줄어든다.

**다양성 부족**: 추천 목록이 비슷한 아이템들로 가득 차서 **필터 버블(Filter Bubble)** 현상이 심화될 수 있다.

**메타데이터 의존성**: 태그, 설명, 장르 등의 품질이 추천 품질을 직접 결정한다. 메타데이터가 부실하거나 누락된 경우 추천이 부정확해진다.

**신규 사용자 콜드 스타트**: 아이템 콜드 스타트는 해결하지만, 신규 사용자는 여전히 히스토리가 없어서 프로파일을 만들 수 없다. 온보딩 설문이나 인기 아이템 제시 같은 별도 전략이 필요하다.

## CF와 CBF의 하이브리드

현대 추천 시스템은 CF와 CBF의 약점을 서로 보완하는 **하이브리드(Hybrid)** 방식을 표준으로 사용한다.

### Weighted Hybrid

두 모델의 예측 점수를 가중 합산한다. 가장 단순하고 구현하기 쉽다.

```python
alpha = 0.6  # CBF 가중치
beta  = 0.4  # CF 가중치

final_score = alpha * cbf_score + beta * cf_score
```

사용자의 히스토리가 충분히 쌓이면 CF 가중치를 높이고, 히스토리가 부족하면 CBF에 더 의존하도록 동적으로 알파를 조정할 수도 있다.

### Switching Hybrid

특정 조건에 따라 어떤 모델을 사용할지 전환한다. 신규 사용자에게는 CBF, 데이터가 충분히 쌓인 사용자에게는 CF를 적용하는 식이다.

```python
def recommend(user_id, threshold=20):
    interaction_count = get_interaction_count(user_id)
    if interaction_count < threshold:
        return cbf_recommend(user_id)  # 콜드 스타트: CBF
    else:
        return cf_recommend(user_id)   # 데이터 충분: CF
```

### Netflix의 하이브리드 접근

Netflix는 단순한 2-모델 혼합을 넘어 수십 개의 서브 모델을 조합한다. 콘텐츠 메타데이터 기반 CBF, 시청 행동 기반 CF, 최근 시청 이력 기반 세션 추천, 시간대별 취향 모델 등이 앙상블로 결합된다. 최종 추천 목록은 **랭킹 모델(Ranking Model)**이 통합 정렬하고, 다양성 보장을 위한 재랭킹(Re-ranking) 단계를 거친다.

실제로 Netflix가 공개한 논문에 따르면, 어떤 단일 알고리즘보다 여러 신호를 조합한 하이브리드 모델의 성능이 일관되게 높았다. 추천 시스템을 설계할 때 처음부터 "어떤 알고리즘 하나를 쓸까"를 고민하기보다, "어떤 신호들을 어떻게 결합할까"를 설계하는 것이 더 실용적인 접근이다. 다음 글에서는 협업 필터링과 콘텐츠 기반 필터링 모두를 더욱 강력하게 만드는 **행렬 분해(Matrix Factorization)** 기법을 다룬다.

---

**지난 글:** [협업 필터링: 유사 사용자·아이템 기반 추천 완전 해설](/posts/recsys-collaborative-filtering/)

**다음 글:** [행렬 분해(MF): SVD·ALS·FunkSVD 추천 알고리즘 완전 해설](/posts/recsys-matrix-factorization/)

<br>
읽어주셔서 감사합니다. 😊
