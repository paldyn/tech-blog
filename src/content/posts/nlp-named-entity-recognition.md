---
title: "개체명 인식(NER): 텍스트에서 정보를 추출하다"
description: "BIO/BIOES 태깅 체계, BERT 기반 NER 아키텍처, 정밀도·재현율·F1 평가 지표, 한국어 NER의 특수 과제를 transformers 파이프라인 코드와 함께 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["NER", "개체명인식", "BIO태깅", "BERT", "정보추출", "NLP", "한국어NLP"]
featured: false
draft: false
---

[지난 글](/posts/nlp-text-preprocessing/)에서 원시 텍스트를 정제하고 형태소 분석을 통해 모델 입력에 적합한 형태로 변환하는 전처리 파이프라인을 구성했다. 이제 그 전처리된 텍스트에서 의미 있는 정보를 추출하는 단계로 넘어간다. **개체명 인식(Named Entity Recognition, NER)**은 텍스트에서 인물명, 기관명, 지명, 날짜 등 특정 범주에 속하는 의미 단위를 자동으로 찾아 분류하는 NLP 태스크다. "홍길동이 서울대학교에서 발표했다"라는 문장을 보고 "홍길동"이 사람이고 "서울대학교"가 기관임을 인식하는 것, 그것이 NER이다.

## 개체명 인식이란

NER은 정보 추출(Information Extraction)의 핵심 구성 요소다. 뉴스 기사에서 언급된 기업과 주가를 연결하거나, 의료 기록에서 약품명과 부작용을 추출하거나, 법률 문서에서 관련 인물과 날짜를 파악하는 데 활용된다.

NER의 출력은 다음과 같다. 입력 텍스트의 각 스팬(span, 하나 이상의 연속된 토큰)에 대해:
- **스팬의 시작/끝 위치**
- **개체명 유형 레이블** (PER, ORG, LOC, DATE 등)

예를 들어 "2024년 1월 이순신 장군 동상이 서울 광화문에 세워졌다"를 처리하면:
- (0, 11) → DATE: "2024년 1월"
- (12, 17) → PER: "이순신 장군"
- (21, 23) → LOC: "서울"
- (24, 27) → LOC: "광화문"

## BIO 태깅 체계

NER을 시퀀스 레이블링 문제로 모델링할 때 가장 널리 쓰이는 표현 방식이 **BIO 태깅**이다.

- **B (Beginning):** 개체명의 첫 번째 토큰
- **I (Inside):** 개체명의 두 번째 이후 토큰
- **O (Outside):** 개체명에 속하지 않는 토큰

"홍길동이 서울대학교에서 발표했다"를 형태소 단위로 분리하면:

| 토큰 | BIO 태그 | 의미 |
|------|----------|------|
| 홍길동 | B-PER | 인물 개체명 시작 |
| 이 | O | 조사 (개체명 아님) |
| 서울 | B-ORG | 기관명 시작 |
| 대학교 | I-ORG | 기관명 내부 |
| 에서 | O | 조사 (개체명 아님) |
| 발표 | O | 동사 (개체명 아님) |
| 했다 | O | 어미 (개체명 아님) |

B 태그와 I 태그가 모두 정확히 예측돼야 "서울대학교"라는 스팬이 올바르게 인식된다. 하나라도 틀리면 해당 개체는 오답이다.

![BIO 태깅 시각화 및 BERT NER 아키텍처](/assets/posts/nlp-named-entity-recognition-bio.svg)

### BIOES 확장

BIO보다 정보가 풍부한 **BIOES** 태깅도 있다.

- **B:** 다중 토큰 개체의 시작
- **I:** 다중 토큰 개체의 내부
- **O:** 개체 외부
- **E:** 다중 토큰 개체의 끝
- **S:** 단일 토큰 개체 (Single)

"홍길동"이 한 토큰이라면 B-PER/I-PER/E-PER 대신 S-PER로 표현할 수 있다. BIOES는 모델이 경계 정보를 더 명확하게 학습할 수 있게 해 주지만, 레이블 공간이 커진다는 단점이 있다.

## BERT 기반 NER

전통적인 NER 시스템은 HMM, MaxEnt, CRF(Conditional Random Fields) 등에 의존했다. 현재 최고 성능은 **BERT 기반 접근법**이 차지한다.

### 아키텍처

BERT 기반 NER의 구조는 단순하다.

