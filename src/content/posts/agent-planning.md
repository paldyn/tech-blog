---
title: "에이전트 플래닝: ReAct, Plan-and-Execute, Reflexion 전략"
description: "AI 에이전트의 핵심 플래닝 전략인 ReAct, Plan-and-Execute, Reflexion, LATS(MCTS)를 비교하고 LangGraph로 구현하는 방법을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["에이전트플래닝", "ReAct", "Plan-and-Execute", "Reflexion", "LATS", "LangGraph", "에이전트전략"]
featured: false
draft: false
---

[지난 글](/posts/agent-memory/)에서 에이전트의 메모리 아키텍처를 살펴봤다. 이번 글에서는 에이전트가 **어떻게 계획을 세우고 실행하는지**, 즉 플래닝 전략을 다룬다. 플래닝은 에이전트 성능의 핵심이며, 같은 LLM을 사용하더라도 전략에 따라 복잡한 태스크 성공률이 크게 달라진다.

## 플래닝이란

에이전트 플래닝은 목표를 달성하기 위해 **어떤 행동을 어떤 순서로 취할지 결정**하는 과정이다. 단순한 질의응답과 달리, 다단계 태스크에서는 계획 수립, 실행, 관찰, 수정의 반복이 필요하다.

![에이전트 플래닝 전략 비교](/assets/posts/agent-planning-strategies.svg)

## ReAct: 가장 널리 사용되는 패턴

ReAct(Reasoning + Acting)는 **추론(Thought) → 행동(Action) → 관찰(Observation)** 루프를 반복한다. 2022년 논문에서 제안된 이후 대부분의 에이전트 구현의 기본이 되었다.

![ReAct 에이전트 실행 트레이스](/assets/posts/agent-planning-react.svg)

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool
from langchain.agents import create_react_agent, AgentExecutor
from langchain import hub

llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0)

@tool
def web_search(query: str) -> str:
    """웹에서 정보를 검색합니다."""
    return f"'{query}' 검색 결과: 관련 정보..."

@tool
def calculator(expression: str) -> str:
    """수학 표현식을 계산합니다."""
    import ast
    try:
        return str(ast.literal_eval(expression))
    except Exception as e:
        return f"계산 오류: {e}"

@tool
def get_weather(city: str) -> str:
    """도시의 현재 날씨를 반환합니다."""
    weather = {"서울": "23°C, 맑음", "부산": "25°C, 구름"}
    return weather.get(city, "데이터 없음")

tools = [web_search, calculator, get_weather]

# ReAct 프롬프트 (허브에서 로드)
prompt = hub.pull("hwchase17/react")
# 또는 직접 정의:
from langchain_core.prompts import PromptTemplate
react_prompt = PromptTemplate.from_template("""
당신은 도구를 사용해 질문에 답하는 AI입니다.

사용 가능한 도구:
{tools}

도구 이름 목록: {tool_names}

형식:
Thought: 현재 상황과 다음 행동 추론
Action: 도구 이름
Action Input: 도구 입력값
Observation: 도구 결과 (자동 채움)
... (필요한 만큼 반복)
Thought: 모든 정보가 있다. 답변 가능하다.
Final Answer: 최종 답변

질문: {input}
{agent_scratchpad}
""")

agent = create_react_agent(llm, tools, react_prompt)
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    max_iterations=10,
    handle_parsing_errors=True,
    return_intermediate_steps=True,
)

result = executor.invoke({
    "input": "서울의 현재 기온을 섭씨로 알려주고, 그 수치를 화씨로 변환해줘"
})
print("최종 답변:", result["output"])

# 중간 단계 (Thought/Action/Obs) 확인
for step in result["intermediate_steps"]:
    action, observation = step
    print(f"Action: {action.tool}({action.tool_input})")
    print(f"Obs: {observation}\n")
