---
title: "퍼셉트론: 딥러닝의 기원이 된 인공 뉴런"
description: "1957년 Rosenblatt의 퍼셉트론부터 학습 규칙, 수렴 정리, 한계(XOR 문제)까지. 딥러닝 시대를 연 최초의 학습 가능한 뉴런 모델을 코드와 함께 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["퍼셉트론", "신경망기초", "딥러닝입문", "인공뉴런", "분류알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/ml-clustering-metrics/)에서 비지도 학습 클러스터링의 평가 지표를 살펴봤다. 이제 머신러닝의 연장선이자 딥러닝의 출발점인 **신경망(Neural Network)** 영역으로 넘어간다. 그 첫 번째 주인공은 1957년 Frank Rosenblatt가 고안한 **퍼셉트론(Perceptron)**이다. 퍼셉트론은 현대 딥러닝의 수십억 개 파라미터를 가진 대형 모델들의 직계 조상이다. 이 모델을 이해하면 신경망이 '왜' 그렇게 설계되어 있는지 자연스럽게 납득할 수 있다.

## 퍼셉트론이란

퍼셉트론은 생물학적 뉴런에서 영감을 받았다. 뇌의 뉴런은 여러 수상돌기(dendrite)로 신호를 받고, 합산된 신호가 임계값을 초과하면 축삭(axon)을 통해 다음 뉴런으로 신호를 전달한다. 퍼셉트론은 이 동작을 수학적으로 모방한다.

- **입력(x)**: 여러 개의 숫자값 (특성값)
- **가중치(w)**: 각 입력의 중요도를 결정하는 파라미터
- **편향(b)**: 뉴런의 발화 임계값을 조절하는 상수
- **활성화 함수(f)**: 가중합의 결과를 이진 출력으로 변환

수학적으로 표현하면:

```
ŷ = f(w₁x₁ + w₂x₂ + ... + wₙxₙ + b)
  = f(wᵀx + b)
```

여기서 f는 계단 함수(step function): f(z) = 1 if z ≥ 0 else 0

![퍼셉트론 구조](/assets/posts/nn-perceptron-structure.svg)

## 퍼셉트론 학습 규칙

퍼셉트론의 핵심은 스스로 **오류를 수정하는 학습 규칙**이다. 예측이 틀렸을 때 가중치를 조금씩 바꿔 다음에는 올바른 예측을 하도록 한다.

**업데이트 규칙**:

```
Δwᵢ = η · (y − ŷ) · xᵢ
wᵢ ← wᵢ + Δwᵢ
```

- `η`: 학습률(learning rate) — 한 번에 얼마나 크게 수정할지
- `y`: 정답 레이블 (0 또는 1)
- `ŷ`: 현재 예측값
- `xᵢ`: i번째 입력값

**직관적 해석**:
- 예측이 맞으면 (y = ŷ): Δw = 0 → 가중치 변화 없음
- 예측이 0이어야 하는데 1로 예측: Δw = -η · xᵢ → 가중치 감소
- 예측이 1이어야 하는데 0으로 예측: Δw = +η · xᵢ → 가중치 증가

## Python 구현

```python
import numpy as np
from sklearn.datasets import make_classification

class Perceptron:
    def __init__(self, lr=0.1, n_iter=100):
        self.lr = lr
        self.n_iter = n_iter

    def fit(self, X, y):
        # 가중치: 특성 수 + 편향 1개
        self.w_ = np.zeros(1 + X.shape[1])
        self.errors_ = []
        for _ in range(self.n_iter):
            errors = 0
            for xi, yi in zip(X, y):
                delta = self.lr * (yi - self.predict(xi))
                self.w_[1:] += delta * xi   # 특성 가중치
                self.w_[0]  += delta        # 편향 업데이트
                errors += int(delta != 0.0)
            self.errors_.append(errors)
        return self

    def net_input(self, X):
        return np.dot(X, self.w_[1:]) + self.w_[0]

    def predict(self, X):
        return np.where(self.net_input(X) >= 0.0, 1, 0)

# 선형 분리 가능 데이터 생성
X, y = make_classification(
    n_samples=200, n_features=2,
    n_redundant=0, random_state=42
)

ppn = Perceptron(lr=0.1, n_iter=50)
ppn.fit(X, y)
print(f"훈련 정확도: {(ppn.predict(X) == y).mean():.3f}")
```

