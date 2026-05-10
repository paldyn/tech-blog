---
title: "질의응답: 문서에서 답을 찾는 기술"
description: "추출형·생성형·오픈도메인 QA의 원리부터 BERT 스팬 예측, KorQuAD 파인튜닝, RAG 기반 오픈도메인 QA까지 질의응답 시스템의 전체 기술 스택을 한국어 코드와 함께 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["QA", "질의응답", "KorQuAD", "BERT", "오픈도메인QA", "RAG", "스팬예측", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/nlp-summarization/)에서 긴 문서를 압축하는 요약 기술을 살펴봤다. 이번에는 문서에서 특정 질문의 답을 정확히 찾아내는 **질의응답(Question Answering, QA)**을 다룬다. 단순히 검색 결과를 반환하는 것이 아니라 "BTS는 언제 데뷔했나요?"라는 질문에 대해 "2013년 6월 13일"이라는 정확한 답을 추출하거나 생성하는 기술이다. 챗봇, 문서 검색, 고객 지원 자동화, 시험 자동 채점 등 다양한 분야에서 핵심 역할을 한다.

## QA의 세 가지 유형

**추출형 QA(Extractive QA):** 주어진 문맥 텍스트에서 정답에 해당하는 스팬(span, 텍스트 구간)을 직접 추출한다. "답이 문서 안에 있다"는 가정 하에 작동하며, BERT 계열 모델이 강점을 보인다.

**추상형 QA(Abstractive QA):** 문서의 내용을 바탕으로 새로운 문장을 생성해 답한다. 문맥을 종합·재구성하는 능력이 필요하며, T5, BART, GPT 계열이 사용된다. "위 자료를 바탕으로 주요 시사점을 서술하라" 같은 복합 질문에 적합하다.

**오픈도메인 QA(Open-domain QA):** 특정 문서가 아닌 대규모 지식베이스(위키피디아, 내부 문서 DB 등) 전체를 대상으로 질문에 답한다. "검색 + 읽기" 2단계 구조로 작동하며, RAG(Retrieval-Augmented Generation)가 대표적인 구현 방식이다.

## 추출형 QA의 핵심: 스팬 예측

추출형 QA의 핵심은 "정답이 시작하는 토큰"과 "정답이 끝나는 토큰"을 예측하는 것이다.

![QA 파이프라인: BERT 스팬 예측](/assets/posts/nlp-question-answering-pipeline.svg)

BERT는 질문과 문맥을 `[CLS] 질문 [SEP] 문맥 [SEP]` 형태로 이어 붙여 입력받는다. 각 토큰의 숨겨진 상태(768차원 벡터)에 두 개의 독립적인 선형 레이어를 적용해 시작 위치와 끝 위치에 대한 확률 분포를 계산한다. 두 확률의 합이 가장 높은 (start, end) 쌍을 정답 스팬으로 선택한다.

```python
# 내부 동작 원리 (간략)
import torch
import torch.nn.functional as F

def predict_span(model, input_ids, attention_mask):
    outputs = model(
        input_ids=input_ids,
        attention_mask=attention_mask,
    )
    # outputs.start_logits: (batch, seq_len)
    # outputs.end_logits:   (batch, seq_len)

    start_probs = F.softmax(outputs.start_logits, dim=-1)
    end_probs   = F.softmax(outputs.end_logits,   dim=-1)

    # 유효한 (start, end) 쌍에서 최고 확률 조합 선택
    # (start <= end, end - start <= max_answer_len)
    best_score = -1
    best_start, best_end = 0, 0
    for s in range(len(start_probs[0])):
        for e in range(s, min(s + 30, len(end_probs[0]))):
            score = start_probs[0][s] * end_probs[0][e]
            if score > best_score:
                best_score = score
                best_start, best_end = s, e

    return best_start, best_end
```

## KorQuAD: 한국어 QA 벤치마크

**KorQuAD(Korean Question Answering Dataset)**는 위키피디아 기반의 한국어 추출형 QA 데이터셋이다. 영어의 SQuAD에 해당한다. KorQuAD 1.0은 70K+ 질문-답 쌍, KorQuAD 2.0은 HTML 구조 포함 복잡한 문서까지 다룬다.