```

## Plan-and-Execute: 장기 플래닝

ReAct는 즉흥적(reactive)이다. 복잡한 멀티 스텝 태스크에서는 **먼저 전체 계획을 세운 후 실행**하는 Plan-and-Execute 패턴이 더 적합하다.

```python
from langchain_core.pydantic_v1 import BaseModel, Field
from typing import List
import json

# 1. Planner: 서브태스크 목록 생성
class Plan(BaseModel):
    steps: List[str] = Field(description="순서 있는 실행 단계 목록")

from langchain_core.output_parsers import JsonOutputParser

planner_prompt = """다음 태스크를 실행 가능한 단계별 계획으로 분해하세요.
각 단계는 단일 행동이어야 합니다.

태스크: {task}

JSON 형식으로 반환: {{"steps": ["단계1", "단계2", ...]}}"""

def create_plan(task: str) -> list[str]:
    response = llm.invoke(planner_prompt.format(task=task))
    try:
        plan_data = json.loads(response.content)
        return plan_data["steps"]
    except Exception:
        return [task]  # 파싱 실패 시 단일 단계

# 2. Executor: 각 단계 실행
def execute_step(step: str, context: str = "") -> str:
    prompt = f"""이전 실행 결과:
{context}

현재 실행할 단계: {step}

도구를 사용해 이 단계를 실행하고 결과를 반환하세요."""
    result = executor.invoke({"input": prompt})
    return result["output"]

# 3. Plan-and-Execute 워크플로우
def plan_and_execute(task: str) -> str:
    print(f"태스크: {task}\n")
    steps = create_plan(task)
    print(f"계획 ({len(steps)}단계):")
    for i, step in enumerate(steps, 1):
        print(f"  {i}. {step}")
    print()

    context = ""
    for i, step in enumerate(steps, 1):
        print(f"[단계 {i}/{len(steps)}] {step}")
        result = execute_step(step, context)
        context += f"\n단계 {i} 결과: {result}"
        print(f"  결과: {result[:100]}...\n")

    # 최종 합성
    final_prompt = f"""태스크: {task}\n\n실행 결과:\n{context}\n\n위 결과를 종합해 최종 답변을 작성하세요."""
    final = llm.invoke(final_prompt)
    return final.content

result = plan_and_execute(
    "2024년 한국 AI 스타트업 투자 현황을 조사하고, 주요 5개사를 정리해서 마크다운 표로 만들어줘"
)
print(result)
```

## Reflexion: 자기 반성으로 개선

Reflexion은 실패 후 **자신의 행동을 반성하고 개선된 전략으로 재시도**한다.

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

class ReflexionState(TypedDict):
    task: str
    attempts: Annotated[list[str], operator.add]
    reflections: Annotated[list[str], operator.add]
    current_result: str
    success: bool
    iteration: int

def attempt_node(state: ReflexionState) -> dict:
    """태스크 실행 시도"""
    # 이전 반성이 있으면 프롬프트에 포함
    reflection_context = ""
    if state["reflections"]:
        reflection_context = f"\n\n이전 시도의 반성:\n" + "\n".join(
            f"- {r}" for r in state["reflections"]
        )

    prompt = f"""태스크: {state['task']}{reflection_context}

위 태스크를 최선을 다해 수행하세요."""

    result = llm.invoke(prompt)
    return {
        "attempts": [result.content],
        "current_result": result.content,
        "iteration": state.get("iteration", 0) + 1,
    }

def evaluate_node(state: ReflexionState) -> dict:
    """결과 평가: 성공 여부 판단"""
    eval_prompt = f"""태스크: {state['task']}

시도 결과:
{state['current_result']}

이 결과가 태스크를 완전히 해결했나요?
성공하면 "SUCCESS", 실패하면 실패 이유를 JSON으로 반환하세요.
{{"success": true}} 또는 {{"success": false, "reason": "이유"}}"""

    eval_result = llm.invoke(eval_prompt)
    try:
        data = json.loads(eval_result.content)
        return {"success": data.get("success", False)}
    except Exception:
        return {"success": False}

def reflect_node(state: ReflexionState) -> dict:
    """실패 원인 분석 및 개선 방향 도출"""
    reflect_prompt = f"""태스크: {state['task']}

실패한 시도:
{state['current_result']}

이 시도가 왜 실패했는지 분석하고, 다음 시도에서 개선할 점을 간결하게 설명하세요."""

    reflection = llm.invoke(reflect_prompt)
    return {"reflections": [reflection.content]}

def should_continue(state: ReflexionState) -> str:
    if state.get("success"):
        return "done"
    if state.get("iteration", 0) >= 3:  # 최대 3회 시도
        return "done"
    return "retry"

reflexion_graph = StateGraph(ReflexionState)
reflexion_graph.add_node("attempt", attempt_node)
reflexion_graph.add_node("evaluate", evaluate_node)
reflexion_graph.add_node("reflect", reflect_node)

reflexion_graph.set_entry_point("attempt")
reflexion_graph.add_edge("attempt", "evaluate")
reflexion_graph.add_conditional_edges(
    "evaluate",
    should_continue,
    {"retry": "reflect", "done": END},
)
reflexion_graph.add_edge("reflect", "attempt")

reflexion_app = reflexion_graph.compile()

result = reflexion_app.invoke({
    "task": "피타고라스 정리를 증명하는 Python 코드를 작성하고 테스트하세요",
    "attempts": [], "reflections": [], "current_result": "",
    "success": False, "iteration": 0,
})
print(f"최종 결과 (시도 {result['iteration']}회):")
print(result["current_result"])
```

