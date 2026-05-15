---
title: "파인튜닝 완전 정복: 사전 학습 모델을 내 데이터로 특화하는 방법"
description: "LLM 파인튜닝의 전체 개념과 종류를 이해한다. Full Fine-tuning, PEFT(LoRA/QLoRA), Instruction Tuning의 원리와 차이, 파인튜닝 파이프라인, 그리고 언제 파인튜닝이 필요한지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["파인튜닝", "FineTuning", "LoRA", "QLoRA", "PEFT", "SFT", "HuggingFace"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-vs-prompt-vs-rag/)에서 프롬프트 엔지니어링, RAG, 파인튜닝이라는 세 전략을 비교하고 언제 파인튜닝을 선택해야 하는지 기준을 잡았다. 이번부터 파인튜닝 자체를 깊이 파고든다. 파인튜닝은 수억 개의 파라미터를 가진 사전 학습 모델에 도메인 특화 데이터를 추가로 학습시켜 원하는 동작을 만들어내는 기법이다. ChatGPT, Claude, Gemini 같은 AI 어시스턴트가 어떻게 만들어지는지의 핵심 기술이기도 하다.

## 파인튜닝이란 무엇인가

**사전 학습(Pre-training)**은 인터넷의 방대한 텍스트에서 언어의 일반적인 패턴, 문법, 세계 지식을 학습하는 단계다. GPT, LLaMA, Mistral 같은 기반 모델들이 이 과정을 거친다.

**파인튜닝(Fine-tuning)**은 이 기반 모델을 특정 목적에 맞게 추가 학습하는 단계다. 마치 의대를 졸업한 의사(사전 학습)가 특정 분야 전문의 과정(파인튜닝)을 밟는 것과 같다. 일반적인 언어 능력은 유지하면서 특정 분야에서 더 잘 작동하도록 만든다.

![파인튜닝 유형 분류](/assets/posts/finetuning-overview-types.svg)

## 파인튜닝의 세 가지 유형

### 1. Full Fine-tuning

모든 파라미터를 업데이트한다. 성능은 가장 높지만 GPU 메모리가 엄청나게 필요하다.

7B 모델을 Full Fine-tuning하려면 모델 파라미터(14GB), 그래디언트(14GB), 옵티마이저 상태(28GB) 합산 약 56GB의 GPU 메모리가 필요하다. A100 80GB 1개에서도 빠듯하다. 70B 모델은 A100 8개로도 부족할 수 있다.

현업에서는 비용과 위험(catastrophic forgetting) 때문에 Full Fine-tuning보다 PEFT를 선호한다.

### 2. PEFT (Parameter-Efficient Fine-Tuning)

전체 파라미터가 아닌 **극소수 파라미터만 학습**한다. 기반 모델 가중치는 그대로 두고, 추가 모듈만 학습하거나 일부 레이어만 업데이트한다.

**LoRA**: 각 레이어의 가중치 업데이트를 저랭크 행렬의 곱으로 근사한다. 학습 파라미터가 전체의 0.1~1%에 불과하면서 Full Fine-tuning에 근접한 성능을 낸다.

**QLoRA**: LoRA에 4-bit 양자화를 결합한다. 메모리 사용량을 더욱 줄여 소비자용 GPU(RTX 3090/4090)에서도 7B 모델 파인튜닝이 가능하다.

### 3. Instruction Tuning

지시(instruction)와 응답(response) 쌍으로 구성된 데이터로 학습해 모델이 사람의 지시를 잘 따르도록 만든다.

```python
# Instruction Tuning 데이터 형식 (Alpaca 스타일)
training_example = {
    "instruction": "다음 고객 리뷰의 감정을 분석하고 긍정/부정/중립으로 분류하라.",
    "input": "배송이 너무 느렸지만 상품 품질은 만족스러웠습니다.",
    "output": "중립 (배송 부정 + 품질 긍정의 혼합 감정)"
}
```

ChatGPT, Claude 같은 모델들은 이 Instruction Tuning에 더해 RLHF(인간 피드백 강화학습)나 DPO(직접 선호 최적화)를 거쳐 인간의 선호에 맞게 정렬된다.

## 파인튜닝 파이프라인

![파인튜닝 파이프라인](/assets/posts/finetuning-overview-pipeline.svg)

### 데이터 형식

파인튜닝 데이터는 보통 대화 형식으로 준비한다.

```python
# ChatML 형식 (가장 널리 사용)
training_data = [
    {
        "messages": [
            {
                "role": "system",
                "content": "당신은 한국 법률 전문가 AI입니다."
            },
            {
                "role": "user",
                "content": "근로계약서에 반드시 포함해야 하는 내용은?"
            },
            {
                "role": "assistant",
                "content": """근로기준법에 따라 근로계약서에는 다음이 필수입니다:

1. 임금 (구성항목, 계산방법, 지급방법)
2. 소정 근로시간
3. 휴일 및 연차 유급휴가
4. 취업 장소 및 업무 내용
5. 근로계약 기간 (기간제인 경우)

이를 누락하면 500만원 이하 벌금 대상입니다."""
            }
        ]
    }
]
```

### QLoRA 파인튜닝 실행

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model
from trl import SFTTrainer, SFTConfig
import torch

# 4-bit 양자화 설정 (QLoRA)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4"
)

# 기반 모델 로드
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3-8B",
    quantization_config=bnb_config,
    device_map="auto"
)

# LoRA 설정
lora_config = LoraConfig(
    r=16,              # 랭크 (클수록 파라미터 많음, 성능 높음)
    lora_alpha=32,     # 스케일링 팩터
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 41,943,040 || all params: 8,072,204,288 || trainable%: 0.5196

# 학습
trainer = SFTTrainer(
    model=model,
    train_dataset=dataset,
    args=SFTConfig(
        output_dir="./output",
        num_train_epochs=3,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        bf16=True,
        logging_steps=10,
    )
)
trainer.train()
```

## 파인튜닝 vs 프롬프트 엔지니어링 실전 예

```python
# 특정 JSON 형식 출력이 필요한 경우

# 방법 1: 프롬프트 엔지니어링 (성공률 ~70%)
response = llm.invoke("""다음 텍스트에서 날짜와 금액을 추출해 JSON으로 반환하라.
형식: {"date": "YYYY-MM-DD", "amount": 숫자}
텍스트: 2026년 3월 15일에 50만원을 송금했습니다.""")
# 가끔 형식이 틀리거나 마크다운으로 감싸서 반환

# 방법 2: 파인튜닝 (성공률 ~99%)
# 수백 개의 (텍스트, JSON) 쌍으로 파인튜닝된 모델은
# 항상 정확한 JSON 형식으로 반환
```

형식 준수, 특정 용어 사용, 도메인 특화 응답 패턴처럼 **일관된 행동이 필수인 경우** 파인튜닝이 압도적으로 유리하다. 다음 글에서는 Full Fine-tuning과 PEFT를 더 깊이 비교하고, 각 기법의 구체적인 구현을 살펴본다.

---

**지난 글:** [파인튜닝 vs 프롬프트 엔지니어링 vs RAG: 세 전략의 완전 비교](/posts/finetuning-vs-prompt-vs-rag/)

**다음 글:** [Full Fine-tuning vs PEFT: 전체 파라미터 vs 효율적 파인튜닝 완전 비교](/posts/finetuning-full-vs-peft/)

<br>
읽어주셔서 감사합니다. 😊
