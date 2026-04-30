---
title: "훈련·검증·테스트 세트 분리: 올바른 모델 평가의 기초"
description: "데이터를 훈련·검증·테스트 세트로 나누는 원칙, 비율 설정 방법, 데이터 누수를 방지하는 파이프라인 설계까지 머신러닝 평가의 기초를 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["훈련세트", "테스트세트", "데이터분할", "데이터누수", "모델평가"]
featured: false
draft: false
---

[지난 글](/posts/ml-tsne-umap/)에서 t-SNE와 UMAP으로 고차원 데이터를 시각화하는 방법을 살펴봤다. 이제 방향을 바꿔 모델을 만들었을 때 그 성능을 **어떻게 올바르게 측정하는가**로 넘어간다. 아무리 정교한 알고리즘을 썼더라도 평가 방법이 잘못되면 현실에서 전혀 다른 성능을 보일 수 있다. 훈련·검증·테스트 세트 분리는 그 모든 평가의 출발점이다.

## 왜 데이터를 나눠야 하는가

머신러닝 모델의 목표는 **본 적 없는 데이터에서도 잘 동작하는 것**이다. 만약 평가를 학습에 사용한 데이터로 한다면 어떻게 될까?

모델은 학습 데이터의 패턴을 기억(암기)할 수 있다. 극단적으로 훈련 샘플을 모두 외운 모델은 훈련 세트 정확도 100%를 달성하지만, 새로운 데이터에서는 완전히 실패한다. 이를 **과대적합(Overfitting)**이라 한다. 학습에 쓰지 않은 별도 데이터로 평가해야 실제 일반화 성능을 측정할 수 있다.

## 세 세트의 역할

![훈련·검증·테스트 세트 분리 구조](/assets/posts/ml-train-val-test-split.svg)

**훈련 세트(Training Set)**는 모델이 패턴을 배우는 데이터다. 가중치, 계수 등 모델의 파라미터는 모두 이 세트를 통해 최적화된다. 전처리에 사용하는 통계량(평균, 표준편차 등)도 훈련 세트에서만 계산해야 한다.

**검증 세트(Validation Set)**는 학습 중 모델 선택과 하이퍼파라미터 튜닝에 사용한다. 학습률, 정규화 강도, 레이어 수 같은 하이퍼파라미터를 바꿔가며 검증 세트 성능을 모니터링한다. 검증 세트는 여러 번 참조해도 되지만, 너무 자주 참조하다 보면 간접적으로 검증 세트에 최적화되는 현상이 생긴다.

**테스트 세트(Test Set)**는 최종 성능 보고에만 사용하는 봉인 데이터다. 모델 개발이 완전히 끝난 뒤 단 한 번만 열어봐야 한다. 개발 중에 테스트 세트를 참조하면 모델이 테스트 세트에 과적합되어 실제 배포 성능보다 낙관적인 평가 결과가 나온다.

## 적절한 분할 비율

일반적으로 사용하는 비율은 다음과 같다.

| 데이터 크기 | 훈련 | 검증 | 테스트 |
|------------|------|------|--------|
| 소규모 (~1만) | 60% | 20% | 20% |
| 중규모 (~10만) | 70% | 15% | 15% |
| 대규모 (100만+) | 98% | 1% | 1% |

대규모 데이터에서는 테스트 세트를 1%로 줄여도 통계적으로 충분한 샘플(10,000개 이상)이 확보된다. 반대로 소규모 데이터에서는 테스트 세트 비율을 높여 평가 신뢰도를 높인다.

```python
from sklearn.model_selection import train_test_split

# 전략: 7:1.5:1.5 분할
# temp = val + test (30%)
X_train, X_temp, y_train, y_temp = train_test_split(
    X, y,
    test_size=0.30,
    stratify=y,        # 클래스 비율 유지
    random_state=42
)

# temp를 val, test로 1:1 분할
X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp,
    test_size=0.50,
    stratify=y_temp,
    random_state=42
)

print(f"Train: {len(X_train):,} / Val: {len(X_val):,} / Test: {len(X_test):,}")
```

`stratify=y`는 분할 후에도 각 세트의 클래스 분포가 원본과 동일하게 유지되도록 보장한다. 클래스 불균형 데이터에서는 필수적이다.

## 데이터 누수: 가장 흔한 함정

**데이터 누수(Data Leakage)**는 테스트/검증 세트의 정보가 학습 과정에 흘러들어가 성능이 실제보다 좋게 측정되는 현상이다. 머신러닝 실수 중 가장 흔하면서도 치명적이다.

