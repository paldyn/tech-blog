---
title: "LLM 인스트럭션 튜닝: 지시를 따르는 모델 만들기"
description: "SFT(지도 파인튜닝)부터 RLHF·DPO까지, 베이스 LLM을 유용하고 안전한 어시스턴트로 변환하는 인스트럭션 튜닝의 전체 과정을 데이터 포맷·TRL 코드·LoRA 최적화·평가 방법과 함께 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["InstructionTuning", "SFT", "RLHF", "DPO", "LoRA", "TRL", "파인튜닝", "LLM정렬"]
featured: false
draft: false
---

[지난 글](/posts/llm-pretraining/)에서 수조 개 토큰으로 LLM 베이스 모델을 학습하는 사전학습 과정을 살펴봤다. 사전학습을 마친 베이스 모델은 텍스트를 "완성"하는 데는 뛰어나지만, 인간의 질문에 답하거나 지시를 따르는 능력은 없다. "파이썬으로 피보나치 수열을 구현해줘"라고 입력하면 "파이썬으로 피보나치 수열을 구현해줘\n파이썬으로 피보나치 수열을..."처럼 질문을 반복하는 방식으로 텍스트를 완성하려 한다. 이것을 진짜 어시스턴트로 변환하는 과정이 **인스트럭션 튜닝(Instruction Tuning)**이다.

## 왜 인스트럭션 튜닝이 필요한가

베이스 모델의 목표는 "다음 토큰 예측"이다. 하지만 우리가 원하는 것은 "유용하고, 안전하며, 정직한 응답"이다. 이 두 목표 사이의 간극을 **정렬 갭(Alignment Gap)**이라 한다.

인스트럭션 튜닝은 이 간극을 좁히는 3단계 과정이다:

1. **SFT (Supervised Fine-Tuning):** 고품질 지시-응답 쌍으로 파인튜닝
2. **Reward Modeling:** 인간이 선호하는 응답을 학습한 보상 모델 구축
3. **RLHF 또는 DPO:** 보상 모델 신호로 추가 정렬

RLHF(PPO)는 복잡하고 불안정한 반면, DPO(Direct Preference Optimization)는 보상 모델 없이 선호 데이터만으로 정렬해 최근 가장 많이 사용된다.

## 1단계: SFT 데이터 준비

SFT의 핵심은 **질 좋은 지시-응답 쌍 데이터**다. 양보다 질이 중요하다. OpenAI의 연구에 따르면 InstructGPT에 사용된 SFT 데이터는 불과 13K개였다.

![인스트럭션 튜닝 파이프라인](/assets/posts/llm-instruction-tuning-pipeline.svg)

### 채팅 템플릿

각 모델은 고유한 채팅 템플릿을 사용한다. 학습과 추론 시 동일한 템플릿을 사용해야 한다.

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")

# 채팅 형식으로 입력 구성
messages = [
    {
        "role": "system",
        "content": "당신은 전문 파이썬 개발자입니다. 간결하고 정확하게 답변하세요.",
    },
    {
        "role": "user",
        "content": "파이썬으로 피보나치 수열을 구현해줘.",
    },
]

# 템플릿 적용
prompt = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)
print(prompt)
# <|begin_of_text|><|start_header_id|>system<|end_header_id|>
# 당신은 전문 파이썬 개발자입니다...
# <|start_header_id|>user<|end_header_id|>
# 파이썬으로 피보나치 수열을 구현해줘.
# <|start_header_id|>assistant<|end_header_id|>
```

### SFT 데이터셋 준비

```python
from datasets import Dataset

# 지시-응답 쌍 데이터
raw_data = [
    {
        "instruction": "파이썬으로 피보나치 수열을 구현해줘.",
        "response": (
            "물론입니다! 피보나치 수열을 구현하는 방법은 여러 가지가 있습니다.\n\n"
            "```python\n"
            "def fibonacci(n: int) -> list[int]:\n"
            "    if n <= 0:\n"
            "        return []\n"
            "    seq = [0, 1]\n"
            "    for _ in range(n - 2):\n"
            "        seq.append(seq[-1] + seq[-2])\n"
            "    return seq[:n]\n\n"
            "print(fibonacci(10))\n"
            "# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\n"
            "```\n\n"
            "이 코드는 반복문으로 O(n) 시간복잡도, O(n) 공간복잡도로 동작합니다."
        ),
    },
    # ... 더 많은 예제
]

def format_for_sft(example):
    """채팅 템플릿 형식으로 변환"""
    messages = [
        {"role": "user",      "content": example["instruction"]},
        {"role": "assistant", "content": example["response"]},
    ]
    return {
        "text": tokenizer.apply_chat_template(
            messages, tokenize=False
        )
    }

