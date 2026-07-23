---
title: "LoRA 완전 정복: 저랭크 어댑테이션의 수학과 실전"
description: "LoRA(Low-Rank Adaptation)의 수학적 원리, rank/alpha 하이퍼파라미터 선택 전략, target_modules 설정, PEFT 라이브러리 실전 활용법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["LoRA", "PEFT", "파인튜닝", "LowRankAdaptation", "HuggingFace", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-full-vs-peft/)에서 Full Fine-tuning과 PEFT를 전체적으로 비교하며 LoRA가 왜 현업에서 가장 많이 쓰이는지 살펴봤다. 이번 글에서는 LoRA를 수학적 원리부터 실전 코드까지, 처음 접하는 사람도 완전히 이해할 수 있도록 처음부터 끝까지 해설한다. 단순히 "파라미터를 줄인다"는 말 너머에 있는 저랭크 분해의 직관, 그리고 rank·alpha·target_modules 세 가지 핵심 하이퍼파라미터를 어떻게 선택해야 하는지를 집중적으로 다룬다.

## LoRA가 해결하는 문제

7B 파라미터 모델을 Full Fine-tuning하면 파라미터(14GB)·그래디언트(14GB)·옵티마이저 상태(28GB, Adam 기준)를 합쳐 기본 56GB 이상의 GPU 메모리가 필요하다. A100 80GB 한 장으로는 간신히 돌아가지만, 일반 연구자와 엔지니어가 흔히 사용하는 RTX 4090(24GB)으로는 사실상 불가능하다.

LoRA(Low-Rank Adaptation)는 2021년 Microsoft Research의 Hu et al.이 제안한 방법으로, 이 문제를 매우 우아하게 해결한다. 핵심 아이디어는 "파인튜닝 중 발생하는 가중치 변화량(ΔW)이 실제로는 저랭크(low-rank) 구조를 갖는다"는 관찰에서 출발한다.

## LoRA의 수학: W' = W + B·A

사전학습된 모델의 특정 레이어에 가중치 행렬 **W ∈ ℝ^{d×d}**가 있다고 하자. Full Fine-tuning이라면 이 행렬 전체(d² 파라미터)를 업데이트한다. LoRA는 이 대신 **W의 변화량 ΔW를 두 개의 저랭크 행렬의 곱으로 근사**한다.

```text
W' = W + ΔW = W + B·A

여기서:
  A ∈ ℝ^{r×d}   (다운-프로젝션, 가우시안 초기화)
  B ∈ ℝ^{d×r}   (업-프로젝션, 0으로 초기화)
  r << d          (rank, 보통 4~64)
```

학습 시 **W는 완전히 동결(frozen)**되고, A와 B만 업데이트된다. d=4096, r=16이라면 기존 16,777,216개의 파라미터를 학습하는 대신 2×(4096×16) = 131,072개만 학습한다. 약 99.2% 절감이다.

**왜 B를 0으로 초기화하나?** 학습 시작 시 B·A = 0이 되어 ΔW=0에서 출발한다. 즉 파인튜닝 초기에는 원본 사전학습 모델과 동일한 출력을 내고, 학습이 진행될수록 B·A가 태스크에 맞게 조정된다. 이렇게 하면 학습 초기의 불안정성이 크게 줄어든다.

**스케일링**: 실제 적용 시에는 `(alpha / r) * B·A`를 더한다. 이 스케일 팩터가 바로 `lora_alpha`의 역할이다.

![LoRA rank별 파라미터 수 비교](/assets/posts/finetuning-lora-rank-comparison.svg)

## rank: 저랭크의 차원을 결정하는 핵심 하이퍼파라미터

rank(r)는 LoRA에서 가장 중요한 하이퍼파라미터다. r이 클수록 ΔW가 더 많은 정보를 담을 수 있지만, 파라미터 수도 비례해 늘어난다.

| rank | 추가 파라미터(d=4096, 단일 레이어) | 권장 시나리오 |
|------|----------------------------------|-------------|
| 4    | 32,768 (전체의 0.02%)            | 빠른 프로토타이핑, 언어 스타일 변환 |
| 8    | 65,536 (0.04%)                   | 단순 분류, 감성 분석 |
| 16   | 131,072 (0.08%)                  | **대부분의 태스크 권장** |
| 32   | 262,144 (0.16%)                  | 복잡한 도메인 적응, 코드 생성 |
| 64   | 524,288 (0.31%)                  | 수학 추론, 멀티태스크 |

