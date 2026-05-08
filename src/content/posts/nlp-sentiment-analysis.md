---
title: "감성 분석: 텍스트에서 감정과 의견을 읽다"
description: "규칙/사전 기반(VADER, KNU)부터 ML, BERT 파인튜닝, 속성 기반 감성 분석(ABSA)까지 감성 분석의 전체 스펙트럼을 한국어 예시와 실전 코드로 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["감성분석", "Sentiment Analysis", "BERT", "ABSA", "NLP", "KNU감성사전", "VADER"]
featured: false
draft: false
---

[지난 글](/posts/nlp-pos-tagging/)에서 각 단어의 품사를 분석하여 문장의 문법적 구조를 파악하는 품사 태깅을 다뤘다. 이제 단어들이 모여 이루는 가장 인간적인 차원, 즉 **감정과 의견**을 읽는 단계로 넘어간다. **감성 분석(Sentiment Analysis)**은 텍스트에 담긴 감정적 뉘앙스를 자동으로 파악하는 NLP 태스크다. "이 영화 정말 최고!"가 긍정이고 "배송이 너무 느렸어요"가 부정임을 기계가 이해하게 만드는 것이다. 제품 리뷰 분석, 소셜 미디어 여론 모니터링, 고객 서비스 자동화 등 실제 비즈니스에서 가장 많이 활용되는 NLP 응용 중 하나다.

## 감성 분석의 스펙트럼

감성 분석은 단순한 이진 분류("긍정이냐 부정이냐")부터 복잡한 감정 이해까지 다양한 수준이 있다.

**극성 분류(Polarity Classification):** 가장 기본. 긍정/부정 또는 긍정/부정/중립 3분류.

**강도 분류(Intensity Classification):** "조금 좋다"와 "매우 좋다"를 구분. 별점 1~5점 예측이 대표적.

**감정 분류(Emotion Classification):** 기쁨, 슬픔, 분노, 두려움, 놀람, 혐오 같은 세밀한 감정 카테고리 분류.

**속성 기반 감성 분석(Aspect-Based Sentiment Analysis, ABSA):** "배터리는 좋은데 카메라가 별로야"처럼 하나의 리뷰에서 여러 속성에 대한 감성을 각각 분석.

## 접근법 1: 규칙/사전 기반

사전 기반 방법은 미리 감성 점수가 부여된 단어 사전을 활용한다.

### VADER (영어)

VADER(Valence Aware Dictionary and sEntiment Reasoner)는 영어 소셜 미디어 텍스트에 최적화된 감성 분석 도구다. 단어 감성 점수뿐 아니라 대소문자, 느낌표, "VERY" 같은 강조어, 부정어도 처리한다.

```python
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()

texts = [
    "This movie is AMAZING!!!",          # 강한 긍정
    "Not bad at all.",                   # 부정어가 있지만 긍정
    "The food was okay, nothing special" # 중립
]

for text in texts:
    scores = analyzer.polarity_scores(text)
    print(f"{text}")
    print(f"  pos: {scores['pos']:.3f}, neg: {scores['neg']:.3f}, "
          f"compound: {scores['compound']:.3f}")
    # compound ≥ 0.05: 긍정, ≤ -0.05: 부정, 그 사이: 중립
```

VADER의 장점은 학습 데이터 없이 즉시 사용 가능하다는 것이다. 단점은 문맥 없이 단어 단위로 판단하기 때문에 "이 음식이 굉장히 나쁘지 않다"처럼 이중 부정이나 반어법을 제대로 처리하기 어렵다.

### KNU 한국어 감성사전

한국어의 경우 군산대학교에서 개발한 **KNU 한국어 감성사전**이 대표적이다. 약 14,000개 어휘에 -2~+2 점수가 부여됐다.

