---
title: "RLHF 심화: 인간 피드백으로 LLM 정렬하기"
description: "RLHF의 3단계 파이프라인(SFT→보상모델→PPO), Bradley-Terry 모델, KL 페널티, 보상 해킹 문제를 완전히 이해하고 DPO와의 비교까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["RLHF", "인간피드백", "보상모델", "PPO", "KL발산", "보상해킹", "LLM정렬", "DPO"]
featured: false
draft: false
---

[지난 글](/posts/rl-actor-critic/)에서 Actor-Critic 방법론이 정책과 가치 함수를 어떻게 협력시키는지 살펴보았다. 이번 글에서는 강화학습이 실제 언어 모델 훈련에 어떻게 적용되는지, ChatGPT와 Claude를 만든 핵심 기술인 **RLHF(Reinforcement Learning from Human Feedback)** 를 완전히 해부한다. RLHF는 단순히 언어 모델을 더 좋게 만드는 것이 아니라, "인간이 원하는 방식으로 동작하도록 정렬(align)"하는 기술이다.

## 왜 RLHF가 필요한가

사전학습된 LLM은 인터넷의 방대한 텍스트를 학습해 놀라운 언어 능력을 갖추지만, 인간이 원하는 방식으로 대답하지 않는다. 질문에 대한 답 대신 비슷한 질문을 더 생성하거나, 유해한 내용을 그대로 완성하거나, 사실과 다른 내용을 자신 있게 말한다.

지도 학습(SFT)으로 어느 정도 개선할 수 있지만, "어떤 응답이 더 좋은가?"를 레이블하는 것은 너무 주관적이고 비용이 많이 든다. 반면 "A와 B 중 어느 쪽이 더 좋은가?"처럼 **선호 비교**는 훨씬 쉽고 일관성 있게 수집할 수 있다.

RLHF는 이 비교 데이터로 보상 모델을 학습하고, 그 보상 신호로 LLM을 강화학습으로 최적화한다.

## RLHF 3단계 파이프라인

![RLHF 3단계 파이프라인](/assets/posts/rl-rlhf-deep-pipeline.svg)

**단계 1: 지도 미세조정 (SFT)**

사전학습 모델을 고품질 데모 데이터로 파인튜닝한다. 전문 주석자가 다양한 질문에 이상적인 응답을 작성한 데이터 수만 개를 사용한다. 이 SFT 모델이 RLHF의 시작점이자, KL 페널티 계산을 위한 기준점(reference model)이 된다.

**단계 2: 보상 모델 학습**

같은 프롬프트에 대한 두 응답 쌍 (y_w, y_l)을 인간이 비교·순위를 매긴 데이터로 보상 모델 r_φ를 학습한다.

Bradley-Terry 모델을 사용한다:

P(y_w ≻ y_l | x) = σ(r_φ(x, y_w) - r_φ(x, y_l))

손실 함수: L(φ) = -E[log σ(r_φ(x, y_w) - r_φ(x, y_l))]

보상 모델의 베이스는 보통 SFT 모델에서 시작하고, 마지막 레이어를 스칼라 출력 헤드로 교체한다.

```python
from transformers import AutoModelForSequenceClassification
import torch
import torch.nn.functional as F

class RewardModel(torch.nn.Module):
    """SFT 모델 + 스칼라 출력 헤드"""
    def __init__(self, base_model_name: str):
        super().__init__()
        # 분류 모델로 로드 (num_labels=1 → 스칼라)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            base_model_name, num_labels=1
        )

    def forward(self, input_ids, attention_mask):
        outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
        return outputs.logits.squeeze(-1)  # 보상 스칼라

def reward_model_loss(reward_model, chosen_ids, chosen_mask, rejected_ids, rejected_mask):
    """Bradley-Terry 손실"""
    r_chosen   = reward_model(chosen_ids, chosen_mask)
    r_rejected = reward_model(rejected_ids, rejected_mask)
    # 선호된 응답이 더 높은 보상을 받도록
    loss = -F.logsigmoid(r_chosen - r_rejected).mean()
    return loss
```

**단계 3: PPO로 RL 파인튜닝**

SFT 모델을 Actor로, 보상 모델 점수에서 KL 페널티를 뺀 것을 보상으로 PPO를 적용한다.

![RLHF 보상 계산 및 PPO 업데이트](/assets/posts/rl-rlhf-deep-code.svg)

```python
def rlhf_ppo_step(policy_model, ref_model, reward_model,
                  prompts: list[str], beta: float = 0.1):
    """RLHF PPO 업데이트 한 스텝 (개념적)"""
    all_rewards = []
    all_log_probs = []

    for prompt in prompts:
        # 현재 정책으로 응답 생성 (에피소드 수집)
        response_ids = policy_model.generate(
            prompt, max_new_tokens=256,
            do_sample=True, temperature=0.9
        )
        response_text = tokenizer.decode(response_ids[0])

        # 보상 모델 점수
        rm_score = reward_model(prompt + response_text).item()

        # KL 발산 계산 (토큰별 로그 확률 차이)
        with torch.no_grad():
            pol_log_probs = policy_model.log_probs(response_ids, prompt)
            ref_log_probs = ref_model.log_probs(response_ids, prompt)
        kl = (pol_log_probs - ref_log_probs).sum()

        # 최종 보상: 보상 모델 점수 - KL 패널티
        reward = rm_score - beta * kl
        all_rewards.append(reward)
        all_log_probs.append(pol_log_probs)

    # PPO 업데이트 (표준 PPO 알고리즘 적용)
    ppo_update(policy_model, all_log_probs, all_rewards)
```

