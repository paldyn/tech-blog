---
title: "AI 정렬: 인간의 가치와 AI 목표를 일치시키기"
description: "보상 해킹부터 목표 오해석까지 AI 비정렬의 근본 원인을 짚고, RLHF·Constitutional AI·DPO 세 가지 핵심 정렬 기법을 코드와 함께 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["AI정렬", "RLHF", "DPO", "Constitutional AI", "AI안전성", "보상해킹", "인간피드백"]
featured: false
draft: false
---

[지난 글](/posts/ai-safety-overview/)에서 AI 안전성의 전체 지형을 살펴봤다면, 이번에는 그 핵심 축인 **AI 정렬(AI Alignment)**을 깊이 파고든다. 정렬이란 AI 시스템의 목표·가치·행동이 인간이 의도한 바와 얼마나 일치하는가의 문제다.

## 정렬 문제가 왜 어려운가

인간의 가치는 복잡하고 맥락 의존적이다. "도움이 되는 AI"를 만들려면 도움의 의미를 AI에게 수치로 가르쳐야 하는데, 그 수치가 조금만 어긋나도 예상치 못한 방향으로 최적화된다. 이 현상이 **비정렬(Misalignment)**이다.

비정렬에는 크게 세 가지 유형이 있다.

- **보상 해킹(Reward Hacking)**: 측정 가능한 지표를 왜곡해 최대화. 예를 들어 클릭률을 최적화하도록 학습된 추천 시스템이 낚시성 콘텐츠를 노출하는 경우
- **명세 게임(Specification Gaming)**: 규칙의 문자적 의미는 지키되 의도를 어기는 행동. 청소 로봇이 카메라를 가려 "오류 미감지"로 태스크를 완료하는 사례가 유명하다
- **분배 이동(Distributional Shift)**: 학습 환경에서 최적이었던 정책이 실제 환경에서 실패

![AI 정렬 스펙트럼](/assets/posts/ai-alignment-spectrum.svg)

## RLHF: 인간 피드백 강화학습

**RLHF(Reinforcement Learning from Human Feedback)**는 현재 GPT-4, Claude 등 주요 LLM이 채택한 표준 정렬 기법이다.

```python
# RLHF 3단계 개요
# 1단계: Supervised Fine-Tuning (SFT)
sft_model = train(base_model, demonstration_data)

# 2단계: Reward Model 학습
# 인간이 두 응답 중 더 나은 쪽을 선택
reward_model = train_reward_model(
    comparison_pairs  # [(prompt, chosen, rejected), ...]
)

# 3단계: PPO로 정책 최적화
ppo_model = ppo_train(
    policy=sft_model,
    reward_fn=reward_model,
    kl_penalty=0.02  # 원본 모델에서 너무 멀어지지 않도록
)
```

PPO 과정에서 KL 페널티가 핵심이다. 보상 모델 점수만 높이다 보면 모델이 "보상 해킹"을 일으켜 인간의 선호를 조작하는 방향으로 학습된다. KL divergence를 제한해 원본 SFT 모델 근방에서만 최적화하게 한다.

### RLHF의 한계

인간 라벨러의 편향이 직접 모델에 전파된다. 또한 PPO 학습 자체가 불안정해 하이퍼파라미터 튜닝이 어렵고, 비교 데이터 수집 비용이 매우 높다.

## Constitutional AI: 원칙 기반 정렬

Anthropic이 개발한 **Constitutional AI(CAI)**는 명시적인 원칙 목록('헌법')으로 RLHF의 인간 라벨링 부담을 줄인다.

```python
constitution = [
    "응답이 위험·불법·비윤리적이면 거부하라",
    "개인을 비하하거나 차별하지 말라",
    "의학·법률 조언 시 전문가 상담을 권고하라",
    # ... 16가지 원칙
]

# 1단계: 모델이 헌법 기준으로 자체 응답 비판
def critique_and_revise(prompt, response, constitution):
    critique = model.critique(response, rules=constitution)
    revised = model.revise(response, critique)
    return revised

# 2단계: RLAIF — AI 피드백으로 보상 모델 학습
ai_feedback = model.rank_responses(pairs, constitution)
reward_model = train(ai_feedback)
```

인간 라벨러 없이 AI가 자체적으로 원칙을 적용해 응답을 개선하고, 그 AI 피드백(RLAIF)으로 보상 모델을 학습한다. Claude 시리즈가 이 방법론으로 훈련되었다.

## DPO: 단순하고 안정적인 직접 선호 최적화

**DPO(Direct Preference Optimization)**는 보상 모델 없이 선호 데이터로 직접 정책을 학습한다.

```python
import torch
import torch.nn.functional as F

def dpo_loss(policy, ref_policy, prompt, chosen, rejected, beta=0.1):
    # 선택된 응답과 거부된 응답의 로그 확률
    log_prob_chosen = policy.log_prob(prompt, chosen)
    log_prob_rejected = policy.log_prob(prompt, rejected)

    # 참조 모델 대비 상대적 차이
    ref_chosen = ref_policy.log_prob(prompt, chosen)
    ref_rejected = ref_policy.log_prob(prompt, rejected)

    # DPO 손실: chosen이 rejected보다 높도록
    logits = beta * (
        (log_prob_chosen - ref_chosen) -
        (log_prob_rejected - ref_rejected)
    )
    return -F.logsigmoid(logits).mean()
```

수식이 RLHF의 최적 정책 해를 closed-form으로 유도해 PPO 없이도 같은 효과를 낸다. 학습이 단순하고 안정적이어서 소규모 연구팀도 적용할 수 있다.

![AI 정렬 방법론 비교](/assets/posts/ai-alignment-methods.svg)

## 세 방법론 비교

| 방법 | 보상 모델 | 인간 라벨 | 학습 안정성 | 주요 사용처 |
|------|-----------|-----------|-------------|-------------|
| RLHF | 필요 | 대규모 | 낮음(PPO) | GPT-4, Llama 2 |
| CAI/RLAIF | 필요 | 소규모 | 중간 | Claude |
| DPO | 불필요 | 필요 | 높음 | Zephyr, Mistral |

## 정렬의 미해결 문제들

**확장성 문제**: 인간 감독자의 능력을 훨씬 초과하는 초지능 AI에게 RLHF 피드백이 유효할까? Scalable Oversight 연구는 AI를 이용해 AI를 감독하는 방법을 모색한다.

**가치 다원성**: 문화·개인에 따라 가치가 다르다. 어떤 가치를 "정렬"의 기준으로 삼을지 자체가 정치적·윤리적 문제다.

**내부 표현 불투명성**: 모델이 "안전한 응답"을 실제로 내면화했는지, 아니면 표면적으로만 따르는지 구분하기 어렵다. 이것이 해석 가능성(XAI) 연구와 정렬이 교차하는 지점이다.

현재의 정렬 기술은 완벽하지 않지만, 이 분야의 발전 속도는 매우 빠르다. DPO 이후 IPO, KTO, ORPO 등 더 효율적인 변형들이 계속 등장하고 있다.

---

**지난 글:** [AI 안전성 개요: 신뢰할 수 있는 AI를 만들기 위한 기반](/posts/ai-safety-overview/)

**다음 글:** [AI 편향과 공정성: 알고리즘 차별을 막는 방법](/posts/ai-bias-fairness/)

<br>
읽어주셔서 감사합니다. 😊
