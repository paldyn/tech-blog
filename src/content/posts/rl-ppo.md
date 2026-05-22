---
title: "PPO: 안정적인 정책 최적화의 표준"
description: "PPO(Proximal Policy Optimization)의 클리핑 목적 함수, GAE 어드밴티지 추정, 엔트로피 보너스, Actor-Critic 아키텍처를 PyTorch로 완전 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["PPO", "강화학습", "ProximalPolicyOptimization", "클리핑", "GAE", "RLHF", "연속행동", "PyTorch"]
featured: false
draft: false
---

[지난 글](/posts/rl-policy-gradient/)에서 정책 경사법의 원리와 REINFORCE 알고리즘을 살펴보았다. REINFORCE는 구현이 단순하지만 그래디언트 추정의 분산이 너무 높고, 업데이트 크기를 제어하기 어려워 학습이 불안정하다. **PPO(Proximal Policy Optimization)** 는 2017년 OpenAI가 발표한 알고리즘으로, 이 문제를 단순한 클리핑(Clipping) 트릭으로 해결하면서도 탁월한 성능을 보여준다. ChatGPT의 RLHF 훈련, MuJoCo 로봇 제어, 게임 AI에서 모두 PPO가 사용될 만큼 현대 강화학습의 실질적인 표준이 되었다.

## PPO가 해결하는 문제

정책 경사법의 근본 문제는 **업데이트 크기 제어**다. 그래디언트를 따라 정책을 업데이트할 때, 학습률이 너무 크면 정책이 크게 바뀌어 이전보다 나빠지고, 너무 작으면 학습이 느리다. 정책 공간에서 "적당한 거리"만 이동하도록 보장하는 것이 핵심이다.

TRPO(Trust Region Policy Optimization)는 이를 KL 발산 제약으로 해결했지만 이차 미분이 필요해 구현이 복잡하고 연산 비용이 크다. PPO는 동일한 목적을 **클리핑**이라는 단순한 방법으로 달성한다.

## 확률 비율과 클리핑

PPO의 핵심은 **확률 비율(Probability Ratio)** rₜ(θ)다.

rₜ(θ) = π_θ(aₜ|sₜ) / π_θ_old(aₜ|sₜ)

이전 정책(θ_old)과 현재 정책(θ)이 같으면 r=1, 현재 정책이 더 해당 행동을 선호하면 r>1, 덜 선호하면 r<1이다.

**클리핑 목적 함수**:

L_CLIP(θ) = E[ min( rₜ(θ)·Âₜ, clip(rₜ(θ), 1-ε, 1+ε)·Âₜ ) ]

![PPO: 클리핑 목적 함수의 동작 원리](/assets/posts/rl-ppo-concept.svg)

`min`을 취하는 것이 핵심이다. 좋은 행동(Â>0)이라도 r이 1+ε을 넘으면 추가 보상이 없고, 나쁜 행동(Â<0)이라도 r이 1-ε 미만이면 추가 패널티가 없다. 이로써 정책 업데이트가 이전 정책에서 너무 멀어지지 않도록 자동으로 제한된다.

## GAE: 어드밴티지 추정

PPO는 단순한 리턴 G_t 대신 **GAE(Generalized Advantage Estimation)** 로 어드밴티지를 추정해 분산과 편향을 균형 있게 제어한다.

```python
def compute_gae(rewards: list, values: list, dones: list,
                gamma: float = 0.99, lam: float = 0.95) -> torch.Tensor:
    """
    GAE-λ: λ=0이면 TD(0) 어드밴티지, λ=1이면 Monte Carlo
    보통 λ=0.95로 편향-분산 균형점 설정
    """
    advantages = []
    gae = 0.0

    # 역방향으로 계산
    for t in reversed(range(len(rewards))):
        if t == len(rewards) - 1:
            next_value = 0.0  # 마지막 스텝
        else:
            next_value = values[t + 1]

        # TD 잔차 δ
        delta = rewards[t] + gamma * next_value * (1 - dones[t]) - values[t]
        # GAE: 지수 가중 평균
        gae = delta + gamma * lam * (1 - dones[t]) * gae
        advantages.insert(0, gae)

    return torch.tensor(advantages, dtype=torch.float32)
```

λ=0.95를 쓰면 단기 TD 추정(낮은 분산)과 장기 Monte Carlo 리턴(낮은 편향) 사이를 균형 있게 내삽한다.

## Actor-Critic 아키텍처

PPO는 정책 네트워크(Actor)와 가치 네트워크(Critic)를 함께 훈련한다.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

class PPOActorCritic(nn.Module):
    """공유 백본 + 정책 헤드 + 가치 헤드"""
    def __init__(self, obs_dim: int, act_dim: int):
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(obs_dim, 64), nn.Tanh(),
            nn.Linear(64, 64),      nn.Tanh(),
        )
        self.policy_head = nn.Linear(64, act_dim)   # Actor
        self.value_head  = nn.Linear(64, 1)          # Critic

    def get_action_and_value(self, x: torch.Tensor):
        features = self.shared(x)
        logits = self.policy_head(features)
        dist = Categorical(logits=logits)
        action = dist.sample()
        return action, dist.log_prob(action), dist.entropy(), self.value_head(features).squeeze(-1)

    def get_value(self, x: torch.Tensor) -> torch.Tensor:
        return self.value_head(self.shared(x)).squeeze(-1)
