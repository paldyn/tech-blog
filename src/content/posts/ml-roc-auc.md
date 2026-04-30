---
title: "ROC 곡선과 AUC: 임계값 독립적 분류 성능 평가"
description: "ROC 곡선의 TPR-FPR 트레이드오프, AUC의 확률론적 해석, PR-AUC와의 차이, 다중 클래스 확장, 최적 임계값 선택 방법을 실전 코드와 함께 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["ROC곡선", "AUC", "분류평가", "임계값", "모델평가"]
featured: false
draft: false
---

[지난 글](/posts/ml-confusion-matrix/)에서 혼동 행렬로 분류 오류를 해부하는 방법을 배웠다. 혼동 행렬과 그에서 유도된 지표들은 특정 임계값(보통 0.5)에서의 성능을 보여준다. 그런데 모델의 "진짜" 분리 능력은 임계값에 상관없이 얼마나 양성과 음성을 잘 구분하는가에 있다. **ROC 곡선과 AUC**는 모든 임계값에서의 성능을 하나의 숫자로 압축한다.

## ROC 곡선의 두 축

ROC(Receiver Operating Characteristic) 곡선은 X축에 **FPR(False Positive Rate)**, Y축에 **TPR(True Positive Rate, 재현율)**을 놓고 임계값을 0에서 1까지 변화시킬 때의 궤적을 그린다.

- **TPR(민감도, Recall)** = TP / (TP + FN) — 실제 양성 중 탐지한 비율
- **FPR(1-특이도)** = FP / (FP + TN) — 실제 음성 중 잘못 양성으로 판단한 비율

임계값을 낮추면 더 많은 것을 양성으로 선언하므로 TPR과 FPR이 모두 올라가고, 높이면 둘 다 내려간다. 이 트레이드오프의 궤적이 ROC 곡선이다.

![ROC 곡선과 AUC 해석](/assets/posts/ml-roc-auc-curve.svg)

## AUC의 확률론적 의미

**AUC(Area Under the ROC Curve)**는 ROC 곡선 아래 면적으로, 0부터 1 사이의 값을 갖는다. 단순히 면적이 아니라 직관적인 확률로 해석할 수 있다.

> **AUC = 임의로 선택한 양성 샘플이 임의로 선택한 음성 샘플보다 더 높은 점수를 받을 확률**

AUC=0.85라면, 아무 양성 샘플과 아무 음성 샘플을 골랐을 때 모델이 양성 샘플에 더 높은 점수를 줄 확률이 85%라는 뜻이다. AUC=0.5는 동전 던지기 수준(랜덤 분류기)이고, AUC=1.0은 완벽한 분리다.

## 기본 구현

```python
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (roc_curve, roc_auc_score,
                              average_precision_score)
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.datasets import load_breast_cancer

X, y = load_breast_cancer(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)

# 두 모델 비교
models = {
    'LR':  Pipeline([('s', StandardScaler()),
                     ('m', LogisticRegression(max_iter=1000))]),
    'RF':  RandomForestClassifier(n_estimators=200, random_state=42)
}

for name, m in models.items():
    m.fit(X_train, y_train)
    y_score = m.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_test, y_score)
    ap  = average_precision_score(y_test, y_score)
    fpr, tpr, thresholds = roc_curve(y_test, y_score)

    print(f"{name}: ROC-AUC={auc:.4f}  PR-AUC={ap:.4f}")
```

![ROC AUC 코드](/assets/posts/ml-roc-auc-code.svg)

## 최적 임계값 찾기

실제 배포할 때는 어떤 임계값을 사용할지 결정해야 한다. 목적에 따라 최적 임계값이 다르다.

