---
title: "분류 모델 평가 지표 완전 정복: 정확도·정밀도·재현율·F1"
description: "TP·FP·TN·FN에서 도출되는 정확도·정밀도·재현율·F1·MCC 공식, 정밀도-재현율 트레이드오프, 다중 클래스 평균 방법, 실전 sklearn 코드까지 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["분류평가", "F1스코어", "정밀도재현율", "혼동행렬", "모델평가"]
featured: false
draft: false
---

[지난 글](/posts/ml-overfitting/)에서 과대적합을 탐지하고 해결하는 방법을 배웠다. 이제 모델을 만들었을 때 그 성능을 어떤 숫자로 표현해야 하는지로 넘어간다. 분류 모델의 성능을 "정확도 93%"라고 말하는 것이 항상 의미 있는 건 아니다. 양성 샘플이 전체의 3%인 사기 탐지 시스템에서는 모든 샘플을 음성으로 예측해도 정확도 97%가 나온다. 올바른 지표를 선택하는 능력이 모델을 제대로 평가하는 첫걸음이다.

## 혼동 행렬(Confusion Matrix)의 네 칸

이진 분류의 모든 평가 지표는 **TP, FP, TN, FN** 네 개의 값에서 도출된다.

- **TP (True Positive)**: 실제 양성, 예측 양성 — 맞음
- **FP (False Positive)**: 실제 음성, 예측 양성 — 틀림 (1종 오류)
- **TN (True Negative)**: 실제 음성, 예측 음성 — 맞음
- **FN (False Negative)**: 실제 양성, 예측 음성 — 틀림 (2종 오류)

앞 글자 T/F는 예측이 맞는지(True), 틀리는지(False)를 나타내고, 뒷 글자 P/N은 모델이 양성(Positive)이라 예측했는지 음성(Negative)이라 예측했는지를 나타낸다.

![분류 평가 지표 공식 정리](/assets/posts/ml-classification-metrics-formulas.svg)

## 네 가지 핵심 지표

**정확도(Accuracy)**: `(TP + TN) / (TP + FP + TN + FN)` — 전체 중 올바르게 예측한 비율. 클래스가 균형 잡혀 있을 때 직관적이지만, 불균형 데이터에서는 오해를 일으킨다.

**정밀도(Precision)**: `TP / (TP + FP)` — 양성이라 예측한 것 중 실제로 양성인 비율. 모델이 양성이라 말할 때 얼마나 믿을 수 있는지를 측정한다. 스팸 필터에서 중요: FP(정상 메일을 스팸으로 분류)를 줄여야 한다.

**재현율(Recall, Sensitivity)**: `TP / (TP + FN)` — 실제 양성 중 모델이 양성으로 찾아낸 비율. 질병 진단에서 중요: FN(환자를 정상으로 분류)을 줄여야 한다.

**F1 점수**: `2 × Precision × Recall / (Precision + Recall)` — 정밀도와 재현율의 조화평균. 두 지표 중 하나가 낮으면 F1도 낮아지므로 균형을 요구하는 상황에 적합하다.

## 정밀도-재현율 트레이드오프

정밀도와 재현율은 서로 반비례한다. 분류기의 임계값(threshold)을 높이면 양성으로 선언하는 기준이 엄격해져 FP가 줄고 정밀도가 올라가지만, 실제 양성을 더 많이 놓쳐 FN이 늘고 재현율이 떨어진다.