```

![PPO 클리핑 손실 구현 (PyTorch)](/assets/posts/rl-ppo-code.svg)

## 전체 PPO 훈련 루프

```python
import gymnasium as gym
import numpy as np

# 하이퍼파라미터
N_STEPS = 2048        # 롤아웃 길이
N_EPOCHS = 10         # 미니배치 반복 횟수
BATCH_SIZE = 64
CLIP_EPS = 0.2
GAMMA, LAM = 0.99, 0.95
LR = 3e-4

env = gym.make("CartPole-v1")
agent = PPOActorCritic(env.observation_space.shape[0], env.action_space.n)
optimizer = torch.optim.Adam(agent.parameters(), lr=LR)

def collect_rollout():
    """N_STEPS 동안 경험 수집"""
    states, actions, log_probs, rewards, dones, values = [], [], [], [], [], []
    state, _ = env.reset()

    for _ in range(N_STEPS):
        s = torch.FloatTensor(state).unsqueeze(0)
        with torch.no_grad():
            action, log_prob, _, value = agent.get_action_and_value(s)

        next_state, reward, done, truncated, _ = env.step(action.item())

        states.append(state)
        actions.append(action.item())
        log_probs.append(log_prob.item())
        rewards.append(reward)
        dones.append(float(done or truncated))
        values.append(value.item())

        state = next_state if not (done or truncated) else env.reset()[0]

    return states, actions, log_probs, rewards, dones, values

def ppo_update(states, actions, old_log_probs, advantages, returns):
    """PPO 미니배치 업데이트"""
    s = torch.FloatTensor(np.array(states))
    a = torch.LongTensor(actions)
    olp = torch.FloatTensor(old_log_probs)
    adv = torch.FloatTensor(advantages)
    ret = torch.FloatTensor(returns)
    adv = (adv - adv.mean()) / (adv.std() + 1e-8)

    for _ in range(N_EPOCHS):
        idx = np.random.permutation(len(s))
        for start in range(0, len(s), BATCH_SIZE):
            b = idx[start:start + BATCH_SIZE]
            _, new_lp, entropy, values = agent.get_action_and_value(s[b])
            new_lp = new_lp  # 실제로는 a[b]에 대한 log_prob
            ratio = torch.exp(new_lp - olp[b])
            surr1 = ratio * adv[b]
            surr2 = torch.clamp(ratio, 1 - CLIP_EPS, 1 + CLIP_EPS) * adv[b]
            policy_loss = -torch.min(surr1, surr2).mean()
            value_loss  = F.mse_loss(values, ret[b])
            loss = policy_loss + 0.5 * value_loss - 0.01 * entropy.mean()
            optimizer.zero_grad(); loss.backward(); optimizer.step()

# 메인 루프
for iteration in range(100):
    rollout = collect_rollout()
    states, actions, log_probs, rewards, dones, vals = rollout
    advantages = compute_gae(rewards, vals, dones, GAMMA, LAM)
    returns = [a + v for a, v in zip(advantages.tolist(), vals)]
    ppo_update(states, actions, log_probs, advantages.tolist(), returns)
    print(f"이터레이션 {iteration+1}: 평균 보상={np.mean(rewards):.2f}")
```

## PPO 하이퍼파라미터 가이드

| 파라미터 | 권장값 | 설명 |
|---------|--------|------|
| clip_eps | 0.1~0.3 | 크면 불안정, 작으면 느림 |
| gae_lambda | 0.9~0.97 | λ가 클수록 분산 증가 |
| n_epochs | 4~20 | 미니배치 재사용 횟수 |
| entropy_coef | 0.01~0.05 | 탐험 장려 |
| value_loss_coef | 0.5~1.0 | Critic 학습 강도 |
| max_grad_norm | 0.5 | 그래디언트 클리핑 |

## PPO와 RLHF

ChatGPT를 훈련시킨 RLHF(Reinforcement Learning from Human Feedback)의 RL 단계에서 PPO가 사용된다. LLM을 Actor로, 보상 모델의 출력을 환경 보상으로 취급하며, KL 페널티를 추가해 기본 언어 모델에서 너무 멀어지지 않도록 제한한다.

```python
# RLHF PPO 손실 (단순화)
kl_penalty = torch.distributions.kl_divergence(
    new_policy_dist, ref_policy_dist
).sum(-1).mean()

total_reward = reward_model_score - kl_coef * kl_penalty
# 이후 표준 PPO 업데이트 적용
```

이 KL 페널티가 PPO 클리핑과 같은 역할을 한다. 언어 모델이 사람처럼 말하는 성질을 잃지 않으면서도 인간 선호에 맞게 개선되도록 유도한다.

## 마무리

PPO는 클리핑이라는 단순한 트릭으로 정책 업데이트를 보수적으로 제한하면서도 탁월한 성능을 달성한다. GAE로 어드밴티지 추정의 분산-편향을 균형 있게 조절하고, Actor-Critic 아키텍처로 가치 함수도 함께 학습한다. 다음 글에서는 PPO의 기반이 되는 Actor-Critic 방법론을 더 깊이 탐구한다.

---

**지난 글:** [정책 경사법: 정책을 직접 최적화하기](/posts/rl-policy-gradient/)

**다음 글:** [액터-크리틱: 정책과 가치 함수의 시너지](/posts/rl-actor-critic/)

<br>
읽어주셔서 감사합니다. 😊
