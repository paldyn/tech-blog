---
title: "투기적 디코딩: LLM 추론 속도를 2~4배 높이는 기술"
description: "Draft Model과 Target Model로 LLM 추론을 가속하는 투기적 디코딩의 원리, Rejection Sampling 수락 알고리즘, Medusa·EAGLE·Prompt Lookup 변형 완전 해설."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["투기적디코딩", "Speculative Decoding", "EAGLE", "Medusa", "LLM추론", "추론가속"]
featured: false
draft: false
---

[지난 글](/posts/pruning/)에서 불필요한 가중치를 제거해 모델을 압축하는 프루닝을 다뤘다. 이번에는 모델 자체는 그대로 두면서 추론 속도를 극적으로 높이는 **투기적 디코딩(Speculative Decoding)**이다. LLM 추론의 근본적 병목을 우회하는 이 기법은 2~4배 속도 향상을 모델 품질 손실 없이 달성한다. GPT-4, Claude 같은 상용 서비스에서도 이미 사용하는 기술이다.

## LLM 추론의 근본 병목

자기회귀(autoregressive) 생성의 본질적 한계를 이해해야 투기적 디코딩이 왜 효과적인지 납득할 수 있다.

LLM은 토큰을 한 번에 하나씩만 생성한다. 100개 토큰을 생성하려면 100번의 Forward Pass가 필요하다. 각 Forward Pass에서 GPU는 수십~수백 기가바이트의 가중치를 메모리에서 읽어야 한다. 문제는 이 과정이 **메모리 대역폭(memory bandwidth) 제한**을 받는다는 것이다. GPU의 계산 유닛(FLOP)은 충분히 빠르지만, 메모리에서 가중치를 읽는 속도가 병목이다. 배치 크기 1로 70B 모델을 추론할 때 GPU 계산 자원의 10~20%만 사용하는 이유다.

## 투기적 디코딩의 핵심 아이디어

**Leviathan et al. (2023)**과 **Chen et al. (2023)**이 거의 동시에 제안한 이 기법의 아이디어는 단순하다.

1. 작고 빠른 **Draft Model**이 K개 토큰을 자기회귀 방식으로 생성한다.
2. 크고 느린 **Target Model**이 K+1 위치를 **단 1번의 Forward Pass**로 동시 검증한다.
3. Target 분포와 Draft 분포를 비교해 토큰을 수락하거나 거부한다.

핵심은 2번이다. Target Model이 K+1 위치를 "한 번에" 검증할 수 있다는 것이다. Transformer의 어텐션은 병렬 처리가 가능하기 때문이다. 70B 모델의 1회 Forward Pass 비용은 7B 모델의 10회와 비슷하지 않다. 메모리 대역폭 관점에서 배치가 커져도 비용이 선형으로 늘지 않기 때문이다.

![투기적 디코딩 동작 흐름](/assets/posts/speculative-decoding-flow.svg)

## 수락 알고리즘: 품질은 반드시 보장된다

투기적 디코딩이 매력적인 이유는 속도만이 아니다. **출력 분포가 Target Model과 수학적으로 동일함이 보장된다**. Rejection Sampling 기반의 수락 알고리즘이 이를 보장한다.

토큰 `x`를 수락하는 확률은 다음과 같다.

```
P(accept x) = min(1, p_target(x) / p_draft(x))
```

Target이 해당 토큰을 더 높게 평가하면(p_target > p_draft) 항상 수락한다. Draft가 더 높게 평가한 토큰은 확률적으로 거부한다. 거부 시에는 `p_target(x) - p_draft(x)`의 잔여 분포에서 재샘플링한다. 이 과정을 거치면 수락된 토큰의 분포가 Target과 일치함이 증명된다.

```python
import torch

def speculative_step(target_logits, draft_logits, draft_tokens, temperature=1.0):
    """
    target_logits: [K+1, V] - Target의 K+1 위치 logits
    draft_logits:  [K, V]   - Draft의 K 위치 logits
    draft_tokens:  [K]      - Draft가 선택한 토큰
    """
    accepted = []
    for i in range(len(draft_tokens)):
        tok = draft_tokens[i]
        p_t = torch.softmax(target_logits[i] / temperature, dim=-1)
        p_d = torch.softmax(draft_logits[i] / temperature, dim=-1)

        accept_prob = min(1.0, (p_t[tok] / p_d[tok]).item())
        if torch.rand(1).item() < accept_prob:
            accepted.append(tok)
        else:
            # 거부: 잔여 분포에서 재샘플
            residual = torch.clamp(p_t - p_d, min=0)
            residual /= residual.sum()
            new_tok = torch.multinomial(residual, 1).item()
            accepted.append(new_tok)
            break  # 거부 시 이 위치까지만 수락

    # 마지막 Target 위치에서 추가 토큰 하나 생성
    bonus = torch.multinomial(
        torch.softmax(target_logits[len(accepted)] / temperature, dim=-1), 1
    ).item()
    accepted.append(bonus)
    return accepted
```

