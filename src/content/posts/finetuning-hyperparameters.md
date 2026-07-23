---
title: "파인튜닝 하이퍼파라미터: 최적 설정 완전 가이드"
description: "LLM 파인튜닝 시 learning rate, batch size, epoch, warmup, gradient accumulation 등 핵심 하이퍼파라미터의 역할과 최적값 선택법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["파인튜닝", "하이퍼파라미터", "LearningRate", "BatchSize", "TrainingArguments", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-data-prep/)에서 파인튜닝에 필요한 데이터 형식과 품질 관리 파이프라인을 완전히 파악했다. 이제 데이터가 준비됐다면 다음 단계는 **하이퍼파라미터 설정**이다. 학습률을 조금만 잘못 설정해도 모델이 발산하거나 과적합에 빠진다. 이 글에서는 LLM 파인튜닝의 핵심 하이퍼파라미터 각각의 역할과 최적값 선택 전략을 체계적으로 정리한다.

## 왜 하이퍼파라미터가 중요한가

일반적인 기계학습과 달리 LLM 파인튜닝은 **이미 수조 개의 토큰으로 사전학습된 모델**을 출발점으로 한다. 이 모델이 가진 지식을 파괴하지 않으면서 새로운 능력을 추가하는 것이 목표다. 그래서 사전학습보다 훨씬 낮은 학습률, 짧은 훈련 기간, 신중한 정규화가 필요하다. 하이퍼파라미터 설정은 사전학습 지식 보존과 새로운 태스크 적응 사이의 **균형 조율**이다.

## Learning Rate: 파인튜닝의 가장 중요한 파라미터

![Learning Rate Schedule: 파인튜닝의 핵심](/assets/posts/finetuning-hyperparameters-lr.svg)

### 적절한 LR 범위

LLM 파인튜닝에서 권장하는 학습률은 **1e-5 ~ 3e-4** 범위다. 사전학습 시 사용하는 1e-4 ~ 3e-3보다 약 10배 낮다. 이유는 명확하다. 너무 높은 LR은 사전학습에서 형성된 파라미터 구조를 파괴하고(catastrophic forgetting), 너무 낮은 LR은 수렴이 너무 느려 실용적이지 않다.

- **LoRA 파인튜닝**: 1e-4 ~ 3e-4 (adapter 파라미터만 학습)
- **Full Fine-tuning**: 1e-5 ~ 5e-5 (전체 파라미터 학습)
- **분류 헤드만 학습**: 1e-3 ~ 1e-2 (상위 레이어만 변경)

### LR Finder로 최적값 탐색

경험적 범위 외에 **LR Range Test**를 사용하면 데이터셋에 최적화된 LR을 찾을 수 있다. 매우 작은 LR에서 시작해 점진적으로 올리면서 손실이 줄어드는 구간의 중간값을 선택한다.

```python
from torch.optim.lr_scheduler import OneCycleLR
from transformers import Trainer, TrainingArguments

# LR Finder를 대신하는 실용적 방법:
# 후보 LR 3개로 짧은 실험 후 선택
for lr in [1e-5, 5e-5, 2e-4]:
    args = TrainingArguments(
        output_dir=f"./test_lr_{lr}",
        num_train_epochs=1,          # 1 epoch만 테스트
        learning_rate=lr,
        per_device_train_batch_size=4,
        logging_steps=50,
        report_to="none",
    )
    # 훈련 후 validation loss 비교
```

### Warmup: 안정적인 시작을 위한 준비 운동

Warmup은 학습 초반에 LR을 0에서 목표값까지 선형으로 증가시키는 기법이다. 파인튜닝 초기에 랜덤 초기화된 adapter 레이어(LoRA의 경우 행렬 B)가 갑작스럽게 큰 그래디언트를 발생시키는 것을 방지한다.

권장 warmup 비율은 전체 훈련 스텝의 **3~10%**다. 데이터가 적을수록, 학습률이 높을수록 더 긴 warmup이 필요하다.

```python
# 전체 스텝 계산
total_steps = (len(train_dataset) // effective_batch_size) * num_epochs
warmup_steps = int(total_steps * 0.05)  # 5% warmup
print(f"총 스텝: {total_steps}, Warmup 스텝: {warmup_steps}")
```

