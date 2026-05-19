---
title: "CrewAI 완전 가이드: 역할 기반 멀티 에이전트 협업"
description: "CrewAI의 Agent, Task, Crew, 프로세스 유형(Sequential/Hierarchical), Flow, 커스텀 도구까지 실전 Python 코드로 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["CrewAI", "멀티에이전트", "Agent", "Task", "Crew", "Flow", "역할기반"]
featured: false
draft: false
---

[지난 글](/posts/agent-llamaindex/)에서 LlamaIndex로 데이터 중심 RAG 파이프라인을 구성하는 방법을 살펴봤다. 이번 글에서는 **역할 기반 멀티 에이전트 협업 프레임워크**인 CrewAI를 다룬다. CrewAI는 여러 AI 에이전트가 역할(Role)과 목표(Goal)를 가지고 협업하는 팀 구조를 자연스럽게 표현한다.

## CrewAI란

CrewAI는 인간 팀의 협업 방식을 모방한다. 각 **에이전트(Agent)**는 특정 역할과 목표를 가지며, **태스크(Task)**를 할당받아 실행하고, **Crew**는 이들을 조율한다.

핵심 구성 요소:
- **Agent**: 역할, 목표, 배경 스토리, 도구를 가진 AI 에이전트
- **Task**: 수행할 작업, 기대 출력물, 담당 에이전트
- **Crew**: 에이전트와 태스크를 묶어 실행하는 팀
- **Process**: Sequential(순차), Hierarchical(계층), Parallel(병렬)

![CrewAI 멀티 에이전트 협업 구조](/assets/posts/agent-crewai-architecture.svg)

## 기본 Crew 구현

```python
from crewai import Agent, Task, Crew, Process
from crewai.tools import BaseTool
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI

llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0.3)

# 1. Agent 정의 (역할 기반)
researcher = Agent(
    role="AI 연구 전문가",
    goal="최신 AI 트렌드와 기술 정보를 정확하게 수집하고 분석한다",
    backstory="""당신은 10년 경력의 AI 연구원으로, 학술 논문과 기술 블로그를
                최신 동향을 파악하는 전문가입니다. 항상 출처를 검증합니다.""",
    llm=llm,
    tools=[],           # 사용할 도구 목록
    verbose=True,       # 추론 과정 출력
    allow_delegation=False,  # 다른 에이전트에게 위임 허용 여부
    max_iter=10,        # 최대 반복 횟수
)

writer = Agent(
    role="기술 블로그 작가",
    goal="복잡한 AI 개념을 일반 독자도 이해하기 쉽게 설명한다",
    backstory="""당신은 기술 커뮤니케이션 전문가로, 딥다이브 기술 글쓰기에
                탁월한 능력을 보유합니다. 명확성과 정확성을 동시에 추구합니다.""",
    llm=llm,
    verbose=True,
)

reviewer = Agent(
    role="편집장 및 품질 검토 전문가",
    goal="글의 정확성, 가독성, 완결성을 검증하고 개선점을 제시한다",
    backstory="15년 경력의 테크 저널리스트로, 독자 관점에서 콘텐츠를 평가합니다.",
    llm=llm,
    verbose=True,
)

# 2. Task 정의 (순서 의존성 포함)
research_task = Task(
    description="""최신 LLM 에이전트 프레임워크 트렌드를 조사하세요.
    다음을 포함해야 합니다:
    - 2024-2025년 주요 프레임워크 (LangGraph, CrewAI, AutoGen, Swarm)
    - 각 프레임워크의 핵심 특징과 차별점
    - 실제 사용 사례 3가지 이상""",
    expected_output="마크다운 형식의 상세 리포트 (최소 500단어)",
    agent=researcher,
)

writing_task = Task(
    description="""제공된 리서치 노트를 바탕으로 기술 블로그 포스트를 작성하세요.
    - 제목과 소제목 포함
    - 코드 예제 2개 이상
    - 초보자도 이해 가능한 설명""",
    expected_output="완성된 블로그 포스트 (1000-1500단어)",
    agent=writer,
    context=[research_task],  # research_task 결과를 컨텍스트로 사용
)

review_task = Task(
    description="초안을 검토하고 개선된 최종본을 반환하세요. 사실 오류와 문체를 검증하세요.",
    expected_output="검토 완료된 최종 블로그 포스트",
    agent=reviewer,
    context=[writing_task],
    output_file="final_blog_post.md",  # 파일로 출력
)

# 3. Crew 구성 및 실행
crew = Crew(
    agents=[researcher, writer, reviewer],
    tasks=[research_task, writing_task, review_task],
    process=Process.sequential,  # 순차 실행
    verbose=True,
    memory=True,          # 에이전트 간 메모리 공유
    embedder={
        "provider": "openai",
        "config": {"model": "text-embedding-3-small"},
    },
)

result = crew.kickoff(
    inputs={"topic": "LLM 에이전트 프레임워크 비교"}
)
print(result.raw)
```

## 커스텀 도구 구현

