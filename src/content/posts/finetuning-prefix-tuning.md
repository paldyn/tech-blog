---
title: "Prefix Tuning & P-Tuning: 접두사 토큰으로 LLM 조율하기"
description: "Prefix Tuning, P-Tuning v1/v2의 원리와 차이를 이해하고, LoRA와 비교해 언제 어떻게 사용하는지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["PrefixTuning", "PTuning", "PEFT", "소프트프롬프트", "파인튜닝", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-qlora/)에서 QLoRA가 4비트 양자화와 LoRA를 결합해 소비자급 GPU에서도 대형 모델을 파인튜닝할 수 있게 해준다는 사실을 살펴봤다. 이번에는 아예 다른 접근법을 다룬다. 모델 가중치 자체를 건드리지 않고, **입력 앞에 학습 가능한 "접두사 토큰"을 붙여** 모델의 동작을 바꾸는 방법들 — Prefix Tuning, P-Tuning v1, P-Tuning v2다. 이 계열의 방법들은 왜 등장했고, 어떤 원리로 작동하며, LoRA와 비교해 어떤 상황에서 더 유리한지 깊이 파악해보자.

## 프롬프트 엔지니어링의 한계, 그리고 Soft Prompt의 등장

GPT-3가 등장하면서 **In-Context Learning**이 주목받기 시작했다. 모델을 학습시키는 대신, 입력 앞에 몇 가지 예시(few-shot)나 자연어 지시문을 넣으면 모델이 원하는 방식으로 응답한다는 것이다. 이를 **Hard Prompt**라 부른다 — 사람이 읽을 수 있는 자연어 텍스트, 즉 이산적(discrete)인 토큰들의 나열이다.

Hard Prompt에는 근본적인 한계가 있다. 첫째, 자연어 어휘는 연속 공간이 아니라 불연속적이므로, 미분을 통한 최적화가 불가능하다. 둘째, "가장 좋은 프롬프트"를 사람이 직접 찾아야 하는데 이 탐색 공간은 천문학적으로 넓다. 셋째, 모델의 성능이 사람이 작성한 프롬프트 문구에 크게 의존하기 때문에 재현성이 낮다.

여기서 탄생한 아이디어가 **Soft Prompt**다. "프롬프트"를 자연어 텍스트가 아닌 **임베딩 공간의 연속 벡터**로 표현하고, 역전파로 직접 최적화하는 것이다. 모델 파라미터는 동결한 채, 이 소수의 벡터만 학습시킨다.

## Prefix Tuning: 모든 레이어에 접두사 삽입

**Prefix Tuning**은 2021년 Stanford의 Xiang Lisa Li와 Percy Liang이 제안했다(「Prefix-Tuning: Optimizing Continuous Prompts for Generation」). 핵심 아이디어는 입력 임베딩 레이어에만 소프트 프롬프트를 추가하는 것에서 한 발 더 나아가, **Transformer의 모든 레이어 Self-Attention의 Key·Value(KV)에 학습 가능한 접두사 벡터를 삽입**하는 것이다.

![Prefix Tuning 작동 원리](/assets/posts/finetuning-prefix-tuning-concept.svg)

### 수학적 구조

일반적인 Self-Attention은 입력 시퀀스 X로부터 K와 V를 만들고 그 위에서 Attention을 계산한다. Prefix Tuning에서는 각 레이어 l에 대해 학습 가능한 접두사 행렬 P_k^l과 P_v^l을 정의하고, 이를 K와 V 앞에 이어붙인다.

```text
# 일반 Self-Attention
Attention(Q, K, V) = softmax(QKᵀ / √d) V

# Prefix Tuning에서의 Self-Attention
K' = concat([P_k^l, K])
V' = concat([P_v^l, V])
Attention(Q, K', V') = softmax(Q(K')ᵀ / √d) V'
```

