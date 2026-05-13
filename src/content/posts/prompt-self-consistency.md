---
title: "Self-Consistency: 다수결로 정확도를 높이다"
description: "Wang et al. 2022의 Self-Consistency 기법 원리, CoT와의 결합, 다수결 집계 구현, 샘플 수 vs 비용 트레이드오프, Universal Self-Consistency, 실전 코드까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["SelfConsistency", "프롬프트엔지니어링", "LLM", "앙상블", "다수결", "CoT", "프롬프팅", "추론"]
featured: false
draft: false
---

[지난 글](/posts/prompt-react/)에서 외부 도구와 상호작용하는 ReAct를 살펴봤다. 이번 글에서는 훨씬 단순하면서도 강력한 기법인 **Self-Consistency**를 다룬다. 2022년 Wang et al.이 제안한 이 방법은 핵심 아이디어가 명쾌하다. "한 번 물어보지 말고 여러 번 물어본 뒤 다수결로 결정하라."

## Self-Consistency란 무엇인가

**Self-Consistency**는 동일한 질문에 대해 **여러 추론 경로(CoT)를 샘플링**하고, 각 경로의 최종 답을 집계해 **가장 많이 나온 답을 선택**하는 기법이다.

기존 CoT는 greedy decoding(temperature=0)으로 단 하나의 추론 체인을 생성한다. 하지만 LLM은 확률적 모델이므로 온도를 높이면 매번 다른 추론 경로를 생성한다. Self-Consistency는 이 **다양성을 자산**으로 활용한다.

아이디어는 인간 인식과 비슷하다. 복잡한 문제를 여러 각도에서 접근해보고, 같은 답이 여러 방법으로 나온다면 그 답이 옳을 가능성이 높다.

![Self-Consistency 다수결 앙상블](/assets/posts/prompt-self-consistency-overview.svg)

## 성능 향상 효과

Wang et al.은 다양한 벤치마크에서 CoT 대비 Self-Consistency의 성능을 측정했다.

![Self-Consistency 성능 비교](/assets/posts/prompt-self-consistency-comparison.svg)

GSM8K에서 CoT(greedy)가 56.5%인 반면, Self-Consistency @40(40개 경로 샘플링)은 74.4%를 달성했다. 파인튜닝이나 모델 변경 없이 **프롬프팅만으로 18%p 향상**이다. 이 성능 향상은 샘플 수가 늘어날수록 수렴하는 경향을 보이며, 대체로 10~20개 샘플에서 대부분의 이점을 얻는다.

## 구현: Self-Consistency 파이프라인

```python
import anthropic
from collections import Counter
import re

client = anthropic.Anthropic()

def extract_answer(text: str) -> str:
    """추론 텍스트에서 최종 답을 추출"""
    # "답: X", "정답: X", "= X" 패턴 탐지
    patterns = [
        r'(?:최종\s*)?(?:답|정답|answer)[:\s]+([^\n]+)',
        r'따라서[^\n]*?(\d+[\d,\.]*)',
        r'=\s*(\d+[\d,\.]*)\s*(?:이다|입니다|개|명|원|kg)?',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().rstrip('.')
    # 마지막 줄의 숫자 추출
    numbers = re.findall(r'\d+', text.split('\n')[-1])
    return numbers[-1] if numbers else text.strip()[:50]

def self_consistency(
    question: str,
    n_samples: int = 10,
    temperature: float = 0.8,
    cot_exemplars: str = "",
) -> dict:
    """Self-Consistency 실행"""
    cot_trigger = "단계별로 생각해 봅시다."
    prompt = f"{cot_exemplars}\nQ: {question}\nA: {cot_trigger}" if cot_exemplars \
             else f"Q: {question}\nA: {cot_trigger}"

    answers = []
    reasonings = []

    for i in range(n_samples):
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=512,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}]
        )
        reasoning = response.content[0].text
        answer = extract_answer(reasoning)
        answers.append(answer)
        reasonings.append(reasoning)

    # 다수결 집계
    vote_counts = Counter(answers)
    best_answer, best_count = vote_counts.most_common(1)[0]

    # 가장 많이 나온 답과 일치하는 추론 중 첫 번째 반환
    best_reasoning_idx = next(
        i for i, a in enumerate(answers) if a == best_answer
    )

    return {
        "question": question,
        "answer": best_answer,
        "confidence": best_count / n_samples,
        "vote_distribution": dict(vote_counts),
        "best_reasoning": reasonings[best_reasoning_idx],
        "n_samples": n_samples,
    }

result = self_consistency(
    "한 상점에서 사과를 1kg에 2,400원에 팔고 있다. "
    "3.5kg를 사면 총 금액은? (500원 할인 쿠폰 보유)",
    n_samples=10
)
print(f"답: {result['answer']}")
print(f"신뢰도: {result['confidence']:.0%}")
print(f"투표 분포: {result['vote_distribution']}")
```

