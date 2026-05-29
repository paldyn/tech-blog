---
title: "파인튜닝 파이프라인 구축: 데이터부터 배포까지"
description: "QLoRA 기반 파인튜닝 파이프라인을 처음부터 구축한다. 데이터 준비, 학습 루프, 체크포인트, 평가, GGUF 변환, Ollama 배포까지 엔드-투-엔드 실전 가이드."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["파인튜닝", "QLoRA", "LoRA", "파이프라인", "프로젝트", "Ollama", "GGUF"]
featured: false
draft: false
---

[지난 글](/posts/project-agent-from-scratch/)에서 순수 Python으로 ReAct 에이전트를 직접 구축했다. 도구 레지스트리, 루프 제어, 메모리까지 에이전트의 내부 구조를 손으로 조립하면서 프레임워크가 무엇을 대신해주는지 명확히 파악했다. 이번에는 모델 자체를 바꾸는 작업, 즉 **파인튜닝 파이프라인**을 처음부터 구축한다. QLoRA로 베이스 모델을 학습하고, 평가하고, GGUF로 변환해서 Ollama로 배포하는 엔드-투-엔드 과정을 단계별로 직접 구현한다.

## 파이프라인 전체 구조

파인튜닝 파이프라인은 8단계로 이루어진다. 각 단계의 산출물이 다음 단계의 입력이 되는 선형 흐름이다.

![파인튜닝 파이프라인 단계](/assets/posts/project-finetune-pipeline-stages.svg)

이 흐름을 단계별로 직접 구현한다.

## 1단계: 데이터 수집

파인튜닝의 품질은 데이터가 90%를 결정한다. 좋은 데이터를 수집하는 방법은 크게 세 가지다.

- **공개 데이터셋**: Hugging Face Hub에서 task 특화 데이터를 내려받는다.
- **직접 생성**: Claude나 GPT-4로 seed 예시에서 데이터를 합성한다.
- **도메인 크롤링**: 특정 도메인의 문서를 수집해서 정제한다.

```python
from datasets import load_dataset
import json
from pathlib import Path

RAW_DIR = Path("data/raw")
RAW_DIR.mkdir(parents=True, exist_ok=True)

def collect_from_hub(dataset_name: str, split: str = "train") -> list[dict]:
    """Hugging Face Hub에서 데이터셋을 수집한다."""
    ds = load_dataset(dataset_name, split=split)
    samples = [dict(row) for row in ds]
    out_path = RAW_DIR / f"{dataset_name.replace('/', '_')}_{split}.jsonl"
    with open(out_path, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    print(f"수집 완료: {len(samples)}개 → {out_path}")
    return samples

# 예시: 한국어 instruction 데이터
collect_from_hub("iknow-lab/ko-genstruct-7k")

def synthesize_with_llm(seed_examples: list[dict], n: int = 100) -> list[dict]:
    """LLM으로 데이터를 합성한다 (Self-Instruct 방식)."""
    import anthropic
    client = anthropic.Anthropic()
    results = []

    for seed in seed_examples[:n]:
        prompt = f"""다음 예시와 유사한 instruction-response 쌍을 한 개 새로 생성해 주세요.
예시: {json.dumps(seed, ensure_ascii=False)}

JSON 형식으로만 출력: {{"instruction": "...", "response": "..."}}"""
        msg = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        try:
            results.append(json.loads(msg.content[0].text))
        except json.JSONDecodeError:
            pass  # 파싱 실패는 다음 단계에서 필터링

    return results
```

## 2단계: 데이터 정제

수집한 원시 데이터에서 노이즈, 중복, 저품질 샘플을 제거한다.

