---
title: "나이브 베이즈: 빠르고 강력한 확률적 분류기"
description: "베이즈 정리부터 가우시안·다항식·베르누이 나이브 베이즈까지, 스팸 필터와 텍스트 분류 구현 코드로 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["나이브베이즈", "베이즈정리", "텍스트분류", "확률적분류", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-knn/)에서 거리 기반의 게으른 학습기 KNN을 살펴봤다. 이번에는 방향을 완전히 틀어 **확률**로 분류하는 나이브 베이즈(Naive Bayes)를 다룬다. 이름에 "나이브(순진한)"가 붙은 이유는 특성들이 서로 독립이라는 다소 비현실적인 가정을 사용하기 때문이다. 그러나 이 단순한 가정 덕분에 계산이 극도로 빨라지고, 실제로 스팸 필터·텍스트 분류·감성 분석 같은 현실 문제에서 놀라운 성능을 보인다.

## 베이즈 정리: 나이브 베이즈의 수학적 뼈대

나이브 베이즈는 **베이즈 정리(Bayes' Theorem)**를 분류에 적용한 알고리즘이다.

```
P(Class | Features) = P(Features | Class) × P(Class) / P(Features)
```

각 항의 의미:

| 용어 | 수식 | 의미 |
|------|------|------|
| 사후 확률 (Posterior) | P(Class\|Features) | 특성을 보고 나서 클래스가 맞을 확률 |
| 가능도 (Likelihood) | P(Features\|Class) | 해당 클래스에서 이 특성이 나올 확률 |
| 사전 확률 (Prior) | P(Class) | 특성 관찰 전 클래스 확률 |
| 증거 (Evidence) | P(Features) | 이 특성이 나올 전체 확률 (모든 클래스에 동일) |

분류 시 P(Features)는 상수이므로 생략하고, **가능도 × 사전 확률이 가장 큰 클래스**를 선택한다.

```python
# 스팸 필터 예시: "무료 상품 당첨" 메일이 스팸인가?

P_spam = 0.3            # 사전 확률: 메일의 30%가 스팸
P_ham  = 0.7            # 정상 메일 70%

# 가능도: 각 클래스에서 해당 단어가 나올 확률
P_free_given_spam = 0.8  # 스팸의 80%에 "무료" 등장
P_free_given_ham  = 0.1  # 정상의 10%에 "무료" 등장

# 나이브 가정: 단어들이 독립적
P_spam_score = P_free_given_spam * P_spam  # 0.24
P_ham_score  = P_free_given_ham  * P_ham   # 0.07

print("스팸 확률 비례값:", P_spam_score)  # 0.24 > 0.07 → 스팸 분류
```

![나이브 베이즈 정리 시각화](/assets/posts/ml-naive-bayes-theorem.svg)

## 왜 "나이브"인가: 조건부 독립 가정

실제 특성들은 서로 상관관계가 있다. "무료"와 "당첨"이라는 단어는 스팸 메일에서 함께 자주 등장한다. 하지만 나이브 베이즈는 이를 무시하고 모든 특성이 **조건부 독립(Conditionally Independent)**이라 가정한다.

```
P(Features | Class) = P(f₁|Class) × P(f₂|Class) × ... × P(fₙ|Class)
```

이 가정 덕분에 계산 복잡도가 O(n·d)로 낮아진다. 특성이 독립이 아니어도 **많은 경우 분류 성능이 충분히 좋다**는 것이 실용적으로 증명되어 있다.

## 세 가지 나이브 베이즈 모델

특성의 분포에 따라 세 가지 변형이 있다.

### 1. 가우시안 나이브 베이즈 (GaussianNB)

연속형 수치 특성에 사용. 각 클래스에서 특성이 **정규 분포**를 따른다고 가정한다.

```python
from sklearn.naive_bayes import GaussianNB
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

gnb = GaussianNB()
gnb.fit(X_train, y_train)
y_pred = gnb.predict(X_test)
print(f"GaussianNB 정확도: {accuracy_score(y_test, y_pred):.4f}")

# 클래스별 평균과 분산 확인
print("클래스별 특성 평균:\n", gnb.theta_)   # shape: (n_classes, n_features)
print("클래스별 특성 분산:\n", gnb.var_)
```

### 2. 다항 나이브 베이즈 (MultinomialNB)

단어 **빈도(count)** 기반 텍스트 분류에 가장 많이 사용된다.

```python
from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.pipeline import Pipeline

# 스팸 필터 예시
emails = [
    "무료 상품 당첨 축하드립니다 지금 클릭",
    "회의 일정 확인 부탁드립니다",
    "무료 이벤트 한정 특가 지금 바로",
    "내일 점심 메뉴 뭐가 좋을까요",
    "당첨 축하 무료 쿠폰 증정",
    "프로젝트 진행 상황 보고드립니다"
]
labels = [1, 0, 1, 0, 1, 0]  # 1=스팸, 0=정상

pipeline = Pipeline([
    ('vect', CountVectorizer()),
    ('clf',  MultinomialNB(alpha=1.0))  # alpha: 라플라스 스무딩
])
pipeline.fit(emails, labels)

test = ["무료 당첨 지금 클릭하세요"]
print("예측:", pipeline.predict(test))           # [1] → 스팸
print("확률:", pipeline.predict_proba(test))
```

### 3. 베르누이 나이브 베이즈 (BernoulliNB)

단어의 **존재 여부(0/1)** 기반. 짧은 문서, 이진 특성에 적합하다.

```python
from sklearn.naive_bayes import BernoulliNB
from sklearn.feature_extraction.text import CountVectorizer

# 단어 출현 여부만 사용 (빈도 무시)
vectorizer = CountVectorizer(binary=True)
X_bin = vectorizer.fit_transform(emails)

bnb = BernoulliNB(alpha=1.0)
bnb.fit(X_bin, labels)
```

![나이브 베이즈 세 가지 유형 비교](/assets/posts/ml-naive-bayes-types.svg)

## 라플라스 스무딩: 제로 확률 문제 해결

훈련 데이터에서 한 번도 등장하지 않은 단어의 확률은 0이 된다. 이 경우 곱셈 전체가 0이 되어 모든 문서가 잘못 분류된다. **라플라스 스무딩(alpha)**으로 해결한다.

```python
# 라플라스 스무딩: P(word|class) = (count + alpha) / (total + alpha * vocab_size)
# alpha=1.0 (기본값): 모든 단어에 1회 등장을 추가로 가정

from sklearn.naive_bayes import MultinomialNB

# alpha 값에 따른 스무딩 강도 비교
for alpha in [0.0, 0.1, 1.0, 10.0]:
    if alpha == 0.0:
        continue  # 0은 ZeroDivision 위험
    mnb = MultinomialNB(alpha=alpha)
    mnb.fit(X_bin, labels)
    score = mnb.score(X_bin, labels)
    print(f"alpha={alpha:.1f}: 훈련 정확도 {score:.4f}")

# 실전 권장: alpha=1.0 (기본값) 먼저 시도, 필요 시 조정
```

## 실전: 뉴스 카테고리 분류

```python
from sklearn.datasets import fetch_20newsgroups
from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

# 20개 뉴스그룹 데이터셋
categories = ['sci.space', 'rec.sport.hockey',
              'comp.graphics', 'talk.politics.guns']

train = fetch_20newsgroups(subset='train', categories=categories,
                           remove=('headers', 'footers', 'quotes'))
test  = fetch_20newsgroups(subset='test',  categories=categories,
                           remove=('headers', 'footers', 'quotes'))

# TF-IDF + MultinomialNB 파이프라인
pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(max_features=10000, ngram_range=(1, 2))),
    ('clf',   MultinomialNB(alpha=0.1))
])

pipeline.fit(train.data, train.target)
y_pred = pipeline.predict(test.data)

print(classification_report(test.target, y_pred,
                             target_names=categories))
# 정확도 보통 90% 이상 달성
```

## 나이브 베이즈의 강점과 약점

**강점:**
- **학습·예측 속도**: 데이터 크기에 선형 비례(O(n·d))
- **소량 데이터에 강함**: 파라미터가 적어 과적합 위험 낮음
- **다중 클래스 자연 지원**: 별도 처리 불필요
- **확률 출력**: 예측에 대한 신뢰도 제공
- **온라인 학습 지원**: `partial_fit()`으로 스트리밍 가능

**약점:**
- **독립 가정 위반**: 상관 특성이 많으면 확률 추정이 왜곡
- **연속 특성 처리**: 가우시안 가정이 맞지 않으면 성능 저하
- **zero-frequency 문제**: 스무딩 없이는 학습 데이터에 없는 특성이 문제

| 비교 항목 | 나이브 베이즈 | 로지스틱 회귀 | KNN |
|-----------|--------------|--------------|-----|
| 학습 속도 | 매우 빠름 | 빠름 | 없음(게으름) |
| 예측 속도 | 매우 빠름 | 빠름 | 느림 |
| 데이터 요구량 | 적음 | 중간 | 많음 |
| 텍스트 분류 | 탁월 | 좋음 | 부적합 |
| 해석 가능성 | 중간 | 높음 | 낮음 |

## 언제 나이브 베이즈를 선택할까

**이런 상황에 강력 추천:**
- 스팸 필터, 뉴스 분류, 감성 분석 등 **텍스트 분류**
- 실시간 분류가 필요한 **저레이턴시 시스템**
- 학습 데이터가 적은 **콜드 스타트** 상황
- 새 데이터가 계속 들어오는 **스트리밍 학습**
- 빠른 **베이스라인 모델** 구축

**피해야 할 상황:**
- 특성 간 강한 상관관계 (예: 주가 예측, 센서 데이터)
- 수치 특성 위주이며 분포가 정규 분포와 거리가 먼 경우
- 최고 성능이 필요한 경쟁 환경

나이브 베이즈는 머신러닝 실무자의 툴킷에서 빠져서는 안 될 도구다. 특히 텍스트 처리에서 복잡한 모델보다 나이브 베이즈가 더 나을 때가 많다. 다음 글에서는 완전히 다른 철학으로 분류하는 **서포트 벡터 머신(SVM)**을 살펴본다.

---

**지난 글:** [K-최근접 이웃(KNN): 가장 직관적인 분류 알고리즘](/posts/ml-knn/)

**다음 글:** [서포트 벡터 머신(SVM): 최대 마진 분류기의 원리](/posts/ml-svm/)

<br>
읽어주셔서 감사합니다. 😊
