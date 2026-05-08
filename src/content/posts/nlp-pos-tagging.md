---
title: "품사 태깅(POS): 단어의 문법적 역할 파악"
description: "품사 태깅의 개념, Penn Treebank와 세종 태그셋 비교, HMM에서 CRF, BERT 기반 태거까지의 발전 과정, KoNLPy를 활용한 한국어 품사 태깅 실전 코드를 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["품사태깅", "POS Tagging", "KoNLPy", "Komoran", "형태소분석", "세종태그셋", "NLP"]
featured: false
draft: false
---

[지난 글](/posts/nlp-named-entity-recognition/)에서 텍스트의 인물명·기관명·지명을 자동으로 찾아내는 개체명 인식(NER)을 다뤘다. NER이 "무엇이 언급됐는가"를 찾는다면, **품사 태깅(Part-of-Speech Tagging, POS Tagging)**은 "각 단어가 문장에서 어떤 문법적 역할을 하는가"를 분석한다. 명사인지, 동사인지, 형용사인지, 조사인지를 판별하는 이 과정은 NER, 구문 분석, 기계 번역, 정보 추출 등 거의 모든 NLP 파이프라인의 기반이 된다. 한국어의 경우 교착어 특성상 품사 태깅이 특히 중요하고 복잡하다.

## 품사 태깅이란

품사 태깅은 시퀀스 레이블링(Sequence Labeling) 문제다. 입력 문장의 각 토큰에 품사 레이블을 할당한다.

```
입력: ["고양이", "가", "빠르게", "달린다"]
출력: [("고양이", "NNG"), ("가", "JKS"), ("빠르게", "MAG"), ("달린다", "VV+EF")]
```

겉보기에는 단순해 보이지만 실제로는 상당히 어렵다. 가장 큰 도전은 **동형이의어(Homograph)** 문제다. 영어의 "flies"는 동사("the bird flies")일 수도 있고 명사("flies are insects")일 수도 있다. 한국어의 "이"는 인칭대명사("이것"), 조사("고양이 이야"), 주격조사("고양이가"), 한자어 접두사("이번") 등 다양하다.

이 모호성을 해결하려면 단어 자체가 아니라 **문맥(Context)**을 봐야 한다. 품사 태거의 핵심은 이 문맥 정보를 얼마나 잘 활용하는가에 있다.

![POS 태깅 시각화 및 아키텍처 비교](/assets/posts/nlp-pos-tagging-tree.svg)

## 품사 체계 (Tagset)

품사 태깅의 결과는 어떤 **태그셋(Tagset)**을 사용하느냐에 따라 달라진다.

### Penn Treebank (영어)

영어 NLP의 표준 태그셋이다. 36개의 태그로 구성된다.

| 태그 | 설명 | 예시 |
|------|------|------|
| NN | 단수 명사 | dog, cat |
| NNS | 복수 명사 | dogs, cats |
| NNP | 고유명사 단수 | Google, Seoul |
| VB | 동사 기본형 | run, eat |
| VBD | 과거형 | ran, ate |
| VBG | 현재분사/동명사 | running, eating |
| JJ | 형용사 | fast, good |
| RB | 부사 | quickly, very |
| IN | 전치사/접속사 | in, at, because |

### 세종 태그셋 (한국어)

국립국어원에서 개발한 한국어 표준 품사 체계다. 교착어인 한국어의 특성을 반영하여 조사와 어미를 세밀하게 분류한다.

주요 카테고리:
- **NNG/NNP/NNB:** 일반/고유/의존명사
- **VV/VA/VX:** 동사/형용사/보조용언
- **MAG/MAJ:** 일반/접속부사
- **JKS/JKO/JKG:** 주격/목적격/관형격 조사
- **EF/EC/ETN:** 종결/연결/명사형 어미
- **XPN/XSN/XSV:** 접두/명사파생/동사파생 접미사

