---
title: "에이전트 평가: 성능 측정과 벤치마킹 방법론"
description: "AI 에이전트의 Task Success Rate, Trajectory Quality, LLM-as-Judge, 비용 평가와 LangSmith 기반 자동화 평가 파이프라인을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["에이전트평가", "LLM-as-Judge", "LangSmith", "벤치마킹", "Task Success Rate", "TrajectoryEval"]
featured: false
draft: false
---

[지난 글](/posts/agent-reflection/)에서 에이전트가 자신의 결과를 개선하는 리플렉션 패턴을 살펴봤다. 이번 글에서는 **에이전트 시스템 전체의 성능을 어떻게 측정하고 개선하는지**, 즉 평가 방법론을 다룬다. "좋은 에이전트"를 수치로 표현하지 못하면 개선 방향을 잡기 어렵다.

## 왜 에이전트 평가가 어려운가

에이전트 평가는 일반 LLM 평가보다 훨씬 복잡하다:

- **비결정적 실행**: 같은 입력에도 매번 다른 도구 호출 순서와 결과
- **중간 과정 평가**: 최종 답 외에 도구 선택·순서·횟수도 중요
- **장기 지평**: 수십 스텝에 걸친 목표 달성 여부
- **비용 고려**: 정확성과 비용의 트레이드오프

![에이전트 평가 프레임워크](/assets/posts/agent-evaluation-framework.svg)

## ① Task Success Rate: 태스크 성공률

```python
from typing import Callable, Any
import time
import json
from anthropic import Anthropic

client = Anthropic()

# 평가 데이터셋 구조
EVAL_DATASET = [
    {
        "id": "math-001",
        "input": "23의 피보나치 수를 구하세요",
        "expected": "28657",
        "category": "math",
    },
    {
        "id": "code-001",
        "input": "Python으로 버블 정렬을 구현하고 [3,1,4,1,5]를 정렬하세요",
        "expected": "[1, 1, 3, 4, 5]",
        "category": "code",
    },
    {
        "id": "qa-001",
        "input": "LangGraph와 LangChain의 핵심 차이점은?",
        "expected": None,  # 정답 없음 → LLM 평가 필요
        "category": "open_qa",
    },
]

def exact_match_evaluator(expected: str, actual: str) -> bool:
    """정확히 일치하는지 확인"""
    return expected.strip().lower() in actual.lower()

def contains_evaluator(expected: str, actual: str) -> bool:
    """정답이 포함되어 있는지 확인"""
    return expected.strip() in actual

def run_evaluation(
    agent_fn: Callable[[str], str],
    dataset: list[dict],
    evaluators: dict[str, Callable],
) -> dict:
    """에이전트 평가 실행"""
    results = []
    total_tokens = 0
    total_time = 0

    for item in dataset:
        start = time.time()
        try:
            output = agent_fn(item["input"])
            success = False
            if item.get("expected"):
                evaluator = evaluators.get(item["category"], exact_match_evaluator)
                success = evaluator(item["expected"], output)
            elapsed = time.time() - start

            results.append({
                "id": item["id"],
                "category": item["category"],
                "success": success,
                "output": output[:200],
                "latency_sec": elapsed,
            })
        except Exception as e:
            results.append({
                "id": item["id"],
                "category": item["category"],
                "success": False,
                "error": str(e),
                "latency_sec": time.time() - start,
            })

    # 집계
    total = len(results)
    successes = sum(1 for r in results if r.get("success"))
    avg_latency = sum(r.get("latency_sec", 0) for r in results) / total

    return {
        "total_tasks": total,
        "success_rate": successes / total * 100,
        "avg_latency_sec": avg_latency,
        "by_category": {
            cat: {
                "success_rate": sum(1 for r in results
                                    if r["category"] == cat and r.get("success")) /
                                max(1, sum(1 for r in results if r["category"] == cat)) * 100
            }
            for cat in set(r["category"] for r in results)
        },
        "results": results,
    }
```

## ② Trajectory Quality: 과정 평가

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class ToolCall:
    tool_name: str
    tool_input: dict
    tool_output: str
    timestamp: float

@dataclass
class AgentTrajectory:
    task: str
    tool_calls: list[ToolCall]
    final_answer: str
    success: bool
    total_tokens: int

