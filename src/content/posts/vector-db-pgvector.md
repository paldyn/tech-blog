---
title: "pgvector 완전 정복: PostgreSQL로 벡터 검색 구현하기"
description: "PostgreSQL 확장인 pgvector를 활용해 기존 RDB 인프라에서 벡터 검색을 구현하는 방법을 완전히 이해한다. 설치부터 인덱싱, HNSW 설정, 실전 RAG 연동까지 SQL과 Python 코드로 한국어 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["pgvector", "PostgreSQL", "벡터검색", "벡터DB", "RAG", "SQL", "임베딩"]
featured: false
draft: false
---

[지난 글](/posts/vector-db-comparison/)에서 Pinecone, Weaviate, Milvus, Qdrant, Chroma 다섯 가지 벡터 DB를 비교했다. 기존 PostgreSQL 인프라를 운영 중인 팀이라면 별도 벡터 DB 없이 **pgvector** 확장 하나로 벡터 검색을 구현하는 것이 가장 현실적인 선택일 수 있다. 이번 글에서는 pgvector를 처음부터 끝까지 완전히 파헤친다.

## pgvector란

**pgvector**는 PostgreSQL에 벡터 데이터 타입과 유사도 연산자, ANN 인덱스를 추가하는 오픈소스 확장이다. 2021년 GitHub에 공개되었으며 현재(2026) 가장 많이 쓰이는 PostgreSQL 벡터 확장이다.

핵심 가치는 하나다: **벡터 검색을 기존 PostgreSQL 워크플로우 안에서 처리할 수 있다.** 별도 벡터 DB 서버, 별도 SDK, 별도 모니터링이 필요 없다. SQL을 이미 알면 곧바로 시작할 수 있다.

![pgvector 아키텍처](/assets/posts/vector-db-pgvector-arch.svg)

## 설치 및 설정

### Docker로 빠른 시작

```bash
# pgvector가 내장된 PostgreSQL 이미지 실행
docker run -d \
  --name pgvector-demo \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=vectordb \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# 접속
psql -h localhost -U postgres -d vectordb
```

### 기존 PostgreSQL에 설치

```bash
# Ubuntu/Debian
sudo apt install postgresql-16-pgvector

# macOS (Homebrew)
brew install pgvector

# 소스 빌드
cd /tmp
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make && sudo make install
```

## 핵심 SQL: 설치부터 검색까지

![pgvector 핵심 SQL](/assets/posts/vector-db-pgvector-sql.svg)

pgvector의 전체 워크플로우를 SQL로 살펴보자.

```sql
-- 1. 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 문서 테이블 생성
CREATE TABLE documents (
  id        SERIAL PRIMARY KEY,
  content   TEXT NOT NULL,
  metadata  JSONB DEFAULT '{}',
  embedding vector(1536)  -- OpenAI text-embedding-3-small 차원
);

-- 3. HNSW 인덱스 생성 (코사인 거리)
CREATE INDEX ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. 유사도 검색 (코사인 거리 기반)
-- <=> 연산자: 코사인 거리 (0=동일, 2=완전 반대)
SELECT
  id,
  content,
  1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM documents
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;

-- 5. 메타데이터 필터링 + 벡터 검색 조합
SELECT
  id,
  content,
  metadata->>'category' AS category,
  1 - (embedding <=> $1) AS similarity
FROM documents
WHERE metadata->>'category' = 'tech'
  AND 1 - (embedding <=> $1) > 0.7  -- 최소 유사도 임계값
ORDER BY embedding <=> $1
LIMIT 10;
```

## 세 가지 거리 연산자

pgvector는 세 가지 유사도 측정 연산자를 제공한다.

| 연산자 | 의미 | 인덱스 옵션 |
|--------|------|------------|
| `<=>` | 코사인 거리 | `vector_cosine_ops` |
| `<->` | 유클리드 거리 | `vector_l2_ops` |
| `<#>` | 음수 내적 | `vector_ip_ops` |

텍스트 임베딩에는 코사인(`<=>`)이 기본이다. 내적(`<#>`)은 결과가 음수 내적이라 역순 정렬이 필요하다.

