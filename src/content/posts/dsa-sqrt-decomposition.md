---
title: "제곱근 분해 (Sqrt Decomposition)"
description: "배열을 √N 크기 블록으로 나눠 구간 쿼리를 O(√N)에, 업데이트를 O(1)에 처리하는 제곱근 분해의 원리, 구현, Mo's Algorithm 연결을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["제곱근분해", "SqrtDecomposition", "블록분해", "구간쿼리", "Mo알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/dsa-kadane-algorithm/)에서 최대 부분 배열 합을 O(N)에 구하는 카데인 알고리즘을 다뤘습니다. 이번에는 업데이트와 구간 쿼리를 균형 있게 처리하는 **제곱근 분해(Sqrt Decomposition)**입니다.

## 핵심 아이디어

배열 N개를 크기 `B = √N`인 블록으로 나눕니다. 각 블록의 합(또는 최솟값, 최댓값 등)을 미리 계산합니다.

구간 `[l, r]` 쿼리 처리:
1. 왼쪽 부분 블록(l ~ 첫 블록 끝): 원소 개별 합산 ≤ B번
2. 완전 포함 블록: 블록 합을 그대로 사용 ≤ √N번
3. 오른쪽 부분 블록(마지막 블록 ~ r): 원소 개별 합산 ≤ B번

총 `O(B + N/B) = O(√N)` (B = √N일 때 최소).

![제곱근 분해 개념](/assets/posts/dsa-sqrt-decomposition-concept.svg)

## 구현

![제곱근 분해 클래스 구현](/assets/posts/dsa-sqrt-decomposition-impl.svg)

```python
import math

class SqrtDecomp:
    def __init__(self, A):
        self.A = A[:]
        self.B = int(math.isqrt(len(A))) or 1
        n_blocks = (len(A) + self.B - 1) // self.B
        self.blocks = [0] * n_blocks
        for i, v in enumerate(A):
            self.blocks[i // self.B] += v

    def update(self, i, val):
        """A[i] = val (점 업데이트, O(1))"""
        self.blocks[i // self.B] += val - self.A[i]
        self.A[i] = val

    def query(self, l, r):
        """sum(A[l..r]) — O(√N)"""
        B = self.B
        bl, br = l // B, r // B
        result = 0
        if bl == br:
            # 같은 블록 내
            for i in range(l, r + 1):
                result += self.A[i]
        else:
            # 왼쪽 부분
            for i in range(l, (bl + 1) * B):
                result += self.A[i]
            # 완전 블록
            for b in range(bl + 1, br):
                result += self.blocks[b]
            # 오른쪽 부분
            for i in range(br * B, r + 1):
                result += self.A[i]
        return result
```

## 블록 크기 선택

이론적으로 B = √N이 최적이지만, 실제로는 문제에 따라 조정합니다.

- 쿼리가 많으면 B를 늘려 완전 블록 처리 비율 증가 (쿼리 빠름)
- 업데이트가 많으면 B를 줄여 블록 합 재계산 비용 감소

## 응용: 구간 최솟값 (RMQ)

```python
class SqrtRMQ:
    def __init__(self, A):
        self.A = A[:]
        self.B = int(len(A) ** 0.5) or 1
        n_b = (len(A) + self.B - 1) // self.B
        self.mn = [float('inf')] * n_b
        for i, v in enumerate(A):
            b = i // self.B
            self.mn[b] = min(self.mn[b], v)

    def update(self, i, val):
        self.A[i] = val
        b = i // self.B
        self.mn[b] = min(self.A[b*self.B : (b+1)*self.B])  # O(B)

    def query(self, l, r):
        B = self.B
        bl, br = l // B, r // B
        if bl == br:
            return min(self.A[l:r+1])
        return min(
            min(self.A[l:(bl+1)*B]),
            min(self.mn[bl+1:br]),
            min(self.A[br*B:r+1])
        )
```

RMQ 업데이트가 O(B)인 점에 주의합니다. 업데이트가 잦다면 세그먼트 트리가 낫습니다.

## Mo's Algorithm 연결

제곱근 분해의 연장선인 Mo's Algorithm은 오프라인 구간 쿼리를 `O((N + Q)√N)`에 처리합니다.

```python
def mo_algorithm(A, queries):
    """queries: [(l, r, idx), ...]"""
    B = int(len(A) ** 0.5) or 1
    # 블록 단위로 정렬: 같은 블록이면 r 기준 정렬
    queries.sort(key=lambda q: (q[0]//B, q[1] if (q[0]//B)%2==0 else -q[1]))
    # ...
```

쿼리를 정렬해 포인터 이동 총량을 O((N + Q)√N)으로 제한합니다.

## 누적 합 vs 세그먼트 트리 vs 제곱근 분해

| 항목 | 누적 합 | 세그먼트 트리 | 제곱근 분해 |
|------|---------|--------------|-------------|
| 전처리 | O(N) | O(N) | O(N) |
| 쿼리 | O(1) | O(log N) | O(√N) |
| 업데이트 | X (재건 필요) | O(log N) | O(1) 또는 O(B) |
| 구현 복잡도 | 매우 단순 | 복잡 | 중간 |
| 적합 케이스 | 정적 배열 | 업데이트 잦음 | 빠른 구현 필요 |

코딩 테스트에서 세그먼트 트리 구현이 어렵거나 시간이 부족할 때, 제곱근 분해로 O(√N) 풀이를 제출하는 것이 유효한 전략입니다.

---

**지난 글:** [카데인 알고리즘(Kadane's Algorithm)](/posts/dsa-kadane-algorithm/)

<br>
읽어주셔서 감사합니다. 😊
