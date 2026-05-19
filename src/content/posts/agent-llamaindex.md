---
title: "LlamaIndex 완전 가이드: 데이터 중심 LLM 프레임워크"
description: "LlamaIndex의 Document 로딩, Node Parser, VectorStoreIndex, Query Engine, SubQuestion, Workflow까지 실전 Python 코드로 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["LlamaIndex", "RAG", "VectorStoreIndex", "QueryEngine", "Workflow", "SubQuestion", "LLM프레임워크"]
featured: false
draft: false
---

[지난 글](/posts/agent-langgraph/)에서 LangGraph로 상태 기반 에이전트 워크플로우를 구성하는 방법을 살펴봤다. 이번 글에서는 **데이터 중심 LLM 프레임워크**인 LlamaIndex를 다룬다. LlamaIndex는 150종 이상의 데이터 커넥터와 강력한 인덱싱·쿼리 파이프라인으로 RAG 시스템 구축에 특화되어 있다.

## LlamaIndex란

LlamaIndex(구 GPT Index)는 **데이터를 LLM이 이해할 수 있는 형태로 인덱싱하고 쿼리하는 데이터 프레임워크**다. LangChain이 에이전트·도구·체인 조합에 강점이 있다면, LlamaIndex는 방대한 문서 컬렉션을 효과적으로 인덱싱하고 검색하는 데 최적화되어 있다.

![LlamaIndex 핵심 아키텍처](/assets/posts/agent-llamaindex-architecture.svg)

## 기본 RAG 파이프라인

```python
from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    Settings,
    StorageContext,
    load_index_from_storage,
)
from llama_index.llms.anthropic import Anthropic
from llama_index.embeddings.openai import OpenAIEmbedding
import os

# 전역 설정 (LLM + 임베딩 모델)
Settings.llm = Anthropic(model="claude-sonnet-4-6", temperature=0)
Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
Settings.chunk_size = 1024
Settings.chunk_overlap = 64

# 문서 로드 (디렉터리 내 모든 파일)
documents = SimpleDirectoryReader("./docs/").load_data()
print(f"로드된 문서: {len(documents)}개")

# 인덱스 생성 (최초 실행)
if not os.path.exists("./storage"):
    index = VectorStoreIndex.from_documents(
        documents,
        show_progress=True,
    )
    index.storage_context.persist(persist_dir="./storage")
else:
    # 기존 인덱스 로드 (재임베딩 없이 빠른 시작)
    storage_context = StorageContext.from_defaults(persist_dir="./storage")
    index = load_index_from_storage(storage_context)

# 쿼리 엔진 생성
query_engine = index.as_query_engine(
    similarity_top_k=5,          # 상위 5개 청크 검색
    response_mode="compact",     # 응답 합성 방식
    streaming=True,              # 스트리밍 활성화
)

# 쿼리 실행
response = query_engine.query("MCP 프로토콜의 핵심 구성 요소는 무엇인가요?")
print(response)

# 참조 소스 확인
for node in response.source_nodes:
    print(f"파일: {node.metadata.get('file_name')}, 점수: {node.score:.3f}")
    print(f"내용 (앞 100자): {node.text[:100]}...")
```

## Node Parser: 청크 전략

Node Parser는 문서를 검색 단위인 **Node**로 분할한다. 분할 전략에 따라 검색 품질이 크게 달라진다.

```python
from llama_index.core.node_parser import (
    SentenceSplitter,
    SemanticSplitterNodeParser,
    HierarchicalNodeParser,
    MarkdownNodeParser,
)
from llama_index.core.ingestion import IngestionPipeline

# 1. 기본 문장 기반 분할
sentence_splitter = SentenceSplitter(
    chunk_size=512,
    chunk_overlap=64,
    paragraph_separator="\n\n",
)

# 2. 의미 기반 분할 (임베딩 유사도로 청크 경계 결정)
semantic_splitter = SemanticSplitterNodeParser(
    buffer_size=1,
    breakpoint_percentile_threshold=95,
    embed_model=Settings.embed_model,
)

# 3. 계층적 분할 (청크 크기별 다단계 인덱싱)
hierarchical_parser = HierarchicalNodeParser.from_defaults(
    chunk_sizes=[2048, 512, 128],
)

# 4. Ingestion Pipeline (ETL 파이프라인)
from llama_index.core.extractors import (
    TitleExtractor,
    QuestionsAnsweredExtractor,
    SummaryExtractor,
)

pipeline = IngestionPipeline(
    transformations=[
        sentence_splitter,
        TitleExtractor(nodes=5),            # 제목 메타데이터 추출
        QuestionsAnsweredExtractor(questions=3),  # 답변 가능한 질문 추출
        Settings.embed_model,               # 임베딩 생성
    ],
)
nodes = pipeline.run(documents=documents)
print(f"생성된 노드: {len(nodes)}개")
```

