---
title: "Graph RAG: 지식 그래프로 RAG의 한계를 극복하다"
description: "개체와 관계를 그래프로 표현해 복잡한 추론과 전역적 질문에 답하는 Graph RAG의 원리, Microsoft GraphRAG, Neo4j 기반 구현, 그리고 Vector RAG와의 비교를 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["GraphRAG", "지식그래프", "Neo4j", "RAG", "Microsoft", "LangChain"]
featured: false
draft: false
---

[지난 글](/posts/rag-agentic-rag/)에서 에이전트가 자율적으로 도구를 선택하는 Agentic RAG를 배웠다. 이번에는 전혀 다른 접근법, 문서를 청크로 쪼개는 대신 **개체와 관계를 그래프 구조로 표현**하는 Graph RAG를 다룬다. 2024년 Microsoft Research가 발표한 Graph RAG 논문은 전통적인 벡터 검색 RAG가 "전체 문서를 아우르는 글로벌 질문"에 약하다는 점을 지적하며 지식 그래프를 활용한 대안을 제시했다.

## Vector RAG의 구조적 한계

"회사 전체의 주요 리스크 요인은?"처럼 수백 개 문서를 종합해야 하는 질문을 생각해보자. 벡터 검색은 쿼리와 유사한 몇 개의 청크를 반환하지만, 개별 청크는 전체적인 맥락을 담지 못한다. 또한 "A가 B를 인수했고, B는 C와 파트너십을 맺었다"는 관계적 정보는 청크 경계에서 잘려 분리된 청크에 저장될 수 있다.

Graph RAG는 이 문제를 개체·관계 그래프로 해결한다.

![Vector RAG vs Graph RAG](/assets/posts/rag-graph-rag-vs-vector.svg)

## 지식 그래프의 기본 구조

지식 그래프는 **(노드, 엣지, 노드)** 형태의 트리플로 지식을 표현한다.

```
(삼성전자, CEO, 이재용)
(이재용, 소속, DS사업부)
(DS사업부, 주력제품, 반도체)
(반도체, 경쟁사, TSMC)
```

이 구조를 그래프로 저장하면 "이재용과 관련된 모든 엔티티"를 단 하나의 그래프 탐색으로 찾을 수 있다. 청크 기반 검색에서는 여러 청크를 읽어야 파악할 수 있는 정보를 관계 탐색 하나로 해결한다.

![Graph RAG 파이프라인](/assets/posts/rag-graph-rag-pipeline.svg)

## LangChain으로 지식 그래프 구축

LangChain의 `LLMGraphTransformer`는 LLM을 사용해 문서에서 자동으로 엔티티와 관계를 추출한다.

```python
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_community.graphs import Neo4jGraph
from langchain_anthropic import ChatAnthropic
from langchain.document_loaders import TextLoader

# Neo4j 그래프 데이터베이스 연결
graph = Neo4jGraph(
    url="bolt://localhost:7687",
    username="neo4j",
    password="password"
)

# LLM 기반 그래프 변환기
llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0)
transformer = LLMGraphTransformer(
    llm=llm,
    allowed_nodes=["Person", "Company", "Product", "Technology"],
    allowed_relationships=["CEO", "ACQUIRED", "PRODUCES", "COMPETES_WITH"]
)

# 문서 로드 및 그래프 변환
docs = TextLoader("company_reports.txt").load()
graph_docs = transformer.convert_to_graph_documents(docs)

# Neo4j에 저장
graph.add_graph_documents(graph_docs)
```

## 그래프 기반 검색 구현

지식 그래프가 구축되면 그래프 쿼리로 관련 정보를 탐색한다.

```python
from langchain.chains import GraphCypherQAChain

# Cypher 쿼리 자동 생성 체인
chain = GraphCypherQAChain.from_llm(
    llm=llm,
    graph=graph,
    verbose=True,
    top_k=5
)

# 자연어 → Cypher 쿼리 자동 변환
result = chain.invoke({"query": "삼성전자의 주요 경쟁사와 그 관계는?"})

# 내부에서 생성되는 Cypher 쿼리 예시:
# MATCH (c:Company {name: "삼성전자"})-[:COMPETES_WITH]->(competitor)
# RETURN competitor.name, competitor.sector LIMIT 5
```

## Microsoft GraphRAG

Microsoft Research의 GraphRAG는 더 정교한 접근을 취한다. 단순한 엔티티 그래프 외에 **커뮤니티 요약**을 추가한다.

```python
# Microsoft GraphRAG 설치 및 기본 설정
# pip install graphrag

# 설정 파일 초기화
# graphrag init --root ./ragtest

# 인덱싱 (문서 → 지식 그래프 + 커뮤니티 요약)
# graphrag index --root ./ragtest

# 두 가지 검색 모드
# 1. Local Search: 특정 엔티티 중심의 서브그래프 검색
# graphrag query --root ./ragtest --method local --query "이재용의 경영 전략은?"

# 2. Global Search: 전체 커뮤니티 요약을 활용한 광역 검색
# graphrag query --root ./ragtest --method global --query "회사 전체의 주요 리스크는?"
```

Global Search는 전체 문서를 커뮤니티로 클러스터링하고 각 커뮤니티의 요약을 만든다. 광역적 질문이 들어오면 커뮤니티 요약들을 맵-리듀스 방식으로 종합해 답변한다.

## Graph RAG의 장단점

**강점**:
- 관계적 추론: "A의 CEO의 이전 직장은?" 같은 멀티홉 관계 질문에 탁월
- 전역적 질문: 전체 문서를 아우르는 요약 질문
- 설명 가능성: 어떤 관계를 따라 답변했는지 추적 가능

**약점**:
- 구축 비용: 대용량 문서에서 그래프 추출은 LLM 비용이 높음
- 유지 관리: 문서가 업데이트되면 그래프도 갱신 필요
- 비정형 텍스트: 관계가 명확하지 않은 텍스트에서 추출 품질 저하

현업에서는 Vector RAG와 Graph RAG를 **하이브리드**로 사용하는 경우가 많다. 사실 검색은 벡터 RAG, 관계 추론은 Graph RAG로 질문 유형에 따라 라우팅한다.

---

**지난 글:** [Agentic RAG: 에이전트가 스스로 검색하고 추론하는 시스템](/posts/rag-agentic-rag/)

**다음 글:** [RAG 평가: RAGAS로 검색 품질과 답변 품질 측정하기](/posts/rag-evaluation/)

<br>
읽어주셔서 감사합니다. 😊
