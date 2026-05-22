---
title: "액터-크리틱: 정책과 가치 함수의 시너지"
description: "Actor-Critic 방법의 원리, 어드밴티지 함수, A2C/A3C 알고리즘을 이해하고 공유 백본 아키텍처로 직접 구현합니다. PPO와 SAC의 공통 기반을 완전히 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["ActorCritic", "A2C", "A3C", "어드밴티지함수", "강화학습", "가치함수", "정책경사", "PyTorch"]
featured: false
draft: false
---

[지난 글](/posts/rl-ppo/)에서 PPO가 클리핑 목적 함수로 정책 업데이트를 안정화하는 방법을 살펴보았다. PPO 코드를 보면 Actor(정책)와 Critic(가치 함수) 두 구성 요소가 공존한다. 이번 글에서는 이 **액터-크리틱(Actor-Critic)** 구조가 왜 필요한지, 어드밴티지 함수가 어떻게 학습을 개선하는지, A2C와 A3C가 어떻게 다른지를 깊이 탐구한다. 액터-크리틱은 현대 강화학습의 대부분(PPO, SAC, DDPG, TD3)이 공유하는 핵심 구조다.

## 가치 기반 + 정책 기반 = 액터-크리틱

순수 정책 기반(REINFORCE)은 전체 에피소드의 리턴 G_t를 사용하기 때문에 분산이 높다. 같은 행동이라도 이후 에피소드 전개에 따라 G_t가 크게 달라진다.

분산을 줄이려면 어드밴티지 함수 Â(s, a)를 써야 한다.

**Â(s, a) = Q(s, a) - V(s)**

Q(s, a)는 상태 s에서 행동 a를 선택했을 때의 기대 리턴, V(s)는 상태 s의 평균 기대 리턴이다. Â는 "평균보다 얼마나 좋은 행동인가?"를 나타낸다. Â>0이면 평균보다 좋은 행동, Â<0이면 나쁜 행동이다.

가장 단순한 어드밴티지 추정은 **TD 오류**다.

**Â(sₜ, aₜ) ≈ rₜ + γ·V(sₜ₊₁) - V(sₜ)**

V(s)를 학습하는 네트워크가 **Critic**, 이 어드밴티지를 사용해 정책을 업데이트하는 네트워크가 **Actor**다.

![액터-크리틱 아키텍처](/assets/posts/rl-actor-critic-architecture.svg)

## 공유 백본 아키텍처

실제로는 Actor와 Critic이 파라미터의 앞부분(특성 추출기)을 공유하고, 마지막 레이어만 분리한다.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

class ActorCriticNet(nn.Module):
    """공유 백본 + Actor 헤드 + Critic 헤드"""
    def __init__(self, obs_dim: int, act_dim: int, hidden: int = 64):
        super().__init__()
        # 공유 특성 추출기
        self.backbone = nn.Sequential(
            nn.Linear(obs_dim, hidden), nn.Tanh(),
            nn.Linear(hidden, hidden),  nn.Tanh(),
        )
        # Actor: 행동 확률 분포 출력
        self.policy_head = nn.Linear(hidden, act_dim)
        # Critic: 상태 가치 스칼라 출력
        self.value_head  = nn.Linear(hidden, 1)

        # 정책/가치 헤드 가중치 초기화 (스케일 차이 보정)
        nn.init.orthogonal_(self.policy_head.weight, gain=0.01)
        nn.init.orthogonal_(self.value_head.weight,  gain=1.0)

    def forward(self, x: torch.Tensor):
        features = self.backbone(x)
        logits = self.policy_head(features)
        value  = self.value_head(features).squeeze(-1)
        return logits, value

    def act(self, state: torch.Tensor):
        """행동 선택 + 로그 확률 + 가치 추정"""
        logits, value = self(state)
        dist = Categorical(logits=logits)
        action = dist.sample()
        return action, dist.log_prob(action), dist.entropy(), value
```

## A2C: Advantage Actor-Critic

A2C는 동기식(synchronous) Actor-Critic이다. N개의 병렬 환경에서 동시에 데이터를 수집하고 한 번에 업데이트한다.

![A2C 핵심 구현: Actor-Critic 손실](/assets/posts/rl-actor-critic-code.svg)

```python
import gymnasium as gym
import numpy as np
from torch.optim import Adam