![데이터 누수 방지 파이프라인](/assets/posts/ml-train-val-test-leakage.svg)

가장 흔한 누수 사례는 전처리 순서를 잘못 잡는 것이다. 전체 데이터에 `StandardScaler().fit_transform(X)`를 먼저 적용하면 테스트 세트의 평균·표준편차 정보가 스케일링에 사용되고, 이는 곧 모델이 테스트 데이터를 "미리 본" 것과 같은 효과를 낸다.

```python
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression

# Pipeline을 쓰면 누수를 자동으로 방지
pipe = Pipeline([
    ('scaler', StandardScaler()),   # fit은 훈련에만
    ('clf',    LogisticRegression())
])

# fit은 X_train 기준으로만 내부 처리
pipe.fit(X_train, y_train)

# transform은 X_train 통계를 X_val, X_test에 그대로 적용
val_score  = pipe.score(X_val, y_val)
test_score = pipe.score(X_test, y_test)
print(f"Val Acc: {val_score:.4f} | Test Acc: {test_score:.4f}")
```

`Pipeline`은 `fit()`이 호출될 때 내부 변환 단계들을 훈련 데이터에만 적용하고, `predict()`나 `score()`에서는 저장된 파라미터로 변환만 수행한다. 특성 선택, 결측값 처리, 인코딩 등 모든 전처리를 Pipeline 안에 묶으면 누수 위험이 사라진다.

## 다른 형태의 데이터 누수

**시간적 누수**: 시계열 데이터에서 미래 데이터가 과거 예측에 사용되는 경우다. 주가 예측 모델을 만들 때 데이터를 무작위로 분할하면 2025년 1월 데이터를 2024년 12월 예측에 사용하는 상황이 발생한다. 시계열은 반드시 시간 순서대로 분리해야 한다.

```python
from sklearn.model_selection import TimeSeriesSplit

# 시계열 교차 검증 (미래 데이터 누수 방지)
tscv = TimeSeriesSplit(n_splits=5)
for train_idx, val_idx in tscv.split(X):
    X_tr, X_v = X[train_idx], X[val_idx]
    # train_idx는 항상 val_idx보다 과거
```

**타겟 누수**: 예측하려는 대상(타겟) 정보를 특성에 포함시키는 경우다. 예를 들어 신용 부도 예측 모델에서 "부도 후 처리된 채권 여부" 같은 특성이 포함되면 모델이 타겟 정보를 특성으로 직접 학습한다.

**그룹 누수**: 같은 환자의 여러 검사 결과처럼 상관관계가 있는 샘플들이 훈련과 테스트에 나뉠 때 발생한다. `GroupKFold`를 사용해 같은 그룹은 같은 세트에 묶어야 한다.

## 시간 순서를 지키는 시계열 분할

```python
import numpy as np

# 시계열 데이터는 랜덤 분할 금지
n = len(X)
train_end = int(n * 0.70)
val_end   = int(n * 0.85)

X_train = X[:train_end]
X_val   = X[train_end:val_end]
X_test  = X[val_end:]

y_train = y[:train_end]
y_val   = y[train_end:val_end]
y_test  = y[val_end:]

print(f"Train: {train_end} / Val: {val_end - train_end} / Test: {n - val_end}")
```

## 분할 전 체크리스트

1. **데이터 섞기**: `shuffle=True`(기본값)로 순서 편향 제거
2. **클래스 비율 확인**: 분류 문제는 `stratify=y`로 비율 유지
3. **전처리 순서**: 분할 후 훈련 세트 기준으로 fit
4. **타겟 누수 점검**: 특성과 타겟의 시간 관계 확인
5. **그룹 처리**: 같은 ID의 샘플이 분리되지 않도록 `GroupKFold` 고려

훈련·검증·테스트 분리는 기계적으로 보이지만, 잘못 설정하면 전체 프로젝트의 신뢰도를 무너뜨린다. 다음 글에서는 검증 세트를 더 효율적으로 활용하는 교차 검증을 다룬다.

---

**지난 글:** [t-SNE와 UMAP: 고차원 데이터를 눈으로 보다](/posts/ml-tsne-umap/)

**다음 글:** [교차 검증: K-Fold로 모델 성능을 더 정확히 추정하기](/posts/ml-cross-validation/)

<br>
읽어주셔서 감사합니다. 😊
