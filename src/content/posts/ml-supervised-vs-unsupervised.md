---
title: "지도학습 vs 비지도학습: 머신러닝의 두 패러다임"
description: "지도·비지도·반지도·자기지도 학습의 차이와 대표 알고리즘, 실전 활용법을 한눈에 정리하고 scikit-learn 코드로 확인한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["지도학습", "비지도학습", "자기지도학습", "머신러닝", "패러다임"]
featured: false
draft: false
---

[지난 글](/posts/ai-regularization/)에서 과적합을 막는 정규화 기법들을 살펴봤다. 이제 머신러닝(ML) 섹션에 본격 진입한다. ML에는 크게 두 가지 학습 패러다임이 있다. "정답이 있는가?" — 이 질문 하나가 알고리즘 선택과 데이터 수집 방식을 결정한다.

## 지도 학습: 정답 있는 공부

**지도 학습(Supervised Learning)**은 입력(X)과 정답 레이블(y)이 쌍으로 주어진다. 모델은 `f(X) ≈ y`인 함수를 학습한다.

지도 학습의 두 주요 유형:
- **분류(Classification)**: 이산적인 클래스를 예측. 이메일이 스팸인가 아닌가? 이미지가 고양이인가 강아지인가?
- **회귀(Regression)**: 연속적인 수치를 예측. 이 집의 가격은 얼마인가? 내일 기온은?

```python
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.datasets import load_iris
from sklearn.metrics import accuracy_score, mean_squared_error

# 분류 예시: 붓꽃 종류 예측
X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)           # 학습: 레이블 포함
predictions = clf.predict(X_test)   # 예측
print(f"정확도: {accuracy_score(y_test, predictions):.3f}")  # ≈ 0.967

# scikit-learn의 일관된 API: fit → predict → score
# 모든 알고리즘이 같은 인터페이스 → 교체 용이
```

지도 학습의 가장 큰 한계는 **레이블링 비용**이다. 의료 영상 레이블링은 전문 의사가 해야 하고, 법률 문서 분류는 변호사가 필요하다. 레이블 하나에 수천 원이 드는 경우도 있다.

## 비지도 학습: 정답 없는 탐험

**비지도 학습(Unsupervised Learning)**은 레이블 없이 데이터의 숨겨진 구조를 찾는다.

```python
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
import numpy as np

# 데이터 전처리: 스케일 정규화 (비지도 학습에 중요)
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 군집화: K-Means — "비슷한 것끼리 묶기"
kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
cluster_labels = kmeans.fit_predict(X_scaled)
print(f"군집 중심:\n{kmeans.cluster_centers_}")

# 차원 축소: PCA — "핵심 정보만 남기기"
pca = PCA(n_components=2)
X_2d = pca.fit_transform(X_scaled)
print(f"분산 설명력: {pca.explained_variance_ratio_.sum():.1%}")
# 2차원으로 줄여도 원 데이터 정보의 ~95% 보존
```

비지도 학습의 주요 용도:
- **고객 세분화**: 구매 패턴으로 고객 그룹 자동 발견
- **이상 탐지**: 정상 패턴에서 벗어난 거래 탐지
- **추천 시스템**: 비슷한 사용자/상품 군집화
- **데이터 탐색**: 레이블링 전에 데이터 구조 파악

## 반지도 학습: 소수 레이블의 활용

**반지도 학습(Semi-supervised Learning)**은 소수의 레이블 데이터와 다수의 무레이블 데이터를 함께 활용한다.

```python
from sklearn.semi_supervised import LabelPropagation

# 전체 데이터 중 30%만 레이블
labeled_mask = np.random.choice([True, False], size=len(X), p=[0.3, 0.7])
y_partial = y.copy().astype(float)
y_partial[~labeled_mask] = -1   # -1: 레이블 없음 표시

# Label Propagation: 레이블 없는 데이터에 레이블 전파
label_prop = LabelPropagation(kernel='rbf', gamma=20)
label_prop.fit(X_scaled, y_partial)

# 레이블 데이터 30%만으로도 좋은 성능 가능
transduced_labels = label_prop.transduction_
print(f"레이블 전파 정확도: {accuracy_score(y, transduced_labels):.3f}")
```

