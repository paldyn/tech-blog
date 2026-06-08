---
title: "Mo의 알고리즘 (Mo's Algorithm)"
description: "Mo's Algorithm으로 정적 구간 쿼리를 O((N+Q)√N)에 처리하는 방법, 블록 분해 기반 쿼리 정렬, 구현 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "Algorithm"
tags: ["Mo알고리즘", "구간쿼리", "오프라인쿼리", "블록분해", "√N"]
featured: false
draft: false
---

[지난 글](/posts/dsa-sqrt-decomposition/)에서 배열을 √N 크기 블록으로 나눠 구간 쿼리를 O(√N)에 처리하는 제곱근 분해를 다뤘습니다. 이번에는 그 아이디어를 **오프라인 쿼리** 처리로 확장한 **Mo's Algorithm**을 살펴봅니다. 이 알고리즘은 1980년대 중국의 수학자 Mo Tao가 고안한 방법으로, 업데이트 없이 구간 쿼리만 존재하는 정적 배열 문제를 O((N+Q)√N)에 처리합니다.

## 핵심 아이디어

일반적인 구간 쿼리 알고리즘은 각 쿼리를 독립적으로 처리합니다. 그러나 현재 구간 `[cur_l, cur_r]`에서 인접 구간 `[cur_l±1, cur_r±1]`로 이동할 때 O(1)에 상태를 갱신할 수 있다면, 쿼리를 영리하게 정렬해서 포인터 이동 총량을 최소화할 수 있습니다.

Mo's Algorithm의 핵심은 **쿼리를 블록 단위로 정렬**하는 것입니다.

- L 포인터 기준 블록 번호로 먼저 정렬
- 같은 블록 내에서는 R 포인터 기준 정렬 (홀짝 블록 교차 정렬로 추가 최적화 가능)

![Mo's Algorithm 블록 분해 개념](/assets/posts/dsa-mo-algorithm-concept.svg)

## 복잡도 분석

**R 포인터 이동**: 같은 블록 내 쿼리들은 R이 단조 증가하므로 블록당 O(N)이 이동합니다. 블록 수가 √N개이므로 총 O(N√N).

**L 포인터 이동**: 한 블록 내에서 L이 이동하는 거리는 최대 블록 크기 B = √N입니다. Q개 쿼리에 대해 총 O(Q√N).

**합계**: O((N+Q)√N). 블록 크기 B = √N일 때 최적.

## 구현 패턴

Mo's Algorithm 구현은 세 부분으로 구성됩니다.

1. **블록 크기 결정**: `B = int(N**0.5)`
2. **쿼리 정렬**: 블록 번호 → R 값 (짝수 블록 오름차순, 홀수 블록 내림차순)
3. **포인터 이동**: cur_l, cur_r을 add/remove 함수로 갱신

![Mo's Algorithm 구현 코드](/assets/posts/dsa-mo-algorithm-code.svg)

```python
import math

def mo_algorithm(N, A, queries):
    """
    queries: list of (l, r, idx)
    반환: ans[idx] = query(l, r) 결과
    """
    B = int(math.isqrt(N)) or 1
    queries_sorted = sorted(
        queries,
        key=lambda q: (q[0]//B, q[1] if (q[0]//B)%2==0 else -q[1])
    )

    cnt = {}  # 현재 구간 내 원소 등장 횟수
    distinct = 0  # 서로 다른 원소 수

    def add(pos):
        nonlocal distinct
        v = A[pos]
        if cnt.get(v, 0) == 0:
            distinct += 1
        cnt[v] = cnt.get(v, 0) + 1

    def remove(pos):
        nonlocal distinct
        v = A[pos]
        cnt[v] -= 1
        if cnt[v] == 0:
            distinct -= 1

    ans = [0] * len(queries)
    cur_l, cur_r = 0, -1

    for l, r, idx in queries_sorted:
        while cur_r < r:
            cur_r += 1
            add(cur_r)
        while cur_l > l:
            cur_l -= 1
            add(cur_l)
        while cur_r > r:
            remove(cur_r)
            cur_r -= 1
        while cur_l < l:
            remove(cur_l)
            cur_l += 1
        ans[idx] = distinct

    return ans
```

위 코드는 구간 내 서로 다른 원소 수를 구하는 예시입니다. `add`와 `remove` 함수를 바꾸면 구간 합, XOR, 최빈값 등 다양한 쿼리에 적용할 수 있습니다.

## 홀짝 최적화 (Zig-zag)

같은 블록 내 R 포인터를 짝수 블록은 오름차순, 홀수 블록은 내림차순으로 정렬하면 블록 경계를 넘을 때 R이 불필요하게 처음으로 돌아가는 것을 방지합니다. 이 최적화는 실제로 상수 계수를 크게 줄여 실전에서 약 2배 속도 향상을 가져옵니다.

```python
queries.sort(key=lambda q: (
    q[0] // B,
    q[1] if (q[0] // B) % 2 == 0 else -q[1]
))
```

## 적용 조건 및 제약

Mo's Algorithm은 다음 조건에서만 사용 가능합니다.

- **정적 배열**: 쿼리 처리 중 배열 원소가 바뀌지 않아야 합니다 (업데이트 쿼리 불가).
- **오프라인**: 모든 쿼리를 미리 알고 있어야 합니다.
- **O(1) 전환**: 인접 구간으로 상태 전환이 O(1)이어야 합니다.

업데이트가 있는 경우 "Mo's Algorithm with Updates"로 확장하면 O(N^(2/3))에 처리할 수 있지만, 구현 난도가 높아집니다.

## 실전 문제 유형

| 쿼리 유형 | add/remove 내용 | 답 반환 |
|-----------|----------------|---------|
| 구간 합 | sum += A[pos] | sum |
| 서로 다른 원소 수 | cnt 배열 관리 | distinct |
| 최빈값 | freq + max_freq 관리 | max_freq |
| 구간 XOR | xor ^= A[pos] | xor |

Mo's Algorithm은 세그먼트 트리나 머지 소트 트리로 풀기 어려운 "구간 내 서로 다른 원소 수", "구간 최빈값" 등의 문제에 특히 강력합니다. O(N√N) ≈ O(N^1.5)로 N=10^5일 때 약 3×10^7 연산이므로 1~2초 제한에서 충분히 통과합니다.

---

**지난 글:** [제곱근 분해 (Sqrt Decomposition)](/posts/dsa-sqrt-decomposition/)

**다음 글:** [오프라인 쿼리 처리](/posts/dsa-offline-query-processing/)

<br>
읽어주셔서 감사합니다. 😊
