---
title: "정책 경사법: 정책을 직접 최적화하기"
description: "정책 경사 정리(Policy Gradient Theorem), REINFORCE 알고리즘, 기준선(baseline)을 이용한 분산 감소를 완전히 이해하고 PyTorch로 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["정책경사법", "PolicyGradient", "REINFORCE", "강화학습", "기준선", "분산감소", "확률적정책", "PyTorch"]
featured: false
draft: false
---

[지난 글](/posts/rl-dqn/)에서 DQN이 Q-테이블의 한계를 신경망으로 극복한 방법을 살펴보았다. 그런데 DQN은 여전히 이산 행동 공간에만 동작한다. 로봇 팔 관절을 몇 도 회전할지, 자동차 핸들을 얼마나 돌릴지 같은 **연속적인 행동**은 어떻게 학습할까? **정책 경사법(Policy Gradient)** 은 정책 자체를 신경망으로 파라미터화하고 직접 최적화하는 방법으로, 연속 행동 공간을 자연스럽게 처리하며 LLM의 RLHF 훈련에도 핵심적으로 사용된다.

## 가치 기반 vs 정책 기반

![정책 경사법 vs 가치 기반: 핵심 차이](/assets/posts/rl-policy-gradient-concept.svg)

가치 기반(Q-Learning, DQN)은 최적 가치 함수 Q*(s, a)를 학습한 뒤 암묵적으로 정책을 유도한다. π(s) = argmax_a Q(s, a). 반면 정책 기반은 정책 π_θ(a|s)를 신경망으로 직접 표현하고, 기대 누적 보상 J(θ) = E_π[G_t]를 최대화하는 방향으로 θ를 업데이트한다.

정책 기반의 핵심 장점은 세 가지다.

**연속 행동 지원**: 출력층을 가우시안 분포 N(μ, σ)로 정의하면 연속 행동을 자연스럽게 샘플링할 수 있다. `action = μ(s) + σ(s) * ε, ε ~ N(0,1)`.

**확률적 정책**: 바위-가위-보는 순수 전략(deterministic)으로는 최적 해가 없고 확률적 전략이 필요하다. 포커의 블러핑처럼 예측 불가능성이 전략적으로 중요한 경우가 있다.

**수렴 보장**: 가치 함수 근사는 발산할 수 있지만, 정책 경사는 로컬 옵티마로의 수렴이 이론적으로 보장된다.

## 정책 경사 정리

목표 함수: J(θ) = E_π[G_t]를 최대화하는 그래디언트는?

직접 미분하기 어렵지만, 정책 경사 정리가 편리한 형태를 제공한다.

**∇_θ J(θ) = E_π [∇_θ log π_θ(a|s) · G_t]**

핵심 아이디어: `∇_θ log π_θ(a|s) · G_t`를 에피소드 샘플에서 평균 내면 된다. 기대값을 구할 필요 없이 샘플 평균으로 추정할 수 있다.

직관적으로 이해하면: G_t가 크면(좋은 에피소드) 해당 행동의 확률을 높이고, G_t가 작으면(나쁜 에피소드) 해당 행동의 확률을 낮춘다.

## REINFORCE 완전 구현

```python
import gymnasium as gym
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.distributions import Categorical
import numpy as np

class PolicyNetwork(nn.Module):
    def __init__(self, obs_dim: int, act_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, 128), nn.ReLU(),
            nn.Linear(128, 128),     nn.ReLU(),
            nn.Linear(128, act_dim)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return F.softmax(self.net(x), dim=-1)  # 행동 확률 분포

def compute_returns(rewards: list, gamma: float = 0.99) -> torch.Tensor:
    """역방향으로 누적 리턴 계산"""
    G = 0.0
    returns = []
    for r in reversed(rewards):
        G = r + gamma * G
        returns.insert(0, G)
    returns = torch.tensor(returns, dtype=torch.float32)
    # 기준선(baseline): 평균 빼기 → 분산 감소
    returns = (returns - returns.mean()) / (returns.std() + 1e-8)
    return returns

def run_episode(env, policy: PolicyNetwork):
    """에피소드 실행: 로그 확률, 보상 수집"""
    state, _ = env.reset()
    log_probs, rewards = [], []

    while True:
        s = torch.FloatTensor(state).unsqueeze(0)
        probs = policy(s)
        dist = Categorical(probs)
        action = dist.sample()

        log_probs.append(dist.log_prob(action))

        next_state, reward, done, truncated, _ = env.step(action.item())
        rewards.append(reward)
        state = next_state

        if done or truncated:
            break

    return log_probs, rewards
```

![REINFORCE 알고리즘 구현](/assets/posts/rl-policy-gradient-code.svg)

