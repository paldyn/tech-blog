---
title: "DQN: 딥러닝으로 확장하는 Q-러닝"
description: "DeepMind의 DQN이 Q-테이블의 한계를 어떻게 극복했는지, 경험 재생과 타겟 네트워크라는 두 핵심 혁신을 PyTorch로 완전 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["DQN", "DeepQLearning", "강화학습", "경험재생", "타겟네트워크", "PyTorch", "Atari", "딥러닝"]
featured: false
draft: false
---

[지난 글](/posts/rl-q-learning/)에서 Q-러닝이 Bellman 방정식을 이용해 Q-테이블을 학습하는 방법과 그 한계를 살펴보았다. Q-테이블은 상태 공간이 작을 때만 동작하고, Atari 게임처럼 픽셀 화면이 상태인 경우에는 완전히 무용지물이다. 2013년 DeepMind는 이 문제를 정면으로 돌파한 논문 "Playing Atari with Deep Reinforcement Learning"을 발표했다. **DQN(Deep Q-Network)** 은 단 두 가지 아이디어로 Q-러닝을 딥러닝과 결합해 26개의 Atari 게임에서 인간 수준의 성능을 달성했다. 이 두 아이디어가 현대 RL의 기반이 되었다.

## DQN의 핵심 아이디어

Q-테이블 대신 **신경망**으로 Q-함수를 근사한다. 입력은 게임 화면(픽셀 상태), 출력은 각 행동의 Q값이다.

```
Q-테이블: Q[s_idx][a_idx] → 테이블 룩업
DQN 신경망: Q(s; θ) = network(s) → 모든 행동의 Q값 동시 출력
```

하지만 단순히 신경망을 쓰면 학습이 불안정해진다. Q-러닝을 신경망에 직접 적용하면 두 가지 문제가 발생한다.

**문제 1: 데이터 상관성**. RL 에이전트는 순서대로 경험을 수집한다. s₀→s₁→s₂ 연속된 상태들은 강하게 상관되어 있다. 상관된 데이터로 미니배치 학습을 하면 신경망이 오버피팅되고 발산한다.

**문제 2: 이동하는 타겟**. Q-러닝 업데이트 목표(TD 타겟)는 `r + γ·max Q(s', a'; θ)`인데, θ가 업데이트될 때마다 타겟도 변한다. 타겟이 움직이면 학습이 진동하거나 발산한다.

DQN은 이 두 문제를 **경험 재생**과 **타겟 네트워크**로 해결한다.

![DQN 아키텍처: 두 신경망 + 경험 재생](/assets/posts/rl-dqn-architecture.svg)

## 혁신 1: 경험 재생 (Experience Replay)

