---
title: "Q-러닝: 테이블로 배우는 최적 행동 전략"
description: "Q-러닝의 원리, Bellman 방정식, TD 오류, ε-greedy 탐험 전략을 이해하고 FrozenLake 환경에서 직접 구현하는 완전 가이드입니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["Q러닝", "강화학습", "Bellman방정식", "TD오류", "ε-greedy", "Q테이블", "FrozenLake", "가치함수"]
featured: false
draft: false
---

[지난 글](/posts/rl-basics/)에서 강화학습의 핵심 구성 요소인 에이전트, 환경, 상태, 행동, 보상, 정책을 살펴보고 Gymnasium으로 첫 RL 환경을 경험했다. 이번 글에서는 가장 고전적이고 직관적인 강화학습 알고리즘인 **Q-러닝(Q-Learning)** 을 완전히 이해하고 구현한다. Q-러닝은 복잡한 신경망 없이 테이블 하나로 최적 행동을 학습하는 아름다운 알고리즘이다. 이 알고리즘의 원리를 깊이 이해하면 이후의 DQN, PPO 같은 고급 알고리즘도 쉽게 파악할 수 있다.

## Q-함수란 무엇인가

Q-러닝은 **Q-함수(Q-Function)** 를 학습한다. Q(s, a)는 "상태 s에서 행동 a를 취한 후 최적 정책을 따랐을 때 기대되는 누적 할인 보상"이다.