```python
import re
from typing import Callable

def clean_dataset(
    samples: list[dict],
    min_instruction_len: int = 10,
    min_response_len: int = 20,
    max_response_len: int = 4096,
) -> list[dict]:
    """기본 품질 필터링."""
    cleaned = []
    seen = set()

    for s in samples:
        inst = s.get("instruction", "").strip()
        resp = s.get("response", s.get("output", "")).strip()

        # 길이 필터
        if not (min_instruction_len <= len(inst) and min_response_len <= len(resp) <= max_response_len):
            continue

        # 중복 제거 (instruction 기준 해시)
        key = hash(inst)
        if key in seen:
            continue
        seen.add(key)

        # 특수문자 노이즈 제거
        resp = re.sub(r"<\|.*?\|>", "", resp)  # 특수 토큰 제거
        resp = re.sub(r"\n{3,}", "\n\n", resp)  # 과도한 줄바꿈 정리

        cleaned.append({"instruction": inst, "response": resp})

    print(f"정제 전: {len(samples)} → 정제 후: {len(cleaned)} ({len(samples)-len(cleaned)}개 제거)")
    return cleaned
```

## 3단계: 데이터셋 포맷팅

학습 프레임워크(TRL)가 기대하는 포맷으로 변환한다. 가장 널리 쓰이는 포맷은 Alpaca, ShareGPT, ChatML 세 가지다.

```python
from datasets import Dataset

def to_alpaca_format(samples: list[dict]) -> list[dict]:
    """Alpaca 포맷: instruction + input + output."""
    return [
        {"instruction": s["instruction"], "input": "", "output": s["response"]}
        for s in samples
    ]

def to_chatml_format(samples: list[dict]) -> list[dict]:
    """ChatML 포맷: messages 리스트. SFTTrainer가 선호."""
    return [
        {
            "messages": [
                {"role": "user", "content": s["instruction"]},
                {"role": "assistant", "content": s["response"]},
            ]
        }
        for s in samples
    ]

def prepare_dataset(samples: list[dict], format: str = "chatml") -> Dataset:
    """정제된 샘플을 HF Dataset으로 변환."""
    if format == "alpaca":
        formatted = to_alpaca_format(samples)
    elif format == "chatml":
        formatted = to_chatml_format(samples)
    else:
        raise ValueError(f"지원하지 않는 포맷: {format}")

    ds = Dataset.from_list(formatted)
    # train/eval 분리 (90/10)
    split = ds.train_test_split(test_size=0.1, seed=42)
    split["train"].to_json("data/train.jsonl", orient="records", lines=True, force_ascii=False)
    split["test"].to_json("data/eval.jsonl", orient="records", lines=True, force_ascii=False)
    print(f"Train: {len(split['train'])} / Eval: {len(split['test'])}")
    return split
```

## 4단계: QLoRA 학습 설정

QLoRA의 핵심은 세 가지다. 4-bit 양자화, LoRA 어댑터, 그리고 두 가지를 연결하는 SFTTrainer.

![QLoRA 메모리 구조](/assets/posts/project-finetune-pipeline-qlora.svg)

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer, SFTConfig

# ── 양자화 설정 ──────────────────────────────────────────────
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",           # Normal Float 4 (최적 분포)
    bnb_4bit_use_double_quant=True,       # 이중 양자화로 추가 압축
    bnb_4bit_compute_dtype=torch.bfloat16,  # 연산은 bfloat16
)

# ── 모델 로드 ────────────────────────────────────────────────
MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"   # 원하는 베이스 모델로 교체
OUTPUT_DIR = "output/qwen2.5-7b-ko-lora"

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True,
)
model.config.use_cache = False           # 학습 시 KV 캐시 비활성화
model.config.pretraining_tp = 1

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"         # flash attention과의 호환성

