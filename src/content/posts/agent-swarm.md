---
title: "OpenAI Swarm: 경량 멀티 에이전트 핸드오프 패턴"
description: "OpenAI Swarm의 핵심 개념인 Agent, handoff, context_variables, 그리고 실전 고객 지원 시스템 구현까지 Python 코드로 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["Swarm", "OpenAI", "멀티에이전트", "핸드오프", "경량프레임워크", "에이전트라우팅"]
featured: false
draft: false
---

[지난 글](/posts/agent-autogen/)에서 AutoGen의 대화 기반 멀티 에이전트 협업을 살펴봤다. 이번 글에서는 OpenAI가 발표한 **Swarm**을 다룬다. Swarm은 LangChain, AutoGen, CrewAI에 비해 극도로 단순한 경량 프레임워크로, **핸드오프(Handoff)**라는 단 하나의 핵심 메커니즘으로 멀티 에이전트를 구현한다.

## Swarm이란

Swarm은 OpenAI가 교육·실험 목적으로 공개한 멀티 에이전트 프레임워크다. 핵심 아이디어는 두 가지다:

1. **Routines**: 에이전트의 역할을 `instructions`(시스템 프롬프트)와 `functions`(도구)로 정의
2. **Handoffs**: 에이전트가 다른 에이전트를 반환해 실행권을 이전

의존성이 거의 없고(openai 패키지만), 코드베이스 자체가 수백 줄에 불과해 동작 원리를 완전히 이해하며 사용할 수 있다.

![Swarm 핸드오프 패턴](/assets/posts/agent-swarm-handoff.svg)

## 기본 구현

```python
from swarm import Swarm, Agent

client = Swarm()  # OpenAI 클라이언트 기반

# 에이전트 정의 (instructions + functions)
def transfer_to_sales():
    """구매 관련 문의를 Sales 에이전트로 이전합니다."""
    return sales_agent  # Agent 객체 반환 = 핸드오프

def transfer_to_support():
    """기술 지원 문의를 Support 에이전트로 이전합니다."""
    return support_agent

def transfer_to_billing():
    """결제·환불 문의를 Billing 에이전트로 이전합니다."""
    return billing_agent

def transfer_back_to_triage():
    """Triage 에이전트로 돌아갑니다."""
    return triage_agent

# Triage: 의도 파악 + 라우팅
triage_agent = Agent(
    name="Triage Agent",
    instructions="""당신은 고객 지원 접수 담당자입니다.
    사용자의 문의를 파악하고 적절한 팀으로 이전하세요:
    - 구매·가격 문의 → transfer_to_sales()
    - 기술적 문제 → transfer_to_support()
    - 결제·환불 → transfer_to_billing()
    절대 직접 답변하지 말고 항상 전문 팀으로 이전하세요.""",
    functions=[transfer_to_sales, transfer_to_support, transfer_to_billing],
)

sales_agent = Agent(
    name="Sales Agent",
    instructions="""당신은 영업 전문가입니다.
    제품 가격과 기능을 안내하고 구매를 도와줍니다.
    결제 문제가 있으면 transfer_to_billing()을 호출하세요.""",
    functions=[transfer_to_billing, transfer_back_to_triage],
)

support_agent = Agent(
    name="Support Agent",
    instructions="""당신은 기술 지원 엔지니어입니다.
    버그, 오류, 설정 문제를 해결합니다.
    해결이 어려우면 transfer_back_to_triage()를 호출하세요.""",
    functions=[transfer_back_to_triage],
)

billing_agent = Agent(
    name="Billing Agent",
    instructions="환불, 결제 오류, 구독 변경을 처리합니다.",
    functions=[transfer_back_to_triage],
)

# 실행 (단일 턴)
response = client.run(
    agent=triage_agent,
    messages=[{"role": "user", "content": "Claude Pro 구독 환불 신청하고 싶어요"}],
)
print(response.messages[-1]["content"])
# triage → billing_agent로 핸드오프 → 환불 안내
```

## context_variables: 에이전트 간 공유 상태

```python
from swarm import Swarm, Agent
from swarm.types import Result

client = Swarm()

def set_user_tier(context_variables: dict, tier: str) -> Result:
    """사용자 등급을 업데이트합니다."""
    context_variables["tier"] = tier
    return Result(
        value=f"등급이 {tier}로 업데이트되었습니다.",
        context_variables=context_variables,  # 업데이트된 context 반환
    )

def get_personalized_greeting(context_variables: dict) -> str:
    """사용자 정보를 바탕으로 맞춤 인사를 반환합니다."""
    name = context_variables.get("user_name", "고객님")
    tier = context_variables.get("tier", "일반")
    return f"안녕하세요, {name}({tier} 등급)! 무엇을 도와드릴까요?"

personalized_agent = Agent(
    name="Personalized Agent",
    instructions="""사용자의 context를 활용해 맞춤 서비스를 제공합니다.
    항상 get_personalized_greeting으로 시작하세요.""",
    functions=[get_personalized_greeting, set_user_tier],
)

# context_variables 초기값 설정
response = client.run(
    agent=personalized_agent,
    messages=[{"role": "user", "content": "안녕하세요"}],
    context_variables={
        "user_name": "김철수",
        "user_id": "u12345",
        "tier": "premium",
    },
)
print(response.messages[-1]["content"])
print("업데이트된 context:", response.context_variables)
```

