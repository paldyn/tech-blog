---
title: "데이터 수집: AI 모델의 연료를 모으는 방법"
description: "Common Crawl부터 합성 데이터까지 AI 학습 데이터 소스를 분류하고, 크롤링·필터링·전처리·중복 제거·안전 필터로 구성된 대규모 데이터 파이프라인을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["데이터수집", "CommonCrawl", "합성데이터", "데이터파이프라인", "LLM학습데이터", "MinHash", "데이터품질"]
featured: false
draft: false
---

[지난 글](/posts/ai-regulation/)에서 AI 규제 환경을 살펴봤다. 어떤 규제를 따르든, AI 모델의 성능은 궁극적으로 학습 데이터의 질과 양에 달려 있다. "Garbage in, garbage out" — 이 절은 데이터 수집의 전 과정을 다룬다.

## 데이터가 모델을 결정한다

GPT-4의 성능이 GPT-3.5보다 뛰어난 이유 중 큰 부분은 데이터다. 더 많은 데이터, 더 좋은 데이터, 더 다양한 데이터. 모델 아키텍처가 비슷해도 데이터가 다르면 전혀 다른 모델이 나온다. Phi-1·Phi-2처럼 작은 모델이 큰 모델을 능가하는 비결은 대부분 데이터 품질에 있다.

## 주요 데이터 소스

![AI 학습 데이터 소스 유형](/assets/posts/data-collection-sources.svg)

### 오픈 웹 데이터

**Common Crawl**은 매달 인터넷의 수십억 페이지를 크롤링해 무료로 공개한다. GPT, Llama, Falcon 등 대부분의 대형 언어 모델의 핵심 데이터 소스다. 그러나 품질이 천차만별이어서 대규모 필터링이 필수다.

```python
import datasets

# Common Crawl 기반 정제 데이터셋 로드
cc_net = datasets.load_dataset(
    "cc_net",
    "head_middle",    # 품질 상위 데이터
    split="train",
    streaming=True    # 200TB+ 크기로 스트리밍 필수
)

# FineWeb: HuggingFace의 CC 정제 버전 (15T 토큰)
fineweb = datasets.load_dataset(
    "HuggingFaceFW/fineweb",
    name="sample-10BT",   # 10B 토큰 샘플
    split="train"
)

for example in fineweb:
    print(example["text"][:100])
    break
```

### 합성 데이터

최근 가장 빠르게 성장하는 분야다. LLM이 LLM을 학습할 데이터를 생성하는 형태다.

```python
from anthropic import Anthropic

client = Anthropic()

def generate_synthetic_qa(topic: str, n_pairs: int = 10):
    """특정 주제에 대한 합성 Q&A 쌍 생성"""
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""다음 주제에 대해 고품질 Q&A 쌍 {n_pairs}개를 JSON으로 생성해주세요.
주제: {topic}

형식:
[
  {{"question": "질문", "answer": "상세한 답변"}},
  ...
]"""
        }]
    )
    import json
    return json.loads(response.content[0].text)

# 도메인 특화 합성 데이터 생성
qa_pairs = generate_synthetic_qa("파이썬 비동기 프로그래밍", n_pairs=20)
```

Microsoft의 **Phi** 시리즈는 "Textbooks Are All You Need" 원칙으로, GPT-4로 생성한 교과서 품질의 합성 데이터로 소형 모델을 학습해 10배 큰 모델을 능가했다.

## 데이터 수집 파이프라인

![데이터 수집 파이프라인](/assets/posts/data-collection-pipeline.svg)

### 1단계: 크롤링

```python
import trafilatura
import requests
from urllib.robotparser import RobotFileParser

def ethical_crawl(url: str, user_agent: str = "ResearchBot/1.0") -> str:
    """robots.txt 준수 크롤링"""
    rp = RobotFileParser()
    base_url = "/".join(url.split("/")[:3])
    rp.set_url(f"{base_url}/robots.txt")
    rp.read()

    if not rp.can_fetch(user_agent, url):
        return None  # robots.txt 불허

    response = requests.get(url, headers={"User-Agent": user_agent},
                           timeout=10)
    # trafilatura: 광고·네비게이션 제거, 본문만 추출
    return trafilatura.extract(response.text)
```

### 2단계: 품질 필터링

```python
import langdetect
from datatrove.pipeline.filters import (
    GopherQualityFilter,
    LanguageFilter
)

# Gopher 품질 필터 (DeepMind) — 비율·길이·반복 기준
quality_filter = GopherQualityFilter(
    min_doc_words=50,
    max_doc_words=100_000,
    min_avg_word_length=3,
    max_avg_word_length=10,
    max_symbol_word_ratio=0.1,      # 특수문자 비율
    max_bullet_lines_ratio=0.9,     # 불릿 포인트 비율
    max_ellipsis_lines_ratio=0.3,
)

lang_filter = LanguageFilter(
    languages=["ko", "en"],   # 한국어·영어만
    min_language_score=0.65
)
```

### 3단계: 중복 제거

```python
from datasketch import MinHash, MinHashLSH

def minhash_dedup(texts: list[str], threshold=0.8, num_perm=128):
    """MinHash LSH를 이용한 퍼지 중복 제거"""
    lsh = MinHashLSH(threshold=threshold, num_perm=num_perm)
    unique_texts = []

    for i, text in enumerate(texts):
        mh = MinHash(num_perm=num_perm)
        # 5-gram 시퀀스로 MinHash 계산
        tokens = text.split()
        for j in range(len(tokens) - 4):
            gram = " ".join(tokens[j:j+5])
            mh.update(gram.encode("utf-8"))

        if not lsh.query(mh):  # 유사 문서 없으면 추가
            lsh.insert(f"doc_{i}", mh)
            unique_texts.append(text)

    dedup_ratio = 1 - len(unique_texts) / len(texts)
    print(f"중복 제거율: {dedup_ratio:.1%}")
    return unique_texts
```

웹 데이터는 보통 30~70%가 중복이다. LLM 학습에서 중복 데이터는 과적합과 암기(memorization)를 유발한다.

## 데이터 거버넌스

**저작권**: Common Crawl 데이터에는 저작권이 있는 콘텐츠가 포함된다. 학습 목적의 데이터 사용이 공정 이용(Fair Use)에 해당하는지는 아직 법적으로 논쟁 중이다. EU AI Act는 학습 데이터의 저작권 준수 문서화를 요구한다.

**개인정보**: 학습 데이터에서 전화번호, 이메일, 주민번호를 사전 제거해야 한다. BigScience의 ROOTS 데이터셋은 PII 제거를 위해 전용 파이프라인을 구축했다.

**동의**: 사용자 생성 콘텐츠를 학습에 사용하려면 서비스 약관에 AI 학습 목적 사용 동의가 포함되어야 한다.

데이터 수집은 모델 개발의 절반이다. 품질 좋은 데이터 파이프라인 구축에 투자하면 이후 모든 단계가 더 쉬워진다.

---

**지난 글:** [AI 규제: 전 세계 AI 법안과 거버넌스 현황](/posts/ai-regulation/)

**다음 글:** [데이터 레이블링: AI가 학습할 정답을 만드는 과정](/posts/data-labeling/)

<br>
읽어주셔서 감사합니다. 😊