## Batch Size와 그래디언트 누적

### 실효 배치 크기 (Effective Batch Size)

LLM 파인튜닝에서는 큰 배치 크기가 안정적인 그래디언트 추정과 빠른 수렴에 도움을 준다. 하지만 GPU 메모리 한계로 인해 직접 큰 배치를 사용하기 어렵다. 이때 **그래디언트 누적(Gradient Accumulation)**을 활용한다.

```text
실효 배치 크기 = per_device_batch × gradient_accumulation × num_gpus
```

예시: A100 1개에서 per_device=4, accumulation=8 → 실효 배치 = **32**

권장 실효 배치 크기는 **32~128** 사이다. 너무 작으면(1~4) 그래디언트 노이즈가 커서 불안정하고, 너무 크면(256+) 일반화 성능이 저하될 수 있다(sharp minima 수렴).

### 그래디언트 누적 구현 원리

```python
# 수동 그래디언트 누적 (개념 이해용)
optimizer.zero_grad()
accumulation_steps = 8

for step, batch in enumerate(dataloader):
    outputs = model(**batch)
    loss = outputs.loss / accumulation_steps  # 스케일 조정
    loss.backward()  # 그래디언트 누적 (zero_grad 없음)

    if (step + 1) % accumulation_steps == 0:
        optimizer.step()    # accumulation_steps마다 업데이트
        optimizer.zero_grad()
```

HuggingFace Trainer에서는 `gradient_accumulation_steps` 인자로 자동 처리된다.

## Epoch과 과적합 방지

### 몇 에폭이 적당한가

LLM 파인튜닝에서는 **3~5 에폭**이 일반적인 출발점이다. 데이터 양에 따라 조정한다:

| 데이터 규모 | 권장 에폭 | 이유 |
|-----------|---------|------|
| < 1,000개 | 5~10 | 충분히 학습 필요 |
| 1,000~10,000개 | 3~5 | 표준 범위 |
| > 10,000개 | 1~3 | 과적합 위험 증가 |
| > 100,000개 | 1~2 | 1 에폭도 충분 |

에폭을 늘릴수록 훈련 손실은 낮아지지만, **validation loss가 높아지기 시작하는 지점(early stopping point)**을 찾아 조기 종료하는 것이 핵심이다.

### 조기 종료 설정

```python
from transformers import EarlyStoppingCallback

training_args = TrainingArguments(
    ...
    evaluation_strategy="steps",
    eval_steps=200,
    save_strategy="steps",
    save_steps=200,
    load_best_model_at_end=True,  # 최고 모델 로드
    metric_for_best_model="eval_loss",
    greater_is_better=False,
)

trainer = Trainer(
    ...
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
    # 3번 연속 개선 없으면 종료
)
```

## 나머지 핵심 하이퍼파라미터

![파인튜닝 하이퍼파라미터 권장값](/assets/posts/finetuning-hyperparameters-table.svg)

### Gradient Clipping (그래디언트 클리핑)

그래디언트 폭발(exploding gradients)을 방지하는 안전망이다. `max_grad_norm=1.0`이 거의 모든 상황에서 권장된다. 이는 그래디언트 벡터의 L2 노름이 1.0을 초과하면 1.0으로 스케일링한다는 의미다.

```python
# PyTorch 수동 구현
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

# TrainingArguments에서는 자동 적용
TrainingArguments(max_grad_norm=1.0)
```

훈련 중 그래디언트 노름이 급격히 커지는 스파이크가 자주 보인다면 LR이 너무 높거나 배치 크기가 너무 작다는 신호다.

### Weight Decay (가중치 감쇠)

L2 정규화의 일종으로, 파라미터가 너무 큰 값을 갖지 않도록 패널티를 부여한다. **0.01~0.1** 범위를 권장하며, `0.01`이 좋은 출발점이다. AdamW 옵티마이저는 weight decay를 그래디언트와 분리하여 적용하므로 Adam + L2 정규화보다 효과적이다.

### Max Sequence Length

모델이 처리할 수 있는 최대 토큰 길이다. Llama-3의 경우 이론적으로 최대 8192 토큰을 지원하지만, **실제 데이터의 95 백분위수 길이**에 맞추는 것이 효율적이다.