![퍼셉트론 학습 구현](/assets/posts/nn-perceptron-learning.svg)

## 퍼셉트론 수렴 정리

퍼셉트론 학습이 실제로 동작하는 이유는 수학적으로 증명되어 있다.

**퍼셉트론 수렴 정리(Perceptron Convergence Theorem)**: 데이터가 선형 분리 가능(linearly separable)하면, 퍼셉트론 학습은 **유한한 횟수의 업데이트** 후 반드시 수렴한다.

여기서 핵심 조건은 **선형 분리 가능성**이다. 두 클래스를 하나의 직선(또는 초평면)으로 완벽하게 나눌 수 있어야 한다.

## XOR 문제: 퍼셉트론의 한계

1969년 Minsky와 Papert는 퍼셉트론이 **XOR 함수를 학습할 수 없음**을 수학적으로 증명했다. XOR은 선형 분리 불가능한 문제이기 때문이다.

```python
# XOR 데이터 — 퍼셉트론으로 해결 불가
X_xor = np.array([[0,0],[0,1],[1,0],[1,1]])
y_xor = np.array([0, 1, 1, 0])  # XOR: 입력이 다를 때만 1

ppn_xor = Perceptron(lr=0.1, n_iter=1000)
ppn_xor.fit(X_xor, y_xor)

# 학습 후에도 오류가 남음 — 수렴하지 않음
print(ppn_xor.errors_[-10:])
# 예: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
```

이 한계가 1970년대 AI 암흑기(AI Winter)의 원인 중 하나가 되었고, 이후 **다층 퍼셉트론(MLP)**과 **역전파(Backpropagation)** 알고리즘이 개발되면서 극복되었다.

## 퍼셉트론 vs 로지스틱 회귀

퍼셉트론과 로지스틱 회귀는 유사해 보이지만 차이가 있다.

| 항목 | 퍼셉트론 | 로지스틱 회귀 |
|------|---------|-------------|
| 활성화 | 계단 함수 (불연속) | 시그모이드 (연속) |
| 출력 | 이진 (0 또는 1) | 확률 (0.0 ~ 1.0) |
| 학습 | 오분류만 업데이트 | 모든 샘플에서 그래디언트 |
| 수렴 보장 | 선형 분리 가능할 때만 | 항상 수렴 |
| 확률 해석 | 불가 | 가능 |

활성화 함수가 연속이어야 경사하강법으로 학습할 수 있다. 퍼셉트론의 계단 함수는 불연속이라 미분이 불가능하고, 이것이 다음에 배울 **시그모이드(Sigmoid)**와 같은 연속 활성화 함수의 필요성을 만들어낸다.

## 정리

퍼셉트론은 세 가지 관점에서 중요하다. 첫째, **신경망의 가장 기본 단위**다. 현대의 어떤 복잡한 신경망도 퍼셉트론을 쌓고 변형한 것이다. 둘째, **학습(learning)의 개념**을 도입했다. 경험에서 스스로 파라미터를 조정하는 아이디어가 여기서 출발한다. 셋째, **한계를 통해 다음을 이끌었다**. XOR 문제가 없었다면 다층 신경망과 역전파가 이렇게 빨리 개발되지 않았을 수도 있다.

---

**다음 글:** [신경망 기초: 층과 파라미터의 세계](/posts/neural-network-basics/)

<br>
읽어주셔서 감사합니다. 😊