```python
# 메인 훈련 루프
env = gym.make("CartPole-v1")
obs_dim = env.observation_space.shape[0]
act_dim = env.action_space.n

policy = PolicyNetwork(obs_dim, act_dim)
optimizer = optim.Adam(policy.parameters(), lr=1e-3)

rewards_history = []

for episode in range(1000):
    log_probs, rewards = run_episode(env, policy)
    total_reward = sum(rewards)
    rewards_history.append(total_reward)

    # REINFORCE 손실 계산 및 역전파
    returns = compute_returns(rewards)
    log_probs_tensor = torch.stack(log_probs)

    # 손실 = -E[log π(a|s) · G_t] (음수: 최대화 → 최소화)
    loss = -(log_probs_tensor * returns).mean()

    optimizer.zero_grad()
    loss.backward()
    nn.utils.clip_grad_norm_(policy.parameters(), max_norm=0.5)
    optimizer.step()

    if (episode + 1) % 100 == 0:
        avg = np.mean(rewards_history[-100:])
        print(f"에피소드 {episode+1}: 평균 보상={avg:.1f}")

# 출력:
# 에피소드 100: 평균 보상=47.3
# 에피소드 300: 평균 보상=189.6
# 에피소드 500: 평균 보상=412.8
# 에피소드 700: 평균 보상=487.2
# 에피소드 900: 평균 보상=498.5
```

## 연속 행동 공간 처리

CartPole은 이산 행동이지만, 연속 행동(예: MuJoCo 로봇 제어)에서는 가우시안 정책을 사용한다.

```python
class GaussianPolicyNetwork(nn.Module):
    """연속 행동을 위한 가우시안 정책"""
    def __init__(self, obs_dim: int, act_dim: int):
        super().__init__()
        self.shared = nn.Sequential(
            nn.Linear(obs_dim, 256), nn.Tanh(),
            nn.Linear(256, 256),     nn.Tanh(),
        )
        self.mean_head = nn.Linear(256, act_dim)
        # 로그 표준편차: 학습 가능한 파라미터
        self.log_std = nn.Parameter(torch.zeros(act_dim))

    def forward(self, x: torch.Tensor):
        from torch.distributions import Normal
        features = self.shared(x)
        mean = self.mean_head(features)
        std = self.log_std.exp()
        dist = Normal(mean, std)
        action = dist.rsample()  # reparameterization trick
        log_prob = dist.log_prob(action).sum(-1)
        return action, log_prob
```

`rsample()`은 reparameterization trick을 사용해 샘플링을 미분 가능하게 만든다. 이는 SAC(Soft Actor-Critic) 같은 고급 알고리즘의 기반이 된다.

## REINFORCE의 문제: 높은 분산

REINFORCE의 가장 큰 단점은 **그래디언트 추정의 분산이 매우 높다**는 것이다. 같은 행동도 에피소드마다 G_t가 크게 달라 학습 신호가 불안정하다.

**기준선(Baseline)** 을 빼면 분산을 줄일 수 있다.

∇_θ J(θ) ≈ Σ_t ∇_θ log π_θ(aₜ|sₜ) · (G_t - b)

기준선 b로 상태 가치 함수 V(s)를 사용하면 (G_t - V(s))가 **어드밴티지(Advantage)** 가 된다. "이 행동이 평균보다 얼마나 좋은가?" 이것이 다음 글에서 다룰 액터-크리틱 방법의 핵심 아이디어다.

| 방법 | 분산 | 편향 | 특징 |
|------|------|------|------|
| Monte Carlo (REINFORCE) | 높음 | 없음 | 에피소드 끝나야 업데이트 |
| 기준선 사용 | 낮음 | 없음 | V(s) 별도 학습 필요 |
| TD(0) | 매우 낮음 | 있음 | 매 스텝 업데이트 가능 |
| GAE | 조절 가능 | 조절 가능 | λ로 편향-분산 균형 |

## REINFORCE와 RLHF의 연결

LLM의 RLHF(Reinforcement Learning from Human Feedback) 훈련은 REINFORCE의 아이디어를 직접 사용한다. 언어 모델의 파라미터가 θ, 출력 토큰이 행동, 인간 선호 점수가 보상이다.

```python
# RLHF 개념적 코드 (단순화)
for prompt in prompts:
    response = lm.generate(prompt)          # 에피소드 수집
    reward = reward_model(prompt, response) # 인간 선호 점수

    # REINFORCE-류 업데이트
    log_prob = lm.log_prob(response | prompt)
    loss = -(log_prob * reward).mean()
    loss.backward()
```

실제 RLHF는 PPO를 사용하고 KL 페널티를 추가하지만, 핵심 아이디어는 동일하다.

## 마무리

정책 경사법은 정책 자체를 신경망으로 파라미터화하고 정책 경사 정리를 통해 직접 최적화한다. REINFORCE는 구현이 단순하지만 높은 분산이 문제다. 다음 글에서는 이 분산 문제를 클리핑과 다양한 안정화 기법으로 해결한 PPO를 살펴본다.

---

**지난 글:** [DQN: 딥러닝으로 확장하는 Q-러닝](/posts/rl-dqn/)

**다음 글:** [PPO: 안정적인 정책 최적화의 표준](/posts/rl-ppo/)

<br>
읽어주셔서 감사합니다. 😊
