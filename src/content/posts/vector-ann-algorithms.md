---
title: "ANN 알고리즘 완전 정복: HNSW·IVF·LSH 비교 분석"
description: "수백만 벡터에서 빠르게 유사 항목을 찾는 근사 최근접 이웃(ANN) 알고리즘을 깊이 이해한다. HNSW, IVF, LSH의 구조와 원리, recall-speed 트레이드오프, 실전 선택 기준까지 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["ANN", "HNSW", "IVF", "LSH", "벡터검색", "근사최근접이웃", "인덱스"]
featured: false
draft: false
---

[지난 글](/posts/vector-similarity-metrics/)에서 코사인 유사도, 유클리드 거리, 내적이 어떻게 다르고 언제 무엇을 써야 하는지 배웠다. 이제 수십만~수억 개의 벡터 중에서 빠르게 가장 유사한 것을 찾는 방법, 즉 **근사 최근접 이웃(ANN, Approximate Nearest Neighbor)** 알고리즘을 살펴볼 차례다.

## 왜 선형 탐색으로는 안 되는가

백만 개의 1536차원 벡터가 있다고 하자. 쿼리 하나에 대한 선형 탐색(Brute Force)은 어떤 비용이 드는가?

- 연산 수: 1,000,000 × 1,536 = 약 15억 번의 부동소수점 곱셈·덧셈
- 단일 스레드 CPU에서 약 1~3초
- 실시간 서비스(p99 < 100ms 요구)는 불가능

벡터 수가 늘수록 선형으로 시간이 늘어난다. 100억 개라면 수십 분이 걸릴 수도 있다. ANN은 **정확도를 약간 희생하는 대신 탐색 공간을 극적으로 줄여** 수십~수백 배 빠른 검색을 가능하게 한다.

## 세 가지 대표 ANN 알고리즘

![ANN 알고리즘 3종 비교](/assets/posts/vector-ann-algorithms-types.svg)

## HNSW: 계층형 그래프 탐색

**HNSW(Hierarchical Navigable Small World)** 는 현재 가장 널리 쓰이는 ANN 알고리즘이다. 2016년 Malkov & Yashunin이 발표했으며, 대부분의 주요 벡터 DB(Pinecone, Weaviate, Qdrant, pgvector)가 기본 알고리즘으로 채택하고 있다.

### 핵심 아이디어: 작은 세계 그래프

HNSW는 소셜 네트워크에서 유래한 **Small World** 개념을 활용한다. 어떤 두 사람도 6단계 이내의 연결고리로 이어진다는 "6도 분리" 이론처럼, 그래프 탐색으로 빠르게 최근접 이웃을 찾는다.

여기에 **계층적 구조**를 추가한다. 상위 레이어는 노드 수가 적어 빠른 거친 탐색을 하고, 하위 레이어는 조밀한 연결로 정밀 탐색을 한다.

![HNSW 계층 구조](/assets/posts/vector-ann-algorithms-hnsw.svg)

### 탐색 과정

1. 최상위 레이어의 진입점(Entry Point)에서 출발
2. 현재 레이어에서 쿼리에 더 가까운 이웃을 탐욕적으로 이동
3. 더 가까운 이웃이 없으면 한 레이어 아래로 이동
4. Layer 0에 도달하면 정밀 탐색으로 최종 top-k 반환

```python
import hnswlib
import numpy as np

def build_hnsw_index(
    vectors: np.ndarray,
    dim: int,
    max_elements: int,
    ef_construction: int = 200,  # 인덱스 구축 시 탐색 깊이
    M: int = 16,                  # 노드당 최대 연결 수
) -> hnswlib.Index:
    """HNSW 인덱스 구축"""
    index = hnswlib.Index(space='cosine', dim=dim)
    index.init_index(
        max_elements=max_elements,
        ef_construction=ef_construction,
        M=M,
    )
    ids = np.arange(len(vectors))
    index.add_items(vectors, ids)
    return index

def hnsw_search(
    index: hnswlib.Index,
    query: np.ndarray,
    top_k: int = 10,
    ef: int = 50,  # 쿼리 시 탐색 깊이 (ef >= top_k)
) -> tuple[list[int], list[float]]:
    """HNSW 근사 검색"""
    index.set_ef(ef)  # 높을수록 recall↑, 속도↓
    labels, distances = index.knn_query(query.reshape(1, -1), k=top_k)
    return labels[0].tolist(), distances[0].tolist()

# 사용 예시
dim = 128
n_vectors = 100_000

# 랜덤 벡터 생성 (실제로는 임베딩)
vectors = np.random.randn(n_vectors, dim).astype(np.float32)
# 정규화
norms = np.linalg.norm(vectors, axis=1, keepdims=True)
vectors = vectors / norms

index = build_hnsw_index(vectors, dim, max_elements=n_vectors)

query = np.random.randn(dim).astype(np.float32)
query = query / np.linalg.norm(query)

ids, dists = hnsw_search(index, query, top_k=5)
print("상위 5개 결과 ID:", ids)
print("코사인 거리:", [f"{d:.4f}" for d in dists])
```

