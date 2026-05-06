---
title: "T5: 텍스트를 텍스트로 변환하는 통합 프레임워크"
description: "Google의 T5가 모든 NLP 태스크를 텍스트→텍스트로 통일한 방법, Span Corruption 사전학습, 상대 위치 인코딩, Flan-T5까지 코드와 함께 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["T5", "트랜스포머", "Seq2Seq", "사전학습", "Flan", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-gpt/)에서 GPT가 Decoder-only로 자기 회귀 생성을 하는 방법과 In-Context Learning의 등장을 살펴봤다. 2019년 Google이 발표한 **T5**(Text-To-Text Transfer Transformer)는 다른 방향의 통합을 시도했다. 번역이든, 요약이든, 분류든 — 모든 태스크를 **"텍스트를 받아 텍스트를 출력"** 하는 하나의 프레임워크로 통일한 것이다.

## 핵심 아이디어: Text-To-Text

기존 NLP는 태스크마다 다른 출력 형식이 필요했다. 분류는 클래스 레이블, 회귀는 실수값, 번역은 시퀀스 등. T5는 이 모든 출력을 **텍스트 토큰 시퀀스**로 통일한다.

```
입력:  "translate English to Korean: I love AI"
출력:  "나는 AI를 사랑한다"

입력:  "sst2 sentence: This movie is terrible!"
출력:  "negative"

입력:  "stsb sentence1: I like AI. sentence2: AI is interesting."
출력:  "4.2"   ← 유사도 점수도 텍스트로!
```

이 단순한 아이디어 덕분에 하나의 모델, 하나의 학습 루프, 하나의 Cross-Entropy 손실로 모든 태스크를 동시에 학습(또는 순차 파인튜닝)할 수 있다.

![T5: Text-To-Text Transfer Transformer](/assets/posts/transformer-t5-framework.svg)

## 아키텍처

T5는 원논문의 Encoder-Decoder 구조를 따르되, 두 가지 핵심 변경을 도입했다.

1. **Span Corruption**: MLM 대신 연속된 토큰 구간(span)을 `<X>`, `<Y>` 등 sentinel 토큰으로 마스킹한 뒤, 인코더 입력의 스팬을 디코더가 복원. 마스킹 비율 15%, 평균 스팬 길이 3.  

2. **상대 위치 인코딩**: 절대 위치 PE 대신 토큰 간 상대 거리에 기반한 bias를 어텐션 점수에 추가. 학습 시 최대 길이를 넘어도 일반화가 더 잘 된다.

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
import torch

model     = T5ForConditionalGeneration.from_pretrained('t5-base')
tokenizer = T5Tokenizer.from_pretrained('t5-base')

def t5_run(prefix: str, text: str, max_new: int = 100) -> str:
    prompt = f"{prefix}: {text}"
    ids = tokenizer(prompt, return_tensors='pt').input_ids
    out = model.generate(ids, max_new_tokens=max_new, num_beams=4)
    return tokenizer.decode(out[0], skip_special_tokens=True)

print(t5_run("translate English to Korean", "I love artificial intelligence"))
print(t5_run("summarize", "Google Brain team proposed T5 in 2019..."))
```

![T5 파이프라인 구현](/assets/posts/transformer-t5-code.svg)

## C4 사전학습 데이터

T5는 **C4**(Colossal Clean Crawled Corpus)로 사전학습했다. Common Crawl 웹 데이터에서 중복·유해 콘텐츠를 필터링한 약 750GB 텍스트 코퍼스다. 이 대규모 데이터가 T5의 강력한 일반화 능력의 근간이다.

## 모델 크기 라인업

| 모델 | 파라미터 | 인코더/디코더 레이어 | 히든 크기 |
|------|---------|-------------------|---------|
| T5-Small | 60M | 6 / 6 | 512 |
| T5-Base | 220M | 12 / 12 | 768 |
| T5-Large | 770M | 24 / 24 | 1024 |
| T5-XL | 3B | 24 / 24 | 2048 |
| T5-XXL | 11B | 24 / 24 | 4096 |

## Flan-T5: 지시 조정

2022년 Google은 T5를 1800개 이상의 태스크로 지시 조정(Instruction Tuning)한 **Flan-T5**를 발표했다. Flan-T5는 T5 대비 Zero-shot 성능이 크게 향상되었으며, 오픈소스 중 최고 성능의 Seq2Seq 모델 중 하나다.

```python
# Flan-T5 사용 예
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

model     = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-base")
tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-base")

prompt = "Q: What is the capital of South Korea? A:"
ids = tokenizer(prompt, return_tensors="pt").input_ids
out = model.generate(ids, max_new_tokens=30)
print(tokenizer.decode(out[0], skip_special_tokens=True))
# → "Seoul"
```

## T5 vs BERT vs GPT

| 구분 | T5 | BERT | GPT |
|------|----|------|-----|
| 아키텍처 | Enc-Dec | Enc-only | Dec-only |
| 사전학습 | Span Corruption | MLM+NSP | 자기 회귀 LM |
| 강점 | Seq2Seq 태스크 | NLU | 생성 |
| 통일 인터페이스 | ✓ (text→text) | ✗ | 부분적 |

## 정리

- T5 = 모든 NLP 태스크를 텍스트→텍스트로 통일, 태스크 프리픽스만 변경  
- Span Corruption으로 효율적 사전학습, 상대 PE로 길이 일반화  
- C4 코퍼스 + Encoder-Decoder 구조 + 체계적 하이퍼파라미터 탐색  
- Flan-T5가 지시 조정 추가로 Zero-shot 성능을 크게 향상

---

**지난 글:** [GPT: 자기회귀적 언어 모델의 진화](/posts/transformer-gpt/)

**다음 글:** [BART: 시퀀스-투-시퀀스 사전학습 모델](/posts/transformer-bart/)

<br>
읽어주셔서 감사합니다. 😊
