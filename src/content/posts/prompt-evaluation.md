---
title: "프롬프트 평가: 좋은 프롬프트를 측정하는 방법"
description: "자동 지표(ROUGE·BERTScore·Exact Match), 사람 평가, LLM-as-Judge 세 가지 방법론과 그 조합 전략, 평가 파이프라인 구현, 위치 편향 제거, 실전 코드까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["프롬프트평가", "LLMasJudge", "프롬프트엔지니어링", "ROUGE", "BERTScore", "평가", "LLM", "품질관리"]
featured: false
draft: false
---

[지난 글](/posts/prompt-versioning/)에서 프롬프트를 코드처럼 버전 관리하는 방법을 다뤘다. 버전이 바뀌면 반드시 따라오는 질문이 있다. "이 프롬프트가 이전 것보다 정말 나은가?" **프롬프트 평가**는 그 질문에 데이터로 답하는 과정이다. 직관이나 체감이 아닌, 측정 가능한 지표로 프롬프트 품질을 판단해야 개선이 쌓인다.

## 무엇을 평가해야 하는가

프롬프트 평가에서 측정할 대상은 크게 세 가지다.

1. **태스크 품질**: 요약이 얼마나 정확한가, QA 답이 맞는가
2. **비기능 속성**: 레이턴시, 토큰 사용량, 비용
3. **안전성**: 유해 콘텐츠 생성 여부, 지시 준수

이 세 가지를 균형 있게 측정해야 진정한 개선이 이뤄진다. 정확도만 높이고 비용이 3배 오르거나, 비용을 줄였더니 안전성이 떨어지는 경우를 막아야 한다.

## 세 가지 평가 방법론

![프롬프트 평가 방법 비교](/assets/posts/prompt-evaluation-methods.svg)

### ① 자동 지표 (Automated Metrics)

정해진 참조 답변과 비교해 수치적으로 측정한다.

```python
from rouge_score import rouge_scorer
from bert_score import score as bert_score

def compute_rouge(reference: str, hypothesis: str) -> dict:
    """ROUGE 지표 계산 — 요약 품질에 주로 사용"""
    scorer = rouge_scorer.RougeScorer(
        ['rouge1', 'rouge2', 'rougeL'], use_stemmer=True
    )
    scores = scorer.score(reference, hypothesis)
    return {
        "rouge1": scores['rouge1'].fmeasure,
        "rouge2": scores['rouge2'].fmeasure,
        "rougeL": scores['rougeL'].fmeasure,
    }

def compute_bertscore(references: list[str], hypotheses: list[str]) -> float:
    """BERTScore — 의미적 유사도 (ROUGE보다 인간 판단과 상관 높음)"""
    _, _, f1 = bert_score(hypotheses, references, lang="ko")
    return f1.mean().item()

def exact_match(reference: str, hypothesis: str) -> float:
    """Exact Match — QA 태스크에서 정답 일치 여부"""
    return float(reference.strip().lower() == hypothesis.strip().lower())

# 평가 실행
ref = "파이썬은 1991년 귀도 반 로섬이 개발한 고수준 프로그래밍 언어입니다."
hyp = "파이썬은 귀도 반 로섬이 만든 프로그래밍 언어로 1991년에 탄생했습니다."

rouge_scores = compute_rouge(ref, hyp)
print(f"ROUGE-L: {rouge_scores['rougeL']:.3f}")  # ~0.65
```

자동 지표의 큰 단점은 **창의적이거나 열린 태스크**에 부적합하다는 점이다. 동의어를 사용해도 다른 표현이면 점수가 낮게 나온다. 코딩 과제의 경우 Exact Match보다 **실행 결과 비교**가 더 의미있다.

```python
import subprocess
import tempfile

def evaluate_code_output(
    generated_code: str,
    test_cases: list[dict],
) -> float:
    """코드를 실제 실행해 출력 비교"""
    passed = 0
    for tc in test_cases:
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
            f.write(generated_code + "\n")
            f.write(f"print({tc['call']})")
            fname = f.name

        try:
            result = subprocess.run(
                ["python3", fname],
                capture_output=True, text=True, timeout=5
            )
            actual = result.stdout.strip()
            if actual == str(tc["expected"]):
                passed += 1
        except subprocess.TimeoutExpired:
            pass

    return passed / len(test_cases) if test_cases else 0.0
```

### ② LLM-as-Judge

사람 평가를 시뮬레이션한다. Zheng et al. 2023(MT-Bench) 연구에서 GPT-4의 판단이 사람 판단과 80% 이상 일치함을 보였다.

![LLM-as-Judge 구현 패턴](/assets/posts/prompt-evaluation-judge.svg)

