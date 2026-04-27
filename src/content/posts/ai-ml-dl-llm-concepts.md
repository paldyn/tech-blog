---
title: "AI/ML/DL/LLM 개념 정리 — 헷갈리는 네 가지 용어, 한 번에 잡기"
description: "AI, 머신러닝, 딥러닝, LLM의 차이를 계층 구조로 명확하게 정리합니다. 집합 관계와 역사적 맥락을 통해 각 개념이 어떻게 연결되는지 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["AI", "ML", "딥러닝", "LLM", "기초", "개념정리"]
featured: false
draft: false
---

처음 AI를 공부하다 보면 AI, 머신러닝, 딥러닝, LLM이라는 단어가 뒤섞여 나옵니다. 뉴스에서는 번갈아 쓰이고, 강의에서도 "AI라고도 하고 딥러닝이라고도 해요"라는 식으로 넘어갑니다. 이 글에서는 네 개념의 집합 관계를 명확히 잡고, 각각이 왜 등장했는지 흐름까지 짚어 봅니다.

## AI는 가장 큰 그릇이다

**AI(Artificial Intelligence, 인공지능)** 는 "기계가 지능적인 행동을 하도록 만드는 모든 시도"를 가리킵니다. 1956년 다트머스 회의에서 존 매카시가 이 용어를 제안한 이후, AI는 다양한 방식으로 구현되어 왔습니다.

초기 AI는 **규칙 기반(rule-based)** 이었습니다. 프로그래머가 수천 개의 조건문을 작성해 시스템이 마치 전문가처럼 대답하게 만들었죠. 이를 **전문가 시스템(Expert System)** 이라고 합니다. 체스 게임 AI도 마찬가지였습니다. 가능한 수를 모두 탐색해 최선을 고르는 알고리즘, 즉 명시적 논리로 작동했습니다.

이 방식의 한계는 세상의 복잡함입니다. 고양이 사진을 보고 "고양이"라고 말하려면 무한히 많은 규칙이 필요합니다. 그래서 연구자들은 **"규칙을 직접 짜는 대신, 데이터에서 스스로 규칙을 찾게 하면 어떨까?"** 라는 아이디어로 넘어갑니다.

## ML: 데이터로 패턴을 학습하다

**ML(Machine Learning, 머신러닝)** 은 AI의 하위 분야입니다. 핵심 아이디어는 단순합니다.

> 데이터를 보여 주면 기계가 스스로 패턴을 찾아낸다.

스팸 필터를 예로 들면, 개발자가 "무료", "클릭", "긴급" 같은 키워드를 일일이 등록하는 대신, 수천 개의 스팸 메일과 정상 메일을 주면 시스템이 스스로 어떤 패턴이 스팸을 나타내는지 학습합니다.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB

# 학습 데이터
emails = ["무료 쿠폰 받으세요", "회의 일정 확인 부탁드립니다", "지금 클릭하면 당첨"]
labels = [1, 0, 1]  # 1: 스팸, 0: 정상

# 특징 추출 + 모델 학습
vectorizer = TfidfVectorizer()
X = vectorizer.fit_transform(emails)

model = MultinomialNB()
model.fit(X, labels)

# 예측
test = vectorizer.transform(["특별 할인 이벤트 참여"])
print(model.predict(test))  # [1] → 스팸으로 분류
```

ML에서 중요한 점은, 사람이 **어떤 특징(feature)을 볼지** 여전히 설계해야 한다는 것입니다. 위 예에서 TF-IDF라는 텍스트 표현 방식은 사람이 선택했습니다.

## DL: 특징 추출마저 기계에게

**DL(Deep Learning, 딥러닝)** 은 ML의 하위 분야입니다. 뇌의 뉴런에서 영감받은 **인공신경망(Neural Network)** 을 여러 층(layer)으로 쌓아 만듭니다.

DL의 혁신은 **특징 추출 자동화**입니다. 고양이 사진을 분류한다면:

- ML 시대: 사람이 "귀가 뾰족한가", "수염이 있는가" 같은 특징을 직접 설계
- DL 시대: 수백만 장의 사진을 넣으면 신경망이 스스로 "어떤 패턴이 고양이를 나타내는지" 학습

![AI·ML·DL·LLM 계층 구조](/assets/posts/ai-ml-dl-llm-concepts-hierarchy.svg)

```python
import torch
import torch.nn as nn

# 간단한 3층 신경망
class SimpleNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(784, 256),   # 입력층 → 은닉층1
            nn.ReLU(),
            nn.Linear(256, 128),   # 은닉층1 → 은닉층2
            nn.ReLU(),
            nn.Linear(128, 10),    # 은닉층2 → 출력층(10클래스)
        )

    def forward(self, x):
        return self.layers(x)