def a2c_train():
    # N개 병렬 환경
    N_ENVS = 8
    envs = gym.vector.make("CartPole-v1", num_envs=N_ENVS)
    obs_dim = envs.single_observation_space.shape[0]
    act_dim = envs.single_action_space.n

    net = ActorCriticNet(obs_dim, act_dim)
    optimizer = Adam(net.parameters(), lr=7e-4)

    states, _ = envs.reset()
    episode_rewards = np.zeros(N_ENVS)
    all_rewards = []

    for update in range(2000):
        # 롤아웃 수집 (T=5 스텝)
        T = 5
        batch_states, batch_actions, batch_rewards = [], [], []
        batch_log_probs, batch_values, batch_dones = [], [], []

        for _ in range(T):
            s_tensor = torch.FloatTensor(states)
            with torch.no_grad():
                action, log_prob, _, value = net.act(s_tensor)

            next_states, rewards, dones, truncs, _ = envs.step(action.numpy())

            batch_states.append(states.copy())
            batch_actions.append(action.numpy())
            batch_rewards.append(rewards)
            batch_log_probs.append(log_prob)
            batch_values.append(value)
            batch_dones.append(dones | truncs)

            episode_rewards += rewards
            for i, done in enumerate(dones | truncs):
                if done:
                    all_rewards.append(episode_rewards[i])
                    episode_rewards[i] = 0

            states = next_states

        # 리턴 계산 (부트스트랩)
        with torch.no_grad():
            _, last_value = net(torch.FloatTensor(states))

        returns = []
        G = last_value.numpy()
        for t in reversed(range(T)):
            G = batch_rewards[t] + 0.99 * G * (1 - batch_dones[t])
            returns.insert(0, G)

        returns = torch.FloatTensor(np.array(returns)).view(-1)
        values  = torch.stack(batch_values).view(-1)
        log_probs = torch.stack(batch_log_probs).view(-1)

        # 어드밴티지
        advantages = (returns - values.detach())
        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

        # 손실 계산
        actor_loss  = -(log_probs * advantages).mean()
        critic_loss = F.mse_loss(values, returns)
        # 정책 헤드 재계산으로 엔트로피 얻기
        s_all = torch.FloatTensor(np.concatenate(batch_states))
        a_all = torch.LongTensor(np.concatenate(batch_actions))
        logits_all, _ = net(s_all)
        dist_all = Categorical(logits=logits_all)
        entropy = dist_all.entropy().mean()

        loss = actor_loss + 0.5 * critic_loss - 0.01 * entropy

        optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(net.parameters(), 0.5)
        optimizer.step()

        if (update + 1) % 200 == 0 and all_rewards:
            print(f"업데이트 {update+1}: 최근 평균={np.mean(all_rewards[-100:]):.1f}")
```

## A3C: 비동기식 액터-크리틱

A3C(Asynchronous Advantage Actor-Critic)는 여러 워커가 각자의 환경에서 비동기적으로 경험을 수집하고 글로벌 네트워크를 업데이트한다.

```python
# A3C 개념적 구조 (threading 기반)
import threading

global_net = ActorCriticNet(obs_dim, act_dim)
global_optimizer = Adam(global_net.parameters(), lr=1e-4)

def worker_thread(worker_id: int):
    local_net = ActorCriticNet(obs_dim, act_dim)
    env = gym.make("CartPole-v1")

    for episode in range(1000):
        # 글로벌 파라미터 복사
        local_net.load_state_dict(global_net.state_dict())

        # 로컬 롤아웃
        states, actions, rewards = run_local_episode(local_net, env)

        # 그래디언트 계산
        loss = compute_a3c_loss(local_net, states, actions, rewards)
        loss.backward()

        # 글로벌 네트워크 업데이트 (스레드 안전하게)
        with threading.Lock():
            for gp, lp in zip(global_net.parameters(), local_net.parameters()):
                gp.grad = lp.grad
            global_optimizer.step()
            global_optimizer.zero_grad()

# 워커 스레드 시작
workers = [threading.Thread(target=worker_thread, args=(i,)) for i in range(8)]
for w in workers:
    w.start()
for w in workers:
    w.join()
```

A3C는 비동기 업데이트로 탐험 다양성을 높이지만, GPU 활용이 어렵고 구현이 복잡하다. 현실에서는 더 단순하고 GPU 친화적인 A2C나 PPO를 선호한다.

## 어드밴티지 함수 비교

| 방법 | 어드밴티지 추정 | 분산 | 편향 |
|------|----------------|------|------|
| REINFORCE | G_t | 높음 | 없음 |
| A2C TD(0) | r + γV(s') - V(s) | 낮음 | 있음 |
| A2C n-step | Σ γᵏrₜ₊ₖ + γⁿV(sₙ) - V(s) | 중간 | 중간 |
| GAE (PPO) | Σ (γλ)ᵏ δₜ₊ₖ | 조절 | 조절 |

GAE(λ=0)는 TD(0)와 동일하고, GAE(λ=1)는 Monte Carlo와 동일하다. λ로 분산-편향 트레이드오프를 연속적으로 조절할 수 있다.

## SAC: 최고 성능의 Actor-Critic

현재 연속 행동 공간에서 최고 성능을 보이는 알고리즘은 **SAC(Soft Actor-Critic)** 다. SAC는 엔트로피를 보상에 직접 추가해 최대 엔트로피 강화학습을 달성한다.

```python
# SAC 보상 (단순화): r + α * H(π(·|s))
# 엔트로피 H가 높을수록 (정책이 다양할수록) 보상 추가
# 결과: 탐험과 활용을 자동으로 균형

# 오프-정책 학습: 경험 재생 버퍼 사용
# 2개의 Q-함수 (Double Q trick): min(Q1, Q2)로 Q값 과대추정 방지
# 자동 엔트로피 조절 (target entropy 자동 튜닝)
```

SAC는 오프-정책이므로 샘플 효율도 뛰어나고, 자동 엔트로피 조절로 하이퍼파라미터 튜닝도 적다. MuJoCo 같은 연속 행동 벤치마크의 표준 알고리즘이다.

## 마무리

액터-크리틱은 정책 경사법(분산 큰 학습 신호)의 문제를 가치 함수(Critic)로 베이스라인을 제공하여 해결한다. 어드밴티지 함수 Â = Q - V는 "평균보다 얼마나 좋은가?"를 측정해 안정적인 학습 신호를 만든다. A2C, PPO, SAC 모두 이 구조를 공유한다. 다음 글에서는 LLM 훈련의 핵심인 RLHF를 심층 탐구한다.

---

**지난 글:** [PPO: 안정적인 정책 최적화의 표준](/posts/rl-ppo/)

**다음 글:** [RLHF 심화: 인간 피드백으로 LLM 정렬하기](/posts/rl-rlhf-deep/)

<br>
읽어주셔서 감사합니다. 😊