## 멀티 턴 대화 루프

![Swarm 작동 원리: 단일 루프 + 핸드오프](/assets/posts/agent-swarm-pattern.svg)

```python
def run_conversation(starting_agent: Agent, context: dict = None):
    """인터랙티브 멀티 턴 대화 루프"""
    client = Swarm()
    messages = []
    active_agent = starting_agent
    context_variables = context or {}

    print(f"[{active_agent.name}] 대화 시작. 'quit'으로 종료.\n")

    while True:
        user_input = input("사용자: ").strip()
        if user_input.lower() == "quit":
            break

        messages.append({"role": "user", "content": user_input})

        response = client.run(
            agent=active_agent,
            messages=messages,
            context_variables=context_variables,
        )

        # 핸드오프 발생 시 active_agent 업데이트
        if response.agent != active_agent:
            print(f"\n[핸드오프: {active_agent.name} → {response.agent.name}]\n")
            active_agent = response.agent

        # context 업데이트
        context_variables = response.context_variables

        # 응답 출력
        for msg in response.messages:
            if msg["role"] == "assistant":
                print(f"[{active_agent.name}]: {msg['content']}\n")
                messages.append(msg)

# 실행
run_conversation(
    starting_agent=triage_agent,
    context={"user_name": "이영희", "tier": "standard"},
)
```

## 도구 함수와 핸드오프 함수 조합

```python
import json
from swarm import Agent, Swarm

# 실제 비즈니스 로직이 있는 도구
def check_order_status(order_id: str) -> str:
    """주문 상태를 확인합니다."""
    # 실제로는 DB 조회
    orders = {
        "ORD-001": "배송중 (서울 → 부산)",
        "ORD-002": "배송 완료",
        "ORD-003": "처리 중",
    }
    return orders.get(order_id, f"주문 번호 {order_id}를 찾을 수 없습니다.")

def process_refund(order_id: str, reason: str) -> str:
    """환불을 처리합니다."""
    return f"주문 {order_id}의 환불이 접수되었습니다. 사유: {reason}. 3-5 영업일 소요."

def escalate_to_human() -> str:
    """인간 상담원에게 연결합니다."""
    return "상담원 연결 중... 예상 대기 시간: 5분"

# 역할이 명확한 전문 에이전트
order_agent = Agent(
    name="Order Agent",
    instructions="""주문 관련 문의를 처리합니다.
    check_order_status로 상태를 확인하고,
    복잡한 문제는 transfer_to_support()로 이전하세요.
    매우 복잡하거나 불만이 심각하면 escalate_to_human()을 사용하세요.""",
    functions=[check_order_status, escalate_to_human, transfer_to_support],
)

refund_agent = Agent(
    name="Refund Agent",
    instructions="""환불 및 결제 문제를 처리합니다.
    process_refund로 환불 접수를 진행하세요.
    주문 상태 확인이 필요하면 transfer_to_order()를 사용하세요.""",
    functions=[process_refund, escalate_to_human],
)
```

## Swarm을 선택해야 할 때

```python
# ✅ Swarm이 적합한 경우
# 1. 명확하게 분리된 역할의 에이전트가 3-7개 이내
# 2. 선형 또는 트리 구조의 핸드오프
# 3. 빠른 프로토타이핑, 개념 검증
# 4. OpenAI API 직접 사용 환경

# ❌ Swarm보다 다른 프레임워크가 나은 경우
# 1. 복잡한 순환 루프 → LangGraph
# 2. 역할 기반 팀 협업 + 메모리 → CrewAI
# 3. 코드 생성·실행 루프 → AutoGen
# 4. 대용량 문서 RAG → LlamaIndex

# 핵심 비교: 코드 복잡도
# Swarm:    ~300줄 코어, 의존성 거의 없음
# AutoGen:  ~10k줄, 풍부한 기능
# CrewAI:   ~20k줄, 완전한 에코시스템
# LangGraph:~15k줄, 강력한 상태 관리
```

## 정리

Swarm은 **극도로 단순한 핸드오프 패턴**으로 멀티 에이전트 시스템의 본질을 보여준다:

- **핸드오프**: 함수가 `Agent` 객체를 반환하면 `active_agent`가 교체되는 단순한 메커니즘
- **context_variables**: 모든 에이전트가 공유하는 딕셔너리로 대화 상태 유지
- **단일 루프**: 복잡한 오케스트레이터 없이 단순 루프로 에이전트 전환
- **경량성**: OpenAI SDK만 의존, 코드가 작아 동작 원리를 완전히 이해 가능

고객 지원, 인테이크 라우팅, 단계별 워크플로우처럼 **명확한 역할 분리와 선형 전환**이 있는 시스템에 최적이다.

---

**지난 글:** [AutoGen 완전 가이드: 대화 기반 멀티 에이전트 프레임워크](/posts/agent-autogen/)

**다음 글:** [에이전트 메모리: 단기·장기·시맨틱 메모리 아키텍처](/posts/agent-memory/)

<br>
읽어주셔서 감사합니다. 😊
