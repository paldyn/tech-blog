---
title: "강화학습 기초: 에이전트, 환경, 보상의 언어"
description: "강화학습의 핵심 개념인 에이전트, 환경, 상태, 행동, 보상, 정책, 가치 함수를 직관적으로 이해하고 Gymnasium으로 실제 RL 루프를 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["강화학습", "RL", "에이전트", "환경", "보상", "정책", "가치함수", "Gymnasium"]
featured: false
draft: false
---

[지난 글](/posts/recsys-llm-based/)에서 LLM이 추천 시스템을 어떻게 혁신하는지 살펴보았다. 이번 글부터는 AI의 또 다른 거대한 축, **강화학습(Reinforcement Learning, RL)** 을 탐구한다. 강화학습은 지도학습과 완전히 다른 패러다임이다. 정답 레이블이 없다. 에이전트가 환경과 직접 상호작용하면서 시행착오를 통해 스스로 학습한다. 바둑에서 인간 챔피언을 꺾은 AlphaGo, ChatGPT를 훈련시킨 RLHF, 자율주행 차량의 의사결정 엔진까지 — 모두 강화학습이 핵심이다.

## 강화학습이란 무엇인가

강화학습의 본질은 **시행착오를 통한 학습**이다. 어린아이가 자전거를 배우는 과정을 떠올려보자. 누군가가 "페달을 이렇게 밟아"라고 레이블을 붙여주지 않는다. 아이는 핸들을 이리저리 돌리고, 넘어지고, 균형을 잡으면서 점차 자전거 타기를 익힌다. 넘어지면 고통(음수 보상), 잘 달리면 기쁨(양수 보상)을 경험하며 어떤 행동이 좋은지 배운다.

강화학습에서도 똑같다. **에이전트(Agent)** 는 **환경(Environment)** 과 상호작용하면서 **보상(Reward)** 신호를 통해 최적 행동을 학습한다.

## 핵심 구성 요소

![강화학습 핵심 루프](/assets/posts/rl-basics-concept.svg)

강화학습의 다섯 가지 핵심 요소를 정의한다.

**상태 (State, s)**: 에이전트가 관측하는 환경의 현재 상황. CartPole 게임에서는 막대의 각도, 각속도, 카트 위치, 카트 속도가 상태를 구성한다. 체스에서는 현재 보드 배치 전체가 상태다.

**행동 (Action, a)**: 에이전트가 선택할 수 있는 동작. CartPole에서는 카트를 왼쪽/오른쪽으로 미는 2가지 이산 행동, 로봇 팔 제어에서는 각 관절의 연속적인 토크 값이 행동이다.

**보상 (Reward, r)**: 특정 상태에서 특정 행동을 취했을 때 환경이 주는 즉각적인 피드백. 바둑에서는 게임을 이기면 +1, 지면 -1이 에피소드 끝에 주어진다. CartPole에서는 막대가 서 있는 매 타임스텝마다 +1이 주어진다.

**정책 (Policy, π)**: 상태를 입력받아 행동을 출력하는 함수. π(a|s)는 상태 s에서 행동 a를 선택할 확률을 의미한다. 강화학습의 목표는 최적 정책 π*를 찾는 것이다.

**가치 함수 (Value Function, V)**: 특정 상태에서 시작해 정책 π를 따랐을 때 기대되는 누적 보상. "이 상태가 얼마나 좋은가?"를 수치화한다.

## 누적 보상과 할인율

강화학습의 목표는 단순히 현재 보상을 최대화하는 것이 아니다. **미래 보상을 포함한 누적 보상(Return)** 을 최대화하는 것이다.

$$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \cdots = \sum_{k=0}^{\infty} \gamma^k r_{t+k}$$

여기서 γ(감마)는 **할인율(Discount Factor)** 로, 0과 1 사이의 값이다. γ=0이면 즉각적인 보상만 고려하고, γ=1이면 모든 미래 보상을 동등하게 취급한다. 실제로는 γ=0.99 정도가 많이 사용된다.

할인율이 필요한 이유는 두 가지다. 첫째, 무한 에피소드에서 수렴을 보장한다. 둘째, "지금 받는 100원이 1년 후 받는 100원보다 낫다"는 시간 선호를 반영한다.

## Markov 결정 프로세스 (MDP)

강화학습 문제는 보통 **MDP(Markov Decision Process)** 로 형식화된다.

MDP의 핵심 가정은 **마르코프 성질(Markov Property)**: 다음 상태는 현재 상태와 행동에만 의존하고, 과거 이력에는 의존하지 않는다. 수식으로는 P(sₜ₊₁|sₜ, aₜ) = P(sₜ₊₁|s₀,...,sₜ, a₀,...,aₜ).

```
MDP = (S, A, P, R, γ)
  S: 상태 공간
  A: 행동 공간
  P(s'|s,a): 상태 전이 확률
  R(s,a): 보상 함수
  γ: 할인율
```

체스나 바둑처럼 보드 상태만 보면 되는 게임은 완전히 마르코프 성질을 만족한다. 반면 포커처럼 상대방의 패가 보이지 않는 경우는 **부분 관측 MDP(POMDP)** 로 모델링해야 한다.

## Gymnasium으로 첫 번째 RL 환경