한국어 형태소 분석에서 특징적인 표기가 **결합 태그**다. "달린다"는 동사 어간 "달리"(VV) + 종결어미 "ㄴ다"(EF)가 결합된 것으로, `VV+EF`로 표기한다. 이 방식이 복잡해 보이지만 형태론적 분석의 정확성을 높인다.

### UD (Universal Dependencies)

언어 간 비교 연구를 위해 개발된 범언어적 품사 체계다. 17개의 보편 품사 태그를 사용하며, 한국어·영어·중국어 등 100개 이상의 언어 코퍼스가 UD 표준으로 레이블링됐다.

```python
# UD 태그셋 (언어 독립적)
# NOUN, VERB, ADJ, ADV, PRON, DET, ADP(전치사/후치사),
# CONJ, PUNCT, NUM, AUX, PART, INTJ, X, SYM
```

## HMM 기반 품사 태거

**은닉 마르코프 모델(Hidden Markov Model, HMM)**은 품사 태깅에 처음 성공적으로 적용된 통계적 모델이다.

HMM은 두 가지 확률을 학습한다.
- **전이 확률 P(tᵢ|tᵢ₋₁):** 이전 품사 다음에 현재 품사가 등장할 확률. 예: 명사(NNG) 다음에 조사(JKS)가 등장할 확률
- **방출 확률 P(wᵢ|tᵢ):** 특정 품사가 특정 단어를 생성할 확률. 예: 명사(NNG)가 "고양이"를 생성할 확률

추론 시에는 **비터비(Viterbi) 알고리즘**으로 가장 가능성 높은 품사 시퀀스를 효율적으로 찾는다.

```python
import numpy as np

def viterbi(sentence, states, init_probs, trans_probs, emit_probs):
    """단순화된 Viterbi 알고리즘"""
    n_states = len(states)
    n_words = len(sentence)
    
    # DP 테이블 초기화
    dp = np.zeros((n_states, n_words))
    backtrack = np.zeros((n_states, n_words), dtype=int)
    
    # 초기화: 첫 번째 단어
    for s in range(n_states):
        dp[s, 0] = init_probs[s] * emit_probs[s].get(sentence[0], 1e-10)
    
    # 재귀: 나머지 단어들
    for t in range(1, n_words):
        for s in range(n_states):
            scores = [
                dp[prev_s, t-1] * trans_probs[prev_s, s] * 
                emit_probs[s].get(sentence[t], 1e-10)
                for prev_s in range(n_states)
            ]
            dp[s, t] = max(scores)
            backtrack[s, t] = np.argmax(scores)
    
    # 역추적
    best_path = []
    best_last = np.argmax(dp[:, -1])
    best_path.append(states[best_last])
    
    for t in range(n_words - 1, 0, -1):
        best_last = backtrack[best_last, t]
        best_path.append(states[best_last])
    
    return list(reversed(best_path))
```

HMM의 한계는 **특징 표현의 제한**에 있다. 이전 하나의 품사만 고려하는 bigram 모델이 기본이며, 더 넓은 문맥을 보려면 계산 복잡도가 폭발한다. 또한 미등장 단어(OOV)에 대한 처리가 취약하다.

## CRF 기반 품사 태거

**조건부 랜덤 필드(Conditional Random Fields, CRF)**는 HMM의 단점을 극복하기 위해 등장했다. CRF는 풍부한 **특징 함수(Feature Function)**를 정의하여 모델에 입력할 수 있다.

```python
# CRF에서 사용하는 특징 함수 예시
def extract_features(tokens, i):
    """i번째 토큰의 특징 추출"""
    token = tokens[i]
    features = {
        'word': token,                          # 현재 단어
        'is_upper': token[0].isupper(),         # 대문자 시작?
        'is_title': token.istitle(),            # 제목형?
        'suffix_2': token[-2:],                 # 마지막 2글자
        'suffix_3': token[-3:],                 # 마지막 3글자
        'prefix_2': token[:2],                  # 앞 2글자
    }
    
    # 이전 토큰 정보
    if i > 0:
        features['prev_word'] = tokens[i-1]
        features['prev_word_suffix'] = tokens[i-1][-2:]
    else:
        features['BOS'] = True  # Beginning of Sentence
    
    # 다음 토큰 정보
    if i < len(tokens) - 1:
        features['next_word'] = tokens[i+1]
    else:
        features['EOS'] = True  # End of Sentence
    
    return features
```

