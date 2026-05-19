---
title: "에이전트 리플렉션: 자기 평가와 반복 개선 패턴"
description: "AI 에이전트의 리플렉션 패턴(Self-Reflection, Multi-Agent Critic, Self-Debug)과 LangGraph 기반 Generator-Critic-Reviser 구현을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["에이전트리플렉션", "Critic", "Generator", "Self-Debug", "LangGraph", "품질개선", "반복최적화"]
featured: false
draft: false
---

[지난 글](/posts/agent-planning/)에서 ReAct, Plan-and-Execute 등 에이전트 플래닝 전략을 살펴봤다. 이번 글에서는 에이전트가 **자신의 출력물을 평가하고 반복적으로 개선**하는 리플렉션 패턴을 다룬다. 리플렉션은 단순한 계획 실행을 넘어 에이전트가 품질을 스스로 보장하게 한다.

## 리플렉션이란

리플렉션은 에이전트가 **자신의 결과를 평가하고 개선점을 도출해 다시 시도**하는 자기 개선 루프다. 인간이 초안을 작성하고 검토·수정하는 과정과 동일하다.

기본 구조:
1. **Generator**: 초안 생성 (일반 도구 사용 에이전트)
2. **Critic**: 초안 평가, 점수화, 개선점 도출
3. **Reviser**: Critic 피드백으로 개선된 버전 생성
4. **반복**: Critic이 품질 기준을 충족할 때까지 2-3 반복

![에이전트 리플렉션 루프](/assets/posts/agent-reflection-loop.svg)

## 기본 Self-Reflection 구현

가장 단순한 형태: 하나의 LLM이 생성과 평가를 모두 담당한다.

```python
from anthropic import Anthropic
from typing import Optional
import json

client = Anthropic()

def self_reflect_and_improve(
    task: str,
    max_iterations: int = 3,
    quality_threshold: float = 8.0,
) -> str:
    """Self-Reflection: 생성 → 자기 평가 → 개선 루프"""
    current_draft = ""
    history = []

    for iteration in range(max_iterations):
        # 1. 생성 (초기 또는 개선)
        if iteration == 0:
            gen_prompt = f"다음 태스크를 수행하세요:\n\n{task}"
        else:
            feedback_str = "\n".join(f"- {f}" for f in history[-1]["issues"])
            gen_prompt = f"""태스크: {task}

이전 버전:
{current_draft}

개선이 필요한 점:
{feedback_str}

위 피드백을 반영해 개선된 버전을 작성하세요."""

        gen_response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": gen_prompt}],
        )
        current_draft = gen_response.content[0].text

        # 2. 자기 평가
        eval_prompt = f"""당신은 엄격한 품질 검토관입니다.
다음 결과물을 평가하고 JSON으로 반환하세요.

태스크: {task}

결과물:
{current_draft}

평가 기준 (각 0-10점):
- accuracy: 정확성·사실 오류 없음
- completeness: 태스크 요구사항 충족도
- clarity: 명확성·가독성
- quality: 전반적 품질

JSON 형식:
{{
  "scores": {{"accuracy": X, "completeness": X, "clarity": X, "quality": X}},
  "overall": X.X,
  "issues": ["문제점1", "문제점2"],
  "approved": true/false
}}"""

        eval_response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=[{"role": "user", "content": eval_prompt}],
        )

        try:
            # JSON 파싱 (```json 블록 제거)
            eval_text = eval_response.content[0].text
            if "```json" in eval_text:
                eval_text = eval_text.split("```json")[1].split("```")[0]
            evaluation = json.loads(eval_text.strip())
        except Exception:
            evaluation = {"overall": 5.0, "issues": ["평가 파싱 실패"], "approved": False}

        overall_score = evaluation.get("overall", 0)
        history.append(evaluation)

        print(f"반복 {iteration + 1}: 점수 {overall_score:.1f}/10.0")

        if overall_score >= quality_threshold or evaluation.get("approved"):
            print(f"✅ 품질 기준 충족 (점수: {overall_score:.1f})")
            break
        elif iteration < max_iterations - 1:
            issues = evaluation.get("issues", [])
            print(f"  개선 필요: {', '.join(issues[:2])}")

    return current_draft

