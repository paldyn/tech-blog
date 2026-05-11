---
title: "디코딩 방법: Greedy에서 Beam Search까지"
description: "LLM의 텍스트 생성 과정에서 핵심인 디코딩 방법들—Greedy Decoding, Beam Search, Diverse Beam Search, 그리고 자동회귀 생성의 원리—을 품질·속도·다양성 트레이드오프와 함께 실전 코드로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["LLM", "디코딩", "BeamSearch", "GreedyDecoding", "자동회귀생성", "DiverseBeamSearch", "텍스트생성", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/llm-sampling-strategies/)에서 Greedy, Temperature, Top-p, Contrastive Search 등 다양한 샘플링 전략을 살펴봤다. 이번에는 그 중에서도 특히 **탐색 기반 디코딩**의 핵심인 Beam Search와 그 발전형들을 깊이 파고든다. 샘플링 전략이 "어떻게 무작위성을 도입할 것인가"에 집중했다면, 이번 디코딩 방법들은 "어떻게 더 좋은 시퀀스를 탐색할 것인가"에 집중한다.

## 자동회귀 생성의 근본 문제

LLM의 텍스트 생성은 자동회귀(Autoregressive) 방식으로 작동한다. 토큰 하나를 생성하고, 그것을 다시 입력에 추가해 다음 토큰을 생성하는 과정을 반복한다. 이론적으로 가능한 시퀀스의 수는 |V|^L인데, 어휘 크기 |V|=50,000에 시퀀스 길이 L=100이라면 10^480가지가 된다. 이 방대한 공간을 어떻게 효율적으로 탐색할 것인가가 디코딩 방법의 핵심 문제다.

**완전 탐색(Exhaustive Search)**은 불가능하다. **Greedy**는 한 스텝씩 국소 최적을 선택하고, **Beam Search**는 중간 어딘가에서 균형을 찾는다.

## Greedy Decoding의 한계

Greedy Decoding은 매 스텝마다 $\hat{t} = \arg\max_v P(v \mid t_1, \ldots, t_{k-1})$을 선택한다. 단순하고 빠르지만, **지역 최적(local optimum)**에 갇히는 문제가 있다.

예를 들어, "I want to go to the [store/bank/library]"라는 문장이 있을 때, "store"의 확률이 0.45로 가장 높더라도, "bank"(0.35)로 시작하는 시퀀스가 전체적으로 더 자연스럽고 맥락에 맞는 문장을 만들어낼 수 있다. Greedy는 첫 스텝의 지역 최적을 선택해 전역 최적 시퀀스를 놓친다.

또 다른 문제는 **반복**이다. Greedy는 특히 긴 시퀀스에서 같은 구절을 반복하는 "루프"에 빠지기 쉽다. 한번 반복이 시작되면, 그 반복된 내용이 다시 가장 높은 확률의 다음 토큰을 예측하는 악순환이 생긴다.

## Beam Search: 균형 잡힌 탐색

**Beam Search**는 Greedy와 완전 탐색의 중간을 찾는다. 매 스텝마다 **상위 k개(beam_width)의 부분 시퀀스(빔)를 유지**하고, 각 빔을 가능한 다음 토큰들로 확장한 뒤 전체 중 상위 k개를 다시 선택한다.

핵심은 **누적 로그 확률**을 기준으로 평가한다는 점이다:

$$\text{score}(t_1, \ldots, t_m) = \sum_{i=1}^{m} \log P(t_i \mid t_1, \ldots, t_{i-1})$$

이 방식으로 한 스텝에서 낮은 확률을 갖더라도, 전체 시퀀스 관점에서 더 좋은 경로가 살아남을 수 있다.

![Beam Search 트리 (beam_width=3)](/assets/posts/llm-decoding-beam-search.svg)

위 다이어그램에서 beam_width=3으로 설정된 Beam Search가 "The future of AI"를 최고 점수 시퀀스로 선택하는 과정을 볼 수 있다. Step 1에서 상위 3개("The", "A", "In")를 유지하고, Step 2에서 각 빔을 확장한 뒤 다시 상위 3개를 선택하며, "The great"처럼 중간에 좋지 않은 경로는 가지치기(pruning)된다.

### Beam Search의 문제점

Beam Search는 품질을 높이지만 두 가지 핵심 문제가 있다.

**다양성 부족:** beam_width=5라도 최종 출력들은 서로 매우 유사한 경향이 있다. 모든 빔이 비슷한 초기 경로로 수렴하기 때문이다. "다양한 5가지 대안"을 요청해도 거의 동일한 문장만 얻게 된다.

**반복 문제:** Beam Search도 반복에 취약하다. 특히 긴 시퀀스에서 "the the the"처럼 같은 n-gram이 반복된다. `no_repeat_ngram_size=2`처럼 이미 나온 n-gram을 금지하는 설정으로 완화할 수 있다.