이렇게 하면 쿼리(Q)는 기존 입력 토큰뿐 아니라 **Prefix 토큰을 "참조"**할 수 있게 된다. Prefix 벡터들은 임베딩 공간의 어떤 위치든 자유롭게 이동할 수 있으므로, 모델의 행동을 유연하게 조종한다.

### 파라미터 수와 학습 방식

모델의 레이어 수를 L, 히든 차원을 d, Prefix 토큰 수를 m이라 하면, 전체 학습 파라미터 수는 `2 × L × m × d`다. GPT-2 medium(345M 파라미터, L=24, d=1024)에서 m=10으로 설정하면 약 491,520개, 전체 파라미터의 0.14%에 불과하다.

원 논문에서는 학습 안정성을 위해 Prefix 벡터를 직접 최적화하는 대신, **작은 MLP 네트워크를 통해 Prefix를 재매개변수화(reparameterize)**하고 학습 후에는 MLP를 버리는 방법을 사용했다.

### 성능

원 논문에서 GPT-2를 요약 태스크(XSum)에 적용했을 때, Full Fine-tuning보다 파라미터를 1000배 줄이면서도 유사한 ROUGE 점수를 달성했다. 특히 **데이터가 적은(few-shot) 환경에서 Full Fine-tuning보다 오히려 강점**을 보였다. 전체 파라미터를 업데이트하는 Full Fine-tuning은 소량 데이터에서 과적합되기 쉽지만, Prefix Tuning은 모델 가중치를 건드리지 않으므로 이 문제를 피할 수 있다.

## P-Tuning v1: 입력 레이어만 건드린다

같은 해인 2021년, 청화대학교와 MIT의 연구팀은 **P-Tuning**을 발표했다(「GPT Understands, Too」). P-Tuning v1의 전략은 조금 다르다. Prefix Tuning처럼 모든 레이어의 KV에 삽입하는 대신, **입력 임베딩 레이어에만** 학습 가능한 프롬프트 임베딩을 삽입한다.

더불어 이 프롬프트 임베딩을 단순한 파라미터 벡터가 아니라 **작은 LSTM 또는 MLP로 생성**한다. 이를 통해 프롬프트 임베딩들 사이의 상호 의존성을 반영하고, 최적화를 안정화한다.

```python
# P-Tuning v1 개념적 구조
import torch
import torch.nn as nn

class PromptEncoder(nn.Module):
    def __init__(self, token_dim, num_tokens, hidden_size):
        super().__init__()
        self.embedding = nn.Embedding(num_tokens, token_dim)
        # LSTM으로 토큰 간 의존성 모델링
        self.lstm = nn.LSTM(
            input_size=token_dim,
            hidden_size=hidden_size // 2,
            batch_first=True,
            bidirectional=True
        )
        self.mlp = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, token_dim)
        )

    def forward(self, indices):
        x = self.embedding(indices)         # [B, num_tokens, token_dim]
        x, _ = self.lstm(x)                # [B, num_tokens, hidden_size]
        x = self.mlp(x)                    # [B, num_tokens, token_dim]
        return x                            # 이 임베딩을 입력 앞에 붙임
```

P-Tuning v1의 주된 기여는 **GPT 계열 모델도 NLU(자연어 이해) 태스크를 잘 풀 수 있음**을 보인 것이다. 당시 GPT 계열은 NLG(생성) 중심이고 BERT 계열이 NLU에서 우세하다는 통념이 있었는데, P-Tuning을 적용한 GPT는 SuperGLUE 벤치마크에서 BERT를 능가하는 결과를 냈다.

## P-Tuning v2: 모든 레이어로 확장

2022년에 나온 **P-Tuning v2**(「P-Tuning v2: Prompt Tuning Can Be Comparable to Fine-tuning Universally Across Scales and Tasks」)는 v1의 한계를 보완한다. v1은 입력 레이어에만 프롬프트를 삽입하기 때문에, 모델이 깊어질수록 Prefix 신호가 희석되어 성능이 떨어지는 문제가 있었다. v2는 이를 Prefix Tuning처럼 **모든 레이어에 학습 가능한 프롬프트를 삽입**하는 방식으로 해결한다.

