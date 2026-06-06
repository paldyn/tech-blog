---
title: "버킷 정렬(Bucket Sort)"
description: "균등 분포 입력에서 평균 O(N)을 달성하는 버킷 정렬의 분배·정렬·합병 3단계, 버킷 수 선택 전략, 실수 정렬 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 4
type: "knowledge"
category: "Algorithm"
tags: ["버킷정렬", "BucketSort", "선형시간정렬", "분포기반정렬", "균등분포"]
featured: false
draft: false
---

[지난 글](/posts/dsa-radix-sort/)에서 자릿수별 정렬인 기수 정렬을 다뤘습니다. 이번에는 **버킷 정렬(Bucket Sort)**입니다. 입력이 균등 분포를 따를 때 평균 **O(N)**에 동작하는 분포 기반 정렬로, 실수(float) 정렬에 자주 활용됩니다.

## 핵심 아이디어

값 범위를 N개의 **버킷(구간)**으로 나누어 각 원소를 해당 버킷에 분배합니다. 입력이 균등 분포라면 버킷당 원소 수가 약 1개이므로 각 버킷 정렬 비용이 O(1)이 되어 전체 O(N)이 됩니다.

```
입력: [.78, .17, .39, .26, .72, .94, .21, .12, .23, .68]

버킷 인덱스 = floor(x × n)

B[1]: [.17, .12]  → 정렬 → [.12, .17]
B[2]: [.26, .21, .23] → 정렬 → [.21, .23, .26]
B[3]: [.39]
B[6]: [.68]
B[7]: [.78, .72] → 정렬 → [.72, .78]
B[9]: [.94]
```

![버킷 정렬: 분배 → 정렬 → 합병 과정](/assets/posts/dsa-bucket-sort-process.svg)

## Python 구현

```python
def bucket_sort(a):
    n = len(a)
    buckets = [[] for _ in range(n)]
    # 1단계: 분배
    for x in a:
        buckets[int(x * n)].append(x)
    # 2단계: 각 버킷 정렬 + 합병
    result = []
    for b in buckets:
        result.extend(sorted(b))  # 삽입 정렬로 교체 가능
    return result
```

![버킷 정렬 구현 코드](/assets/posts/dsa-bucket-sort-code.svg)

## 복잡도 분석

| 경우 | 시간 | 공간 |
|---|---|---|
| 평균 (균등 분포) | **O(N)** | O(N) |
| 최악 (한 버킷 집중) | O(N²) | O(N) |

**평균 O(N) 증명 개요**: 버킷당 기대 원소 수를 μ라 하면, 각 버킷 정렬 비용의 기대값 E[Tᵢ] = O(E[nᵢ²]) = O(1) (균등 분포 가정). N개 버킷을 합산해도 O(N).

버킷 내부 정렬은 **삽입 정렬**을 쓰는 게 관례입니다. 소규모 배열에서는 상수 계수가 작고 안정 정렬이므로 최종 결과도 안정을 유지합니다.

## 정수에 적용: 값 범위 매핑

0~1 실수가 아닌 임의 범위 [lo, hi] 정수에도 쓸 수 있습니다.

```python
def bucket_sort_range(a, num_buckets=None):
    if not a:
        return a
    lo, hi = min(a), max(a)
    if lo == hi:
        return a[:]
    k = num_buckets or len(a)
    buckets = [[] for _ in range(k)]
    for x in a:
        idx = int((x - lo) / (hi - lo + 1) * k)
        idx = min(idx, k - 1)  # 경계 보정
        buckets[idx].append(x)
    result = []
    for b in buckets:
        result.extend(sorted(b))
    return result
```

## 버킷 수 선택 전략

- **버킷 수 = N**: 이상적인 균등 분포 → O(N) 기대
- **버킷 수 < N**: 버킷당 원소가 늘어나 내부 정렬 부담 증가
- **버킷 수 > N**: 빈 버킷 오버헤드, 메모리 낭비
- **실전**: `sqrt(N)` 또는 데이터 특성에 따라 조정

## 활용 사례

버킷 정렬은 데이터 분포를 미리 알거나 가정할 수 있을 때 위력을 발휘합니다:

- **GPS 좌표 정렬**: 경도/위도는 균등 분포에 가까움
- **네트워크 패킷 타임스탬프**: 균일하게 분포
- **해시 기반 정렬**: 해시값이 고르게 분포된 경우
- **외부 정렬 첫 단계**: 파일을 청크(버킷)로 분류 후 병합

---

**지난 글:** [기수 정렬(Radix Sort)](/posts/dsa-radix-sort/)

**다음 글:** [팀 정렬(Tim Sort)](/posts/dsa-tim-sort/)

<br>
읽어주셔서 감사합니다. 😊
