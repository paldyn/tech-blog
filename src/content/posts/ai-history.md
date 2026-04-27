---
title: "AI 역사 — 1956년 다트머스에서 LLM 시대까지"
description: "AI의 70년 역사를 두 번의 겨울과 세 번의 부흥으로 정리합니다. 왜 AI는 실패를 반복했고, 딥러닝 혁명은 어떻게 가능했는지 맥락으로 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["AI역사", "딥러닝", "LLM", "전문가시스템", "AI겨울", "Transformer"]
featured: false
draft: false
---

[지난 글](/posts/ai-ml-dl-llm-concepts/)에서 AI·ML·DL·LLM이 서로를 포함하는 집합 관계임을 살펴봤습니다. 이번 글에서는 그 개념들이 어떤 역사적 흐름 속에서 탄생했는지를 따라갑니다. AI는 70년간 두 번의 긴 겨울을 겪었고, 그 실패가 오늘날 LLM 시대를 만든 토대가 됩니다.

## 1950년대 — 꿈의 시작

1950년, 앨런 튜링은 논문 *Computing Machinery and Intelligence*에서 이런 질문을 던집니다.

> "기계가 생각할 수 있는가?"

그는 이 질문에 답하기 위해 **이미테이션 게임(Imitation Game)**, 즉 오늘날 **튜링 테스트**를 제안합니다. 기계가 인간 심판을 텍스트 대화로 속일 수 있다면 "지능이 있다"고 볼 수 있다는 것입니다.

6년 후인 1956년, 다트머스 대학교에서 역사적인 워크숍이 열립니다. 존 매카시, 마빈 민스키, 클로드 섀넌 등 10명의 연구자가 모여 "인공지능"이라는 용어를 공식화했습니다. 이 회의가 AI 연구의 공식 출발점입니다.

```python
# 1950년대 AI 연구의 상징 — 간단한 규칙 기반 챗봇 구조
rules = {
    "안녕": "안녕하세요! 무엇을 도와드릴까요?",
    "날씨": "오늘 날씨는 맑습니다.",
    "이름": "저는 ELIZA입니다.",
}

def rule_based_chat(user_input):
    for keyword, response in rules.items():
        if keyword in user_input:
            return response
    return "잘 이해하지 못했습니다. 다시 말씀해 주세요."

print(rule_based_chat("안녕하세요"))  # → 안녕하세요! 무엇을 도와드릴까요?
print(rule_based_chat("이름이 뭐야"))  # → 저는 ELIZA입니다.
```

1957년에는 프랭크 로젠블랫이 **퍼셉트론**을 발명합니다. 단층 신경망으로 선형 분류가 가능했고, 많은 연구자가 "이제 인간 수준의 AI도 금방"이라고 예측했습니다.

## 1970년대 — 첫 번째 AI 겨울

낙관론은 오래가지 않았습니다. 1969년 민스키와 파퍼트는 저서 *Perceptrons*에서 퍼셉트론이 XOR 문제조차 풀지 못함을 수학적으로 증명합니다.

1973년, 영국 정부가 의뢰한 **라이트힐 보고서**는 AI 연구 대부분이 "과장된 기대"에 불과하다고 혹평합니다. 미국과 영국 정부는 연구 지원을 대폭 삭감했고, **제1차 AI 겨울(1974~1980)** 이 찾아옵니다.

이 시기의 교훈은 명확합니다. **과대 선전은 실망으로, 실망은 투자 철수로 이어집니다.** 이 패턴은 이후에도 반복됩니다.

## 1980년대 — 전문가 시스템의 부흥

겨울이 끝나고 새 접근이 주목받습니다. **전문가 시스템(Expert System)** 입니다.

의사 진단을 모방하는 MYCIN, 컴퓨터 부품 주문을 처리하는 XCON처럼, 해당 분야 전문가의 지식을 수천 개의 `if-then` 규칙으로 코딩하는 방식입니다. XCON은 DEC(Digital Equipment Corporation)에 연간 4천만 달러를 절약해 주었고, 전문가 시스템 시장은 급성장합니다.

