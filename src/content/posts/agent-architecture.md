---
title: "에이전트 아키텍처: ReAct·Plan-and-Execute·Reflexion"
description: "AI 에이전트의 주요 아키텍처 패턴 3가지(ReAct, Plan-and-Execute, Reflexion)를 비교하고, 각 패턴의 특성과 Python 구현 코드를 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["에이전트아키텍처", "ReAct", "Plan-and-Execute", "Reflexion", "LangGraph", "AI에이전트"]
featured: false
draft: false
---

[지난 글](/posts/ai-agents-and-mcp/)에서 AI 에이전트의 개념과 MCP 프로토콜을 소개했다. 에이전트를 실제로 구축할 때는 어떤 아키텍처 패턴을 선택하느냐가 품질과 비용을 크게 좌우한다. 이번 글에서는 현재 가장 널리 쓰이는 세 가지 에이전트 아키텍처를 코드와 함께 깊이 살펴본다.

## 에이전트 아키텍처를 고려해야 하는 이유

단순히 LLM에 도구를 연결하는 것만으로는 복잡한 태스크를 처리할 수 없다. 목표가 복잡할수록, 도구 실패가 잦을수록, 품질 요구가 높을수록 구조화된 아키텍처가 필요하다. 잘못된 아키텍처를 선택하면 무한 루프에 빠지거나, LLM 비용이 폭발하거나, 품질이 기대에 미치지 못한다.

![에이전트 아키텍처 3가지 패턴](/assets/posts/agent-architecture-patterns.svg)

## ① ReAct: 가장 단순하고 범용적인 패턴

ReAct(Reasoning + Acting)는 에이전트 아키텍처의 기본이다. LLM이 Thought → Action → Observation을 반복하며 목표를 달성한다. 구현이 단순하고 대부분의 단순 태스크에 충분하다.

```python
from anthropic import Anthropic
from typing import Any

client = Anthropic()

class ReActAgent:
    def __init__(self, tools: list[dict], tool_funcs: dict):
        self.tools = tools
        self.tool_funcs = tool_funcs
        self.max_steps = 10

    def run(self, goal: str) -> str:
        messages = [{"role": "user", "content": goal}]
        
        for step in range(self.max_steps):
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                tools=self.tools,
                messages=messages,
            )
            
            if response.stop_reason == "end_turn":
                text_parts = [b.text for b in response.content if hasattr(b, 'text')]
                return "\n".join(text_parts)
            
            # 도구 호출 처리
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            
            for block in response.content:
                if block.type == "tool_use":
                    func = self.tool_funcs.get(block.name)
                    if func:
                        try:
                            result = func(**block.input)
                        except Exception as e:
                            result = f"오류: {e}"
                        
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(result),
                        })
            
            messages.append({"role": "user", "content": tool_results})
        
        return "최대 단계 초과"

# 사용 예
import requests

def web_search(query: str) -> str:
    return f"검색 결과: {query}에 대한 최신 정보..."

def calculate(expression: str) -> float:
    return eval(expression)  # 실제로는 안전한 수식 파서 사용

agent = ReActAgent(
    tools=[
        {"name": "web_search", "description": "웹 검색",
         "input_schema": {"type": "object", "properties": {"query": {"type": "string"}},
                          "required": ["query"]}},
        {"name": "calculate", "description": "수식 계산",
         "input_schema": {"type": "object", "properties": {"expression": {"type": "string"}},
                          "required": ["expression"]}},
    ],
    tool_funcs={"web_search": web_search, "calculate": calculate},
)
print(agent.run("2024년 한국 GDP와 그것의 제곱근을 계산해줘"))
```

## ② Plan-and-Execute: 복잡한 목표를 위한 구조화

복잡한 다단계 목표에는 ReAct 단독으로 부족하다. Plan-and-Execute는 **Planner**가 전체 계획을 먼저 수립하고, **Executor**가 각 단계를 실행하며, 실패 시 **Replanner**가 계획을 수정한다.

![Plan-and-Execute 구현](/assets/posts/agent-architecture-components.svg)

```python
import json
from anthropic import Anthropic

client = Anthropic()

def plan(goal: str) -> list[str]:
    """Planner: 목표를 단계로 분해"""
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system="""사용자 목표를 JSON 배열 형식의 실행 가능한 단계로 분해하세요.
각 단계는 구체적이고 독립적이어야 합니다.
출력 형식: ["단계1", "단계2", ...]""",
        messages=[{"role": "user", "content": f"목표: {goal}"}],
    )
    return json.loads(resp.content[0].text)

def execute_step(step: str, context: str, tools: list, tool_funcs: dict) -> str:
    """Executor: 단일 단계 실행"""
    messages = [{"role": "user", "content": f"다음 단계를 실행하세요:\n{step}\n\n이전 결과:\n{context}"}]
    
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            tools=tools,
            messages=messages,
        )
        
        if response.stop_reason == "end_turn":
            return " ".join(b.text for b in response.content if hasattr(b, 'text'))
        
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        
        for block in response.content:
            if block.type == "tool_use":
                func = tool_funcs.get(block.name, lambda **k: "도구 없음")
                result = func(**block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(result),
                })
        
        messages.append({"role": "user", "content": tool_results})

def replan(goal: str, steps: list[str], completed: list[str], failed_step: str) -> list[str]:
    """Replanner: 실패 시 남은 계획 재수립"""
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": f"""
목표: {goal}
완료된 단계: {completed}
실패한 단계: {failed_step}
남은 단계: {steps}

실패를 고려해 남은 계획을 JSON 배열로 재수립하세요.
"""}],
    )
    return json.loads(resp.content[0].text)

def plan_and_execute(goal: str, tools: list, tool_funcs: dict) -> str:
    """Plan-and-Execute 전체 파이프라인"""
    steps = plan(goal)
    print(f"계획: {steps}")
    
    completed = []
    context = ""
    
    while steps:
        current_step = steps.pop(0)
        try:
            result = execute_step(current_step, context, tools, tool_funcs)
            completed.append(current_step)
            context += f"\n{current_step}: {result}"
            print(f"✓ {current_step}")
        except Exception as e:
            print(f"✗ {current_step}: {e}")
            # 재계획
            steps = replan(goal, steps, completed, current_step)
    
    # 최종 결합
    return client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": f"다음 실행 결과를 통합해 최종 답변을 작성하세요:\n{context}"}],
    ).content[0].text
```

