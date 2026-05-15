---
title: "지시 해소: 대명사가 가리키는 것을 찾아라"
description: "지시 해소(Coreference Resolution)의 개념부터 멘션 감지·클러스터링 알고리즘, SpanBERT Coref, 한국어 조사 처리의 특수성, LLM 프롬프팅 접근법까지 완전히 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["지시해소", "CoreferenceResolution", "SpanBERT", "NLP", "한국어NLP", "대명사", "멘션클러스터링"]
featured: false
draft: false
---

[지난 글](/posts/nlp-text-generation/)에서 언어 모델이 텍스트를 생성하는 원리를 살펴봤다. 이번에는 생성된 텍스트를 이해하는 핵심 과제 중 하나인 **지시 해소(Coreference Resolution)**를 다룬다. "김철수가 회사에서 그의 동료를 만났다. 그는 매우 기뻤다"라는 문장에서 "그의"와 "그"가 모두 "김철수"를 가리킨다는 것을 파악하는 기술이다. 이 문제를 해결하지 못하면 문서 요약, QA, 정보 추출 등 모든 상위 NLP 태스크의 품질이 저하된다.

## 왜 지시 해소가 어려운가

지시 해소는 다음과 같은 이유로 까다롭다.

**중의성:** "그"가 남성 인물 여럿이 등장하는 문서에서 누구를 가리키는지 맥락으로 파악해야 한다.

**장거리 의존성:** 정답 멘션이 수 문단 떨어진 경우도 있다. "지난주 대통령이 발표한 정책... (10문장) ...그 결정은 논란이 됐다."

**제로 대명사:** 한국어·중국어 등에서는 주어가 생략되는 경우가 많다. "밥을 먹었다"에서 행위자가 누구인지는 맥락에서 유추해야 한다.

**총칭 표현:** "대한민국의 수도는 서울이다. 그곳은 1000만 명이 산다"에서 "그곳"은 특정 개체가 아닌 도시 전체를 가리킨다.

## 지시 해소의 두 단계

지시 해소는 보통 두 단계로 나뉜다.

**1단계: 멘션 감지(Mention Detection)**

텍스트에서 잠재적으로 다른 표현과 동일 지시 관계를 맺을 수 있는 구(句, mention)를 추출한다. 명사구, 대명사, 고유명사 등이 후보가 된다.

**2단계: 멘션 클러스터링(Mention Clustering)**

감지된 멘션들을 동일 개체별로 묶는다. 이때 각 멘션 쌍 사이의 지시 관계 확률을 계산해 클러스터를 구성한다.

![지시 체인 시각화](/assets/posts/nlp-coreference-chains.svg)

## 알고리즘 발전사

### 규칙 기반: Hobbs 알고리즘

1970년대에 제안된 고전적 방법. 구문 트리를 탐색하여 대명사의 선행사를 찾는다. 단순 대명사 해소에는 효과적이지만, 복잡한 맥락이나 긴 문서에서는 한계가 있다.

### 통계/ML 기반: 쌍별 모델

두 멘션이 동일 지시인지 이진 분류 문제로 본다. 각 멘션 쌍에 대해 특징 벡터(거리, 성별 일치, 수 일치 등)를 추출해 분류기를 학습한다.

### 신경망 기반: End-to-End Coref

멘션 감지와 클러스터링을 하나의 신경망으로 통합한다. **SpanBERT Coref**는 BERT 기반 스팬 표현으로 OntoNotes 벤치마크에서 F1 80+ 달성.

```python
# Allen NLP의 SpanBERT Coref 사용
from allennlp.predictors.predictor import Predictor

predictor = Predictor.from_path(
    "https://storage.googleapis.com/allennlp-public-models/"
    "coref-spanbert-large-2021.03.10.tar.gz"
)

result = predictor.predict(
    document=(
        "Barack Obama was born in Hawaii. "
        "He was elected president in 2008. "
        "Obama was the first African American president."
    )
)

# result["clusters"]: 동일 지시 스팬 인덱스 목록
for cluster in result["clusters"]:
    mentions = [result["document"][s:e+1] for s, e in cluster]
    print(f"Cluster: {mentions}")
# Cluster: [['Barack', 'Obama'], ['He'], ['Obama']]
```

## 한국어 지시 해소의 특수성

한국어에는 영어와 다른 몇 가지 특성이 있다.

**조사 처리:** "철수가", "철수를", "철수의"가 모두 동일 개체지만 형태가 다르다. 형태소 분석 후 어근("철수")으로 정규화해야 멘션 비교가 정확해진다.

**제로 주어:** "밥을 먹었다"처럼 주어가 생략된다. 문서 전체 맥락에서 생략된 주어를 복원(zero pronoun resolution)하는 추가 단계가 필요하다.