```python
import json
import anthropic

client = anthropic.Anthropic()

ABSOLUTE_JUDGE_PROMPT = """당신은 AI 응답 품질을 평가하는 전문가입니다.

질문:
{question}

AI 답변:
{response}

다음 기준으로 평가하세요 (각 0~10점):
1. 정확성: 사실적으로 옳은가?
2. 완성도: 질문에 충분히 답했는가?
3. 명확성: 이해하기 쉬운가?
4. 안전성: 유해하거나 편향된 내용이 없는가?

JSON 형식으로만 반환:
{{
  "scores": {{"정확성": 점수, "완성도": 점수, "명확성": 점수, "안전성": 점수}},
  "total": 평균점수,
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1"],
  "reason": "전반적 평가 한 문장"
}}"""

def judge_absolute(question: str, response: str) -> dict:
    prompt = ABSOLUTE_JUDGE_PROMPT.format(question=question, response=response)
    result = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        temperature=0,
        messages=[{"role": "user", "content": prompt}]
    )
    try:
        return json.loads(result.content[0].text)
    except json.JSONDecodeError:
        return {"total": 0, "reason": "파싱 실패"}

PAIRWISE_JUDGE_PROMPT = """질문: {question}

[답변 A]
{response_a}

[답변 B]
{response_b}

위 두 답변 중 어느 것이 더 나은지 평가하세요.
응답: "A", "B", 또는 "TIE" 중 하나만 출력하세요."""

def judge_pairwise(
    question: str,
    response_a: str,
    response_b: str,
    n_trials: int = 2,
) -> str:
    """위치 편향 제거: A/B를 바꿔서 두 번 평가"""
    results = []

    for trial in range(n_trials):
        # 홀수 trial은 순서 뒤집기
        if trial % 2 == 1:
            ra, rb = response_b, response_a
        else:
            ra, rb = response_a, response_b

        prompt = PAIRWISE_JUDGE_PROMPT.format(
            question=question, response_a=ra, response_b=rb
        )
        result = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=10,
            temperature=0,
            messages=[{"role": "user", "content": prompt}]
        )
        verdict = result.content[0].text.strip()

        # 순서 뒤집었으면 결과도 뒤집기
        if trial % 2 == 1:
            if verdict == "A":
                verdict = "B"
            elif verdict == "B":
                verdict = "A"
        results.append(verdict)

    # 두 번 모두 같은 결과면 확정, 다르면 TIE
    if len(set(results)) == 1:
        return results[0]
    return "TIE"
```

### ③ 평가 파이프라인 통합

```python
from dataclasses import dataclass, field
from typing import Callable
import time

@dataclass
class EvalResult:
    prompt_version: str
    question: str
    response: str
    rouge_l: float = 0.0
    bertscore: float = 0.0
    judge_score: float = 0.0
    latency_ms: float = 0.0
    tokens_used: int = 0
    cost_usd: float = 0.0

def run_evaluation_suite(
    test_cases: list[dict],
    prompt_fn: Callable[[str], str],
    version: str,
    reference_answers: list[str] | None = None,
) -> list[EvalResult]:
    """종합 평가 파이프라인"""
    results = []

    for i, tc in enumerate(test_cases):
        start = time.time()
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt_fn(tc["question"])}]
        )
        latency_ms = (time.time() - start) * 1000
        answer = response.content[0].text

        result = EvalResult(
            prompt_version=version,
            question=tc["question"],
            response=answer,
            latency_ms=latency_ms,
            tokens_used=response.usage.output_tokens,
            cost_usd=response.usage.output_tokens * 0.000015,  # claude-opus 기준
        )

        # 참조 답변 있으면 자동 지표
        if reference_answers and i < len(reference_answers):
            rouge = compute_rouge(reference_answers[i], answer)
            result.rouge_l = rouge["rougeL"]

        # LLM-as-Judge
        judge = judge_absolute(tc["question"], answer)
        result.judge_score = judge.get("total", 0)

        results.append(result)

    return results

def compare_versions(results_a: list[EvalResult], results_b: list[EvalResult]) -> dict:
    """두 버전의 지표 비교"""
    def avg(lst, attr): return sum(getattr(r, attr) for r in lst) / len(lst)

    return {
        "version_a": results_a[0].prompt_version,
        "version_b": results_b[0].prompt_version,
        "rouge_l": {"a": avg(results_a, "rouge_l"), "b": avg(results_b, "rouge_l")},
        "judge_score": {"a": avg(results_a, "judge_score"), "b": avg(results_b, "judge_score")},
        "latency_ms": {"a": avg(results_a, "latency_ms"), "b": avg(results_b, "latency_ms")},
        "cost_usd": {"a": sum(r.cost_usd for r in results_a), "b": sum(r.cost_usd for r in results_b)},
    }
```

## 평가 설계의 함정

**과적합 주의**: 평가 셋에 맞춰 프롬프트를 최적화하면, 실제 사용자 쿼리에서는 오히려 성능이 떨어질 수 있다. 평가 셋은 실제 트래픽을 대표해야 한다.

**지표 해킹**: ROUGE를 최대화하려고 참조 텍스트를 그대로 반복하는 프롬프트가 나올 수 있다. 여러 지표를 함께 보고, 정성적 검토도 병행해야 한다.

**분포 드리프트**: 사용자 질문 패턴은 시간이 지나면 바뀐다. 평가 셋도 주기적으로 갱신해야 한다.

프롬프트 평가는 한 번에 끝나지 않는다. 버전이 바뀔 때마다, 모델이 업그레이드될 때마다, 사용자 피드백이 쌓일 때마다 반복해서 수행해야 한다. 자동화된 평가 파이프라인을 CI/CD에 연결해 **모든 프롬프트 변경에 자동으로 평가를 실행**하는 것이 성숙한 LLM 운영(LLMOps)의 시작점이다.

---

**지난 글:** [프롬프트 버전 관리: 프롬프트를 코드처럼 관리하기](/posts/prompt-versioning/)

<br>
읽어주셔서 감사합니다. 😊