CRF는 이런 수백 개의 특징 함수를 동시에 고려하여 최적의 품사 시퀀스를 찾는다. 영어 Penn Treebank에서 97.5% 이상의 정확도를 달성하며 2010년대 중반까지 표준 방법으로 사용됐다.

## BERT 기반 품사 태거

현재 최고 성능은 **BERT + Linear Layer** 조합이다. NER과 동일한 구조지만 레이블이 품사 태그라는 차이가 있다.

```python
from transformers import AutoTokenizer, AutoModelForTokenClassification
import torch

# KLUE BERT 기반 한국어 POS 태거
model_name = "snunlp/KR-FinBert-SC"  # 또는 klue/bert-base + fine-tuning
tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")

def pos_tag_with_bert(text, model, tokenizer):
    """BERT 기반 품사 태깅"""
    inputs = tokenizer(
        text, 
        return_tensors="pt",
        return_offsets_mapping=True
    )
    
    with torch.no_grad():
        outputs = model(**{k: v for k, v in inputs.items() 
                          if k != 'offset_mapping'})
    
    logits = outputs.logits
    predictions = logits.argmax(dim=-1)[0]
    
    # 서브워드 → 단어 단위 정렬
    word_ids = inputs.word_ids()
    pos_tags = []
    seen_word_ids = set()
    
    for idx, (word_id, pred) in enumerate(zip(word_ids, predictions)):
        if word_id is None or word_id in seen_word_ids:
            continue
        pos_tags.append((
            tokenizer.decode([inputs['input_ids'][0][idx]]),
            model.config.id2label[pred.item()]
        ))
        seen_word_ids.add(word_id)
    
    return pos_tags
```

BERT 기반 태거는 양방향 어텐션 덕분에 문장 전체를 동시에 참조하여 문맥 모호성을 효과적으로 해소한다. "사과"가 과일인지 행위인지, "배"가 어떤 의미인지를 주변 문맥으로 정확히 판별한다.

## KoNLPy로 한국어 품사 태깅

![KoNLPy 품사 태깅 코드](/assets/posts/nlp-pos-tagging-code.svg)

KoNLPy는 여러 형태소 분석기를 통일된 API로 사용할 수 있게 해 준다.

```python
from konlpy.tag import Komoran, Okt, Mecab

# Komoran 사용
komoran = Komoran()
text = "고양이가 빠르게 달린다"

# 품사 태깅
print(komoran.pos(text))
# [('고양이', 'NNG'), ('가', 'JKS'), ('빠르게', 'MAG'), ('달린다', 'VV+EF')]

# 명사만 추출
print(komoran.nouns(text))
# ['고양이']

# 형태소만 추출 (품사 없이)
print(komoran.morphs(text))
# ['고양이', '가', '빠르게', '달리', 'ㄴ다']

# Okt (SNS/구어체에 강함)
okt = Okt()
sns_text = "오늘 진짜 너무 힘들었어ㅠㅠ 내일은 더 잘할게"
print(okt.pos(sns_text, norm=True, stem=True))
# [('오늘', 'Noun'), ('진짜', 'Adverb'), ('너무', 'Adverb'),
#  ('힘들다', 'Adjective'), ('내일', 'Noun'), ('잘하다', 'Verb')]
```

### 사용자 사전 추가

Komoran은 사용자 정의 사전을 지원한다. 특정 도메인 전문 용어나 고유명사를 분석기가 알지 못할 때 사용한다.

```python
from konlpy.tag import Komoran

# 사용자 사전 파일 (user_dict.txt):
# 갤럭시S25 NNG
# ChatGPT NNG
# 할루시네이션 NNG

komoran = Komoran(userdic='/path/to/user_dict.txt')
text = "갤럭시S25는 최신 AI 기능을 탑재했다"
print(komoran.pos(text))
# [('갤럭시S25', 'NNG'), ('는', 'JX'), ('최신', 'NNG'), ('AI', 'SL'), ...]
```

