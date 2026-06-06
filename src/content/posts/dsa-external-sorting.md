---
title: "외부 정렬(External Sorting)"
description: "메모리보다 큰 데이터를 정렬하는 외부 정렬의 청크 생성·K-way 병합 구조, 디스크 I/O 최소화 전략, Replacement Selection과 Double Buffering 최적화를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["외부정렬", "ExternalSorting", "KwayMerge", "디스크IO", "대용량정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-tim-sort/)에서 내부 메모리 기반 팀 정렬을 다뤘습니다. 이번에는 **외부 정렬(External Sorting)**입니다. RAM(4GB)보다 훨씬 큰 파일(100GB, 1TB)을 정렬해야 할 때 디스크를 활용하는 알고리즘으로, 데이터베이스·빅데이터 시스템의 핵심 기술입니다.

## 왜 외부 정렬이 필요한가?

모든 데이터를 메모리에 올릴 수 없을 때 디스크 파일을 중간 저장소로 사용합니다. 외부 정렬의 성능 병목은 **CPU 시간이 아니라 디스크 I/O 횟수**입니다. 디스크 읽기는 메모리 접근보다 수백~수천 배 느리기 때문입니다.

## 2단계 외부 정렬

### 1단계: 청크 생성

RAM에 올릴 수 있는 크기로 데이터를 읽어 내부 정렬 후 임시 파일(청크)로 씁니다.

```python
import heapq, os, tempfile

def create_sorted_chunks(input_path, chunk_size_mb=256):
    chunk_files = []
    buffer = []
    chunk_size = chunk_size_mb * 1024 * 1024 // 8  # int64 기준

    with open(input_path) as f:
        for line in f:
            buffer.append(int(line.strip()))
            if len(buffer) >= chunk_size:
                buffer.sort()
                tmp = tempfile.mktemp()
                with open(tmp, 'w') as tf:
                    tf.write('\n'.join(map(str, buffer)) + '\n')
                chunk_files.append(tmp)
                buffer = []
    if buffer:
        buffer.sort()
        tmp = tempfile.mktemp()
        with open(tmp, 'w') as tf:
            tf.write('\n'.join(map(str, buffer)) + '\n')
        chunk_files.append(tmp)
    return chunk_files
```

### 2단계: K-way 병합

각 청크 파일에서 현재 최솟값을 **최소 힙**에 유지하며 순서대로 추출합니다.

```python
import heapq

def kway_merge(chunk_files, out_path):
    iters = [open(f) for f in chunk_files]
    heap = []
    for i, it in enumerate(iters):
        val = next(it, None)
        if val is not None:
            heapq.heappush(heap, (int(val.strip()), i, it))

    with open(out_path, 'w') as out:
        while heap:
            val, i, it = heapq.heappop(heap)
            out.write(str(val) + '\n')
            nxt = next(it, None)
            if nxt:
                heapq.heappush(heap, (int(nxt.strip()), i, it))
```

![외부 정렬: 청크 생성과 K-way 병합 구조](/assets/posts/dsa-external-sorting-kway.svg)

![K-way 병합 핵심 구현](/assets/posts/dsa-external-sorting-code.svg)

## 복잡도 분석

RAM = M, 전체 데이터 = N, 병합 차수 = K라 하면:

| 항목 | 값 |
|---|---|
| 청크 수 C | N/M |
| 병합 Pass 수 | 1 + ⌈log_K(C)⌉ |
| 총 I/O | O((N/B) × (1 + log_K(C))) |
| CPU 시간 | O(N log N) |

B = 디스크 블록 크기. K를 키우면 Pass 수가 줄어 I/O가 감소하지만, RAM에서 동시에 유지할 버퍼 수가 늘어납니다.

## 최적화 기법

### 1. Replacement Selection (대체 선택)

일반 청크 생성보다 약 2배 큰 런을 만들 수 있습니다. 최소 힙을 이용해 현재 출력 값보다 큰 원소는 같은 런에 계속 방출합니다.

```python
def replacement_selection(data_stream, heap_size):
    heap = []
    # 초기 힙 채우기
    for _ in range(heap_size):
        x = next(data_stream)
        heapq.heappush(heap, x)
    last_output = float('-inf')
    deferred = []
    # ...
```

### 2. Double Buffering (이중 버퍼링)

디스크 읽기와 CPU 처리를 겹쳐(Overlapping) I/O 대기 시간을 숨깁니다.

```
버퍼A: 처리 중  |  버퍼B: 다음 청크 읽는 중
    → 처리 완료 시 버퍼B 사용 시작, 버퍼A로 다음 읽기
```

### 3. 다단계 병합 (Multi-pass)

청크 수가 K보다 많으면 여러 Pass로 병합합니다. 예: K=8, 청크=64개 → 1st pass 8개씩 8묶음, 2nd pass 8묶음 → 최종.

## 실세계 활용

- **데이터베이스 ORDER BY**: MySQL, PostgreSQL 등이 임시 파일 기반 외부 정렬 사용
- **Hadoop MapReduce**: Map 출력의 shuffle-sort 단계
- **대용량 파일 로그 분석**: 수 TB 액세스 로그 정렬
- **유전체 데이터 처리**: BAM 파일 좌표 기반 정렬 (samtools sort)

---

**지난 글:** [팀 정렬(Tim Sort)](/posts/dsa-tim-sort/)

**다음 글:** [정렬 안정성(Sorting Stability)](/posts/dsa-sorting-stability/)

<br>
읽어주셔서 감사합니다. 😊
