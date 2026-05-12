---
title: "Claude 패밀리 완전 해부: Constitutional AI와 안전성 우선 설계"
description: "Anthropic Claude 시리즈의 탄생 배경, Constitutional AI 원칙, Claude 1·2·3·3.5·4 모델별 특징, Haiku·Sonnet·Opus 티어 선택 기준, 그리고 실전 API 사용법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["Claude", "Anthropic", "LLM", "ConstitutionalAI", "RLAIF", "Claude3", "Claude4", "AI안전성"]
featured: false
draft: false
---

[지난 글](/posts/llm-gpt-family/)에서 GPT 시리즈가 어떻게 LLM 생태계를 정의했는지 살펴봤다. 그런데 GPT의 거대한 성공 뒤에는 중요한 질문이 따라왔다. "AI를 단순히 더 크게 만드는 것만으로 충분한가? 안전성과 신뢰성은 어떻게 보장하는가?" 이 질문에 정면으로 답하며 등장한 것이 Anthropic과 **Claude 패밀리**다.

## Anthropic의 탄생: OpenAI를 나온 사람들

Anthropic은 2021년, OpenAI의 전 핵심 멤버들이 창업했다. Dario Amodei(전 OpenAI 연구 VP), Daniela Amodei(전 OpenAI 운영 VP)를 비롯한 10여 명이 AI 안전성을 핵심 미션으로 내걸고 독립했다.

Anthropic의 출발점은 명확했다. "AI 능력의 발전과 AI 안전성의 연구가 함께 가야 한다." 단순히 더 강한 모델을 만드는 것이 아니라, **신뢰할 수 있고 해석 가능하며 제어 가능한** AI를 만드는 것을 목표로 삼았다. 이 철학이 Claude의 모든 설계에 녹아들어 있다.

## Constitutional AI: 원칙으로 AI를 정렬하다

Claude의 가장 핵심적인 기술적 특징은 **Constitutional AI(CAI)**다. 기존 RLHF는 인간 피드백자들이 AI 출력을 하나하나 평가하는 방식으로 작동한다. 이 방식은 효과적이지만 두 가지 문제가 있다. 확장성(인간 레이블러 수의 한계)과 일관성(평가자마다 기준이 다를 수 있음)이다.

Constitutional AI는 이를 다르게 접근한다. AI에게 **원칙 집합(Constitution)**을 주고, 그 원칙에 따라 자신의 출력을 스스로 비평하고 수정하게 한다.

**RLAIF(Reinforcement Learning from AI Feedback):** 인간 대신 AI가 피드백을 제공한다. Constitutional AI 원칙에 따라 훈련된 "헌법 AI"가 다른 AI 출력을 평가하고, 이 평가로 보상 신호를 만든다. 결과적으로 대규모 인간 레이블링 없이도 원칙 기반 정렬이 가능해진다.

Claude의 핵심 원칙은 **Helpful(유용성), Harmless(무해성), Honest(정직성)**의 HHH 프레임워크다. 특히 "Honest"는 다른 AI 모델과 차별되는 지점이다. Claude는 모르는 것을 모른다고 말하고, 자신의 불확실성을 명시적으로 표현하도록 설계됐다.

![Claude 패밀리 진화 타임라인](/assets/posts/llm-claude-family-timeline.svg)

## Claude 1: 조용한 출발

2023년 3월 공개된 **Claude 1**은 Anthropic의 첫 번째 상업 모델이었다. 공개 당시에는 ChatGPT만큼 주목을 받지 못했지만, AI 안전성 연구자들 사이에서 Constitutional AI의 실제 구현으로 주목을 받았다.

Claude 1의 특징은 거절 방식이었다. "그것은 할 수 없습니다"가 아니라 "그 요청에서 제가 도울 수 있는 부분과 그렇지 않은 부분을 설명드리겠습니다"처럼, 맥락과 이유를 제공하며 경계를 설명했다. 이는 RLHF만으로 훈련된 모델들이 종종 보이는 단순하고 기계적인 거절과 달랐다.

## Claude 2: 코딩과 긴 컨텍스트

2023년 7월 등장한 **Claude 2**는 두 가지 면에서 중요한 도약이었다.

**100K 토큰 컨텍스트:** 당시 GPT-4의 기본 컨텍스트(8K~32K)를 크게 넘어서는 100,000 토큰 컨텍스트 창을 지원했다. 소설 한 권, 긴 법률 계약서, 대형 코드베이스를 한 번에 처리할 수 있었다.

**코딩과 수학 능력 향상:** 코드 생성, 버그 수정, 알고리즘 설명에서 이전 버전 대비 크게 향상됐다. 특히 Python 코드를 단순히 생성하는 것을 넘어, 코드의 의도와 잠재적 문제를 설명하는 능력이 강해졌다.

## Claude 3: 세 티어 전략의 등장

2024년 3월 공개된 **Claude 3 시리즈**는 Anthropic이 단일 모델이 아닌 성능/비용/속도의 트레이드오프를 고려한 세 가지 모델을 동시에 출시하는 전략을 도입한 것이다.