```
[CLS] 홍길동 이 서울 대학교 에서 발표 했다 [SEP]
  ↓       ↓   ↓   ↓    ↓    ↓   ↓    ↓
BERT Encoder (각 토큰의 문맥화 표현)
  ↓       ↓   ↓   ↓    ↓    ↓   ↓    ↓
Linear Layer (레이블 수 = BIO 태그 수)
  ↓       ↓   ↓   ↓    ↓    ↓   ↓    ↓
Softmax → 각 토큰의 BIO 태그 확률 분포
```

BERT의 양방향 어텐션 덕분에 각 토큰의 표현이 문장 전체 문맥을 반영한다. "배"라는 글자가 인물의 성씨인지, 과일인지, 선박인지를 문맥으로 파악할 수 있다.

### WordPiece와 토큰 정렬

BERT는 WordPiece 토크나이저를 사용한다. "서울대학교"가 ["서울", "##대", "##학", "##교"]처럼 분리될 수 있다. 이 경우 NER 예측을 원래 단어 경계에 맞게 다시 정렬해야 한다.

일반적인 접근법은 각 단어의 **첫 번째 서브워드 토큰에만 레이블을 부여**하고, 나머지는 무시하거나 첫 토큰의 레이블을 그대로 사용하는 것이다.

```python
from transformers import AutoTokenizer, AutoModelForTokenClassification
import torch

tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")
model = AutoModelForTokenClassification.from_pretrained("klue/bert-base")

text = "홍길동이 삼성전자에 입사했다."
inputs = tokenizer(text, return_tensors="pt")
word_ids = inputs.word_ids()  # 각 서브워드 토큰이 몇 번째 단어인지

with torch.no_grad():
    outputs = model(**inputs)
    logits = outputs.logits  # shape: (1, seq_len, num_labels)
    
predictions = logits.argmax(dim=-1)[0]
labels = model.config.id2label

# 단어 단위로 집계 (첫 서브워드 토큰의 예측만 사용)
prev_word_id = None
for token_id, word_id, pred_id in zip(inputs['input_ids'][0], word_ids, predictions):
    if word_id is None or word_id == prev_word_id:
        continue
    print(f"토큰: {tokenizer.decode([token_id])}, 태그: {labels[pred_id.item()]}")
    prev_word_id = word_id
```

## Transformers Pipeline으로 NER 실행

Hugging Face의 `pipeline`을 사용하면 한 줄로 NER을 실행할 수 있다.

![NER 코드 예제](/assets/posts/nlp-named-entity-recognition-code.svg)

```python
from transformers import pipeline

# NER 파이프라인 생성
ner = pipeline(
    "ner",
    model="snunlp/KR-FinBert-SC",
    aggregation_strategy="simple",  # B-/I- 태그를 자동으로 스팬으로 합침
)

# 단일 문장 처리
text = "홍길동이 삼성전자에 입사했다."
result = ner(text)
print(result)
# [
#   {'entity_group': 'PER', 'word': '홍길동', 'score': 0.9934, 'start': 0, 'end': 3},
#   {'entity_group': 'ORG', 'word': '삼성전자', 'score': 0.9712, 'start': 5, 'end': 9}
# ]

# 여러 문장 배치 처리
texts = [
    "이순신 장군은 1545년 서울에서 태어났다.",
    "현대자동차는 울산공장에서 전기차를 생산한다.",
]
results = ner(texts)
for text, entities in zip(texts, results):
    print(f"\n문장: {text}")
    for e in entities:
        print(f"  [{e['entity_group']}] {e['word']} (신뢰도: {e['score']:.3f})")
```

`aggregation_strategy` 옵션:
- `"none"`: 각 서브워드 토큰의 예측을 그대로 반환
- `"simple"`: 연속된 같은 유형의 B-/I- 태그를 하나의 스팬으로 합침
- `"first"`: 스팬의 첫 번째 서브워드 점수 사용
- `"average"`: 스팬 내 모든 서브워드 점수 평균

## NER 평가 지표

NER 평가는 **스팬 단위**로 이루어진다. 개체의 유형과 경계가 모두 정확해야 정답으로 인정한다.

### Precision, Recall, F1

```python
from seqeval.metrics import precision_score, recall_score, f1_score, classification_report

# 정답 레이블과 예측 레이블 (스팬 표기)
true_labels = [['O', 'B-PER', 'I-PER', 'O', 'B-ORG', 'I-ORG', 'O']]
pred_labels = [['O', 'B-PER', 'I-PER', 'O', 'B-ORG', 'O', 'O']]
# → 'B-ORG', 'I-ORG' 대신 'B-ORG', 'O'로 예측
# → 서울대학교 스팬 불완전 인식 → ORG 오답

print(f"Precision: {precision_score(true_labels, pred_labels):.3f}")
print(f"Recall:    {recall_score(true_labels, pred_labels):.3f}")
print(f"F1:        {f1_score(true_labels, pred_labels):.3f}")
print(classification_report(true_labels, pred_labels))
```

