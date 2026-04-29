---
title: "PCA: 고차원 데이터를 압축하는 차원 축소"
description: "주성분 분석(PCA)의 수학적 원리(공분산·고유값·고유벡터), 설명 분산비로 적정 차원 결정, 이미지 압축과 특성 추출 실전 코드까지 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["PCA", "차원축소", "주성분분석", "고유값분해", "ML기초"]
featured: false
draft: false
---

[지난 글](/posts/ml-dbscan/)에서 DBSCAN이 밀도를 기준으로 군집을 찾고 이상치를 탐지하는 원리를 배웠다. 이번에는 방향을 바꿔 **차원 축소**라는 전혀 다른 문제를 다룬다. 데이터가 수백, 수천 개의 특성을 가질 때 그 정보를 최대한 보존하면서 훨씬 적은 차원으로 압축할 수 있다면 어떨까? **주성분 분석(Principal Component Analysis, PCA)**은 바로 이 질문에 답하는, 머신러닝 역사상 가장 많이 사용된 차원 축소 기법이다.

## 왜 차원 축소가 필요한가

데이터의 특성이 많아질수록 세 가지 문제가 동시에 발생한다.

**차원의 저주(Curse of Dimensionality)**: 고차원 공간에서는 데이터 포인트들이 서로 멀어지는 현상이 생긴다. 1000차원에서 균등 분포로 샘플링하면 모든 점이 거의 같은 거리에 위치하게 된다. KNN처럼 거리 기반 알고리즘은 완전히 무력해진다.

**시각화 불가능**: 인간이 직관적으로 이해할 수 있는 차원은 3차원이 한계다. 784개 픽셀로 이루어진 MNIST 손글씨 이미지나, 수천 개의 유전자 발현량 데이터를 어떻게 눈으로 볼 것인가?

**노이즈와 중복성**: 실제 데이터에서 특성 간에는 강한 상관관계가 있는 경우가 많다. 키와 몸무게, 집의 면적과 방 수처럼 본질적으로 같은 정보를 반복 표현하는 특성들이 존재한다. PCA는 이런 중복을 제거해 핵심 정보만 남긴다.

## PCA의 핵심 아이디어: 분산이 최대인 방향으로 투영

PCA는 직관적으로 설명하면 데이터를 가장 잘 "설명하는" 방향들을 찾는 것이다.

2D 공간에 비스듬하게 퍼진 점들을 상상해보자. 이 점들을 어떤 축에 투영할 때 가장 정보 손실이 적을까? 답은 데이터의 분산이 가장 큰 방향이다. 분산이 크다는 것은 그 방향으로 데이터가 넓게 퍼져 있다는 뜻이고, 그만큼 데이터의 변동성과 구조가 잘 보존된다.

이 방향을 **제1 주성분(PC1)**이라 한다. PC1에 수직이면서 잔여 분산을 최대화하는 방향이 **제2 주성분(PC2)**이다. 이 과정을 반복하면 서로 직교(uncorrelated)하는 주성분들의 집합이 만들어진다.

![PCA: 주성분 분석의 핵심 원리](/assets/posts/ml-pca-concept.svg)

## 수학적 원리: 공분산 행렬과 고유값 분해

PCA의 수학은 선형대수의 고유값 분해(Eigendecomposition)로 귀결된다.

**1단계: 데이터 중심화**

먼저 각 특성의 평균을 빼서 데이터를 원점 중심으로 이동시킨다.

```python
X_centered = X - X.mean(axis=0)
```

**2단계: 공분산 행렬 계산**

$d$개 특성이 있을 때, 공분산 행렬 $C$는 $d \times d$ 크기의 대칭 행렬이다.

```
C = (1/n) · Xᵀ · X      # (d × d) 행렬
```

$C_{ij}$는 특성 $i$와 $j$ 사이의 공분산을 나타낸다. 대각 원소는 각 특성의 분산이다.

**3단계: 고유값 분해**

