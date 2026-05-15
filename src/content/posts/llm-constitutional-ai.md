---
title: "Constitutional AI: 원칙 기반 AI 정렬"
description: "Anthropic의 Constitutional AI(CAI) 방법론을 SL-CAI와 RL-CAI 두 단계로 상세히 해설하고, RLAIF가 RLHF를 어떻게 대체하는지, 무해성과 유용성의 균형을 어떻게 맞추는지 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["ConstitutionalAI", "CAI", "RLAIF", "Anthropic", "Claude", "AI정렬", "무해성", "원칙기반"]
featured: false
draft: false
---

[지난 글](/posts/llm-dpo/)에서 DPO가 보상 모델 없이 선호 데이터로 직접 정렬하는 원리를 살펴봤다. RLHF와 DPO 모두 선호 데이터를 만드는 과정에서 인간 레이블러에 의존한다. 인간 레이블러가 응답 쌍을 비교해 어떤 것이 더 좋은지 판단하는 것이다. 그런데 이 과정에는 문제가 있다. 레이블러마다 기준이 다르고, 확장성이 낮으며, 특히 위험한 콘텐츠를 반복적으로 접해야 하는 레이블러의 정신 건강 문제도 심각하다. Anthropic은 2022년 이 문제를 근본적으로 다르게 접근하는 **Constitutional AI(헌법적 AI, CAI)**를 발표했다. AI 스스로 원칙(Constitution)에 따라 자신의 응답을 비판하고 개선하게 함으로써, 인간 레이블러의 역할을 최소화한다.

## Constitution이란 무엇인가

Constitutional AI의 핵심은 "헌법(Constitution)"—AI가 따라야 할 원칙 목록이다. Anthropic이 공개한 원칙들은 다음과 같은 내용을 담는다:

- UN 세계인권선언의 가치에 부합하는지
- 사용자의 자율성과 정보 접근권을 존중하는지
- 유해하거나 기만적이거나 비윤리적인 내용을 포함하지 않는지
- 사실에 기반하고 불확실성을 인정하는지

```python
# Constitutional AI 원칙 예시
constitution = [
    "응답이 해롭거나 비윤리적이지 않은지 평가하세요.",
    "응답이 사실에 기반하는지 확인하세요.",
    "응답이 사용자에게 진정으로 도움이 되는지 판단하세요.",
    "개인정보나 민감 정보를 노출하지 않는지 확인하세요.",
]
# AI가 자신의 응답을 원칙으로 평가하고 수정
critique_prompt = f"""원칙: {constitution[0]}
응답을 검토하고 문제점을 파악한 후 개선하세요."""
```

인간이 원칙을 한 번 정의하면, 이후 수백만 건의 응답을 AI가 자율적으로 평가하고 개선한다. 이것이 Constitutional AI의 핵심 통찰이다.

## 2단계 CAI 파이프라인

![Constitutional AI 2단계 프로세스](/assets/posts/llm-constitutional-ai-process.svg)

### 1단계: SL-CAI (Supervised Learning Constitutional AI)

첫 번째 단계는 지도 학습 기반이다. 과정은 다음과 같다:

**적대적 프롬프트 생성:** 먼저 의도적으로 유해한 응답을 유도할 수 있는 프롬프트를 수집한다. "폭발물 만드는 법 가르쳐줘"나 "해킹 도구 코드 짜줘" 같은 요청들이다.

**초기 응답 생성:** "유용한(helpfulness-only)" RLHF 모델이 이 프롬프트들에 응답을 생성한다. 이 모델은 안전장치가 없어서 유해한 응답을 생성할 수 있다.

**AI 비판(Critique):** AI에게 Constitution 원칙을 제시하고, 방금 생성한 응답의 문제점을 찾게 한다. "이 응답이 다음 원칙을 위반하는가? 어떤 부분이 문제인가?"

**AI 수정(Revision):** 비판을 바탕으로 AI가 개선된 응답을 생성한다. 원래 요청에는 답하되, 유해한 부분을 제거하거나 안전하게 재구성한다.

**SFT 학습:** 원본 프롬프트와 AI가 수정한 응답 쌍으로 SFT 학습을 진행한다. 이것이 SL-CAI 모델이다.

실제로 이 과정은 여러 번 반복될 수 있다. 한 번 비판하고 수정하는 것이 아니라, 여러 차례 순환하며 응답을 점진적으로 개선한다.

### 2단계: RL-CAI (Reinforcement Learning Constitutional AI)

두 번째 단계는 강화학습 기반이지만, 핵심 차이가 있다. **인간 레이블러 대신 AI가 선호 레이블을 생성**한다. 이것이 RLAIF(Reinforcement Learning from AI Feedback)다.