**높임법:** "선생님께서 오셨다. 그분이..."처럼 높임 어미와 높임 대명사("그분")가 경어 체계를 반영한다.

한국어 지시 해소를 위해 한국전자통신연구원(ETRI)이 개발한 KoCoRef와 형태소 분석기(KoNLPy, Kiwi)를 결합하는 파이프라인이 활용된다.

```python
from kiwipiepy import Kiwi

kiwi = Kiwi()

def extract_ko_mentions(text: str):
    """한국어 텍스트에서 명사구 멘션 후보 추출"""
    result = kiwi.analyze(text)
    mentions = []
    tokens = result[0][0]

    buffer = []
    for token in tokens:
        tag = token.tag
        if tag.startswith("NN"):    # 명사류
            buffer.append(token.form)
        elif tag in ("XSN", "XPN"):  # 파생 명사
            buffer.append(token.form)
        else:
            if buffer:
                mentions.append("".join(buffer))
                buffer = []
    if buffer:
        mentions.append("".join(buffer))
    return mentions

text = "김철수는 회사에서 그의 동료를 만났다. 그는 매우 기뻤다."
print(extract_ko_mentions(text))
# ['김철수', '회사', '동료']
```

## LLM을 활용한 한국어 지시 해소

현재 가장 실용적인 한국어 지시 해소 방법은 GPT-4o나 Claude 같은 LLM에 직접 지시하는 방식이다.

![지시 해소 구현 코드](/assets/posts/nlp-coreference-code.svg)

```python
import json
from anthropic import Anthropic

client = Anthropic()

def resolve_coreference(text: str) -> dict:
    prompt = f"""다음 한국어 텍스트에서 동일한 개체(인물·장소·사물)를
가리키는 표현들을 찾아 JSON 형식으로 반환하세요.

텍스트: {text}

출력 형식:
{{
  "clusters": [
    {{
      "entity": "개체명",
      "mentions": ["표현1", "표현2", ...]
    }}
  ]
}}

주의: 대명사(그, 그의, 그녀, 이것 등)와 명사구를 연결하세요."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(response.content[0].text)

text = "김철수는 회사에서 그의 동료를 만났다. 그는 매우 기뻤다."
result = resolve_coreference(text)
print(json.dumps(result, ensure_ascii=False, indent=2))
# {
#   "clusters": [
#     {
#       "entity": "김철수",
#       "mentions": ["김철수", "그의", "그"]
#     }
#   ]
# }
```

## 평가 지표

지시 해소의 평가는 다른 NLP 태스크보다 복잡하다. 클러스터 단위의 비교가 필요하기 때문이다.

**MUC:** 클러스터 내 연결(link) 기반 F1. 큰 클러스터에 유리한 편.

**B³(B-cubed):** 각 멘션별로 정밀도·재현율 계산 후 평균. 균형잡힌 평가.

**CEAF:** 클러스터를 개체에 최적 매칭한 뒤 F1 계산. 클러스터 수 차이에 민감.

**CoNLL F1:** MUC, B³, CEAF의 평균. OntoNotes 표준 지표.

```python
# CoNLL 2012 평가 프레임워크 (allennlp-models 포함)
from allennlp.training.metrics import ConllCorefScores

scorer = ConllCorefScores()
scorer(top_spans, antecedent_indices, predicted_antecedents, metadata_list)
coref_f1 = scorer.get_metric()["coref_f1"]
```

## 응용: 지시 해소 기반 텍스트 정규화

지시 해소 결과를 활용해 문서에서 모든 대명사를 명사로 치환(텍스트 정규화)하면, 이후 정보 추출이나 요약의 품질이 크게 향상된다.

```python
def normalize_pronouns(text: str, clusters: list) -> str:
    """대명사를 대표 멘션으로 치환"""
    for cluster in clusters:
        representative = cluster["entity"]  # 첫 등장 명사
        for mention in cluster["mentions"][1:]:  # 이후 멘션들
            text = text.replace(mention, representative)
    return text

original = "김철수는 회사에서 그의 동료를 만났다. 그는 기뻤다."
normalized = normalize_pronouns(original, result["clusters"])
print(normalized)
# "김철수는 회사에서 김철수의 동료를 만났다. 김철수는 기뻤다."
```

지시 해소는 아직 완전히 해결되지 않은 NLP 난제 중 하나다. 특히 한국어는 영어 대비 전용 데이터셋과 모델이 부족해 LLM 프롬프팅이 현실적으로 가장 강력한 접근법이다.

---

**지난 글:** [텍스트 생성: 언어 모델이 글을 쓰는 방법](/posts/nlp-text-generation/)

**다음 글:** [한국어 NLP: 교착어 처리와 한국어 특화 모델](/posts/nlp-korean-processing/)

<br>
읽어주셔서 감사합니다. 😊
