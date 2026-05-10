---
title: "한국어 NLP: 교착어 처리와 한국어 특화 모델"
description: "한국어의 교착어 특성과 NLP 파이프라인 구성, KoNLPy·Kiwi 형태소 분석, KLUE 벤치마크, KoBERT·KoELECTRA·HyperCLOVA X까지 한국어 NLP 생태계 전체를 실전 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["한국어NLP", "형태소분석", "Kiwi", "KoNLPy", "KLUE", "KoBERT", "KoELECTRA", "HyperCLOVA"]
featured: false
draft: false
---

[지난 글](/posts/nlp-coreference/)에서 대명사가 가리키는 대상을 찾는 지시 해소를 살펴봤다. 지시 해소에서도 한국어의 특수성이 중요했는데, 이번에는 아예 **한국어 NLP** 전체를 전용으로 다룬다. 한국어는 영어와 근본적으로 다른 언어 구조를 가지기 때문에, 영어 중심으로 발전한 NLP 방법론을 그대로 적용하면 성능이 크게 떨어진다. 한국어의 특성을 이해하고 이에 맞는 도구와 모델을 선택하는 것이 핵심이다.

## 한국어의 언어적 특성

**교착어(Agglutinative Language):** 한국어는 어근에 접사를 붙여 의미를 확장하는 교착어다. "먹다"의 다양한 변형을 보면 이 특성이 명확하다.

| 형태 | 구성 | 의미 |
|---|---|---|
| 먹었다 | 먹(어근) + 었(과거) + 다(종결) | 먹었다 |
| 먹겠습니다 | 먹 + 겠(미래 의도) + 습니다(격식) | 먹겠습니다 |
| 드셨나요 | 드시(존댓말) + 었 + 나요(의문) | 드셨나요? |

같은 개념이 수십 가지 형태로 표현될 수 있다. 영어의 "eat"은 기본형 포함 6가지 정도지만, 한국어 동사는 수백 가지 활용형이 존재한다.

**SOV 어순과 자유 어순:** 기본 어순은 주어-목적어-동사(SOV)이지만, 조사가 문법 역할을 담당하기 때문에 어순을 바꿔도 의미가 유지된다. "철수가 영희를 사랑한다"와 "영희를 철수가 사랑한다"는 동일한 의미다.

**조사(Particle):** 한국어의 조사는 명사의 문법적 역할을 표시한다. 주격조사(이/가), 목적격조사(을/를), 부사격조사(에서, 에게, 로) 등이 있다.

**경어법:** 상대방에 대한 존칭 여부가 어미와 어휘에 반영된다. "먹다/드시다/잡수시다"처럼 어휘 자체가 바뀌는 경우도 있다.

## 형태소 분석: 한국어 NLP의 핵심

영어에서는 공백 기반 토큰화만으로도 기본 처리가 가능하지만, 한국어에서는 **형태소 분석(Morphological Analysis)**이 필수다.

![한국어 NLP 처리 파이프라인](/assets/posts/nlp-korean-processing-pipeline.svg)

### 주요 형태소 분석기

**KoNLPy:** 자바 기반 형태소 분석기 래퍼. Okt(트위터), MeCab(은전한닢), Komoran, Hannanum, Kkma 등을 파이썬에서 사용할 수 있다.

```python
from konlpy.tag import Okt, MeCab

okt = Okt()
mecab = MeCab()

text = "삼성전자가 반도체 시장에서 선두를 유지하고 있다."

# Okt (형태소, 품사) 쌍 반환
print(okt.pos(text, norm=True, stem=True))
# [('삼성전자', 'Noun'), ('가', 'Josa'), ('반도체', 'Noun'),
#  ('시장', 'Noun'), ('에서', 'Josa'), ('선두', 'Noun'),
#  ('를', 'Josa'), ('유지', 'Noun'), ('하다', 'Verb'), ...]

# MeCab (더 정확한 분석)
print(mecab.pos(text))
# [('삼성전자', 'NNP'), ('가', 'JKS'), ('반도체', 'NNG'),
#  ('시장', 'NNG'), ('에서', 'JKB'), ('선두', 'NNG'),
#  ('를', 'JKO'), ('유지', 'NNG'), ('하', 'XSV'), ...]
```

**Kiwi (Korean Intelligent Word Identifier):** 순수 C++로 구현된 고성능 형태소 분석기. 자바 의존성이 없어 배포가 간편하고, 최신 신조어와 비정형 텍스트에도 강건하다. 현재 가장 활발히 관리되는 도구다.

```python
from kiwipiepy import Kiwi
from kiwipiepy.utils import Stopwords

kiwi = Kiwi()
stopwords = Stopwords()

text = "오늘 회의에서 신제품 출시 일정이 확정됐다고 발표됐습니다."

# 형태소 분석
result = kiwi.analyze(text)
for token in result[0][0]:
    print(f"{token.form:10s} {token.tag:8s} {token.start}:{token.end}")

# 불용어 제거 후 명사만 추출
nouns = kiwi.nouns(text)
print(nouns)  # ['오늘', '회의', '신제품', '출시', '일정']

# 문장 분리
sentences = kiwi.split_into_sents(
    "오늘 회의했다. 내일 발표한다. 모레 출시된다."
)
for sent in sentences:
    print(sent.text)
```

## KLUE: 한국어 NLP 벤치마크

**KLUE(Korean Language Understanding Evaluation)**는 한국어 NLP 모델 성능을 종합 평가하는 벤치마크로, 총 8개 태스크로 구성된다.

