---
title: "손실 함수 완전 정복: 무엇을 최소화하는가"
description: "MSE·MAE·Huber·CrossEntropy·Focal Loss·KL Divergence까지 주요 손실 함수의 원리와 용도를 수식과 PyTorch 코드로 완전 정리한다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["손실함수", "MSE", "CrossEntropy", "FocalLoss", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/ai-optimizers/)에서 옵티마이저가 파라미터를 어떻게 업데이트하는지 살펴봤다. 옵티마이저가 최소화하려는 목표값이 바로 **손실 함수(Loss Function)**다. "무엇을 최소화하느냐"가 모델이 학습하는 것을 결정한다. 잘못된 손실 함수를 선택하면 아무리 좋은 옵티마이저를 쓰더라도 원하는 결과를 얻을 수 없다.

## 회귀 손실: 연속값 예측

회귀 문제는 연속적인 수치를 예측한다. 집값 예측, 기온 예측, 주식 가격 예측 등이 해당한다.

**MSE (Mean Squared Error)**: 가장 널리 쓰이는 회귀 손실이다.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

pred = torch.tensor([2.5, 0.0, 2.0, 8.0])
true = torch.tensor([3.0, -0.5, 2.0, 5.0])

# MSE: L = (1/n) Σ (ŷ - y)²
mse = nn.MSELoss()(pred, true)
print(f"MSE: {mse:.4f}")  # 큰 오차(8→5)가 제곱으로 강조됨

# MAE: L = (1/n) Σ |ŷ - y|
mae = nn.L1Loss()(pred, true)
print(f"MAE: {mae:.4f}")  # 이상치(8→5)에 덜 민감

# Huber Loss: 작으면 MSE, 크면 MAE
huber = nn.HuberLoss(delta=1.0)(pred, true)
print(f"Huber: {huber:.4f}")  # MSE와 MAE의 장점 결합
```

| 손실함수 | 공식 | 이상치 민감도 | 미분 |
|---------|------|-------------|------|
| MSE | Σ(ŷ-y)²/n | 높음 (제곱) | 매끄러움 |
| MAE | Σ|ŷ-y|/n | 낮음 | 0에서 불연속 |
| Huber | 조건부 MSE/MAE | 중간 | 매끄러움 |

실전 선택: 이상치가 없으면 MSE, 이상치가 많으면 MAE, 둘 다 걱정되면 Huber.

## 이진 분류: BCE

이진 분류(0/1 출력)에는 **Binary Cross-Entropy(BCE)**를 쓴다.

```python
# BCEWithLogitsLoss = sigmoid + BCE (수치적으로 더 안정)
# logits: sigmoid 이전 값 (제한 없음)
logits  = torch.tensor([2.0, -1.5, 0.5, -0.3])
labels  = torch.tensor([1.0,  0.0, 1.0,  0.0])

bce = nn.BCEWithLogitsLoss()(logits, labels)
print(f"BCE: {bce:.4f}")

# 클래스 불균형 대응: pos_weight
# 양성:음성 = 1:10 → pos_weight=10으로 균형 보정
pos_weight = torch.tensor([10.0])
bce_balanced = nn.BCEWithLogitsLoss(pos_weight=pos_weight)(logits, labels)

# 공식: L = -[y·log(σ(x)) + (1-y)·log(1-σ(x))]
```

## 다중 분류: Cross-Entropy

3개 이상 클래스를 분류할 때 **Cross-Entropy Loss**를 쓴다. PyTorch의 `CrossEntropyLoss`는 Softmax + Log + NLL을 한 번에 처리한다.

```python
# CrossEntropyLoss: logits → softmax → log → NLL
# 배치 4, 클래스 10
logits  = torch.randn(4, 10)
targets = torch.randint(0, 10, (4,))

ce_loss = nn.CrossEntropyLoss()(logits, targets)
print(f"CE: {ce_loss:.4f}")

# 클래스 가중치: 불균형 클래스에 가중치 부여
weights = torch.ones(10)
weights[3] = 5.0  # 3번 클래스가 희귀 → 5배 가중치
ce_weighted = nn.CrossEntropyLoss(weight=weights)(logits, targets)

