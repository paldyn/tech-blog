---
title: "QLoRA: 4비트 양자화로 소비자 GPU에서 LLM 파인튜닝하기"
description: "QLoRA의 핵심 기법인 4-bit NF4 양자화, 이중 양자화, 페이지드 옵티마이저를 이해하고 bitsandbytes와 PEFT로 소비자 GPU에서 70B 모델도 파인튜닝하는 방법을 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["QLoRA", "4bit양자화", "NF4", "bitsandbytes", "PEFT", "파인튜닝"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-lora/)에서 LoRA의 수학적 원리와 실전 활용법을 완전히 해설했다. rank=16, alpha=32, 전체 Attention 모듈이라는 황금 레시피도 확인했다. 그런데 LoRA만으로는 여전히 해결되지 않는 문제가 있다. 베이스 모델 자체가 bf16으로 메모리에 올라가야 하기 때문에, 7B 모델도 베이스 가중치만 14GB를 차지한다. 24GB VRAM 안에서 베이스 모델(14GB) + 옵티마이저(수 GB) + 배치 활성화값을 모두 욱여넣으려면 배치 크기를 1로 줄이고 그래디언트 누적을 최대한 활용해야 한다. 13B 모델이라면 사실상 불가능에 가깝다. QLoRA는 이 한계를 4비트 양자화로 돌파한다.

## QLoRA란 무엇인가

QLoRA(Quantized Low-Rank Adaptation)는 2023년 Tim Dettmers et al.이 논문 "QLoRA: Efficient Finetuning of Quantized LLMs"에서 발표한 기법이다. 이름 그대로 **LoRA + Quantization**의 결합이다. 베이스 모델을 4비트로 양자화해 메모리를 대폭 줄이고, 그 위에서 LoRA 어댑터만 bf16으로 학습하는 방식이다.

핵심 아이디어는 간단하다. "학습하지 않는 베이스 모델을 왜 16비트로 유지해야 하는가?" 어차피 동결(frozen)되는 가중치라면 4비트로 압축해도 된다. 학습되는 LoRA 어댑터(B, A 행렬)는 여전히 bf16으로 유지하므로 그래디언트 계산에는 문제가 없다. 이 단순한 아이디어가 세 가지 기술적 혁신과 결합되어 소비자 GPU에서의 LLM 파인튜닝을 현실로 만들었다.

![QLoRA vs LoRA vs Full FT 메모리 비교](/assets/posts/finetuning-qlora-memory.svg)

## 핵심 기술 1: NF4 양자화

일반적인 양자화는 fp16의 값 범위를 균등하게 나누어 4비트(0~15)에 매핑한다. 하지만 이는 정보 이론적으로 최적이 아니다. 신경망 가중치의 분포가 균등하지 않기 때문이다. 실제 LLM 가중치는 **0 주변에 집중된 정규분포(Normal Distribution)에 가까운 형태**를 띤다.

**NF4(Normal Float 4-bit)**는 이 관찰을 활용한다. 정규분포에서 각 4비트 코드가 동일한 확률 질량을 갖도록 16개의 경계값을 배치한다. 즉 값이 많이 몰리는 0 근처에 더 많은 코드를 할당하고, 분포의 꼬리 부분에는 적은 코드를 쓴다. 이것이 바로 정보 이론적으로 최적인 코드북이다.

NF4는 같은 4비트를 쓰면서도 정규분포 데이터에 대해 fp4(균등 분할)보다 훨씬 낮은 양자화 오차를 달성한다. 구체적으로 QLoRA 논문은 NF4가 fp4, int4 대비 일관되게 낮은 perplexity를 기록함을 실험으로 증명했다.

## 핵심 기술 2: 이중 양자화 (Double Quantization)

4비트 양자화는 블록 단위로 진행된다. 예를 들어 64개 가중치를 하나의 블록으로 묶어 양자화하면, 각 블록마다 스케일 팩터(양자화 상수)를 하나씩 저장해야 한다. 이 상수는 fp32(32비트)로 저장된다. 블록 크기가 64라면 파라미터 하나당 32/64 = 0.5비트의 오버헤드가 생긴다.

**이중 양자화(Double Quantization)**는 이 양자화 상수 자체를 다시 양자화한다. fp32 상수를 int8(8비트)로 압축하면 (32-8)/64 = 0.375비트의 추가 절약이 가능하다. 70B 모델에서 70×10⁹ × 0.375비트 = 약 3.28GB의 추가 절약이 된다. 작아 보이지만, 이미 극한까지 압박된 VRAM에서 3GB는 배치 크기 하나 이상의 차이를 만든다.

