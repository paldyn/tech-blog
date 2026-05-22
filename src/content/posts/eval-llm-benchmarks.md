---
title: "LLM 벤치마크 완전 정리: MMLU부터 HumanEval까지"
description: "MMLU, MATH, HumanEval, HellaSwag, MT-Bench, Chatbot Arena 등 주요 LLM 벤치마크의 설계 원리와 한계를 이해하고 lm-eval로 직접 평가하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["LLM벤치마크", "MMLU", "HumanEval", "MT-Bench", "ChatbotArena", "모델평가", "lm-eval", "GPQA"]
featured: false
draft: false
---

[지난 글](/posts/rl-rlhf-deep/)에서 RLHF가 LLM을 인간 선호에 맞게 정렬하는 방법을 살펴보았다. 더 나은 모델을 만들었다면 이제 그것을 어떻게 객관적으로 측정할까? **LLM 벤치마크**는 이 질문에 답하는 표준화된 도구다. 그런데 GPT-4, Claude, Gemini를 비교한 리더보드를 보면 모델마다 점수가 다르고, 같은 모델도 벤치마크마다 순위가 달라진다. 벤치마크를 제대로 이해하지 못하면 수치에 속기 쉽다. 이번 글에서는 주요 벤치마크의 설계 원리, 측정 대상, 한계를 완전히 파악하고 직접 실행하는 방법까지 다룬다.

## 벤치마크가 필요한 이유

LLM 평가의 어려움은 "좋은 응답"을 정의하기 어렵다는 데서 온다. 단순한 분류 모델이라면 정확도 하나로 충분하지만, 언어 모델은 수학 풀기, 코드 작성, 창작, 요약, 대화 등 수십 가지 능력을 동시에 갖춰야 한다.

벤치마크는 이 다차원 능력을 특정 과제로 수치화한다. 각 벤치마크가 무엇을 측정하는지, 어떤 한계가 있는지를 이해해야 결과를 올바르게 해석할 수 있다.

## 주요 벤치마크 상세

![LLM 주요 벤치마크 맵](/assets/posts/eval-llm-benchmarks-overview.svg)

### MMLU: 지식의 폭

**Massive Multitask Language Understanding**. 수학, 역사, 법학, 의학, 물리학 등 57개 과목의 대학원 수준 4지선다 문제 14,000개로 구성된다.

```
예시 문제 (의학):
Q: 알츠하이머병의 주요 병리적 특징이 아닌 것은?
A) 아밀로이드 플라크  B) 신경섬유 엉킴
C) 시냅스 손실       D) 레위소체 (정답)
```

평가 방식: few-shot(5-shot) 프롬프팅으로 A/B/C/D 중 가장 높은 로그 확률을 선택. 정확도(accuracy)로 보고.

**한계**: 단순 암기도 측정하므로 진짜 추론 능력인지 구분하기 어렵다. 2024년 이후 모델들이 90%+를 달성해 포화 상태다 → MMLU-Pro(10지선다)로 대체 중.

### MATH: 수학적 추론

AMC, AIME, MATHCOUNTS 수준의 경시 대회 문제 12,500개. 대수, 정수론, 기하, 확률, 미적분 5단계 난이도로 구성된다.

```
예시 문제 (Level 5):
Q: x + 1/x = 3이면 x³ + 1/x³의 값은?
A: (x + 1/x)³ = x³ + 3x + 3/x + 1/x³
   = x³ + 1/x³ + 3(x + 1/x)
   27 = x³ + 1/x³ + 9 → 답: 18
```

최신 모델은 step-by-step 사고(CoT)로 85%+를 달성한다.

### HumanEval: 코드 생성

OpenAI가 공개한 164개의 Python 함수 작성 과제. 함수 시그니처와 독스트링이 주어지면 구현을 생성하고, 실제 단위 테스트를 실행해 pass/fail을 판정한다.

```python
# HumanEval 예시 문제 (task_id: HumanEval/0)
def has_close_elements(numbers: List[float], threshold: float) -> bool:
    """주어진 숫자 목록에서 threshold보다 가까운 두 수가 있으면 True 반환
    >>> has_close_elements([1.0, 2.0, 3.0], 0.5)
    False
    >>> has_close_elements([1.0, 2.8, 3.0, 4.0, 5.0, 2.0], 0.3)
    True
    """
    # LLM이 이 부분을 구현

# 평가: 단위 테스트 실행 → pass@k 계산
# pass@1: 1회 생성 시 통과율
# pass@10: 10회 생성 중 1회 이상 통과율
```

**pass@k**: k번 생성 중 최소 1번 통과할 확률. k를 크게 하면 좋은 코드가 나올 확률이 높아진다. 실제 사용 상황과 가깝게 평가하려면 pass@1이 중요하다.

### MT-Bench: 다회차 대화

80개의 다회차 대화 (1턴+2턴). 수학, 코딩, 작문, 역할극 등 8개 카테고리. GPT-4를 심판으로 써서 1~10점 척도로 채점한다.

