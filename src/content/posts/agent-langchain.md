---
title: "LangChain 완전 가이드: 에이전트 프레임워크의 표준"
description: "LangChain의 핵심 구성 요소(LLMs, Prompts, Chains, Agents, Memory), LCEL 파이프 연산자, RAG 체인, 에이전트 구현까지 실전 Python 코드로 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["LangChain", "LCEL", "RAG", "에이전트", "ChatPromptTemplate", "VectorStore", "LLM프레임워크"]
featured: false
draft: false
---

[지난 글](/posts/agent-mcp-protocol/)에서 MCP 프로토콜로 에이전트와 도구를 표준화하는 방법을 살펴봤다. 이번 글은 에이전트 개발 생태계에서 가장 널리 쓰이는 프레임워크인 LangChain을 심층 분석한다. LangChain은 LLM 애플리케이션 개발에 필요한 모든 구성 요소를 모듈화해 제공한다.

## LangChain이란

LangChain은 2022년 Harrison Chase가 개발한 **LLM 애플리케이션 프레임워크**다. LLM, 프롬프트, 체인, 에이전트, 메모리, 벡터 스토어 등을 통합해 복잡한 AI 애플리케이션을 빠르게 구축할 수 있게 한다. Python과 JavaScript 버전이 있으며, 2025년 기준 가장 많이 사용되는 LLM 프레임워크다.

![LangChain 구성 요소 아키텍처](/assets/posts/agent-langchain-architecture.svg)

## 핵심 구성 요소

### ① LLMs / Chat Models

다양한 LLM 제공자를 동일한 인터페이스로 사용한다.

```python
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_community.llms import Ollama

# 동일한 인터페이스, 다른 제공자
claude = ChatAnthropic(model="claude-sonnet-4-6", temperature=0.7)
gpt = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
local = Ollama(model="llama3.1")

# 어떤 모델이든 동일하게 사용
from langchain_core.messages import HumanMessage, SystemMessage

response = claude.invoke([
    SystemMessage(content="당신은 Python 전문가입니다."),
    HumanMessage(content="데코레이터를 설명해줘"),
])
print(response.content)

# 스트리밍
for chunk in claude.stream([HumanMessage(content="파이썬의 특징은?")]):
    print(chunk.content, end="", flush=True)
```

### ② ChatPromptTemplate

재사용 가능한 프롬프트 템플릿을 관리한다.

```python
from langchain_core.prompts import (
    ChatPromptTemplate,
    MessagesPlaceholder,
    FewShotChatMessagePromptTemplate,
)

# 기본 템플릿
prompt = ChatPromptTemplate.from_messages([
    ("system", "당신은 {domain} 전문가입니다. 항상 {language}로 답변하세요."),
    MessagesPlaceholder(variable_name="history"),  # 대화 히스토리
    ("human", "{question}"),
])

# 값 채우기
chain = prompt | claude
response = chain.invoke({
    "domain": "머신러닝",
    "language": "한국어",
    "history": [],
    "question": "과적합이란 무엇인가요?",
})

# Few-shot 프롬프트 (예시 포함)
examples = [
    {"input": "고양이", "output": "cat"},
    {"input": "개", "output": "dog"},
]
few_shot_prompt = FewShotChatMessagePromptTemplate(
    examples=examples,
    example_prompt=ChatPromptTemplate.from_messages([
        ("human", "{input}"), ("ai", "{output}")
    ]),
)
translation_prompt = ChatPromptTemplate.from_messages([
    ("system", "한→영 번역기입니다."),
    few_shot_prompt,
    ("human", "{input}"),
])
```

### ③ LCEL (LangChain Expression Language)

LCEL은 파이프(`|`) 연산자로 체인을 구성하는 LangChain의 핵심 패러다임이다. 스트리밍, 배치, 비동기를 일관된 인터페이스로 지원한다.

![LCEL과 RAG 체인](/assets/posts/agent-langchain-lcel.svg)

```python
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_core.runnables import RunnableParallel, RunnableLambda

# 기본 체인
chain = prompt | claude | StrOutputParser()

# 병렬 체인 (여러 LLM 동시 실행)
parallel_chain = RunnableParallel(
    korean=ChatPromptTemplate.from_template("한국어로 답변: {question}") | claude | StrOutputParser(),
    english=ChatPromptTemplate.from_template("Answer in English: {question}") | gpt | StrOutputParser(),
)
results = parallel_chain.invoke({"question": "What is machine learning?"})
print(results["korean"])
print(results["english"])

# 람다 함수 포함
def count_words(text: str) -> dict:
    return {"text": text, "word_count": len(text.split())}

analysis_chain = (
    ChatPromptTemplate.from_template("다음을 요약하세요: {text}")
    | claude
    | StrOutputParser()
    | RunnableLambda(count_words)
)
result = analysis_chain.invoke({"text": "긴 문서 내용..."})
print(f"요약: {result['text']}, 단어 수: {result['word_count']}")

# 비동기 스트리밍
import asyncio

async def stream_response():
    async for chunk in chain.astream({"domain": "AI", "language": "한국어",
                                       "history": [], "question": "LLM이란?"}):
        print(chunk, end="", flush=True)

asyncio.run(stream_response())
```