## 실전: Hugging Face Transformers로 투기적 디코딩

Transformers 4.40 이후 `assistant_model` 인자로 투기적 디코딩을 쉽게 사용할 수 있다.

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# Target: 큰 모델
target_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-70B-Instruct",
    torch_dtype=torch.float16,
    device_map="auto",
)
# Draft: 같은 계열 소형 모델
draft_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-7B-Instruct",
    torch_dtype=torch.float16,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-70B-Instruct")

inputs = tokenizer("한국의 주요 산업을 설명해줘", return_tensors="pt").to("cuda")

# 투기적 디코딩: assistant_model 인자만 추가
output = target_model.generate(
    **inputs,
    assistant_model=draft_model,    # Draft로 speculative 실행
    max_new_tokens=512,
    temperature=0.7,
    do_sample=True,
)
print(tokenizer.decode(output[0], skip_special_tokens=True))
```

## 변형 기법들

![투기적 디코딩 변형과 속도 향상](/assets/posts/speculative-decoding-variants.svg)

### Medusa: 멀티 헤드 Draft

별도 Draft 모델 없이, Target 모델의 마지막 레이어 위에 **K개의 추가 예측 헤드**를 붙인다. 각 헤드가 미래 위치를 동시에 예측한다. 추가 헤드만 훈련하면 되므로 구현이 단순하다.

```python
# Medusa 설치 및 사용
# pip install medusa-llm
from medusa.model.medusa_model import MedusaModel

model = MedusaModel.from_pretrained(
    "FasterDecoding/medusa-vicuna-7b-v1.5",
    torch_dtype=torch.float16,
    device_map="auto",
)
```

### Prompt Lookup Decoding: 외부 모델 없이

입력 프롬프트 자체를 Draft 소스로 사용한다. LLM이 프롬프트 내용을 복사하는 경향을 이용한다. 문서 요약, RAG, 코드 완성처럼 입력-출력 간 중복이 많은 태스크에서 2~4배 속도 향상이 가능하다. 추가 모델이 전혀 필요 없다.

```python
# Prompt Lookup: num_assistant_tokens만 설정
output = model.generate(
    **inputs,
    prompt_lookup_num_tokens=10,   # 프롬프트에서 찾을 토큰 수
    max_new_tokens=512,
)
```

### EAGLE: 피처 레벨 Draft

EAGLE(Extrapolation Algorithm for Greater Language-model Efficiency)은 Target 모델의 피처(hidden state)를 활용해 Draft를 생성한다. 단순한 소형 모델 대신 Target의 특징을 학습한 경량 Draft 레이어를 사용해 수락률을 극대화한다. 오픈소스 구현에서 Vicuna-7B를 기준으로 3~4배 속도 향상을 보고했다.

## 속도 향상이 없는 경우

투기적 디코딩이 효과적이지 않은 상황도 있다.

- **배치 크기가 클 때**: Batch size > 8 이상이면 GPU가 이미 포화 상태라 이점이 줄어든다.
- **Draft 수락률이 낮을 때**: Draft와 Target의 분포 차이가 크면 매번 거부되어 오히려 느려진다.
- **짧은 생성**: 오버헤드 대비 이익이 작다.
- **양자화된 Target**: 이미 빠른 모델이라면 이점이 줄어든다.

## 정리

투기적 디코딩은 LLM 추론 최적화에서 가장 우아한 기법 중 하나다.

- **수학적 품질 보장**: Target 분포와 동일한 출력
- **2~4배 속도 향상**: 배치 크기 1 환경에서 실측
- **다양한 변형**: Draft 모델 선택 없이도 적용 가능 (Medusa, Prompt Lookup)
- **서비스 친화적**: 클라이언트 측 변경 없이 서버에서 투명하게 적용

다음 글에서는 LLM 추론 엔진 전체 생태계를 비교한다. vLLM, TGI, llama.cpp, Ollama 등 다양한 선택지에서 무엇을 골라야 하는지 기준을 제시한다.

---

**지난 글:** [모델 프루닝: 신경망의 불필요한 가중치 제거하기](/posts/pruning/)

**다음 글:** [LLM 추론 엔진 완전 비교: vLLM·TGI·llama.cpp·Ollama](/posts/inference-engines/)

<br>
읽어주셔서 감사합니다. 😊
