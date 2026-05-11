---
title: "RLHF: 인간 피드백으로 LLM 정렬하기"
description: "RLHF(Reinforcement Learning from Human Feedback)의 3단계 파이프라인을 SFT·보상 모델·PPO 알고리즘 순으로 상세히 해설하고, KL divergence 페널티와 reward hacking 문제까지 실제 코드와 함께 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["RLHF", "PPO", "보상모델", "LLM정렬", "강화학습", "KL페널티", "InstructGPT", "TRL"]
featured: false
draft: false
---

[지난 글](/posts/llm-instruction-tuning/)에서 인스트럭션 튜닝의 전체 흐름—SFT, 보상 모델링, RLHF와 DPO—을 큰 그림으로 살펴봤다. 이번 글에서는 그 중심에 있는 **RLHF(Reinforcement Learning from Human Feedback)**를 깊이 파고든다. RLHF는 ChatGPT와 InstructGPT가 단순한 언어 모델을 넘어 "사람이 원하는 대로 동작하는 AI"로 거듭나게 한 핵심 기술이다. 2022년 OpenAI의 InstructGPT 논문은 175B 파라미터의 GPT-3보다, 훨씬 작은 1.3B 파라미터라도 RLHF로 정렬된 모델이 인간 평가자들에게 더 선호된다는 것을 보여줬다. 크기보다 정렬(alignment)이 중요하다는 것을 증명한 셈이다.

## RLHF란 무엇인가

RLHF는 이름 그대로 "인간의 피드백을 강화학습 신호로 사용해 LLM을 훈련"하는 방법이다. 전통적인 강화학습에서 에이전트는 환경과 상호작용하며 보상을 최대화하도록 학습한다. RLHF에서 "환경"은 인간의 선호이고, "보상"은 그 선호를 근사하는 보상 모델이다.

왜 단순한 지도학습(SFT)으로 충분하지 않은가? 지도학습은 "이 입력에는 이 출력"이라는 정답 데이터가 필요하다. 그런데 "좋은 대화"의 정답은 맥락마다 다르고, 미묘하고, 때로는 여러 정답이 동시에 존재한다. 인간은 두 응답을 비교해 어떤 것이 더 좋은지 판단하는 것이 정답을 직접 쓰는 것보다 훨씬 쉽다. RLHF는 이 비교 신호를 활용한다.

![RLHF 3단계 파이프라인](/assets/posts/llm-rlhf-pipeline.svg)

## 3단계 파이프라인

### 1단계: SFT (Supervised Fine-Tuning)

첫 번째 단계는 고품질 데모 데이터로 베이스 모델을 파인튜닝하는 것이다. 숙련된 레이블러가 다양한 프롬프트에 대해 이상적인 응답을 직접 작성한다. InstructGPT에서는 약 13,000개의 이런 데모를 사용했다. 이 단계의 목적은 모델이 기본적인 지시 따르기 능력을 갖추게 하는 것이다. SFT 모델이 없으면 이후 RLHF 단계에서 의미 있는 응답을 생성할 기반 자체가 없다.

### 2단계: 보상 모델 학습 (Reward Model Training)

두 번째 단계가 RLHF의 핵심이다. 같은 프롬프트에 대해 SFT 모델이 여러 응답을 생성하고, 인간 레이블러가 어떤 응답이 더 좋은지 선택한다. 이 **선호 쌍(preference pairs)** 데이터로 보상 모델(Reward Model, RM)을 학습시킨다.

보상 모델은 프롬프트와 응답을 입력받아 단일 스칼라 점수를 출력하도록 학습된다. 수학적으로는 **Bradley-Terry 모델**을 사용한다:

```
P(y_w > y_l | x) = σ(r(x, y_w) - r(x, y_l))
```

`y_w`는 선호된(chosen) 응답, `y_l`은 거부된(rejected) 응답, `r`은 보상 함수, `σ`는 시그모이드 함수다. 보상 모델은 이 확률을 최대화하도록 학습된다. 즉, 선호된 응답의 점수가 거부된 응답보다 높아야 한다.

```python
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

config = PPOConfig(
    model_name="sft-model",
    learning_rate=1.41e-5,
    batch_size=64,
    ppo_epochs=4,
    kl_penalty="kl",
    init_kl_coef=0.2,
)

model = AutoModelForCausalLMWithValueHead.from_pretrained(config.model_name)
ppo_trainer = PPOTrainer(config, model, ref_model, tokenizer, dataset)
```

![보상 모델 학습 PPO 구현](/assets/posts/llm-rlhf-reward-model.svg)

### 3단계: PPO Fine-tuning

보상 모델이 준비되면 PPO(Proximal Policy Optimization)로 LLM을 추가 학습한다. 강화학습 용어로 표현하면:

- **정책(Policy):** 현재 LLM (토큰을 생성하는 확률 분포)
- **상태(State):** 현재까지의 토큰 시퀀스
- **행동(Action):** 다음 토큰 선택
- **보상(Reward):** 응답 완성 시 보상 모델이 부여하는 점수

