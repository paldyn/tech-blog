---
title: "텍스트 요약: 길고 복잡한 문서를 한 문단으로"
description: "추출적·추상적 요약의 원리 차이부터 TextRank, BART, T5, KoBART 파인튜닝, ROUGE/BERTScore 평가까지 텍스트 요약의 전체 기술 스택을 한국어 실전 코드와 함께 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["텍스트요약", "BART", "KoBART", "T5", "ROUGE", "BERTScore", "추출적요약", "추상적요약"]
featured: false
draft: false
---

[지난 글](/posts/nlp-text-classification/)에서 텍스트에 레이블을 붙이는 분류 기술을 살펴봤다. 이번에는 방향을 바꿔, 긴 문서에서 핵심 정보를 뽑아내는 **텍스트 요약(Text Summarization)**을 다룬다. 뉴스 기사를 세 줄로, 보고서를 한 문단으로, 회의록을 핵심 결정사항 목록으로 압축하는 기술은 정보 과부하 시대에 가장 실용적인 NLP 응용 중 하나다. 법률 문서 검토, 논문 스크리닝, 고객 상담 이력 정리까지 활용 범위가 광범위하다.

## 두 가지 패러다임: 추출 vs 추상

텍스트 요약은 크게 두 가지 방향으로 나뉜다.

**추출적 요약(Extractive Summarization)**은 원문에서 중요한 문장을 "그대로" 선택해 이어 붙인다. 복사-붙여넣기 방식이라 사실 왜곡이 없고 속도가 빠르지만, 선택된 문장들 사이의 연결이 어색하고 문서 전체를 한 문장으로 압축하기 어렵다.

**추상적 요약(Abstractive Summarization)**은 원문을 이해한 뒤 새로운 문장을 생성한다. 자연스럽고 압축률이 높지만, 생성 모델 특성상 사실과 다른 내용이 포함될 수 있다(할루시네이션 위험).

실무에서는 두 접근을 결합하는 경우가 많다. 긴 문서를 추출적 방법으로 먼저 압축한 뒤 추상적 모델로 다시 요약하는 2단계 파이프라인이 대표적이다.

![추출적 vs 추상적 요약 비교](/assets/posts/nlp-summarization-methods.svg)

## 추출적 요약: TextRank

**TextRank**는 PageRank 알고리즘을 문장에 적용한 고전적 방법이다. 각 문장을 노드로 삼고, 문장 간 유사도를 엣지 가중치로 설정한 그래프를 만들어 중요도가 높은 문장을 선택한다.

```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

def textrank_summarize(sentences, top_n=3):
    # TF-IDF 벡터화
    vectorizer = TfidfVectorizer()
    tfidf = vectorizer.fit_transform(sentences)

    # 문장 간 유사도 행렬
    sim_matrix = cosine_similarity(tfidf)
    np.fill_diagonal(sim_matrix, 0)

    # PageRank 반복 계산
    scores = np.ones(len(sentences))
    d = 0.85  # 감쇠 계수
    for _ in range(50):
        scores = (1 - d) + d * (sim_matrix.T @ scores)

    # 상위 n개 문장 선택 (원문 순서 유지)
    top_idx = sorted(
        np.argsort(scores)[-top_n:].tolist()
    )
    return " ".join([sentences[i] for i in top_idx])

# 사용 예
article = """삼성전자가 3분기 실적을 발표했다.
영업이익은 전년 대비 12% 증가했다.
반도체 부문이 성장을 이끌었다.
스마트폰 판매는 소폭 감소했다.
4분기 전망은 긍정적으로 평가된다."""

sentences = article.strip().split("\n")
summary = textrank_summarize(sentences, top_n=2)
# → "삼성전자가 3분기 실적을 발표했다. 반도체 부문이 성장을 이끌었다."
```

## 추상적 요약: BART / T5

현대 요약 시스템의 핵심은 인코더-디코더 구조 사전학습 모델이다.

**BART(Bidirectional and Auto-Regressive Transformers):** 인코더는 BERT처럼 양방향으로 원문을 이해하고, 디코더는 GPT처럼 자동회귀적으로 요약을 생성한다. 노이즈 제거 사전학습 덕분에 요약, 번역, QA 등 생성 태스크 전반에 강하다.

**T5(Text-to-Text Transfer Transformer):** 모든 NLP 태스크를 텍스트→텍스트 문제로 통일한다. 요약은 `"summarize: {원문}"` 형태의 프롬프트로 처리된다.

