---
title: "AI를 위한 선형대수 핵심: 스칼라·벡터·행렬·텐서"
description: "딥러닝과 LLM을 이해하는 데 반드시 필요한 선형대수 개념을 NumPy 코드와 함께 직관적으로 정리한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["선형대수", "수학", "NumPy", "벡터", "행렬", "AI수학"]
featured: false
draft: false
---

[지난 글](/posts/ai-current-landscape/)에서 AI 생태계의 전체 지도를 살펴봤다. 이제부터는 이 시리즈의 수학 기초 파트가 시작된다. "AI 공부에 수학이 정말 필요한가?" 라고 묻는 사람이 많다. 필요하다. 단, 모든 수학이 필요한 게 아니라 **특정 영역**의 수학이 필요하다. 그 첫 번째가 선형대수(Linear Algebra)다. 선형대수 없이는 임베딩, 신경망, Attention 메커니즘 중 어느 하나도 제대로 이해할 수 없다.

## 왜 선형대수인가: 데이터는 숫자의 집합이다

컴퓨터는 이미지, 텍스트, 소리를 직접 이해하지 못한다. 모두 숫자로 변환해야 한다. 한 장의 이미지는 수백만 개의 픽셀값 숫자로, 한 단어는 수백~수천 개의 소수로 이루어진 벡터로 변환된다. **선형대수는 이 숫자들의 집합을 다루는 수학**이다.

신경망의 "학습"이란 본질적으로 수십억 개의 숫자(가중치)를 조금씩 조정하는 과정이다. 그 조정은 행렬 곱셈과 벡터 연산으로 이루어진다. GPU가 AI 학습에 필수적인 이유도 이 때문이다. GPU는 행렬 연산을 병렬로 처리하는 데 특화된 하드웨어이기 때문이다.

## 스칼라 → 벡터 → 행렬 → 텐서: 차원의 계층

```python
import numpy as np

# 스칼라: 단일 숫자
learning_rate = 0.001
temperature = 0.7

# 벡터: 1차원 숫자 배열
word_embedding = np.array([0.2, -0.1, 0.8, 0.3, -0.5])
print(word_embedding.shape)  # (5,) → 5차원 벡터

# 행렬: 2차원 숫자 배열
weight_matrix = np.array([
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
    [0.7, 0.8, 0.9]
])
print(weight_matrix.shape)  # (3, 3)

# 텐서: 3차원 이상
# RGB 이미지: (높이, 너비, 채널)
rgb_image = np.zeros((224, 224, 3))
# 배치 이미지: (배치크기, 높이, 너비, 채널)
batch_images = np.zeros((32, 224, 224, 3))
print(batch_images.shape)   # (32, 224, 224, 3)
```

스칼라(Scalar)는 하나의 숫자다. 학습률, 손실값, 온도(temperature) 파라미터가 스칼라다. 벡터(Vector)는 여러 숫자를 순서대로 나열한 것이다. 단어 임베딩이 벡터다. "왕"이라는 단어를 768차원 벡터로 표현하면, 각 차원이 단어의 어떤 의미적 특성에 해당한다. 행렬(Matrix)은 벡터를 여러 개 쌓은 것이다. 신경망의 가중치가 행렬이다. 텐서(Tensor)는 이 개념을 n차원으로 일반화한 것이다.

![AI를 위한 선형대수 핵심 개념](/assets/posts/ai-linear-algebra-essentials-concepts.svg)

## 벡터의 핵심 연산: 내적과 코사인 유사도

AI에서 가장 자주 쓰이는 벡터 연산은 **내적(Dot Product)**이다. 두 벡터의 내적은 대응하는 원소끼리 곱해서 더한 값이다.

```python
a = np.array([1, 2, 3])
b = np.array([4, 5, 6])

# 내적: 1×4 + 2×5 + 3×6 = 32
dot_product = np.dot(a, b)
print(dot_product)  # 32

# 코사인 유사도: 내적을 두 벡터의 크기로 나눔
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# 1에 가까울수록 방향이 같음 (의미가 유사)
# -1에 가까울수록 방향이 반대 (의미가 반대)
# 0에 가까울수록 직교 (관계 없음)
```