```python
# MT-Bench 예시 대화
round_1 = "소수(prime number)가 무엇인지 설명하고, 첫 10개를 나열하세요."
round_2 = "위 설명을 10살 아이도 이해할 수 있게 다시 설명하세요."
# 2회차 질문은 1회차 맥락을 기억해야 함 → 다회차 이해력 평가
```

### Chatbot Arena: 살아있는 ELO 랭킹

실제 사용자가 두 모델의 응답을 블라인드로 비교해 투표. 체스의 ELO 시스템으로 순위를 산출한다. 수십만 명의 투표가 실시간으로 반영되어 가장 현실적인 사용자 선호 지표다.

**장점**: 조작이 어렵고 실제 사용 패턴을 반영. **한계**: 투표자 편향(영어권, IT 종사자 과다), 단순 문장이 유리.

### GPQA: 전문가도 어려운 문제

Graduate-Level Google-Proof Q&A. 물리, 화학, 생명과학 박사 과정 학생이 작성하고 다른 전문가가 검증한 448개 문제. 비전문가는 34%, 심지어 해당 분야 전문가도 65%만 맞힌다.

```
GPQA 문제 특성:
- 단순 암기로 해결 불가 → 심층 추론 필수
- 구글 검색으로 찾기 어려운 조합 문제
- LLM 학습 데이터 오염 위험 낮음
- Claude 3.5: 59%, GPT-4o: 53%
```

## 벤치마크 실행하기

![LM Evaluation Harness 활용](/assets/posts/eval-llm-benchmarks-code.svg)

EleutherAI의 `lm-eval` 라이브러리가 표준 평가 도구다.

```bash
# 설치
pip install lm-eval

# CLI로 실행
lm_eval \
  --model hf \
  --model_args pretrained=meta-llama/Llama-3-8B-Instruct \
  --tasks mmlu,hellaswag,arc_challenge,gsm8k \
  --num_fewshot 5 \
  --batch_size 32 \
  --output_path results/llama3_8b/
```

```python
# Python API로 실행 및 결과 파싱
import lm_eval
import json

results = lm_eval.simple_evaluate(
    model="hf",
    model_args="pretrained=mistralai/Mistral-7B-Instruct-v0.3",
    tasks=["mmlu", "hellaswag", "arc_challenge", "gsm8k"],
    num_fewshot=5,
    batch_size=8,
    device="cuda",
)

# 결과 출력
for task, res in results["results"].items():
    acc = res.get("acc,none", res.get("exact_match,none", "N/A"))
    print(f"{task:20s}: {acc:.3f}" if isinstance(acc, float) else f"{task}: {acc}")

# 결과 저장
with open("results.json", "w") as f:
    json.dump(results, f, indent=2, default=str)
```

## 벤치마크의 함정과 오해

**오염(Contamination)**: 평가 데이터가 학습 데이터에 포함되면 점수가 부풀려진다. 폐쇄형 모델은 훈련 데이터를 공개하지 않아 검증하기 어렵다.

**단일 지표 의존**: MMLU 80%가 MMLU 79% 모델보다 실제로 더 유용하다는 보장이 없다. 다양한 벤치마크를 종합해야 한다.

**포화 문제**: GPT-4 출시 후 MMLU, HellaSwag은 거의 모든 선도 모델이 85%+를 달성해 변별력을 잃었다. 더 어려운 GPQA, MATH Level 5, AIME 2024 등으로 이동 중이다.

**언어 편향**: 대부분의 벤치마크가 영어 기반. 한국어 LLM 평가는 KoBEST, LogiKorEval, HAE-RAE 등을 별도로 사용해야 한다.

| 벤치마크 | 측정 능력 | 포화 위험 | 추천 여부 |
|---------|---------|---------|---------|
| MMLU | 지식 폭 | 높음 | MMLU-Pro로 대체 |
| MATH | 수학 추론 | 중간 | 적극 권장 |
| HumanEval | 코딩 | 높음 | LiveCodeBench 보완 |
| GPQA | 전문 추론 | 낮음 | 강력 권장 |
| MT-Bench | 대화 품질 | 중간 | 권장 |
| Chatbot Arena | 사용자 선호 | 낮음 | 강력 권장 |

## 마무리

벤치마크는 LLM 능력의 일부를 측정하는 도구일 뿐이다. MMLU, MATH, HumanEval, GPQA, MT-Bench, Chatbot Arena처럼 다양한 벤치마크를 함께 보는 것이 균형 잡힌 평가를 위해 필수적이다. 다음 글에서는 자동 벤치마크의 한계를 극복하는 인간 평가 방법론을 살펴본다.

---

**지난 글:** [RLHF 심화: 인간 피드백으로 LLM 정렬하기](/posts/rl-rlhf-deep/)

**다음 글:** [LLM 인간 평가: 신뢰할 수 있는 정성 평가 설계하기](/posts/eval-human-eval/)

<br>
읽어주셔서 감사합니다. 😊
