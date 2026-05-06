---
title: "BERT: 양방향 사전학습 언어 모델의 등장"
description: "GPT가 단방향인 이유, BERT가 MLM으로 양방향 컨텍스트를 학습하는 방법, NSP 태스크, 파인튜닝 패턴, RoBERTa·ALBERT와의 비교를 코드와 함께 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["BERT", "트랜스포머", "사전학습", "MLM", "파인튜닝", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/transformer-masking/)에서 Causal Mask가 디코더의 미래 참조를 어떻게 차단하는지 살펴봤다. GPT처럼 왼쪽→오른쪽(단방향) 언어 모델은 이 마스크 덕분에 자기 회귀 생성을 할 수 있다. 하지만 "나는 __을 좋아한다"에서 빈칸을 채울 때, 단어 앞뒤 맥락을 모두 볼 수 있다면 더 정확하지 않을까? 이 아이디어에서 출발한 것이 **BERT**(Bidirectional Encoder Representations from Transformers)다.

## BERT의 핵심 아이디어

2018년 Google이 발표한 BERT는 트랜스포머 **Encoder만** 사용한다. 인코더는 Causal Mask가 없으므로 모든 위치가 양방향으로 서로를 참조한다. BERT는 이 양방향성을 활용해 두 가지 자기 지도 학습(self-supervised) 태스크로 사전학습한다.

## 사전학습 태스크

### ① Masked Language Model (MLM)

입력 토큰의 15%를 무작위 선택해 마스킹한 뒤, 원본 토큰을 예측한다.

- 선택된 15% 중 **80%**는 `[MASK]`로 치환  
- **10%**는 다른 랜덤 토큰으로 치환  
- **10%**는 원본 유지 (예측 목표는 동일)

이 세 가지 비율을 섞는 이유: `[MASK]`만 쓰면 파인튜닝 시 `[MASK]`가 없는 실제 텍스트에 모델이 취약해진다.

### ② Next Sentence Prediction (NSP)

두 문장을 이어 붙인 쌍 `[CLS] A [SEP] B [SEP]`에서 B가 실제로 A 다음에 오는 문장인지 예측한다. 50%는 실제 연속 문장, 50%는 무작위 쌍으로 구성한다.

> 이후 RoBERTa가 NSP가 실제로 성능 향상에 기여하지 않는다는 것을 보여줘, 후속 모델들은 NSP를 제거하거나 더 강화된 태스크로 교체했다.

![BERT 사전학습: MLM + NSP](/assets/posts/transformer-bert-pretraining.svg)

## 입력 표현

BERT의 입력은 세 종류 임베딩의 합이다.

```
입력 = Token Embedding + Segment Embedding + Position Embedding
```

- **Token Embedding**: WordPiece 서브워드 토크나이저 기반  
- **Segment Embedding**: 첫 번째 문장(A) vs 두 번째 문장(B) 구분  
- **Position Embedding**: 학습형 (최대 512 위치)

```python
from transformers import BertTokenizer, BertModel
import torch

tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
model = BertModel.from_pretrained('bert-base-uncased')

text = "I love transformers."
inputs = tokenizer(text, return_tensors='pt')
# {'input_ids': ..., 'attention_mask': ..., 'token_type_ids': ...}

with torch.no_grad():
    outputs = model(**inputs)

last_hidden = outputs.last_hidden_state   # (1, seq_len, 768)
cls_repr    = outputs.pooler_output       # (1, 768) — [CLS] 표현
```

## 파인튜닝 패턴

BERT의 강점은 **최소한의 헤드**를 추가해 다양한 태스크에 파인튜닝할 수 있다는 점이다.

![BERT 파인튜닝 패턴](/assets/posts/transformer-bert-finetuning.svg)

```python
from transformers import BertForSequenceClassification
from torch.optim import AdamW

model = BertForSequenceClassification.from_pretrained(
    'bert-base-uncased', num_labels=2
)
optimizer = AdamW(model.parameters(), lr=2e-5)

# 학습 루프 (단순화)
for batch in dataloader:
    outputs = model(**batch)
    loss = outputs.loss
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
```

## BERT 모델 비교

| 모델 | 레이어 | 히든 | 헤드 | 파라미터 |
|------|--------|------|------|---------|
| BERT-Base | 12 | 768 | 12 | 110M |
| BERT-Large | 24 | 1024 | 16 | 340M |
| RoBERTa-Base | 12 | 768 | 12 | 125M |
| ALBERT-Base | 12 | 768 | 12 | 12M |

**RoBERTa**: NSP 제거, 더 큰 배치, 더 많은 데이터, 동적 마스킹 적용 → 성능 향상.  
**ALBERT**: 레이어 간 파라미터 공유 + 임베딩 분해로 파라미터 대폭 절감. NSP 대신 Sentence Order Prediction(SOP) 도입.

## 한국어 BERT

| 모델 | 주요 특징 |
|------|----------|
| KR-BERT | 한국어 위키·뉴스 학습 |
| KLUE-BERT | KLUE 벤치마크 기반 |
| KoELECTRA | ELECTRA 방식 학습 |

## BERT의 한계

- 생성 불가: Encoder-only이므로 텍스트 생성에는 적합하지 않음  
- `[MASK]` 불일치: 사전학습과 파인튜닝 간 입력 분포 차이  
- 최대 512 토큰 제한 (학습형 PE 상한)

## 정리

- BERT = Transformer Encoder만, MLM으로 양방향 컨텍스트 학습  
- MLM의 80/10/10 마스킹 전략이 파인튜닝 견고성의 핵심  
- `[CLS]` 표현 + 경량 헤드로 분류·NER·QA 등 다양한 태스크에 적용  
- RoBERTa, ALBERT, 한국어 특화 모델로 계속 발전

---

**지난 글:** [Masking: 트랜스포머의 정보 차단 전략](/posts/transformer-masking/)

**다음 글:** [GPT: 자기회귀적 언어 모델의 진화](/posts/transformer-gpt/)

<br>
읽어주셔서 감사합니다. 😊