수식으로는: Q*(s, a) = E[r + γ · max_{a'} Q*(s', a') | s, a]

이것이 바로 **Bellman 최적 방정식**이다. 현재 (상태, 행동) 쌍의 가치는 즉각 보상 + 다음 상태에서의 최선의 가치로 재귀적으로 정의된다.

Q-함수를 알면 최적 정책을 바로 유도할 수 있다: π*(s) = argmax_a Q*(s, a). 어떤 상태에서든 Q값이 가장 높은 행동을 선택하면 된다.

## Q-테이블: 표 형식의 Q-함수

상태 공간과 행동 공간이 유한하고 작을 때, Q-함수를 2차원 테이블로 표현할 수 있다. 행은 상태, 열은 행동, 셀 값은 Q(s, a)다.

![Q-러닝: Q-테이블과 업데이트 규칙](/assets/posts/rl-q-learning-concept.svg)

FrozenLake 4x4 게임: 4×4 그리드(16개 상태), 4가지 행동(상/하/좌/우)이면 Q-테이블은 16×4=64개 셀만 있으면 된다.

```
초기 Q-테이블 (모두 0으로 시작):
       LEFT  DOWN  RIGHT  UP
s0  [  0.0   0.0   0.0   0.0 ]
s1  [  0.0   0.0   0.0   0.0 ]
...
s15 [  0.0   0.0   0.0   0.0 ]

학습 후 (최적에 가깝게 수렴):
       LEFT  DOWN  RIGHT  UP
s0  [  0.0   0.59  0.51  0.0 ]
s1  [  0.0   0.0   0.67  0.0 ]
...
```

## Bellman 업데이트 규칙

Q-러닝은 다음 업데이트 규칙으로 Q-테이블을 반복적으로 갱신한다.

**Q(s, a) ← Q(s, a) + α [r + γ · max_a' Q(s', a') - Q(s, a)]**

- α (학습률): 얼마나 빠르게 새 정보를 반영할지 (0 < α ≤ 1)
- r: 즉각 보상
- γ: 할인율
- max_a' Q(s', a'): 다음 상태에서의 최대 Q값 (TD 타겟)
- `r + γ · max Q(s', a') - Q(s, a)`: **TD 에러(Temporal Difference Error)** — 예측과 실제의 차이

TD 에러가 양수면 Q(s, a)를 높이고, 음수면 낮춘다. 이를 수백만 번 반복하면 Q-테이블이 최적값에 수렴한다.

## 완전한 Q-러닝 구현

![Q-러닝 핵심 구현](/assets/posts/rl-q-learning-code.svg)

```python
import gymnasium as gym
import numpy as np

class QLearningAgent:
    def __init__(self, n_states: int, n_actions: int,
                 lr: float = 0.1, gamma: float = 0.99):
        self.Q = np.zeros((n_states, n_actions))
        self.lr = lr
        self.gamma = gamma
        self.epsilon = 1.0        # 완전 탐험으로 시작

    def act(self, state: int) -> int:
        """ε-greedy 정책으로 행동 선택"""
        if np.random.random() < self.epsilon:
            return np.random.randint(self.Q.shape[1])  # 탐험
        return int(np.argmax(self.Q[state]))            # 활용

    def learn(self, s: int, a: int, r: float,
              s_next: int, done: bool) -> float:
        """Bellman 업데이트"""
        if done:
            target = r
        else:
            target = r + self.gamma * np.max(self.Q[s_next])
        td_error = target - self.Q[s, a]
        self.Q[s, a] += self.lr * td_error
        return td_error

# FrozenLake 환경 (미끄럼 없음)
env = gym.make("FrozenLake-v1", is_slippery=False)
agent = QLearningAgent(
    n_states=env.observation_space.n,    # 16
    n_actions=env.action_space.n,        # 4
    lr=0.1,
    gamma=0.99
)

# 훈련 루프
n_episodes = 2000
rewards_history = []

for ep in range(n_episodes):
    state, _ = env.reset()
    total_reward = 0

    while True:
        action = agent.act(state)
        next_state, reward, done, truncated, _ = env.step(action)
        agent.learn(state, action, reward, next_state, done)
        total_reward += reward
        state = next_state
        if done or truncated:
            break

    # epsilon 앤닐링: 점차 탐험 감소
    agent.epsilon = max(0.01, agent.epsilon * 0.995)
    rewards_history.append(total_reward)

    if (ep + 1) % 200 == 0:
        avg = np.mean(rewards_history[-200:])
        print(f"에피소드 {ep+1}: 최근 200 평균 보상={avg:.3f}, ε={agent.epsilon:.3f}")
```

실행 결과:
```
에피소드 200: 최근 200 평균 보상=0.230, ε=0.368
에피소드 400: 최근 200 평균 보상=0.695, ε=0.135
에피소드 600: 최근 200 평균 보상=0.950, ε=0.050
에피소드 800: 최근 200 평균 보상=0.985, ε=0.018
에피소드 1000: 최근 200 평균 보상=1.000, ε=0.010
```

## Q-러닝의 오프-정책 특성

Q-러닝의 중요한 특징은 **오프-정책(Off-Policy)** 학습이라는 것이다. 학습 목표(`max_a' Q(s', a')`)는 항상 greedy 정책을 기준으로 하지만, 실제 행동 선택은 ε-greedy로 한다. 즉, 현재 사용하는 정책과 배우려는 정책이 다를 수 있다.

이 덕분에 다른 에이전트(심지어 랜덤 에이전트)가 수집한 경험 데이터로도 Q-러닝을 적용할 수 있다. DQN에서 경험 재생(Experience Replay)이 가능한 것도 이 오프-정책 특성 덕분이다.

## Q-러닝의 한계와 DQN으로의 전환

Q-러닝은 우아한 알고리즘이지만 결정적인 한계가 있다.

**상태 공간 폭발**: Atari 게임처럼 픽셀 화면이 상태라면 상태 수가 10^100을 넘는다. 이를 테이블로 표현하는 것은 불가능하다.

**연속 상태 불가**: 로봇 팔의 관절 각도, 자동차 속도처럼 연속적인 상태 공간은 이산화하기 어렵고 이산화해도 정보 손실이 크다.

**일반화 부재**: Q-테이블은 본 적 없는 상태에 대한 Q값을 추정할 수 없다. 비슷한 상태에서 배운 것을 활용하지 못한다.

이 세 가지 한계를 모두 해결하는 것이 다음 글에서 다룰 **DQN(Deep Q-Network)** 이다. Q-테이블 대신 신경망으로 Q-함수를 근사하면 어떤 크기의 상태 공간도, 연속 입력도 처리할 수 있다.

```python
# 학습된 Q-테이블 시각화 (4x4 FrozenLake)
optimal_actions = ['←', '↓', '→', '↑']
print("\n최적 정책 (각 셀: 최적 행동):")
for row in range(4):
    line = ""
    for col in range(4):
        state = row * 4 + col
        best_a = np.argmax(agent.Q[state])
        line += f"  {optimal_actions[best_a]}"
    print(line)

# 출력 예시:
#   →  →  ↓  ←
#   ↓  H  ↓  H
#   →  ↓  ↓  H
#   H  →  →  G
# H=구멍(Hole), G=목표(Goal)
```

## 마무리

Q-러닝은 Bellman 방정식을 반복적인 TD 업데이트로 풀어내는 우아한 알고리즘이다. Q-테이블, TD 에러, ε-greedy 탐험, 오프-정책 학습이라는 네 가지 개념을 확실히 이해하면 이후의 모든 가치 기반 RL 알고리즘의 기반이 마련된다. 다음 글에서는 Q-러닝을 딥러닝과 결합한 DQN으로 Atari 게임을 정복하는 방법을 알아본다.

---

**지난 글:** [강화학습 기초: 에이전트, 환경, 보상의 언어](/posts/rl-basics/)

**다음 글:** [DQN: 딥러닝으로 확장하는 Q-러닝](/posts/rl-dqn/)

<br>
읽어주셔서 감사합니다. 😊