## 비용 최적화: 몇 개나 샘플링해야 할까

Self-Consistency의 단점은 API 비용이 n배 증가한다는 것이다. 실용적인 가이드라인:

| 태스크 복잡도 | 권장 샘플 수 | 비용 배수 |
|---|---|---|
| 단순 계산 | 5~8개 | 5~8× |
| 수학 추론 | 10~20개 | 10~20× |
| 복잡한 논리 | 20~40개 | 20~40× |
| 창의적 글쓰기 | 3~5개 | 3~5× |

```python
def adaptive_self_consistency(
    question: str,
    target_confidence: float = 0.7,
    max_samples: int = 20,
    batch_size: int = 5,
) -> dict:
    """신뢰도가 임계값에 도달하면 조기 종료"""
    all_answers = []
    total_calls = 0

    while total_calls < max_samples:
        # batch_size개씩 추가 샘플링
        batch = []
        for _ in range(batch_size):
            resp = client.messages.create(
                model="claude-opus-4-7",
                max_tokens=512,
                temperature=0.8,
                messages=[{"role": "user",
                           "content": f"Q: {question}\nA: 단계별로 생각해 봅시다."}]
            )
            batch.append(extract_answer(resp.content[0].text))

        all_answers.extend(batch)
        total_calls += batch_size

        vote_counts = Counter(all_answers)
        best_answer, best_count = vote_counts.most_common(1)[0]
        confidence = best_count / total_calls

        if confidence >= target_confidence:
            return {"answer": best_answer, "confidence": confidence,
                    "samples_used": total_calls, "early_stop": True}

    return {"answer": best_answer, "confidence": confidence,
            "samples_used": total_calls, "early_stop": False}
```

## Universal Self-Consistency (USC)

Chen et al. 2023은 **Universal Self-Consistency**를 제안했다. 다수결 집계를 숫자 카운팅 대신 **LLM 자체에 맡기는** 방식이다. 자유형식 텍스트 출력(요약, 번역 등)에서도 적용 가능하다.

```python
def universal_self_consistency(question: str, n_samples: int = 5) -> str:
    """LLM이 직접 가장 일관된 답을 선택"""
    # 1단계: 여러 응답 샘플링
    responses = []
    for _ in range(n_samples):
        resp = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=512,
            temperature=0.8,
            messages=[{"role": "user", "content": question}]
        )
        responses.append(resp.content[0].text)

    # 2단계: LLM이 가장 일관된 답 선택
    candidates = "\n\n".join(
        f"[응답 {i+1}]\n{r}" for i, r in enumerate(responses)
    )
    aggregation_prompt = f"""다음은 같은 질문에 대한 {n_samples}개의 응답입니다.

질문: {question}

{candidates}

위 응답들을 검토하고, 가장 일관성 있고 정확한 답을 선택하거나 종합하세요.
최종 답:"""

    final = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        temperature=0,
        messages=[{"role": "user", "content": aggregation_prompt}]
    )
    return final.content[0].text
```

Self-Consistency는 구현이 단순하고 효과가 검증된 기법이다. 다음 글에서 다룰 시스템 메시지 설계와 결합하면, 도메인 특화 태스크에서 더욱 안정적인 결과를 얻을 수 있다.

---

**지난 글:** [ReAct: 추론과 행동을 결합한 에이전트 프롬프팅](/posts/prompt-react/)

**다음 글:** [시스템 메시지 설계: LLM의 역할과 경계를 정의하다](/posts/prompt-system-message/)

<br>
읽어주셔서 감사합니다. 😊
