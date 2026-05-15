---
title: "LLM 사전학습: 수조 개 토큰으로 무엇을 배우나"
description: "LLM 사전학습의 전체 파이프라인을 해설한다. 데이터 수집·필터링·중복 제거·토큰화·Document Packing, 분산 학습 전략(Data/Tensor/Pipeline Parallelism), Chinchilla 스케일링 법칙, 체크포인트 관리까지 실전 코드와 함께 완전히 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["LLM사전학습", "사전학습", "스케일링법칙", "Chinchilla", "분산학습", "데이터필터링", "토큰화", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/llm-essence/)에서 LLM이 왜 혁명적인지, 창발적 능력의 정체가 무엇인지를 살펴봤다. 이번에는 그 강력한 능력이 어디서 오는지를 파고든다. **사전학습(Pre-training)**은 LLM 탄생의 핵심 단계다. 수조 개의 토큰으로 이루어진 방대한 텍스트에서 언어의 통계적 구조와 세계에 대한 지식을 동시에 학습하는 이 과정이, LLM을 "아는 모델"로 만든다.

## 사전학습의 목표

LLM 사전학습의 목표는 단 하나: **다음 토큰 예측(Next Token Prediction)**이다.

주어진 토큰 시퀀스 `[T₁, T₂, ..., Tₙ]`에서 다음 토큰 `Tₙ₊₁`의 확률 분포를 최대한 정확히 예측하도록 모델 파라미터를 최적화한다. 이 단순한 목표를 수조 개 토큰에 걸쳐 최적화하면, 모델은 문법·사실·추론·코딩 등 언어로 표현된 모든 지식을 내재화한다.

```python
# 사전학습 손실 함수 (Causal LM)
import torch
import torch.nn as nn

class CausalLMLoss(nn.Module):
    def __init__(self):
        super().__init__()
        self.ce = nn.CrossEntropyLoss(ignore_index=-100)

    def forward(self, logits, labels):
        # logits: (B, T, V) — 각 위치에서 어휘 크기 V의 확률
        # labels: (B, T)    — 정답 토큰 ID
        # 1칸 밀어서 '다음 토큰' 예측 구조 구성
        shift_logits = logits[:, :-1].contiguous()
        shift_labels = labels[:, 1:].contiguous()
        return self.ce(
            shift_logits.view(-1, shift_logits.size(-1)),
            shift_labels.view(-1),
        )
```

## 사전학습 데이터 파이프라인

![LLM 사전학습 파이프라인](/assets/posts/llm-pretraining-process.svg)

사전학습 데이터는 단순히 많다고 좋은 게 아니다. "Garbage in, Garbage out" — 데이터 품질이 모델 품질을 결정한다.

### 1단계: 데이터 수집

**Common Crawl:** 전체 웹 스냅샷. 수백 TB에 달하지만 품질이 매우 낮다. 필터링 후 약 10%만 사용.

**Books3 / BookCorpus:** 장편 소설·비소설. 긴 문맥 이해와 서사적 추론 능력을 키운다.

**GitHub:** 코드 데이터. 코딩 능력과 논리적 추론 능력을 동시에 향상시킨다.

**Wikipedia / Wikibooks:** 고품질 백과사전. 정확한 사실 정보의 핵심 소스.

**ArXiv / PubMed:** 학술 논문. 전문 지식과 논리적 글쓰기 패턴 학습.

### 2단계: 품질 필터링

```python
import re
from langdetect import detect

def quality_filter(text: str, target_lang: str = "ko") -> bool:
    # 너무 짧은 문서 제거
    words = text.split()
    if len(words) < 100:
        return False

    # 알파벳·한글 비율 체크
    alpha_chars = sum(c.isalpha() for c in text)
    if alpha_chars / max(len(text), 1) < 0.5:
        return False

    # 언어 감지
    try:
        if detect(text) != target_lang:
            return False
    except Exception:
        return False

    # 반복 콘텐츠 감지
    lines = text.split("\n")
    unique_lines = set(lines)
    if len(unique_lines) / max(len(lines), 1) < 0.5:
        return False  # 50% 이상 줄이 중복

    return True
```

### 3단계: 중복 제거 (Deduplication)

동일한 텍스트가 학습 데이터에 반복되면 모델이 특정 패턴을 과도하게 암기하고 새로운 문맥에 일반화하는 능력이 떨어진다. **MinHash LSH**를 사용해 near-duplicate 문서를 탐지하고 제거한다.

```python
from datasketch import MinHash, MinHashLSH

def text_to_minhash(text: str, num_perm: int = 128) -> MinHash:
    m = MinHash(num_perm=num_perm)
    for word in text.lower().split():
        m.update(word.encode("utf-8"))
    return m

# LSH 인덱스 구성
lsh = MinHashLSH(threshold=0.8, num_perm=128)

seen_ids = set()
for doc_id, text in enumerate(documents):
    mh = text_to_minhash(text)
    if doc_id not in lsh:
        result = lsh.query(mh)
        if not result:  # 유사 문서 없음 → 추가
            lsh.insert(str(doc_id), mh)
            seen_ids.add(doc_id)
        # 유사 문서 있음 → 중복으로 제거

deduped = [doc for i, doc in enumerate(documents) if i in seen_ids]
```

