---
title: "허프만 코딩 (Huffman Coding)"
description: "빈도 기반 가변 길이 이진 코드를 생성하는 허프만 코딩의 트리 구성 알고리즘, 최적성 증명, 압축 효율을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["허프만코딩", "HuffmanCoding", "압축", "탐욕알고리즘", "가변길이코드"]
featured: false
draft: false
---

[지난 글](/posts/dsa-greedy-activity-selection/)에서 종료 시간 기준 탐욕으로 최대 활동을 선택하는 방법을 살펴봤습니다. 이번에는 탐욕 알고리즘이 실제 데이터 압축에 적용되는 강력한 사례인 **허프만 코딩(Huffman Coding)**을 다룹니다. 1952년 데이비드 허프만이 고안한 이 방법은 문자 빈도에 따라 **가변 길이 이진 코드**를 할당해, 자주 등장하는 문자에 짧은 코드를 부여함으로써 전체 데이터 크기를 줄입니다. ZIP, JPEG, MP3 등 현대 압축 포맷의 기초입니다.

## 핵심 아이디어

고정 길이 코드로 n개의 문자를 표현하려면 ⌈log₂n⌉ 비트가 필요합니다. 하지만 각 문자의 빈도가 다를 때, **빈도가 높은 문자에 짧은 코드, 낮은 문자에 긴 코드**를 배정하면 평균 코드 길이를 줄일 수 있습니다.

**프리픽스 코드(Prefix-Free Code)**: 어떤 코드도 다른 코드의 접두어가 되지 않도록 설계합니다. 이렇게 하면 디코딩 시 구분자 없이도 코드를 유일하게 해석할 수 있습니다. 허프만 코드는 항상 프리픽스 코드입니다.

## 트리 구성 알고리즘

허프만 코딩은 **최소 힙(Min-Heap)**을 활용해 바텀업으로 이진 트리를 구성합니다.

1. 각 문자를 빈도를 키로 갖는 노드로 만들어 최소 힙에 삽입
2. 힙에서 빈도가 가장 작은 두 노드를 꺼냄
3. 두 노드를 합쳐 새 노드 생성 (빈도 = 두 빈도의 합), 힙에 삽입
4. 힙에 노드가 하나 남을 때까지 반복
5. 왼쪽 간선 = 0, 오른쪽 간선 = 1로 코드 구성

![허프만 트리 구성](/assets/posts/dsa-huffman-coding-tree.svg)

A(5), B(2), C(1), D(3), E(4)로 구성된 예에서, 총 4번의 병합으로 루트(15)가 완성됩니다. 최종 코드는 A=11, B=001, C=000, D=01, E=10으로, 평균 길이 약 2.33 bits입니다. 고정 3 bits보다 효율적입니다.

## Python 구현

```python
import heapq

def huffman(freq):
    heap = [[f, [ch, ""]]
            for ch, f in freq.items()]
    heapq.heapify(heap)
    while len(heap) > 1:
        lo = heapq.heappop(heap)
        hi = heapq.heappop(heap)
        for p in lo[1:]: p[1] = '0' + p[1]
        for p in hi[1:]: p[1] = '1' + p[1]
        heapq.heappush(heap,
            [lo[0]+hi[0]] + lo[1:] + hi[1:])
    return dict(heap[0][1:])
```

각 힙 원소는 `[빈도, [문자, 코드문자열]]` 구조입니다. 병합할 때마다 lo 소속 문자들의 코드 앞에 '0', hi 소속 문자들에는 '1'을 붙입니다. 루트까지 올라가면 각 문자의 전체 코드가 완성됩니다.

![허프만 코딩 구현](/assets/posts/dsa-huffman-coding-code.svg)

## 실행 예제

```python
freq = {'A': 5, 'B': 2, 'C': 1, 'D': 3, 'E': 4}
codes = huffman(freq)
# 결과: {'C': '000', 'B': '001', 'D': '01',
#        'E': '10', 'A': '11'}

# 메시지 "AABCDE" 인코딩:
# A=11, A=11, B=001, C=000, D=01, E=10
# 비트열: 11 11 001 000 01 10 → 12 bits
# 고정 3bits: 6×3 = 18 bits → 33% 절약
```

## 최적성 증명

**정리**: 허프만 코딩은 주어진 빈도 분포에 대해 최소 기대 코드 길이를 갖는 프리픽스 코드를 생성한다.

**핵심 보조정리**: 빈도가 가장 낮은 두 문자는 최적 트리에서 가장 깊은 레벨의 형제 노드여야 합니다. (이를 교환 논증으로 증명 가능)

이 보조정리에 기반해 귀납적으로: 두 최솟값을 병합한 결과에서도 허프만이 최적을 만들고, 이를 n번 반복하면 최적 트리가 완성됩니다.

## 시간 복잡도

```python
# heapify: O(N)
# while 루프: N-1회 반복
# 각 반복: heappop × 2 + heappush × 1 = O(log N)
# 전체: O(N log N)
```

## 압축 효율

허프만 코드의 평균 코드 길이는 정보 이론적 하한인 **엔트로피**에 1 bit 이내로 근접합니다.

```python
import math

def entropy(freq):
    total = sum(freq.values())
    return -sum(
        (f/total) * math.log2(f/total)
        for f in freq.values()
    )

# freq = {'A':5,'B':2,'C':1,'D':3,'E':4}
# entropy ≈ 2.24 bits
# Huffman avg ≈ 2.33 bits (차이: 0.09 bits)
```

## 한계와 대안

허프만 코딩은 심볼 단위로 처리하므로, 반복 패턴 등 상위 수준의 중복성을 활용하지 못합니다. 현대 압축 알고리즘들은 허프만을 기반으로 개선됩니다.

- **산술 코딩(Arithmetic Coding)**: 엔트로피에 더 가까운 코드 가능
- **LZ77/LZ78**: 슬라이딩 윈도우로 반복 문자열 압축
- **Deflate(zlib, ZIP)**: LZ77 + 허프만 조합

---

**지난 글:** [탐욕: 활동 선택 문제](/posts/dsa-greedy-activity-selection/)

**다음 글:** [동적 프로그래밍 입문](/posts/dsa-dynamic-programming-intro/)

<br>
읽어주셔서 감사합니다. 😊
