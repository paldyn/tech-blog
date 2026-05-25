---
title: "데이터 레이블링: AI가 학습할 정답을 만드는 과정"
description: "전문가·크라우드소싱·LLM 자동 레이블링 방식을 비교하고, Cohen's Kappa를 이용한 레이블러 간 일치도(IAA) 측정과 품질 관리 파이프라인을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["데이터레이블링", "IAA", "RLHF레이블", "약지도학습", "능동학습", "크라우드소싱", "데이터품질"]
featured: false
draft: false
---

[지난 글](/posts/data-collection/)에서 AI 학습 데이터를 수집하는 방법을 다뤘다. 수집된 원시 데이터에는 정답(레이블)이 없다. 지도 학습 모델은 정답 레이블이 있어야 "이게 고양이다", "이 감정은 긍정이다"를 배울 수 있다. 레이블링은 AI 학습의 숨겨진 병목이다.

## 레이블링이 AI 성능을 결정한다

"더 좋은 알고리즘보다 더 좋은 데이터"라는 격언이 있다. Andrew Ng은 이를 Data-Centric AI 운동으로 구체화했다. 모델 코드를 고치는 대신 데이터 품질을 개선하는 것이 대부분의 경우 더 효과적이라는 것이다.

그러나 고품질 레이블링은 비용이 크다. GPT-4 학습에 사용된 RLHF 데이터는 수만 명의 레이블러가 수개월을 작업한 결과물이다.

## 레이블링 방식 분류

![데이터 레이블링 방식 분류](/assets/posts/data-labeling-types.svg)

## 약지도 학습: 레이블 없이 레이블 만들기

**Snorkel**은 도메인 전문가가 직접 레이블링하는 대신 **레이블링 함수(Labeling Function)**를 작성하게 한다.

```python
from snorkel.labeling import labeling_function, PandasLFApplier
from snorkel.labeling.model import LabelModel

POSITIVE = 1
NEGATIVE = 0
ABSTAIN = -1

# 레이블링 함수: 규칙 기반
@labeling_function()
def lf_keyword_positive(x):
    positive_words = ["훌륭", "최고", "만족", "좋아"]
    if any(word in x.text for word in positive_words):
        return POSITIVE
    return ABSTAIN

@labeling_function()
def lf_keyword_negative(x):
    negative_words = ["최악", "실망", "불만", "나쁘"]
    if any(word in x.text for word in negative_words):
        return NEGATIVE
    return ABSTAIN

# 레이블링 함수: 길이 기반 (짧은 리뷰는 부정 경향)
@labeling_function()
def lf_short_review(x):
    if len(x.text) < 30:
        return NEGATIVE
    return ABSTAIN

# 레이블링 함수 적용
lfs = [lf_keyword_positive, lf_keyword_negative, lf_short_review]
applier = PandasLFApplier(lfs=lfs)
L_train = applier.apply(df=train_df)  # 각 함수의 투표 행렬

# 레이블 모델로 노이즈 있는 레이블 통합
label_model = LabelModel(cardinality=2, verbose=True)
label_model.fit(L_train, n_epochs=500)
preds = label_model.predict(L=L_train)
```

## RLHF 선호 레이블링

ChatGPT, Claude 학습에 사용되는 레이블링 형태다.

```python
# RLHF 선호 데이터 수집 인터페이스 (개념적)
import anthropic

client = anthropic.Anthropic()

def collect_preference_pair(prompt: str):
    """두 가지 응답 생성 후 레이블러가 선택"""
    response_a = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    ).content[0].text

    response_b = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.9
    ).content[0].text

    # 레이블러 인터페이스: A와 B 중 선택
    # 실제로는 웹 인터페이스나 Argilla, Label Studio 등 사용
    choice = input(f"A:\n{response_a}\n\nB:\n{response_b}\n\n선택(A/B): ")

    return {
        "prompt": prompt,
        "chosen": response_a if choice == "A" else response_b,
        "rejected": response_b if choice == "A" else response_a
    }
```

