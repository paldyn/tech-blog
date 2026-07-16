---
title: "지식 증류: 대형 모델의 지식을 소형 모델로 이전하기"
description: "Teacher-Student 학습의 원리, Soft Label과 온도 파라미터, Feature 증류, LLM 특화 증류(SFT·SeqKD), DistilBERT·TinyLLaMA 실전 사례 완전 해설."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["지식증류", "Knowledge Distillation", "DistilBERT", "TinyLLaMA", "모델압축", "Teacher-Student"]
featured: false
draft: false
---

[지난 글](/posts/quantization-awq-gptq/)에서 기존 가중치를 INT4로 압축하는 AWQ·GPTQ를 살펴봤다. 양자화가 완성된 모델을 압축하는 방법이라면, **지식 증류(Knowledge Distillation)**는 완전히 다른 접근이다. 큰 모델(Teacher)이 작은 모델(Student)에게 자신의 "지식"을 가르쳐 Student가 Teacher에 준하는 성능을 내도록 훈련한다. Hinton et al. (2015)의 선구적 논문 이후 증류는 BERT 경량화(DistilBERT), LLM 파인튜닝(Alpaca, Vicuna), 소형 언어 모델 개발(TinyLLaMA) 등에 폭넓게 활용됐다.

## 왜 증류가 필요한가: Hard Label의 한계

일반적인 지도 학습은 **Hard Label**을 사용한다. 이미지 분류에서 "고양이" 사진의 정답 레이블은 [0, 0, 1, 0, ...] 형태의 원-핫 벡터다. 모델은 이 절대적 정답만 학습한다. 하지만 이 방식은 중요한 정보를 버린다. 큰 모델이 "고양이" 이미지를 보고 출력하는 확률 분포는 다음과 같다.

```text
고양이: 0.70  강아지: 0.20  동물: 0.08  기타: 0.02
```

이 분포는 **클래스 간 유사도 정보**를 담고 있다. "고양이"와 "강아지"가 "자동차"보다 서로 더 비슷하다는 것을 학습했다는 뜻이다. Hard Label [0, 0, 1, 0]은 이런 풍부한 정보를 완전히 날려버린다.

## Soft Label과 온도 파라미터

증류에서는 Teacher 모델의 출력 확률 분포인 **Soft Label**을 직접 학습 신호로 사용한다. 하지만 Teacher가 잘 훈련됐다면 정답 클래스 확률이 0.999에 달해 분포가 너무 뾰족해진다. 이를 완화하기 위해 **온도(Temperature) T**를 사용해 분포를 부드럽게 만든다.

```python
import torch
import torch.nn.functional as F

# 온도 T로 스케일된 소프트맥스
def soft_softmax(logits, T):
    return F.softmax(logits / T, dim=-1)

# T=1: 원래 분포 (날카로움 유지)
# T=4: 분포가 균등해짐 → 클래스 간 유사도 정보 증폭
# T=∞: 완전 균등 분포 (정보 없음)
logits = torch.tensor([10.0, 3.0, 0.5, 0.1])
print("T=1:", soft_softmax(logits, 1.0))
print("T=4:", soft_softmax(logits, 4.0))
# T=1: [0.9993, 0.0006, 0.0001, 0.0000]  ← 정보 빈약
# T=4: [0.8360, 0.1332, 0.0230, 0.0078]  ← 유사도 정보 풍부
```

![지식 증류 개념과 손실 함수](/assets/posts/distillation-concept.svg)

## 증류 손실 함수

완전한 증류 손실은 두 항의 합이다.

$$L_{distill} = (1 - \alpha) \cdot L_{CE}(hard) + \alpha \cdot T^2 \cdot L_{KL}(soft)$$

- **$L_{CE}(hard)$**: Student 출력과 정답 레이블의 교차 엔트로피. 정확한 분류를 학습.
- **$L_{KL}(soft)$**: Student Soft 분포와 Teacher Soft 분포의 KL Divergence. Teacher 지식 흡수.
- **$T^2$ 스케일**: 온도를 나누면 그래디언트가 $T^2$만큼 작아지기 때문에 곱해서 보정.
- **$\alpha$**: 두 손실의 균형. 보통 0.3~0.7.

```python
def distillation_loss(student_logits, teacher_logits, labels,
                      T=4.0, alpha=0.5):
    # Hard loss: 정답 레이블과의 CE
    hard_loss = F.cross_entropy(student_logits, labels)
    # Soft loss: Teacher 분포와의 KL
    soft_loss = F.kl_div(
        F.log_softmax(student_logits / T, dim=-1),
        F.softmax(teacher_logits / T, dim=-1),
        reduction="batchmean",
    ) * (T ** 2)
    return (1 - alpha) * hard_loss + alpha * soft_loss
```

## 증류 유형

![증류 유형과 실전 사례](/assets/posts/distillation-types.svg)

### Response 증류 (출력 매칭)

가장 단순한 형태다. Teacher의 최종 출력 분포만 사용한다. DistilBERT가 이 방식이다. BERT-base(110M 파라미터)에서 레이어 수를 절반으로 줄인 DistilBERT(66M)가 BERT 성능의 97%를 유지하면서 추론 속도는 60% 빠르다.

