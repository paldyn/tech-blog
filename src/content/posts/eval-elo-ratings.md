---
title: "ELO 레이팅으로 LLM 순위 매기기"
description: "체스 ELO 시스템을 LLM 비교 평가에 적용하는 원리와 Chatbot Arena·LMSYS 방법론을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["ELO레이팅", "ChatbotArena", "LMSYS", "Bradley-Terry", "모델랭킹", "쌍비교평가", "LLM벤치마크"]
featured: false
draft: false
---

[지난 글](/posts/eval-llm-as-judge/)에서 LLM이 AI 응답을 평가하는 방법을 다뤘다. LLM-as-Judge는 자동화된 빠른 평가를 가능하게 하지만, 수백만 명의 실제 사용자 피드백을 체계적으로 집계하는 방법은 별도로 필요하다. 이번에는 체스에서 비롯된 ELO 레이팅 시스템이 어떻게 LLM 비교 평가에 적용되어 모델 순위를 만들어내는지 살펴본다.

---

## ELO 레이팅의 기원

ELO 레이팅은 헝가리계 미국인 물리학 교수 **Arpad Elo**가 1960년대에 체스 선수 강도를 정량화하기 위해 고안한 수학적 시스템이다. 핵심 직관은 단순하다. "강한 선수가 약한 선수를 이기면 레이팅 변화가 작고, 약한 선수가 강한 선수를 이기면 변화가 크다."

체스에서 수십 년간 사용된 이 시스템은 오늘날 리그 오브 레전드, 피파 온라인, 바둑 등 거의 모든 경쟁 게임의 랭킹 시스템에 채택되어 있다. 그리고 2023년부터는 **LLM 모델 간의 상대적 우열**을 측정하는 데도 활발히 사용되고 있다.

ELO가 LLM 평가에 매력적인 이유는 **비대칭 매치업의 결과를 자연스럽게 처리**할 수 있기 때문이다. 예를 들어 GPT-4와 작은 오픈소스 모델이 대결하면 GPT-4의 승리는 예상된 결과이므로 레이팅 변화가 작다. 반면 오픈소스 모델이 이기면 큰 레이팅 이득을 얻는다.

---

## ELO 공식 이해하기

ELO 시스템의 수학은 두 단계로 이루어진다.

![ELO 레이팅 업데이트 공식](/assets/posts/eval-elo-ratings-formula.svg)

### 1단계: 기대 승률 계산

모델 A와 B의 현재 레이팅이 각각 R_A, R_B일 때, A가 이길 확률(기대 승률)은 다음과 같이 계산한다.

```
E_A = 1 / (1 + 10 ^ ((R_B - R_A) / 400))
```

두 모델의 레이팅이 같으면 E_A = 0.5, 즉 50:50이다. R_A가 R_B보다 400점 높으면 E_A ≈ 0.909, 즉 A가 약 91%의 확률로 이길 것으로 기대한다.

**400이라는 숫자의 의미**: 400점 차이가 나면 상위 모델이 10:1의 확률로 이긴다는 의미다. 이 값은 체스에서 실증적으로 검증된 상수다. LLM 평가에서도 동일한 상수를 그대로 사용한다.

### 2단계: 레이팅 업데이트

실제 대결 결과(S_A: 이기면 1.0, 비기면 0.5, 지면 0.0)가 나오면 기대값과의 차이만큼 레이팅을 조정한다.

```
R'_A = R_A + K × (S_A - E_A)
```

**K-factor**: 레이팅 변동폭을 조절하는 상수다. K=32이면 한 번의 대결에서 최대 32점이 오르거나 내린다. K가 크면 변동폭이 커서 새로운 정보에 빠르게 반응하지만 불안정해진다. K가 작으면 안정적이지만 수렴이 느리다. Chatbot Arena는 초기에 K=32, 이후 더 안정된 추정을 위해 K=4로 낮추는 전략을 사용한다.

### 구체적 예시

두 모델 모두 레이팅 1200에서 시작해 A가 B를 이겼다고 하자.

