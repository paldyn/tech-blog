---
title: "Chain-of-Thought 프롬프팅: LLM이 생각하게 만드는 기술"
description: "Wei et al. 2022 논문에서 탄생한 CoT 프롬프팅의 원리, Zero-shot CoT vs Few-shot CoT, Auto-CoT, 효과가 나타나는 모델 크기 임계점, 실전 코드까지 한국어로 완전 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["ChainOfThought", "CoT", "프롬프트엔지니어링", "LLM", "추론", "ZeroshotCoT", "FewshotCoT", "프롬프팅"]
featured: false
draft: false
---

[지난 글](/posts/prompt-zero-few-shot/)에서 Zero-shot과 Few-shot 프롬프팅의 기초를 다뤘다. 이번 글에서는 그 연장선에 있으면서도 한 차원 높은 기법인 **Chain-of-Thought(CoT) 프롬프팅**을 깊이 파고든다. "단계별로 생각해 봅시다"라는 단 한 문장이 LLM의 수학·논리·상식 추론 정확도를 40~80% 끌어올릴 수 있다는 사실, 그 이유와 구현법을 함께 살펴본다.

## Chain-of-Thought란 무엇인가

**Chain-of-Thought**는 LLM이 최종 답변에 도달하기 전에 **중간 추론 단계를 명시적으로 생성**하도록 유도하는 프롬프팅 기법이다. 2022년 Google Brain의 Jason Wei 외 연구팀이 발표한 논문 *"Chain-of-Thought Prompting Elicits Reasoning in Large Language Models"*에서 체계화됐다.

핵심 아이디어는 단순하다. 사람이 어려운 문제를 풀 때 머릿속으로 단계를 밟아 가듯, LLM에게도 그 단계를 **토큰으로 출력하게** 만드는 것이다. LLM은 자기회귀(autoregressive) 방식으로 다음 토큰을 예측하므로, 중간 추론 토큰들이 이후 토큰 예측의 조건(context)이 된다. 즉 모델이 "스스로 쓴 추론"을 읽으면서 더 정확한 결론에 도달하는 구조다.

![Chain-of-Thought 프롬프팅 흐름](/assets/posts/prompt-chain-of-thought-flow.svg)

## 왜 효과가 있는가: 이론적 배경

**1. 컨텍스트 창을 '작업 메모리'로 활용**

Transformer는 컨텍스트 창 안의 모든 토큰에 어텐션을 수행한다. 중간 추론을 생성하면 그 내용이 컨텍스트로 남아, 이후 예측 단계에서 참조된다. 복잡한 계산을 한 번에 처리하는 대신 여러 단계로 나누어 "외부 메모리"처럼 활용하는 셈이다.

**2. 오류 수정 기회 증가**

추론을 단계별로 출력하면 중간 단계에서 오류가 발생했을 때 이후 단계에서 교정할 여지가 생긴다. 반면 직접 답을 출력하는 방식은 초기 판단 오류가 그대로 최종 답이 된다.

**3. 창발적 능력과의 관계**

Wei et al.은 CoT 효과가 **모델 크기에 따라 비선형적으로 나타나는 창발적(emergent) 능력**임을 밝혔다. ~100B 파라미터 이하 모델에서는 CoT가 오히려 성능을 떨어뜨릴 수 있고, 대형 모델에서 갑자기 효과가 폭발적으로 증가한다.

## Zero-shot CoT: "단계별로 생각해 봅시다"

Kojima et al. 2022 (*"Large Language Models are Zero-Shot Reasoners"*)는 Few-shot 예시 없이도 **단 하나의 마법 문구**로 CoT를 활성화할 수 있음을 보였다.

```python
# Zero-shot CoT 기본 패턴
prompt = """Q: 농부가 당근 18개 중 7개를 팔았다. 남은 당근은 몇 개인가?

A: 단계별로 생각해 봅시다.
"""
```

이 기법은 2단계로 작동한다.
1. **추론 단계**: `"단계별로 생각해 봅시다."` 트리거 → 모델이 추론 과정 생성
2. **추출 단계**: `"따라서 최종 답은"` 추가 → 모델이 답만 명시

```python
import anthropic

client = anthropic.Anthropic()

def zero_shot_cot(question: str) -> str:
    # 1단계: 추론 생성
    reasoning_prompt = f"Q: {question}\n\nA: 단계별로 생각해 봅시다.\n"
    reasoning = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        messages=[{"role": "user", "content": reasoning_prompt}]
    ).content[0].text

    # 2단계: 최종 답 추출
    extract_prompt = (
        f"Q: {question}\n\nA: 단계별로 생각해 봅시다.\n"
        f"{reasoning}\n\n따라서 최종 답은"
    )
    answer = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=64,
        messages=[{"role": "user", "content": extract_prompt}]
    ).content[0].text

    return f"추론:\n{reasoning}\n\n답: {answer}"

result = zero_shot_cot("철수는 사탕 24개를 4명에게 똑같이 나눠줬다. 한 명이 받는 사탕은?")
print(result)
```

## Few-shot CoT: 예시로 추론 패턴 가르치기

![Zero-shot CoT vs Few-shot CoT](/assets/posts/prompt-chain-of-thought-types.svg)

Few-shot CoT는 Wei et al.의 원래 기법으로, **추론 과정이 포함된 예시(exemplar)**를 프롬프트에 넣는다.

