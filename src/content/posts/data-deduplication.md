---
title: "데이터 중복 제거: 정확한 매칭부터 시맨틱 디덥까지"
description: "정확 매칭·퍼지 매칭·시맨틱 임베딩 기반 중복 제거 기법을 비교하고, RapidFuzz·recordlinkage·SentenceTransformers를 활용한 실무 파이프라인을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["데이터중복제거", "Deduplication", "퍼지매칭", "RecordLinkage", "SemDeDup", "데이터품질"]
featured: false
draft: false
---

[지난 글](/posts/data-quality/)에서 데이터 품질의 6대 차원을 살펴봤다. 그 중 **유일성(Uniqueness)**은 중복 제거라는 구체적인 작업으로 구현된다. 중복 데이터는 모델 학습에서 특정 패턴을 과대표집해 편향을 일으키고, 암기(memorization)를 조장한다. LLM 사전 학습 데이터셋에서도 중복 문서를 제거하는 것이 모델 성능과 일반화에 유의미한 영향을 미친다는 연구 결과가 있다.

## 중복의 종류

모든 중복이 같지 않다. 유형을 먼저 파악해야 적절한 기법을 선택할 수 있다.

| 유형 | 예시 | 탐지 난이도 |
|---|---|---|
| 완전 중복 | 동일 row 두 번 적재 | 낮음 |
| 부분 중복 | 오타·약어 포함 | 중간 |
| 레코드 중복 | 다른 시스템의 동일 개체 | 높음 |
| 의미 중복 | 같은 내용 다른 표현 | 매우 높음 |

## 기법 비교

![데이터 중복 제거 기법](/assets/posts/data-deduplication-techniques.svg)

### 정확 매칭

가장 빠르고 확실하다. 해시(MD5, SHA256)를 계산해 동일한 값이면 중복으로 판단한다.

```python
import hashlib
import pandas as pd

def row_hash(row):
    content = '|'.join(str(v) for v in row.values)
    return hashlib.md5(content.encode()).hexdigest()

df['_hash'] = df.apply(row_hash, axis=1)
df_dedup = df.drop_duplicates(subset=['_hash'])
print(f"원본: {len(df)} rows → 중복 제거 후: {len(df_dedup)} rows")
```

Primary Key 중복은 더 간단하다.

```python
# 이메일로 중복 제거 (첫 번째 등장을 유지)
df_dedup = df.drop_duplicates(subset=['email'], keep='first')

# 특정 컬럼 조합으로 중복 탐지
dup_mask = df.duplicated(subset=['name', 'birth_date', 'phone'], keep=False)
duplicates = df[dup_mask]
```

### 퍼지 매칭

오타, 약어, 순서 변경 등으로 완전히 일치하지 않지만 같은 개체를 의미하는 경우 퍼지 매칭이 필요하다.

![중복 제거 코드 예시](/assets/posts/data-deduplication-code.svg)

**RapidFuzz**는 C++ 기반으로 속도가 빠르며 다양한 유사도 알고리즘을 제공한다.

```python
from rapidfuzz import fuzz, process
import pandas as pd

def find_duplicates_fuzzy(df, col='company_name', threshold=85):
    names = df[col].tolist()
    duplicate_pairs = []

    for i, name in enumerate(names):
        matches = process.extract(
            name,
            names[i+1:],
            scorer=fuzz.token_sort_ratio,
            score_cutoff=threshold
        )
        for match, score, idx in matches:
            duplicate_pairs.append((i, i + 1 + idx, score))

    return duplicate_pairs

pairs = find_duplicates_fuzzy(df)
print(f"중복 후보 쌍: {len(pairs)}개")
```

**recordlinkage** 라이브러리는 대규모 데이터에서 효율적인 Record Linkage를 지원한다. 블로킹(Blocking)으로 비교 쌍을 먼저 줄이고, 여러 컬럼의 유사도를 결합해 최종 판단한다.

```python
import recordlinkage

# 블로킹: 우편번호가 같은 쌍만 비교
indexer = recordlinkage.Index()
indexer.block('postal_code')
candidates = indexer.index(df_a, df_b)
print(f"후보 쌍: {len(candidates)} (전체 {len(df_a)*len(df_b)} 중)")

# 여러 컬럼 유사도 계산
compare = recordlinkage.Compare()
compare.exact('customer_id', 'customer_id', label='id')
compare.string('name', 'name', method='jarowinkler', threshold=0.85, label='name')
compare.string('email', 'email', method='levenshtein', label='email')
compare.date('birth_date', 'birth_date', label='birth')

features = compare.compute(candidates, df_a, df_b)

# 임계값 기반 판정 (3개 이상 일치 시 중복)
matches = features[features.sum(axis=1) >= 3]
```

### 시맨틱 중복 제거