```python
import numpy as np
from sklearn.metrics import roc_curve, precision_recall_curve

y_score = model.predict_proba(X_test)[:, 1]

# 방법 1: Youden's J 통계량 (TPR - FPR 최대화)
fpr, tpr, thresholds = roc_curve(y_test, y_score)
j_scores = tpr - fpr
best_idx  = np.argmax(j_scores)
best_thr_youden = thresholds[best_idx]
print(f"Youden 임계값: {best_thr_youden:.4f}")
print(f"  TPR={tpr[best_idx]:.4f}, FPR={fpr[best_idx]:.4f}")

# 방법 2: F1이 최대인 임계값
precisions, recalls, pr_thresholds = precision_recall_curve(
    y_test, y_score)
f1_scores = (2 * precisions * recalls /
             (precisions + recalls + 1e-9))
best_f1_idx = np.argmax(f1_scores[:-1])
best_thr_f1 = pr_thresholds[best_f1_idx]
print(f"F1 최적 임계값: {best_thr_f1:.4f}")

# 방법 3: FPR ≤ 0.05 제약 하에 TPR 최대화
constraint_mask = fpr <= 0.05
if constraint_mask.any():
    constrained_idx = np.argmax(tpr[constraint_mask])
    idx = np.where(constraint_mask)[0][constrained_idx]
    print(f"FPR≤5% 제약 임계값: {thresholds[idx]:.4f}"
          f"  TPR={tpr[idx]:.4f}")
```

## PR-AUC: 극심한 불균형에서의 대안

양성 클래스 비율이 매우 낮을 때(1% 미만) ROC-AUC는 지나치게 낙관적일 수 있다. FPR 계산에 TN이 크게 관여하는데, 음성 샘플이 압도적으로 많으면 TN이 크게 나와 FPR이 낮게 유지되기 때문이다. 이때는 **PR(Precision-Recall) 곡선과 PR-AUC**를 사용한다.

```python
from sklearn.metrics import (precision_recall_curve,
                              average_precision_score)

precisions, recalls, thresholds = precision_recall_curve(
    y_test, y_score)

# Average Precision: PR 곡선 아래 면적
ap = average_precision_score(y_test, y_score)
print(f"Average Precision: {ap:.4f}")

# 비율이 낮은 클래스의 기준선
baseline = y_test.mean()
print(f"랜덤 기준선 AP: {baseline:.4f}")
# AP가 기준선보다 얼마나 높은지가 중요
```

PR 곡선의 기준선은 `y.mean()`(양성 비율)이다. ROC에서 랜덤 기준선이 AUC=0.5인 것처럼, PR에서는 AP=양성비율이 랜덤 기준선이 된다.

## 다중 클래스 ROC-AUC

클래스가 3개 이상일 때는 One-vs-Rest(OvR) 또는 One-vs-One(OvO) 방식으로 확장한다.

```python
from sklearn.metrics import roc_auc_score

# 다중 클래스: 각 클래스 확률 필요
y_proba_multi = model.predict_proba(X_test)  # (n, n_classes)

# macro: 클래스를 동등하게
auc_macro = roc_auc_score(y_test, y_proba_multi,
                           multi_class='ovr',
                           average='macro')

# weighted: 클래스 샘플 수 가중
auc_weighted = roc_auc_score(y_test, y_proba_multi,
                              multi_class='ovr',
                              average='weighted')

print(f"Macro AUC:    {auc_macro:.4f}")
print(f"Weighted AUC: {auc_weighted:.4f}")
```

## ROC-AUC vs 다른 지표 선택 가이드

| 상황 | 권장 지표 |
|------|-----------|
| 클래스 균형, 임계값 고정 | F1, Accuracy |
| 임계값 선택이 유동적 | ROC-AUC |
| 양성 비율 < 5% | PR-AUC (Average Precision) |
| 비용에 민감한 임계값 | Youden's J, 비용-민감 최적화 |
| 다중 클래스 | Macro ROC-AUC |

---

**지난 글:** [혼동 행렬로 분류 오류 해부하기](/posts/ml-confusion-matrix/)

**다음 글:** [회귀 모델 평가 지표: MAE·MSE·RMSE·R² 완전 이해](/posts/ml-regression-metrics/)

<br>
읽어주셔서 감사합니다. 😊