### HNSW 핵심 파라미터

| 파라미터 | 역할 | 기본값 | 높이면 |
|----------|------|--------|--------|
| `M` | 노드당 최대 연결 수 | 16 | recall↑, 메모리↑ |
| `ef_construction` | 인덱스 구축 품질 | 200 | recall↑, 구축 시간↑ |
| `ef` (쿼리) | 쿼리 탐색 깊이 | 50 | recall↑, 지연↑ |

## IVF: 클러스터 기반 분할

**IVF(Inverted File Index)** 는 벡터 공간을 먼저 클러스터로 나누고, 쿼리와 가까운 클러스터만 탐색하는 방식이다. Faiss 라이브러리로 유명하다.

### 핵심 아이디어

1. **인덱스 구축**: k-Means로 벡터를 `nlist`개 클러스터로 나눔. 각 클러스터의 중심(centroid)을 저장
2. **쿼리 탐색**: 쿼리와 가장 가까운 `nprobe`개 클러스터만 선택하여 탐색

```python
import faiss
import numpy as np

def build_ivf_index(
    vectors: np.ndarray,
    dim: int,
    nlist: int = 100,   # 클러스터 수 (sqrt(N) 권장)
) -> faiss.IndexIVFFlat:
    """IVF Flat 인덱스 구축"""
    quantizer = faiss.IndexFlatIP(dim)  # 내적 기반 양자화기
    index = faiss.IndexIVFFlat(
        quantizer, dim, nlist,
        faiss.METRIC_INNER_PRODUCT,
    )
    # 학습 단계 필수 (k-Means)
    index.train(vectors)
    index.add(vectors)
    return index

def ivf_search(
    index: faiss.IndexIVFFlat,
    query: np.ndarray,
    top_k: int = 10,
    nprobe: int = 10,   # 탐색할 클러스터 수 (높을수록 recall↑)
) -> tuple[list[int], list[float]]:
    """IVF 근사 검색"""
    index.nprobe = nprobe
    distances, indices = index.search(query.reshape(1, -1), top_k)
    return indices[0].tolist(), distances[0].tolist()

# Recall vs Speed 트레이드오프 테스트
dim = 128
n_vectors = 100_000
vectors = np.random.randn(n_vectors, dim).astype(np.float32)
faiss.normalize_L2(vectors)  # L2 정규화 (내적 = 코사인)

index = build_ivf_index(vectors, dim, nlist=int(np.sqrt(n_vectors)))

query = np.random.randn(1, dim).astype(np.float32)
faiss.normalize_L2(query)

# nprobe별 recall 비교 (실제로는 ground truth와 비교)
for nprobe in [1, 5, 10, 50, 100]:
    ids, _ = ivf_search(index, query[0], top_k=10, nprobe=nprobe)
    print(f"nprobe={nprobe:3d}: {len(ids)}개 후보 (recall 증가)")
```

## LSH: 해시 기반 근사

**LSH(Locality Sensitive Hashing)** 는 유사한 벡터가 동일한 해시 버킷에 들어갈 확률이 높도록 설계된 해시 함수를 사용한다.

### 핵심 아이디어

임의의 초평면(hyperplane)을 여러 개 생성한다. 각 벡터를 초평면의 어느 쪽에 있는지 0/1로 인코딩한다. 같은 해시 코드(또는 비슷한 코드)의 버킷에 있는 벡터들만 비교한다.

```python
import numpy as np
from collections import defaultdict

class RandomProjectionLSH:
    """랜덤 프로젝션 LSH (코사인 유사도용)"""

    def __init__(self, dim: int, n_bits: int = 16, n_tables: int = 4):
        self.dim = dim
        self.n_bits = n_bits
        self.n_tables = n_tables
        # 각 테이블마다 n_bits개의 랜덤 초평면
        self.planes = [
            np.random.randn(n_bits, dim)
            for _ in range(n_tables)
        ]
        self.tables: list[dict] = [
            defaultdict(list) for _ in range(n_tables)
        ]
        self.vectors: list[np.ndarray] = []

    def _hash(self, vec: np.ndarray, table_idx: int) -> str:
        """벡터를 n_bits 이진 해시로 변환"""
        proj = self.planes[table_idx] @ vec
        return ''.join('1' if p > 0 else '0' for p in proj)

    def add(self, vec: np.ndarray, doc_id: int):
        """벡터 추가"""
        self.vectors.append(vec)
        for i in range(self.n_tables):
            h = self._hash(vec, i)
            self.tables[i][h].append(doc_id)

    def search(
        self, query: np.ndarray, top_k: int = 5
    ) -> list[tuple[int, float]]:
        """LSH 근사 탐색"""
        candidates = set()
        for i in range(self.n_tables):
            h = self._hash(query, i)
            candidates.update(self.tables[i].get(h, []))

        if not candidates:
            return []

        # 후보들 중에서 정확한 유사도로 재정렬
        scored = []
        for doc_id in candidates:
            sim = float(np.dot(query, self.vectors[doc_id]))
            scored.append((doc_id, sim))

        return sorted(scored, key=lambda x: x[1], reverse=True)[:top_k]
```