**느린 속도:** beam_width만큼 더 많은 forward pass가 필요해 Greedy 대비 beam_width배 느리다.

## Diverse Beam Search

Vijayakumar et al. (2016)이 제안한 **Diverse Beam Search**는 일반 Beam Search의 다양성 문제를 해결한다. 빔들을 여러 **그룹(beam_groups)**으로 나누고, 각 그룹이 서로 다른 방향으로 탐색하도록 **다양성 패널티(diversity_penalty)**를 부여한다. 같은 그룹 내에서는 일반 Beam Search, 그룹 간에는 서로 다른 시퀀스를 생성하도록 유도한다.

## 실전 코드: 디코딩 방법 비교

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_name = "gpt2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

inputs = tokenizer("The future of AI is", return_tensors="pt")

# Greedy Decoding
greedy_out = model.generate(**inputs, max_new_tokens=30)

# Beam Search (beam_size=5)
beam_out = model.generate(
    **inputs,
    max_new_tokens=30,
    num_beams=5,
    no_repeat_ngram_size=2,
    early_stopping=True,
)

# Diverse Beam Search
diverse_out = model.generate(
    **inputs,
    max_new_tokens=30,
    num_beams=5,
    num_beam_groups=5,
    diversity_penalty=0.5,
)
```

`no_repeat_ngram_size=2`를 설정하면 2-gram 반복이 금지된다. `early_stopping=True`는 EOS 토큰이 나오면 조기 종료한다. `num_beams=num_beam_groups`로 설정하면 각 빔이 독립적인 그룹이 돼 최대 다양성을 얻는다.

![디코딩 방법 비교](/assets/posts/llm-decoding-comparison.svg)

## 길이 보정: Length Penalty

Beam Search에서 중요한 문제 중 하나는 **짧은 시퀀스 편향**이다. 누적 확률을 그대로 쓰면 $\log P(t_1 \ldots t_m) = \sum \log P(t_i)$이고, 각 $\log P < 0$이므로 시퀀스가 길수록 점수가 낮아진다. 즉 모델이 자연스럽게 짧은 출력을 선호하게 된다.

이를 보정하는 **Length Penalty** 파라미터가 있다. length_penalty=1.0이면 정규화 없음, length_penalty<1.0은 짧은 시퀀스 선호, length_penalty>1.0은 긴 시퀀스 선호다. 번역 태스크에서는 보통 length_penalty=0.9~1.2를 사용한다.

## 언제 무엇을 쓸 것인가

태스크 유형에 따른 디코딩 방법 선택 가이드를 정리한다.

**번역과 요약:** Beam Search (num_beams=4~6, no_repeat_ngram_size=3). 고품질의 결정적 출력이 필요하며, 다양성보다 정확도가 중요하다.

**창의적 글쓰기와 대화:** Nucleus Sampling (top_p=0.9, temperature=0.8). 다양하고 자연스러운 출력이 필요하다.

**여러 후보 생성(재순위화용):** Diverse Beam Search 또는 num_return_sequences와 Sampling 조합. 외부 Reranker 모델로 후보들을 다시 평가할 때 유용하다.

**코드 생성:** 낮은 Temperature Sampling 또는 Greedy. 정확성이 최우선이고 창의성은 불필요하다.

**긴 문서 생성:** Contrastive Search 또는 Sampling + Repetition Penalty. 반복 없이 긴 텍스트를 유창하게 생성해야 한다.

## 자동화된 선택: Speculative Decoding

2023년 이후 주목받는 **Speculative Decoding**은 디코딩 방법을 다른 각도에서 가속한다. 작은 드래프트 모델(draft model)이 여러 토큰을 빠르게 제안하면, 큰 타겟 모델(target model)이 한 번에 검증한다. 출력 품질은 타겟 모델과 동일하면서 속도는 2~4배 향상된다. 이는 "어떤 토큰을 선택하는가"보다 "어떻게 빠르게 선택하는가"의 최적화다.

디코딩 방법은 LLM을 실용적인 제품으로 만드는 핵심 엔지니어링 결정이다. 같은 모델을 사용하더라도 디코딩 전략에 따라 출력 품질과 특성이 크게 달라진다. 다음 글에서는 디코딩 방법과는 다른 차원의 문제, LLM이 근본적으로 갖는 한계와 환각(Hallucination)의 정체를 파고든다.

---

**지난 글:** [샘플링 전략: LLM 출력 제어의 과학](/posts/llm-sampling-strategies/)

**다음 글:** [LLM의 한계와 환각: AI가 틀리는 이유](/posts/llm-limits-and-hallucination/)

<br>
읽어주셔서 감사합니다. 😊