```python
import pandas as pd

# KNU 감성사전 로드 (실제 파일 경로 필요)
knu_dict = pd.read_csv('knu_sentiment_lexicon.csv', 
                        encoding='utf-8')
sentiment_dict = dict(zip(knu_dict['word'], knu_dict['polarity']))

from konlpy.tag import Okt

okt = Okt()

def knu_sentiment_score(text):
    """KNU 사전 기반 감성 점수 계산"""
    morphs = okt.morphs(text, norm=True, stem=True)
    score = 0
    hit_words = []
    
    for i, morph in enumerate(morphs):
        if morph in sentiment_dict:
            word_score = sentiment_dict[morph]
            
            # 부정어 처리: 앞 2개 형태소에서 부정어 확인
            negation = False
            for j in range(max(0, i-2), i):
                if morphs[j] in ['안', '못', '없', '아니']:
                    negation = True
                    break
            
            if negation:
                word_score *= -1
            
            score += word_score
            hit_words.append((morph, word_score))
    
    return score, hit_words

text = "이 영화는 정말 최고였지만 결말이 너무 아쉬웠어요"
score, words = knu_sentiment_score(text)
print(f"총점: {score}, 감지된 단어: {words}")
# 총점: 0, 감지된 단어: [('최고', 2), ('아쉽다', -2)]
# → 혼합 감성 (복합적)
```

![감성 분석 3가지 접근법 비교](/assets/posts/nlp-sentiment-analysis-pipeline.svg)

## 접근법 2: ML 기반

기계 학습 기반 방법은 레이블이 달린 학습 데이터를 사용하여 분류기를 학습한다.

### TF-IDF + 분류기

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from konlpy.tag import Okt

okt = Okt()

def tokenize_korean(text):
    """한국어 명사/동사/형용사 추출"""
    pos = okt.pos(text, norm=True, stem=True)
    return [word for word, tag in pos 
            if tag in ['Noun', 'Adjective', 'Verb'] and len(word) > 1]

# 학습 데이터 (실제로는 대용량 데이터셋 사용)
texts = [
    "정말 맛있어요 강추합니다",    # 긍정
    "배송이 빠르고 품질도 좋아요",  # 긍정
    "완전 별로예요 돈 낭비",        # 부정
    "짝퉁 같아요 실망했습니다",     # 부정
    "보통이에요 그냥 그렇네요",     # 중립
]
labels = [1, 1, 0, 0, 2]  # 1:긍정, 0:부정, 2:중립

# TF-IDF 벡터화
vectorizer = TfidfVectorizer(
    tokenizer=tokenize_korean,
    ngram_range=(1, 2),  # 유니그램 + 바이그램
    min_df=1
)
X = vectorizer.fit_transform(texts)

# 로지스틱 회귀 분류기
clf = LogisticRegression(max_iter=1000)
clf.fit(X, labels)

# 새 텍스트 예측
new_texts = ["진짜 최고입니다!", "다시는 안 살 것 같아요"]
X_new = vectorizer.transform(new_texts)
predictions = clf.predict(X_new)
proba = clf.predict_proba(X_new)
label_map = {0: '부정', 1: '긍정', 2: '중립'}

for text, pred, prob in zip(new_texts, predictions, proba):
    print(f"{text}: {label_map[pred]} (신뢰도: {max(prob):.3f})")
```

ML 기반의 장점은 도메인 특화 데이터로 빠르게 학습할 수 있다는 것이다. 단점은 학습 데이터에 없는 표현에 취약하고, 어휘 의미가 아닌 통계적 패턴에 의존한다는 점이다.

## 접근법 3: BERT 파인튜닝

현재 최고 성능을 내는 방법은 사전 학습된 BERT를 감성 분석 태스크에 **파인튜닝(Fine-tuning)**하는 것이다.

![BERT 감성 분석 코드](/assets/posts/nlp-sentiment-analysis-code.svg)

### Hugging Face Pipeline 사용

```python
from transformers import pipeline

# 파이프라인으로 즉시 사용
sa = pipeline(
    "sentiment-analysis",
    model="snunlp/KR-FinBert-SC",  # 한국어 금융 도메인 감성 분석
)

texts = [
    "이 제품 정말 좋아요!",
    "배송이 너무 느렸어요.",
    "그냥 보통이에요. 기대했던 것과 달랐어요.",
]
results = sa(texts)

for text, result in zip(texts, results):
    emoji = "😊" if result['label'] == 'positive' else "😢"
    print(f"{emoji} {text}")
    print(f"   → {result['label']} (신뢰도: {result['score']:.3f})")