```sql
-- 내적 기반 검색 (주의: ORDER BY <#>는 오름차순이 높은 유사도)
SELECT content, -(embedding <#> $1) AS dot_score
FROM documents
ORDER BY embedding <#> $1   -- 음수 내적이 작을수록 유사도 높음
LIMIT 5;

-- 유클리드 거리 기반 검색
SELECT content, embedding <-> $1 AS distance
FROM documents
ORDER BY embedding <-> $1   -- 거리가 작을수록 유사
LIMIT 5;
```

## Python 연동: 실전 RAG 파이프라인

psycopg3와 OpenAI 임베딩을 조합한 완전한 RAG 파이프라인을 구현해보자.

```python
import psycopg
import numpy as np
from openai import OpenAI
from typing import Optional

openai_client = OpenAI()

DB_URL = "postgresql://postgres:secret@localhost:5432/vectordb"

def get_embedding(text: str) -> list[float]:
    """OpenAI text-embedding-3-small로 임베딩 생성"""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding

def upsert_document(
    conn: psycopg.Connection,
    content: str,
    metadata: dict,
) -> int:
    """문서 임베딩 생성 후 DB 저장"""
    embedding = get_embedding(content)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO documents (content, metadata, embedding)
            VALUES (%s, %s, %s::vector)
            RETURNING id
            """,
            (content, psycopg.types.json.Jsonb(metadata), embedding),
        )
        doc_id = cur.fetchone()[0]
    conn.commit()
    return doc_id

def semantic_search(
    conn: psycopg.Connection,
    query: str,
    top_k: int = 5,
    category: Optional[str] = None,
    min_similarity: float = 0.0,
) -> list[dict]:
    """벡터 유사도 검색 + 메타데이터 필터링"""
    query_embedding = get_embedding(query)

    sql = """
        SELECT
            id,
            content,
            metadata,
            1 - (embedding <=> %s::vector) AS similarity
        FROM documents
        WHERE 1=1
    """
    params: list = [query_embedding]

    if category:
        sql += " AND metadata->>'category' = %s"
        params.append(category)

    if min_similarity > 0:
        sql += " AND 1 - (embedding <=> %s::vector) >= %s"
        params.extend([query_embedding, min_similarity])

    sql += " ORDER BY embedding <=> %s::vector LIMIT %s"
    params.extend([query_embedding, top_k])

    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    return [
        {
            "id": row[0],
            "content": row[1],
            "metadata": row[2],
            "similarity": float(row[3]),
        }
        for row in rows
    ]
```

## HNSW 파라미터 튜닝

pgvector의 HNSW 인덱스는 두 단계 파라미터를 가진다: 인덱스 구축 시와 쿼리 시.

```sql
-- 인덱스 구축 파라미터
CREATE INDEX ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (
    m = 16,              -- 노드당 최대 연결 수 (기본: 16, 범위: 2~100)
    ef_construction = 64 -- 구축 시 탐색 깊이 (기본: 64, 높을수록 recall↑)
  );

-- 쿼리 시 탐색 깊이 설정 (세션 레벨)
SET hnsw.ef_search = 100;  -- 기본: 40, top_k보다 크거나 같아야 함

-- 트랜잭션 레벨로 일시 변경
BEGIN;
SET LOCAL hnsw.ef_search = 200;
SELECT ... FROM documents ORDER BY embedding <=> $1 LIMIT 10;
COMMIT;
```

recall과 속도의 트레이드오프를 수치로 확인하려면 pgbench나 EXPLAIN ANALYZE를 활용한다.

```sql
-- 실행 계획 확인 (인덱스 사용 여부)
EXPLAIN (ANALYZE, BUFFERS)
SELECT content, 1 - (embedding <=> '[...]'::vector) AS sim
FROM documents
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;

-- 예상 출력:
-- Limit (cost=... rows=10)
--   -> Index Scan using documents_embedding_idx on documents
--        Order By: (embedding <=> '[...]'::vector)
```

## IVFFlat 인덱스: 메모리 제약 환경에서

HNSW가 메모리를 너무 많이 사용한다면 IVFFlat 인덱스를 고려할 수 있다.

```sql
-- IVFFlat 인덱스 생성
-- lists: 클러스터 수 (rows/1000 또는 sqrt(rows) 권장)
CREATE INDEX ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 쿼리 시 탐색 클러스터 수 설정
SET ivfflat.probes = 10;  -- 기본: 1, 높을수록 recall↑

-- IVFFlat은 학습이 필요하므로 충분한 데이터 삽입 후 생성 권장
-- (최소 lists * 32개 이상의 행)
```

