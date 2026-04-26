---
title: "AI · ML · DL · LLM: 헷갈리는 개념 한 번에 정리하기"
description: "AI, 머신러닝, 딥러닝, LLM이 정확히 무엇인지, 그리고 서로 어떤 관계인지 비유와 코드로 명쾌하게 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["AI", "머신러닝", "딥러닝", "LLM", "인공지능", "개념정리"]
featured: false
draft: false
---

뉴스를 보다 보면 AI, 머신러닝, 딥러닝, LLM이라는 단어가 뒤섞여 등장합니다. ChatGPT는 AI인가요, LLM인가요? 딥러닝과 머신러닝은 다른 건가요? 처음 이 분야를 접하는 분이라면 혼란스러울 수밖에 없습니다.

이 글에서는 네 가지 개념이 정확히 무엇인지, 그리고 서로 어떤 관계인지를 비유와 코드를 활용해 명쾌하게 정리합니다.

---

## 큰 그림부터 — 포함 관계

결론부터 말하면, 이 네 개념은 **러시아 마트료시카 인형**처럼 포함 관계에 있습니다.

> **AI ⊃ ML ⊃ DL ⊃ LLM**

가장 큰 개념이 AI, 그 안에 ML, 그 안에 DL, 그 안에 LLM이 있습니다. 아래 다이어그램을 보면 한눈에 이해할 수 있습니다.

![AI · ML · DL · LLM 포함 관계 다이어그램](/assets/posts/ai-ml-dl-llm-hierarchy.svg)

이제 하나씩 살펴보겠습니다.

---

## 1. AI (인공지능, Artificial Intelligence)

AI는 가장 큰 우산입니다. **인간의 지능을 모방하는 모든 컴퓨터 기술**을 통틀어 인공지능이라고 부릅니다.

1950년대 앨런 튜링이 "기계가 생각할 수 있는가?"를 물었을 때부터 이 분야가 시작됐습니다. 초기 AI는 사람이 직접 `if-else` 규칙을 수천 개 작성해 전문가 시스템(Expert System)을 만드는 방식이었습니다.

```python
# 1980년대식 AI — 규칙 기반 전문가 시스템
def diagnose(symptoms: list[str]) -> str:
    if "발열" in symptoms and "기침" in symptoms:
        if "두통" in symptoms:
            return "독감 의심"
        return "감기 의심"
    if "발열" in symptoms and "발진" in symptoms:
        return "홍역 의심"
    return "진단 불가"

result = diagnose(["발열", "기침", "두통"])
print(result)  # 독감 의심
```

이런 방식은 규칙이 몇 천 개만 넘어가도 관리가 불가능해집니다. "규칙을 사람이 직접 다 작성해야 한다"는 한계 때문에 연구자들은 새로운 접근법을 찾게 됩니다. 그 결과물이 머신러닝입니다.

---

## 2. ML (머신러닝, Machine Learning)

머신러닝의 핵심 아이디어는 단순합니다.

> **"규칙을 직접 작성하는 대신, 데이터를 충분히 주면 컴퓨터가 스스로 패턴을 찾게 하자."**

예를 들어 스팸 메일 필터를 만든다고 합시다. 규칙 기반 접근법은 개발자가 "무료", "광고", "클릭 시 ₩1,000,000" 같은 키워드를 하나하나 등록해야 합니다. 스패머들이 키워드를 바꾸면 또 업데이트해야 합니다.

머신러닝 접근법은 다릅니다. 스팸 메일 수십만 개와 정상 메일 수십만 개를 주면, 알고리즘이 스스로 "어떤 단어 패턴이 스팸과 연관되는지"를 학습합니다.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

# 학습 데이터 (실제로는 수만 개)
emails = [
    "무료 상품 받으세요 지금 클릭",
    "오늘 회의 자료 공유합니다",
    "광고 이벤트 당첨 축하드려요",
    "내일 점심 같이 드실래요?",
]
labels = ["spam", "ham", "spam", "ham"]

# 파이프라인: 텍스트 벡터화 → 분류 학습
pipeline = Pipeline([
    ("vectorizer", TfidfVectorizer()),
    ("classifier", MultinomialNB()),
])

pipeline.fit(emails, labels)

# 새 메일 분류
test_email = ["무료 쿠폰 지금 바로 받기"]
print(pipeline.predict(test_email))  # ['spam']
```

머신러닝에는 다양한 알고리즘이 있습니다.
- **결정 트리(Decision Tree)**: 스무고개처럼 질문을 반복해 분류
- **랜덤 포레스트**: 결정 트리 수백 개의 다수결
- **SVM**: 데이터를 가장 잘 나누는 경계선 탐색
- **XGBoost**: 약한 모델을 순차적으로 강화 (캐글 대회의 단골 우승 알고리즘)

이 알고리즘들은 모두 **사람이 특징(feature)을 직접 설계**해야 한다는 공통점이 있습니다. 이미지를 분류할 때 "밝기", "경계선 여부" 같은 특징을 사람이 먼저 정의해야 합니다. 이 한계를 극복한 것이 딥러닝입니다.

---

## 3. DL (딥러닝, Deep Learning)

딥러닝은 머신러닝의 하위 분야로, **인공 신경망(Artificial Neural Network)을 여러 레이어로 깊게 쌓아** 특징 추출도 자동으로 수행합니다.

뇌의 뉴런 구조에서 영감을 받은 아이디어입니다. 입력층 → 은닉층(수십~수백 개) → 출력층으로 이어지는 구조에서, 각 레이어는 점점 추상적인 패턴을 학습합니다.

이미지 분류를 예로 들면:
- **1층**: 픽셀의 밝기 차이 (경계선)
- **5층**: 곡선, 직선 같은 형태
- **15층**: 눈, 코, 귀 같은 부위
- **최종층**: "이것은 고양이다"

```python
import torch
import torch.nn as nn