- E_A = 1 / (1 + 10^0) = 0.5
- R'_A = 1200 + 32 × (1.0 - 0.5) = **1216**
- R'_B = 1200 + 32 × (0.0 - 0.5) = **1184**

레이팅이 같을 때 이기면 정확히 16점씩 교환된다.

---

## Chatbot Arena란

**Chatbot Arena**는 UC버클리 LMSYS 그룹이 2023년 5월에 출시한 LLM 비교 평가 플랫폼이다. 이 플랫폼의 작동 방식은 다음과 같다.

![Chatbot Arena: ELO 기반 모델 랭킹](/assets/posts/eval-elo-ratings-arena.svg)

1. 사용자가 질문을 입력한다.
2. 플랫폼이 익명으로 두 개의 모델을 선택해 응답을 생성한다. 사용자는 어느 모델인지 모른다.
3. 사용자가 "A가 낫다 / B가 낫다 / 무승부"를 투표한다.
4. 투표 결과에 따라 두 모델의 ELO 레이팅이 업데이트된다.
5. 리더보드가 실시간으로 갱신된다.

2024년 기준으로 Chatbot Arena는 **100만 건 이상의 인간 투표**를 수집했다. 이 규모의 데이터는 통계적으로 매우 신뢰할 수 있는 순위를 만들어낸다. LMSYS가 발표한 연구에 따르면 1,000건 이상의 매치업이 쌓이면 모델 간 순위가 안정적으로 수렴한다.

Arena의 중요한 특징은 **실제 사용자의 자연스러운 질문**을 사용한다는 점이다. 벤치마크용으로 설계된 인위적 질문셋과 달리, 사용자들이 실제로 LLM에게 묻고 싶은 질문들이 평가에 사용된다. 이는 실사용 환경을 더 잘 반영하는 평가를 가능하게 한다.

---

## Bradley-Terry 모델과 ELO의 관계

학술적으로 Chatbot Arena는 순수 ELO가 아닌 **Bradley-Terry 모델**에 기반한 통계적 추정을 사용한다.

Bradley-Terry 모델은 쌍 비교(pairwise comparison) 데이터에서 각 항목의 "강도(strength)"를 최대우도추정(MLE)으로 추정하는 통계 모델이다. ELO의 온라인 업데이트 방식과 달리, Bradley-Terry는 수집된 모든 매치 데이터를 동시에 분석해 전역적으로 일관된 레이팅을 계산한다.

수식으로 표현하면, 모델 i가 모델 j를 이길 확률은 다음과 같다.

```
P(i beats j) = exp(β_i) / (exp(β_i) + exp(β_j))
```

여기서 β_i는 모델 i의 강도 파라미터다. 이를 ELO 스케일로 변환하면 우리가 익숙한 레이팅 숫자가 된다.

**ELO와 Bradley-Terry의 차이**:
- ELO는 새로운 매치 결과가 들어올 때마다 순서대로 업데이트하는 **온라인** 방식이다. 구현이 단순하고 빠르다.
- Bradley-Terry는 누적된 전체 데이터를 배치로 분석하는 **오프라인** 방식이다. 더 정확하지만 계산 비용이 크다.

실용적으로 Chatbot Arena는 두 방식을 모두 활용한다. 실시간 리더보드에는 ELO를 사용하고, 주기적인 공식 결과 발표에는 Bradley-Terry를 사용한다.

---

## Python으로 구현하는 ELO

아래 코드는 ELO 업데이트 로직의 핵심을 간결하게 구현한다.

```python
def update_elo(rating_a: float, rating_b: float,
               result: float, k: float = 32) -> tuple[float, float]:
    """result: 1.0=A wins, 0.5=draw, 0.0=B wins"""
    expected_a = 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
    expected_b = 1 - expected_a
    new_a = rating_a + k * (result - expected_a)
    new_b = rating_b + k * ((1 - result) - expected_b)
    return new_a, new_b

# Example
r_a, r_b = 1200.0, 1200.0
r_a, r_b = update_elo(r_a, r_b, result=1.0)  # A wins
print(f"A: {r_a:.1f}, B: {r_b:.1f}")  # A: 1216.0, B: 1184.0
```

