---
title: "혼동 행렬로 분류 오류 해부하기"
description: "이진·다중 클래스 혼동 행렬의 구조, TP·FP·TN·FN에서 지표 유도, 정규화 방법, 오류 패턴 분석, sklearn ConfusionMatrixDisplay 시각화까지 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["혼동행렬", "ConfusionMatrix", "분류평가", "오류분석", "모델평가"]
featured: false
draft: false
---

[지난 글](/posts/ml-classification-metrics/)에서 정확도·정밀도·재현율·F1의 공식을 배웠다. 이번에는 그 지표들이 실제로 어디서 어떻게 나오는지, 그 원천인 **혼동 행렬(Confusion Matrix)**을 집중적으로 다룬다. 숫자 하나가 아니라 행렬 전체를 읽을 수 있으면 모델이 어떤 클래스를 어떻게 헷갈리는지 훨씬 구체적으로 진단할 수 있다.

## 혼동 행렬의 구조

이진 분류 혼동 행렬은 2×2 표다. 행(Row)은 **실제 클래스**, 열(Column)은 **예측 클래스**를 나타낸다.

![혼동 행렬 구조와 해석](/assets/posts/ml-confusion-matrix-grid.svg)

sklearn의 `confusion_matrix`는 다음 순서로 반환한다.

```
[[TN  FP]
 [FN  TP]]
```

즉, 음성(Negative)이 행·열의 첫 번째 인덱스(0)다. 혼동하기 쉬우니 항상 `tn, fp, fn, tp = cm.ravel()`로 명시적으로 추출하는 것이 좋다.

## 완전한 구현과 시각화

```python
from sklearn.datasets import load_breast_cancer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (confusion_matrix,
                              ConfusionMatrixDisplay,
                              classification_report)
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# 데이터 준비
X, y = load_breast_cancer(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)

# 학습
pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('lr',     LogisticRegression(max_iter=1000))
])
pipe.fit(X_train, y_train)
y_pred = pipe.predict(X_test)

# 혼동 행렬
cm = confusion_matrix(y_test, y_pred)
tn, fp, fn, tp = cm.ravel()

print(f"TP={tp}  FP={fp}")
print(f"FN={fn}  TN={tn}")
print(f"\n정밀도: {tp/(tp+fp):.4f}")
print(f"재현율: {tp/(tp+fn):.4f}")
print(f"특이도: {tn/(tn+fp):.4f}")
print(f"정확도: {(tp+tn)/(tp+fp+fn+tn):.4f}")
```

![혼동 행렬 시각화 코드](/assets/posts/ml-confusion-matrix-code.svg)

```python
# 정규화 혼동 행렬 (비율 표시)
cm_norm = confusion_matrix(y_test, y_pred, normalize='true')
# normalize='true': 각 행의 합이 1 (실제 클래스별 비율)
# normalize='pred': 각 열의 합이 1 (예측 클래스별 비율)
# normalize='all' : 전체 합이 1

print(f"정규화 행렬:\n{cm_norm}")
# [[0.9722  0.0278]
#  [0.0244  0.9756]]
# → 실제 악성(1)의 97.56%를 올바르게 예측
```

## 다중 클래스 혼동 행렬

클래스가 n개일 때 혼동 행렬은 n×n이 된다. 각 행은 실제 클래스이고 각 열은 예측 클래스다. 대각선 원소는 올바른 예측, 비대각선 원소는 잘못된 예측이다.

```python
from sklearn.datasets import load_digits
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import confusion_matrix

X, y = load_digits(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42)

rf = RandomForestClassifier(n_estimators=200, random_state=42)
rf.fit(X_train, y_train)
y_pred = rf.predict(X_test)

cm = confusion_matrix(y_test, y_pred)
print(f"혼동 행렬 shape: {cm.shape}")  # (10, 10)

# 가장 많이 헷갈리는 쌍 찾기
np.fill_diagonal(cm, 0)   # 대각선 제거
idx = np.unravel_index(cm.argmax(), cm.shape)
print(f"가장 많이 헷갈리는 쌍: {idx[0]}→{idx[1]} ({cm[idx]}회)")
```

## 오류 패턴 분석: 어떤 샘플을 틀렸나

혼동 행렬에서 특정 오류를 보인 샘플들을 직접 확인하면 모델 개선 방향을 찾을 수 있다.

```python
import numpy as np

# FN: 실제 양성인데 음성으로 예측한 인덱스
fn_idx = np.where((y_test == 1) & (y_pred == 0))[0]
# FP: 실제 음성인데 양성으로 예측한 인덱스
fp_idx = np.where((y_test == 0) & (y_pred == 1))[0]

print(f"False Negative {len(fn_idx)}건: 인덱스 {fn_idx[:5]}")
print(f"False Positive {len(fp_idx)}건: 인덱스 {fp_idx[:5]}")

# FN 샘플의 모델 확률 점수 확인
y_proba = pipe.predict_proba(X_test)[:, 1]
fn_proba = y_proba[fn_idx]
print(f"FN 샘플의 평균 확률: {fn_proba.mean():.4f}")
# → 모델이 음성으로 분류한 근거 점수
# 이 값들이 임계값(0.5) 근처면 경계선 케이스

# 임계값을 낮춰 FN 줄이기 (재현율 올리기)
threshold = 0.35   # 기본값 0.5에서 낮춤
y_pred_new = (y_proba >= threshold).astype(int)
cm_new = confusion_matrix(y_test, y_pred_new)
tn2, fp2, fn2, tp2 = cm_new.ravel()
print(f"임계값 {threshold} → FN: {fn} → {fn2}, FP: {fp} → {fp2}")
```

## 불균형 데이터에서 혼동 행렬 읽기

클래스 불균형이 심할 때는 절대 수치보다 정규화 행렬을 봐야 한다.

```python
# 클래스 9:1 불균형 시나리오
from sklearn.datasets import make_classification

X_imb, y_imb = make_classification(
    n_samples=10000,
    n_features=20,
    weights=[0.9, 0.1],  # 음성 90%, 양성 10%
    random_state=42
)

X_tr, X_ts, y_tr, y_ts = train_test_split(
    X_imb, y_imb, test_size=0.2,
    stratify=y_imb, random_state=42)

from sklearn.ensemble import RandomForestClassifier
rf_imb = RandomForestClassifier(
    n_estimators=100,
    class_weight='balanced',  # 클래스 가중치 자동 조정
    random_state=42)
rf_imb.fit(X_tr, y_tr)
y_pred_imb = rf_imb.predict(X_ts)

cm_imb = confusion_matrix(y_ts, y_pred_imb)
print(f"원본 행렬:\n{cm_imb}")
cm_imb_norm = confusion_matrix(y_ts, y_pred_imb, normalize='true')
print(f"\n정규화 행렬:\n{cm_imb_norm.round(3)}")
```

절대 수치로 보면 TN이 압도적으로 크고 모든 것이 잘 돼 보이지만, `normalize='true'`로 보면 각 클래스별 예측 성공률을 공평하게 비교할 수 있다.

---

**지난 글:** [분류 모델 평가 지표 완전 정복: 정확도·정밀도·재현율·F1](/posts/ml-classification-metrics/)

**다음 글:** [ROC 곡선과 AUC: 임계값 독립적 분류 성능 평가](/posts/ml-roc-auc/)

<br>
읽어주셔서 감사합니다. 😊