# 간단한 3층 신경망
class SimpleNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(784, 256),   # 입력층 → 은닉층 1
            nn.ReLU(),
            nn.Linear(256, 128),   # 은닉층 1 → 은닉층 2
            nn.ReLU(),
            nn.Linear(128, 10),    # 은닉층 2 → 출력층 (10개 클래스)
        )

    def forward(self, x):
        return self.layers(x)

model = SimpleNet()
print(f"파라미터 수: {sum(p.numel() for p in model.parameters()):,}")
# 파라미터 수: 234,634
```

딥러닝은 이미지 인식, 음성 인식, 기계 번역 등 다양한 분야에서 혁신을 일으켰습니다. 그리고 2017년, 언어를 처리하는 딥러닝 아키텍처에 일대 혁명이 찾아옵니다. 바로 **트랜스포머(Transformer)**의 등장입니다. LLM은 이 트랜스포머 구조를 기반으로 합니다.

---

## 4. LLM (대형 언어 모델, Large Language Model)

LLM은 딥러닝의 하위 분야로, 특히 **자연어를 이해하고 생성**하는 데 특화된 거대한 딥러닝 모델입니다.

"Large"가 핵심입니다. 여기서 크다는 것은 두 가지를 의미합니다.
1. **파라미터 수**: GPT-4는 수조 개(추정), LLaMA 3.1은 최대 4050억 개
2. **학습 데이터**: 인터넷의 상당 부분 — 위키피디아, 책, 코드, 뉴스, 논문

LLM의 작동 원리는 본질적으로 단순합니다.

> **"이전까지의 텍스트가 주어졌을 때, 다음에 올 단어(토큰)가 무엇일지 예측한다."**

```text
입력: "오늘 날씨가 정말"
      → 모델이 예측: "맑아서" (확률 40%) / "좋네요" (확률 25%) / "춥군요" (확률 20%) ...
      → 가장 확률 높은 "맑아서" 선택
      
이를 반복:
"오늘 날씨가 정말 맑아서" → "기분이" 예측 → ...
"오늘 날씨가 정말 맑아서 기분이" → "좋네요" 예측 → ...
```

이처럼 단순한 원리인데도 LLM은 코딩, 번역, 요약, 수학 풀이까지 해냅니다. 수천억 개의 파라미터와 방대한 데이터가 만나면서 단순한 "다음 단어 예측"이 언어 이해 능력으로 발현되는 것입니다.

---

## 학습 방식 비교

세 접근법을 나란히 놓고 비교해 보겠습니다.

![전통 프로그래밍 vs 머신러닝 vs LLM 비교](/assets/posts/ai-ml-dl-llm-comparison.svg)

위 비교에서 알 수 있는 핵심 차이점:

| 구분 | 전통 프로그래밍 | 머신러닝 | LLM |
|------|----------------|---------|-----|
| 규칙 | 사람이 직접 작성 | 데이터에서 자동 학습 | 사전 학습 완료 |
| 새 태스크 적용 | 규칙 재작성 필요 | 재학습 필요 | 프롬프트만으로 가능 |
| 데이터 요구량 | 최소 | 수천~수만 건 | 수조 개 토큰 |
| 유연성 | 낮음 | 중간 | 매우 높음 |

---

## 실제로 LLM 호출해보기

LLM을 사용하는 것은 API 호출만큼 간단합니다. 아래 코드는 Anthropic의 Claude를 호출해 질문에 답하는 예시입니다.

```python
import anthropic

client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수 사용

message = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": "인공지능과 머신러닝의 차이를 초등학생도 이해할 수 있게 설명해주세요.",
        }
    ],
)

print(message.content[0].text)
```

실행하면 Claude가 비유를 들어 설명해줍니다. 우리가 수십 줄의 규칙을 작성할 필요 없이, 자연어 한 문장으로 원하는 동작을 지시할 수 있습니다. 이것이 LLM의 혁신입니다.

환경 설정이 처음이라면 아래처럼 API 키를 설정하세요.

```bash
# API 키 환경변수 설정 (Linux / macOS)
export ANTHROPIC_API_KEY="sk-ant-..."

# Python 패키지 설치
pip install anthropic
```

---

## 핵심 정리

지금까지 살펴본 내용을 한 문장씩 정리합니다.

- **AI**: 인간의 지능을 모방하는 모든 컴퓨터 기술의 총칭
- **ML**: 데이터에서 패턴을 스스로 학습하는 AI의 하위 분야
- **DL**: 신경망을 깊게 쌓아 특징 추출까지 자동화한 ML의 하위 분야
- **LLM**: 수천억 파라미터로 방대한 텍스트를 학습한 딥러닝 모델

네 개념은 서로 경쟁하는 것이 아니라 **계층적으로 포함**됩니다. ChatGPT, Claude, Gemini는 모두 LLM이자 딥러닝 모델이자 머신러닝 모델이자 AI입니다.

이 시리즈의 다음 글에서는 LLM의 핵심 구성 요소인 **신경망 기초**를 다룹니다. 퍼셉트론부터 역전파까지, 딥러닝이 어떻게 학습하는지 직관적으로 살펴봅니다.

**다음 글:** 신경망 기초 — 퍼셉트론에서 역전파까지
<br>읽어주셔서 감사합니다 😊
