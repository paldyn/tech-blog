---
title: "정보 이론: AI가 불확실성을 측정하는 방법"
description: "정보량, 엔트로피, KL 발산, 교차 엔트로피까지 정보 이론의 핵심을 이해하고 딥러닝 손실 함수와의 연결 고리를 코드로 확인한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["정보이론", "엔트로피", "KL발산", "교차엔트로피", "AI수학"]
featured: false
draft: false
---

[지난 글](/posts/ai-bayes-theorem/)에서 베이즈 정리가 새로운 증거로 믿음을 갱신하는 원리를 살펴봤다. 이번에는 AI 수학 기초의 마지막 퍼즐인 **정보 이론(Information Theory)**을 다룬다. 정보 이론은 1948년 클로드 섀넌(Claude Shannon)이 통신 이론 논문 한 편으로 세운 분야다. "메시지를 얼마나 압축할 수 있는가?"라는 실용적 질문에서 출발했지만, 오늘날 딥러닝의 손실 함수, LLM의 평가 지표(Perplexity), 강화 학습의 정책 최적화까지 AI 전반의 수학적 언어가 되었다.

## 정보량: 놀라움을 수치화하다

정보 이론의 핵심 직관은 단순하다. **예측하기 어려운 사건일수록 더 많은 정보를 담고 있다.** 매일 해가 뜨는 사건은 뉴스가 되지 않지만, 로또 당첨은 뉴스가 된다.

이 직관을 수식으로 표현한 것이 **정보량(Information Content 또는 Self-Information)**이다.

```
I(x) = −log₂ P(x)  [단위: bits]
```

- P(x) = 1.0 (확실한 사건): I = 0 bits → 아무 정보도 없음
- P(x) = 0.5 (동전 앞면): I = 1 bit → 1비트의 정보
- P(x) = 0.01 (희귀 사건): I ≈ 6.64 bits → 매우 많은 정보

밑이 2인 로그를 쓰면 단위가 bits, 자연 로그(ln)를 쓰면 nats가 된다. 딥러닝에서는 대부분 자연 로그를 사용한다.

```python
import numpy as np

def information_content(p):
    """사건의 정보량 계산 (bits)"""
    return -np.log2(p + 1e-10)

events = {
    "해가 뜸 (99.9%)":    0.999,
    "동전 앞면 (50%)":     0.5,
    "주사위 특정 면 (1/6)": 1/6,
    "로또 당첨 (0.0001%)": 0.000001,
}

for name, p in events.items():
    i = information_content(p)
    print(f"{name:30s} I = {i:.2f} bits")
```

![정보 이론: 엔트로피와 정보량](/assets/posts/ai-information-theory-entropy.svg)

## 엔트로피: 분포 전체의 불확실성

개별 사건의 정보량을 확률 가중 평균한 것이 **엔트로피(Entropy)**다. 확률 분포 전체가 얼마나 불확실한지를 하나의 숫자로 나타낸다.

```
H(X) = −Σ P(x) · log P(x)  = E[−log P(X)]
```

엔트로피를 이해하는 두 극단을 생각해보자.

**결정론적 분포** (한 결과가 확실): P = [1, 0, 0, 0]
→ H = 0 bits. 완전히 예측 가능하므로 불확실성 없음.

**균등 분포** (모든 결과가 동일): P = [0.25, 0.25, 0.25, 0.25]
→ H = 2 bits. 4가지 결과가 동일한 가능성 → 최대 불확실성.

```python
import torch
import torch.nn.functional as F

def entropy_bits(probs):
    """확률 분포의 엔트로피 계산 (bits)"""
    probs = torch.clamp(probs, min=1e-10)
    return -(probs * torch.log2(probs)).sum().item()

# 다양한 분포의 엔트로피 비교
deterministic = torch.tensor([0.99, 0.005, 0.003, 0.002])
moderate      = torch.tensor([0.60, 0.25, 0.10, 0.05])
uniform       = torch.tensor([0.25, 0.25, 0.25, 0.25])

print(f"결정론적 분포: H = {entropy_bits(deterministic):.3f} bits")
print(f"중간 분포:     H = {entropy_bits(moderate):.3f} bits")
print(f"균등 분포:     H = {entropy_bits(uniform):.3f} bits")
# 결정론적: 0.087 / 중간: 1.421 / 균등: 2.000
```

LLM에서 **Perplexity(복잡도)**는 `exp(평균 교차 엔트로피)`다. 언어 모델이 테스트 문장을 얼마나 "놀랍게" 여기는지를 측정한다. Perplexity가 낮을수록 모델이 텍스트를 잘 예측한다.

## KL 발산: 두 분포 사이의 거리

실제 데이터 분포 P와 모델이 학습한 분포 Q 사이의 차이를 측정하는 것이 **KL 발산(Kullback-Leibler Divergence)**이다.