## ③ Reflexion: 자기 반성으로 품질 향상

Reflexion은 에이전트가 자신의 실패를 분석하고 개선하는 패턴이다. 동일 태스크를 여러 번 시도하면서 이전 시도의 실패 이유를 다음 시도에 반영한다. 코딩, 수학 문제 등 정답이 명확한 태스크에 특히 효과적이다.

```python
def reflexion_agent(task: str, max_trials: int = 3) -> str:
    """Reflexion: 자기 반성 루프"""
    reflections = []

    for trial in range(max_trials):
        # 이전 실패 반성을 컨텍스트에 포함
        reflection_context = ""
        if reflections:
            reflection_context = f"\n이전 시도 실패 분석:\n" + "\n".join(
                f"시도 {i+1}: {r}" for i, r in enumerate(reflections)
            )

        # Actor: 태스크 수행
        resp = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=2048,
            messages=[{"role": "user", "content": f"""
태스크: {task}
{reflection_context}
위 반성을 참고해 더 나은 답변을 작성하세요.
"""}],
        )
        output = resp.content[0].text

        # Evaluator: 품질 평가
        eval_resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=[{"role": "user", "content": f"""
태스크: {task}
출력: {output}

이 출력이 태스크를 완벽히 수행했는지 평가하세요.
완벽하면 "SUCCESS", 아니면 구체적인 개선점을 JSON으로:
{{"status": "FAIL", "reason": "이유", "improvement": "개선 방법"}}
"""}],
        )
        eval_text = eval_resp.content[0].text

        if "SUCCESS" in eval_text:
            print(f"시도 {trial + 1}에 성공")
            return output

        # Reflector: 실패 원인 기록
        import re
        try:
            eval_data = json.loads(re.search(r'\{.*\}', eval_text, re.DOTALL).group())
            reflections.append(eval_data.get("improvement", "알 수 없는 실패"))
        except Exception:
            reflections.append("형식 오류")

        print(f"시도 {trial + 1} 실패, 반성: {reflections[-1]}")

    return output  # 최대 시도 후 마지막 결과 반환
```

## 아키텍처별 비교

| 패턴 | 복잡도 | 비용 | 적합한 태스크 |
|---|---|---|---|
| ReAct | 낮음 | 낮음 | 단순 QA, FAQ, 정보 조회 |
| Plan-and-Execute | 중간 | 중간 | 리서치, 다단계 작업 |
| Reflexion | 높음 | 높음 | 코딩, 수학, 고품질 필수 작업 |

## 실전 선택 기준

```python
def choose_architecture(task_description: str) -> str:
    """태스크 특성에 따른 아키텍처 추천"""
    task_lower = task_description.lower()
    
    # 복잡도 지표
    has_multiple_steps = any(k in task_lower for k in ["계획", "단계", "분석 후", "조사 후"])
    requires_quality = any(k in task_lower for k in ["완벽", "정확", "검증", "코드 작성"])
    
    if requires_quality:
        return "Reflexion (품질 우선)"
    elif has_multiple_steps:
        return "Plan-and-Execute (복잡한 목표)"
    else:
        return "ReAct (단순 도구 호출)"
```

## 정리

에이전트 아키텍처는 태스크 복잡도와 품질 요구에 맞게 선택해야 한다:

- **ReAct**: 시작점, 대부분의 단순 태스크에 충분
- **Plan-and-Execute**: 다단계 목표, 병렬 실행 가능성 있는 태스크
- **Reflexion**: 코딩·수학 등 정답이 명확하고 품질이 중요한 태스크

세 아키텍처를 혼합하는 **하이브리드** 방식도 효과적이다. 예를 들어 Planner는 Plan-and-Execute로, 각 단계 실행은 ReAct로, 최종 검증은 Reflexion으로 구성할 수 있다.

---

**지난 글:** [AI 에이전트와 MCP: 자율적으로 행동하는 AI 시스템](/posts/ai-agents-and-mcp/)

**다음 글:** [에이전트 도구 사용: Tool Use 완전 가이드](/posts/agent-tool-use/)

<br>
읽어주셔서 감사합니다. 😊