텍스트 내용이 의미상 같지만 표현이 다른 경우(LLM 학습 데이터, 뉴스 기사, 고객 문의 등)에는 임베딩 기반 시맨틱 디덥이 효과적이다.

```python
from sentence_transformers import SentenceTransformer, util
import torch
import numpy as np

model = SentenceTransformer('paraphrase-multilingual-mpnet-base-v2')
sentences = df['text'].tolist()

# 배치 인코딩 (GPU 권장)
embeddings = model.encode(
    sentences,
    batch_size=256,
    convert_to_tensor=True,
    show_progress_bar=True
)

# 쌍별 코사인 유사도 (메모리 주의: n²)
threshold = 0.92
to_remove = set()

# 청크 단위로 처리해 메모리 효율화
chunk_size = 1000
for i in range(0, len(sentences), chunk_size):
    chunk = embeddings[i:i+chunk_size]
    scores = util.cos_sim(chunk, embeddings)
    # 자기 자신(대각선) 제외, 이미 제거 예정 제외
    for j, row in enumerate(scores):
        if i + j in to_remove:
            continue
        dups = (row > threshold).nonzero(as_tuple=True)[0]
        for dup_idx in dups:
            if dup_idx.item() > i + j:
                to_remove.add(dup_idx.item())

df_dedup = df.drop(index=list(to_remove)).reset_index(drop=True)
print(f"제거된 의미 중복: {len(to_remove)} / {len(df)}")
```

### MinHash LSH: 초대규모 텍스트 디덥

수십억 개 문서를 처리할 때는 O(n²) 쌍별 비교가 불가능하다. **MinHash + LSH(Locality Sensitive Hashing)**는 실제로 유사한 쌍만 빠르게 찾아낸다.

```python
from datasketch import MinHash, MinHashLSH

def text_to_minhash(text, num_perm=128):
    m = MinHash(num_perm=num_perm)
    for shingle in get_shingles(text, k=5):
        m.update(shingle.encode('utf-8'))
    return m

def get_shingles(text, k=5):
    return {text[i:i+k] for i in range(len(text) - k + 1)}

# LSH 인덱스 (threshold: Jaccard 유사도 임계값)
lsh = MinHashLSH(threshold=0.8, num_perm=128)

for idx, text in enumerate(texts):
    m = text_to_minhash(text)
    lsh.insert(f"doc_{idx}", m)

# 중복 후보 탐색
duplicates = set()
for idx, text in enumerate(texts):
    m = text_to_minhash(text)
    candidates = lsh.query(m)
    for cand in candidates:
        cand_idx = int(cand.split('_')[1])
        if cand_idx > idx:
            duplicates.add(cand_idx)

print(f"MinHash LSH로 {len(duplicates)}개 중복 감지")
```

## LLM 학습 데이터 중복 제거

대규모 사전 학습 데이터셋(Common Crawl 등)에서는 **SemDeDup** 방식이 주목받고 있다. Meta의 연구에서 웹 크롤 데이터의 30~50%가 의미 중복임이 밝혀졌으며, 이를 제거하면 동일한 품질을 적은 학습 스텝으로 달성할 수 있다.

일반적인 LLM 데이터 전처리 파이프라인에서 중복 제거는 다음 순서로 실행된다:

1. **URL 중복 제거** - 동일 URL 문서 제거
2. **Exact MinHash** - 텍스트 해시 기반 완전 중복 제거
3. **Fuzzy MinHash(LSH)** - 유사 문서(Jaccard ≥ 0.8) 제거
4. **Semantic Clustering** - 임베딩으로 의미 중복 최종 정리

## 중복 제거 후 품질 확인

```python
# 중복 제거 전/후 통계 비교
def dedup_report(df_before, df_after):
    removed = len(df_before) - len(df_after)
    ratio = removed / len(df_before) * 100
    print(f"원본: {len(df_before):,} rows")
    print(f"중복 제거 후: {len(df_after):,} rows")
    print(f"제거율: {ratio:.1f}%")

    # 카테고리 분포 변화 확인
    if 'category' in df_before.columns:
        before_dist = df_before['category'].value_counts(normalize=True)
        after_dist = df_after['category'].value_counts(normalize=True)
        drift = (before_dist - after_dist).abs().max()
        print(f"카테고리 분포 최대 변화: {drift:.4f}")

dedup_report(df_raw, df_dedup)
```

중복 제거 비율이 20%를 초과한다면, 데이터 수집 파이프라인 자체에 문제가 있을 가능성이 높다. 원인을 파악하고 수집 단계부터 중복을 방지하는 것이 장기적으로 효율적이다.

---

**지난 글:** [데이터 품질 관리: 쓰레기 in, 쓰레기 out을 막는 법](/posts/data-quality/)

**다음 글:** [AI 코딩 도구의 시대: GitHub Copilot 완전 해부](/posts/ai-coding-copilot/)

<br>
읽어주셔서 감사합니다. 😊
