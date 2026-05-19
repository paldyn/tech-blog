---
title: "에이전트 안티패턴: 흔한 실수와 피해야 할 설계"
description: "AI 에이전트 개발에서 자주 발생하는 10가지 안티패턴(무한 루프, 도구 과용, 컨텍스트 오염, 프롬프트 인젝션 등)과 방어 코드 패턴을 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["에이전트안티패턴", "무한루프", "프롬프트인젝션", "에이전트설계", "방어패턴", "프로덕션AI"]
featured: false
draft: false
---

[지난 글](/posts/agent-evaluation/)에서 에이전트 성능을 측정하는 평가 방법론을 살펴봤다. 이번 글에서는 실제 프로덕션 에이전트 개발에서 반복적으로 마주치는 **10가지 안티패턴**과 방어 코드를 다룬다. 이 실수들은 모두 예방 가능하며, 설계 단계에서 잡는 것이 가장 저렴하다.

## 에이전트 10대 안티패턴 개요

![에이전트 10대 안티패턴](/assets/posts/agent-anti-patterns-list.svg)

## 안티패턴 ①: 무한 루프 (Infinite Loop)

가장 흔하고 치명적인 문제다. 에이전트가 종료 조건 없이 같은 도구를 반복 호출하거나, 답을 찾지 못해 루프에 빠진다.

```python
from langchain.agents import AgentExecutor
from langchain_anthropic import ChatAnthropic
import time

# ❌ 안티패턴: 종료 조건 없음
bad_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    # max_iterations 미설정 → 무한 루프 가능
    # handle_parsing_errors 미설정 → 파싱 오류 시 크래시
)

# ✅ 올바른 방법: 다중 안전장치
safe_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    max_iterations=15,              # 최대 반복 횟수
    max_execution_time=120,         # 최대 실행 시간(초)
    early_stopping_method="force",  # 한도 초과 시 강제 종료
    handle_parsing_errors=True,     # 파싱 오류 처리
    return_intermediate_steps=True, # 디버깅용 중간 단계 수집
)

# 중복 도구 호출 감지 (LangGraph 방식)
class LoopDetectionCallback:
    def __init__(self, max_duplicate: int = 3):
        self.call_history: list[str] = []
        self.max_duplicate = max_duplicate

    def on_tool_start(self, tool_name: str, tool_input: dict) -> None:
        call_key = f"{tool_name}:{str(sorted(tool_input.items()))}"
        duplicate_count = self.call_history.count(call_key)
        if duplicate_count >= self.max_duplicate:
            raise RuntimeError(
                f"루프 감지: '{tool_name}'이 {duplicate_count}회 중복 호출됨. 강제 종료."
            )
        self.call_history.append(call_key)
```

## 안티패턴 ②: 과도한 도구 호출

에이전트가 필요 이상으로 많은 도구를 호출해 비용과 레이턴시가 폭증한다.

```python
# ❌ 안티패턴: 도구 설명이 모호해 불필요한 호출 유발
@tool
def search(query: str) -> str:
    """검색한다"""  # 너무 짧은 설명
    ...

# ✅ 올바른 방법: 언제 사용해야 하는지 명확히 설명
@tool
def web_search(query: str) -> str:
    """실시간 웹 정보를 검색합니다.
    사용해야 할 때: 최신 뉴스, 현재 가격, 실시간 날씨 등 시간에 민감한 정보.
    사용하지 말아야 할 때: 일반 상식, 수학 계산, 코드 작성 등 LLM이 직접 답할 수 있는 경우.
    """
    ...

# 도구 결과 캐싱 (동일 쿼리 재요청 방지)
from functools import lru_cache

@lru_cache(maxsize=100)
def cached_web_search(query: str) -> str:
    """캐시 적용 웹 검색 — 동일 쿼리는 API 재호출 없이 반환"""
    return _actual_web_search(query)

# 시스템 프롬프트에 절약 지시 추가
SYSTEM_PROMPT = """당신은 효율적인 AI 에이전트입니다.
도구 사용 규칙:
1. 도구는 꼭 필요할 때만 사용하세요. LLM이 직접 답할 수 있으면 도구 생략.
2. 이미 얻은 정보는 다시 검색하지 마세요.
3. 한 번의 도구 호출로 여러 정보를 얻을 수 없는지 확인하세요."""
```

## 안티패턴 ③: 컨텍스트 오염

도구 결과 원문이 컨텍스트를 꽉 채워 LLM이 정작 중요한 정보에 집중하지 못한다.