## 핵심 기술 3: 페이지드 옵티마이저 (Paged Optimizer)

긴 시퀀스나 큰 배치를 처리할 때 GPU 메모리가 갑자기 부족해지는 OOM(Out-Of-Memory) 에러는 LLM 파인튜닝의 고질적인 문제다. 특히 배치 내 시퀀스 길이가 불균등한 경우 예측하기 어렵다.

**페이지드 옵티마이저**는 NVIDIA의 통합 메모리(Unified Memory) 기능을 활용해 이 문제를 해결한다. GPU VRAM이 부족해질 때 옵티마이저 상태(Adam의 1차·2차 모멘텀)를 자동으로 CPU RAM으로 **페이지 스왑**한다. 마치 운영체제가 RAM 부족 시 디스크 스왑을 쓰는 것과 같은 원리다. 이렇게 하면 OOM 에러 없이 학습이 계속 진행된다. 물론 스왑이 빈번하게 발생하면 속도가 느려지지만, 학습이 중단되는 것보다는 훨씬 낫다.

![QLoRA 세 가지 핵심 기술](/assets/posts/finetuning-qlora-technique.svg)

## BitsAndBytesConfig: QLoRA 설정의 시작

QLoRA는 Hugging Face의 `bitsandbytes` 라이브러리와 `transformers`의 연동을 통해 구현된다. 설정의 핵심은 `BitsAndBytesConfig`다.

```python
import torch
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,               # 4비트 양자화로 모델 로드
    bnb_4bit_quant_type="nf4",       # NF4 코드북 사용
    bnb_4bit_use_double_quant=True,  # 이중 양자화 활성화
    bnb_4bit_compute_dtype=torch.bfloat16,  # 연산은 bf16으로
)
```

`bnb_4bit_compute_dtype`을 `bfloat16`으로 설정하는 것이 중요하다. 가중치는 4비트로 저장하지만 실제 행렬 연산(matmul)은 bf16으로 수행한다. 4비트 정수끼리 직접 연산하면 정밀도 손실이 너무 크기 때문이다. 다시 말해 **저장은 4비트, 계산은 bf16**이다.

## 전체 QLoRA 파이프라인

이제 실제로 QLoRA를 적용하는 전체 파이프라인을 살펴보자.

```python
import torch
from transformers import (
    AutoModelForCausalLM, AutoTokenizer,
    BitsAndBytesConfig, TrainingArguments
)
from peft import LoraConfig, get_peft_model, TaskType, prepare_model_for_kbit_training
from trl import SFTTrainer
from datasets import load_dataset

# 1. 양자화 설정
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
)

# 2. 모델 로드 (4비트로)
model_id = "meta-llama/Llama-3.1-8B-Instruct"
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    quantization_config=bnb_config,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.pad_token = tokenizer.eos_token

# 3. kbit 학습을 위한 준비 (gradient checkpointing 활성화 등)
model = prepare_model_for_kbit_training(model)

# 4. LoRA 설정 (QLoRA에서도 동일하게 사용)
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 20,971,520 || all params: 8,051,232,768 || trainable%: 0.2604

# 5. 학습 설정 (페이지드 옵티마이저 포함)
training_args = TrainingArguments(
    output_dir="./qlora-finetuned",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,    # 유효 배치 = 16
    learning_rate=2e-4,
    bf16=True,
    logging_steps=10,
    save_strategy="epoch",
    warmup_ratio=0.03,
    optim="paged_adamw_8bit",         # 페이지드 옵티마이저
    gradient_checkpointing=True,      # 활성화 메모리 절약
)

# 6. 학습
dataset = load_dataset("your-dataset", split="train")
trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
    tokenizer=tokenizer,
    dataset_text_field="text",
    max_seq_length=2048,
)
trainer.train()

# 7. 저장 (어댑터만 저장됨)
trainer.save_model("./qlora-finetuned/final")
```

`prepare_model_for_kbit_training()`은 빠뜨리기 쉬운 중요한 단계다. 이 함수는 4비트 모델에서 그래디언트 체크포인팅을 안전하게 활성화하고, LayerNorm 레이어를 fp32로 유지하는 등 kbit 학습에 필요한 준비를 자동으로 처리한다.

## 실전: VRAM별 가능한 모델 크기

QLoRA를 사용하면 다음과 같은 조합이 현실적으로 가능하다.