### Feature 증류 (중간 표현 매칭)

Teacher의 중간 레이어 출력(hidden states, attention maps)을 Student와 직접 매칭한다. TinyBERT는 Transformer의 attention 행렬과 hidden state를 레이어 단위로 증류해 BERT-base 대비 7.5배 작고 9.4배 빠른 모델을 만들었다.

```python
# Feature 증류: Teacher attention과 Student attention 매칭
def feature_distill_loss(student_hidden, teacher_hidden,
                         student_attn, teacher_attn):
    # Hidden state 매칭 (MSE)
    hidden_loss = F.mse_loss(student_hidden, teacher_hidden.detach())
    # Attention 행렬 매칭 (MSE)
    attn_loss = F.mse_loss(student_attn, teacher_attn.detach())
    return hidden_loss + attn_loss
```

## LLM 증류의 실제 구현

LLM에서의 증류는 분류 문제와 달리 각 토큰 위치에서 수만~수십만 vocabulary에 걸친 분포를 다룬다.

**SFT 증류(가장 실용적)**: Teacher(예: GPT-4, Claude)가 생성한 응답 데이터로 Student를 SFT(Supervised Fine-Tuning)한다. Alpaca(LLaMA + GPT-3.5 생성 데이터), Vicuna(ChatGPT 대화 데이터)가 이 방식이다. 구현이 단순하고 효과가 크다.

```python
from transformers import AutoModelForCausalLM, TrainingArguments
from trl import SFTTrainer
from datasets import load_dataset

# Teacher 생성 데이터로 Student 훈련 (SFT 증류)
student_model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-1B")
dataset = load_dataset("json", data_files="teacher_generated.jsonl")

trainer = SFTTrainer(
    model=student_model,
    train_dataset=dataset["train"],
    dataset_text_field="text",
    max_seq_length=2048,
    args=TrainingArguments(
        output_dir="./student-distilled",
        num_train_epochs=3,
        per_device_train_batch_size=4,
        learning_rate=2e-5,
    ),
)
trainer.train()
```

**Token-Level KD(품질 최상)**: 각 토큰 위치에서 Teacher의 실제 확률 분포로 Student를 훈련한다. 정보가 가장 풍부하지만 Teacher를 추론에 계속 사용해야 하므로 메모리와 연산 비용이 크다.

```python
# Token-Level 증류 (간략한 구조)
def token_level_kd(student_model, teacher_model, inputs, T=2.0):
    with torch.no_grad():
        teacher_out = teacher_model(**inputs)
        teacher_logits = teacher_out.logits  # [B, L, V]

    student_out = student_model(**inputs)
    student_logits = student_out.logits  # [B, L, V]

    # 각 토큰 위치의 KL loss
    B, L, V = student_logits.shape
    loss = F.kl_div(
        F.log_softmax(student_logits.view(-1, V) / T, dim=-1),
        F.softmax(teacher_logits.view(-1, V) / T, dim=-1),
        reduction="batchmean",
    ) * (T ** 2)
    return loss
```

## 실전 사례: TinyLLaMA

TinyLLaMA(1.1B)는 LLaMA-2(7B, 13B)를 Teacher로 사용해 3T 토큰을 훈련한 모델이다. 특이하게도 단순한 Next Token Prediction 손실에 가깝고, 방대한 데이터로 Teacher의 지식을 간접 흡수한다.

```python
# TinyLLaMA 추론 예시
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model = AutoModelForCausalLM.from_pretrained(
    "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    torch_dtype=torch.float16,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0")

prompt = "<|system|>You are a helpful assistant.</s><|user|>Python GIL이란?</s><|assistant|>"
inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
with torch.no_grad():
    out = model.generate(**inputs, max_new_tokens=200, temperature=0.7)
print(tokenizer.decode(out[0], skip_special_tokens=True))
```

## 정리

증류는 양자화와 달리 훈련 단계를 거쳐야 하지만, 그 결과로 나오는 Student 모델은 FP16 정밀도를 유지하면서도 훨씬 작고 빠르다.

- **Response 증류**: 구현 단순, DistilBERT·TinyLLaMA 방식
- **Feature 증류**: 중간 표현까지 이전, TinyBERT 방식
- **SFT 증류**: Teacher 생성 데이터로 Student SFT, 가장 실용적
- **Token-Level KD**: 최고 품질, 메모리 비용 큼
- **온도 파라미터**: 분포를 부드럽게 해 클래스 간 유사도 정보 전달

다음 글에서는 훈련된 모델에서 불필요한 가중치를 제거하는 **프루닝(Pruning)**을 다룬다.

---

**지난 글:** [AWQ vs GPTQ: 고급 INT4 양자화 완전 비교](/posts/quantization-awq-gptq/)

**다음 글:** [모델 프루닝: 신경망의 불필요한 가중치 제거하기](/posts/pruning/)

<br>
읽어주셔서 감사합니다. 😊
