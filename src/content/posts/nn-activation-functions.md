---
title: "활성화 함수: ReLU·Sigmoid·GELU의 모든 것"
description: "신경망의 비선형성을 담당하는 활성화 함수를 완전 정복한다. Sigmoid, Tanh, ReLU, Leaky ReLU, GELU, Swish의 수식·특성·한계를 비교하고, 실무에서 어떤 상황에 어떤 함수를 선택해야 하는지를 알아본다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["활성화함수", "ReLU", "GELU", "Sigmoid", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/neural-network-basics/)에서 신경망이 층별 행렬 연산으로 이루어진다는 것을 배웠고, 활성화 함수 없이는 아무리 층을 쌓아도 선형 변환에 불과하다는 것을 확인했다. 이번 글은 그 핵심인 **활성화 함수(Activation Function)**를 집중적으로 파헤친다. 활성화 함수는 신경망에 비선형성을 부여해 복잡한 패턴 학습을 가능하게 한다. 어떤 함수가 있는지, 각각 어떤 특성과 한계를 가지는지, 실무에서 어떻게 선택하는지를 코드와 함께 완전히 이해한다.

## 왜 비선형 활성화가 필요한가

선형 변환 `y = Wx + b`을 아무리 쌓아도 결국 하나의 선형 변환으로 축약된다. 비선형 활성화 함수가 있어야 신경망이 **보편 함수 근사기(Universal Function Approximator)**가 될 수 있다. 이것이 활성화 함수의 존재 이유다.

좋은 활성화 함수의 조건:
1. **비선형성**: 선형 모델로 표현 불가능한 함수를 근사할 수 있어야 함
2. **미분 가능성**: 역전파(gradient descent) 계산이 가능해야 함
3. **계산 효율**: 순전파/역전파 시 빠르게 계산될 수 있어야 함
4. **기울기 소실 방지**: 깊은 네트워크에서 기울기가 소멸되지 않아야 함

## Sigmoid 함수

$$\sigma(z) = \frac{1}{1 + e^{-z}}$$

출력 범위가 (0, 1)이므로 이진 분류의 출력층에 자주 사용된다. 하지만 은닉층에서는 잘 쓰이지 않는다.

```python
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt

x = torch.linspace(-6, 6, 200)

sigmoid = torch.sigmoid(x)
# 기울기: σ(z)·(1−σ(z)) → 최대값 0.25 (z=0에서)
# z가 크거나 작으면 기울기 ≈ 0 → 기울기 소실 문제
```

**Sigmoid의 문제점**:
- **기울기 소실(Vanishing Gradient)**: z가 크거나 작으면 기울기가 0에 수렴. 깊은 네트워크에서 초기 층의 학습이 거의 안 됨
- **비제로 중심 출력**: 출력이 항상 양수여서 가중치 업데이트가 항상 같은 방향으로만 이루어짐 → 지그재그 수렴

## Tanh 함수

$$\tanh(z) = \frac{e^z - e^{-z}}{e^z + e^{-z}}$$

Sigmoid의 스케일 조정 버전으로, 출력이 (-1, 1) 범위로 **제로 중심(zero-centered)**이다. Sigmoid보다 낫지만 기울기 소실 문제는 여전히 존재한다. RNN에서 주로 사용된다.

## ReLU (Rectified Linear Unit)

$$\text{ReLU}(z) = \max(0, z)$$

2010년대 딥러닝 혁명을 이끈 활성화 함수. 단순하지만 매우 효과적이다.

```python
# ReLU 구현
relu = F.relu(x)
# 미분: z > 0이면 1, z < 0이면 0
# → 양수 영역에서 기울기 소실 없음
# → 계산이 매우 빠름 (단순 max 연산)

# Leaky ReLU: 음수 영역의 기울기를 작게 유지
leaky_relu = F.leaky_relu(x, negative_slope=0.01)
# 미분: z > 0이면 1, z < 0이면 0.01
```