result = self_reflect_and_improve(
    task="Python 데코레이터를 초보자도 이해하기 쉽게 설명하고, 실용적인 예제를 2개 포함하세요.",
    max_iterations=3,
    quality_threshold=8.5,
)
print("\n최종 결과:\n", result[:500])
```

## Multi-Agent Reflection: Generator + Critic 분리

Critic을 별도 LLM으로 분리하면 더 객관적인 평가가 가능하다.

![Critic 평가 기준과 점수화](/assets/posts/agent-reflection-critic.svg)

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, Optional
import operator

class ReflectionState(TypedDict):
    task: str
    draft: str
    feedback: Optional[dict]
    revision_history: Annotated[list[str], operator.add]
    score: float
    iteration: int
    approved: bool

# Generator 노드
def generator_node(state: ReflectionState) -> dict:
    """초안 생성 또는 피드백 기반 수정"""
    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import HumanMessage, SystemMessage

    llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0.7)

    if state.get("feedback") and state["iteration"] > 0:
        issues = state["feedback"].get("issues", [])
        issues_str = "\n".join(f"- {issue}" for issue in issues)
        prompt = f"""태스크: {state['task']}

이전 버전:
{state['draft']}

Critic의 피드백:
{issues_str}

피드백을 모두 반영해 개선된 버전을 작성하세요."""
    else:
        prompt = f"다음 태스크를 수행하세요:\n\n{state['task']}"

    response = llm.invoke([HumanMessage(content=prompt)])
    return {
        "draft": response.content,
        "revision_history": [response.content],
        "iteration": state.get("iteration", 0) + 1,
    }

# Critic 노드
def critic_node(state: ReflectionState) -> dict:
    """초안 평가 및 피드백 생성"""
    from langchain_anthropic import ChatAnthropic
    from langchain_core.messages import HumanMessage
    import json

    critic_llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0)

    critic_prompt = f"""당신은 엄격한 콘텐츠 품질 관리자입니다.
다음 결과물을 평가하세요.

태스크: {state['task']}

결과물:
{state['draft']}

다음 기준으로 0-10점 평가 후 JSON 반환:
- accuracy: 사실 정확성
- completeness: 요구사항 완성도
- readability: 가독성
- examples: 예제 품질 (없으면 0)

{{
  "scores": {{"accuracy": X, "completeness": X, "readability": X, "examples": X}},
  "overall": X.X,
  "issues": ["개선 필요한 구체적 항목들"],
  "approved": true/false
}}

overall이 8.5 이상이면 approved: true."""

    response = critic_llm.invoke([HumanMessage(content=critic_prompt)])
    try:
        text = response.content
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        feedback = json.loads(text.strip())
    except Exception:
        feedback = {"overall": 6.0, "issues": ["평가 실패"], "approved": False}

    return {
        "feedback": feedback,
        "score": feedback.get("overall", 0),
        "approved": feedback.get("approved", False),
    }

# 조건부 엣지
def should_revise(state: ReflectionState) -> str:
    if state.get("approved"):
        return "done"
    if state.get("iteration", 0) >= 4:  # 최대 4회
        return "done"
    return "revise"

# 그래프 구성
reflection_graph = StateGraph(ReflectionState)
reflection_graph.add_node("generate", generator_node)
reflection_graph.add_node("critique", critic_node)

reflection_graph.set_entry_point("generate")
reflection_graph.add_edge("generate", "critique")
reflection_graph.add_conditional_edges(
    "critique",
    should_revise,
    {"revise": "generate", "done": END},
)

reflection_app = reflection_graph.compile()

# 실행
result = reflection_app.invoke({
    "task": "Big-O 표기법을 Python 개발자를 위해 설명하고, 리스트 조작의 시간 복잡도 예제를 포함하세요.",
    "draft": "", "feedback": None, "revision_history": [],
    "score": 0.0, "iteration": 0, "approved": False,
})

print(f"최종 점수: {result['score']:.1f}")
print(f"총 반복 수: {result['iteration']}")
print(f"\n최종 결과:\n{result['draft'][:400]}...")
```