| GPU | VRAM | 가능한 모델 | 배치 크기 |
|-----|------|------------|----------|
| RTX 4090 | 24GB | 7B~8B | 1~2 |
| RTX 4090 × 2 | 48GB | 13B | 2~4 |
| A6000 | 48GB | 13B~20B | 4~8 |
| A100 80GB | 80GB | 70B | 1~2 |
| A100 × 2 | 160GB | 70B | 4~8 |

특히 주목할 만한 것은 **단일 RTX 4090(24GB)으로 8B 모델 파인튜닝이 가능**하다는 점이다. QLoRA 이전에는 상상하기 어려운 조합이었다. 70B 모델도 A100 80GB 한 장으로 가능하다. 물론 배치 크기가 작아 학습이 느리지만, 불가능과 느림은 전혀 다른 이야기다.

## 주의점과 한계

QLoRA가 강력한 기법이지만, 알아야 할 트레이드오프도 존재한다.

**양자화 오차**: 베이스 모델을 4비트로 압축하면 필연적으로 정보 손실이 발생한다. NF4가 최적화되어 있다 해도 bf16 대비 표현력이 떨어진다. 이는 QLoRA 학습 결과가 (동일 rank로) LoRA보다 약간 낮은 성능을 보일 수 있음을 의미한다. 대부분의 경우 이 차이는 미미하지만, 성능이 매우 중요한 프로덕션 환경에서는 고려해야 한다.

**학습 불안정**: 4비트 양자화 상태에서 역전파가 진행되기 때문에 그래디언트 스케일이 불안정해질 수 있다. `gradient_checkpointing=True`, `max_grad_norm=0.3` 설정과 낮은 학습률(`1e-4 ~ 2e-4`)로 안정성을 높일 수 있다.

**merge 후 성능 손실**: `merge_and_unload()`로 어댑터를 병합한 뒤 모델을 다시 bf16으로 저장하면, 양자화 과정에서 발생한 오차가 고스란히 남는다. 프로덕션 추론 시에도 양자화된 상태로 서빙하거나, 병합 후 약간의 성능 손실을 감수해야 한다.

**속도**: 4비트 양자화는 메모리를 줄이는 대신 연산 속도가 bf16보다 느릴 수 있다. bitsandbytes의 CUDA 커널이 최적화되어 있지만, A100 같은 최신 GPU에서도 bf16 대비 10~30% 느린 경우가 있다. 학습 처리량(throughput)이 중요하다면 LoRA(bf16)가 더 적합할 수 있다.

## QLoRA vs LoRA: 무엇을 선택해야 하나

둘 사이의 선택은 단순하다. **VRAM이 충분하면 LoRA(bf16), VRAM이 부족하면 QLoRA(4bit).**

- GPU VRAM이 모델을 bf16으로 로드하기 충분하다 → LoRA
- GPU VRAM이 부족하거나, 더 큰 모델을 실험하고 싶다 → QLoRA
- 최고의 성능이 필요하고 GPU 비용을 아끼지 않아도 된다 → Full Fine-tuning

현실적으로 개인 연구자나 스타트업에서는 RTX 4090(24GB) 한두 장이 전부인 경우가 많다. 이 환경에서 7B~13B 모델을 파인튜닝하려면 QLoRA가 사실상 유일한 선택지다.

## 요약

QLoRA는 NF4 4비트 양자화, 이중 양자화, 페이지드 옵티마이저 세 가지 기술의 결합으로 소비자 GPU에서 LLM 파인튜닝을 현실화했다. 베이스 모델을 4비트로 압축해 메모리를 4분의 1로 줄이고, 그 위에 bf16의 LoRA 어댑터만 학습하는 방식이다. 24GB VRAM에서 8B 모델, 48GB에서 13B, 80GB에서 70B 파인튜닝이 가능하다. 양자화 오차와 약간의 속도 손실이라는 트레이드오프가 있지만, VRAM이 제한된 환경에서는 압도적으로 실용적인 선택이다.

다음 글에서는 LoRA·QLoRA와는 전혀 다른 접근법인 **Prefix Tuning과 P-Tuning**을 다룬다. 가중치가 아닌 입력 공간에 학습 가능한 토큰을 붙여 LLM을 조율하는 방식이다.

---

**지난 글:** [LoRA 완전 정복: 저랭크 어댑테이션의 수학과 실전](/posts/finetuning-lora/)

**다음 글:** [Prefix Tuning & P-Tuning: 접두사 토큰으로 LLM 조율하기](/posts/finetuning-prefix-tuning/)

<br>
읽어주셔서 감사합니다. 😊
