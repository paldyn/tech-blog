---
title: "텍스트 생성: 언어 모델이 글을 쓰는 방법"
description: "자동회귀 생성의 원리부터 Greedy·Beam Search·Top-k·Top-p·Temperature 디코딩 전략, 반복 패널티, perplexity 평가, 한국어 GPT 활용까지 텍스트 생성 기술의 전체 스펙트럼을 실전 코드로 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["텍스트생성", "언어모델", "GPT", "디코딩전략", "Top-p", "Beam Search", "자동회귀", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/nlp-machine-translation/)에서 한 언어를 다른 언어로 변환하는 기계 번역을 살펴봤다. 번역도 사실 "텍스트 생성"의 특수한 형태다. 이번에는 더 일반적인 의미의 **텍스트 생성(Text Generation)** 자체를 깊이 다룬다. "오늘 날씨가..."라는 프롬프트에서 시작해 모델이 어떻게 자연스러운 문장을 이어 쓰는지, 어떤 디코딩 전략이 어떤 상황에 적합한지, 그리고 품질을 어떻게 측정하는지를 코드와 함께 완전히 해설한다.

## 자동회귀 생성의 기본 원리

현대 텍스트 생성 모델의 핵심은 **자동회귀(Autoregressive)** 방식이다. 이전에 생성한 모든 토큰을 조건으로 삼아 다음 토큰의 확률 분포를 계산하고, 그 분포에서 하나를 선택하는 과정을 반복한다.

$$P(\text{텍스트}) = \prod_{i=1}^{n} P(\text{토큰}_i \mid \text{토큰}_1, \ldots, \text{토큰}_{i-1})$$

이 과정에서 핵심적인 결정이 바로 "어떻게 토큰을 선택할 것인가"다. 이것이 디코딩 전략이다.

![자동회귀 텍스트 생성 프로세스](/assets/posts/nlp-text-generation-process.svg)

## 디코딩 전략 완전 비교

### 1. Greedy Search

가장 단순한 방법. 매 스텝마다 확률이 가장 높은 토큰 하나만 선택한다. 빠르고 결정적이지만, 반복되는 패턴이 생기거나 단조로운 텍스트가 나오는 경향이 있다.

```python
# Greedy: do_sample=False, num_beams=1
output = model.generate(
    input_ids,
    max_new_tokens=50,
    do_sample=False,
)
```

### 2. Beam Search

상위 k개의 후보 시퀀스(빔)를 동시에 유지하며 진행하다가, 마지막에 전체 확률이 가장 높은 시퀀스를 반환한다. 번역·요약처럼 하나의 "최선" 답이 있을 때 적합하다. 창의적 생성에는 역설적으로 Beam Search보다 샘플링이 더 자연스러운 결과를 낸다.

```python
# Beam Search: do_sample=False, num_beams=4
output = model.generate(
    input_ids,
    max_new_tokens=100,
    num_beams=4,
    early_stopping=True,
    no_repeat_ngram_size=3,  # 3-gram 반복 방지
    length_penalty=1.0,       # 1.0=중립, >1.0=긴 문장 선호
)
```

### 3. Top-k Sampling

확률 상위 k개 토큰으로만 어휘를 제한한 뒤, 그 안에서 확률에 비례해 샘플링한다. `k=1`이면 Greedy와 동일, `k=50`이 일반적인 설정이다. 고정된 k 때문에 확률 분포가 균일할 때 너무 많은 후보를, 뾰족할 때 너무 적은 후보를 포함하는 문제가 있다.

### 4. Top-p (Nucleus) Sampling

누적 확률이 p에 도달할 때까지 확률 높은 토큰부터 포함해 동적 집합을 구성한다. 분포가 뾰족하면 작은 어휘 집합, 균일하면 큰 어휘 집합이 된다. LLM의 표준 디코딩 방식이다.

### 5. Temperature

소프트맥스 직전 로짓을 temperature T로 나눈다. T < 1이면 확률 분포가 더 뾰족해져 보수적인 선택을, T > 1이면 더 균일해져 창의적인 선택을 유도한다.

| Temperature | 특성 | 용도 |
|---|---|---|
| 0.3~0.5 | 매우 보수적 | 코드 생성, 사실 확인 |
| 0.7~0.9 | 균형 | 대화, 설명문 |
| 1.0~1.3 | 창의적 | 소설, 시 |