여러 모델의 토너먼트를 시뮬레이션하려면 이 함수를 반복 적용하면 된다.

```python
def run_tournament(models: dict[str, float],
                   results: list[tuple[str, str, float]]) -> dict[str, float]:
    """
    models: {"ModelA": 1200.0, "ModelB": 1200.0, ...}
    results: [("ModelA", "ModelB", 1.0), ...]  # (winner_side, loser_side, result)
    """
    ratings = models.copy()
    for model_a, model_b, result in results:
        new_a, new_b = update_elo(ratings[model_a], ratings[model_b], result)
        ratings[model_a] = new_a
        ratings[model_b] = new_b
    return dict(sorted(ratings.items(), key=lambda x: x[1], reverse=True))

# 시뮬레이션 예시
models = {"GPT-4o": 1200.0, "Claude": 1200.0, "Gemini": 1200.0}
results = [
    ("GPT-4o", "Claude", 1.0),   # GPT-4o wins
    ("Claude", "Gemini", 1.0),   # Claude wins
    ("GPT-4o", "Gemini", 1.0),   # GPT-4o wins
    ("Gemini", "Claude", 0.5),   # Draw
]
final = run_tournament(models, results)
for model, rating in final.items():
    print(f"{model}: {rating:.1f}")
```

---

## ELO의 한계

ELO가 강력한 도구임에도 불구하고 LLM 평가에 적용할 때 주의해야 할 한계들이 있다.

### Cold Start 문제

레이팅이 의미를 갖기 위해서는 충분한 매치업 데이터가 필요하다. 새로운 모델이 등장했을 때 초기 몇 백 건의 결과는 아직 레이팅이 안정되지 않아 신뢰하기 어렵다. Chatbot Arena에서는 새 모델의 95% 신뢰구간이 좁아질 때까지 공식 순위에 포함시키지 않는다.

### Bootstrapping 불확실성

각 모델의 레이팅에는 통계적 불확실성이 존재한다. 레이팅 차이가 작으면(예: 5–10점) 두 모델의 순위는 사실상 구별하기 어렵다. 신뢰구간을 함께 보고하는 것이 중요하다.

### Category Bias (카테고리 편향)

"코딩 태스크에서는 모델 A가 낫지만 창의적 글쓰기에서는 모델 B가 낫다"처럼, 태스크 유형에 따라 우열이 달라질 수 있다. 단일 ELO 점수는 이런 태스크별 강점을 반영하지 못한다. Chatbot Arena는 이를 보완하기 위해 카테고리별 리더보드도 별도로 제공한다.

### Transitivity 가정

ELO는 "A > B이고 B > C이면 A > C"라는 전이적 우월성을 가정한다. 하지만 현실에서는 이 관계가 성립하지 않는 경우도 있다. 특히 모델마다 강점 분야가 다를 때 비전이적 결과가 나올 수 있다.

### 시간에 따른 레이팅 드리프트

모델이 업데이트되거나 새로운 모델이 추가되면 기존 모델들의 레이팅도 영향을 받는다. 과거의 레이팅과 현재의 레이팅을 직접 비교하는 것은 주의가 필요하다.

---

## 마치며

ELO 레이팅은 수십 년의 검증을 거친 강건한 시스템이다. LLM 평가에 적용된 Chatbot Arena는 실사용자의 실제 선호도를 대규모로 집계해 신뢰할 수 있는 모델 순위를 만들어낸다. 편향 없는 단일 지표를 원한다면 ELO가 현재로서는 가장 실용적인 선택이다.

물론 단일 ELO 점수만으로 모델을 선택하는 것은 위험하다. 실제 사용 사례의 태스크 유형, 언어, 도메인 등을 고려한 **태스크별 맞춤 평가**가 필요하다. 다음 글에서는 이 주제를 다룬다.

---

**지난 글:** [LLM-as-Judge: AI가 AI를 평가하다](/posts/eval-llm-as-judge/)  
**다음 글:** [태스크별 맞춤 평가 지표 설계](/posts/eval-task-specific/)

읽어주셔서 감사합니다. 😊