## Self-Debug: 코드 생성·실행·디버깅 루프

```python
import subprocess
import sys
import tempfile
import os

def self_debug_code(task: str, max_attempts: int = 5) -> dict:
    """코드 생성 → 실행 → 오류 디버깅 자동화"""
    code = ""
    errors = []

    for attempt in range(max_attempts):
        # 코드 생성
        if attempt == 0:
            prompt = f"""다음을 수행하는 Python 코드를 작성하세요:
{task}

코드만 반환하세요 (설명 없이, ```python 없이)."""
        else:
            error_str = "\n".join(errors[-3:])  # 최근 3개 오류만
            prompt = f"""다음 코드에서 오류가 발생했습니다:

코드:
{code}

오류 메시지:
{error_str}

오류를 수정한 코드를 반환하세요 (코드만, 설명 없이)."""

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        code = response.content[0].text.strip()
        if code.startswith("```"):
            code = "\n".join(code.split("\n")[1:-1])

        # 코드 실행
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            temp_path = f.name

        try:
            result = subprocess.run(
                [sys.executable, temp_path],
                capture_output=True, text=True, timeout=10,
            )
            os.unlink(temp_path)

            if result.returncode == 0:
                return {
                    "success": True,
                    "code": code,
                    "output": result.stdout,
                    "attempts": attempt + 1,
                }
            else:
                errors.append(result.stderr[:500])
                print(f"시도 {attempt + 1} 실패: {result.stderr[:100]}")
        except subprocess.TimeoutExpired:
            errors.append("실행 시간 초과 (10초)")
            os.unlink(temp_path)

    return {"success": False, "code": code, "attempts": max_attempts}

result = self_debug_code(
    "1부터 100까지 소수를 구하는 에라토스테네스의 체 알고리즘을 구현하고 출력하세요."
)
if result["success"]:
    print(f"✅ 성공 ({result['attempts']}회 시도)")
    print(result["output"])
```

## 리플렉션 패턴 선택 가이드

| 패턴 | 사용 사례 | 오버헤드 |
|------|-----------|---------|
| Self-Reflection | 단순 글쓰기, 요약 | 낮음 (LLM 2배 호출) |
| Multi-Agent Critic | 고품질 콘텐츠 생성 | 중간 (별도 Critic) |
| Self-Debug | 코드 생성·실행 | 중간 (실행 환경 필요) |
| Reflexion | 복잡한 추론·계획 | 높음 (메모리 + 다중 시도) |

## 정리

리플렉션은 에이전트가 **한 번의 시도로 끝나지 않고, 스스로 품질을 보장**하게 한다:

- **Self-Reflection**: 동일 LLM이 생성과 평가를 담당, 구현 단순
- **Multi-Agent Critic**: Generator와 Critic을 분리해 더 객관적인 평가
- **구조화 피드백**: JSON 스키마로 점수와 이슈를 수치화해 자동 종료 조건 설정
- **Self-Debug**: 코드 실행 오류를 자동으로 감지하고 수정하는 루프
- **LangGraph 통합**: `generate → critique → [revise/done]` 조건부 그래프로 자연스럽게 표현

리플렉션의 핵심은 **명확한 평가 기준과 종료 조건**이다. 임계값 없이 무한 반복하면 비용과 시간이 낭비된다.

---

**지난 글:** [에이전트 플래닝: ReAct, Plan-and-Execute, Reflexion 전략](/posts/agent-planning/)

**다음 글:** [에이전트 평가: 성능 측정과 벤치마킹 방법론](/posts/agent-evaluation/)

<br>
읽어주셔서 감사합니다. 😊