## KL 페널티: 왜 필요한가

KL 페널티 항 -β·KL(π_θ || π_SFT)은 현재 정책이 기준 모델(SFT)에서 너무 멀어지는 것을 방지한다.

KL 페널티 없이 보상만 최대화하면 **보상 해킹(Reward Hacking)** 이 발생한다. 보상 모델이 완벽하지 않으므로, 정책이 보상 모델의 약점을 악용해 인간에게는 나쁘지만 보상 점수만 높은 응답을 생성한다. 예를 들어 "아주 좋습니다! 뛰어나십니다! 최고입니다!"처럼 과도한 아첨으로 보상을 올리는 식이다.

β를 크게 하면 SFT 모델에 가깝게 유지되지만 개선 폭이 작고, 작게 하면 보상 최대화에 집중하지만 해킹 위험이 크다. 보통 β=0.1~0.3을 사용하고, 학습 중 모니터링하며 조정한다.

## RLHF 구현 라이브러리

실제 RLHF를 직접 구현하는 것은 매우 복잡하다. 아래 오픈소스 라이브러리들이 대부분의 복잡성을 처리해준다.

```python
# TRL (Hugging Face): 가장 널리 사용되는 RLHF 라이브러리
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

model = AutoModelForCausalLMWithValueHead.from_pretrained("gpt2")
ref_model = AutoModelForCausalLMWithValueHead.from_pretrained("gpt2")

config = PPOConfig(
    model_name="gpt2",
    learning_rate=1.41e-5,
    batch_size=64,
    mini_batch_size=4,
    gradient_accumulation_steps=4,
    optimize_cuda_cache=True,
    target_kl=6.0,     # KL 목표 (adaptive beta 조절)
    ppo_epochs=4,
)

ppo_trainer = PPOTrainer(
    model=model,
    ref_model=ref_model,
    tokenizer=tokenizer,
    config=config,
)

# 학습 루프
for batch in dataset:
    queries = tokenizer(batch["prompt"], return_tensors="pt")
    responses = ppo_trainer.generate(queries)
    rewards = [reward_model(q, r) for q, r in zip(queries, responses)]
    stats = ppo_trainer.step(queries, responses, rewards)
```

## RLHF vs DPO

DPO(Direct Preference Optimization)는 RLHF의 복잡한 3단계를 단순화한다. 보상 모델을 별도로 학습하지 않고, 선호 데이터로 직접 LLM을 파인튜닝한다.

| 비교 항목 | RLHF | DPO |
|----------|------|-----|
| 학습 단계 | 3단계 (SFT→RM→PPO) | 2단계 (SFT→DPO) |
| 구현 복잡도 | 높음 | 낮음 |
| 컴퓨팅 비용 | 높음 | 낮음 |
| 보상 모델 필요 | 필요 | 불필요 |
| 탐험 다양성 | 높음 (온라인) | 낮음 (오프라인) |
| 적용 모델 | GPT-4, Claude | LLaMA 파인튜닝 등 |

```python
# DPO 손실 함수
def dpo_loss(policy_model, ref_model, chosen, rejected, beta=0.1):
    """Direct Preference Optimization 손실"""
    chosen_log_ratio  = policy_model.log_prob(chosen)  - ref_model.log_prob(chosen)
    rejected_log_ratio = policy_model.log_prob(rejected) - ref_model.log_prob(rejected)
    loss = -F.logsigmoid(beta * (chosen_log_ratio - rejected_log_ratio))
    return loss.mean()
```

DPO는 구현이 단순하고 안정적이어서 최근 오픈소스 모델 파인튜닝에 많이 사용된다. 그러나 온라인 탐험이 없어 보상 모델 커버리지 밖의 응답을 개선하기 어렵다.

## RLHF의 한계와 미래

**보상 모델 불완전성**: 인간의 모든 선호를 포착하기 어렵고, 주석자 간 의견 불일치가 존재한다.

**확장성**: 고품질 인간 선호 데이터 수집 비용이 크다. AI 피드백(RLAIF)으로 대체하려는 연구가 활발하다(Constitutional AI).

**분산 학습**: 수십억 파라미터 모델의 PPO는 수백~수천 GPU를 필요로 한다.

미래에는 AI가 AI를 평가하는 RLAIF, 더 효율적인 오프라인 방법(DPO, KTO, ORPO), 그리고 다중 보상 신호(도움됨 + 무해함 + 정직함)를 동시에 최적화하는 방법이 주류가 될 것이다.

## 마무리

RLHF는 사전학습 언어 모델이 인간의 가치와 선호에 맞게 동작하도록 하는 핵심 기술이다. SFT→보상 모델→PPO라는 3단계 파이프라인, Bradley-Terry 손실, KL 페널티를 통한 보상 해킹 방지가 핵심이다. 다음 글부터는 LLM 평가의 세계로 들어가 언어 모델을 어떻게 객관적으로 평가하는지 살펴본다.

---

**지난 글:** [액터-크리틱: 정책과 가치 함수의 시너지](/posts/rl-actor-critic/)

**다음 글:** [LLM 벤치마크 완전 정리: MMLU부터 HumanEval까지](/posts/eval-llm-benchmarks/)

<br>
읽어주셔서 감사합니다. 😊
