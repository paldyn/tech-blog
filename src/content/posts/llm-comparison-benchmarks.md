---
title: "LLM 벤치마크 완전 해부: MMLU, HumanEval, LMSYS Chatbot Arena"
description: "MMLU·HumanEval·SWE-bench·LMSYS Chatbot Arena 등 주요 LLM 벤치마크의 측정 방법, 한계, 벤치마크 해킹 문제, 그리고 실무에서 모델을 올바르게 비교하는 방법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["LLM벤치마크", "MMLU", "HumanEval", "ChatbotArena", "ELO", "모델비교", "LLM평가", "SWEbench"]
featured: false
draft: false
---

[지난 글](/posts/llm-korean-models/)에서 한국 LLM의 생태계를 살펴봤다. LLM을 소개할 때마다 "MMLU 90.0% 달성", "HumanEval pass@1 82%", "ELO 1350" 같은 숫자들이 등장한다. 이 숫자들은 무엇을 의미하고, 어떻게 측정되며, 어디까지 신뢰할 수 있을까? 이 글에서는 LLM 벤치마크의 종류, 측정 방법, 한계, 그리고 실무에서 올바르게 모델을 평가하는 방법을 완전히 해부한다.

## 왜 벤치마크가 필요한가

LLM 성능을 비교하는 방법은 크게 세 가지다.

**주관적 평가:** "나는 Claude가 GPT보다 더 좋던데." 개인 경험에 의존하며 재현하기 어렵다.

**태스크 특화 테스트:** "우리 서비스에서 이 프롬프트로 100번 테스트했더니 A 모델이 더 잘했다." 특정 상황에는 유효하지만 일반화가 어렵다.

**표준화된 벤치마크:** 미리 정의된 문제 셋에 모든 모델을 동일한 조건으로 테스트. 재현 가능하고 비교 가능하다.

벤치마크의 가치는 **표준화와 재현 가능성**이다. 단, 벤치마크 점수가 실제 사용 경험과 완벽히 일치하지 않는다는 점을 항상 기억해야 한다.

## MMLU: 지식과 이해의 표준

**MMLU(Massive Multitask Language Understanding)**는 2021년 UC Berkeley에서 만든 벤치마크로, LLM 평가의 사실상 표준이 됐다.

57개 학문 분야(역사, 수학, 법률, 의학, 물리학, 컴퓨터 과학 등)에서 총 15,908개의 4지 선다형 문제를 사용한다. 문제는 초등학교 수준부터 전문가 수준까지 다양하다.

```python
# MMLU 스타일 평가 (단순화된 예시)
import anthropic

client = anthropic.Anthropic()

def evaluate_mmlu_question(question: str, choices: list, correct: str) -> bool:
    """MMLU 스타일 문제를 LLM으로 평가"""
    choices_text = "\n".join([f"{chr(65+i)}. {c}" for i, c in enumerate(choices)])
    
    prompt = f"""다음 문제에서 정답을 A, B, C, D 중 하나로만 답하세요.

문제: {question}
{choices_text}

정답 (알파벳 하나만):"""
    
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=5,
        messages=[{"role": "user", "content": prompt}]
    )
    
    predicted = response.content[0].text.strip().upper()[0]
    return predicted == correct.upper()

# 예시 실행
question = "Which sorting algorithm has the best average-case time complexity?"
choices = ["Bubble Sort", "Merge Sort", "Insertion Sort", "Selection Sort"]
result = evaluate_mmlu_question(question, choices, "B")
print(f"정답 여부: {result}")
```

MMLU 점수의 해석: 50% = 랜덤 추측 수준, 70% = 일반인 수준, 90% = 전문가 수준. GPT-4, Claude 3 Opus, Gemini Ultra 모두 85~90% 범위에 있다.

![LLM 벤치마크 유형 분류](/assets/posts/llm-comparison-benchmarks-types.svg)

## HumanEval: 코딩 능력의 표준

**HumanEval**은 OpenAI가 2021년 공개한 코딩 벤치마크다. 164개의 Python 프로그래밍 문제로 구성되며, 각 문제는 docstring(함수 설명)과 단위 테스트를 포함한다.

**pass@k 메트릭:** 모델에게 k번 코드를 생성하게 했을 때 그 중 하나라도 모든 테스트를 통과하면 성공으로 계산한다. pass@1은 1번 시도에서 성공 확률, pass@10은 10번 중 하나라도 성공할 확률이다.

```python
# HumanEval 스타일 문제 예시
def has_close_elements(numbers: list, threshold: float) -> bool:
    """
    숫자 리스트에서 두 수의 차이가 threshold 이하인 쌍이 있는지 확인한다.
    
    >>> has_close_elements([1.0, 2.0, 3.0], 0.5)
    False
    >>> has_close_elements([1.0, 2.8, 3.0, 4.0, 5.0, 2.0], 0.3)
    True
    """
    # LLM이 이 부분을 채워야 함
    for i in range(len(numbers)):
        for j in range(i + 1, len(numbers)):
            if abs(numbers[i] - numbers[j]) <= threshold:
                return True
    return False
```

HumanEval의 한계도 분명하다. 164개는 통계적으로 충분히 크지 않다. 알고리즘보다는 비교적 간단한 함수 구현 중심이다. 실제 소프트웨어 엔지니어링(버그 수정, 레거시 코드 리팩터링)과는 다르다.

## SWE-bench: 실전 소프트웨어 엔지니어링

이런 HumanEval의 한계를 극복하기 위해 등장한 것이 **SWE-bench**다. GitHub에서 실제로 발생한 이슈(버그 리포트)와 그 해결 PR(Pull Request) 2,294쌍을 수집했다.

