---
title: "HuggingFace Transformers 실전 가이드"
description: "pipeline()으로 즉시 추론, AutoModel/AutoTokenizer로 모델 로딩, Trainer API로 파인튜닝까지 — HuggingFace Transformers 라이브러리의 핵심 패턴을 실전 코드로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["HuggingFace", "Transformers", "pipeline", "AutoModel", "Trainer", "파인튜닝", "BERT"]
featured: false
draft: false
---

[지난 글](/posts/tensorflow-keras/)에서 TensorFlow/Keras의 고수준 API를 살펴봤다. 이번에는 사전학습 모델 생태계의 중심인 **HuggingFace Transformers**를 다룬다. BERT·GPT·T5·Llama 등 수만 개의 모델을 동일한 API로 쓸 수 있게 해주는 라이브러리다.

## HuggingFace 생태계 개요

HuggingFace는 라이브러리 하나가 아니라 여러 패키지의 생태계다.

| 패키지 | 역할 |
|--------|------|
| `transformers` | 사전학습 모델·토크나이저·Trainer |
| `datasets` | 데이터셋 로딩·처리 |
| `tokenizers` | 빠른 토크나이저 구현 (Rust) |
| `peft` | LoRA·QLoRA 등 PEFT 기법 |
| `trl` | RLHF·DPO 학습 |
| `accelerate` | 분산·혼합정밀도 학습 추상화 |

```bash
pip install transformers datasets accelerate peft
```

## pipeline(): 가장 빠른 추론

![HuggingFace Transformers — 핵심 구성 요소](/assets/posts/huggingface-transformers-pipeline.svg)

`pipeline()`은 토크나이저 + 모델 + 후처리를 자동으로 묶어준다. task 이름 하나로 바로 실행할 수 있다.

```python
from transformers import pipeline

# 감성 분석 (한국어)
clf = pipeline("text-classification", model="snunlp/KR-FinBert-SC")
print(clf("이 주식은 상승 여력이 충분합니다"))
# [{'label': 'positive', 'score': 0.9834}]

# 텍스트 생성
gen = pipeline("text-generation", model="skt/kogpt2-base-v2",
               max_new_tokens=50, do_sample=True, temperature=0.8)
print(gen("인공지능이 세상을 바꾸는 방법은"))

# 질의응답
qa = pipeline("question-answering",
              model="monologg/koelectra-base-finetuned-korquad")
print(qa(question="파이썬이 만들어진 해는?",
         context="파이썬은 1991년 귀도 반 로섬이 발표했다."))
```

## AutoModel / AutoTokenizer: 유연한 로딩

task 헤드가 필요한 경우 `Auto` 클래스를 사용한다.

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

model_name = "klue/roberta-base"
tokenizer  = AutoTokenizer.from_pretrained(model_name)
model      = AutoModelForSequenceClassification.from_pretrained(
                model_name, num_labels=3)

# 토크나이징
inputs = tokenizer(
    "이 영화 진짜 재밌어요!",
    return_tensors="pt",
    max_length=128,
    truncation=True,
    padding="max_length",
)
# inputs: {'input_ids': ..., 'attention_mask': ..., 'token_type_ids': ...}

with torch.no_grad():
    outputs = model(**inputs)

logits = outputs.logits          # (1, 3)
probs  = logits.softmax(-1)      # 확률로 변환
pred   = probs.argmax(-1).item() # 예측 클래스
```

`AutoModel`은 허브의 `config.json`을 보고 올바른 아키텍처 클래스를 자동으로 선택한다. 모델명만 바꾸면 BERT에서 RoBERTa, ELECTRA로 전환된다.

## Trainer API로 파인튜닝

![Trainer API로 파인튜닝하기](/assets/posts/huggingface-transformers-trainer.svg)

`Trainer`는 학습 루프, 혼합 정밀도, 분산 학습, 로깅을 모두 처리한다.

```python
from transformers import (AutoTokenizer, AutoModelForSequenceClassification,
                           TrainingArguments, Trainer)
from datasets import load_dataset
import evaluate
import numpy as np

# 데이터 준비
raw_ds    = load_dataset("klue", "ynat")
tokenizer = AutoTokenizer.from_pretrained("klue/roberta-base")

def preprocess(batch):
    return tokenizer(batch["title"], truncation=True, max_length=128)

tokenized = raw_ds.map(preprocess, batched=True)

# 모델
model = AutoModelForSequenceClassification.from_pretrained(
    "klue/roberta-base", num_labels=7)

# 지표 함수
metric = evaluate.load("accuracy")
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return metric.compute(predictions=preds, references=labels)

# 학습 인자
args = TrainingArguments(
    output_dir="./ynat-roberta",
    num_train_epochs=3,
    per_device_train_batch_size=32,
    per_device_eval_batch_size=64,
    learning_rate=3e-5,
    warmup_ratio=0.1,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    fp16=True,   # A100/V100에서 속도 2배
)

trainer = Trainer(
    model=model, args=args,
    train_dataset=tokenized["train"],
    eval_dataset=tokenized["validation"],
    compute_metrics=compute_metrics,
    tokenizer=tokenizer,
)

trainer.train()
trainer.save_model("./best-ynat-model")
```

`fp16=True`는 혼합 정밀도 학습을 활성화해 GPU 메모리를 절약하고 속도를 높인다.

## generate(): 텍스트 생성 제어

언어 모델의 텍스트 생성은 `generate()` 메서드로 세밀하게 제어할 수 있다.

```python
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-1B")
model     = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-1B",
                                                 torch_dtype="auto",
                                                 device_map="auto")

inputs = tokenizer("What is machine learning?", return_tensors="pt").to("cuda")

output = model.generate(
    **inputs,
    max_new_tokens=200,
    temperature=0.7,
    top_p=0.9,
    repetition_penalty=1.1,
    do_sample=True,
)

print(tokenizer.decode(output[0], skip_special_tokens=True))
```

`device_map="auto"`는 모델을 사용 가능한 GPU에 자동으로 분산 배치한다.

다음 포스트에서는 HuggingFace 생태계의 데이터셋 관리 라이브러리인 **🤗 Datasets**를 다룬다.

---

**지난 글:** [TensorFlow/Keras로 시작하는 딥러닝](/posts/tensorflow-keras/)

**다음 글:** [HuggingFace Datasets로 데이터 관리하기](/posts/huggingface-datasets/)

<br>
읽어주셔서 감사합니다. 😊