### 엔티티 유형별 평가

실제 NER 시스템은 유형별 F1 점수도 보고한다. "PER F1: 0.95, ORG F1: 0.88, LOC F1: 0.91"처럼 유형에 따라 성능이 다를 수 있다. 날짜/시간(DATE, TIME) 유형은 규칙 기반으로도 높은 성능을 낼 수 있어 F1이 높은 경우가 많고, 기타(MISC) 유형은 정의가 모호해 성능이 낮은 경향이 있다.

## 한국어 NER의 특수 과제

한국어 NER은 영어 NER에 비해 여러 추가적인 어려움이 있다.

### 형태소 분석 오류의 전파

형태소 분석 오류가 NER에도 영향을 준다. "삼성전자에"를 ["삼성전자", "에"]로 올바르게 분리해야 "삼성전자"를 ORG로 태깅할 수 있다. 만약 ["삼성", "전자에"]로 잘못 분리되면 개체명 경계가 왜곡된다.

### 동형이의어 문제

"배"는 사람 이름의 성씨(裵), 과일(梨), 선박(船), 신체 부위(腹)로 쓰인다. 문맥 없이는 개체명 여부를 판단하기 어렵다. BERT의 양방향 어텐션이 이 문제를 잘 처리하지만 완벽하지 않다.

### 희귀 개체명

신인 배우, 스타트업 이름, 새로운 지명 등은 학습 데이터에 없을 가능성이 높다. BERT 기반 모델은 이런 미등장(out-of-vocabulary) 개체를 서브워드 단위로 분리하여 처리하지만, 성능이 낮아지는 경우가 많다.

### 주요 한국어 NER 데이터셋

- **KLUE-NER:** 한국어 언어 이해 벤치마크의 NER 태스크. 9가지 개체 유형, 총 35,000+ 문장
- **KMOU NER:** 한국해양대학교에서 공개한 데이터셋. 뉴스 도메인 특화
- **국립국어원 형태 분석 말뭉치:** 개체명 정보 포함

## NER 기반 정보 추출 파이프라인

실무에서는 NER 결과를 지식 그래프나 데이터베이스로 연결하는 파이프라인을 구성한다.

```python
from transformers import pipeline
from collections import defaultdict

def extract_entities_from_articles(articles, ner_pipeline):
    """뉴스 기사 컬렉션에서 개체명 추출 및 빈도 집계"""
    entity_freq = defaultdict(lambda: defaultdict(int))
    
    for article in articles:
        entities = ner_pipeline(article)
        for entity in entities:
            entity_type = entity['entity_group']
            entity_word = entity['word']
            if entity['score'] > 0.85:  # 신뢰도 임계값
                entity_freq[entity_type][entity_word] += 1
    
    return entity_freq

# 사용 예시
articles = [
    "삼성전자가 갤럭시S25를 출시했다. 이재용 회장이 직접 발표회에 참석했다.",
    "현대자동차와 삼성전자가 배터리 공급 계약을 체결했다.",
    "이재용 삼성 회장이 서울에서 외국 기업 임원들을 만났다.",
]

ner = pipeline("ner", model="snunlp/KR-FinBert-SC", aggregation_strategy="simple")
freq = extract_entities_from_articles(articles, ner)

for etype, entities in freq.items():
    print(f"\n[{etype}]")
    for name, count in sorted(entities.items(), key=lambda x: -x[1]):
        print(f"  {name}: {count}회")
# [ORG]
#   삼성전자: 2회
#   현대자동차: 1회
# [PER]
#   이재용: 2회
```

NER은 독립적인 태스크이기도 하지만, 관계 추출(Relation Extraction), 이벤트 추출(Event Extraction), 질의응답(QA) 시스템의 전 단계로도 활용된다. 특히 "삼성전자가 현대자동차와 계약을 체결했다"에서 두 기업 사이의 관계(체결)를 추출하려면 먼저 NER이 정확히 동작해야 한다. 다음 글에서는 각 토큰의 문법적 역할을 파악하는 **품사 태깅(POS Tagging)**으로 넘어간다.

---

**지난 글:** [NLP 텍스트 전처리: 데이터를 모델에 맞게 다듬다](/posts/nlp-text-preprocessing/)

**다음 글:** [품사 태깅(POS): 단어의 문법적 역할 파악](/posts/nlp-pos-tagging/)

<br>
읽어주셔서 감사합니다. 😊