모델은 이슈 설명을 보고, 실제 코드베이스를 탐색해, 버그를 수정하는 코드를 작성해야 한다. 이는 실제 개발 업무와 가장 유사한 벤치마크다. 단순한 함수 구현이 아니라, 대규모 코드베이스 이해 + 버그 분석 + 수정 구현까지 포함한다.

SWE-bench 결과는 HumanEval보다 훨씬 낮다. Claude 3.5 Sonnet이 약 49%, GPT-4o가 약 33% 수준(2024년 기준)이다. 이 벤치마크에서 50%를 넘기는 것이 AI 코딩 에이전트의 현재 기준점이다.

## LMSYS Chatbot Arena: 인간 선호도의 살아있는 랭킹

**LMSYS Chatbot Arena**는 UC Berkeley와 Stanford가 운영하는 라이브 평가 플랫폼이다. 사용자가 임의의 질문을 입력하면, 이름이 숨겨진 두 모델이 답을 생성한다. 사용자는 더 나은 답을 선택하거나 동점을 표시한다. 결과는 체스 ELO 시스템으로 집계돼 실시간 랭킹을 형성한다.

![LMSYS Chatbot Arena ELO 레이팅 구조](/assets/posts/llm-comparison-benchmarks-arena.svg)

Chatbot Arena의 강점은 **실제 인간 선호도**를 측정한다는 것이다. 학술 벤치마크가 놓치는 "이 모델이 실제로 사람들이 원하는 방식으로 답하는가"를 직접 측정한다.

단점도 있다. 영어 사용자가 많아 영어 성능에 편향될 수 있다. 일반 사용자의 질문이 중심이어서 전문 도메인 성능은 과소평가될 수 있다. 또한 스타일(길고 자세한 답이 좋아 보이는)에 따라 투표가 편향될 수 있다.

## MT-Bench: LLM-as-Judge

**MT-Bench**는 UC Berkeley가 개발한 대화형 벤치마크다. 8가지 카테고리(추론, 수학, 코딩, 글쓰기, 추출, 역할극, STEM, 인문학)에서 각 2턴씩, 총 80개 멀티턴 질문을 사용한다.

특이한 점은 **GPT-4가 심사위원**을 맡는다는 것이다. LLM-as-Judge 방식으로, 각 답변을 1~10점으로 평가한다. 이 접근법은 인간 평가의 확장성 문제를 해결하지만, GPT-4의 편향이 평가에 반영될 수 있다는 문제가 있다.

```python
# LLM-as-Judge 구현 예시
import anthropic

client = anthropic.Anthropic()

def llm_judge(question: str, response_a: str, response_b: str) -> dict:
    """두 LLM 응답을 GPT-4/Claude로 평가"""
    judge_prompt = f"""다음 질문에 대한 두 AI의 답변을 평가해주세요.

질문: {question}

[답변 A]
{response_a}

[답변 B]
{response_b}

평가 기준:
1. 정확성 (사실적 오류 없음)
2. 도움이 되는 정도
3. 명확성과 구조
4. 완결성

각 답변에 1-10점을 부여하고 이유를 설명하세요.
형식: {{"A": 점수, "B": 점수, "winner": "A" or "B" or "tie", "reason": "설명"}}"""
    
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": judge_prompt}]
    )
    return response.content[0].text
```

## 벤치마크 해킹: 숫자가 부풀려질 수 있다

벤치마크를 이해할 때 반드시 알아야 할 위험이 있다. **Benchmark Overfitting 또는 벤치마크 해킹**이다.

모델을 개발할 때 평가 데이터셋의 문제들로 파인튜닝하거나, 평가 데이터와 비슷한 형식의 문제를 훈련 데이터에 포함시키면 벤치마크 점수는 올라가지만 실제 일반 능력은 그만큼 향상되지 않는다. 이는 시험 족보를 암기한 것과 같다.

이 때문에 새로운 벤치마크가 계속 등장하고, 기존 벤치마크가 오염되었다는 논의가 반복된다. MMLU의 일부 문제가 훈련 데이터에 포함되었을 가능성을 연구자들이 제기하기도 했다.

## 실무에서 LLM을 올바르게 평가하는 방법

공개 벤치마크는 출발점이지, 최종 결정 기준이 아니다. 실무에서 모델을 선택할 때의 올바른 접근법은 다음과 같다.

**1단계: 태스크 정의.** 내가 풀려는 문제를 구체적으로 정의한다. "고객 지원 이메일 초안 작성", "Python 코드 버그 탐지", "법률 계약서 요약" 등.

**2단계: 골든 데이터셋 구성.** 태스크와 관련된 실제 입력 50~100개와 기대 출력(또는 평가 기준)을 준비한다.

**3단계: 자동 + 인간 평가.** 정답이 명확한 태스크는 자동 평가, 주관적인 품질은 인간 평가나 LLM-as-Judge를 사용한다.

**4단계: 비용과 속도 포함.** 성능이 비슷하다면 비용과 지연 시간이 선택의 핵심 기준이 된다.

이제 LLM의 능력과 평가 방법을 충분히 이해했다. 다음 글부터는 이 LLM들을 실제로 더 잘 사용하는 방법인 **프롬프트 엔지니어링**의 세계로 들어간다.

---

**지난 글:** [한국 LLM 완전 해부: EXAONE, HyperCLOVA X, SOLAR](/posts/llm-korean-models/)

**다음 글:** [프롬프트 엔지니어링 완전 정복: AI와 대화하는 기술](/posts/prompt-engineering/)

<br>
읽어주셔서 감사합니다. 😊