공분산 행렬을 고유값 분해하면:

```
C · v = λ · v
```

여기서 $v$는 **고유벡터(주성분 방향)**, $λ$는 **고유값(해당 방향의 분산량)**이다. 고유값이 클수록 그 방향으로 데이터가 많이 퍼져 있다.

```python
import numpy as np

# 고유값 분해 직접 구현 (원리 이해용)
X_centered = X - X.mean(axis=0)
cov_matrix = np.cov(X_centered.T)        # (d, d)

eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)

# 고유값 내림차순 정렬
idx = np.argsort(eigenvalues)[::-1]
eigenvalues  = eigenvalues[idx]
eigenvectors = eigenvectors[:, idx]

# 주성분 방향: 고유벡터들 (각 열이 하나의 PC)
print(f"상위 3개 고유값: {eigenvalues[:3]}")
print(f"설명 분산비: {eigenvalues[:3] / eigenvalues.sum()}")
```

실제로는 scikit-learn이 SVD(특이값 분해)를 사용하기 때문에 수치적으로 더 안정적이다.

## 설명 분산비로 적정 차원 수 결정

고유값 $\lambda_k$를 모든 고유값의 합으로 나눈 것이 **설명 분산비(Explained Variance Ratio)**다.

```
EVR_k = λ_k / Σλ
```

EVR_1 = 0.42라면 PC1 하나로 데이터 전체 분산의 42%를 설명한다는 의미다.

![설명 분산비(Scree Plot)와 PCA 구현](/assets/posts/ml-pca-explained-variance.svg)

Scree Plot에서는 누적 설명 분산비가 95%나 99%에 도달하는 지점까지의 주성분 수를 선택하는 것이 일반적이다. "Elbow(팔꿈치)" 지점, 즉 곡선의 기울기가 급격히 줄어드는 지점을 찾는 방법도 많이 사용된다.

## scikit-learn PCA 완전 구현

```python
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.datasets import load_digits

# 데이터 준비 (MNIST 손글씨, 64차원)
X, y = load_digits(return_X_y=True)

# 반드시 스케일링 먼저!
# PCA는 분산에 민감 → 단위가 다른 특성은 반드시 표준화
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 방법 1: 누적 분산비로 자동 차원 결정
pca_auto = PCA(n_components=0.95)      # 95% 분산 보존
X_reduced = pca_auto.fit_transform(X_scaled)

print(f"원본 차원: {X.shape[1]}")             # 64
print(f"축소 차원: {X_reduced.shape[1]}")     # ~29
print(f"누적 분산: {pca_auto.explained_variance_ratio_.sum():.3f}")

# 방법 2: 명시적 차원 지정
pca_fixed = PCA(n_components=20)
X_20 = pca_fixed.fit_transform(X_scaled)

# Scree plot용 데이터
evr = pca_fixed.explained_variance_ratio_
cumsum = np.cumsum(evr)
print(f"PC별 설명 분산비: {evr[:5]}")
print(f"누적 설명 분산비: {cumsum[:5]}")

# 역변환: 저차원 → 원본 차원 복원 (일부 정보 손실)
X_reconstructed = pca_fixed.inverse_transform(X_20)
reconstruction_error = np.mean((X_scaled - X_reconstructed) ** 2)
print(f"재구성 오차(MSE): {reconstruction_error:.4f}")

# 주성분 방향 (고유벡터) 확인
print(f"주성분 행렬 shape: {pca_fixed.components_.shape}")  # (20, 64)
print(f"중심화 평균: {pca_fixed.mean_.shape}")               # (64,)
```

## 이미지 압축 실전 예제: MNIST 784차원 → 50차원

PCA의 가장 직관적인 응용은 이미지 압축이다. MNIST는 28×28 = 784픽셀의 이미지를 데이터로 사용한다. PCA로 50차원으로 압축하면 어떻게 될까?

