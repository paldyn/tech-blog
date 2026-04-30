---
title: "AI를 위한 확률론 기초: 불확실성을 다루는 수학"
description: "결합·주변·조건부 확률, 주요 분포, 기대값, 엔트로피까지 AI 이해에 필요한 확률론 핵심을 코드와 함께 정리한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["확률론", "수학", "통계", "엔트로피", "AI수학"]
featured: false
draft: false
---

[지난 글](/posts/ai-matrix-operations/)에서 행렬 연산이 신경망과 Attention 메커니즘의 뼈대임을 살펴봤다. 이번에는 AI의 또 다른 수학적 기반인 확률론(Probability Theory)을 다룬다. AI는 본질적으로 **불확실성을 다루는 시스템**이다. "이 이미지가 고양이일 확률은 얼마인가?", "다음에 나올 토큰은 무엇인가?", "이 행동이 최선일 확률은?" 같은 질문들이 모두 확률의 언어로 표현된다. 확률론 없이는 모델의 출력을 해석하거나 손실 함수를 이해할 수 없다.

## 확률의 세 가지 해석

확률을 어떻게 해석하는가에 따라 접근 방식이 달라진다.

**빈도주의(Frequentist)**: 확률은 무한히 반복했을 때의 상대적 빈도다. 동전을 무한히 던지면 앞면이 나올 비율이 0.5에 수렴한다.

**베이즈주의(Bayesian)**: 확률은 믿음의 정도(degree of belief)다. 불확실한 사건에 대한 주관적 확신 수준이며, 새 증거가 나오면 업데이트된다. 현대 AI 특히 LLM과 불확실성 모델링은 베이즈 관점에 더 가깝다.

## 결합·주변·조건부 확률

확률론의 세 핵심 개념을 스팸 필터 예시로 이해해보자.

```python
# 확률 계산 예시: 이메일 분류
# P(스팸) = 0.30, P("무료") = 0.20, P(스팸, "무료") = 0.15

p_spam = 0.30           # 주변 확률: 스팸일 확률
p_free = 0.20           # 주변 확률: "무료" 포함 확률
p_spam_and_free = 0.15  # 결합 확률: 스팸이면서 "무료" 포함

# 조건부 확률: "무료"가 있을 때 스팸일 확률
# P(스팸 | "무료") = P(스팸, "무료") / P("무료")
p_spam_given_free = p_spam_and_free / p_free
print(f"P(스팸|'무료') = {p_spam_given_free:.2f}")  # 0.75

# 독립성 확인: 두 사건이 독립이면 P(A∩B) = P(A)·P(B)
p_independent = p_spam * p_free
print(f"독립이었다면: {p_independent:.2f}")  # 0.06 ≠ 0.15
# → 독립이 아님: "무료"라는 단어가 스팸 여부와 강하게 연관
```

![확률론 핵심 개념: AI의 불확실성 언어](/assets/posts/ai-probability-basics-concepts.svg)

조건부 확률 `P(A|B)`는 AI 전체에 걸쳐 핵심이다. LLM의 언어 모델링 목표는 `P(다음 토큰 | 이전 토큰들)`을 정확하게 모델링하는 것이다. 문장 생성은 이 조건부 확률 분포에서 반복적으로 샘플링하는 과정이다.

## 기대값과 분산

```python
import numpy as np

# 연속 확률 변수의 기대값 (Monte Carlo 추정)
samples = np.random.normal(loc=3.0, scale=1.5, size=10000)
E_X = np.mean(samples)           # 기대값 ≈ 3.0
Var_X = np.var(samples)          # 분산 ≈ 2.25
Std_X = np.std(samples)          # 표준편차 ≈ 1.5

print(f"E[X] = {E_X:.3f}")       # ≈ 3.000
print(f"Var[X] = {Var_X:.3f}")   # ≈ 2.250
print(f"Std[X] = {Std_X:.3f}")   # ≈ 1.500

# 신경망 가중치 초기화도 기대값·분산 설계가 핵심
# Xavier 초기화: Var = 2/(fan_in + fan_out)
# He 초기화: Var = 2/fan_in (ReLU에 적합)
import torch.nn as nn
linear = nn.Linear(256, 128)
nn.init.xavier_uniform_(linear.weight)
```

