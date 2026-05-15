---
title: "텍스트 분류: 언어에 레이블을 붙이는 기술"
description: "TF-IDF + 로지스틱 회귀부터 BERT 파인튜닝까지, 텍스트 분류의 전체 스펙트럼을 주제 분류·감성 분류·의도 분류·독성 감지 예제와 함께 한국어 실전 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["텍스트분류", "NLP", "BERT", "파인튜닝", "KoBERT", "KLUE", "감성분석", "의도분류"]
featured: false
draft: false
---

[지난 글](/posts/nlp-sentiment-analysis/)에서 텍스트에 담긴 감정을 읽는 감성 분석을 다뤘다. 감성 분석도 사실 더 큰 카테고리인 **텍스트 분류(Text Classification)**의 한 갈래다. 텍스트 분류는 주어진 텍스트에 하나 혹은 여러 개의 레이블을 자동으로 할당하는 NLP의 가장 고전적이면서도 실용적인 태스크다. 스팸 메일 필터링, 뉴스 기사 카테고리화, 챗봇의 의도 파악, 고객 문의 자동 라우팅… 분류 기술 없이는 현대 AI 서비스의 대부분이 작동하지 않는다.

## 텍스트 분류의 유형

분류 문제는 레이블 구조에 따라 세 가지로 나뉜다.

**이진 분류(Binary):** 두 클래스 중 하나를 선택. 스팸/정상, 긍정/부정이 대표적이다.

**다중 클래스 분류(Multi-class):** 세 개 이상의 클래스 중 하나를 선택. 뉴스 카테고리(스포츠/정치/경제/문화)가 전형적인 예다.

**다중 레이블 분류(Multi-label):** 하나의 텍스트에 여러 레이블을 동시에 할당. 기사에 "경제"와 "글로벌"을 동시에 붙이는 경우다. 시그모이드 출력 + BCELoss를 사용하며, 소프트맥스 기반 다중 클래스와 혼동하지 않도록 주의해야 한다.

## 모델 발전사: 규칙 → 통계 → 딥러닝

텍스트 분류 방법론은 크게 세 세대로 구분된다.

### 1세대: 규칙/사전 기반

정규표현식과 키워드 사전으로 분류. 특정 단어가 있으면 A, 없으면 B 방식이다. 구축이 빠르고 해석이 쉽지만, 유지보수 비용이 높고 신조어나 오탈자에 취약하다. 지금도 명확한 규칙이 있는 도메인(금융 규정 준수, 법률 문서)에서는 활용된다.

### 2세대: TF-IDF + 전통 ML

텍스트를 단어 빈도(TF-IDF) 벡터로 변환한 뒤 나이브 베이즈, SVM, 로지스틱 회귀 같은 고전 모델에 입력한다. 빠른 학습, 적은 데이터로도 준수한 성능을 내며 레이블이 명확한 도메인에서 여전히 경쟁력이 있다.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# 한국어 형태소 기반 TF-IDF 파이프라인
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        analyzer="word",
        tokenizer=mecab_tokenize,  # KoNLPy MeCab
        ngram_range=(1, 2),
        max_features=50_000,
        sublinear_tf=True,
    )),
    ("clf", LogisticRegression(
        C=5.0,
        max_iter=1000,
        class_weight="balanced",
    )),
])

pipeline.fit(train_texts, train_labels)
preds = pipeline.predict(test_texts)
```

### 3세대: 사전학습 언어 모델 (BERT 계열)

BERT 등 트랜스포머 기반 모델은 문맥을 이해하는 밀집 표현(dense representation)을 학습한다. `[CLS]` 토큰의 표현 위에 선형 분류기 헤드를 붙여 파인튜닝하면 대부분 태스크에서 TF-IDF 대비 5~15%p 이상의 성능 향상을 보인다.

## 파이프라인 구조

![텍스트 분류 파이프라인](/assets/posts/nlp-text-classification-pipeline.svg)

분류 파이프라인은 **입력 → 토크나이저 → 인코더 → 분류기 헤드 → 레이블** 순서로 진행된다. BERT 기반 모델에서는 시퀀스 전체를 요약하는 `[CLS]` 토큰의 숨겨진 상태(768차원)를 분류 헤드에 입력한다.

## HuggingFace로 구현하기

![HuggingFace 텍스트 분류 구현](/assets/posts/nlp-text-classification-code.svg)

### 빠른 시작: Pipeline API

```python
from transformers import pipeline

