---
title: "벡터 데이터베이스 비교: Pinecone·Weaviate·Milvus·Qdrant·Chroma"
description: "주요 벡터 데이터베이스 5종을 배포 방식, 성능, 기능, 비용 관점에서 체계적으로 비교한다. Pinecone, Weaviate, Milvus, Qdrant, Chroma 각각의 강점과 약점, 상황별 선택 가이드를 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["벡터DB", "Pinecone", "Weaviate", "Milvus", "Qdrant", "Chroma", "벡터검색"]
featured: false
draft: false
---

[지난 글](/posts/vector-ann-algorithms/)에서 HNSW, IVF, LSH가 어떻게 수백만 개의 벡터를 빠르게 탐색하는지 살펴봤다. 이제 그 알고리즘들을 실제로 사용하는 도구, 즉 **벡터 데이터베이스(Vector DB)** 를 비교해볼 차례다. 올바른 벡터 DB 선택은 시스템 아키텍처, 팀 운영 부담, 비용에 직접 영향을 미친다.

## 벡터 DB란 정확히 무엇인가

벡터 DB는 단순히 "벡터를 저장하는 데이터베이스"가 아니다. 다음 기능을 함께 제공한다.

- **벡터 저장 및 관리**: 수십억 개 벡터의 CRUD
- **ANN 인덱스**: HNSW, IVF 등 고속 근사 탐색
- **필터링**: 메타데이터 기반 사전/사후 필터링
- **스케일링**: 수평 확장(샤딩), 복제, 고가용성
- **API**: REST, gRPC, SDK

일반 관계형 DB에 벡터 컬럼만 추가한 것과 달리, 전용 벡터 DB는 위 기능 전체를 처음부터 벡터 워크로드에 맞게 설계한다.

## 5대 벡터 DB 한눈에 비교

![주요 벡터 DB 비교표](/assets/posts/vector-db-comparison-table.svg)

## Pinecone

**클라우드 전용 완전 관리형(Fully Managed)** 벡터 DB다. 인프라를 직접 관리할 필요가 없다.

### 주요 특징

- **서버리스 아키텍처**: 사용량에 따라 자동 스케일링
- **강력한 필터링**: 메타데이터 필터를 벡터 검색과 결합
- **네임스페이스**: 멀티테넌시를 위한 논리적 분리
- **Hybrid Search**: 스파스(BM25) + 덴스 벡터 검색 기본 지원

### 장단점

**장점**: 운영 복잡도 제로, 뛰어난 확장성, 안정적인 SLA.

**단점**: 오픈소스가 아님, 데이터가 클라우드에 저장(컴플라이언스 이슈), 벡터 수 증가에 따른 비용.

```python
from pinecone import Pinecone, ServerlessSpec

pc = Pinecone(api_key="YOUR_API_KEY")

# 인덱스 생성
pc.create_index(
    name="my-docs",
    dimension=1536,
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
)
index = pc.Index("my-docs")

# 벡터 업서트
vectors = [
    {"id": "doc1", "values": [0.1] * 1536, "metadata": {"category": "tech"}},
    {"id": "doc2", "values": [0.2] * 1536, "metadata": {"category": "science"}},
]
index.upsert(vectors=vectors)

# 필터링과 결합한 검색
results = index.query(
    vector=[0.1] * 1536,
    top_k=5,
    filter={"category": {"$eq": "tech"}},
    include_metadata=True,
)
for match in results["matches"]:
    print(f"[{match['score']:.3f}] {match['id']}: {match['metadata']}")
```

## Weaviate

**오픈소스이면서 클라우드도 지원**하는 멀티모달 벡터 DB다. GraphQL API가 독특하다.

### 주요 특징

- **멀티모달**: 텍스트·이미지·오디오 통합 검색
- **모듈 시스템**: OpenAI, Cohere 임베딩 모듈 내장
- **GraphQL API**: 복잡한 관계 쿼리 지원
- **BM25 + 벡터 하이브리드**: `hybrid` 파라미터로 쉽게 조합

### 장단점

**장점**: 모듈 생태계, 멀티모달, 강력한 필터링, 오픈소스.