```python
# 간단한 의료 진단 전문가 시스템 예시
def medical_expert_system(symptoms):
    rules = [
        ({"발열", "기침", "인후통"}, "감기 가능성 높음"),
        ({"발열", "두통", "목경직"}, "수막염 의심 — 즉시 응급실"),
        ({"흉통", "호흡곤란"}, "심장 문제 의심 — 즉시 119"),
        ({"발열", "기침"}, "독감 가능성"),
    ]

    symptom_set = set(symptoms)
    for required, diagnosis in rules:
        if required.issubset(symptom_set):
            return diagnosis
    return "추가 검사 필요"

print(medical_expert_system(["발열", "기침", "인후통"]))
# → 감기 가능성 높음
```

일본 정부는 1982년 야심찬 **5세대 컴퓨터 프로젝트**를 발표하며 10년 안에 인간처럼 추론하는 컴퓨터를 만들겠다고 선언합니다. 미국과 영국도 경쟁적으로 AI 투자를 늘렸습니다.

## 1987~1993년 — 두 번째 AI 겨울

전문가 시스템은 두 가지 근본적 한계를 드러냅니다.

1. **지식 병목**: 규칙을 작성할 전문가가 필요하고, 규칙이 수만 개를 넘으면 관리가 불가능해집니다.
2. **상식의 부재**: 시스템은 규칙에 없는 상황에서 완전히 무너집니다.

Lisp 전용 컴퓨터 시장도 붕괴되고, 일본 5세대 프로젝트도 실패로 마감합니다. **제2차 AI 겨울(1987~1993)** 이 찾아옵니다.

![AI 역사 타임라인](/assets/posts/ai-history-timeline.svg)

## 1990년대~2011년 — 통계 ML의 조용한 도약

겨울 속에서 조용히 다른 접근이 성숙하고 있었습니다. 바로 **통계 기반 머신러닝**입니다.

1995년 Vapnik이 **SVM(Support Vector Machine)** 을 발표하고, 2001년 Breiman이 **Random Forest**를, 2003년 AdaBoost 등 앙상블 기법들이 등장합니다.

이 방법들은 전문가 시스템처럼 규칙을 직접 쓰지 않습니다. 데이터를 보여 주면 통계적으로 패턴을 찾습니다. 특히 Kaggle 같은 데이터 사이언스 경연 플랫폼이 생기면서 실용적 성과가 쌓이기 시작합니다.

```python
# 1990~2000년대 ML의 전형 — SVM으로 분류
from sklearn.svm import SVC
from sklearn.datasets import make_classification

X, y = make_classification(n_samples=1000, n_features=20, random_state=42)

model = SVC(kernel="rbf", C=1.0)
model.fit(X[:800], y[:800])

accuracy = model.score(X[800:], y[800:])
print(f"테스트 정확도: {accuracy:.2%}")  # 약 88~92%
```

동시에 **ImageNet** 프로젝트(2009)가 1,400만 장 이상의 이미지를 레이블링해 공개합니다. 이 데이터셋이 다음 폭발의 도화선이 됩니다.

## 2012년 — 딥러닝 혁명의 시작

2012년 ImageNet 대회에서 토론토 대학의 **AlexNet**이 기존 최고 기록보다 무려 10% 이상 높은 정확도를 기록합니다. 이것이 딥러닝 혁명의 공식 시작점입니다.

AlexNet의 비결은 세 가지였습니다.

- **대용량 데이터**: ImageNet 1,400만 장
- **GPU 병렬 연산**: NVIDIA GPU로 훈련 시간을 주 단위에서 일 단위로 단축
- **ReLU 활성화 함수**: 그래디언트 소실 문제 완화

```python
# AlexNet 핵심 구조 (단순화)
import torch.nn as nn

class AlexNetSimplified(nn.Module):
    def __init__(self, num_classes=1000):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=11, stride=4),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2),
            nn.Conv2d(64, 192, kernel_size=5, padding=2),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2),
        )
        self.classifier = nn.Sequential(
            nn.Dropout(),
            nn.Linear(192 * 6 * 6, 4096),
            nn.ReLU(inplace=True),
            nn.Linear(4096, num_classes),
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        return self.classifier(x)
```

이후 딥러닝은 도미노처럼 쏟아집니다. GAN(2014), ResNet(2015), AlphaGo(2016)가 잇달아 등장하며 AI는 의심이 아닌 필수가 됩니다.

