---
title: "샘플링 전략: LLM 출력 제어의 과학"
description: "Greedy Decoding부터 Contrastive Search까지 LLM 텍스트 생성의 핵심 샘플링 전략들을 원리·장단점·적합 태스크별로 체계적으로 비교하고, transformers 실전 코드와 함께 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["LLM", "샘플링전략", "GreedyDecoding", "NucleusSampling", "ContrastiveSearch", "TypicalSampling", "텍스트생성", "transformers"]
featured: false
draft: false
---

[지난 글](/posts/llm-temperature-top-k-top-p/)에서 Temperature, Top-k, Top-p라는 세 가지 핵심 파라미터가 확률 분포를 어떻게 변형하는지 살펴봤다. 이번에는 한 발 뒤로 물러서서, LLM이 텍스트를 생성할 때 사용할 수 있는 **샘플링 전략들의 전체 지형도**를 살펴본다. 단순한 Greedy Decoding부터 최신의 Contrastive Search까지, 각 전략이 어떤 원리로 작동하고 어떤 상황에 적합한지를 체계적으로 정리한다.

## 텍스트 생성은 왜 어려운가

LLM의 텍스트 생성은 **자동회귀(Autoregressive)** 과정이다. 매 스텝마다 이전에 생성된 토큰들을 컨텍스트로 받아 다음 토큰 하나를 선택하고, 이를 반복한다. 문제는 이 과정에서 **다양성**과 **일관성** 사이의 근본적인 긴장이 발생한다는 점이다.

다양성이 너무 낮으면 텍스트가 단조롭고 반복적이 된다. 다양성이 너무 높으면 문맥 없이 엉뚱한 단어가 튀어나온다. 각 샘플링 전략은 이 트레이드오프를 다른 방식으로 해결하려 한다.

![샘플링 전략 비교](/assets/posts/llm-sampling-strategies-overview.svg)

## Greedy Decoding: 단순하지만 강력한 기준선

Greedy Decoding은 매 스텝마다 **확률이 가장 높은 토큰**을 선택한다. 구현이 가장 단순하고, 같은 입력에서 항상 동일한 출력이 나오는 **결정적(deterministic)** 특성을 가진다.

장점은 예측 가능성이다. API 응답이 일관되어야 하는 애플리케이션, 예를 들어 고객 지원 챗봇이나 사실 정보 조회 시스템에서는 매번 다른 답이 나오는 것보다 일관된 답이 더 신뢰할 만하다.

단점은 **반복 루프**에 빠질 수 있다는 점이다. "더 나은 선택이 없을 때" 모델은 같은 구절을 반복적으로 생성하기 시작한다. 또한 지역 최적해(local optimum)에 갇혀 전체적으로 더 좋은 문장을 놓칠 수 있다. "오늘 날씨가 맑다"고 시작해서 계속 "맑다 맑다 맑다"를 반복하는 현상이 전형적인 예다.

## Random Sampling: 다양성의 극단

Random Sampling은 모델이 출력한 **전체 확률 분포대로** 무작위로 토큰을 샘플링한다. 0.001% 확률의 토큰도 선택될 수 있다. 이론적으로는 가장 다양한 출력을 낼 수 있지만, 실제로는 전혀 맥락에 맞지 않는 단어가 등장해 텍스트가 무의미해진다.

실무에서는 순수한 Random Sampling을 거의 사용하지 않는다. Temperature를 낮춰서 "부드러운" 버전으로 사용하거나, Top-k/Top-p 필터와 결합한다.

## Temperature Sampling: 다양성의 섬세한 조절

Temperature Sampling은 앞서 살펴본 대로 로짓을 T로 나눠 분포를 조절한다. T < 1.0은 Greedy에 가까워지고, T > 1.0은 Random에 가까워진다. 실제 API 사용에서 가장 흔하게 활용하는 기본 전략이다.

핵심은 T를 태스크에 맞게 조율하는 것이다. 코드 생성에는 T=0.2, 대화에는 T=0.7, 브레인스토밍에는 T=1.1처럼 상황에 따라 다르게 설정한다.

## Typical Sampling: 엔트로피 기반 접근

Meister et al. (2023)이 제안한 **Typical Sampling**은 다른 접근 방식을 취한다. 확률이 가장 높은 토큰을 선택하는 대신, 분포의 **엔트로피에 가장 "전형적인(typical)"** 토큰을 선택한다.