**Claude 3 Haiku:** 가장 빠르고 저렴하다. 실시간 응답이 필요한 애플리케이션, 대량 배치 처리, 단순 분류·요약 태스크에 최적화됐다. 비용 대비 성능이 매우 효율적이다.

**Claude 3 Sonnet:** 속도와 성능의 균형점이다. 대부분의 실용적 태스크에서 최선의 선택이다. 코딩, 문서 작성, 복잡한 Q&A에 강하다.

**Claude 3 Opus:** 최고 성능 모델이다. 복잡한 추론, 과학적 분석, 전략적 계획 수립 같은 고부가가치 태스크에 사용된다. 비용이 높지만 그만큼의 성능을 제공한다.

Claude 3 발표 시점에서 Haiku, Sonnet, Opus가 각각 GPT-3.5, GPT-4와 동급 또는 그 이상의 성능 벤치마크를 기록하며 업계의 주목을 받았다.

![Claude 모델 티어 비교](/assets/posts/llm-claude-family-models.svg)

## Claude 3.5 Sonnet: 코딩의 제왕

2024년 6월 출시된 **Claude 3.5 Sonnet**은 특히 코딩 분야에서 전례 없는 성능을 보여줬다. SWE-bench(실제 GitHub 이슈 해결)에서 당시 최고 성능을 달성했으며, 소프트웨어 엔지니어들 사이에서 폭발적인 호응을 얻었다.

이와 함께 Anthropic은 **Claude Code** CLI 도구를 출시했다. 터미널에서 직접 Claude와 상호작용하며 코드베이스를 분석하고, 파일을 편집하고, 테스트를 실행하는 에이전트 경험을 제공했다.

## Claude 4 시리즈: 에이전트 시대

2025년 등장한 **Claude 4 시리즈**(Opus 4, Sonnet 4.6, Haiku 4.5)는 에이전트 사용 사례에 최적화된 방향으로 발전했다. 복잡한 다단계 작업, 장시간 자율 실행, 도구 사용(Tool Use) 능력이 크게 강화됐다.

```python
# Claude API 기본 사용 (Anthropic SDK)
import anthropic

client = anthropic.Anthropic()

# 단순 메시지 생성
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": "파이썬으로 이진 탐색 알고리즘을 구현하고 설명해줘."
        }
    ]
)
print(message.content[0].text)
```

Claude 4는 특히 **Extended Thinking** 기능을 지원한다. 복잡한 문제에서 모델이 응답 전에 내부적으로 더 깊이 사고하는 과정을 거치도록 허용해, 수학적 추론이나 전략적 계획 수립에서 성능이 크게 향상됐다.

```python
# Extended Thinking 활성화
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000  # 사고에 사용할 최대 토큰
    },
    messages=[{
        "role": "user",
        "content": "RSA 암호화의 수학적 원리를 처음부터 설명하고, "
                   "소수 선택이 보안에 미치는 영향을 분석해줘."
    }]
)

# 사고 과정과 최종 답변 분리
for block in response.content:
    if block.type == "thinking":
        print(f"[사고 과정]\n{block.thinking}\n")
    elif block.type == "text":
        print(f"[최종 답변]\n{block.text}")
```

## Claude의 차별점: 정직성과 자기 인식

Claude가 다른 LLM과 가장 다른 지점은 **자기 인식과 한계 표현**이다. Claude는 훈련 데이터 커트오프 이후의 정보에 대해 명확히 "모른다"고 말한다. 불확실한 주장에 대해서는 확률적 언어를 사용한다("~일 가능성이 있습니다", "제가 알기로는"). 이는 Constitutional AI의 Honest 원칙을 직접 구현한 것이다.

또한 Claude는 **롤플레이와 실제 요청의 구분**을 명시적으로 처리한다. 창작 글쓰기나 가상 시나리오에서도 실제 해를 끼칠 수 있는 정보는 제공하지 않으며, 그 이유를 설명한다.

## 모델 선택 가이드

실제 프로젝트에서 Claude 모델을 선택할 때의 원칙이 있다.

**Haiku:** 응답 속도가 2초 이내여야 하거나, API 비용이 핵심 제약인 경우. 고객 지원 챗봇, 실시간 제안 기능, 대량 데이터 분류.

**Sonnet:** 대부분의 프로덕션 사용 사례. 코드 생성, 문서 Q&A, 콘텐츠 작성, 에이전트 오케스트레이션.

**Opus:** 품질이 비용보다 중요한 경우. 연구 보조, 복잡한 법률/의료 문서 분석, 정밀한 전략 수립.

GPT와 Claude, 두 패밀리 중 어느 것이 더 좋은가는 태스크에 따라 다르다. 다음 글에서는 Google의 **Gemini 패밀리**를 살펴보며, 세 거대 LLM 가문의 그림을 완성한다.

---

**지난 글:** [GPT 패밀리 완전 해부: GPT-1부터 GPT-4o까지](/posts/llm-gpt-family/)

**다음 글:** [Gemini 패밀리 완전 해부: Google의 멀티모달 LLM 전략](/posts/llm-gemini-family/)

<br>
읽어주셔서 감사합니다. 😊
