---
title: "scikit-learn 입문: fit과 predict의 흐름"
description: "scikit-learn의 일관된 estimator API(fit·predict)를 이해하고, train_test_split으로 데이터를 나누는 이유, 첫 분류 모델을 학습하고 평가하는 전체 흐름을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["scikit-learn", "머신러닝", "fit", "predict", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-jupyter-notebook/)에서 노트북으로 데이터를 탐색하는 작업대를 갖췄다면, 이제 그 데이터로 무언가를 예측해 볼 차례다. scikit-learn은 파이썬 머신러닝의 사실상 표준 라이브러리인데, 무엇보다 좋은 점은 **모든 모델이 똑같은 사용법을 공유한다**는 것이다. 선형회귀든 랜덤포레스트든, 일단 한 모델의 흐름을 익히면 나머지는 거의 그대로 따라온다.

## 일관된 API: fit과 predict

scikit-learn의 모델을 estimator라고 부른다. 어떤 estimator든 사용법은 두 메서드로 요약된다. **`fit`으로 데이터의 패턴을 학습하고, `predict`로 새 데이터의 답을 예측한다.** 이 인터페이스가 모든 모델에서 동일하기 때문에, 모델을 바꿔 끼우는 일이 한 줄 교체로 끝난다.

![모든 모델은 fit → predict](/assets/posts/python-scikit-learn-intro-fit-predict.svg)

```python
from sklearn.linear_model import LogisticRegression

model = LogisticRegression()
model.fit(X_train, y_train)        # 학습: 특징 X와 정답 y로 패턴 익히기
preds = model.predict(X_new)       # 예측: 처음 보는 X로 정답 추정
```

`X`는 보통 2차원 형태의 특징(feature)이고, `y`는 우리가 맞히고 싶은 정답(label)이다. `fit(X, y)`는 둘의 관계를 학습해 모델 내부에 저장하고, `predict(X)`는 그 학습된 규칙으로 새 입력의 답을 내놓는다.

## 왜 데이터를 나누는가: train_test_split

여기서 가장 중요한 원칙이 하나 있다. **모델을 평가할 때는 학습에 쓰지 않은 데이터를 써야 한다.** 학습에 쓴 데이터로 채점하면, 그건 시험 문제를 미리 보여 주고 푼 점수를 매기는 것과 같다. 진짜 알고 싶은 것은 "처음 보는 데이터에서도 잘 맞히는가"다.

![왜 데이터를 나누는가](/assets/posts/python-scikit-learn-intro-train-test-split.svg)

그래서 데이터를 학습용(train)과 평가용(test)으로 나눈다. scikit-learn은 이를 위한 함수를 제공한다.

```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)
```

`test_size=0.2`는 20%를 평가용으로 떼어 두라는 뜻이다. `random_state`를 고정하면 매번 같은 방식으로 나뉘어, 실험이 재현 가능해진다.

## 처음부터 끝까지: 한 번의 흐름

이제 데이터를 나누고, 학습하고, 평가하는 전체 흐름을 이어 보자. scikit-learn에 내장된 작은 데이터셋으로 분류 모델을 만든다.

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestClassifier()
model.fit(X_train, y_train)

preds = model.predict(X_test)
print(accuracy_score(y_test, preds))    # 평가: 정확도
```

`LogisticRegression`을 `RandomForestClassifier`로 바꿔도 `fit`/`predict`는 그대로다. 이것이 일관된 API의 힘이다. 모델을 바꿔 가며 어느 것이 잘 맞는지 비교하기가 매우 쉽다.

## 전처리도 같은 인터페이스를 따른다

데이터를 모델에 넣기 전에 스케일을 맞추는 등의 전처리가 필요할 때가 많다. 전처리기(transformer)도 비슷한 인터페이스를 따르는데, `predict` 대신 `transform`을 쓴다.

```python
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
scaler.fit(X_train)                    # train으로만 통계 학습
X_train_s = scaler.transform(X_train)
X_test_s = scaler.transform(X_test)    # 같은 기준으로 변환
```

여기서도 핵심 원칙은 같다. **스케일러의 통계는 train에서만 학습하고**, test에는 그 기준을 그대로 적용한다. test의 정보가 학습에 새어 들어가는 것을 막기 위해서다. 이런 단계가 많아지면 `Pipeline`으로 묶어 한 번에 `fit`/`predict`할 수 있다.

scikit-learn 입문의 핵심은 화려한 알고리즘이 아니라, `fit`/`predict`라는 일관된 흐름과 train/test 분리라는 원칙이다. 이 둘만 몸에 익히면 어떤 모델이든 같은 방식으로 시도해 볼 수 있다. 다음 글에서는 모델에 넣기 전 데이터를 다듬는 데이터 클리닝의 실전 팁들을 다룬다.

---

**지난 글:** [Jupyter Notebook: 셀 단위로 탐색하기](/posts/python-jupyter-notebook/)

**다음 글:** [데이터 클리닝: 결측치와 이상치 다루기](/posts/python-data-cleaning-tips/)

<br>
읽어주셔서 감사합니다. 😊