구조적으로 보면 P-Tuning v2는 Prefix Tuning과 매우 유사하다. 차이점은 주로 목적과 적용 대상이다. Prefix Tuning은 주로 GPT 계열 NLG 태스크에 초점을 맞췄지만, P-Tuning v2는 **BERT 계열을 포함한 다양한 규모의 모델, NLU·NER·QA 등 시퀀스 레이블링 태스크**에서의 효과를 광범위하게 검증했다.

![PEFT 방법론 비교: Prefix Tuning vs P-Tuning vs LoRA](/assets/posts/finetuning-prefix-tuning-comparison.svg)

## PEFT 라이브러리로 구현하기

HuggingFace PEFT 라이브러리는 Prefix Tuning과 P-Tuning을 모두 지원한다.

```python
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from peft import (
    PrefixTuningConfig,
    PromptTuningConfig,
    PromptEncoderConfig,
    TaskType,
    get_peft_model,
)

# ── Prefix Tuning 설정 ──────────────────────────────────────────
prefix_config = PrefixTuningConfig(
    task_type=TaskType.SEQ_2_SEQ_LM,   # 생성 태스크 (T5, BART 등)
    num_virtual_tokens=20,             # prefix 토큰 수
    encoder_hidden_size=512,           # reparameterization MLP 크기
    prefix_projection=True,            # MLP 재매개변수화 사용
)

# ── P-Tuning v2 설정 ────────────────────────────────────────────
ptuning_config = PromptEncoderConfig(
    task_type=TaskType.SEQ_CLS,        # 분류 태스크
    num_virtual_tokens=20,
    encoder_hidden_size=128,           # LSTM/MLP 히든 크기
)

# ── 모델 로드 및 PEFT 적용 ──────────────────────────────────────
model_name = "google/flan-t5-base"
base_model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Prefix Tuning 모델 생성
peft_model = get_peft_model(base_model, prefix_config)
peft_model.print_trainable_parameters()
# trainable params: 491,520 || all params: 247,577,856 || trainable%: 0.1985

# 학습 방법은 일반 파인튜닝과 동일
# Trainer나 직접 학습 루프 사용 가능
```

학습 후 모델을 저장하고 불러오는 것도 간단하다.

