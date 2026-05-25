---
title: "AI 편향과 공정성: 알고리즘 차별을 막는 방법"
description: "데이터 수집부터 배포까지 AI 시스템에 편향이 스며드는 경로를 분석하고, 인구통계 동등성·균등 기회 등 공정성 지표를 코드와 함께 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["AI편향", "알고리즘공정성", "DemographicParity", "EqualizedOdds", "AI차별", "공정성지표"]
featured: false
draft: false
---

[지난 글](/posts/ai-alignment/)에서 AI 정렬의 전체 그림을 살펴봤다. 정렬 문제의 가장 구체적인 사례 중 하나가 **AI 편향(Bias)**이다. 편향은 학습 데이터나 모델 설계에 내재된 체계적 오류로, 특정 집단에게 불리한 결과를 낸다.

## 편향은 왜 생기는가

편향이 생기는 이유를 "나쁜 데이터"로만 설명하면 부족하다. 편향은 데이터 수집부터 모델 학습, 배포까지 **각 단계에서 독립적으로** 발생한다.

```python
# 편향 발생 단계 예시: 채용 AI
# 1. 데이터 편향: 과거 채용 데이터가 남성 중심
historical_data = load_data()  # 남성 80%, 여성 20%

# 2. 레이블 편향: 과거 채용 결정 자체가 편향
# 여성 지원자는 같은 스펙에도 낮은 합격률

# 3. 모델 편향: 성별과 상관관계 있는 특성 학습
# "골프 동아리" → 높은 가중치 (남성 편향 프록시)

# 4. 배포 편향: 편향된 결과가 더 많은 남성 채용
# → 다음 학습 데이터도 남성 중심 → 루프 강화
```

실제 세계의 불평등이 데이터에 반영되고, 그 데이터로 모델을 학습하면 불평등이 자동화되고 스케일 업된다.

![AI 편향의 유형과 발생 경로](/assets/posts/ai-bias-fairness-types.svg)

## 유명한 편향 사례들

**COMPAS 재범 예측**: 미국 법원에서 사용된 재범 위험도 예측 시스템. 흑인 피고가 백인 피고보다 고위험으로 분류될 확률이 두 배 높았다. 그러나 회사는 두 집단에서 정확도가 같다며 공정하다고 주장—이것이 공정성 정의 충돌의 전형적 사례다.

**얼굴 인식 편향**: 상업용 얼굴 인식 서비스들이 어두운 피부 여성에서 오류율이 최대 34.7% 높았다(Buolamwini & Gebru 2018). 학습 데이터의 인종·성별 편향이 직접 성능에 반영된 결과다.

**언어 모델의 직업 연상**: "의사" → 남성, "간호사" → 여성 연상. 이는 학습 텍스트에 담긴 사회적 고정관념의 반영이다.

## 공정성 지표: 무엇을 측정하는가

공정성을 수학적으로 정의하면 여러 지표로 나뉜다.

```python
from sklearn.metrics import confusion_matrix

def fairness_metrics(y_true, y_pred, sensitive_attr):
    groups = {}
    for group in sensitive_attr.unique():
        mask = sensitive_attr == group
        tn, fp, fn, tp = confusion_matrix(
            y_true[mask], y_pred[mask]
        ).ravel()
        groups[group] = {
            "acceptance_rate": (tp + fp) / len(y_true[mask]),  # 합격률
            "tpr": tp / (tp + fn),   # 실력자 합격률 (True Positive Rate)
            "fpr": fp / (fp + tn),   # 오합격률 (False Positive Rate)
        }
    return groups

# 인구통계 동등성: 합격률이 집단 간 동일한가
# P(Y_hat=1 | Group=A) == P(Y_hat=1 | Group=B)

# 균등 기회: 실력자의 합격률이 동일한가
# P(Y_hat=1 | Y=1, Group=A) == P(Y_hat=1 | Y=1, Group=B)
```

![공정성 지표와 미탐지 예시](/assets/posts/ai-bias-fairness-metrics.svg)

### 불가능성 정리

Chouldechova(2017)는 세 가지 공정성 기준이 동시에 충족될 수 없음을 수학적으로 증명했다. 집단 간 기저율(base rate)이 다를 때, 보정 공정성을 만족하면 균등 기회를 위반하게 된다. 공정성은 "무엇이 공정한가"를 먼저 결정해야 기술적으로 구현 가능하다—순수하게 기술적인 문제가 아니다.

## 편향 탐지 도구

```python
# Fairlearn: 마이크로소프트의 AI 공정성 평가 라이브러리
from fairlearn.metrics import MetricFrame, demographic_parity_difference
from sklearn.metrics import accuracy_score

mf = MetricFrame(
    metrics=accuracy_score,
    y_true=y_test,
    y_pred=y_pred,
    sensitive_features=X_test["gender"]
)

print(mf.by_group)           # 집단별 정확도
print(mf.difference())       # 집단 간 최대 차이
print(demographic_parity_difference(y_test, y_pred,
                                     sensitive_features=X_test["gender"]))
```

**Aequitas** (시카고대학): 의사결정 시스템 편향 감사 도구. **AI Fairness 360** (IBM): 70개 이상 공정성 지표와 10개 이상 편향 완화 알고리즘 제공.

## 편향 완화 기법

**전처리**: 학습 데이터를 재샘플링하거나 재가중치해 집단 균형을 맞춘다. 가장 단순하지만 원본 데이터 분포를 바꾸는 부작용이 있다.

**인처리(In-processing)**: 학습 목적함수에 공정성 제약을 추가한다.

```python
# Fairlearn의 GridSearch: 공정성 제약 하에 모델 학습
from fairlearn.reductions import GridSearch, DemographicParity

estimator = LogisticRegression()
constraint = DemographicParity()

mitigator = GridSearch(estimator, constraint,
                       grid_size=10)
mitigator.fit(X_train, y_train,
              sensitive_features=X_train["gender"])
best_model = mitigator.best_estimator_
```

**후처리**: 모델 출력에 집단별 다른 임계값을 적용한다. 이미 배포된 모델에도 적용 가능하지만, 집단 정보가 추론 시점에 필요하다는 단점이 있다.

## 공정성의 한계와 현실

기술적 공정성 지표만으로는 부족하다. **맥락 의존성**: 채용·의료·신용 각 도메인에서 공정성의 의미가 다르다. **인과 공정성**: 관찰 가능한 결과뿐 아니라 인과적 경로도 중요하다—간접 차별(프록시 변수 사용)은 지표상 공정해 보일 수 있다. **사회 변화**: 현재 데이터 기반의 공정성이 미래에도 공정할 보장은 없다.

AI 편향 문제는 엔지니어링 문제인 동시에 사회적·윤리적 문제다. 기술팀 단독이 아닌 도메인 전문가·법률가·영향받는 집단과의 협업이 필수다.

---

**지난 글:** [AI 정렬: 인간의 가치와 AI 목표를 일치시키기](/posts/ai-alignment/)

**다음 글:** [설명 가능한 AI(XAI): 블랙박스를 열다](/posts/ai-explainability-xai/)

<br>
읽어주셔서 감사합니다. 😊