```

### BERT 직접 파인튜닝

더 많은 제어가 필요할 때는 직접 파인튜닝한다.

```python
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments
)
from datasets import Dataset
import torch

# 모델 및 토크나이저 로드
model_name = "klue/bert-base"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(
    model_name,
    num_labels=3  # 긍정, 부정, 중립
)

def tokenize_function(examples):
    return tokenizer(
        examples["text"],
        padding="max_length",
        truncation=True,
        max_length=128
    )

# 데이터셋 준비 (실제로는 대용량 데이터 사용)
data = {
    "text": ["정말 좋아요", "완전 별로", "그냥 그래요"],
    "label": [0, 1, 2]  # 0:긍정, 1:부정, 2:중립
}
dataset = Dataset.from_dict(data)
tokenized = dataset.map(tokenize_function, batched=True)

# 학습 설정
training_args = TrainingArguments(
    output_dir="./sentiment_model",
    num_train_epochs=3,
    per_device_train_batch_size=16,
    learning_rate=2e-5,
    warmup_steps=100,
    evaluation_strategy="epoch",
    save_strategy="epoch",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized,
)

trainer.train()
```

## 속성 기반 감성 분석 (ABSA)

일반적인 감성 분석은 문서나 문장 전체의 감성을 하나의 레이블로 표현한다. 하지만 "음식은 맛있었는데 서비스가 별로였다"처럼 한 문장에 여러 감성이 공존하는 경우, **ABSA**가 필요하다.

ABSA는 두 단계로 이루어진다.
1. **속성 추출(Aspect Extraction):** "음식", "서비스" 같은 평가 대상 추출
2. **속성별 감성 분류:** 각 속성에 대한 긍정/부정 판단

```python
# ABSA 예시 (단순화된 구현)
import re

ASPECTS = {
    '음식': ['음식', '맛', '메뉴', '요리', '식사'],
    '서비스': ['서비스', '직원', '종업원', '응대', '친절'],
    '가격': ['가격', '값', '비용', '가성비', '저렴'],
    '배달': ['배달', '배송', '배달속도', '포장'],
}

def extract_aspect_sentiments(text, sentiment_analyzer, aspect_dict):
    """텍스트에서 속성별 감성 추출"""
    results = {}
    
    # 문장 분리
    sentences = re.split(r'[.!?ㄴ]', text)
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        # 어떤 속성에 해당하는지 확인
        for aspect, keywords in aspect_dict.items():
            if any(kw in sentence for kw in keywords):
                # 해당 문장의 감성 분석
                sentiment = sentiment_analyzer(sentence)[0]
                results[aspect] = {
                    'sentence': sentence,
                    'sentiment': sentiment['label'],
                    'score': sentiment['score']
                }
    
    return results

# 사용 예시
from transformers import pipeline
sa = pipeline("sentiment-analysis", model="snunlp/KR-FinBert-SC")

review = "음식은 정말 맛있었는데 서비스가 너무 불친절했어요. 가격도 좀 비싼 편이에요."
aspect_sentiments = extract_aspect_sentiments(review, sa, ASPECTS)

print(f"리뷰: {review}\n")
for aspect, info in aspect_sentiments.items():
    emoji = "😊" if info['sentiment'] == 'positive' else "😢"
    print(f"{emoji} [{aspect}] {info['sentiment']} ({info['score']:.2f})")
    print(f"     문장: {info['sentence']}")
# 😊 [음식] positive (0.95)
#      문장: 음식은 정말 맛있었는데
# 😢 [서비스] negative (0.91)
#      문장: 서비스가 너무 불친절했어요
# 😢 [가격] negative (0.78)
#      문장: 가격도 좀 비싼 편이에요
```

## 한국어 감성 분석 데이터셋

좋은 모델을 만들려면 좋은 학습 데이터가 필요하다. 한국어 감성 분석에서 자주 사용되는 데이터셋:

**NSMC (Naver Sentiment Movie Corpus):** 네이버 영화 리뷰 15만 개, 긍정/부정 레이블. 한국어 감성 분석의 표준 벤치마크.

```python
from datasets import load_dataset