**ReLU 장점**:
- 양수 영역에서 기울기 소실 없음
- 계산 비용이 매우 낮음 (max 연산)
- 희소 활성화: 음수 입력을 0으로 만들어 뉴런의 선택적 활성화

**Dying ReLU 문제**: 학습 중 일부 뉴런의 입력이 항상 음수가 되면, 해당 뉴런은 영구적으로 출력 0을 내보내고 기울기도 0이 되어 더 이상 학습하지 않는다. 해결책: Leaky ReLU, ELU, 낮은 학습률, 배치 정규화.

## GELU (Gaussian Error Linear Unit)

$$\text{GELU}(z) = z \cdot \Phi(z)$$

여기서 Φ는 표준 정규 분포의 CDF다. 실용적 근사:

$$\text{GELU}(z) \approx 0.5z\left(1 + \tanh\left[\sqrt{\frac{2}{\pi}}(z + 0.044715z^3)\right]\right)$$

```python
# GELU — BERT, GPT 등 트랜스포머에서 사용
gelu = F.gelu(x)

# Swish (SiLU) — LLaMA, Mistral 등에서 사용
swish = F.silu(x)  # z * sigmoid(z)

# 비교
print(f"GELU(1.0) = {F.gelu(torch.tensor(1.0)):.4f}")
print(f"ReLU(1.0) = {F.relu(torch.tensor(1.0)):.4f}")
print(f"Swish(1.0) = {F.silu(torch.tensor(1.0)):.4f}")
# GELU(1.0) = 0.8413
# ReLU(1.0) = 1.0000
# Swish(1.0) = 0.7311
```

GELU는 ReLU보다 부드럽고(미분 가능), 음수 입력에서도 작은 값을 허용한다. BERT, GPT, ViT 등 대부분의 트랜스포머 모델이 GELU를 사용한다.

![활성화 함수 비교](/assets/posts/nn-activation-functions-types.svg)

## 출력층에서의 활성화 함수

은닉층과 달리 출력층의 활성화 함수는 **문제 유형**에 따라 결정된다.

| 문제 유형 | 활성화 함수 | 이유 |
|---------|-----------|------|
| 이진 분류 | Sigmoid | 확률 (0~1) 출력 |
| 다중 분류 | Softmax | 클래스 확률 합 = 1 |
| 회귀 | 없음 (Linear) | 임의의 실수값 |
| 다중 레이블 | Sigmoid (각각) | 독립적 이진 판단 |

```python
# 소프트맥스: 다중 분류 출력
logits = torch.tensor([2.0, 1.0, 0.5])
probs = torch.softmax(logits, dim=0)
print(probs)  # [0.6590, 0.2424, 0.0986]
print(probs.sum())  # tensor(1.0000) ← 합산 항상 1

# 실제로는 CrossEntropyLoss가 softmax를 내부 포함
# → 출력층에 Softmax 명시적으로 넣지 않아도 됨
criterion = torch.nn.CrossEntropyLoss()
```

![활성화 함수 구현](/assets/posts/nn-activation-functions-code.svg)

## 실무 선택 가이드

- **은닉층 기본값**: ReLU. 대부분의 경우 잘 동작한다.
- **트랜스포머 은닉층**: GELU 또는 SiLU(Swish). 성능이 약간 더 좋다.
- **RNN 게이트**: Sigmoid와 Tanh 조합 (LSTM/GRU 설계 자체에 내장)
- **깊은 네트워크에서 ReLU 문제 시**: Leaky ReLU, ELU, 또는 배치 정규화 추가
- **출력층**: 문제 유형에 따라 결정 (위 표 참고)

활성화 함수는 학습 안정성에 큰 영향을 미친다. 다음 글에서 배울 역전파(Backpropagation)에서 활성화 함수의 **미분**이 핵심 역할을 한다.

---

**지난 글:** [신경망 기초: 층, 파라미터, 순전파의 모든 것](/posts/neural-network-basics/)

**다음 글:** [순전파와 역전파: 그래디언트 흐름 완전 이해](/posts/nn-forward-backward/)

<br>
읽어주셔서 감사합니다. 😊