```python
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type
import requests

# BaseTool을 상속한 커스텀 도구
class WebScraperInput(BaseModel):
    url: str = Field(description="스크랩할 웹 페이지 URL")

class WebScraperTool(BaseTool):
    name: str = "Web Scraper"
    description: str = "웹 페이지 내용을 가져옵니다. URL을 입력하면 텍스트를 반환합니다."
    args_schema: Type[BaseModel] = WebScraperInput

    def _run(self, url: str) -> str:
        try:
            response = requests.get(url, timeout=10)
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(response.text, "html.parser")
            # 본문 텍스트만 추출
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            return text[:3000]  # 최대 3000자
        except Exception as e:
            return f"에러: {str(e)}"

# @tool 데코레이터 방식 (간단한 함수형)
from crewai.tools import tool

@tool("Calculator Tool")
def calculator_tool(expression: str) -> str:
    """수식을 계산합니다. 예: '100 * 1.1 + 50'"""
    import ast
    try:
        result = ast.literal_eval(expression)
        return f"결과: {result}"
    except Exception as e:
        return f"계산 오류: {str(e)}"

# 도구를 에이전트에 연결
researcher_with_tools = Agent(
    role="리서치 에이전트",
    goal="정확한 정보를 수집한다",
    backstory="웹 정보 수집 전문가",
    tools=[WebScraperTool(), calculator_tool],
    llm=llm,
)
```

## Hierarchical Process

```python
# 매니저 에이전트가 태스크를 자율적으로 위임하는 구조
manager_crew = Crew(
    agents=[researcher, writer, reviewer],
    tasks=[research_task, writing_task, review_task],
    process=Process.hierarchical,
    manager_llm=ChatAnthropic(model="claude-opus-4-7"),  # 강력한 LLM을 매니저로
    verbose=True,
)
# 매니저가 직접 태스크 분배·위임·결과 검증

# 동적 입력으로 여러 번 실행
results = []
topics = ["RAG 기술", "파인튜닝 방법론", "에이전트 아키텍처"]
for topic in topics:
    result = crew.kickoff(inputs={"topic": topic})
    results.append(result.raw)
```

## CrewAI Flow: 이벤트 기반 워크플로우

Flow는 Crew(AI 태스크)와 결정론적 제어 로직을 조합한다.

![CrewAI Flow: 이벤트 기반 파이프라인](/assets/posts/agent-crewai-flow.svg)

```python
from crewai.flow.flow import Flow, listen, start, router
from pydantic import BaseModel

class BlogState(BaseModel):
    topic: str = ""
    research: str = ""
    draft: str = ""
    quality_score: int = 0
    retry_count: int = 0

class BlogFlow(Flow[BlogState]):
    @start()
    def generate_topic(self):
        """시작 스텝: 토픽 선정"""
        self.state.topic = "LLM 에이전트 프레임워크 비교 2025"
        print(f"토픽 선정: {self.state.topic}")

    @listen(generate_topic)
    def research_topic(self):
        """research Crew 실행"""
        research_crew = Crew(
            agents=[researcher],
            tasks=[Task(
                description=f"{self.state.topic}를 조사하세요.",
                expected_output="상세 리포트",
                agent=researcher,
            )],
            process=Process.sequential,
        )
        result = research_crew.kickoff(inputs={"topic": self.state.topic})
        self.state.research = result.raw

    @router(research_topic)
    def quality_check(self):
        """품질 판단: approved / retry"""
        # 간단한 품질 기준 (실제론 LLM 평가 사용)
        if len(self.state.research) > 500 and self.state.retry_count < 2:
            self.state.quality_score = 8
            return "approved"
        self.state.retry_count += 1
        return "retry"

    @listen("retry")
    def refine_research(self):
        """추가 리서치 후 재평가"""
        self.state.research += "\n[추가 조사 내용]"
        return self.quality_check()

    @listen("approved")
    def publish(self):
        """최종 출력"""
        print(f"✅ 퍼블리싱 완료!\n리포트:\n{self.state.research[:200]}...")

# 실행
flow = BlogFlow()
flow.kickoff()
flow.plot("blog_flow.html")  # 시각화 다이어그램 생성
```

## CrewAI vs LangGraph vs AutoGen

| 기준 | CrewAI | LangGraph | AutoGen |
|------|--------|-----------|---------|
| 패러다임 | 역할 기반 팀 | 상태 기계 그래프 | 대화 기반 협업 |
| 설정 난이도 | 쉬움 | 중간 | 중간 |
| 순환/루프 | Flow 사용 | 네이티브 | 네이티브 |
| Human-in-Loop | Flow 인터럽트 | interrupt_before | 사용자 프록시 |
| 메모리 | 내장 | Checkpointer | ConversableAgent |
| 적합한 사례 | 명확한 역할 분담 워크플로우 | 복잡 상태 추적 | 자유형 토론·협의 |

## 정리

CrewAI는 **인간 팀의 협업 방식을 AI 에이전트로 재현**하는 프레임워크다:

- **Agent**: `role`, `goal`, `backstory`로 명확한 페르소나 부여, 전문성 집중
- **Task**: `context=[prev_task]`로 이전 결과를 다음 태스크에 자동 전달
- **Process**: Sequential로 예측 가능한 순서 실행, Hierarchical로 자율적 위임
- **Flow**: `@start/@listen/@router`로 Crew와 결정론적 로직을 조합
- **커스텀 도구**: `BaseTool` 상속 또는 `@tool` 데코레이터로 간단하게 구현

명확하게 역할이 나뉜 파이프라인에는 CrewAI, 복잡한 상태 추적이 필요한 에이전트에는 LangGraph를 선택하면 된다.

---

**지난 글:** [LlamaIndex 완전 가이드: 데이터 중심 LLM 프레임워크](/posts/agent-llamaindex/)

**다음 글:** [AutoGen 완전 가이드: 대화 기반 멀티 에이전트 프레임워크](/posts/agent-autogen/)

<br>
읽어주셔서 감사합니다. 😊