코사인 유사도는 RAG 시스템에서 "쿼리와 가장 관련 있는 문서"를 찾을 때 핵심으로 쓰인다. 쿼리 벡터와 모든 문서 벡터 간의 코사인 유사도를 계산하고, 가장 유사한 k개를 반환한다.

**Transformer의 Attention 메커니즘**도 내적을 사용한다. Query 벡터와 Key 벡터의 내적으로 "이 토큰이 저 토큰에 얼마나 주목해야 하는가"를 계산한다.

## 행렬 변환: 신경망의 본질

신경망의 한 층(layer)은 수학적으로 행렬 곱셈과 비선형 함수 적용이다.

```python
# 신경망 한 층의 수학
def linear_layer(x, W, b):
    """
    x: 입력 벡터 (입력 크기,)
    W: 가중치 행렬 (출력 크기, 입력 크기)
    b: 편향 벡터 (출력 크기,)
    """
    return W @ x + b  # @ = 행렬 곱셈 연산자

# 예시: 3차원 입력 → 2차원 출력
x = np.array([1.0, 2.0, 3.0])       # 입력
W = np.random.randn(2, 3)           # 가중치 (2×3)
b = np.zeros(2)                      # 편향

output = linear_layer(x, W, b)
print(output.shape)  # (2,) → 2차원으로 변환됨
```

"딥러닝 모델이 학습한다"는 것은 곧 이 가중치 행렬 `W`의 값들이 조금씩 바뀐다는 뜻이다. GPT-4의 수천억 파라미터는 이런 행렬들의 원소들이다.

## 고유값·SVD: PCA와 추천 시스템의 기반

선형대수의 고급 주제인 **고유값 분해(Eigendecomposition)**와 **특이값 분해(SVD)**는 AI의 여러 곳에서 쓰인다.

```python
# PCA의 핵심: 공분산 행렬의 고유값 분해
data = np.random.randn(100, 5)  # 100개 샘플, 5차원 특징
cov = np.cov(data.T)            # 공분산 행렬 (5×5)

# 고유값: 각 방향의 분산(정보량)
# 고유벡터: 분산이 최대인 방향 (주성분)
eigenvalues, eigenvectors = np.linalg.eig(cov)

# 가장 큰 고유값에 해당하는 방향으로 투영 → 차원 축소
# k개의 주성분만 사용하면 5차원 → k차원으로 축소

# SVD: 행렬을 세 행렬의 곱으로 분해
U, singular_values, Vt = np.linalg.svd(data)
# 추천 시스템: 사용자-아이템 행렬을 SVD로 분해해
# 잠재 요인(latent factors) 추출
```

![NumPy로 구현하는 선형대수 핵심 연산](/assets/posts/ai-linear-algebra-essentials-numpy.svg)

## AI 실무에서 선형대수를 직접 쓰는 경우

실무에서 선형대수를 직접 코딩하는 일은 많지 않다. PyTorch나 NumPy가 이미 구현해놓은 함수들을 쓰기 때문이다. 하지만 **이해하지 못하면 코드가 블랙박스**가 된다.

예를 들어 임베딩 모델로 문서를 벡터화한 뒤 "가장 유사한 문서를 찾아라"는 작업을 할 때, `np.dot(query, doc_matrix.T)`가 내적으로 유사도를 계산한다는 것을 알면 결과를 해석하고 디버깅할 수 있다. Attention 행렬에서 특정 토큰에 과도한 주의가 집중되는 문제가 생겼을 때, QK^T 행렬의 스케일 문제임을 파악할 수 있다.

선형대수를 완벽히 마스터할 필요는 없다. 스칼라·벡터·행렬·텐서의 차이, 내적의 의미, 행렬 곱셈이 선형 변환임을 이해하는 것만으로도 AI 코드를 읽고 이해하는 데 충분한 기반이 된다.

---

**지난 글:** [2025년 AI 생태계 전체 지도](/posts/ai-current-landscape/)

**다음 글:** [행렬 연산 완전 정복: AI에서 쓰이는 핵심 연산 5가지](/posts/ai-matrix-operations/)

<br>
읽어주셔서 감사합니다. 😊