기대값 E[X]는 확률 변수의 "평균적인 값"이다. 분산 Var[X]는 값들이 평균에서 얼마나 흩어져 있는지를 나타낸다. 신경망의 가중치 초기화에서 이 두 값을 적절히 설계하는 것이 그래디언트 소실/폭발 문제를 방지하는 핵심이다.

## 엔트로피: 불확실성의 측도

**엔트로피(Entropy)**는 정보 이론의 개념으로, 확률 분포의 불확실성(또는 정보량)을 측정한다.

```python
import torch
import torch.nn.functional as F

# 엔트로피 계산: H(p) = -∑ p(x) log p(x)
def entropy(probs):
    # 0 확률에 대한 로그 계산 방지
    probs = probs + 1e-10
    return -(probs * probs.log()).sum()

# 확실한 분포 (낮은 엔트로피)
certain = torch.tensor([0.99, 0.005, 0.005])
print(f"확실한 분포 H = {entropy(certain):.3f}")  # ≈ 0.08

# 불확실한 분포 (높은 엔트로피)
uncertain = torch.tensor([0.33, 0.33, 0.34])
print(f"불확실한 분포 H = {entropy(uncertain):.3f}")  # ≈ 1.10
```

모델이 한 클래스에 높은 확률을 할당하면 엔트로피가 낮고 (확신), 모든 클래스에 비슷한 확률을 할당하면 엔트로피가 높다 (불확실). LLM의 온도(Temperature) 파라미터는 사실 softmax의 스케일을 조절해 출력 분포의 엔트로피를 바꾸는 것이다.

## 교차 엔트로피: 분류 학습의 핵심 손실 함수

```python
import torch
import torch.nn as nn

# 교차 엔트로피 손실: H(p, q) = -∑ p(x) log q(x)
# p: 정답 분포 (one-hot), q: 모델 예측 분포

loss_fn = nn.CrossEntropyLoss()

# 배치 크기 4, 클래스 수 3
logits = torch.tensor([
    [2.0, 1.0, 0.1],   # 0번 클래스 높음
    [0.1, 3.0, 0.2],   # 1번 클래스 높음
    [0.5, 0.5, 2.5],   # 2번 클래스 높음
    [1.0, 1.0, 1.0],   # 불확실한 예측
])
targets = torch.tensor([0, 1, 2, 0])  # 정답 레이블

loss = loss_fn(logits, targets)
print(f"교차 엔트로피 손실: {loss:.4f}")

# LLM의 언어 모델링도 동일한 교차 엔트로피:
# 다음 토큰을 예측하지 못할수록 손실이 커짐
# Perplexity = exp(평균 교차 엔트로피)
```

![확률 연산 코드](/assets/posts/ai-probability-basics-code.svg)

## 최대 우도 추정(MLE): 학습의 수학적 목표

머신러닝 모델의 학습 목표는 **주어진 데이터를 가장 잘 설명하는 파라미터를 찾는 것**이다. 이를 수학적으로는 **최대 우도 추정(Maximum Likelihood Estimation, MLE)**이라 한다.

```
데이터 D = {x₁, x₂, ..., xₙ}가 주어졌을 때:
θ* = argmax P(D | θ)
   = argmax ∏ P(xᵢ | θ)    ← 곱으로 표현
   = argmax ∑ log P(xᵢ | θ) ← 로그 취해 합으로 (계산 안정성)
   = argmin -∑ log P(xᵢ | θ) ← 최소화 문제로 변환

→ 이것이 바로 Cross-Entropy Loss 최소화와 동치!
```

딥러닝 모델을 학습할 때 교차 엔트로피 손실을 최소화하는 것은 곧 MLE를 수행하는 것이다. 확률론을 이해하면 왜 특정 손실 함수가 사용되는지, 모델이 무엇을 최적화하는지를 명확히 알 수 있다.

---

**지난 글:** [행렬 연산 완전 정복: AI에서 쓰이는 핵심 연산 5가지](/posts/ai-matrix-operations/)

**다음 글:** [베이즈 정리: AI 학습의 철학적 기반](/posts/ai-bayes-theorem/)

<br>
읽어주셔서 감사합니다. 😊