SL-CAI 모델이 같은 프롬프트에 여러 응답을 생성한다. 그리고 Constitution 원칙이 포함된 프롬프트로 AI에게 질문한다: "다음 두 응답 중 어느 것이 더 무해하고 도움이 되나요? A인가요, B인가요?" AI가 선호 레이블을 제공하면, 이 데이터로 보상 모델을 학습하고, 최종적으로 PPO나 유사한 RL 알고리즘으로 모델을 정렬한다.

## RLAIF vs RLHF

![RLAIF vs RLHF 비교](/assets/posts/llm-constitutional-ai-rlaif.svg)

CAI의 RLAIF 접근은 여러 면에서 전통적 RLHF와 다르다:

**확장성:** 인간 레이블러는 하루에 처리할 수 있는 비교 건수에 한계가 있다. AI 레이블러는 수천 개의 GPU를 병렬로 실행해 무제한 확장이 가능하다.

**일관성:** 인간 레이블러 사이에는 개인적 편향이 있어 같은 응답에 대해 다른 레이블을 부여할 수 있다. AI는 동일한 원칙과 컨텍스트에서 더 일관되게 판단한다.

**투명성:** 원칙(Constitution)이 공개되어 있어 AI가 왜 특정 방식으로 응답하는지 설명하기가 쉽다. RLHF의 경우 레이블러 개인의 판단 기준이 불투명하다.

**한계:** AI 레이블러 자체도 편향을 가질 수 있다. 특히 기존 모델이 가진 편향이 레이블에 반영되어 학습에 전달되는 "편향 증폭" 위험이 있다. Anthropic은 이를 관리하기 위해 여전히 인간 감독을 유지한다.

## 무해성과 유용성의 균형

Constitutional AI에서 가장 중요한 설계 결정은 **무해성(harmlessness)과 유용성(helpfulness) 사이의 균형**이다.

초기 RLHF 모델들은 두 목표를 별도의 보상 모델로 학습했다. 무해성 RM과 유용성 RM을 각각 만들고, 두 보상의 가중 합을 최적화했다. 그런데 이 두 목표는 종종 충돌한다. "어떻게 하면 건물 침입을 막을 수 있나요?"라는 질문은 보안 전문가에게는 완전히 합법적인 질문이지만, 무해성 RM은 이를 위험한 질문으로 분류할 수 있다.

CAI는 이 긴장을 Constitution 원칙으로 관리한다. 단순히 "유해해 보이는 요청은 거부"가 아니라, "요청의 의도를 파악하고, 진정으로 위험한 경우에만 거부하며, 그 외는 도움이 되는 방향으로 응답하라"는 원칙을 적용한다.

```python
# CAI 원칙 적용 예시: 맥락에 따른 다른 응답
def generate_safe_helpful_response(prompt: str, model, constitution: list) -> str:
    # 1단계: 초기 응답 생성
    initial_response = model.generate(prompt)

    # 2단계: 원칙에 따라 응답 비판
    critique_prompt = f"""다음 원칙들을 고려해 응답을 평가하세요:
{chr(10).join(f'- {p}' for p in constitution)}

사용자 요청: {prompt}
생성된 응답: {initial_response}

이 응답에 문제가 있나요? 있다면 어떤 부분인지 설명하세요."""

    critique = model.generate(critique_prompt)

    # 3단계: 비판을 반영한 개선 응답
    revision_prompt = f"""다음 비판을 반영해 응답을 개선하세요:
비판: {critique}

원래 요청: {prompt}
더 안전하고 도움이 되는 응답을 작성하세요:"""

    return model.generate(revision_prompt)
```

## Anthropic의 Claude와 CAI

Anthropic이 개발하는 Claude 시리즈 모델들은 CAI를 핵심 정렬 방법론으로 사용한다. Claude의 응답이 다른 상용 LLM들에 비해 특정 요청을 거부하는 방식이 다른 이유 중 하나가 여기에 있다. 단순히 "위험한 키워드"가 포함됐다고 거부하는 것이 아니라, Constitution 원칙에 따라 요청의 맥락과 의도를 고려해 판단한다.

2023년 Anthropic은 CAI의 Constitution을 공개했다. 60개 이상의 원칙이 포함되어 있으며, UN 인권 선언, 아동 보호 원칙, 프라이버시 규범 등 다양한 출처에서 가져왔다. 이 투명성은 사용자와 연구자들이 Claude의 행동을 이해하고 예측할 수 있게 해준다.

스케일링 법칙과 함께 논의되는 다음 주제는 모델이 커질수록 성능이 어떻게 변하는가이다. 단순히 파라미터를 늘리면 어떤 법칙에 따라 성능이 오르는지, Kaplan 법칙과 Chinchilla 법칙이 무엇을 말하는지 살펴보자.

---

**지난 글:** [DPO: 보상 모델 없는 직접 선호도 최적화](/posts/llm-dpo/)

**다음 글:** [스케일링 법칙: 더 크게, 더 많이, 더 강하게](/posts/llm-scaling-laws/)

<br>
읽어주셔서 감사합니다. 😊