```python
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (precision_recall_curve,
                              PrecisionRecallDisplay)
import numpy as np

model = LogisticRegression()
model.fit(X_train, y_train)

# 확률 점수 (0~1) 계산
y_proba = model.predict_proba(X_test)[:, 1]

# 다양한 임계값에서 정밀도·재현율 계산
precisions, recalls, thresholds = precision_recall_curve(
    y_test, y_proba)

# 최적 임계값: F1이 최대인 지점
f1_scores = 2 * precisions * recalls / (precisions + recalls + 1e-9)
best_idx   = np.argmax(f1_scores)
best_thr   = thresholds[best_idx]
print(f"최적 임계값: {best_thr:.4f}")
print(f"  Precision: {precisions[best_idx]:.4f}")
print(f"  Recall:    {recalls[best_idx]:.4f}")
print(f"  F1:        {f1_scores[best_idx]:.4f}")

# 기본 0.5 임계값 대신 최적값 사용
y_pred_optimized = (y_proba >= best_thr).astype(int)
```

## 다중 클래스: average 파라미터

3개 이상의 클래스가 있을 때 정밀도·재현율·F1은 각 클래스에 대해 계산한 뒤 평균을 낸다.

```python
from sklearn.metrics import (classification_report,
                              f1_score, precision_score,
                              recall_score)

# macro: 각 클래스를 동등하게 취급
f1_macro = f1_score(y_test, y_pred, average='macro')

# weighted: 클래스 샘플 수로 가중 평균
f1_weighted = f1_score(y_test, y_pred, average='weighted')

# micro: TP/FP/FN 전체를 합산 후 계산
f1_micro = f1_score(y_test, y_pred, average='micro')

# None: 클래스별 개별 점수 반환
f1_per_class = f1_score(y_test, y_pred, average=None)
print(f"클래스별 F1: {f1_per_class}")

# 한 번에 전체 리포트
print(classification_report(y_test, y_pred,
      target_names=['cat', 'dog', 'bird']))
```

![분류 평가 sklearn 코드](/assets/posts/ml-classification-metrics-code.svg)

`classification_report` 출력 예시:
```
              precision  recall  f1-score   support
         cat       0.88    0.82      0.85       150
         dog       0.84    0.90      0.87       180
        bird       0.91    0.88      0.89       120

    accuracy                           0.87       450
   macro avg       0.88    0.87      0.87       450
weighted avg       0.87    0.87      0.87       450
```

`macro avg`는 세 클래스를 동등하게 평균한 것이고, `weighted avg`는 각 클래스의 `support`(샘플 수)로 가중 평균한 것이다. 불균형 클래스에서는 두 값이 크게 다를 수 있다.

## MCC: 불균형 데이터의 최선 단일 지표

F1도 음성 클래스를 고려하지 않아 극단적 불균형에서 한계가 있다. **MCC(Matthews Correlation Coefficient)**는 네 칸을 모두 활용해 가장 균형 잡힌 단일 지표를 제공한다.

```python
from sklearn.metrics import matthews_corrcoef

mcc = matthews_corrcoef(y_test, y_pred)
# 범위: -1 ~ +1
# +1: 완벽한 예측
# 0: 랜덤 예측과 동일
# -1: 완전히 반대 예측
print(f"MCC: {mcc:.4f}")
```

MCC는 클래스 불균형이 심할 때 F1보다 더 신뢰할 수 있다. 특히 사기 탐지나 희귀 질환 진단처럼 양성 비율이 1% 미만인 경우에 적합하다.

## 지표 선택 가이드

| 상황 | 권장 지표 | 이유 |
|------|-----------|------|
| 클래스 균형 | Accuracy, F1 | 직관적이고 충분히 정보적 |
| FP 비용 ↑ (스팸, 추천) | Precision | 잘못된 양성 예측 최소화 |
| FN 비용 ↑ (질병, 사기) | Recall | 실제 양성 놓치지 않기 |
| 불균형 클래스 | F1, MCC | Accuracy의 허위 높은 수치 방지 |
| 멀티레이블 | F1-micro, F1-weighted | 클래스 샘플 수 고려 |

---

**지난 글:** [과대적합 완전 정복: 탐지·진단·해결 전략](/posts/ml-overfitting/)

**다음 글:** [혼동 행렬로 분류 오류 해부하기](/posts/ml-confusion-matrix/)

<br>
읽어주셔서 감사합니다. 😊