LSH는 매우 빠르고 메모리 효율적이지만, 정밀도(recall)가 HNSW·IVF보다 낮다. 초대용량 데이터셋(수십억 개)에서 낮은 recall이 허용되는 사전 필터링 단계에서 유용하다.

## Recall-Speed 트레이드오프

세 알고리즘의 특성을 정리하면 다음과 같다.

```
정밀도(Recall@10)
  ↑
  │  ●──── HNSW (ef=200)
  │  ●── HNSW (ef=50)
  │    ●── IVF (nprobe=50)
  │      ●── IVF (nprobe=10)
  │            ●── LSH (4 tables)
  └───────────────────────────→ QPS (쿼리/초)
```

**HNSW**가 동일 recall에서 가장 빠른 쿼리 속도를 제공한다. 다만 메모리를 가장 많이 쓴다. 1백만 벡터·1536차원 기준으로 HNSW는 약 6~10GB를 사용할 수 있다.

## 실전 알고리즘 선택 가이드

### 언제 HNSW를 선택하나

- 최고 수준의 recall이 필요한 경우
- 실시간 벡터 삽입·삭제가 필요한 경우 (동적 인덱스)
- 메모리가 충분한 경우 (RAM 넉넉)
- 대부분의 프로덕션 RAG·시맨틱 검색 시스템

### 언제 IVF를 선택하나

- 메모리 제약이 있는 경우
- 배치 인덱싱이 주 패턴인 경우 (실시간 삽입 드묾)
- 수억 개 이상 초대규모 데이터셋 (IVF + PQ 조합)
- Faiss를 직접 사용하는 경우

### 언제 LSH를 선택하나

- 초고속 사전 필터링 단계
- 극단적 메모리 제약 환경
- recall 80% 미만도 허용되는 응용
- 학습이 필요 없는 스트리밍 시나리오

```python
# 알고리즘 선택 의사결정 예시
def choose_ann_algorithm(
    n_vectors: int,
    ram_gb: float,
    dim: int,
    require_dynamic: bool,
    target_recall: float,
) -> str:
    # 메모리 추정: HNSW는 벡터당 약 dim*4*2 bytes + 그래프 오버헤드
    hnsw_mem_gb = n_vectors * dim * 4 * 2.5 / 1e9

    if require_dynamic and hnsw_mem_gb <= ram_gb:
        return "HNSW (동적 삽입 지원, 고성능)"
    elif target_recall >= 0.95 and hnsw_mem_gb <= ram_gb:
        return "HNSW (최고 recall)"
    elif n_vectors > 10_000_000:
        return "IVF + PQ (초대규모, 메모리 압축)"
    elif hnsw_mem_gb > ram_gb:
        return "IVF Flat (메모리 절약)"
    else:
        return "LSH (초고속 근사, 낮은 recall 허용)"

print(choose_ann_algorithm(
    n_vectors=1_000_000,
    ram_gb=16.0,
    dim=1536,
    require_dynamic=True,
    target_recall=0.95,
))
# → "HNSW (동적 삽입 지원, 고성능)"
```

## 양자화(Quantization)로 메모리 절감

대규모 벡터 저장에서 메모리 비용을 줄이는 핵심 기술이 **양자화(Quantization)** 다.

- **PQ(Product Quantization)**: 벡터를 서브벡터로 분해하여 각각 코드북으로 압축. 32~64배 메모리 절감, recall 약간 저하
- **SQ(Scalar Quantization)**: float32를 int8로 변환. 4배 메모리 절감, recall 거의 유지
- **Binary Quantization**: 각 차원을 1비트로. 32배 절감, recall 대폭 저하

```python
# Faiss IVF + PQ 조합 예시
def build_ivf_pq_index(
    vectors: np.ndarray,
    dim: int,
    nlist: int = 100,
    m: int = 8,       # PQ 서브벡터 수 (dim의 약수여야 함)
    nbits: int = 8,   # 서브벡터당 비트 수
) -> faiss.IndexIVFPQ:
    """IVF + PQ: 메모리 효율적 대규모 인덱스"""
    quantizer = faiss.IndexFlatL2(dim)
    index = faiss.IndexIVFPQ(quantizer, dim, nlist, m, nbits)
    index.train(vectors)
    index.add(vectors)
    return index
```

## 마무리: 알고리즘보다 데이터 품질이 먼저

ANN 알고리즘 선택도 중요하지만, 더 중요한 것은 **임베딩 모델의 품질**이다. 최고의 ANN 알고리즘도 저품질 임베딩을 빠르게 탐색할 뿐이다. 임베딩 모델 선택 → 유사도 지표 선택 → ANN 알고리즘 선택 순서로 접근하는 것이 올바른 설계 방향이다.

---

**지난 글:** [벡터 유사도 지표: 코사인·유클리드·내적의 모든 것](/posts/vector-similarity-metrics/)

**다음 글:** [벡터 데이터베이스 비교: Pinecone·Weaviate·Milvus·Qdrant·Chroma](/posts/vector-db-comparison/)

<br>
읽어주셔서 감사합니다. 😊