def evaluate_trajectory(trajectory: AgentTrajectory, optimal_steps: int) -> dict:
    """에이전트 실행 경로의 효율성 평가"""
    actual_steps = len(trajectory.tool_calls)

    # 도구 선택 분포
    tool_usage = {}
    for call in trajectory.tool_calls:
        tool_usage[call.tool_name] = tool_usage.get(call.tool_name, 0) + 1

    # 중복 호출 감지 (동일 도구+입력 반복)
    seen_calls = set()
    redundant_calls = 0
    for call in trajectory.tool_calls:
        key = f"{call.tool_name}:{json.dumps(call.tool_input, sort_keys=True)}"
        if key in seen_calls:
            redundant_calls += 1
        seen_calls.add(key)

    efficiency_ratio = optimal_steps / max(1, actual_steps)

    return {
        "actual_steps": actual_steps,
        "optimal_steps": optimal_steps,
        "efficiency_ratio": min(1.0, efficiency_ratio),
        "redundant_calls": redundant_calls,
        "tool_usage": tool_usage,
        "step_score": max(0, 1 - (actual_steps - optimal_steps) / max(1, optimal_steps)),
    }

# 실제 사용 예시
def instrument_agent(agent_executor, task: str) -> AgentTrajectory:
    """에이전트 실행을 인스트루멘테이션해 트레이스 수집"""
    tool_calls = []

    # LangChain 콜백으로 도구 호출 추적
    from langchain_core.callbacks import BaseCallbackHandler

    class TrajectoryCollector(BaseCallbackHandler):
        def on_tool_start(self, serialized, input_str, **kwargs):
            self._start_time = time.time()
            self._tool_name = serialized.get("name", "unknown")
            self._tool_input = input_str

        def on_tool_end(self, output, **kwargs):
            tool_calls.append(ToolCall(
                tool_name=self._tool_name,
                tool_input={"input": self._tool_input},
                tool_output=str(output)[:200],
                timestamp=time.time() - self._start_time,
            ))

    collector = TrajectoryCollector()
    result = agent_executor.invoke(
        {"input": task},
        config={"callbacks": [collector]},
    )

    return AgentTrajectory(
        task=task,
        tool_calls=tool_calls,
        final_answer=result.get("output", ""),
        success=True,
        total_tokens=0,
    )
```

## ③ LLM-as-Judge: AI 평가자

정답이 없는 열린 질문은 강력한 LLM이 평가한다.

![LangSmith 평가 파이프라인](/assets/posts/agent-evaluation-tools.svg)

```python
from anthropic import Anthropic

judge_client = Anthropic()