한국어에는 KoBART(SK T-Brain), mBART-50, NLLB-200 등이 있으며, Hugging Face에서 파인튜닝된 한국어 요약 모델을 바로 사용할 수 있다.

```python
from transformers import (
    BartForConditionalGeneration,
    PreTrainedTokenizerFast,
)

model_name = "digit82/kobart-summarization"
tokenizer = PreTrainedTokenizerFast.from_pretrained(model_name)
model = BartForConditionalGeneration.from_pretrained(model_name)

def summarize(text: str, max_len: int = 128) -> str:
    inputs = tokenizer(
        text,
        return_tensors="pt",
        max_length=1024,
        truncation=True,
    )
    summary_ids = model.generate(
        inputs["input_ids"],
        num_beams=4,
        max_length=max_len,
        min_length=30,
        length_penalty=2.0,
        early_stopping=True,
        no_repeat_ngram_size=3,
    )
    return tokenizer.decode(
        summary_ids[0], skip_special_tokens=True
    )

article = """
삼성전자는 14일 2024년 3분기 연결 기준 매출 79조 달성 및
영업이익 9조 1000억원을 기록했다고 공시했다. 이는 전년 동기
대비 매출 17%, 영업이익 274% 증가한 수치다. 반도체 부문의
HBM3E 공급 확대와 파운드리 가동률 회복이 성장을 주도했다.
"""

print(summarize(article))
# → 삼성전자 3분기 영업이익이 9조 1000억원으로 전년비 274% 증가했다.
```

## 평가 지표

![KoBART 요약 구현과 ROUGE 평가](/assets/posts/nlp-summarization-code.svg)

### ROUGE

**ROUGE(Recall-Oriented Understudy for Gisting Evaluation)**는 생성된 요약과 참조 요약 사이의 어휘 겹침 비율을 측정한다.

- **ROUGE-1:** 단어(unigram) 겹침
- **ROUGE-2:** 이어진 두 단어(bigram) 겹침
- **ROUGE-L:** 최장 공통 부분 수열(LCS) 기반

한국어는 영어와 달리 어절이 형태소로 이루어지기 때문에, 어절 단위 ROUGE보다 형태소 단위 ROUGE가 실질적인 언어 품질을 더 잘 반영한다.

### BERTScore

ROUGE의 한계(의미는 같지만 다른 표현 사용 시 점수 하락)를 보완하기 위해 **BERTScore**를 함께 사용한다. 생성 요약과 참조 요약의 BERT 임베딩 코사인 유사도를 계산해 의미적 일치도를 측정한다.

```python
from bert_score import score as bert_score

P, R, F1 = bert_score(
    cands=generated_summaries,
    refs=reference_summaries,
    lang="ko",
    model_type="klue/roberta-base",
)

print(f"BERTScore F1: {F1.mean():.4f}")
# 일반적으로 0.85+ 이면 우수한 품질
```

## 긴 문서 처리 전략

BART, T5는 입력 길이에 한계(보통 1024~4096 토큰)가 있다. 긴 문서를 처리하는 전략은 다음과 같다.

**Chunking + 중간 요약:** 문서를 단락 단위로 분할해 각각 요약한 뒤, 중간 요약들을 다시 한 번 요약한다(계층적 요약).

**Longformer / BigBird:** 희소 어텐션(sparse attention)으로 최대 16K~32K 토큰을 처리하는 모델군.

**LLM 직접 활용:** GPT-4o, Claude 같은 긴 컨텍스트 LLM에 전체 문서를 넣고 요약 지시. 가장 간단하고 품질도 우수하지만 비용이 높다.

## 실무 적용 시 유의점

**할루시네이션 검증:** 추상적 요약은 존재하지 않는 사실을 생성할 수 있다. 생성된 요약 내 핵심 수치·고유명사가 원문에 있는지 역방향으로 검증하는 후처리 단계를 추가한다.

**도메인 적응:** 범용 모델은 법률·의료·금융 전문 용어를 제대로 다루지 못하는 경우가 많다. 도메인 데이터로 파인튜닝하거나, LLM에 도메인 맥락을 시스템 프롬프트로 제공한다.

**요약 길이 제어:** `length_penalty` 파라미터로 짧게/길게 조절하거나, 목표 길이를 프롬프트에 명시("2문장으로 요약해")하는 방식을 결합한다.

---

**지난 글:** [텍스트 분류: 언어에 레이블을 붙이는 기술](/posts/nlp-text-classification/)

**다음 글:** [질의응답: 문서에서 답을 찾는 기술](/posts/nlp-question-answering/)

<br>
읽어주셔서 감사합니다. 😊
