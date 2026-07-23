---
title: "Full Fine-tuning vs PEFT: 전체 파라미터 vs 효율적 파인튜닝 완전 비교"
description: "전체 파라미터를 학습하는 Full Fine-tuning과 극소수 파라미터만 학습하는 PEFT(LoRA, QLoRA, Adapter)의 원리와 차이, GPU 메모리 요구사항, 그리고 LoRA의 수학적 원리를 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["파인튜닝", "FullFineTuning", "PEFT", "LoRA", "QLoRA", "GPU메모리"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-overview/)에서 파인튜닝의 종류와 전체 파이프라인을 파악했다. 이번에는 Full Fine-tuning과 PEFT를 깊이 비교한다. 특히 현업에서 가장 널리 사용되는 **LoRA**의 수학적 원리를 이해하고, 실제로 어떻게 GPU 메모리를 절약하면서 Full Fine-tuning에 근접한 성능을 낼 수 있는지를 완전히 파악한다.

## Full Fine-tuning의 메모리 문제

7B 모델을 Full Fine-tuning할 때 GPU 메모리가 얼마나 필요한지 계산해보자.

- **모델 파라미터**: 7B × 2bytes(bf16) = 14GB
- **그래디언트**: 14GB (파라미터와 동일 크기)
- **옵티마이저 상태** (Adam): 14GB × 2 = 28GB
- **활성화 값(배치)**: 수 GB

합산하면 **60GB 이상**. A100 80GB 1개로 겨우 가능하다. 70B 모델은 몇 배 더 필요하다. 이 비용을 감당할 수 없는 대부분의 조직에게 PEFT는 필수다.

## LoRA의 수학적 원리

LoRA(Low-Rank Adaptation)는 2021년 Microsoft 연구팀이 제안했다. 핵심 아이디어는 단순하다.

기존 가중치 행렬 W(d×d)를 직접 업데이트하는 대신, **업데이트량 ΔW를 두 개의 저랭크 행렬 B(d×r)와 A(r×d)의 곱으로 표현**한다.

```text
W' = W + ΔW = W + B × A
```

여기서 r은 랭크(rank)로, 보통 4~64 사이의 작은 값이다. r=16, d=4096인 경우:
- Full: 4096 × 4096 = 16,777,216 파라미터
- LoRA: 4096 × 16 + 16 × 4096 = 131,072 파라미터 (0.78%)

학습 효율이 100배 이상 향상되는 것이다.

![LoRA 작동 원리](/assets/posts/finetuning-full-vs-peft-lora.svg)

## LoRA 구현

```python
from peft import LoraConfig, get_peft_model, TaskType
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "meta-llama/Meta-Llama-3-8B"
model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype="auto")
tokenizer = AutoTokenizer.from_pretrained(model_id)

lora_config = LoraConfig(
    r=16,                     # 랭크: 작을수록 효율적, 클수록 성능 높음
    lora_alpha=32,            # 스케일링: 보통 alpha = 2×r
    target_modules=[          # 어떤 레이어에 LoRA 적용?
        "q_proj",             # Query 투영
        "k_proj",             # Key 투영
        "v_proj",             # Value 투영
        "o_proj",             # Output 투영
        "gate_proj",          # FFN gate
        "up_proj",            # FFN up
        "down_proj",          # FFN down
    ],
    lora_dropout=0.05,        # 드롭아웃
    bias="none",              # Bias는 학습 안 함
    task_type=TaskType.CAUSAL_LM
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 83,886,080 || all params: 8,114,442,240 || trainable%: 1.034

# 학습 후: LoRA 가중치를 기반 모델에 병합 (추론 오버헤드 없음)
merged_model = model.merge_and_unload()
merged_model.save_pretrained("./merged_model")
```

## QLoRA: 더 적은 메모리로

QLoRA는 LoRA에 **4-bit 양자화**를 결합해 메모리를 더욱 줄인다.

```python
from transformers import BitsAndBytesConfig
import torch

# 4-bit 양자화 설정
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,              # 4-bit 로드
    bnb_4bit_compute_dtype=torch.bfloat16,   # 계산은 bfloat16
    bnb_4bit_use_double_quant=True,  # 이중 양자화 (메모리 추가 절약)
    bnb_4bit_quant_type="nf4"        # NF4 양자화 (일반 int4보다 좋음)
)

# 4-bit 양자화로 모델 로드
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3-8B",
    quantization_config=bnb_config,
    device_map="auto"
)

# gradient_checkpointing으로 활성화 메모리 추가 절약
model.gradient_checkpointing_enable()

# QLoRA = 4bit 양자화 모델 + LoRA 적용
from peft import prepare_model_for_kbit_training
model = prepare_model_for_kbit_training(model)
model = get_peft_model(model, lora_config)

# 7B 모델이 RTX 4090(24GB)에서도 파인튜닝 가능!
```

![Full Fine-tuning vs PEFT 비교](/assets/posts/finetuning-full-vs-peft-comparison.svg)

## 어떤 레이어에 LoRA를 적용해야 하는가

LoRA는 모든 레이어에 적용할 필요가 없다. 어디에 적용하느냐에 따라 효과가 다르다.

```python
# 최소 설정 (가장 효율적)
target_modules = ["q_proj", "v_proj"]  # Query와 Value만

# 표준 설정 (균형)
target_modules = ["q_proj", "k_proj", "v_proj", "o_proj"]

# 전체 설정 (최고 성능)
target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                  "gate_proj", "up_proj", "down_proj"]

# 실험 결과: q_proj + v_proj만으로도 성능의 90%이상 달성 가능
# FFN 레이어 추가 시 특히 지식 학습 능력 향상
```

## 실전 선택 기준

**QLoRA를 선택하는 경우**: 소비자 GPU(RTX 3090/4090)에서 7B~13B 모델 파인튜닝, 비용 최소화가 목표일 때.

**LoRA를 선택하는 경우**: A100/H100이 있고 속도가 중요할 때, 여러 태스크의 어댑터를 관리해야 할 때.

**Full Fine-tuning을 선택하는 경우**: 충분한 GPU가 있고 최고 성능이 필요할 때, 모델 전체의 근본적인 행동을 바꿔야 할 때.

```python
# 실용적인 GPU 예산별 권고
if gpu_memory < 24:  # RTX 4090 이하
    strategy = "QLoRA (4-bit)"
elif gpu_memory < 80:  # A100 40GB
    strategy = "LoRA (bf16)"
else:  # A100 80GB 이상
    strategy = "LoRA 또는 Full Fine-tuning 선택 가능"

# 대부분의 기업 프로젝트에서 QLoRA로 시작해
# 성능이 부족하면 LoRA, 여전히 부족하면 Full로 진화하는 것이 권고
```

LoRA와 QLoRA는 파인튜닝 민주화를 이끈 기술이다. 수십만 달러의 GPU 클러스터 없이도 강력한 도메인 특화 모델을 만들 수 있게 됐다. 다음 글에서는 LoRA의 심화 변형인 DoRA, rsLoRA 등 최신 PEFT 기법과 하이퍼파라미터 튜닝을 다룬다.

---

**지난 글:** [파인튜닝 완전 정복: 사전 학습 모델을 내 데이터로 특화하는 방법](/posts/finetuning-overview/)

**다음 글:** [LoRA 심화: DoRA·rsLoRA·LoftQ와 최적 하이퍼파라미터 찾기](/posts/finetuning-lora/)

<br>
읽어주셔서 감사합니다. 😊