```python
# ❌ 안티패턴: 도구 결과 원문 그대로 사용
@tool
def search_documents(query: str) -> str:
    """문서 검색"""
    docs = vector_db.search(query, k=10)
    return "\n\n".join(doc.page_content for doc in docs)  # 수천 토큰!

# ✅ 올바른 방법: 도구 레벨에서 요약·트리밍
@tool
def search_and_summarize(query: str) -> str:
    """문서를 검색하고 관련 정보를 요약해 반환합니다."""
    docs = vector_db.search(query, k=5)

    # 각 문서 청크 최대 300자로 제한
    snippets = [doc.page_content[:300] for doc in docs]
    context = "\n---\n".join(snippets)

    # 핵심 정보만 추출해 반환 (선택적 LLM 요약)
    return context[:1500]  # 컨텍스트 전체 상한선

# 컨텍스트 창 관리 (LangChain)
from langchain_core.messages import trim_messages
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-6")

def trim_agent_context(messages: list, max_tokens: int = 8000) -> list:
    """에이전트 컨텍스트를 토큰 한도 내로 트리밍"""
    return trim_messages(
        messages,
        strategy="last",
        token_counter=llm,
        max_tokens=max_tokens,
        include_system=True,    # 시스템 프롬프트 유지
        start_on="human",       # 사용자 메시지부터 시작
    )
```

## 안티패턴 ⑧⑨: 오류 처리와 보안

![무한 루프 방지와 오류 복원 패턴](/assets/posts/agent-anti-patterns-solutions.svg)

```python
import re
from typing import Optional

# 안티패턴 ⑧: 취약한 오류 처리 → 강건한 도구 래퍼
def make_safe_tool(tool_fn, fallback_message: str = "도구 실행 실패"):
    """도구를 오류 안전하게 래핑"""
    def safe_wrapper(*args, **kwargs):
        for attempt in range(3):  # 최대 3회 재시도
            try:
                import signal

                def timeout_handler(signum, frame):
                    raise TimeoutError("도구 실행 시간 초과")

                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(30)  # 30초 타임아웃
                result = tool_fn(*args, **kwargs)
                signal.alarm(0)  # 타임아웃 해제
                return result

            except TimeoutError:
                return f"[타임아웃] {fallback_message}. 다른 접근법을 시도하세요."
            except ConnectionError as e:
                if attempt < 2:
                    import time
                    time.sleep(2 ** attempt)  # 지수 백오프
                    continue
                return f"[연결 오류] {str(e)[:100]}. 잠시 후 다시 시도하세요."
            except Exception as e:
                return f"[오류] {str(e)[:200]}"
        return fallback_message

    safe_wrapper.__name__ = tool_fn.__name__
    safe_wrapper.__doc__ = tool_fn.__doc__
    return safe_wrapper

# 안티패턴 ⑨: 프롬프트 인젝션 방어
class InputSanitizer:
    # 주입 시도 패턴
    INJECTION_PATTERNS = [
        r"ignore\s+(previous|above|all)\s+instructions?",
        r"forget\s+everything",
        r"새로운\s+시스템\s+프롬프트",
        r"(system|assistant):\s*",
        r"<\|im_start\|>",
        r"\[INST\]",
    ]

    @classmethod
    def sanitize(cls, user_input: str) -> tuple[str, bool]:
        """입력 정제 및 인젝션 감지. (정제된 입력, 위험 여부) 반환"""
        cleaned = user_input.strip()

        # 길이 제한
        if len(cleaned) > 2000:
            cleaned = cleaned[:2000] + "...[잘림]"

        # 인젝션 패턴 감지
        is_suspicious = any(
            re.search(pattern, cleaned, re.IGNORECASE)
            for pattern in cls.INJECTION_PATTERNS
        )

        if is_suspicious:
            return cleaned, True  # 의심스러운 입력 플래그

        return cleaned, False

# 에이전트 엔트리포인트에 검증 추가
def run_agent_safely(user_input: str, agent_executor) -> str:
    sanitized, is_suspicious = InputSanitizer.sanitize(user_input)

    if is_suspicious:
        # 로깅 후 거부 또는 제한된 모드로 실행
        print(f"⚠️ 의심스러운 입력 감지: {sanitized[:100]}")
        return "보안 정책상 처리할 수 없는 입력입니다."

    result = agent_executor.invoke({"input": sanitized})
    return result.get("output", "오류가 발생했습니다.")
```

## 안티패턴 ⑤: 에이전트 없어도 되는 곳에 에이전트 사용

에이전트는 유연하지만 비싸고 느리다. 단순한 경우에는 필요 없다.