## 품사 태깅의 실전 활용

### 불용어 필터링 고도화

단순히 불용어 리스트를 쓰는 것보다 품사 기반 필터링이 더 정확하다.

```python
def extract_meaningful_tokens(text, tagger):
    """품사 기반 의미 있는 토큰 추출"""
    pos_tagged = tagger.pos(text, norm=True, stem=True)
    
    # 의미 있는 품사만 유지
    meaningful_pos = {
        'NNG', 'NNP',  # 명사
        'VV', 'VA',    # 동사, 형용사
        'MAG',         # 부사 (선택적)
    }
    
    return [
        word for word, pos in pos_tagged
        if pos in meaningful_pos and len(word) > 1
    ]

from konlpy.tag import Okt
okt = Okt()
text = "이 영화는 정말 좋았다. 배우들의 연기가 너무 훌륭했어요."
tokens = extract_meaningful_tokens(text, okt)
print(tokens)
# ['영화', '좋다', '배우', '연기', '훌륭하다']
```

### 형태소 기반 TF-IDF

품사 태깅 결과로 명사만 추출한 뒤 TF-IDF를 적용하면 더 의미 있는 키워드를 찾을 수 있다.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from konlpy.tag import Komoran

komoran = Komoran()

def noun_tokenizer(text):
    """명사만 추출하는 커스텀 토크나이저"""
    return komoran.nouns(text)

# TF-IDF 벡터라이저에 커스텀 토크나이저 적용
vectorizer = TfidfVectorizer(tokenizer=noun_tokenizer, min_df=2)

documents = [
    "삼성전자가 새로운 반도체를 개발했다",
    "현대자동차는 전기차 배터리 기술을 혁신한다",
    "삼성의 반도체 수출이 증가하고 있다",
]

tfidf_matrix = vectorizer.fit_transform(documents)
feature_names = vectorizer.get_feature_names_out()

# 첫 번째 문서의 주요 키워드
doc_scores = zip(feature_names, tfidf_matrix.toarray()[0])
top_keywords = sorted(doc_scores, key=lambda x: -x[1])[:5]
print(top_keywords)
# [('삼성전자', 0.72), ('반도체', 0.62), ...]
```

## 한국어 POS 태깅의 어려움

한국어 품사 태깅은 교착어 특성 때문에 영어보다 훨씬 복잡하다.

**어절과 형태소의 불일치:** 하나의 어절("먹었겠죠")이 여러 형태소("먹"(VV) + "었"(EP) + "겠"(EP) + "죠"(EF))로 분리된다.

**띄어쓰기 오류:** "서울역을"과 "서울 역을"을 같다고 봐야 할지 다르다고 봐야 할지, 분석기마다 처리가 다르다.

**신조어와 외래어:** "힙하다", "스마트하다" 같은 신조어는 품사 분석기가 올바르게 처리하지 못하는 경우가 많다.

**분석기 간 차이:** Komoran, Okt, Mecab이 같은 문장을 다르게 분석하는 경우가 있다. 중요한 애플리케이션에서는 여러 분석기를 비교하고 도메인에 맞는 것을 선택해야 한다.

품사 태깅은 NLP 파이프라인에서 조용하지만 핵심적인 역할을 한다. 올바른 품사 분석 없이는 정확한 개체명 인식도, 의존 구문 분석도, 자연스러운 기계 번역도 어렵다. 다음 글에서는 텍스트에서 "긍정/부정/중립" 같은 감정과 의견을 자동으로 읽어내는 **감성 분석(Sentiment Analysis)**을 다룬다.

---

**지난 글:** [개체명 인식(NER): 텍스트에서 정보를 추출하다](/posts/nlp-named-entity-recognition/)

**다음 글:** [감성 분석: 텍스트에서 감정과 의견을 읽다](/posts/nlp-sentiment-analysis/)

<br>
읽어주셔서 감사합니다. 😊