실전에서 **rank=16이 가장 무난한 시작점**이다. rank를 올린다고 항상 성능이 좋아지지는 않는다. LoRA 논문의 실험에서도 rank=4~16 구간에서 성능이 수렴하는 경향을 보였다. rank를 올리는 것보다 **target_modules를 늘리는 것이 성능 향상에 더 효과적**인 경우가 많다.

## lora_alpha: 학습률과 함께 결정되는 스케일 팩터

`lora_alpha`(α)는 ΔW에 곱해지는 스케일 팩터를 결정한다. 실효 스케일 = `α / r`. 예를 들어 rank=16, alpha=32이면 스케일 = 2.0이다.

**실전 규칙**: alpha를 rank의 2배로 설정하는 것이 일반적인 권장값이다(`rank=16 → alpha=32`). 이 설정에서 스케일이 2.0으로 고정되어 학습률과의 상호작용이 직관적으로 유지된다.

alpha를 rank와 동일하게 설정(`rank=16, alpha=16`, 스케일=1.0)하면 보수적인 학습이 되고, alpha를 rank보다 크게 설정할수록 LoRA 어댑터의 영향력이 커진다. 단, alpha를 지나치게 키우면 학습 불안정으로 이어질 수 있다.

## target_modules: 어떤 레이어에 LoRA를 붙일 것인가

어떤 모듈에 LoRA 어댑터를 연결하느냐는 성능과 파라미터 수에 직접적인 영향을 미친다.

![LoRA target_modules 선택 전략](/assets/posts/finetuning-lora-target-modules.svg)

### Transformer의 핵심 모듈들

현대 LLM(LLaMA, Mistral, Qwen 등)의 Transformer 레이어는 크게 두 부분으로 나뉜다.

- **Multi-Head Attention**: `q_proj`, `k_proj`, `v_proj`, `o_proj`
- **Feed-Forward Network (FFN)**: `gate_proj`, `up_proj`, `down_proj` (SwiGLU 구조)

### 전략별 권장 사항

**전략 1 - 최소 (q, v만)**: `["q_proj", "v_proj"]`. 파라미터를 가장 적게 쓰는 전략이다. 언어 스타일 변환이나 단순 분류 같은 가벼운 태스크에서는 이것만으로도 충분한 경우가 많다. 빠른 실험에 적합하다.

**전략 2 - 전체 Attention (권장)**: `["q_proj", "k_proj", "v_proj", "o_proj"]`. 대부분의 태스크에서 가장 균형 잡힌 선택이다. Q·K·V를 모두 조정하면 어텐션 패턴 전체를 태스크에 맞게 재구성할 수 있고, O를 추가하면 어텐션 출력의 변환도 학습한다. **특별한 이유가 없다면 이 설정을 기본으로 사용하라.**

**전략 3 - Attention + FFN**: 모든 모듈에 LoRA를 붙이는 가장 공격적인 전략이다. 파라미터는 약 3배 늘어나지만, 복잡한 도메인 적응(수학, 코드, 전문 의학 지식 등)에서 성능 차이를 보인다.

## lora_dropout: 과적합 방지

`lora_dropout`은 LoRA 레이어에만 적용되는 드롭아웃 비율이다. **데이터셋이 작을수록 높게 설정**한다.

- 데이터 수천~수만 건: `0.05~0.1`
- 데이터 수십만 건 이상: `0.0` (드롭아웃 불필요)

## PEFT 라이브러리 전체 코드 예시

이제 실제로 Hugging Face PEFT 라이브러리를 사용해 LoRA를 적용하는 전체 파이프라인을 살펴보자.

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer
from datasets import load_dataset

# 1. 모델과 토크나이저 로드
model_id = "meta-llama/Llama-3.2-3B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)

# 2. LoRA 설정
lora_config = LoraConfig(
    r=16,                        # rank: 저랭크 차원
    lora_alpha=32,               # 스케일 팩터 (alpha/r = 2.0)
    target_modules=[             # 전체 Attention 모듈
        "q_proj", "k_proj", "v_proj", "o_proj"
    ],
    lora_dropout=0.05,           # 소규모 데이터 과적합 방지
    bias="none",                 # bias는 동결 (학습 안 함)
    task_type=TaskType.CAUSAL_LM,
)

# 3. PEFT 모델 생성
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 13,631,488 || all params: 3,225,786,368 || trainable%: 0.4227

