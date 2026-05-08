---
title: "BART: 시퀀스-투-시퀀스 사전학습 모델"
description: "Meta(Facebook)의 BART가 다양한 노이즈 기법으로 사전학습해 추상 요약·번역에서 강력한 성능을 내는 원리와 mBART·PEGASUS와의 비교를 코드와 함께 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["BART", "트랜스포머", "Seq2Seq", "요약", "사전학습", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-t5/)에서 T5가 모든 NLP 태스크를 텍스트→텍스트로 통일하는 방법을 살펴봤다. 같은 2019년, Meta(당시 Facebook AI Research)는 다른 전략으로 Seq2Seq 사전학습에 접근했다. **BART**(Bidirectional and Auto-Regressive Transformers)는 텍스트를 다양하게 망가뜨린 뒤 복원하는 방식으로 인코더-디코더 쌍을 사전학습한다.

## 핵심 아이디어: 노이즈 복원

BART의 사전학습 목표는 간단하다.

> **노이즈가 추가된 텍스트** → Encoder → Decoder → **원본 텍스트 복원**

노이즈 유형을 다양하게 가져가면 모델이 더 강건한 텍스트 이해 능력을 갖춘다. BART는 다섯 가지 노이즈 기법을 탐구했다.

![BART 사전학습 노이즈 기법](/assets/posts/transformer-bart-pretraining.svg)

## 다섯 가지 노이즈 기법

| 기법 | 설명 | 특이점 |
|------|------|--------|
| Token Masking | BERT MLM과 동일 | 위치 정보 유지 |
| Token Deletion | 토큰 삭제 | 삭제 위치를 모름 |
| Text Infilling | 구간을 단일 [MASK]로 대체 | 구간 길이 예측 필요 |
| Sentence Permutation | 문장 순서 섞기 | 문서 구조 이해 필요 |
| Document Rotation | 임의 토큰부터 시작 | 첫 번째 문장 예측 필요 |

실험 결과 **Text Infilling + Sentence Permutation** 조합이 요약 태스크에서 최고 성능을 냈다.

## 아키텍처

BART는 표준 Encoder-Decoder 구조를 따른다.

- **인코더**: BERT처럼 양방향 Self-Attention. 노이즈 입력을 처리.  
- **디코더**: GPT처럼 Causal Masked Self-Attention + Cross-Attention. 자기 회귀로 원본을 복원.

```python
from transformers import BartForConditionalGeneration, BartTokenizer
import torch

model = BartForConditionalGeneration.from_pretrained('facebook/bart-large-cnn')
tokenizer = BartTokenizer.from_pretrained('facebook/bart-large-cnn')

article = """
Google has announced a new AI model that surpasses GPT-4 on several benchmarks.
The model uses a novel mixture-of-experts architecture and was trained on 2 trillion tokens.
Company officials said the model will be available through their API starting next month.
"""

inputs = tokenizer(article, return_tensors='pt', max_length=1024, truncation=True)
with torch.no_grad():
    summary_ids = model.generate(
        inputs['input_ids'],
        num_beams=4,
        max_length=130,
        min_length=30,
        length_penalty=2.0,
        early_stopping=True,
    )
print(tokenizer.decode(summary_ids[0], skip_special_tokens=True))
```

![BART 요약 파이프라인](/assets/posts/transformer-bart-summarization.svg)

## BART vs T5 vs PEGASUS

| 구분 | BART | T5 | PEGASUS |
|------|------|----|---------|
| 사전학습 목표 | 노이즈 복원 | Span Corruption | 문장 추출 마스킹 |
| 아키텍처 | Enc-Dec | Enc-Dec | Enc-Dec |
| 요약 특화 | ◎ | ○ | ◎ |
| 번역 | ○ | ◎ | △ |
| 파라미터 | 400M (large) | 220M~11B | 568M |

**PEGASUS**(Google, 2020)는 문서에서 중요 문장을 추출해 마스킹하는 **GSG**(Gap Sentence Generation)로 사전학습했다. 요약에 특화된 목표 덕분에 레이블이 적은 환경에서도 뛰어난 성능을 보인다.

## mBART: 다국어 확장

**mBART**(2020)는 BART를 25개 언어의 코퍼스로 확장해 다국어 Seq2Seq 사전학습을 수행했다. 한국어를 포함하며, 기계 번역과 다국어 요약에서 강력한 베이스라인이다.

```python
from transformers import MBartForConditionalGeneration, MBart50TokenizerFast

model = MBartForConditionalGeneration.from_pretrained("facebook/mbart-large-50-many-to-many-mmt")
tokenizer = MBart50TokenizerFast.from_pretrained("facebook/mbart-large-50-many-to-many-mmt")

tokenizer.src_lang = "en_XX"
inputs = tokenizer("I love AI", return_tensors="pt")
translated = model.generate(
    **inputs,
    forced_bos_token_id=tokenizer.lang_code_to_id["ko_KR"],
)
print(tokenizer.decode(translated[0], skip_special_tokens=True))
```

## 정리

- BART = 텍스트 노이즈 추가 → Enc-Dec으로 원본 복원  
- Text Infilling이 핵심 노이즈; 요약엔 Sentence Permutation 병행이 최적  
- 인코더(양방향) + 디코더(자기 회귀)의 결합으로 이해와 생성 모두 강화  
- mBART로 다국어 번역·요약 확장, PEGASUS는 요약 특화 대안

---

**지난 글:** [T5: 텍스트를 텍스트로 변환하는 통합 프레임워크](/posts/transformer-t5/)

**다음 글:** [효율적인 트랜스포머: 긴 시퀀스를 다루는 방법들](/posts/transformer-efficient/)

<br>
읽어주셔서 감사합니다. 😊