## 다양한 인덱스 유형

```python
from llama_index.core import (
    VectorStoreIndex,
    SummaryIndex,
    KnowledgeGraphIndex,
)
from llama_index.core.query_engine import RouterQueryEngine
from llama_index.core.selectors import LLMSingleSelector
from llama_index.core.tools import QueryEngineTool

# VectorStoreIndex: 의미적 유사도 검색 (대부분의 RAG 사용 사례)
vector_index = VectorStoreIndex.from_documents(documents)

# SummaryIndex: 전체 문서 요약 (순차 읽기)
summary_index = SummaryIndex.from_documents(documents)

# 쿼리 엔진으로 변환
vector_engine = vector_index.as_query_engine(similarity_top_k=5)
summary_engine = summary_index.as_query_engine(response_mode="tree_summarize")

# RouterQueryEngine: LLM이 적합한 엔진 자동 선택
router_engine = RouterQueryEngine(
    selector=LLMSingleSelector.from_defaults(),
    query_engine_tools=[
        QueryEngineTool.from_defaults(
            query_engine=vector_engine,
            description="특정 개념이나 사실을 검색할 때 사용",
        ),
        QueryEngineTool.from_defaults(
            query_engine=summary_engine,
            description="전체 문서 요약이 필요할 때 사용",
        ),
    ],
)

response = router_engine.query("전체 문서를 요약해줘")  # → summary_engine 선택
response2 = router_engine.query("MCP 프로토콜이 뭐야?")  # → vector_engine 선택
```

## SubQuestion Query Engine

복잡한 질의를 여러 서브 질의로 분해해 각각 처리한 후 통합하는 패턴이다.

![LlamaIndex Workflow & SubQuestion](/assets/posts/agent-llamaindex-workflow.svg)

```python
from llama_index.core.query_engine import SubQuestionQueryEngine
from llama_index.core.tools import QueryEngineTool, ToolMetadata

# 각 데이터 소스별 쿼리 엔진
langchain_engine = VectorStoreIndex.from_documents(
    SimpleDirectoryReader("./docs/langchain/").load_data()
).as_query_engine()

langgraph_engine = VectorStoreIndex.from_documents(
    SimpleDirectoryReader("./docs/langgraph/").load_data()
).as_query_engine()

# 도구로 래핑
tools = [
    QueryEngineTool(
        query_engine=langchain_engine,
        metadata=ToolMetadata(name="langchain", description="LangChain 문서"),
    ),
    QueryEngineTool(
        query_engine=langgraph_engine,
        metadata=ToolMetadata(name="langgraph", description="LangGraph 문서"),
    ),
]

# SubQuestion 엔진 (LLM이 서브 질의 자동 생성)
sub_question_engine = SubQuestionQueryEngine.from_defaults(
    query_engine_tools=tools,
    verbose=True,  # 서브 질의 과정 출력
)

response = sub_question_engine.query(
    "LangChain과 LangGraph의 차이점은 무엇이고, 각각 언제 사용하는가?"
)
# → Sub Q1: "LangChain의 주요 특징은?" (langchain 엔진)
# → Sub Q2: "LangGraph의 주요 특징은?" (langgraph 엔진)
# → 결과 통합 → 최종 답변
print(response)
```

## Workflow: 이벤트 기반 파이프라인

LlamaIndex 0.10 이후 도입된 Workflow는 이벤트와 스텝으로 커스텀 파이프라인을 구성한다.