# 4. 학습 설정
training_args = TrainingArguments(
    output_dir="./lora-finetuned",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,   # 유효 배치 = 16
    learning_rate=2e-4,              # LoRA는 Full FT보다 높은 LR 가능
    bf16=True,
    logging_steps=10,
    save_strategy="epoch",
    warmup_ratio=0.03,
)

# 5. SFT Trainer로 학습
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
```

## merge_and_unload(): 추론 최적화

학습이 끝난 LoRA 어댑터는 원본 모델과 별개로 저장된다. 추론 시 두 가지 옵션이 있다.

**옵션 1 - 어댑터를 분리된 상태로 사용**: PEFT 모델을 그대로 로드해 추론. 어댑터를 교체하기 쉽지만 매 forward pass마다 B·A 연산이 추가된다.

**옵션 2 - merge_and_unload()로 병합**: ΔW = B·A를 원본 W에 더한 뒤 어댑터를 제거한다. 추론 지연(latency)이 Full FT 모델과 동일해지므로 **프로덕션 배포 시 권장**된다.

```python
from peft import PeftModel

# 저장된 어댑터 로드
base_model = AutoModelForCausalLM.from_pretrained(
    model_id, torch_dtype=torch.bfloat16
)
model = PeftModel.from_pretrained(base_model, "./lora-finetuned/checkpoint-last")

# 가중치 병합 후 어댑터 제거
merged_model = model.merge_and_unload()

# 병합된 모델 저장 (일반 transformers 모델로 저장됨)
merged_model.save_pretrained("./merged-model")
tokenizer.save_pretrained("./merged-model")

# 이후에는 일반 모델처럼 사용
merged_model = AutoModelForCausalLM.from_pretrained("./merged-model")
```

## 실전 체크리스트: 최적 설정 선택하기

막상 LoRA를 처음 적용할 때 어떤 설정을 선택해야 할지 막막할 수 있다. 다음 순서로 결정하면 대부분의 경우 좋은 출발점을 찾을 수 있다.

1. **rank=16, alpha=32**로 시작한다. 이 조합이 가장 많은 케이스에서 안정적인 학습을 보여준다.
2. **target_modules=["q_proj","k_proj","v_proj","o_proj"]**로 전체 Attention을 커버한다.
3. **lora_dropout=0.05**, **bias="none"** 으로 고정한다.
4. 성능이 부족하면 먼저 **데이터 품질**을 점검한 후, target_modules에 FFN(gate/up/down)을 추가한다.
5. FFN 추가 후에도 부족하다면 rank를 32~64로 올리되, 학습 시간 증가를 감수해야 한다.

### 학습률 주의사항

LoRA는 Full Fine-tuning보다 학습률을 높게 설정해도 안정적인 경우가 많다. **`2e-4 ~ 3e-4` 구간이 일반적인 권장값**이다. Full Fine-tuning에서 흔히 쓰는 `1e-5 ~ 2e-5`보다 10배 이상 높다. 이는 동결된 W에 비해 B·A의 스케일이 훨씬 작기 때문에 더 큰 그래디언트 신호가 필요하기 때문이다.

## 요약

LoRA는 "파인튜닝 중 발생하는 가중치 변화량이 저랭크 구조를 갖는다"는 가정 위에, 원본 가중치를 동결한 채 두 저랭크 행렬 B와 A만 학습한다. 이로써 파라미터를 99% 이상 절약하면서도 Full Fine-tuning에 근접한 성능을 낼 수 있다. 실전에서는 **rank=16, alpha=32, 전체 Attention 모듈**이라는 조합이 가장 신뢰할 수 있는 기본값이다. 학습이 끝난 뒤에는 `merge_and_unload()`로 어댑터를 원본 모델에 병합해 추론 오버헤드를 없앤다.

다음 글에서는 LoRA에서 한 걸음 더 나아가, 4비트 양자화까지 결합한 **QLoRA**를 다룬다. QLoRA를 사용하면 소비자 GPU(RTX 4090, 24GB)에서도 13B 모델을 파인튜닝할 수 있고, 48GB VRAM으로는 70B 모델도 가능하다.

---

**지난 글:** [Full Fine-tuning vs PEFT: 전체 파라미터 vs 효율적 파인튜닝 완전 비교](/posts/finetuning-full-vs-peft/)

**다음 글:** [QLoRA: 4비트 양자화로 소비자 GPU에서 LLM 파인튜닝하기](/posts/finetuning-qlora/)

<br>
읽어주셔서 감사합니다. 😊