## ④ LangChain 에이전트

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.tools import tool
from langchain_community.tools.ddg_search import DuckDuckGoSearchRun

# @tool 데코레이터로 도구 정의
@tool
def get_current_time(timezone: str = "Asia/Seoul") -> str:
    """현재 시각을 반환합니다. timezone: 타임존 문자열."""
    from datetime import datetime
    import pytz
    tz = pytz.timezone(timezone)
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S %Z")

@tool
def calculate(expression: str) -> float:
    """수학 표현식을 계산합니다. 예: '2 + 3 * 4'"""
    import ast
    return ast.literal_eval(expression)

# 도구 목록
tools = [
    get_current_time,
    calculate,
    DuckDuckGoSearchRun(),  # 웹 검색
]

# 에이전트 프롬프트
agent_prompt = ChatPromptTemplate.from_messages([
    ("system", "당신은 유능한 AI 어시스턴트입니다. 필요한 경우 도구를 사용하세요."),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# 에이전트 생성
agent = create_tool_calling_agent(claude, tools, agent_prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,           # 추론 과정 출력
    max_iterations=10,      # 최대 반복 횟수
    handle_parsing_errors=True,
)

result = agent_executor.invoke({
    "input": "지금 서울 시각은 몇 시이고, 그 숫자의 제곱은 얼마인가요?"
})
print(result["output"])
```

## ⑤ 대화 메모리

```python
from langchain.memory import ConversationBufferWindowMemory, ConversationSummaryMemory
from langchain.chains import ConversationChain

# 최근 K턴만 기억 (토큰 절약)
memory = ConversationBufferWindowMemory(
    k=10,                    # 최근 10턴 유지
    return_messages=True,
    memory_key="chat_history",
)

# 오래된 대화는 요약으로 압축
summary_memory = ConversationSummaryMemory(
    llm=claude,
    return_messages=True,
    memory_key="chat_history",
)

# 에이전트에 메모리 추가
agent_with_memory = AgentExecutor(
    agent=agent,
    tools=tools,
    memory=memory,
    verbose=True,
)

# 다턴 대화
agent_with_memory.invoke({"input": "내 이름은 김철수야"})
response = agent_with_memory.invoke({"input": "내 이름이 뭐라고 했지?"})
print(response["output"])  # "김철수라고 하셨습니다."
```

## RAG (Retrieval-Augmented Generation) 체인

LangChain의 가장 대표적인 사용 사례다.

```python
from langchain_community.document_loaders import PyPDFLoader, WebBaseLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.runnables import RunnablePassthrough

# 문서 로드 및 분할
loader = PyPDFLoader("/path/to/document.pdf")
docs = loader.load()

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
)
chunks = splitter.split_documents(docs)

# 벡터 스토어 구축
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    persist_directory="./chroma_db",
)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# RAG 프롬프트
rag_prompt = ChatPromptTemplate.from_template("""
다음 컨텍스트를 바탕으로 질문에 답하세요.
컨텍스트에 없는 내용은 "정보가 없습니다"라고 답하세요.

컨텍스트:
{context}

질문: {question}
""")

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# LCEL RAG 체인
rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | rag_prompt
    | claude
    | StrOutputParser()
)

answer = rag_chain.invoke("MCP 프로토콜의 주요 구성 요소는?")
print(answer)
```

## LangChain vs 직접 구현

```python
# 직접 구현 (Anthropic SDK)
from anthropic import Anthropic
client = Anthropic()
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "파이썬이란?"}],
)
print(response.content[0].text)

# LangChain (추상화 레이어 추가)
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage
llm = ChatAnthropic(model="claude-sonnet-4-6")
response = llm.invoke([HumanMessage(content="파이썬이란?")])
print(response.content)

# 선택 기준:
# 직접 구현: 단순 호출, 성능 최적화 필요, 의존성 최소화
# LangChain: RAG+메모리+에이전트 조합, 빠른 프로토타이핑, 모델 교체 유연성
```

## 정리

LangChain은 LLM 애플리케이션의 **모든 구성 요소를 모듈화**한 프레임워크다:

- **LCEL**: `|` 연산자로 선언적 체인 구성, 스트리밍·배치·비동기 자동 지원
- **에이전트**: `@tool` 데코레이터로 도구 정의, `create_tool_calling_agent`로 즉시 사용
- **메모리**: 대화 히스토리를 자동 관리, 토큰 최적화 내장
- **RAG**: 문서 로더 → 분할 → 임베딩 → 검색 → 생성 파이프라인 표준화

단순한 LLM 호출에는 SDK 직접 사용이 낫지만, RAG·에이전트·메모리를 조합하는 복잡한 시스템에서 LangChain은 개발 시간을 크게 줄여준다.

---

**지난 글:** [MCP 프로토콜 심층: 서버 구현과 통합](/posts/agent-mcp-protocol/)

**다음 글:** [LangGraph 완전 가이드: 상태 기반 에이전트 워크플로우](/posts/agent-langgraph/)

<br>
읽어주셔서 감사합니다. 😊