```
D_KL(P ‖ Q) = Σ P(x) · log(P(x) / Q(x))
```

핵심 특성 세 가지:
1. **비음수**: D_KL ≥ 0, P = Q일 때만 0
2. **비대칭**: D_KL(P‖Q) ≠ D_KL(Q‖P) — 방향이 중요
3. **정보 이득**: Q를 사전 지식으로 쓸 때, P를 보고 얻는 추가 정보량

```python
import numpy as np

def kl_divergence(P, Q):
    """KL(P‖Q) 계산"""
    P = np.array(P, dtype=float)
    Q = np.array(Q, dtype=float)
    # Q가 0인 위치에서 P도 0이어야 함; 수치 안정성
    mask = P > 0
    return np.sum(P[mask] * np.log(P[mask] / (Q[mask] + 1e-10)))

P = [0.5, 0.3, 0.15, 0.05]  # 실제 분포
Q = [0.4, 0.35, 0.15, 0.10] # 모델 분포

print(f"D_KL(P‖Q) = {kl_divergence(P, Q):.4f}")
print(f"D_KL(Q‖P) = {kl_divergence(Q, P):.4f}")  # 값이 다름
```

VAE(변분 오토인코더)의 손실 함수는 `재구성 손실 + D_KL(q(z|x) ‖ p(z))`로 구성된다. KL 항이 잠재 공간을 표준 정규 분포에 가깝게 규제한다.

## 교차 엔트로피: 딥러닝 학습의 핵심 손실

**교차 엔트로피(Cross-Entropy)**는 KL 발산과 엔트로피의 합이다.

```
H(P, Q) = H(P) + D_KL(P ‖ Q) = −Σ P(x) · log Q(x)
```

P가 고정된 데이터 분포라면 H(P)는 상수다. 따라서 **H(P, Q)를 최소화하는 것 = D_KL(P‖Q)를 최소화하는 것 = Q를 P에 가깝게 만드는 것**이다. 이것이 딥러닝 분류 학습의 수학적 본질이다.

```python
import torch
import torch.nn.functional as F

# 분류 학습에서의 교차 엔트로피
logits = torch.tensor([
    [2.5, 0.5, -0.5],  # 0번 클래스 예측
    [0.1, 2.8,  0.3],  # 1번 클래스 예측
    [-0.2, 0.4, 2.1],  # 2번 클래스 예측
])
targets = torch.tensor([0, 1, 2])

loss = F.cross_entropy(logits, targets)
print(f"교차 엔트로피 손실: {loss:.4f}")

# LLM의 경우: 각 위치의 다음 토큰을 맞추는 언어 모델링
# H(P, Q) = -log Q(실제 다음 토큰) 의 평균
# Perplexity = exp(H(P, Q))
perplexity = torch.exp(loss)
print(f"Perplexity: {perplexity:.2f}")
```

![KL 발산과 교차 엔트로피](/assets/posts/ai-information-theory-kl.svg)

## 상호 정보량: 두 변수의 의존성

**상호 정보량(Mutual Information)**은 두 확률 변수 X, Y가 서로 얼마나 정보를 공유하는지를 측정한다.

```
I(X; Y) = H(X) + H(Y) − H(X, Y) = D_KL(P(X,Y) ‖ P(X)·P(Y))
```

- I(X; Y) = 0: 완전히 독립
- I(X; Y) > 0: 서로 정보를 공유 (종속)

상호 정보량은 특성 선택(feature selection), GAN 학습, 대조 학습(contrastive learning)에서 핵심 역할을 한다. CLIP 같은 멀티모달 모델은 이미지-텍스트 쌍의 상호 정보량을 최대화하는 방향으로 학습한다.

## 정보 이론이 AI에 미치는 영향

| 개념 | AI에서의 역할 |
|------|--------------|
| 엔트로피 H(X) | 결정 트리 분기 기준(정보 이득), 온도 파라미터 |
| 교차 엔트로피 H(P,Q) | 분류 손실 함수, LLM 언어 모델링 목표 |
| KL 발산 D_KL | VAE 정규화 항, RLHF 정책 제약 |
| Perplexity | LLM 평가 지표 |
| 상호 정보량 I(X;Y) | 특성 선택, 대조 학습, 멀티모달 |

정보 이론은 "얼마나 놀라운가"를 수학적 언어로 표현하는 도구다. 딥러닝 모델은 교차 엔트로피를 줄이면서 데이터의 불확실성을 압축하고, 그 과정에서 세상에 대한 유용한 표현을 학습한다.

---

**지난 글:** [베이즈 정리: AI 학습과 추론의 철학적 기반](/posts/ai-bayes-theorem/)

**다음 글:** [미적분학: AI 학습을 가능하게 하는 수학](/posts/ai-calculus-for-ml/)

<br>
읽어주셔서 감사합니다. 😊