## 배치 임베딩 인제스천

대량의 문서를 처음 인덱싱할 때는 배치 처리가 중요하다.

```python
import asyncio
import psycopg
from openai import AsyncOpenAI

async_openai = AsyncOpenAI()

async def embed_batch(texts: list[str]) -> list[list[float]]:
    """OpenAI API 배치 임베딩 (최대 2048개/요청)"""
    response = await async_openai.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [r.embedding for r in response.data]

async def bulk_ingest(
    documents: list[dict],  # {"content": str, "metadata": dict}
    batch_size: int = 100,
):
    """대량 문서 배치 임베딩 및 저장"""
    conn = await psycopg.AsyncConnection.connect(DB_URL)

    for i in range(0, len(documents), batch_size):
        batch = documents[i : i + batch_size]
        texts = [doc["content"] for doc in batch]
        embeddings = await embed_batch(texts)

        # executemany로 배치 삽입
        async with conn.cursor() as cur:
            await cur.executemany(
                """
                INSERT INTO documents (content, metadata, embedding)
                VALUES (%s, %s, %s::vector)
                """,
                [
                    (
                        doc["content"],
                        psycopg.types.json.Jsonb(doc["metadata"]),
                        emb,
                    )
                    for doc, emb in zip(batch, embeddings)
                ],
            )
        await conn.commit()
        print(f"진행: {min(i + batch_size, len(documents))}/{len(documents)}")

    await conn.close()
```

## pgvector vs 전용 벡터 DB

pgvector를 언제 선택하고, 언제 전용 벡터 DB로 이전해야 할까?

**pgvector가 최선인 경우**:
- PostgreSQL을 이미 운영 중 (추가 인프라 없음)
- 수십만 벡터 이하 규모
- 벡터 검색이 메인이 아닌 보조 기능
- 메타데이터 필터링이 복잡하고 SQL JOIN이 필요
- 팀이 PostgreSQL에 익숙

**전용 벡터 DB가 필요한 경우**:
- 수억 벡터 이상 초대규모 (Milvus, Qdrant)
- 벡터 검색 쿼리가 초당 수천 건 이상
- 멀티모달 검색 (Weaviate)
- 완전 관리형 SaaS 필요 (Pinecone)

실전에서는 **pgvector로 시작하고, 규모가 커지면 전환**하는 전략이 효과적이다. pgvector API와 전용 벡터 DB API는 추상화 레이어를 두면 교체 비용을 최소화할 수 있다.

```python
from abc import ABC, abstractmethod

class VectorStore(ABC):
    """벡터 저장소 추상 인터페이스"""

    @abstractmethod
    def upsert(self, id: str, vector: list[float], metadata: dict) -> None: ...

    @abstractmethod
    def search(
        self, query_vector: list[float], top_k: int, filters: dict
    ) -> list[dict]: ...

class PgVectorStore(VectorStore):
    """pgvector 구현체"""
    def __init__(self, conn_str: str): ...
    def upsert(self, ...): ...    # SQL INSERT
    def search(self, ...): ...    # SQL SELECT ... ORDER BY <=>

class QdrantVectorStore(VectorStore):
    """Qdrant 구현체 (pgvector 한계 도달 시 교체)"""
    def __init__(self, host: str, port: int): ...
    def upsert(self, ...): ...    # Qdrant upsert
    def search(self, ...): ...    # Qdrant search

# 인터페이스 교체만으로 벡터 DB 전환 가능
store: VectorStore = PgVectorStore(DB_URL)
# store = QdrantVectorStore("localhost", 6333)  # 규모 커지면 한 줄 변경
```

pgvector는 "완벽한" 벡터 DB가 아니다. 하지만 PostgreSQL의 강력한 SQL 생태계, 트랜잭션 보장, 기존 운영 경험을 그대로 활용하면서 벡터 검색을 시작하는 가장 실용적인 방법이다. 다음 글에서는 이 모든 것을 하나로 묶은 **RAG(검색 증강 생성)** 시스템을 구현한다.

---

**지난 글:** [벡터 데이터베이스 비교: Pinecone·Weaviate·Milvus·Qdrant·Chroma](/posts/vector-db-comparison/)

**다음 글:** [RAG 완전 정복: 검색 증강 생성의 핵심 원리](/posts/rag-basics/)

<br>
읽어주셔서 감사합니다. 😊