```python
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForQuestionAnswering,
    Trainer,
    TrainingArguments,
    DefaultDataCollator,
)

MODEL_NAME = "klue/roberta-base"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForQuestionAnswering.from_pretrained(MODEL_NAME)

# KorQuAD 로드
dataset = load_dataset("squad_kor_v1")  # KorQuAD 1.0

def preprocess(examples):
    questions = [q.strip() for q in examples["question"]]
    inputs = tokenizer(
        questions,
        examples["context"],
        max_length=384,
        truncation="only_second",
        stride=128,
        return_overflowing_tokens=True,
        return_offsets_mapping=True,
        padding="max_length",
    )
    # start/end 포지션 레이블 계산 (오프셋 매핑 활용)
    # ... (생략: 실제 구현은 HuggingFace 예제 참조)
    return inputs

tokenized = dataset.map(preprocess, batched=True, remove_columns=dataset["train"].column_names)

args = TrainingArguments(
    output_dir="./qa-model",
    per_device_train_batch_size=16,
    num_train_epochs=2,
    learning_rate=3e-5,
    warmup_ratio=0.1,
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=tokenized["train"],
    eval_dataset=tokenized["validation"],
    data_collator=DefaultDataCollator(),
    tokenizer=tokenizer,
)

trainer.train()
# KorQuAD 1.0 기준 EM ~84, F1 ~91 달성 가능
```

## 오픈도메인 QA: RAG 접근법

추출형 QA는 정답이 포함된 문서가 이미 주어져 있어야 한다. 하지만 실제 서비스에서는 수백만 개의 문서 중 어디에 답이 있는지 모른다. 이를 해결하는 것이 오픈도메인 QA다.

```python
from transformers import RagTokenizer, RagRetriever, RagTokenForGeneration

# RAG = Dense Retrieval + Generator
tokenizer = RagTokenizer.from_pretrained("facebook/rag-token-nq")
retriever = RagRetriever.from_pretrained(
    "facebook/rag-token-nq",
    index_name="legacy",
)
model = RagTokenForGeneration.from_pretrained(
    "facebook/rag-token-nq",
    retriever=retriever,
)

inputs = tokenizer("What is the capital of South Korea?", return_tensors="pt")
generated = model.generate(**inputs, num_beams=2)
answer = tokenizer.batch_decode(generated, skip_special_tokens=True)
# → ["Seoul"]
```

한국어 오픈도메인 QA의 경우 HuggingFace RAG 대신 커스텀 파이프라인을 구성하는 경우가 많다: **BM25 또는 Dense Retriever로 관련 청크 검색 → KLUE-RoBERTa로 스팬 추출** 구조가 일반적이다.

![HuggingFace QA 파이프라인 코드](/assets/posts/nlp-question-answering-code.svg)

## 평가 지표: EM과 F1

```python
def compute_em_f1(prediction: str, gold: str) -> dict:
    """Exact Match and token-level F1"""
    pred_tokens = prediction.split()
    gold_tokens = gold.split()

    # Exact Match
    em = int(prediction == gold)

    # Token-level F1
    common = set(pred_tokens) & set(gold_tokens)
    if not common:
        return {"em": em, "f1": 0.0}

    precision = len(common) / len(pred_tokens)
    recall    = len(common) / len(gold_tokens)
    f1 = 2 * precision * recall / (precision + recall)

    return {"em": em, "f1": f1}

# 예시
print(compute_em_f1("2013년 6월", "2013년 6월 13일"))
# {'em': 0, 'f1': 0.667}
```

**EM(Exact Match):** 예측값과 정답이 완전히 일치하는 비율. 엄격한 지표.

**F1:** 예측 토큰과 정답 토큰의 겹침 비율. EM보다 관대하고 부분 정답을 인정한다. 실제 QA 평가에서는 여러 정답 중 최고 F1을 취하는 방식을 사용한다.

## 유형별 선택 가이드

| 상황 | 권장 접근 |
|---|---|
| 고정 문서, 빠른 답변 | KLUE-RoBERTa 추출형 QA |
| 문서 없이 지식 활용 | GPT-4o/Claude 직접 질의 |
| 대규모 내부 문서 검색 | RAG (Dense Retrieval + LLM) |
| 복합·추론 질문 | Chain-of-Thought + LLM |

QA 기술은 다음에 다룰 기계 번역, 텍스트 생성과 마찬가지로 현대 LLM의 핵심 능력 중 하나다. RAG 기반 오픈도메인 QA는 LLM 시대에 더욱 중요해졌으며, 이후 RAG 전용 포스트에서 상세히 다룰 예정이다.

---

**지난 글:** [텍스트 요약: 길고 복잡한 문서를 한 문단으로](/posts/nlp-summarization/)

**다음 글:** [기계 번역: 언어의 장벽을 넘는 기술](/posts/nlp-machine-translation/)

<br>
읽어주셔서 감사합니다. 😊