**단점**: GraphQL 학습 곡선, 초기 설정 복잡, 메모리 사용량 높음.

```python
import weaviate
import weaviate.classes as wvc

client = weaviate.connect_to_local()

# 컬렉션 생성
client.collections.create(
    name="Document",
    vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_openai(),
    properties=[
        wvc.config.Property(name="content", data_type=wvc.config.DataType.TEXT),
        wvc.config.Property(name="category", data_type=wvc.config.DataType.TEXT),
    ],
)

collection = client.collections.get("Document")

# 객체 추가
collection.data.insert({
    "content": "벡터 검색 완전 가이드",
    "category": "tech",
})

# 하이브리드 검색 (벡터 + BM25)
results = collection.query.hybrid(
    query="시맨틱 검색 방법",
    alpha=0.75,      # 0=BM25 전용, 1=벡터 전용
    limit=5,
    filters=wvc.query.Filter.by_property("category").equal("tech"),
)
for obj in results.objects:
    print(obj.properties["content"])

client.close()
```

## Milvus

**오픈소스 대규모 벡터 DB**로, 수십억 개 벡터를 처리하는 엔터프라이즈 워크로드에 적합하다. Zilliz Cloud라는 관리형 버전도 있다.

### 주요 특징

- **분산 아키텍처**: etcd, MinIO, Pulsar를 조합한 클라우드 네이티브 설계
- **다양한 인덱스**: HNSW, IVF_FLAT, IVF_PQ, DiskANN 등 지원
- **Milvus Lite**: 경량 버전으로 로컬 개발 가능
- **고성능**: 수십억 벡터에서도 빠른 쿼리

### 장단점

**장점**: 오픈소스 최고 성능, 다양한 인덱스 옵션, 성숙한 생태계.

**단점**: 운영 복잡도 높음(컴포넌트 다수), 소규모에는 과도한 설정.

```python
from pymilvus import (
    connections, FieldSchema, CollectionSchema,
    DataType, Collection, utility,
)
import numpy as np

# 연결
connections.connect("default", host="localhost", port="19530")

# 스키마 정의
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True),
    FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=512),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
]
schema = CollectionSchema(fields, description="문서 컬렉션")
collection = Collection("documents", schema)

# HNSW 인덱스 생성
index_params = {
    "index_type": "HNSW",
    "metric_type": "COSINE",
    "params": {"M": 16, "efConstruction": 200},
}
collection.create_index("embedding", index_params)
collection.load()

# 데이터 삽입
ids = list(range(100))
contents = [f"문서 {i}" for i in ids]
embeddings = np.random.randn(100, 1536).tolist()
collection.insert([ids, contents, embeddings])

# 검색
query_vec = np.random.randn(1, 1536).tolist()
results = collection.search(
    data=query_vec,
    anns_field="embedding",
    param={"metric_type": "COSINE", "params": {"ef": 64}},
    limit=5,
    output_fields=["content"],
)
for hit in results[0]:
    print(f"[{hit.distance:.3f}] {hit.entity.get('content')}")
```

## Qdrant

**Rust로 작성된 고성능 오픈소스 벡터 DB**다. 필터링 성능이 특히 뛰어나다.

### 주요 특징

- **Rust 기반**: 낮은 레이턴시, 안정적인 메모리 사용
- **Payload 필터링**: 강력한 구조화 필터와 벡터 검색 결합
- **Sparse Vectors**: BM25 스파스 벡터 네이티브 지원
- **Named Vectors**: 하나의 포인트에 여러 벡터 저장

### 장단점

**장점**: 필터링 최강, 낮은 레이턴시, Docker 배포 간단.

**단점**: Milvus보다 초대규모 샤딩 성숙도 낮음.

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams,
    PointStruct, Filter, FieldCondition, MatchValue,
)
import numpy as np

client = QdrantClient(host="localhost", port=6333)