clf = pipeline(
    "text-classification",
    model="snunlp/KR-FinBert-SC",
)

texts = [
    "삼성전자 3분기 영업이익 사상 최대 기록",
    "코스피 장중 3% 폭락, 외국인 매도 지속",
    "금리 동결 결정으로 시장 안정세",
]

results = clf(texts)
# [{'label': 'positive', 'score': 0.94},
#  {'label': 'negative', 'score': 0.97},
#  {'label': 'neutral',  'score': 0.88}]
```

### 커스텀 파인튜닝

```python
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
)
import numpy as np
from sklearn.metrics import f1_score

MODEL_NAME = "klue/roberta-base"
NUM_LABELS = 3  # 긍정/부정/중립

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME, num_labels=NUM_LABELS
)

def tokenize(batch):
    return tokenizer(
        batch["text"],
        truncation=True,
        max_length=128,
    )

dataset = load_dataset("klue", "ynat")  # 7개 뉴스 카테고리
dataset = dataset.map(tokenize, batched=True)

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {"f1": f1_score(labels, preds, average="macro")}

args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=3,
    per_device_train_batch_size=32,
    learning_rate=3e-5,
    warmup_ratio=0.1,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1",
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    compute_metrics=compute_metrics,
)

trainer.train()
```

## 한국어 텍스트 분류의 특수성

영어와 달리 한국어 텍스트 분류에는 몇 가지 추가 고려사항이 있다.

**형태소 분석의 중요성:** TF-IDF 기반 접근에서는 "좋다"/"좋아서"/"좋았던"이 모두 다른 토큰으로 처리된다. MeCab이나 Kiwi로 형태소를 분리하면 표제어를 통일할 수 있다.

**한국어 특화 모델:** KLUE-BERT, KoBERT, KoELECTRA, KoRoBERTa 등이 있다. 일반 목적으로는 KLUE-RoBERTa-large가 대부분 태스크에서 최고 성능을 보인다. 도메인 특화(금융, 의료, 법률)는 해당 도메인 사전학습 모델을 찾거나 직접 지속적 사전학습(CPT)을 수행해야 한다.

**구어체 처리:** 소셜 미디어 텍스트는 오탈자, 신조어, 이모지, 반복 문자("ㅋㅋㅋㅋ") 등이 많다. 전처리 단계에서 정규화 레이어를 추가하거나, 오탈자에 강건한 BPE 기반 토크나이저를 사용하는 것이 효과적이다.

## 실전 팁

**레이블 불균형 처리:** 클래스 간 샘플 수가 크게 다르면 `class_weight="balanced"` 또는 Focal Loss를 사용한다.

**임계값 조정:** 소프트맥스 최대값이 0.7 미만이면 "분류 불가"로 처리하는 신뢰도 게이팅을 추가하면 실제 서비스 품질이 크게 개선된다.

**계층적 분류:** 대분류 → 소분류 2단계 분류기를 사용하면 클래스 수가 많을 때(50개 이상) 전체 정확도가 올라간다.

**데이터 증강:** 레이블이 적은 클래스에 대해 역번역(한→영→한), 동의어 치환, EDA(Easy Data Augmentation)를 적용한다.

## 언제 어떤 모델을 쓸까

| 상황 | 추천 접근법 |
|---|---|
| 레이블 수백~수천 개, 빠른 POC | TF-IDF + LR |
| 레이블 1만+ 개, GPU 없음 | fastText |
| 고성능, 도메인 범용 | KLUE-RoBERTa-base 파인튜닝 |
| 레이블 10개 미만, 예제 부족 | GPT-4o few-shot |
| 추론 속도 중요 | DistilKoBERT or 양자화 |

텍스트 분류는 NLP 응용의 진입점이자, 복잡한 파이프라인의 첫 단계인 경우가 많다. 기본을 탄탄히 익혀두면 다음에 다룰 요약, QA, 번역 같은 더 복잡한 생성 태스크를 이해하는 데도 큰 도움이 된다.

---

**지난 글:** [감성 분석: 텍스트에서 감정과 의견을 읽다](/posts/nlp-sentiment-analysis/)

**다음 글:** [텍스트 요약: 길고 복잡한 문서를 한 문단으로](/posts/nlp-summarization/)

<br>
읽어주셔서 감사합니다. 😊
