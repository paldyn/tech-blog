---
title: "Temperature·Top-k·Top-p: 생성 다양성 제어"
description: "Temperature, Top-k, Top-p(nucleus) 세 가지 샘플링 파라미터의 원리와 효과, 확률 분포 스케일링 메커니즘, 그리고 태스크별 최적 파라미터 조합을 실전 코드와 함께 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["LLM", "Temperature", "Top-k", "Top-p", "NucleusSampling", "샘플링", "생성파라미터", "텍스트생성"]
featured: false
draft: false
---

[지난 글](/posts/llm-context-window/)에서 LLM이 한 번에 처리할 수 있는 정보의 양, 즉 컨텍스트 윈도우의 구조와 한계를 살펴봤다. 이번에는 그 컨텍스트 안에서 LLM이 다음 토큰을 **어떻게 선택하는가**를 제어하는 세 가지 핵심 파라미터인 Temperature, Top-k, Top-p를 다룬다. 이 파라미터들을 이해하면 "왜 같은 프롬프트에 다른 답이 나오는가"를 정확히 설명할 수 있고, 태스크에 맞는 최적의 생성 설정을 구성할 수 있다.

## 텍스트 생성의 기본 메커니즘

LLM은 매 스텝마다 어휘(vocabulary) 전체에 대한 **로짓(logit)** 벡터를 출력한다. 어휘 크기가 50,000이라면 50,000차원의 실수 벡터다. 이 로짓을 소프트맥스(Softmax) 함수로 변환하면 각 토큰이 다음에 올 확률 분포가 된다.

$$P(\text{토큰}_i) = \frac{e^{z_i}}{\sum_{j} e^{z_j}}$$

가장 단순한 방법인 **Greedy Decoding**은 이 중 확률이 가장 높은 토큰을 항상 선택한다. 결정적이지만 반복적이고 단조로울 수 있다. Temperature, Top-k, Top-p는 이 선택 과정에 다양성을 주입하는 방법들이다.

## Temperature: 분포의 날카로움을 조절

Temperature(T)는 로짓을 나눠서 확률 분포의 형태를 변형한다.

$$P_T(\text{토큰}_i) = \frac{e^{z_i / T}}{\sum_{j} e^{z_j / T}}$$

- **T < 1.0**: 분포를 더 날카롭게 만든다. 높은 확률 토큰의 우세가 강화된다. T → 0이면 Greedy와 동일.
- **T = 1.0**: 모델이 학습한 원본 분포 그대로 사용한다.
- **T > 1.0**: 분포를 평평하게 만든다. 낮은 확률 토큰도 선택될 기회가 생긴다. T → ∞이면 균등 분포(완전 무작위).

직관적으로 생각하면, Temperature는 모델의 "자신감"을 조절하는 슬라이더다. 낮은 Temperature는 "확실한 것만 말한다"이고, 높은 Temperature는 "조금 더 과감하게 말한다"다.

![Temperature 효과: 확률 분포 변화](/assets/posts/llm-temperature-distribution.svg)

위 그래프에서 동일한 로짓 분포에 T=0.3, T=1.0, T=2.0을 적용했을 때의 차이를 명확히 볼 수 있다. T=0.3에서는 토큰 A가 78%를 차지해 선택이 거의 확정되지만, T=2.0에서는 38%로 낮아지고 다른 토큰들도 20~30% 수준으로 올라온다.

## Top-k: 상위 k개 토큰만 고려

**Top-k 샘플링**은 확률이 높은 상위 k개 토큰만 남기고 나머지는 확률을 -∞로 설정(즉 제외)한 뒤, 이 k개 토큰 사이에서만 샘플링한다.

k=50으로 설정했다면, 5만 개 어휘 중 확률 상위 50개만 후보로 삼는다. 이렇게 하면 모델이 완전히 엉뚱한 토큰을 선택하는 것을 방지할 수 있다.

**Top-k의 한계:** k가 고정됐기 때문에 분포 형태가 달라져도 항상 동일한 수의 후보를 갖는다. 분포가 매우 집중돼 있어서 상위 3개가 99%를 차지하더라도 50개를 모두 유지하고, 반대로 분포가 극도로 평평해서 모든 토큰이 비슷한 확률을 가져도 50개만 선택한다. 이 경직성이 문제다.

## Top-p (Nucleus Sampling): 누적 확률로 동적 필터링