```python
from sklearn.datasets import fetch_openml
from sklearn.decomposition import PCA
from sklearn.preprocessing import MinMaxScaler
import numpy as np

# MNIST 로드 (70,000개 × 784차원)
mnist = fetch_openml('mnist_784', version=1, as_frame=False)
X_mnist = mnist.data.astype(np.float32)

scaler = MinMaxScaler()
X_scaled = scaler.fit_transform(X_mnist[:10000])  # 1만 개 샘플

# 1. PCA로 50차원 압축
pca_50 = PCA(n_components=50)
X_50   = pca_50.fit_transform(X_scaled)

print(f"압축률: {784/50:.1f}× (784차원 → 50차원)")
print(f"보존 분산: {pca_50.explained_variance_ratio_.sum():.3f}")

# 2. 역변환으로 이미지 복원
X_reconstructed = pca_50.inverse_transform(X_50)

# 3. 재구성 품질 비교
mse = np.mean((X_scaled - X_reconstructed) ** 2)
print(f"재구성 오차: {mse:.5f}")  # 0.005 내외

# 4. 학습 시간 비교 (784차원 vs 50차원)
from sklearn.linear_model import LogisticRegression
import time

# 원본 784차원
t0 = time.time()
lr_full = LogisticRegression(max_iter=100).fit(X_scaled[:8000], mnist.target[:8000])
print(f"원본 학습 시간: {time.time()-t0:.2f}초")

# PCA 50차원
t0 = time.time()
lr_pca = LogisticRegression(max_iter=100).fit(X_50[:8000], mnist.target[:8000])
print(f"PCA 학습 시간: {time.time()-t0:.2f}초")  # 훨씬 빠름
```

압축률은 약 15.7배이지만, 분류 정확도 차이는 1~2%에 불과한 경우가 대부분이다. 노이즈까지 제거되기 때문에 오히려 성능이 올라가는 경우도 있다.

## 화이트닝(Whitening): 주성분 간 상관 완전 제거

기본 PCA는 주성분을 서로 **비상관(uncorrelated)** 상태로 만들지만, 각 주성분의 분산은 다르다. **화이트닝(Whitening)**은 각 주성분의 분산을 1로 정규화하여 완전한 등방성(isotropy)을 만든다.

```python
# 화이트닝 PCA
pca_white = PCA(n_components=50, whiten=True)
X_white = pca_white.fit_transform(X_scaled)

# 검증: 각 주성분의 분산이 모두 1인지 확인
print(f"화이트닝 후 분산: {X_white.var(axis=0)[:5]}")
# → [1.0, 1.0, 1.0, 1.0, 1.0]
```

화이트닝은 신경망, SVM, 이미지 전처리 파이프라인에서 자주 사용된다. 특히 ICA(독립 성분 분석)의 전처리 단계로 필수적이다.

## Incremental PCA: 메모리 효율적 대용량 처리

전체 데이터를 메모리에 올릴 수 없을 때는 **Incremental PCA**를 사용한다. 배치 단위로 데이터를 처리하면서 주성분을 점진적으로 업데이트한다.

```python
from sklearn.decomposition import IncrementalPCA
import numpy as np

# 대용량 데이터: 100만 샘플 가정
n_samples, n_features = 1_000_000, 784
batch_size = 5000  # 메모리에 한 번에 올릴 수 있는 양

ipca = IncrementalPCA(n_components=50)

# 배치별로 학습
for i in range(0, n_samples, batch_size):
    X_batch = load_batch(i, batch_size)   # 실제 데이터 로드 함수
    ipca.partial_fit(X_batch)

# 학습 완료 후 변환
X_reduced = ipca.transform(X_test)
print(f"누적 분산: {ipca.explained_variance_ratio_.sum():.3f}")
```

## Kernel PCA: 비선형 차원 축소

기본 PCA는 선형 변환만 가능하다. 동심원처럼 선형으로 분리 불가능한 데이터는 어떻게 할까? **Kernel PCA**는 커널 트릭을 적용해 비선형 구조를 처리한다.