```python
import numpy as np
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B-Instruct")
lengths = [len(tokenizer.encode(sample['text'])) for sample in train_data]

p95 = int(np.percentile(lengths, 95))
print(f"95th 백분위수 길이: {p95} tokens")
# 이 값을 max_seq_length로 설정

# 너무 긴 시퀀스는 메모리를 제곱으로 소비 (Attention)
# 2048 → 4096으로 늘리면 메모리 4배 증가
```

## TrainingArguments 전체 설정 예시

아래는 7B 모델을 A100 80GB 1개에서 LoRA 파인튜닝할 때의 권장 전체 설정이다.

```python
from transformers import TrainingArguments

training_args = TrainingArguments(
    # 기본 경로
    output_dir="./output/llama3-8b-finetuned",

    # 학습률 설정
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.05,

    # 배치 및 그래디언트
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    gradient_accumulation_steps=8,    # 실효 배치: 32
    max_grad_norm=1.0,

    # 에폭 및 스텝
    num_train_epochs=3,
    max_steps=-1,                     # -1: epoch 기반, 양수: step 기반

    # 정규화
    weight_decay=0.01,

    # 메모리 최적화
    fp16=False,
    bf16=True,                        # A100은 bf16 지원
    gradient_checkpointing=True,      # VRAM 절약 (약 30% 속도 저하)
    optim="paged_adamw_32bit",        # QLoRA 사용 시 권장

    # 평가 및 저장
    evaluation_strategy="steps",
    eval_steps=200,
    save_strategy="steps",
    save_steps=200,
    save_total_limit=3,               # 최근 3개만 보관
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",

    # 로깅
    logging_dir="./logs",
    logging_steps=50,
    report_to="wandb",               # WandB 연동

    # 데이터
    dataloader_num_workers=4,
    remove_unused_columns=False,
)
```

## 실험 추적: WandB / MLflow 연동

하이퍼파라미터 실험을 체계적으로 관리하지 않으면 "어떤 설정이 좋았는지" 기억하기 어렵다. **Weights & Biases(WandB)**는 LLM 파인튜닝 커뮤니티에서 가장 널리 사용하는 실험 추적 도구다.

```python
import wandb

# 실험 초기화
wandb.init(
    project="llama3-finetuning",
    name="run-lr2e-4-bs32-ep3",
    config={
        "learning_rate": 2e-4,
        "batch_size": 32,
        "epochs": 3,
        "model": "meta-llama/Meta-Llama-3-8B-Instruct",
        "lora_r": 16,
        "lora_alpha": 32,
    }
)

# TrainingArguments에서 report_to="wandb"로 자동 연동
# 손실, 학습률 스케줄, 그래디언트 노름이 자동 기록됨
```

MLflow를 선호한다면 `report_to="mlflow"`로 변경하면 된다. 로컬에서 `mlflow ui` 명령으로 대시보드를 확인할 수 있다.

## 하이퍼파라미터 탐색 전략

### 순차 탐색 (권장 순서)

모든 파라미터를 동시에 탐색하면 실험 비용이 급증한다. 다음 순서로 하나씩 고정해 나간다:

1. **Learning Rate 먼저**: 1e-5, 5e-5, 2e-4 세 가지 테스트
2. **배치 크기 고정**: GPU 메모리 최대한 활용하도록 설정
3. **에폭 조정**: validation loss 모니터링으로 결정
4. **Warmup ratio**: 0.03, 0.05, 0.10 중 선택
5. **Weight decay**: 0.01 or 0.1 테스트

### 단순 규칙 기반 빠른 시작

이론보다 빠른 시작이 필요하다면 다음 기본값으로 시작한다. 대부분의 태스크에서 합리적인 결과를 낸다:

```text
lr = 2e-4, batch = 32(누적 포함), epochs = 3,
warmup = 5%, cosine decay, weight_decay = 0.01
```

이 기본값에서 출발해 validation loss를 보면서 조정하는 것이 가장 실용적인 접근이다.

---

**지난 글:** [파인튜닝 데이터 준비: 형식·품질·양 완전 가이드](/posts/finetuning-data-prep/)

**다음 글:** [파인튜닝 평가: 내 모델이 얼마나 좋아졌는지 측정하기](/posts/finetuning-evaluation/)

<br>
읽어주셔서 감사합니다. 😊