# ── LoRA 설정 ────────────────────────────────────────────────
lora_config = LoraConfig(
    r=16,                    # rank: 4~64 범위, 16이 무난한 시작점
    lora_alpha=32,           # 스케일링: alpha/r = 2 유지가 일반적
    target_modules=[         # Qwen2.5 기준 Attention + MLP 모두
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# 예: trainable params: 41,943,040 || all params: 7,739,006,976 || trainable%: 0.5420
```

## 5단계: SFTTrainer 설정과 학습 루프

```python
from datasets import load_dataset as hf_load

train_ds = hf_load("json", data_files="data/train.jsonl", split="train")
eval_ds  = hf_load("json", data_files="data/eval.jsonl",  split="train")

def formatting_func(example):
    """ChatML 포맷 → 단일 문자열 (SFTTrainer에 전달)."""
    messages = example["messages"]
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
    return text

sft_config = SFTConfig(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=2,
    per_device_eval_batch_size=2,
    gradient_accumulation_steps=8,       # 유효 배치 크기 = 2×8 = 16
    gradient_checkpointing=True,          # 메모리 절약 (속도 약 20% 희생)
    optim="paged_adamw_32bit",           # QLoRA 전용 옵티마이저
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    weight_decay=0.001,
    fp16=False,
    bf16=True,                            # A100/H100이면 bf16, 없으면 fp16
    max_grad_norm=0.3,
    logging_steps=10,
    eval_strategy="steps",
    eval_steps=50,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=3,                   # 최근 3개 체크포인트만 유지
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    report_to="wandb",                    # wandb 또는 "none"
    max_seq_length=2048,
    packing=False,                        # 짧은 샘플 패킹 (데이터가 많을 때 True)
)

trainer = SFTTrainer(
    model=model,
    args=sft_config,
    train_dataset=train_ds,
    eval_dataset=eval_ds,
    formatting_func=formatting_func,
    peft_config=lora_config,
)

# 학습 시작
train_result = trainer.train()
print(f"학습 완료: {train_result.metrics}")

# 어댑터 저장
trainer.save_model(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
```

## 체크포인트 관리

체크포인트는 저장 공간을 많이 차지한다. 전략적으로 관리해야 한다.

```python
import shutil
from pathlib import Path

def keep_best_checkpoints(output_dir: str, keep_n: int = 3) -> None:
    """eval_loss 기준 상위 N개 체크포인트만 보존."""
    ckpt_dir = Path(output_dir)
    checkpoints = sorted(
        [d for d in ckpt_dir.iterdir() if d.name.startswith("checkpoint-")],
        key=lambda d: int(d.name.split("-")[-1]),
    )
    # trainer_state.json에서 best step 읽기
    import json
    state_path = ckpt_dir / "trainer_state.json"
    if state_path.exists():
        state = json.loads(state_path.read_text())
        best_step = state.get("best_model_checkpoint", "").split("-")[-1]
    else:
        best_step = None

    for ckpt in checkpoints[:-keep_n]:
        step = ckpt.name.split("-")[-1]
        if step != best_step:
            shutil.rmtree(ckpt)
            print(f"삭제: {ckpt.name}")
```

## 평가: loss 곡선과 생성 품질

학습 중 모니터링해야 하는 지표는 두 가지다.

```python
import matplotlib.pyplot as plt

def plot_loss_curves(log_history: list[dict]) -> None:
    """trainer.state.log_history에서 loss 곡선을 그린다."""
    train_steps, train_loss = [], []
    eval_steps, eval_loss = [], []

    for entry in log_history:
        if "loss" in entry:
            train_steps.append(entry["step"])
            train_loss.append(entry["loss"])
        if "eval_loss" in entry:
            eval_steps.append(entry["step"])
            eval_loss.append(entry["eval_loss"])

    plt.figure(figsize=(10, 4))
    plt.plot(train_steps, train_loss, label="Train Loss", alpha=0.7)
    plt.plot(eval_steps, eval_loss, label="Eval Loss", linewidth=2)
    plt.xlabel("Step"); plt.ylabel("Loss")
    plt.title("Training Loss Curves")
    plt.legend(); plt.tight_layout()
    plt.savefig("output/loss_curves.png", dpi=150)
    plt.close()

# trainer.state.log_history 활용
plot_loss_curves(trainer.state.log_history)

# 생성 품질 빠른 점검
def quick_eval(model, tokenizer, prompts: list[str]) -> None:
    model.eval()
    with torch.no_grad():
        for prompt in prompts:
            inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
            outputs = model.generate(**inputs, max_new_tokens=256, do_sample=False)
            print("PROMPT:", prompt)
            print("OUTPUT:", tokenizer.decode(outputs[0], skip_special_tokens=True))
            print("---")

quick_eval(model, tokenizer, [
    "한국의 수도는 어디인가요?",
    "파이썬에서 리스트 컴프리헨션의 장점을 설명해주세요.",
])
```

Eval Loss가 Train Loss와 함께 감소하다가 어느 순간부터 Train Loss는 줄고 Eval Loss는 올라간다면 과적합이다. `save_total_limit`과 `load_best_model_at_end=True`로 최적 체크포인트를 자동으로 선택한다.

## 6단계: 모델 병합 (LoRA → Base)

학습이 완료된 LoRA 어댑터를 베이스 모델에 병합한다. 이 과정을 거쳐야 독립적인 모델 파일이 생성된다.

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

MERGED_DIR = "output/qwen2.5-7b-ko-merged"

def merge_lora_into_base(
    base_model_id: str,
    adapter_dir: str,
    output_dir: str,
) -> None:
    print("베이스 모델 로드 중 (bf16)...")
    # 병합 시에는 양자화 없이 bf16으로 로드
    base = AutoModelForCausalLM.from_pretrained(
        base_model_id,
        torch_dtype=torch.bfloat16,
        device_map="cpu",  # CPU에서 병합 (VRAM 절약)
    )
    tokenizer = AutoTokenizer.from_pretrained(base_model_id)

    print("LoRA 어댑터 로드 및 병합 중...")
    model = PeftModel.from_pretrained(base, adapter_dir)
    model = model.merge_and_unload()  # 어댑터를 가중치에 흡수

    print(f"병합된 모델 저장 중 → {output_dir}")
    model.save_pretrained(output_dir, safe_serialization=True)
    tokenizer.save_pretrained(output_dir)
    print("병합 완료!")

merge_lora_into_base(MODEL_ID, OUTPUT_DIR, MERGED_DIR)
```

`merge_and_unload()`는 `W_merged = W_base + B·A` 연산을 수행한다. 이후 PEFT 코드 없이도 일반 `transformers` 코드로 모델을 로드할 수 있다.

## 7단계: GGUF 변환 (llama.cpp)

Ollama 배포를 위해 safetensors 형식을 GGUF로 변환한다.

```bash
# llama.cpp 클론 및 빌드
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make -j$(nproc)
pip install -r requirements.txt

# HF 포맷 → F16 GGUF 변환
python convert_hf_to_gguf.py \
    ../output/qwen2.5-7b-ko-merged \
    --outfile ../output/qwen2.5-7b-ko-f16.gguf \
    --outtype f16

# Q4_K_M 양자화 (권장: 품질/크기 균형)
./llama-quantize \
    ../output/qwen2.5-7b-ko-f16.gguf \
    ../output/qwen2.5-7b-ko-q4km.gguf \
    Q4_K_M

# 크기 확인
ls -lh ../output/*.gguf
# F16:  ~14 GB
# Q4_K_M: ~4.5 GB
```

양자화 수준 선택 기준:

| 수준 | 크기(7B) | 품질 손실 | 권장 상황 |
|------|---------|---------|---------|
| Q4_K_M | ~4.5 GB | 낮음 | 일반 배포, 균형 |
| Q5_K_M | ~5.3 GB | 매우 낮음 | 품질 우선 |
| Q8_0 | ~7.7 GB | 거의 없음 | VRAM 여유 있을 때 |

## 8단계: Ollama 배포

```bash
# Modelfile 작성
cat > Modelfile << 'EOF'
FROM ./output/qwen2.5-7b-ko-q4km.gguf

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 4096

SYSTEM """당신은 한국어를 유창하게 구사하는 AI 어시스턴트입니다. 정확하고 친절하게 답변하세요."""
EOF

# Ollama에 모델 등록
ollama create qwen2.5-7b-ko -f Modelfile

# 동작 확인
ollama run qwen2.5-7b-ko "안녕하세요, 자기소개를 해주세요."

# API 서버로 사용
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5-7b-ko",
  "prompt": "파인튜닝의 장점은 무엇인가요?",
  "stream": false
}'
```

Python에서 Ollama API를 호출하는 방법도 간단하다.

```python
import httpx

def ask_ollama(prompt: str, model: str = "qwen2.5-7b-ko") -> str:
    resp = httpx.post(
        "http://localhost:11434/api/generate",
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=120,
    )
    return resp.json()["response"]

# 파인튜닝 전후 비교
base_answer = ask_ollama("한국 전통 음식 3가지를 설명해줘.", "qwen2.5-7b-instruct")
ft_answer   = ask_ollama("한국 전통 음식 3가지를 설명해줘.", "qwen2.5-7b-ko")

print("=== Base Model ===")
print(base_answer)
print("\n=== Fine-tuned Model ===")
print(ft_answer)
```

## 엔드-투-엔드 자동화 스크립트

```bash
#!/bin/bash
# scripts/run_pipeline.sh

set -e  # 오류 시 즉시 중단

echo "[1/8] 데이터 수집..."
python scripts/collect.py

echo "[2/8] 데이터 정제..."
python scripts/clean.py

echo "[3/8] 데이터셋 포맷팅..."
python scripts/format_dataset.py

echo "[4/8] QLoRA 학습..."
python scripts/train.py

echo "[5/8] 평가..."
python scripts/evaluate.py

echo "[6/8] 모델 병합..."
python scripts/merge_lora.py

echo "[7/8] GGUF 변환..."
bash scripts/convert_gguf.sh

echo "[8/8] Ollama 배포..."
ollama create qwen2.5-7b-ko -f Modelfile

echo "파이프라인 완료! → ollama run qwen2.5-7b-ko"
```

## 실전 함정과 해결책

**함정 1: OOM 에러**
배치 크기를 1로 줄이고 `gradient_accumulation_steps`를 늘린다. `gradient_checkpointing=True`도 반드시 활성화한다.

**함정 2: 학습이 전혀 진행되지 않음**
`model.print_trainable_parameters()`로 학습 가능 파라미터가 0이 아닌지 확인한다. `get_peft_model()` 전에 `prepare_model_for_kbit_training(model)`을 호출해야 한다.

```python
from peft import prepare_model_for_kbit_training
model = prepare_model_for_kbit_training(model)  # 이 줄이 빠지면 학습 안 됨
model = get_peft_model(model, lora_config)
```

**함정 3: 병합 후 성능 저하**
병합은 CPU에서 bf16으로 진행해야 정밀도 손실이 없다. GPU에서 병합하면 양자화 오차가 누적될 수 있다.

**함정 4: GGUF 변환 오류**
`convert_hf_to_gguf.py`의 버전과 transformers 버전이 맞아야 한다. 오류 시 llama.cpp를 최신 버전으로 업데이트한다.

## 학습에서 배운 것

파인튜닝 파이프라인을 직접 구축하면 몇 가지 사실이 선명해진다. 데이터가 1,000개 이상이어야 의미 있는 변화가 생기고, 그 이하에서는 few-shot 프롬프팅으로 충분한 경우가 많다. QLoRA의 메모리 절감은 실제로 극적이다. 24GB VRAM에서 7B 모델 학습이 배치 크기 2로 가능하며, 학습 속도도 full fine-tuning 대비 크게 떨어지지 않는다. 그리고 파이프라인의 병목은 항상 데이터 정제 단계에 있다. 학습 코드보다 데이터 정제 코드에 더 많은 시간을 투자해야 한다.

---

**지난 글:** [에이전트 시스템 처음부터 구축하기: 실전 프로젝트](/posts/project-agent-from-scratch/)

**다음 글:** [평가 하네스 구축: LLM 성능을 체계적으로 측정하라](/posts/project-evaluation-harness/)

<br>
읽어주셔서 감사합니다. 😊