# NSMC 데이터셋 로드 (Hugging Face Hub)
dataset = load_dataset("nsmc")
print(dataset)
# DatasetDict({
#     train: Dataset({features: ['id', 'document', 'label'], num_rows: 150000})
#     test:  Dataset({features: ['id', 'document', 'label'], num_rows: 50000})
# })

# 데이터 확인
print(dataset['train'][0])
# {'id': '9976970', 'document': '아 더빙..살짝 이상하긴 했지만 그래도 재밌었다', 'label': 1}
```

**KoEMOTION:** 감정 분류 (기쁨, 슬픔, 분노, 공포, 혐오, 놀람) 데이터셋.

**AIHub 한국어 감정 정보가 포함된 단발성 대화 데이터셋:** 대화 맥락에서의 감성 분석 데이터.

## 감성 분석의 도전과 한계

### 풍자와 반어법

"오 진짜 배송 빠르네요. 3주 만에 왔어요." — 표면적으로는 긍정 표현("빠르네요")이지만 실제로는 강한 부정이다. BERT도 이런 풍자(sarcasm)를 완벽히 처리하지 못한다.

### 도메인 의존성

"이 약의 부작용이 심각하다"는 의료 도메인에서 부정이지만, 의약학 전문가의 논문에서는 중립적 설명일 수 있다. 도메인에 따라 같은 단어의 감성 극성이 달라진다.

### 문화적 맥락

한국어의 "그냥 그래요", "뭐 나쁘지는 않아요" 같은 표현은 문화적 맥락상 부정에 가깝지만, 단어 자체의 의미로는 중립이다. 영어로 학습된 모델을 한국어에 직접 적용하면 이런 미묘한 차이를 놓친다.

### 혼합 감성

"가격 대비 성능은 좋은데 배터리가 너무 빨리 닳아요"는 속성별로 다른 감성을 가진다. 전체 감성을 하나로 결정하는 것 자체가 어렵다.

## 실전 파이프라인 구성

```python
from transformers import pipeline
import pandas as pd
from collections import Counter
import matplotlib.pyplot as plt

class SentimentAnalysisPipeline:
    def __init__(self, model_name="snunlp/KR-FinBert-SC"):
        self.sa = pipeline("sentiment-analysis", model=model_name)
        self.label_map = {
            'positive': '긍정',
            'negative': '부정',
            'neutral': '중립'
        }
    
    def analyze_batch(self, texts, batch_size=32):
        """대량 텍스트 배치 처리"""
        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            batch_results = self.sa(batch)
            results.extend(batch_results)
        return results
    
    def summarize(self, texts):
        """감성 분포 요약 통계"""
        results = self.analyze_batch(texts)
        labels = [r['label'] for r in results]
        scores = [r['score'] for r in results]
        
        label_counts = Counter(labels)
        total = len(labels)
        
        print("=== 감성 분석 요약 ===")
        for label, count in label_counts.most_common():
            pct = count / total * 100
            kr_label = self.label_map.get(label, label)
            print(f"{kr_label}: {count}건 ({pct:.1f}%)")
        
        avg_score = sum(scores) / len(scores)
        print(f"\n평균 신뢰도: {avg_score:.3f}")
        
        return results

# 사용 예시: 제품 리뷰 100개 분석
reviews = [
    "정말 좋아요!", "별로예요", "그냥 그래요",
    # ... 실제로는 수백~수천 건
]
pipeline_obj = SentimentAnalysisPipeline()
pipeline_obj.summarize(reviews)
```

감성 분석은 AI와 자연어 처리 기술이 실제 비즈니스 가치를 만들어 내는 가장 직접적인 영역이다. 단순한 긍/부정 분류에서 시작하여 속성별 감성, 감정 분류, 의견 요약까지 발전하고 있다. 최근에는 GPT-4 같은 LLM에 직접 감성 분석을 요청하거나, Chain-of-Thought 프롬프팅으로 모델이 판단 근거를 설명하게 만드는 방향으로도 발전하고 있다. 텍스트에서 인간의 감정을 이해하는 이 기술은 앞으로도 NLP에서 가장 활발히 연구되고 활용될 분야로 남을 것이다.

---

**지난 글:** [품사 태깅(POS): 단어의 문법적 역할 파악](/posts/nlp-pos-tagging/)

<br>
읽어주셔서 감사합니다. 😊