# 레이블 스무딩 (LLM 학습에서 중요)
# 완전한 one-hot 대신 (1-ε)를 정답에, ε/(K-1)을 나머지에 분배
ce_smooth = nn.CrossEntropyLoss(label_smoothing=0.1)(logits, targets)
```

LLM의 언어 모델링은 다음 토큰을 맞추는 거대한 다중 분류 문제다. 어휘 크기 50257(GPT-2)이나 128000(LLaMA-3)개 클래스 중 다음 토큰을 예측한다.

![손실 함수 전체 지도](/assets/posts/ai-loss-functions-overview.svg)

## Focal Loss: 클래스 불균형의 해결사

객체 탐지에서 배경 영역이 객체보다 수십 배 많다. 쉬운 음성 샘플이 학습을 지배해 모델이 모든 것을 배경으로 예측하려는 경향이 생긴다.

```python
def focal_loss(logits, targets, gamma=2.0, alpha=0.25):
    """Focal Loss: 쉬운 샘플 가중치 감소, 어려운 샘플 가중치 증가"""
    ce = F.cross_entropy(logits, targets, reduction='none')
    pt = torch.exp(-ce)  # 예측 확률 (잘 맞힌 샘플은 높음)
    
    # (1-pt)^gamma: 잘 맞히는 샘플의 기여도 감소
    focal_weight = (1 - pt) ** gamma
    return (alpha * focal_weight * ce).mean()

# gamma=0: 일반 Cross-Entropy
# gamma=2: 잘 분류된 샘플은 거의 영향 없음, 어려운 샘플에 집중
logits  = torch.randn(8, 5)
targets = torch.randint(0, 5, (8,))
print(f"Focal Loss: {focal_loss(logits, targets):.4f}")
```

## KL 발산: 생성 모델의 손실

VAE(Variational Autoencoder)에서 잠재 공간 분포를 정규분포에 가깝게 만드는 데 KL 발산을 사용한다.

```python
# VAE 손실: 재구성 손실 + KL 발산
def vae_loss(recon_x, x, mu, log_var):
    """VAE 손실 함수"""
    # 재구성 손실 (BCE)
    recon_loss = F.binary_cross_entropy(recon_x, x, reduction='sum')
    
    # KL 발산: q(z|x)~N(μ,σ²) vs p(z)~N(0,1)
    # KL = -0.5 * Σ(1 + log(σ²) - μ² - σ²)
    kl_loss = -0.5 * torch.sum(1 + log_var - mu.pow(2) - log_var.exp())
    
    return recon_loss + kl_loss

# RLHF에서도 KL: 현재 정책과 참조 정책의 차이를 제약으로 사용
# reward_loss = reward - β·KL(π_θ ‖ π_ref)
```

## 대조 손실: 임베딩 학습의 핵심

CLIP, SimCLR 같은 모델은 비슷한 데이터는 임베딩 공간에서 가깝게, 다른 데이터는 멀게 만드는 **대조 손실(Contrastive Loss)**을 사용한다.

```python
def infonce_loss(image_emb, text_emb, temperature=0.07):
    """InfoNCE Loss (CLIP 스타일)"""
    # 정규화
    image_emb = F.normalize(image_emb, dim=-1)
    text_emb  = F.normalize(text_emb,  dim=-1)
    
    # 유사도 행렬 (배치 내 모든 이미지-텍스트 쌍)
    logits = image_emb @ text_emb.T / temperature  # [B, B]
    
    # 대각선이 정답 쌍 (같은 인덱스끼리 매칭)
    labels = torch.arange(logits.size(0))
    loss_i = F.cross_entropy(logits, labels)       # 이미지→텍스트
    loss_t = F.cross_entropy(logits.T, labels)     # 텍스트→이미지
    return (loss_i + loss_t) / 2
```

![주요 손실 함수 PyTorch 구현](/assets/posts/ai-loss-functions-code.svg)

## 손실 함수 선택 가이드

손실 함수를 고를 때 순서가 있다.

1. **예측 목표**: 연속값이면 회귀 손실, 클래스이면 분류 손실
2. **출력 형태**: sigmoid → BCE, softmax → CE, 원점 대칭 → MSE/Huber
3. **데이터 특성**: 이상치 많으면 MAE/Huber, 클래스 불균형이면 Focal/가중치

LLM과 생성 모델은 대부분 Cross-Entropy 또는 그 변형을 쓰지만, 생성 다양성(다음 단계에서 배울 온도), 인간 선호(RLHF reward), 안전성(KL 제약) 등을 다루기 위해 손실을 조합한다.

---

**지난 글:** [옵티마이저 완전 정복: SGD에서 AdamW까지](/posts/ai-optimizers/)

**다음 글:** [정규화: 과적합을 막는 AI의 방패](/posts/ai-regularization/)

<br>
읽어주셔서 감사합니다. 😊