OpenAI Gymnasium(구 Gym)은 강화학습 연구의 표준 환경 라이브러리다.

![강화학습 환경 기본 구조](/assets/posts/rl-basics-code.svg)

```python
import gymnasium as gym
import numpy as np

# CartPole 환경: 막대를 쓰러뜨리지 않고 카트를 움직이는 문제
env = gym.make("CartPole-v1")

# 환경 정보 확인
print(f"상태 공간: {env.observation_space}")   # Box(4,) — 4차원 연속
print(f"행동 공간: {env.action_space}")         # Discrete(2) — 0: 왼쪽, 1: 오른쪽
print(f"최대 스텝: {env.spec.max_episode_steps}")  # 500

# 랜덤 에이전트 테스트
episode_rewards = []
for episode in range(20):
    state, _ = env.reset()
    total_reward = 0
    step = 0

    while True:
        # 랜덤 정책: 행동 공간에서 균등 샘플링
        action = env.action_space.sample()

        # 환경 스텝: 행동 실행 → (다음상태, 보상, 종료여부, 잘림여부, 정보)
        next_state, reward, done, truncated, info = env.step(action)

        total_reward += reward
        step += 1
        state = next_state

        if done or truncated:
            break

    episode_rewards.append(total_reward)

print(f"평균 보상: {np.mean(episode_rewards):.1f}")  # 약 20~25 (랜덤이라 낮음)
# 최적 에이전트: 500 달성 가능
```

`env.step(action)`이 반환하는 다섯 가지 값이 강화학습 루프의 핵심이다. `next_state`는 행동 후의 새 상태, `reward`는 즉각 보상, `done`은 목표 달성/실패 여부, `truncated`는 최대 스텝 초과 여부다.

## 강화학습 알고리즘 분류

강화학습 알고리즘은 크게 세 가지 축으로 분류할 수 있다.

**모델 기반 vs 모델 프리**: 환경의 전이 확률 P를 알거나 학습하면 모델 기반, 경험만으로 학습하면 모델 프리다. AlphaGo는 모델 기반, 대부분의 실제 응용은 모델 프리다.

**가치 기반 vs 정책 기반**: Q-Learning, DQN은 최적 가치 함수를 학습해 암묵적으로 정책을 유도한다. REINFORCE, PPO는 정책 자체를 직접 최적화한다. 액터-크리틱은 두 접근을 결합한다.

**온-정책 vs 오프-정책**: 현재 정책으로 수집한 데이터만 학습에 쓰면 온-정책(PPO), 다른 정책의 데이터도 활용할 수 있으면 오프-정책(DQN)이다.

| 알고리즘 | 유형 | 특징 |
|---------|------|------|
| Q-Learning | 가치 기반, 오프-정책 | 이산 행동 공간 |
| DQN | 가치 기반, 오프-정책 | 신경망 + 경험 재생 |
| REINFORCE | 정책 기반, 온-정책 | 단순하지만 분산 높음 |
| PPO | 정책 기반, 온-정책 | 안정적, 연속 행동 |
| SAC | 액터-크리틱, 오프-정책 | 최고 샘플 효율 |

## 탐험과 활용의 균형 (Exploration-Exploitation Tradeoff)

강화학습의 근본적인 딜레마다. **활용(Exploitation)** 만 하면 이미 아는 것 중 최선을 선택하지만, 더 좋은 것을 발견하지 못한다. **탐험(Exploration)** 만 하면 새로운 것을 시도하지만 효율이 낮다.

```python
# ε-greedy 전략: 가장 단순한 탐험-활용 균형
class EpsilonGreedyPolicy:
    def __init__(self, n_actions: int, epsilon: float = 0.1):
        self.n_actions = n_actions
        self.epsilon = epsilon

    def select_action(self, q_values: np.ndarray) -> int:
        if np.random.random() < self.epsilon:
            return np.random.randint(self.n_actions)  # 탐험
        return np.argmax(q_values)                     # 활용

# 에피소드가 진행될수록 epsilon 감소 (점점 활용 비중 증가)
epsilon_schedule = lambda ep: max(0.01, 1.0 - ep / 500)
```

ε-greedy는 ε 확률로 랜덤 행동(탐험), 1-ε 확률로 최선의 행동(활용)을 선택한다. 학습 초기에는 ε=1.0으로 완전 탐험하고, 점차 줄여나가는 **앤닐링(Annealing)** 전략이 일반적이다.

## 마무리

강화학습의 핵심은 간단하다. 에이전트가 환경과 상호작용하며 보상 신호로부터 최적 정책을 학습한다. 상태, 행동, 보상, 정책, 가치 함수라는 다섯 가지 개념과 MDP 형식이 이 모든 것의 기반이다. 다음 글에서는 이 프레임워크 위에서 가장 고전적이고 직관적인 알고리즘인 Q-Learning을 구현한다.

---

**지난 글:** [LLM 기반 추천 시스템: 언어 모델이 바꾸는 추천의 패러다임](/posts/recsys-llm-based/)

**다음 글:** [Q-러닝: 테이블로 배우는 최적 행동 전략](/posts/rl-q-learning/)

<br>
읽어주셔서 감사합니다. 😊