```python
from sklearn.decomposition import KernelPCA
from sklearn.datasets import make_circles

# 선형 PCA로는 분리 불가능한 동심원 데이터
X, y = make_circles(n_samples=400, factor=0.3, noise=0.05)

# RBF(가우시안) 커널 PCA
kpca = KernelPCA(
    n_components=2,
    kernel='rbf',       # 'rbf', 'poly', 'sigmoid', 'cosine'
    gamma=10,           # RBF 커널의 폭 결정
    fit_inverse_transform=True  # 역변환 지원
)
X_kpca = kpca.fit_transform(X)

# 동심원이 선형 분리 가능한 형태로 변환됨
print(f"원본 shape: {X.shape}")
print(f"변환 shape: {X_kpca.shape}")
```

단점은 계산 비용이 $O(n^3)$으로 매우 높고, `n_components`로 설명 분산비를 직접 확인할 수 없다는 점이다.

## PCA 파이프라인 통합

실전에서는 PCA를 단독으로 쓰기보다 파이프라인에 통합한다.

```python
from sklearn.pipeline import Pipeline
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.model_selection import cross_val_score, GridSearchCV

# PCA → SVM 파이프라인
pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('pca',    PCA()),
    ('clf',    SVC(kernel='rbf'))
])

# GridSearchCV로 PCA 차원도 함께 튜닝
param_grid = {
    'pca__n_components': [10, 20, 50, 100],
    'clf__C': [0.1, 1, 10],
    'clf__gamma': ['scale', 'auto']
}

grid = GridSearchCV(pipe, param_grid, cv=5, n_jobs=-1)
grid.fit(X_train, y_train)

print(f"최적 파라미터: {grid.best_params_}")
print(f"최적 CV 점수: {grid.best_score_:.4f}")
```

## PCA의 한계: 언제 다른 방법을 써야 하나

PCA는 강력하지만 두 가지 근본적 한계가 있다.

**첫째, 선형 변환만 가능하다.** 스위스 롤(Swiss Roll)처럼 비선형으로 말려 있는 다양체(Manifold) 구조는 선형 투영으로 펼 수 없다. 이런 경우에는 t-SNE, UMAP, LLE(Locally Linear Embedding) 같은 비선형 방법이 필요하다.

**둘째, 클래스 정보를 무시한다.** PCA는 레이블 $y$ 없이 오직 $X$의 분산만 극대화한다. 따라서 분류에 유용한 방향이 아니라 분산이 큰 방향을 우선적으로 찾는다. 분류 성능 향상을 위한 차원 축소라면 **LDA(Linear Discriminant Analysis, 선형 판별 분석)**가 더 적합할 수 있다.

## PCA vs LDA: 지도 학습 차원 축소

| 항목 | PCA | LDA |
|------|-----|-----|
| 학습 유형 | 비지도 | 지도 (레이블 필요) |
| 목표 | 전체 분산 최대화 | 클래스 간 분산 / 클래스 내 분산 최대화 |
| 주요 용도 | 압축, 노이즈 제거, 시각화 | 분류 전 차원 축소 |
| 최대 출력 차원 | min(n, d) | 클래스 수 - 1 |
| 정규화 필요 | 필요 | 클래스 분포에 따라 다름 |

```python
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis

# LDA: 클래스 정보를 활용한 차원 축소
lda = LinearDiscriminantAnalysis(n_components=2)
X_lda = lda.fit_transform(X_train, y_train)  # y 레이블 사용!

# LDA로 변환된 공간에서 클래스가 더 잘 분리됨
# MNIST: 10개 클래스 → 최대 9차원
```

---

**지난 글:** [DBSCAN: 밀도로 찾는 군집과 이상치](/posts/ml-dbscan/)

**다음 글:** [t-SNE와 UMAP: 고차원 데이터를 눈으로 보다](/posts/ml-tsne-umap/)

<br>
읽어주셔서 감사합니다. 😊