```python
from llama_index.core.workflow import (
    Workflow,
    StartEvent,
    StopEvent,
    Event,
    step,
)

# 커스텀 이벤트 정의
class RetrieveEvent(Event):
    nodes: list

class SynthesizeEvent(Event):
    context: str
    query: str

class RAGWorkflow(Workflow):
    @step
    async def retrieve(self, ev: StartEvent) -> RetrieveEvent:
        """쿼리로 관련 노드 검색"""
        query = ev.get("query")
        retriever = index.as_retriever(similarity_top_k=5)
        nodes = await retriever.aretrieve(query)
        return RetrieveEvent(nodes=nodes)

    @step
    async def synthesize(self, ev: RetrieveEvent) -> SynthesizeEvent:
        """검색된 노드를 컨텍스트로 합성"""
        context = "\n\n".join(node.text for node in ev.nodes)
        return SynthesizeEvent(context=context, query="...")

    @step
    async def generate(self, ev: SynthesizeEvent) -> StopEvent:
        """LLM으로 최종 답변 생성"""
        response = await Settings.llm.acomplete(
            f"컨텍스트:\n{ev.context}\n\n질문: {ev.query}\n\n답변:"
        )
        return StopEvent(result=str(response))

# 실행
import asyncio

async def run():
    workflow = RAGWorkflow(timeout=60, verbose=True)
    result = await workflow.run(query="LlamaIndex의 핵심 장점은?")
    print(result)

asyncio.run(run())
```

## 외부 벡터 스토어 연동

```python
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.vector_stores.qdrant import QdrantVectorStore
import chromadb

# Chroma 연동
chroma_client = chromadb.PersistentClient(path="./chroma")
chroma_collection = chroma_client.get_or_create_collection("rag_docs")

vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

index = VectorStoreIndex.from_documents(
    documents,
    storage_context=storage_context,
)

# 하이브리드 검색 (키워드 + 벡터)
from llama_index.core.retrievers import VectorIndexRetriever, BM25Retriever
from llama_index.core.retrievers import QueryFusionRetriever

vector_retriever = VectorIndexRetriever(index=index, similarity_top_k=5)
bm25_retriever = BM25Retriever.from_defaults(index=index, similarity_top_k=5)

hybrid_retriever = QueryFusionRetriever(
    retrievers=[vector_retriever, bm25_retriever],
    similarity_top_k=5,
    num_queries=4,      # 쿼리 변형 수 (다양성)
    mode="reciprocal_rerank",  # RRF 방식으로 결과 통합
)

nodes = hybrid_retriever.retrieve("RAG 아키텍처 구성 요소")
```

## LlamaIndex vs LangChain

| 기준 | LlamaIndex | LangChain |
|------|-----------|-----------|
| 핵심 강점 | 데이터 인덱싱·검색 | 에이전트·체인 조합 |
| RAG 파이프라인 | 내장 최적화 | LCEL로 수동 구성 |
| 데이터 커넥터 | 150+ 기본 지원 | 서드파티 의존 |
| 인덱스 유형 | Vector/Summary/KG | 주로 Vector |
| SubQuestion | 기본 내장 | 커스텀 구현 필요 |
| 에이전트 복잡성 | Workflow | LCEL/LangGraph |

## 정리

LlamaIndex는 **데이터를 LLM에게 공급하는 데이터 레이어 전문** 프레임워크다:

- **150+ Reader**: PDF·웹·DB·API 등 다양한 데이터 소스를 동일 인터페이스로 처리
- **Node Parser**: 문장 기반·의미 기반·계층적 분할로 청크 품질 최적화
- **다양한 Index**: VectorStore·Summary·KnowledgeGraph 중 사용 사례에 맞게 선택
- **SubQuestion**: 복잡한 질의를 자동으로 분해해 병렬 처리 후 통합
- **Workflow**: 이벤트 기반 파이프라인으로 커스텀 RAG 흐름 구성

RAG 시스템 구축에는 LlamaIndex, 에이전트·도구 조합에는 LangChain/LangGraph — 두 프레임워크를 함께 사용하는 것이 이상적이다.

---

**지난 글:** [LangGraph 완전 가이드: 상태 기반 에이전트 워크플로우](/posts/agent-langgraph/)

**다음 글:** [CrewAI 완전 가이드: 역할 기반 멀티 에이전트 협업](/posts/agent-crewai/)

<br>
읽어주셔서 감사합니다. 😊