| 태스크 | 설명 | 현 SOTA |
|---|---|---|
| TC (주제 분류) | 뉴스 7개 카테고리 | F1 0.93+ |
| STS (문장 유사도) | 두 문장 유사도 측정 | Pearson 0.93+ |
| NLI (자연어 추론) | 함의/모순/중립 분류 | Acc 0.90+ |
| NER (개체명 인식) | 인물/장소/기관 등 태깅 | F1 0.88+ |
| RE (관계 추출) | 두 개체 간 관계 분류 | F1 0.73+ |
| DP (의존 구문) | 토큰 간 의존 구조 분석 | UAS 0.93+ |
| MRC (기계독해) | 지문에서 정답 스팬 추출 | EM 0.86+ |
| WOS (대화 상태 추적) | 챗봇 슬롯 추출 | JGA 0.51+ |

## 한국어 사전학습 모델 생태계

![Kiwi + KLUE-RoBERTa 실전 코드](/assets/posts/nlp-korean-processing-code.svg)

### BERT 계열

**KoBERT (SKT):** 한국어 위키피디아와 뉴스로 사전학습. BERT-base 규모. 초기 한국어 BERT의 대표 모델이었으나 현재는 KLUE 모델에 비해 성능이 낮다.

**KLUE-BERT / KLUE-RoBERTa:** KLUE 팀이 공개한 한국어 특화 모델. 웹 뉴스, 위키, 소셜 미디어 등 다양한 도메인 데이터로 학습. 대부분 한국어 태스크에서 최고 성능.

**KoELECTRA:** 생성자-판별자 구조의 ELECTRA를 한국어에 적용. 같은 파라미터 수 대비 BERT보다 높은 성능.

```python
from transformers import AutoTokenizer, AutoModel
import torch

# KLUE-RoBERTa로 문장 임베딩
model_name = "klue/roberta-large"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

def get_embedding(text: str) -> torch.Tensor:
    inputs = tokenizer(
        text,
        return_tensors="pt",
        max_length=512,
        truncation=True,
    )
    with torch.no_grad():
        outputs = model(**inputs)
    # [CLS] 토큰의 hidden state 사용
    return outputs.last_hidden_state[:, 0, :]  # (1, 1024)

emb = get_embedding("한국어 자연어 처리의 중요성")
print(emb.shape)  # torch.Size([1, 1024])
```

### 대형 언어 모델

**HyperCLOVA X (NAVER):** 한국어에 최적화된 국내 최대 규모 LLM. API 형태로 제공.

**EXAONE (LG AI Research):** 영한 이중언어 LLM. 허깅페이스에 오픈소스로 공개.

**SOLAR (Upstage):** 10.7B 규모 한국어 강화 모델. Depth-Upscaling 기법으로 효율적 구성.

```python
# Upstage SOLAR API 사용 예
from openai import OpenAI  # SOLAR는 OpenAI 호환 API

client = OpenAI(
    api_key="your-upstage-api-key",
    base_url="https://api.upstage.ai/v1/solar",
)

response = client.chat.completions.create(
    model="solar-pro",
    messages=[
        {
            "role": "system",
            "content": "당신은 한국어 법률 문서 분석 전문가입니다.",
        },
        {
            "role": "user",
            "content": "다음 계약서의 핵심 조항을 요약해주세요: ...",
        },
    ],
    max_tokens=512,
)
print(response.choices[0].message.content)
```

## 한국어 NLP 실전 파이프라인

```python
from kiwipiepy import Kiwi
from transformers import pipeline as hf_pipeline

kiwi = Kiwi()

# NER 파이프라인
ner = hf_pipeline(
    "token-classification",
    model="Leo97/KoELECTRA-small-v3-modu-ner",
    aggregation_strategy="simple",
)

# 분류 파이프라인
classifier = hf_pipeline(
    "text-classification",
    model="klue/roberta-base",
)

def process_korean(text: str) -> dict:
    # 1. 형태소 분석
    morphs = [
        (t.form, t.tag)
        for t in kiwi.analyze(text)[0][0]
    ]

    # 2. 명사 추출
    nouns = [form for form, tag in morphs if tag.startswith("NN")]

    # 3. 개체명 인식
    entities = ner(text)

    return {
        "morphemes": morphs,
        "nouns": nouns,
        "entities": [
            {"text": e["word"], "label": e["entity_group"]}
            for e in entities
        ],
    }

result = process_korean(
    "이재용 삼성전자 회장이 서울 강남구 본사에서 기자회견을 열었다."
)
print(result)
# {
#   "morphemes": [("이재용", "NNP"), ("삼성전자", "NNP"), ...],
#   "nouns": ["이재용", "삼성전자", "회장", "서울", "강남구", "본사"],
#   "entities": [
#     {"text": "이재용", "label": "PS"},  # 인물
#     {"text": "삼성전자", "label": "OG"},  # 기관
#     {"text": "서울 강남구", "label": "LC"},  # 장소
#   ]
# }
```

## 한국어 NLP 데이터셋

| 데이터셋 | 규모 | 용도 |
|---|---|---|
| KLUE | 8개 태스크 | 다목적 벤치마크 |
| KorQuAD 1.0/2.0 | 70K/100K QA | 기계독해 |
| NSMC (네이버 쇼핑) | 200K 리뷰 | 감성 분석 |
| AI Hub 한국어 NLP | 다수 | 정부 지원 공개 데이터 |
| KCC150 | 150M 토큰 | 사전학습용 코퍼스 |

이로써 NLP 섹션의 주요 태스크 커버리지가 완성됐다. 다음 글부터는 이 모든 NLP 기술의 집합체라 할 수 있는 **대규모 언어 모델(LLM)**의 본질을 탐구한다.

---

**지난 글:** [지시 해소: 대명사가 가리키는 것을 찾아라](/posts/nlp-coreference/)

**다음 글:** [LLM의 본질: 거대 언어 모델이란 무엇인가](/posts/llm-essence/)

<br>
읽어주셔서 감사합니다. 😊