Holtzman et al. (2019)이 제안한 **Top-p 샘플링**(Nucleus Sampling)은 Top-k의 한계를 해결한다. 확률 높은 순서대로 토큰을 나열한 뒤, **누적 확률이 p를 초과하는 순간까지의 토큰** 집합("핵, nucleus")에서만 샘플링한다.

p=0.9라면, 상위 토큰들의 확률을 더해 나가다가 합이 0.9를 넘는 순간 거기까지만 후보로 삼는다. 분포가 집중되어 있으면 (상위 3개가 90%를 차지) 3개만 선택하고, 분포가 평평하면 20~30개를 선택한다. **분포 형태에 적응적**이다.

![Top-k vs Top-p 비교](/assets/posts/llm-top-k-top-p-comparison.svg)

## 세 파라미터 동시 적용

실제 코드에서 Temperature, Top-k, Top-p는 순서대로 적용된다.

```python
import torch
import torch.nn.functional as F

def sample_with_params(
    logits: torch.Tensor,
    temperature: float = 1.0,
    top_k: int = 0,
    top_p: float = 1.0,
) -> int:
    # Temperature 적용
    logits = logits / temperature

    # Top-k 필터
    if top_k > 0:
        values, _ = torch.topk(logits, top_k)
        logits[logits < values[-1]] = float('-inf')

    # Top-p (nucleus) 필터
    if top_p < 1.0:
        probs = F.softmax(logits, dim=-1)
        sorted_probs, idx = torch.sort(probs, descending=True)
        cumsum = torch.cumsum(sorted_probs, dim=-1)
        remove = cumsum - sorted_probs > top_p
        logits[idx[remove]] = float('-inf')

    probs = F.softmax(logits, dim=-1)
    return torch.multinomial(probs, num_samples=1).item()
```

적용 순서가 중요하다. Temperature로 분포를 먼저 변형한 후, Top-k로 절대적 수 제한, 이어서 Top-p로 누적 확률 제한을 적용한다. 세 필터를 함께 쓰면 각각의 극단적 동작을 완화할 수 있다.

## 태스크별 권장 설정

파라미터 선택은 생성 태스크의 특성에 따라 달라진다.

| 태스크 | Temperature | Top-k | Top-p | 설명 |
|---|---|---|---|---|
| 코드 생성 | 0.1~0.3 | 10~20 | 0.9 | 정확성 최우선 |
| 사실 답변 | 0.1~0.5 | - | 0.9 | 환각 최소화 |
| 대화 응답 | 0.7~0.9 | - | 0.9~0.95 | 자연스러움 |
| 창의적 글쓰기 | 0.9~1.2 | - | 0.95 | 다양성 최대화 |
| 시 / 소설 | 1.0~1.5 | - | 0.95~1.0 | 독창성 허용 |
| 요약 | 0.3~0.5 | - | 0.9 | 일관성 유지 |

**Top-k와 Top-p를 함께 쓸 때:** Top-k=50, Top-p=0.9처럼 설정하면, 먼저 상위 50개로 제한한 뒤 그 안에서 누적 90%까지만 쓴다. 두 필터가 모두 적용되므로 더 보수적인 선택이 된다.

## min-p: 최신 대안

2024년 등장한 **min-p 샘플링**은 최고 확률 토큰 대비 일정 비율 이상인 토큰만 남긴다. 예를 들어 min-p=0.05라면, 가장 높은 확률이 40%일 때 2% 이상인 토큰만 유지한다. Top-p보다 구현이 단순하면서도 비슷한 적응적 특성을 가져 최근 오픈소스 모델들에서 주목받고 있다.

## Repetition Penalty: 반복 억제

Temperature와 Top-p/k 외에 실무에서 자주 쓰이는 파라미터가 **Repetition Penalty**다. 이미 생성된 토큰은 다음 선택에서 확률을 낮춘다. 값이 1.0이면 적용 없음, 1.2~1.5면 반복 억제가 적당히 강해진다. 특히 긴 텍스트를 생성할 때 같은 문장이 반복되는 현상을 방지한다.

Temperature, Top-k, Top-p는 LLM API를 사용할 때 가장 먼저 마주치는 파라미터다. 이 세 가지를 조합하면 사실상 대부분의 생성 품질 문제를 해결할 수 있다. 다음 글에서는 더 넓은 관점에서 다양한 샘플링 전략들을 체계적으로 비교해본다.

---

**지난 글:** [컨텍스트 윈도우: LLM의 작업 기억](/posts/llm-context-window/)

**다음 글:** [샘플링 전략: LLM 출력 제어의 과학](/posts/llm-sampling-strategies/)

<br>
읽어주셔서 감사합니다. 😊