### 4단계: 토큰화와 Document Packing

![데이터 처리 파이프라인 코드](/assets/posts/llm-pretraining-code.svg)

사전학습에서는 짧은 문서에 패딩을 채우는 대신, 여러 문서를 이어 붙여 컨텍스트 윈도우를 꽉 채우는 **Document Packing** 방식을 사용한다. GPU 효율을 극대화하고 패딩 토큰 낭비를 없앤다.

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")
CONTEXT_LEN = 4096

def pack_documents(texts: list[str]) -> list[list[int]]:
    """여러 문서를 이어 붙여 context_len 크기 청크 생성"""
    # EOS 토큰으로 문서 경계 표시
    eos = tokenizer.eos_token_id
    all_ids = []
    for text in texts:
        all_ids.extend(tokenizer.encode(text))
        all_ids.append(eos)  # 문서 경계

    # CONTEXT_LEN 길이로 분할
    chunks = [
        all_ids[i : i + CONTEXT_LEN]
        for i in range(0, len(all_ids), CONTEXT_LEN)
        if len(all_ids[i : i + CONTEXT_LEN]) == CONTEXT_LEN
    ]
    return chunks
```

## 스케일링 법칙과 Chinchilla

Kaplan et al. (2020)의 연구는 LLM 성능이 파라미터 수(N), 데이터 크기(D), 컴퓨팅(C)의 멱함수로 예측 가능하다는 것을 보였다. Hoffmann et al. (2022, Chinchilla 논문)은 이를 정제해 **최적 스케일링 법칙**을 도출했다:

$$D_{\text{optimal}} \approx 20 \times N$$

즉, 70B 파라미터 모델에는 약 1.4T 토큰이 최적이다. GPT-3(175B, 300B 토큰)은 이 기준으로 보면 학습 부족(undertrained) 상태였다. Chinchilla(70B, 1.4T 토큰)는 GPT-3보다 파라미터가 적지만 대부분 벤치마크에서 능가했다.

## 분산 학습 전략

70B+ 모델은 단일 GPU(80GB VRAM)에 올라가지 않는다. 수천 GPU에 걸친 분산 학습이 필수다.

**Data Parallelism:** 동일한 모델을 여러 GPU에 복사하고, 데이터를 나눠 각각 계산 후 그래디언트를 동기화. ZeRO(Zero Redundancy Optimizer)로 메모리 효율 극대화.

**Tensor Parallelism:** 가중치 행렬을 열/행 단위로 분할해 여러 GPU에 나눔.

**Pipeline Parallelism:** 레이어를 그룹 단위로 GPU에 할당. 마이크로배치로 파이프라인 버블 최소화.

```python
# Hugging Face Accelerate로 간단한 분산 학습
from accelerate import Accelerator
from transformers import AutoModelForCausalLM, get_scheduler
import torch

accelerator = Accelerator(mixed_precision="bf16")  # bfloat16 혼합정밀도

model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B")
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=0.1)

model, optimizer = accelerator.prepare(model, optimizer)

# 학습 루프
for batch in train_dataloader:
    with accelerator.accumulate(model):
        outputs = model(**batch, labels=batch["input_ids"])
        loss = outputs.loss
        accelerator.backward(loss)
        accelerator.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        optimizer.zero_grad()
```

## 학습 안정성과 모니터링

수주에 걸친 사전학습에서 불안정성은 치명적이다. 손실이 갑자기 치솟는 "loss spike"가 발생하면 이전 체크포인트로 롤백해야 한다.

- **그래디언트 클리핑:** `max_norm=1.0`으로 폭발적 그래디언트 방지
- **학습률 스케줄:** Warmup(1000~4000 스텝) + Cosine Decay
- **체크포인트:** 매 1000~10000 스텝마다 저장 (빠른 롤백을 위해)
- **실시간 모니터링:** W&B/TensorBoard로 Loss, Perplexity, Gradient Norm 추적

사전학습이 완료된 "베이스 모델(Base Model)"은 텍스트 완성에는 뛰어나지만, 사람의 질문에 답하거나 지시를 따르는 능력은 부족하다. 이를 해결하는 것이 다음 단계인 **Instruction Tuning**이다.

---

**지난 글:** [LLM의 본질: 거대 언어 모델이란 무엇인가](/posts/llm-essence/)

**다음 글:** [LLM 인스트럭션 튜닝: 지시를 따르는 모델 만들기](/posts/llm-instruction-tuning/)

<br>
읽어주셔서 감사합니다. 😊