직관적으로, 인간이 언어를 사용할 때 항상 가장 예측 가능한 단어를 선택하지 않는다. "오늘 날씨가 좋아서 ___"라는 문장에서 "산책을 했다"는 예측 가능하지만 자연스럽고, "철학적 사색에 빠졌다"는 덜 예측적이지만 여전히 의미가 있다. Typical Sampling은 이 자연스러운 불확실성을 재현하려 한다.

Top-p와 성능이 비슷하지만, 특히 자연스러운 일상 대화 텍스트 생성에서 더 나은 경향이 있다.

## Contrastive Search: 반복 없는 일관성

**Contrastive Search**는 Su et al. (2022)이 제안한 방법으로, 기존 샘플링 전략의 가장 큰 약점인 **반복(degeneration)**을 직접 해결한다.

핵심 아이디어는 토큰을 선택할 때 **모델의 확률**과 **이미 생성된 텍스트와의 유사도** 두 가지를 동시에 고려하는 것이다.

$$\text{score}(v) = (1 - \alpha) \cdot P_\text{model}(v \mid \text{context}) - \alpha \cdot \max_{u \in V_\text{past}} \text{sim}(h_v, h_u)$$

여기서 α는 다양성 페널티 강도(0~1), sim은 숨겨진 상태(hidden state) 간의 코사인 유사도다. 이미 생성된 토큰들과 표현 공간에서 유사한 토큰은 패널티를 받아 선택되기 어려워진다.

![Contrastive Search 개념도](/assets/posts/llm-sampling-contrastive.svg)

## 실전 코드: transformers로 전략 비교

```python
from transformers import pipeline

gen = pipeline("text-generation", model="gpt2")

# 창의적 글쓰기: 높은 다양성
creative = gen(
    "Once upon a time",
    do_sample=True,
    temperature=0.9,
    top_p=0.95,
    max_new_tokens=100,
)

# 코드 생성: 낮은 다양성
code = gen(
    "def fibonacci(n):",
    do_sample=True,
    temperature=0.2,
    top_k=10,
    max_new_tokens=100,
)

# 사실 질문: Greedy
factual = gen(
    "The capital of France is",
    do_sample=False,  # greedy
    max_new_tokens=20,
)
```

Hugging Face의 `pipeline`에서 `do_sample=False`로 설정하면 Greedy Decoding, `do_sample=True`와 함께 `temperature`, `top_k`, `top_p`를 지정하면 해당 전략이 조합 적용된다.

Contrastive Search는 `penalty_alpha`와 `top_k`로 설정한다.

```python
# Contrastive Search
contrastive = gen(
    "The story begins",
    penalty_alpha=0.6,
    top_k=4,
    max_new_tokens=200,
)
```

## 전략 선택 가이드

어떤 전략을 써야 할지 결정하는 실용적 기준을 정리하면 다음과 같다.

**결정적 출력이 필요하다면:** Greedy Decoding 또는 매우 낮은 Temperature (T=0.1~0.3). 코드 생성 자동화, 사실 정보 답변, 테스트 재현성이 필요한 상황.

**다양하면서 품질이 좋아야 한다면:** Top-p (p=0.9~0.95) + Temperature (T=0.7~0.9) 조합. 대화형 챗봇, 창의적 글쓰기, 콘텐츠 생성의 표준.

**긴 텍스트에서 반복을 없애야 한다면:** Contrastive Search (α=0.6, k=4) 또는 Repetition Penalty (1.2~1.5). 소설, 기술 문서, 장문 리포트 생성.

**자연스러운 대화체가 필요하다면:** Typical Sampling 또는 Temperature + Top-p. 인간다운 언어 패턴 재현.

## 파라미터 과적합 방지

마지막으로 실무에서 흔한 실수를 경계해야 한다. 특정 프롬프트에 맞게 파라미터를 과도하게 튜닝하면, 다른 프롬프트에서는 오히려 나빠질 수 있다. 좋은 접근법은 태스크 유형별 기본값 (코드: T=0.2, 대화: T=0.8)을 정하고, 사용자 피드백에 따라 소폭 조정하는 방식이다. A/B 테스트로 실제 사용자 선호도를 측정하는 것도 효과적이다.

샘플링 전략은 LLM의 출력 품질을 결정하는 가장 직접적인 레버 중 하나다. 다음 글에서는 이 샘플링 전략과 밀접하게 연관된 디코딩 방법들, 특히 Beam Search와 그 발전형들을 자세히 살펴본다.

---

**지난 글:** [Temperature·Top-k·Top-p: 생성 다양성 제어](/posts/llm-temperature-top-k-top-p/)

**다음 글:** [디코딩 방법: Greedy에서 Beam Search까지](/posts/llm-decoding-methods/)

<br>
읽어주셔서 감사합니다. 😊