현대 LLM 파인튜닝에서 사용하는 **RLHF(인간 피드백 강화 학습)**도 반지도 학습의 일종이다. 소수의 인간 선호 데이터로 보상 모델을 학습하고, 이를 무제한의 모델 출력에 적용한다.

![머신러닝 학습 패러다임 완전 지도](/assets/posts/ml-supervised-vs-unsupervised-overview.svg)

## 자기지도 학습: AI의 혁명

**자기지도 학습(Self-supervised Learning)**은 데이터 자체에서 지도 신호를 자동 생성한다. 레이블링 비용 없이 대규모 데이터를 활용할 수 있어 현대 AI의 핵심 패러다임이 되었다.

```python
# GPT 스타일: 다음 토큰 예측
# 입력: "The cat sat" → 정답: "cat sat on"
# 레이블이 데이터 자체에 있음 (정답 = 다음 단어)

# BERT 스타일: 마스킹된 토큰 복원
# "The [MASK] sat on the mat" → "cat"

# CLIP 스타일: 이미지-텍스트 매칭
# (이미지, "A cat sitting on a mat") → 일치 여부

# SimCLR (대조 학습): 같은 이미지의 두 증강 버전을 같은 것으로
# → 의미적으로 유사한 것은 임베딩 공간에서 가깝게
import torch
import torch.nn.functional as F

def simclr_loss(z1, z2, temperature=0.5):
    """NT-Xent Loss (SimCLR 대조 손실)"""
    z1 = F.normalize(z1, dim=1)
    z2 = F.normalize(z2, dim=1)
    
    # 배치 내 모든 쌍의 유사도
    representations = torch.cat([z1, z2], dim=0)
    similarity = representations @ representations.T / temperature
    
    N = z1.size(0)
    labels = torch.cat([torch.arange(N, 2*N), torch.arange(N)])
    return F.cross_entropy(similarity, labels)
```

자기지도 학습이 AI를 어떻게 바꿨는지:
- **언어**: GPT-4·Claude·Gemini — 수조 개 텍스트로 자기지도 사전학습
- **이미지**: MAE(Masked Autoencoder) — 이미지 패치 복원으로 비전 표현 학습
- **멀티모달**: CLIP — 인터넷의 이미지-캡션 쌍으로 멀티모달 표현 학습

![실전 머신러닝 알고리즘 선택 가이드](/assets/posts/ml-supervised-vs-unsupervised-examples.svg)

## 어떤 패러다임을 선택할 것인가

| 상황 | 추천 패러다임 | 이유 |
|------|-------------|------|
| 레이블 있음, 소규모 | 지도 학습 (XGBoost/RF) | 빠르고 해석 가능 |
| 레이블 있음, 대규모 | 지도 학습 (딥러닝) | 데이터 많을수록 강력 |
| 레이블 없음, 그룹 발견 | 비지도 학습 (군집화) | 탐색적 분석 |
| 소수 레이블, 다수 무레이블 | 반지도 학습 | 레이블링 비용 절감 |
| 대규모 무레이블 데이터 | 자기지도 + 파인튜닝 | LLM/CLIP 패러다임 |

현실에서는 이 패러다임들을 조합해서 쓴다. LLM 프로젝트의 전형적인 흐름은 "자기지도 사전학습(무레이블 웹 텍스트) → 지도 파인튜닝(고품질 레이블 데이터) → RLHF(인간 선호)"다.

---

**지난 글:** [정규화: 과적합을 막는 AI의 방패](/posts/ai-regularization/)

**다음 글:** [선형 회귀: 예측 모델의 출발점](/posts/ml-linear-regression/)

<br>
읽어주셔서 감사합니다. 😊