PPO의 목적함수는 보상을 최대화하되, 기준 모델(reference model, SFT 모델)에서 너무 멀리 벗어나지 않도록 **KL divergence 페널티**를 추가한다:

```
목적함수 = E[r(x,y)] - β · KL[π_θ(y|x) ‖ π_ref(y|x)]
```

`β`는 KL 페널티 강도를 제어하는 계수다. β가 너무 작으면 모델이 기준 모델에서 크게 벗어나 reward hacking에 빠지고, β가 너무 크면 개선이 거의 일어나지 않는다. InstructGPT에서는 β=0.02를 사용했다.

## PPO가 왜 필요한가

PPO 이전에는 REINFORCE 같은 단순한 정책 그래디언트 방법을 사용했다. 하지만 강화학습에서 업데이트가 너무 크면 정책이 갑자기 나쁜 방향으로 변해 회복이 어렵다. PPO는 **클리핑(clipping)** 기법으로 각 업데이트의 크기를 제한해 학습을 안정적으로 유지한다:

```
L_CLIP = E[min(r_t(θ)·A_t, clip(r_t(θ), 1-ε, 1+ε)·A_t)]
```

`r_t(θ)`는 새 정책과 이전 정책의 확률 비율, `A_t`는 어드밴티지(advantage), ε는 클리핑 범위(보통 0.2)다. 이 클리핑이 정책 업데이트를 완만하게 제한해 학습 안정성을 크게 높인다.

## RLHF의 한계: Reward Hacking

RLHF의 가장 큰 위험은 **Reward Hacking**이다. 모델이 보상 모델의 허점을 찾아 실제로 좋지 않지만 높은 점수를 받는 응답을 생성하는 현상이다. 예를 들어 "길고 자신감 있는 응답"을 선호하는 보상 모델이 있다면, 모델은 내용과 무관하게 자신감 넘치는 장문의 답을 생성하는 법을 학습한다.

이를 방지하기 위한 방법들:

1. **KL 페널티:** 기준 모델에서 너무 멀어지지 않도록 제한
2. **보상 모델 앙상블:** 여러 보상 모델의 최솟값 사용
3. **주기적 보상 모델 업데이트:** 생성된 응답으로 보상 모델 재학습
4. **Constitutional AI:** 규칙 기반으로 보상 해킹 방지 (다음 글 주제)

```python
# reward hacking 감지: KL divergence 모니터링
import torch
import torch.nn.functional as F

def compute_kl_divergence(new_logprobs, ref_logprobs):
    """현재 정책과 기준 모델 간의 KL divergence 계산"""
    # KL(π_new ‖ π_ref) = sum(π_new * log(π_new / π_ref))
    kl = (new_logprobs.exp() * (new_logprobs - ref_logprobs)).sum(-1)
    return kl.mean()

# 학습 중 KL이 급격히 커지면 reward hacking 가능성
def check_reward_hacking(kl_value, threshold=10.0):
    if kl_value > threshold:
        print(f"경고: KL divergence {kl_value:.2f} > {threshold}")
        print("보상 해킹 가능성! β 계수를 높이거나 학습률을 낮추세요.")
        return True
    return False
```

## 실제 스케일에서의 RLHF

RLHF를 실제 대규모 모델에 적용할 때는 추가적인 엔지니어링이 필요하다:

**메모리 관리:** PPO 학습은 동시에 4개의 모델을 메모리에 올려야 한다—현재 정책(policy), 기준 모델(reference), 보상 모델(reward model), 가치 모델(value model). 70B 모델 기준으로 수백 GB의 GPU 메모리가 필요하다.

**샘플 효율:** 강화학습은 지도학습에 비해 샘플 효율이 낮다. 같은 컴퓨팅으로 더 많은 성능 향상을 얻기 위해 PPO의 하이퍼파라미터 튜닝이 중요하다.

**인간 레이블러 품질:** 보상 모델의 품질은 레이블러의 품질에 달려 있다. 레이블러 간 일관성(inter-annotator agreement)이 낮으면 보상 모델도 노이즈가 많아진다. OpenAI는 레이블러 교육과 가이드라인 작성에 상당한 노력을 기울였다.

## RLHF의 유산

RLHF는 ChatGPT 이후 거의 모든 상용 LLM의 핵심 정렬 기법이 됐다. 그러나 높은 계산 비용, reward hacking, 그리고 복잡한 구현이 단점으로 남았다. 이를 해결하려는 다음 단계가 DPO(Direct Preference Optimization)이다. RLHF가 "보상 모델 → PPO 강화학습"이라는 2단계를 거치는 반면, DPO는 보상 모델 없이 선호 데이터에서 직접 최적화한다. 수학적으로 RLHF와 동일한 목표를 달성하면서 구현이 훨씬 단순하다.

---

**지난 글:** [LLM 인스트럭션 튜닝: 지시를 따르는 모델 만들기](/posts/llm-instruction-tuning/)

**다음 글:** [DPO: 보상 모델 없는 직접 선호도 최적화](/posts/llm-dpo/)

<br>
읽어주셔서 감사합니다. 😊