def llm_judge_evaluate(
    question: str,
    agent_answer: str,
    reference_answer: Optional[str] = None,
    rubric: Optional[str] = None,
) -> dict:
    """LLM-as-Judge 평가"""

    if reference_answer:
        prompt = f"""당신은 AI 시스템 평가 전문가입니다.
아래 에이전트 응답을 레퍼런스 답변과 비교 평가하세요.

질문: {question}

레퍼런스 답변:
{reference_answer}

에이전트 답변:
{agent_answer}

다음 기준으로 1-5점 평가:
1점: 완전히 틀림/관련없음
3점: 부분적으로 정확
5점: 레퍼런스와 동등하거나 더 나음

JSON 반환: {{"score": X, "reasoning": "평가 이유", "approved": true/false}}
approved: score >= 4이면 true"""

    else:
        rubric_text = rubric or "정확성, 완결성, 명확성"
        prompt = f"""당신은 AI 평가 전문가입니다.

질문: {question}

에이전트 답변:
{agent_answer}

평가 기준: {rubric_text}

1-5점으로 평가하고 JSON 반환:
{{"score": X, "reasoning": "이유", "strengths": ["강점"], "weaknesses": ["약점"]}}"""

    response = judge_client.messages.create(
        model="claude-opus-4-7",  # 강력한 모델을 Judge로
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        text = response.content[0].text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        return json.loads(text.strip())
    except Exception:
        return {"score": 3, "reasoning": "파싱 실패"}

# 쌍비교 (Pairwise): 어느 에이전트가 더 나은가
def pairwise_comparison(
    question: str,
    answer_a: str,
    answer_b: str,
) -> dict:
    """두 에이전트 응답을 직접 비교"""
    prompt = f"""다음 두 AI 응답을 비교하고 어느 쪽이 더 나은지 판단하세요.

질문: {question}

응답 A:
{answer_a}

응답 B:
{answer_b}

JSON 반환: {{"winner": "A" or "B" or "tie", "reasoning": "이유", "scores": {{"A": X, "B": X}}}}"""

    response = judge_client.messages.create(
        model="claude-opus-4-7",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        text = response.content[0].text
        if "```" in text:
            text = text.split("```json")[1].split("```")[0] if "```json" in text else text
        return json.loads(text.strip())
    except Exception:
        return {"winner": "tie", "reasoning": "파싱 실패"}
```

## LangSmith 통합 평가

```python
from langsmith import Client, evaluate
from langsmith.evaluation import LangChainStringEvaluator
import os

os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls__..."

ls_client = Client()

# 1. 데이터셋 생성
dataset = ls_client.create_dataset(
    "agent-benchmark-v1",
    description="에이전트 성능 벤치마크",
)
examples = [
    {"inputs": {"question": "서울의 인구는?"}, "outputs": {"answer": "약 960만 명"}},
    {"inputs": {"question": "Python list comprehension 예제"}, "outputs": {"answer": "[x**2 for x in range(10)]"}},
]
ls_client.create_examples(inputs=[e["inputs"] for e in examples],
                           outputs=[e["outputs"] for e in examples],
                           dataset_id=dataset.id)

# 2. 커스텀 평가자
def correctness_evaluator(run, example) -> dict:
    """정답 포함 여부 평가"""
    output = run.outputs.get("answer", "")
    expected = example.outputs.get("answer", "")
    score = 1.0 if expected.lower() in output.lower() else 0.0
    return {"key": "correctness", "score": score}

def trajectory_evaluator(run, example) -> dict:
    """도구 호출 수 평가 (적을수록 좋음)"""
    tool_calls = len(run.child_runs)
    score = max(0, 1 - (tool_calls - 1) * 0.1)  # 최적=1, 각 추가 호출마다 -0.1
    return {"key": "tool_efficiency", "score": score}

# 3. 평가 실행
def agent_wrapper(inputs: dict) -> dict:
    result = executor.invoke({"input": inputs["question"]})
    return {"answer": result["output"]}

results = evaluate(
    agent_wrapper,
    data="agent-benchmark-v1",
    evaluators=[correctness_evaluator, trajectory_evaluator],
    experiment_prefix="claude-sonnet-4-6",
    max_concurrency=5,
    num_repetitions=3,  # 3회 반복해 분산 측정
)
print(f"평균 정확도: {results.aggregate_feedback['correctness']:.2%}")
print(f"평균 도구 효율: {results.aggregate_feedback['tool_efficiency']:.2f}")
```

## 평가 메트릭 종합 대시보드

```python
def compute_agent_scorecard(
    eval_results: dict,
    trajectory_results: list[dict],
    judge_scores: list[dict],
    cost_data: dict,
) -> dict:
    """에이전트 성적표 종합"""

    # 가중 종합 점수
    task_success = eval_results.get("success_rate", 0) / 100
    traj_efficiency = sum(t.get("efficiency_ratio", 0) for t in trajectory_results) / max(1, len(trajectory_results))
    llm_quality = sum(j.get("score", 0) for j in judge_scores) / max(5, len(judge_scores))
    cost_penalty = min(1.0, cost_data.get("cost_per_task_usd", 0) * 10)

    composite_score = (
        0.40 * task_success
        + 0.20 * traj_efficiency
        + 0.30 * llm_quality
        - 0.10 * cost_penalty
    )

    return {
        "composite_score": round(composite_score * 100, 1),
        "breakdown": {
            "task_success_rate": f"{task_success * 100:.1f}%",
            "trajectory_efficiency": f"{traj_efficiency * 100:.1f}%",
            "llm_judge_avg": f"{llm_quality:.1f}/5.0",
            "cost_per_task": f"${cost_data.get('cost_per_task_usd', 0):.4f}",
        },
        "grade": "A" if composite_score > 0.85 else "B" if composite_score > 0.70 else "C",
    }
```

## 정리

에이전트 평가는 **단일 메트릭이 아닌 다차원 측정**이 필수다:

- **Task Success Rate**: 최종 결과의 정확성, 가장 직관적인 지표
- **Trajectory Quality**: 도구 선택의 효율성, 불필요한 루프 감지
- **LLM-as-Judge**: 열린 질문의 품질 평가, 레퍼런스 비교와 절대 점수 두 방식
- **비용·레이턴시**: 정확성과 비용의 트레이드오프, 프로덕션 배포 기준
- **LangSmith**: 데이터셋·실행·평가·대시보드를 통합한 자동화 파이프라인

평가 없이 개선할 수 없다. 에이전트 개발 초기부터 평가 파이프라인을 함께 구축하는 것이 핵심이다.

---

**지난 글:** [에이전트 리플렉션: 자기 평가와 반복 개선 패턴](/posts/agent-reflection/)

**다음 글:** [에이전트 안티패턴: 흔한 실수와 피해야 할 설계](/posts/agent-anti-patterns/)

<br>
읽어주셔서 감사합니다. 😊