```python
# 저장: adapter 가중치만 별도 저장 (용량 매우 작음)
peft_model.save_pretrained("./my-prefix-tuning-adapter")

# 불러오기
from peft import PeftModel
loaded_model = PeftModel.from_pretrained(
    base_model,
    "./my-prefix-tuning-adapter"
)
loaded_model.eval()

# 추론
inputs = tokenizer("요약해 주세요: ...", return_tensors="pt")
with torch.no_grad():
    outputs = loaded_model.generate(**inputs, max_new_tokens=100)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

## LoRA 대비 Prefix Tuning의 장단점

### Prefix Tuning의 장점

**멀티태스크 분기가 쉽다.** 기본 모델을 공유하고 태스크별로 Prefix 가중치만 교체하면 된다. 동일한 모델에 Prefix 10개를 준비해두면 10가지 태스크를 지원할 수 있다. 반면 LoRA는 이론상 가능하지만 동적 전환 구현이 더 복잡하다.

**추론 시 시퀀스 의존성이 낮다.** Prefix 벡터는 미리 계산해 KV 캐시에 넣어두면 되므로, 동일한 Prefix를 여러 요청에 재사용할 때 효율적이다.

**입력을 직접 수정하지 않는다.** Prefix는 KV 내부에 삽입되므로, 실제 입력 토큰 시퀀스 구조를 바꾸지 않는다. 토큰 제한이 엄격한 환경에서 유리할 수 있다.

### Prefix Tuning의 단점

**시퀀스 길이가 증가한다.** Prefix 토큰 수(m)만큼 각 레이어에서 처리해야 할 KV 길이가 늘어난다. m=20이면 모든 Attention 연산에서 20개 토큰을 추가로 처리하므로, 긴 시퀀스에서는 추론 속도와 메모리에 영향을 준다.

**LoRA보다 성능이 대체로 낮다.** 다양한 벤치마크에서 LoRA가 Prefix Tuning보다 같거나 더 나은 성능을 보이는 경우가 많다. 특히 대규모 생성 태스크에서 이 차이가 두드러진다.

**구현이 더 복잡하다.** LoRA는 개념적으로 단순하고 모든 선형 레이어에 쉽게 적용할 수 있다. Prefix Tuning은 Attention 레이어 내부 KV를 수정해야 하므로, 커스텀 구현 시 Attention 코드를 직접 건드려야 한다.

**안정적 학습을 위한 MLP 재매개변수화가 필요하다.** 직접 Prefix 벡터를 최적화하면 학습이 불안정해지는 경우가 많아 MLP를 통한 간접 최적화가 필요하다. 이는 추가적인 구현 복잡도를 낳는다.

## 언제 Prefix Tuning/P-Tuning을 선택할까?

다음 상황에서 Prefix Tuning 계열을 고려할 만하다.

**하나의 대형 모델로 여러 태스크를 서빙해야 할 때.** API 서비스처럼 모델 인스턴스 하나를 메모리에 올려두고, 요청마다 다른 태스크를 처리해야 한다면, Prefix를 교체하는 방식이 깔끔하다. LoRA 가중치를 병합하면 태스크별 모델 복사본이 필요해진다.

**NLU 분류 태스크, 특히 데이터가 적을 때.** P-Tuning v2는 NER, 질문 응답, 의미 분류 같은 태스크에서 강점을 보이며, 소량 데이터에서 Full Fine-tuning보다 과적합이 덜하다.

**기본 모델을 변경하지 않고 실험을 빠르게 반복해야 할 때.** Prefix 가중치만 저장하면 되므로 저장 공간이 매우 작다. 다양한 설정을 실험하기에 유리하다.

반대로, **생성 품질이 최우선이거나 단일 태스크에 집중적으로 파인튜닝해야 한다면 LoRA(또는 QLoRA)가 더 나은 선택**이다. 현재 업계 트렌드는 LoRA와 그 변형들(DoRA, LoRA+, rsLoRA 등)이 주류를 이루고 있으며, Prefix Tuning은 멀티태스크 분기가 필요한 특수한 서빙 아키텍처에서 주로 활용된다.

## 정리

Prefix Tuning과 P-Tuning은 "모델 파라미터를 건드리지 않고 입력 공간을 조작한다"는 PEFT의 한 축을 대표한다. Prefix Tuning(2021)은 전 레이어 KV에 학습 가능한 접두사를 삽입해 강력한 제어력을 확보했고, P-Tuning v1(2021)은 입력 레이어에만 LSTM/MLP 기반 소프트 프롬프트를 적용해 NLU에서 GPT 계열의 잠재력을 끌어냈으며, P-Tuning v2(2022)는 이를 모든 레이어로 확장해 더 안정적인 성능을 이끌어냈다.

LoRA가 범용성과 성능에서 앞서지만, 동일한 모델 위에서 여러 태스크를 동적으로 분기해야 하는 시나리오에서는 Prefix 계열의 접근법이 여전히 매력적인 선택지다. 다음 글에서는 또 다른 PEFT 방법인 **Adapter**를 살펴본다. Adapter는 Transformer 레이어 내부에 소형 병목(bottleneck) 모듈을 삽입하는 방식으로, Prefix Tuning과는 또 다른 설계 철학을 갖고 있다.

---

**지난 글:** [QLoRA: 4비트 양자화로 소비자 GPU에서 LLM 파인튜닝하기](/posts/finetuning-qlora/)

**다음 글:** [Adapter: 트랜스포머 레이어에 소형 모듈을 삽입하는 파인튜닝](/posts/finetuning-adapter/)

<br>
읽어주셔서 감사합니다. 😊