```python
few_shot_cot_prompt = """다음은 수학 문제 풀이 예시입니다.

Q: 사과 5개짜리 바구니가 3개 있다. 총 사과는 몇 개인가?
A: 바구니 1개당 사과 5개이므로, 바구니 3개이면 5 × 3 = 15개다.
   따라서 총 사과는 15개다.

Q: 기차가 시속 80km로 2시간 30분을 달렸다. 이동 거리는?
A: 2시간 30분 = 2.5시간이다.
   거리 = 속도 × 시간 = 80 × 2.5 = 200km다.
   따라서 이동 거리는 200km다.

Q: {question}
A:"""
```

좋은 Few-shot CoT 예시의 조건:
- **다양성**: 유사한 예시만 쓰면 패턴이 과적합됨
- **명확한 추론 단계**: 결론으로 건너뛰지 않고 중간 과정 명시
- **일관된 형식**: 모든 예시가 동일한 구조를 가져야 학습 효율 높음
- **적정 수**: 보통 4~8개면 충분, 지나치면 컨텍스트 낭비

## Auto-CoT: 자동으로 예시 생성하기

Zhang et al. 2022는 **Auto-CoT**를 제안했다. 사람이 직접 CoT 예시를 작성하는 대신, Zero-shot CoT로 생성한 추론을 Few-shot 예시로 재활용한다.

```python
def auto_cot_generate_exemplars(questions: list[str], k: int = 4) -> list[dict]:
    """Zero-shot CoT로 예시 자동 생성"""
    exemplars = []
    for q in questions[:k]:
        reasoning_prompt = f"Q: {q}\nA: 단계별로 생각해 봅시다.\n"
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=256,
            messages=[{"role": "user", "content": reasoning_prompt}]
        ).content[0].text
        exemplars.append({"question": q, "reasoning": response})
    return exemplars

def auto_cot_solve(exemplars: list[dict], target_q: str) -> str:
    shots = ""
    for ex in exemplars:
        shots += f"Q: {ex['question']}\nA: {ex['reasoning']}\n\n"
    shots += f"Q: {target_q}\nA: 단계별로 생각해 봅시다.\n"
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        messages=[{"role": "user", "content": shots}]
    ).content[0].text
```

## CoT가 특히 효과적인 태스크

| 태스크 유형 | 효과 | 대표 벤치마크 |
|---|---|---|
| 산술 추론 | 매우 큼 | GSM8K, SVAMP, ASDiv |
| 상식 추론 | 큼 | CommonsenseQA, StrategyQA |
| 기호 추론 | 큼 | Last Letter Concat, Coin Flip |
| 코드 생성 | 중간 | HumanEval, MBPP |
| 팩트 QA | 작음 | TriviaQA (단순 기억 문제) |

단순한 사실 검색이나 분류 문제에는 CoT가 별 효과가 없거나 오히려 불필요한 토큰을 낭비한다. **추론 체인이 필요한 복잡한 문제**에 집중해서 적용하는 것이 핵심이다.

## 실전 구현: 구조화된 CoT 래퍼

```python
from enum import Enum

class CotStrategy(Enum):
    ZERO_SHOT = "zero_shot"
    FEW_SHOT = "few_shot"
    AUTO = "auto"

def cot_solve(
    question: str,
    strategy: CotStrategy = CotStrategy.ZERO_SHOT,
    exemplars: list[dict] | None = None,
    trigger: str = "단계별로 생각해 봅시다.",
) -> dict:
    if strategy == CotStrategy.ZERO_SHOT:
        prompt = f"Q: {question}\n\nA: {trigger}\n"
    elif strategy == CotStrategy.FEW_SHOT and exemplars:
        shots = "\n\n".join(
            f"Q: {e['question']}\nA: {e['reasoning']}"
            for e in exemplars
        )
        prompt = f"{shots}\n\nQ: {question}\nA: {trigger}\n"
    else:
        prompt = f"Q: {question}\n\nA: {trigger}\n"

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    reasoning = response.content[0].text

    # 답 추출
    extract_prompt = f"{prompt}{reasoning}\n\n따라서 최종 답은"
    final = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=128,
        messages=[{"role": "user", "content": extract_prompt}]
    ).content[0].text

    return {
        "question": question,
        "reasoning": reasoning,
        "answer": final.strip(),
        "strategy": strategy.value,
    }
```

## 주의사항과 한계

**환각 위험**: CoT가 그럴듯한 추론 체인을 만들지만 사실과 다를 수 있다. 추론 단계가 길어질수록 초기 오류가 전파되는 **오류 누적(error propagation)** 문제가 있다.

**검증 필요**: 수학 계산은 Python 실행기로 검증, 코드는 실제 실행으로 검증하는 **도구 검증(tool-augmented CoT)**을 결합하면 신뢰성이 크게 오른다.

**비용**: CoT는 표준 프롬프팅보다 훨씬 많은 토큰을 소비한다. 캐싱(prompt caching)을 활용하거나, 단순한 쿼리에는 CoT를 적용하지 않는 라우팅 전략이 필요하다.

---

**지난 글:** [Zero-shot과 Few-shot Learning: 예시의 힘](/posts/prompt-zero-few-shot/)

**다음 글:** [Tree-of-Thought: 여러 추론 경로를 탐색하다](/posts/prompt-tree-of-thought/)

<br>
읽어주셔서 감사합니다. 😊