## 레이블링 품질 관리: IAA

레이블러가 여러 명일 때, 같은 데이터에 다른 레이블을 붙이면 어느 것이 맞는지 알 수 없다. **IAA(Inter-Annotator Agreement)**로 레이블러 간 일치도를 측정한다.

![레이블링 품질 관리 워크플로우](/assets/posts/data-labeling-workflow.svg)

```python
from sklearn.metrics import cohen_kappa_score
import krippendorff
import numpy as np

# Cohen's Kappa: 두 레이블러 간 일치도
# 우연에 의한 일치를 보정한 지표
kappa = cohen_kappa_score(labels_a, labels_b)
print(f"Cohen's Kappa: {kappa:.3f}")
# 0.0-0.4: 불량, 0.4-0.6: 보통, 0.6-0.8: 좋음, 0.8-1.0: 매우 좋음

# Krippendorff Alpha: 3명 이상 레이블러, 연속형 레이블 가능
labels_matrix = np.array([
    labels_a,   # 레이블러 1
    labels_b,   # 레이블러 2
    labels_c,   # 레이블러 3
])
alpha = krippendorff.alpha(
    reliability_data=labels_matrix,
    level_of_measurement="nominal"  # "ordinal", "interval", "ratio"
)
print(f"Krippendorff Alpha: {alpha:.3f}")

# 불일치 항목 추출 및 중재
disagreements = [
    i for i, (a, b) in enumerate(zip(labels_a, labels_b))
    if a != b
]
print(f"불일치 항목: {len(disagreements)}개 → 전문가 중재 필요")
```

IAA가 0.7 미만이면 레이블링 가이드라인이 불명확하다는 신호다. 데이터 수집을 중단하고 가이드라인을 개선해야 한다.

## LLM을 이용한 자동 레이블링

최근 GPT-4, Claude 같은 LLM으로 레이블링 비용을 대폭 줄이는 접근이 많이 쓰인다.

```python
import anthropic
import json

client = anthropic.Anthropic()

def llm_label(texts: list[str], label_schema: dict) -> list[str]:
    """LLM으로 감성 분석 레이블 생성"""
    prompt = f"""다음 텍스트들을 분류하세요.
분류 기준: {json.dumps(label_schema, ensure_ascii=False)}

텍스트 목록:
{chr(10).join(f"{i+1}. {t}" for i, t in enumerate(texts))}

JSON 배열로 답변 (예: ["긍정", "부정", "중립"])"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",  # 비용 효율적인 모델
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    return json.loads(response.content[0].text)

schema = {
    "긍정": "제품/서비스에 만족하는 내용",
    "부정": "불만족 또는 문제를 나타내는 내용",
    "중립": "사실 서술, 판단 없음"
}
auto_labels = llm_label(review_texts, schema)
```

LLM 자동 레이블링의 정확도는 태스크에 따라 70~95%다. 전문가 레이블링보다 저렴하지만, 품질 검증을 위해 10~20% 샘플을 인간이 확인하는 것이 권장된다.

## 실무 도구

**Label Studio**: 오픈소스 레이블링 플랫폼. 텍스트·이미지·오디오 모두 지원.

**Argilla**: LLM 파인튜닝 특화 레이블링 도구. RLHF 선호 데이터 수집에 최적화.

**Scale AI / Surge AI**: 대규모 전문 레이블링 아웃소싱 서비스.

데이터 레이블링은 지루하게 느껴지지만, 이 과정의 품질이 모델 성능의 상한선을 결정한다. 레이블링에 시간을 투자하는 것이 가장 확실한 AI 성능 개선 방법이다.

---

**지난 글:** [데이터 수집: AI 모델의 연료를 모으는 방법](/posts/data-collection/)

**다음 글:** [데이터 증강: 적은 데이터로 더 강한 모델 만들기](/posts/data-augmentation/)

<br>
읽어주셔서 감사합니다. 😊