## 실전 구현

![GPT 텍스트 생성 구현 코드](/assets/posts/nlp-text-generation-code.svg)

```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

model_name = "skt/ko-gpt-trinity-1.2B-v0.5"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,  # GPU 메모리 절약
).cuda()

def generate(
    prompt: str,
    max_new_tokens: int = 200,
    temperature: float = 0.8,
    top_p: float = 0.9,
    repetition_penalty: float = 1.3,
) -> str:
    inputs = tokenizer(
        prompt,
        return_tensors="pt",
    ).to(model.device)

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            no_repeat_ngram_size=3,
            eos_token_id=tokenizer.eos_token_id,
            pad_token_id=tokenizer.eos_token_id,
        )

    # 프롬프트 부분 제거
    new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(new_tokens, skip_special_tokens=True)

# 창작 생성
story = generate(
    "봄비가 내리는 오후, 낡은 서점의 문을 열었다.",
    max_new_tokens=150,
    temperature=0.95,
)
print(story)

# 사실 서술 (보수적)
factual = generate(
    "대한민국의 수도는 서울이며,",
    max_new_tokens=50,
    temperature=0.3,
    top_p=0.8,
)
print(factual)
```

## 반복 패널티와 품질 제어

생성 텍스트의 가장 흔한 문제는 반복이다. "오늘 날씨가 좋아서 좋아서 좋아서..."처럼 루프에 빠진다.

```python
# 반복 제어 기법 조합
output = model.generate(
    input_ids,
    repetition_penalty=1.3,         # 이미 나온 토큰 확률 하향
    no_repeat_ngram_size=3,         # 3-gram 반복 하드 차단
    encoder_repetition_penalty=1.1, # 입력 프롬프트 복사 억제
)
```

`repetition_penalty` 값은 1.0(적용 안 함)~1.5(강한 억제) 사이를 사용하며, 너무 높으면 문법이 어색해진다.

## 평가: Perplexity

언어 모델의 기본 품질 지표는 **퍼플렉시티(Perplexity, PPL)**다. 모델이 테스트 텍스트를 얼마나 잘 "예측"하는지 측정한다. 낮을수록 좋다.

```python
import torch
import math

def compute_perplexity(model, tokenizer, text: str) -> float:
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    with torch.no_grad():
        loss = model(**inputs, labels=inputs["input_ids"]).loss
    return math.exp(loss.item())

# 예시
ppl = compute_perplexity(model, tokenizer, "오늘 날씨가 매우 맑다.")
print(f"PPL: {ppl:.2f}")
# 좋은 모델: 20~50 / 나쁜 모델: 100+
```

## 생성 품질 향상 팁

**프롬프트 엔지니어링이 첫 번째:** 생성 품질은 프롬프트 설계에 크게 의존한다. 원하는 스타일·길이·형식을 프롬프트에 구체적으로 명시하면 결과가 크게 달라진다.

**스트리밍 생성:** 긴 텍스트는 전체가 나올 때까지 기다리지 않고 토큰 단위로 스트리밍하면 사용자 경험이 크게 향상된다.

```python
from transformers import TextIteratorStreamer
import threading

streamer = TextIteratorStreamer(tokenizer, skip_prompt=True)
thread = threading.Thread(
    target=model.generate,
    kwargs={**inputs, "streamer": streamer, "max_new_tokens": 200}
)
thread.start()
for token in streamer:
    print(token, end="", flush=True)
```

**KV 캐시 활용:** 동일한 프롬프트로 여러 번 생성할 때 `past_key_values`를 재활용하면 연산량을 크게 줄일 수 있다.

텍스트 생성 기술은 LLM 시대의 핵심이다. 다음 글에서는 한 단계 더 나아가 대명사가 가리키는 대상을 추적하는 지시 해소(Coreference Resolution)를 다룬다.

---

**지난 글:** [기계 번역: 언어의 장벽을 넘는 기술](/posts/nlp-machine-translation/)

**다음 글:** [지시 해소: 대명사가 가리키는 것을 찾아라](/posts/nlp-coreference/)

<br>
읽어주셔서 감사합니다. 😊