```python
# 에이전트 필요성 판단 기준

def needs_agent(task: str) -> bool:
    """에이전트가 필요한지 판단하는 간단한 휴리스틱"""
    # 에이전트 불필요: 단일 도구 호출, 고정 파이프라인
    simple_patterns = [
        "요약해줘",         # → 단순 LLM 호출
        "번역해줘",         # → 단순 LLM 호출
        "분류해줘",         # → 단순 프롬프트
    ]
    if any(pattern in task for pattern in simple_patterns):
        return False

    # 에이전트 필요: 다중 도구 조합, 조건 분기, 반복
    agent_patterns = [
        "검색하고 분석해서",   # 검색 + 분석 조합
        "비교하고 추천해줘",   # 여러 도구 + 추론
        "자동으로 실행해줘",   # 반복 실행
    ]
    return any(pattern in task for pattern in agent_patterns)

# ❌ 에이전트 불필요: 단순 RAG로 충분
# user: "이 문서에서 주요 내용을 요약해줘"
# → RAG chain = retriever | prompt | llm | output_parser (3줄 코드)

# ✅ 에이전트 필요: 동적 결정이 필요
# user: "우리 제품과 경쟁사 3곳을 비교 분석한 보고서 만들어줘"
# → 검색 도구 × N + 분석 + 구조화 출력 = 에이전트 적합
```

## 안티패턴 ⑦: 모놀리식 에이전트 (God Agent)

```python
# ❌ 안티패턴: 하나의 에이전트에 모든 도구
god_agent = Agent(
    tools=[
        web_search, database_query, file_read, file_write,
        send_email, slack_message, create_ticket, deploy_code,
        # ... 20개 이상의 도구
    ],
    system_message="모든 것을 할 수 있는 에이전트",
)
# 문제: 도구가 많을수록 LLM의 선택 정확도 하락 (도구 선택 혼란)

# ✅ 올바른 방법: 역할별 전문 에이전트 + 오케스트레이터
research_agent = Agent(tools=[web_search, arxiv_search], ...)
data_agent = Agent(tools=[database_query, sql_generate], ...)
comms_agent = Agent(tools=[send_email, slack_message], ...)
code_agent = Agent(tools=[file_read, file_write, deploy_code], ...)

# 오케스트레이터가 적절한 에이전트로 라우팅
orchestrator = Agent(
    tools=[
        transfer_to_research,
        transfer_to_data,
        transfer_to_comms,
        transfer_to_code,
    ],
    system_message="사용자 요청을 분석해 적절한 전문 에이전트로 라우팅하세요.",
)
```

## 프로덕션 에이전트 체크리스트

```python
# 배포 전 필수 확인 사항
PRODUCTION_CHECKLIST = {
    "안전성": [
        "max_iterations 설정 (권장: 10-20)",
        "max_execution_time 설정 (권장: 60-120초)",
        "도구 오류 핸들링 + fallback 메시지",
        "중복 도구 호출 감지",
        "입력 길이 제한 및 인젝션 방어",
    ],
    "성능": [
        "도구 결과 길이 제한 (권장: 1500자 이하)",
        "컨텍스트 트리밍 전략 (슬라이딩 윈도우 또는 요약)",
        "도구 결과 캐싱 (동일 쿼리 반복 방지)",
        "역할별 에이전트 분리 (도구 수 최소화)",
    ],
    "관찰성": [
        "LangSmith 또는 Langfuse 트레이싱 연동",
        "비용 모니터링 (토큰 수 추적)",
        "성공률 메트릭 수집",
        "알림 설정 (비용 초과, 오류율 급증)",
    ],
    "평가": [
        "테스트 데이터셋 구축 (최소 50개 케이스)",
        "자동 평가 파이프라인 (CI 통합)",
        "회귀 테스트 (배포 전 성능 비교)",
    ],
}

for category, items in PRODUCTION_CHECKLIST.items():
    print(f"\n[{category}]")
    for item in items:
        print(f"  ☐ {item}")
```

## 정리

에이전트 안티패턴은 **예방 가능한 설계 실수**다:

- **무한 루프**: `max_iterations` + `timeout` + 중복 호출 감지로 방어
- **도구 과용**: 명확한 도구 설명 + 캐싱 + 시스템 프롬프트 절약 지시
- **컨텍스트 오염**: 도구 결과 길이 제한 + 컨텍스트 트리밍
- **취약한 오류 처리**: try/except + 재시도 + fallback 메시지
- **프롬프트 인젝션**: 입력 검증 + 패턴 감지 + 권한 최소화
- **God Agent**: 역할별 에이전트 분리 + 오케스트레이터 패턴

에이전트 개발의 핵심은 **실패에 대한 대비**다. 에이전트는 LLM의 비결정성으로 인해 항상 예상치 못한 동작을 할 수 있으며, 이를 안전하게 제어하는 코드가 프로덕션 품질을 결정한다.

---

**지난 글:** [에이전트 평가: 성능 측정과 벤치마킹 방법론](/posts/agent-evaluation/)

**다음 글:** [컴퓨터 비전 심층: 딥러닝 기반 이미지 분류](/posts/cv-image-classification-deep/)

<br>
읽어주셔서 감사합니다. 😊