에이전트가 경험한 전이 (s, a, r, s', done)을 즉시 학습에 쓰지 않고 **재생 버퍼(Replay Buffer)** 에 저장한다. 학습할 때는 버퍼에서 **무작위로** 미니배치를 샘플링한다.

```python
from collections import deque
import random
import numpy as np

class ReplayBuffer:
    def __init__(self, capacity: int = 100_000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size: int = 32):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        return (np.array(states, dtype=np.float32),
                np.array(actions),
                np.array(rewards, dtype=np.float32),
                np.array(next_states, dtype=np.float32),
                np.array(dones, dtype=np.float32))

    def __len__(self):
        return len(self.buffer)
```

무작위 샘플링의 효과는 두 가지다. 첫째, 연속된 데이터의 시간적 상관성을 제거해 독립적인 미니배치를 만든다. 둘째, 같은 경험을 여러 번 재사용해 데이터 효율성을 높인다.

## 혁신 2: 타겟 네트워크 (Target Network)

파라미터가 동일한 네트워크로 TD 타겟을 계산하면 타겟이 계속 변해 불안정해진다. DQN은 **타겟 계산에 별도의 네트워크**를 사용한다.

- **온라인 네트워크 (θ)**: 매 스텝 그래디언트로 업데이트
- **타겟 네트워크 (θ⁻)**: N 스텝(보통 1000~10000)마다 온라인 네트워크 파라미터를 그대로 복사

TD 타겟은 타겟 네트워크로 계산하므로 짧은 기간 동안 고정되어 안정적인 학습 목표를 제공한다.

```python
import torch
import torch.nn as nn
import torch.optim as optim

class QNetwork(nn.Module):
    def __init__(self, obs_dim: int, act_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, 128), nn.ReLU(),
            nn.Linear(128, 128),     nn.ReLU(),
            nn.Linear(128, act_dim)  # 각 행동의 Q값
        )

    def forward(self, x):
        return self.net(x)

class DQNAgent:
    def __init__(self, obs_dim: int, act_dim: int,
                 lr: float = 1e-3, gamma: float = 0.99,
                 target_update_freq: int = 1000):
        self.act_dim = act_dim
        self.gamma = gamma
        self.target_update_freq = target_update_freq
        self.epsilon = 1.0
        self.steps = 0

        self.online_net = QNetwork(obs_dim, act_dim)
        self.target_net = QNetwork(obs_dim, act_dim)
        self.target_net.load_state_dict(self.online_net.state_dict())
        self.target_net.eval()  # 타겟 네트워크는 그래디언트 불필요

        self.optimizer = optim.Adam(self.online_net.parameters(), lr=lr)
        self.buffer = ReplayBuffer(capacity=50_000)

    def act(self, state: np.ndarray) -> int:
        if np.random.random() < self.epsilon:
            return np.random.randint(self.act_dim)
        with torch.no_grad():
            q = self.online_net(torch.FloatTensor(state).unsqueeze(0))
        return int(q.argmax().item())

    def train_step(self, batch_size: int = 32) -> float:
        if len(self.buffer) < batch_size:
            return 0.0

        states, actions, rewards, next_states, dones = self.buffer.sample(batch_size)
        s  = torch.FloatTensor(states)
        a  = torch.LongTensor(actions).unsqueeze(1)
        r  = torch.FloatTensor(rewards)
        s_ = torch.FloatTensor(next_states)
        d  = torch.FloatTensor(dones)

        # 온라인 네트워크: Q(s, a)
        q_online = self.online_net(s).gather(1, a).squeeze(1)

        # 타겟 네트워크: r + γ · max_a' Q_target(s', a')
        with torch.no_grad():
            q_target_next = self.target_net(s_).max(1)[0]
            td_target = r + self.gamma * q_target_next * (1 - d)

        loss = nn.MSELoss()(q_online, td_target)
        self.optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.online_net.parameters(), 10.0)
        self.optimizer.step()

        # 주기적으로 타겟 네트워크 업데이트
        self.steps += 1
        if self.steps % self.target_update_freq == 0:
            self.target_net.load_state_dict(self.online_net.state_dict())

        return loss.item()
```

![DQN 핵심 구현 (PyTorch)](/assets/posts/rl-dqn-code.svg)

## 전체 훈련 루프

```python
import gymnasium as gym

env = gym.make("CartPole-v1")
obs_dim = env.observation_space.shape[0]  # 4
act_dim = env.action_space.n              # 2

agent = DQNAgent(obs_dim=obs_dim, act_dim=act_dim)
n_episodes = 500

for ep in range(n_episodes):
    state, _ = env.reset()
    total_reward = 0

    while True:
        action = agent.act(state)
        next_state, reward, done, truncated, _ = env.step(action)

        # 보상 클리핑 (Atari에서 중요): [-1, 1] 범위로 제한
        clipped_reward = np.clip(reward, -1, 1)
        agent.buffer.push(state, action, clipped_reward, next_state, done or truncated)

        loss = agent.train_step()
        total_reward += reward
        state = next_state

        if done or truncated:
            break

    # ε 앤닐링
    agent.epsilon = max(0.01, agent.epsilon * 0.997)

    if (ep + 1) % 50 == 0:
        print(f"에피소드 {ep+1}: 보상={total_reward:.0f}, "
              f"ε={agent.epsilon:.3f}, 버퍼={len(agent.buffer)}")
```

## DQN 개선 버전들

원본 DQN 이후 다양한 개선이 제안되었다.

| 버전 | 주요 개선 | 효과 |
|------|----------|------|
| Double DQN | 행동 선택(온라인)·평가(타겟) 분리 | Q값 과대추정 방지 |
| Dueling DQN | V(s) + A(s,a) 분리 아키텍처 | 상태 가치 추정 개선 |
| Prioritized Replay | TD 에러 기반 샘플링 가중치 | 중요 경험 더 자주 학습 |
| Rainbow DQN | 위 모두 + n-step + Noisy Net | 최고 성능 달성 |

```python
# Double DQN: 행동 선택은 온라인, Q값 평가는 타겟 네트워크
with torch.no_grad():
    # 온라인 네트워크로 최선의 행동 선택
    best_actions = self.online_net(s_).argmax(1, keepdim=True)
    # 타겟 네트워크로 해당 행동의 Q값 평가
    q_target_next = self.target_net(s_).gather(1, best_actions).squeeze(1)
```

## 마무리

DQN은 경험 재생(상관성 제거)과 타겟 네트워크(안정적 학습 목표)라는 두 가지 실용적인 아이디어로 딥러닝과 Q-러닝을 성공적으로 결합했다. 이 논문은 현대 딥 강화학습의 시작점이다. 그러나 DQN은 여전히 이산 행동 공간에만 동작한다. 연속적인 행동 공간(로봇 관절 제어, 자율주행)을 다루려면 다음 글에서 다룰 정책 경사법이 필요하다.

---

**지난 글:** [Q-러닝: 테이블로 배우는 최적 행동 전략](/posts/rl-q-learning/)

**다음 글:** [정책 경사법: 정책을 직접 최적화하기](/posts/rl-policy-gradient/)

<br>
읽어주셔서 감사합니다. 😊