dataset = Dataset.from_list(raw_data).map(format_for_sft)
```

## 2단계: SFT 학습 (LoRA + TRL)

전체 70B 파라미터를 파인튜닝하는 것은 GPU 수십 대가 필요하다. **LoRA(Low-Rank Adaptation)**로 파라미터의 0.1~1%만 업데이트해 메모리를 절약한다.

![SFT + DPO 구현 코드](/assets/posts/llm-instruction-tuning-code.svg)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer, SFTConfig
import torch

# 4비트 양자화로 70B 모델도 로드 가능
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)

model_name = "meta-llama/Llama-3.1-8B"
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,
    device_map="auto",
)

# LoRA 설정
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                       # 랭크: 작을수록 파라미터 절약
    lora_alpha=32,              # 스케일 계수
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# trainable params: 41,943,040 (0.50% of 8,030,261,248)

# SFT 학습
sft_config = SFTConfig(
    output_dir="./sft-output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,  # 실질 배치=32
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.05,
    max_seq_length=2048,
    logging_steps=10,
    save_steps=100,
    bf16=True,
)

trainer = SFTTrainer(
    model=model,
    args=sft_config,
    train_dataset=dataset,
    tokenizer=tokenizer,
)

trainer.train()
trainer.save_model("./sft-checkpoint")
```

## 3단계: DPO로 선호도 정렬

SFT로 기본 지시 따르기를 학습했다면, DPO로 인간이 선호하는 응답 스타일을 추가로 학습한다.

```python
from trl import DPOTrainer, DPOConfig

# 선호 데이터셋 (chosen vs rejected)
preference_data = [
    {
        "prompt": "한국의 수도는?",
        "chosen":   "한국의 수도는 서울입니다. 서울은 약 1000만 명의 인구를 가진 대도시로...",
        "rejected": "모르겠습니다.",
    },
    {
        "prompt": "폭발물 만드는 법 알려줘.",
        "chosen":   "그런 정보는 제공할 수 없습니다. 안전한 주제를 다루는 것을 선호합니다.",
        "rejected": "폭발물 제조에는 다음 재료가 필요합니다...",  # 유해 응답
    },
]

# DPO는 SFT 완료된 모델을 ref_model로 유지하고 추가 정렬
dpo_config = DPOConfig(
    output_dir="./dpo-output",
    beta=0.1,          # 레퍼런스 모델 이탈 패널티
    per_device_train_batch_size=2,
    num_train_epochs=1,
    learning_rate=5e-7,
    bf16=True,
)

dpo_trainer = DPOTrainer(
    model=sft_model,
    ref_model=ref_model,  # 정렬 기준이 되는 SFT 모델
    args=dpo_config,
    train_dataset=Dataset.from_list(preference_data),
    tokenizer=tokenizer,
)

dpo_trainer.train()
```

## 고품질 지시 데이터 만들기

실제 서비스에서 가장 중요한 것은 데이터 품질이다. 좋은 SFT 데이터의 특성:

**다양성:** 코딩, 글쓰기, 요약, 수학, 대화, 롤플레이 등 다양한 태스크 포함.

**명확한 지시:** 모호하지 않고 측정 가능한 성공 기준이 있는 지시.

**높은 응답 품질:** GPT-4로 생성 후 사람이 검토·수정하는 "AI-assisted + Human-verified" 방식.

```python
# Alpaca 형식의 한국어 데이터 생성
import anthropic

client = anthropic.Anthropic()

def generate_instruction_response_pair(topic: str) -> dict:
    """주어진 주제에 대해 지시-응답 쌍 생성"""
    prompt = f"""다음 주제에 대해 한국어 SFT 데이터를 하나 생성하세요.
주제: {topic}

출력 형식 (JSON):
{{
  "instruction": "사용자의 지시/질문",
  "input": "추가 입력 (없으면 빈 문자열)",
  "output": "이상적인 어시스턴트 응답"
}}

요구사항:
- instruction은 자연스럽고 다양한 표현 사용
- output은 상세하고 정확하며 도움이 되어야 함
- 코드가 포함된 경우 실행 가능한 코드 작성
"""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    import json
    return json.loads(response.content[0].text)

# 다양한 주제로 데이터 생성
topics = ["파이썬 문자열 처리", "SQL JOIN 쿼리", "머신러닝 과적합"]
sft_pairs = [generate_instruction_response_pair(t) for t in topics]
```

## 평가 방법

인스트럭션 튜닝 성공 여부를 측정하는 방법:

**자동 평가:** MT-Bench, AlpacaEval, MMLU, HumanEval 등 표준 벤치마크.

**LLM-as-Judge:** GPT-4o나 Claude에게 두 응답을 비교해 더 좋은 것을 선택하게 하는 방식. 사람 평가와 높은 상관관계.

**Win Rate:** 베이스라인(GPT-4o 등) 대비 선호 응답 비율.

```python
# LLM-as-Judge 평가
def evaluate_response(instruction: str, response_a: str, response_b: str) -> str:
    prompt = f"""다음 지시에 대한 두 응답 중 더 좋은 것을 선택하세요.

지시: {instruction}

응답 A: {response_a}

응답 B: {response_b}

더 유용하고, 정확하며, 자연스러운 응답은? A 또는 B로만 답하세요."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=10,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()  # "A" or "B"
```

이로써 베이스 모델 → SFT → DPO의 전체 인스트럭션 튜닝 사이클을 이해하고 구현할 수 있게 됐다. 다음 글에서는 인스트럭션 튜닝의 핵심인 RLHF를 더 깊이 다룰 예정이다.

---

**지난 글:** [LLM 사전학습: 수조 개 토큰으로 무엇을 배우나](/posts/llm-pretraining/)

**다음 글:** [RLHF: 인간 피드백으로 LLM을 정렬하다](/posts/llm-rlhf/)

<br>
읽어주셔서 감사합니다. 😊