model = SimpleNet()
print(model)
```

2012년 AlexNet이 ImageNet 대회에서 기존 방식보다 10% 이상 높은 정확도를 기록하면서 딥러닝 시대가 열렸습니다. 이후 CNN(이미지), RNN(시계열), Transformer(언어) 등 다양한 아키텍처가 등장합니다.

## LLM: 언어에 집중한 초거대 딥러닝

**LLM(Large Language Model, 대규모 언어 모델)** 은 딥러닝의 하위 분야이며, 특히 자연어를 다루는 데 특화되어 있습니다.

"Large"라는 수식어에는 두 가지 의미가 있습니다.

1. **파라미터 수**: GPT-3은 1,750억 개, GPT-4는 추정 수조 개의 파라미터
2. **학습 데이터**: 웹 전체, 책, 코드 등 수백 테라바이트의 텍스트

핵심 학습 방식은 **"다음 토큰 예측"** 입니다. "나는 밥을 ___" 다음에 올 단어를 맞히는 훈련을 수조 번 반복하면, 언어의 문법, 상식, 논리 추론 능력이 자연스럽게 생깁니다.

```python
# LLM API 호출 예시 (Anthropic SDK)
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=256,
    messages=[
        {
            "role": "user",
            "content": "AI와 ML의 차이를 한 줄로 설명해줘."
        }
    ]
)

print(message.content[0].text)
# → "AI는 지능적 행동을 만드는 큰 개념이고,
#     ML은 그 중 데이터로 패턴을 학습하는 방법입니다."
```

## 네 개념의 집합 관계

정리하면, 네 개념은 포함 관계입니다:

$$\text{LLM} \subset \text{DL} \subset \text{ML} \subset \text{AI}$$

![AI/ML/DL/LLM 핵심 비교](/assets/posts/ai-ml-dl-llm-concepts-comparison.svg)

| 개념 | 등장 시점 | 핵심 아이디어 | 대표 한계 |
|------|-----------|--------------|-----------|
| AI   | 1956년~  | 지능적 행동 구현 | 규칙 작성 폭발 |
| ML   | 1980년대~ | 데이터로 학습 | 특징 설계 필요 |
| DL   | 2012년~  | 자동 특징 추출 | 대용량 데이터·GPU 필요 |
| LLM  | 2020년~  | 다음 토큰 예측 | 환각, 비용, 검열 |

## 왜 이 구분이 중요한가

실무에서 이 구분은 **문제 해결 방법 선택**에 직결됩니다.

- 레이블된 데이터가 수천 개뿐이라면 → DL보다 ML(XGBoost 등)이 우세할 수 있습니다.
- 이미지나 음성을 다뤄야 한다면 → DL이 사실상 표준입니다.
- 자연어로 대화·요약·분류가 필요하다면 → LLM API 또는 파인튜닝이 가장 빠른 경로입니다.
- 단순한 탐색이나 스케줄링 문제라면 → 전통적 AI 알고리즘(A*, 유전 알고리즘)이 더 효율적입니다.

```python
# 문제 유형별 접근 가이드 (의사코드)
def choose_approach(problem_type, data_size, has_labels):
    if problem_type == "자연어":
        return "LLM API 또는 파인튜닝"

    if problem_type in ("이미지", "음성"):
        return "딥러닝 (CNN/Transformer)"

    if data_size < 10_000 and has_labels:
        return "머신러닝 (XGBoost/SVM)"

    if data_size >= 10_000 and has_labels:
        return "딥러닝 (MLP/Transformer)"

    return "비지도 머신러닝 또는 탐색 알고리즘"
```

## 자주 묻는 질문

**Q. "AI가 발전했다"는 말은 정확한가요?**
보통은 "딥러닝 또는 LLM이 발전했다"는 의미입니다. AI는 매우 넓은 용어라 "발전"이라고 하면 문맥을 잘 봐야 합니다.

**Q. ChatGPT는 AI인가요, ML인가요, DL인가요?**
세 가지 모두 맞습니다. ChatGPT는 LLM이고, LLM은 DL의 하위이며, DL은 ML의 하위이고, ML은 AI의 하위입니다. 그래서 ChatGPT를 "AI 챗봇"이라고 불러도 틀리지 않습니다.

**Q. LLM이 곧 AI의 전부인가요?**
아닙니다. LLM은 AI의 일부입니다. 로봇 제어, 게임 AI, 이상 탐지, 추천 시스템 등 LLM이 아닌 AI도 매우 활발히 사용됩니다.

## 마치며

AI/ML/DL/LLM은 서로 포함하는 집합 관계입니다. AI가 가장 크고, LLM이 가장 구체적입니다. 개념 간 경계를 잡고 나면, 이후 각 주제를 공부할 때 "지금 어디쯤 서 있는지"를 항상 알 수 있습니다. 다음 글에서는 1956년부터 현재까지 AI가 어떤 굴곡을 겪어 왔는지 역사를 살펴봅니다.

---

**다음 글:** [AI 역사 — 1956년부터 LLM 시대까지](/posts/ai-history/)

<br>
읽어주셔서 감사합니다. 😊