# 컬렉션 생성
client.create_collection(
    collection_name="documents",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

# 포인트 삽입
points = [
    PointStruct(
        id=i,
        vector=np.random.randn(1536).tolist(),
        payload={"content": f"문서 {i}", "category": "tech"},
    )
    for i in range(100)
]
client.upsert(collection_name="documents", points=points)

# 필터링 검색
results = client.search(
    collection_name="documents",
    query_vector=np.random.randn(1536).tolist(),
    query_filter=Filter(
        must=[FieldCondition(key="category", match=MatchValue(value="tech"))]
    ),
    limit=5,
)
for r in results:
    print(f"[{r.score:.3f}] {r.payload['content']}")
```

## Chroma

**Python 네이티브 경량 벡터 DB**다. 프로토타입과 소규모 프로젝트에 최적이다.

### 주요 특징

- **설치 단순**: `pip install chromadb` 한 줄
- **임베딩 함수 내장**: OpenAI, HuggingFace 통합
- **영속성 선택 가능**: 인메모리 또는 로컬 디스크
- **LangChain·LlamaIndex 기본 통합**: 가장 쉬운 RAG 연동

### 장단점

**장점**: 세상에서 가장 쉬운 시작, Python 친화적, 학습 비용 제로.

**단점**: 수백만 벡터 이상 성능 저하, 분산 확장 어려움, 필터링 기능 제한.

```python
import chromadb
from chromadb.utils import embedding_functions

# 로컬 영속 DB 생성
client = chromadb.PersistentClient(path="./chroma_db")

# OpenAI 임베딩 함수 사용
openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key="YOUR_API_KEY",
    model_name="text-embedding-3-small",
)

# 컬렉션 생성
collection = client.create_collection(
    name="documents",
    embedding_function=openai_ef,
    metadata={"hnsw:space": "cosine"},
)

# 문서 추가 (임베딩 자동 생성)
collection.add(
    documents=["벡터 검색 기초", "ANN 알고리즘 비교", "pgvector 사용법"],
    ids=["doc1", "doc2", "doc3"],
    metadatas=[
        {"category": "basics"},
        {"category": "advanced"},
        {"category": "tools"},
    ],
)

# 쿼리 (임베딩 자동 생성 후 검색)
results = collection.query(
    query_texts=["데이터베이스에서 유사 문서 찾기"],
    n_results=2,
    where={"category": "basics"},
)
print(results["documents"])
```

## 선택 가이드

![벡터 DB 선택 의사결정 트리](/assets/posts/vector-db-comparison-selection.svg)

### 상황별 권장

**RAG 프로토타입·학습용**: Chroma가 단연 최고다. 설치와 코드가 가장 단순하다.

**스타트업·관리 부담 없애기**: Pinecone. 인프라 팀이 없어도 프로덕션 운영 가능.

**오픈소스로 대규모 운영**: Milvus. 수억 벡터 이상의 엔터프라이즈 워크로드.

**고성능 필터링이 핵심**: Qdrant. 복잡한 메타데이터 필터와 벡터를 결합해야 할 때.

**멀티모달·GraphQL**: Weaviate. 텍스트·이미지를 함께 다루거나 복잡한 데이터 관계.

**기존 PostgreSQL 인프라**: pgvector. 별도 벡터 DB 없이 기존 RDB에 추가.

### 비용 고려사항

클라우드 관리형(Pinecone)은 벡터 수와 쿼리 수에 따라 요금이 청구된다. 백만 벡터·월 100만 쿼리 기준 대략 수십~수백 달러 수준이다.

오픈소스(Milvus, Qdrant, Weaviate)는 소프트웨어 비용은 없지만 인프라(EC2, GKE 등) 비용과 운영 엔지니어링 비용이 발생한다.

10만 벡터 이하의 소규모라면 pgvector가 기존 PostgreSQL 인프라를 활용하여 추가 비용 없이 벡터 검색을 구현하는 최선책이다. 다음 글에서 pgvector를 깊이 살펴본다.

---

**지난 글:** [ANN 알고리즘 완전 정복: HNSW·IVF·LSH 비교 분석](/posts/vector-ann-algorithms/)

**다음 글:** [pgvector 완전 정복: PostgreSQL로 벡터 검색 구현하기](/posts/vector-db-pgvector/)

<br>
읽어주셔서 감사합니다. 😊