## 2017년 — Transformer가 모든 것을 바꾸다

2017년 구글이 발표한 논문 *Attention is All You Need*는 AI 역사를 다시 쓴 이정표입니다.

이전 자연어처리의 주류인 RNN은 텍스트를 왼쪽에서 오른쪽으로 순서대로 처리했습니다. 긴 문장에서는 앞부분 정보가 희미해지는 문제가 있었습니다. Transformer는 **Attention 메커니즘**으로 입력 전체를 동시에 보며 어떤 단어가 어떤 단어와 관련 있는지 계산합니다.

결정적으로, Transformer는 병렬화가 가능해 GPU 활용 효율이 극도로 높습니다.

```python
# Transformer 셀프 어텐션 핵심 수식 (의사코드)
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V):
    d_k = Q.size(-1)

    # 유사도 계산: Q·Kᵀ / √dk
    scores = torch.matmul(Q, K.transpose(-2, -1)) / (d_k ** 0.5)

    # 소프트맥스로 정규화 → 각 단어별 가중치
    attn_weights = F.softmax(scores, dim=-1)

    # 가중치 합산으로 문맥 벡터 출력
    return torch.matmul(attn_weights, V)
```

2018년 구글은 Transformer 기반의 **BERT**를 공개합니다. 양방향으로 문맥을 읽어 언어 이해 벤치마크를 대거 갱신했습니다. 같은 해 OpenAI는 단방향 디코더 방식의 **GPT-1**을 냅니다.

## 2020년대 — LLM이 세상을 바꾸다

2020년 OpenAI의 **GPT-3**(1,750억 파라미터)는 충격이었습니다. 지시(instruction)만 주면 번역, 코드 작성, 에세이 생성을 해냈고, 파인튜닝 없이도 뛰어난 성능을 보였습니다.

그리고 2022년 11월 **ChatGPT** 출시. 출시 5일 만에 100만 사용자, 2달 만에 1억 사용자. 이 속도는 인터넷 역사에서 유례없는 기록입니다.

![AI 기술 진화 3단계](/assets/posts/ai-history-winters-and-booms.svg)

2023년 이후에는 **Llama(Meta), Gemini(Google), Claude(Anthropic)** 가 경쟁하며 오픈소스 생태계도 폭발합니다. 2026년 현재는 멀티모달(이미지·음성·비디오), 에이전트, 추론 전문 모델(o시리즈) 등으로 진화 중입니다.

```bash
# 2026년 현재 주요 LLM 현황 (CLI로 확인해 보기)
$ ollama list
NAME                  ID              SIZE    MODIFIED
llama3.3:latest       ...             4.9 GB  4 days ago
qwen2.5:7b            ...             4.4 GB  1 week ago
mistral:latest        ...             3.8 GB  2 weeks ago

# 로컬에서 LLM 실행
$ ollama run llama3.3 "AI 역사를 두 줄로 요약해줘"
```

## 역사에서 배우는 교훈

AI의 70년 역사는 과장→실망→겨울→혁신의 반복입니다.

| 교훈 | 내용 |
|------|------|
| 기술보다 데이터 | AlexNet의 성공은 알고리즘보다 ImageNet이라는 대규모 데이터 덕이 컸습니다 |
| 하드웨어 혁신 | GPU 없이는 딥러닝 혁명도 없었습니다 |
| 겨울은 끝난다 | 두 번의 겨울 뒤에도 AI는 더 강하게 부활했습니다 |
| 과대 선전 주의 | 단기 기대를 줄이고 장기 가능성을 보는 시각이 필요합니다 |

현재 우리가 경험하는 LLM 붐도 이 패턴에서 자유롭지 않습니다. 환각, 비용, 에너지 소비, 안전성 문제가 쌓이면 다음 조정이 올 수도 있습니다. 하지만 역사는 매번 그 다음 도약이 더 컸다고 말합니다.

---

**지난 글:** [AI · ML · DL · LLM, 뭐가 다른가](/posts/ai-ml-dl-llm-concepts/)

**다음 글:** [Narrow vs General vs Super AI](/posts/ai-types/)

<br>
읽어주셔서 감사합니다. 😊