## 플래닝 전략 선택 가이드

```python
# 전략 선택 기준 (의사 결정 트리)

def choose_planning_strategy(task_description: str) -> str:
    # 판단 기준
    is_simple = len(task_description) < 100
    requires_long_plan = any(kw in task_description
                             for kw in ["단계별", "순서대로", "먼저", "그 다음"])
    requires_iteration = any(kw in task_description
                             for kw in ["최적", "개선", "검증", "테스트"])

    if is_simple:
        return "ReAct (빠르고 단순)"
    elif requires_long_plan and not requires_iteration:
        return "Plan-and-Execute (복잡한 선형 태스크)"
    elif requires_iteration:
        return "Reflexion (반복 개선 필요)"
    else:
        return "ReAct with re-planning (기본 + 필요시 재계획)"

# 각 전략의 적합한 태스크
strategies = {
    "ReAct": "정보 검색, Q&A, 단순 계산, 1-3 단계 태스크",
    "Plan-and-Execute": "연구 보고서 작성, 코드베이스 분석, 5+ 단계 워크플로우",
    "Reflexion": "코드 생성·디버깅, 수학 증명, 반복 최적화",
    "LATS/MCTS": "게임 전략, 최적 경로 탐색, 탐색 공간이 넓은 문제",
}
for strategy, use_case in strategies.items():
    print(f"{strategy}: {use_case}")
```

## 정리

에이전트 플래닝은 **LLM이 행동 순서를 결정하는 방식**을 설계하는 것이다:

- **ReAct**: Thought→Action→Observation 루프, 대부분의 태스크에 적합한 기본 전략
- **Plan-and-Execute**: 전체 계획 후 실행, 복잡한 멀티 스텝 태스크에 강함
- **Reflexion**: 실패 후 자기 반성·재시도, 코드 생성·수학 문제에 효과적
- **LATS/MCTS**: 트리 탐색으로 최적 경로 발견, 탐색 공간이 넓은 최적화 문제

실전에서는 ReAct를 기본으로 하고, 태스크의 복잡성과 반복성에 따라 Plan-and-Execute나 Reflexion을 추가하는 계층적 접근이 효과적이다.

---

**지난 글:** [에이전트 메모리: 단기·장기·시맨틱 메모리 아키텍처](/posts/agent-memory/)

**다음 글:** [에이전트 리플렉션: 자기 평가와 반복 개선 패턴](/posts/agent-reflection/)

<br>
읽어주셔서 감사합니다. 😊
