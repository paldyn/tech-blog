---
title: "탐욕: 활동 선택 문제 (Activity Selection)"
description: "시작·종료 시간이 주어진 활동 집합에서 최대 개수의 호환 활동을 선택하는 고전적 탐욕 문제를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["활동선택", "ActivitySelection", "탐욕알고리즘", "스케줄링"]
featured: false
draft: false
---

[지난 글](/posts/dsa-greedy-interval-scheduling/)에서 구간 스케줄링 최대화 문제를 종료 시간 정렬로 해결하는 방법을 살펴봤습니다. 이번에는 그와 매우 유사하지만 알고리즘의 고전적 형태로 자주 소개되는 **활동 선택 문제(Activity Selection Problem)**를 다룹니다. 이 문제는 하나의 강의실이나 기계에서 여러 활동이 경쟁할 때, **서로 충돌하지 않는 최대 활동 집합**을 고르는 문제로, 탐욕 알고리즘 교과서의 첫 번째 예제로 등장할 만큼 중요합니다.

## 문제 정의

n개의 활동 집합 S = {a₁, a₂, ..., aₙ}이 있습니다. 각 활동 aᵢ는 시작 시간 sᵢ와 종료 시간 fᵢ를 갖습니다. 두 활동 aᵢ, aⱼ가 **호환(compatible)**되려면 [sᵢ, fᵢ)와 [sⱼ, fⱼ)가 겹치지 않아야 합니다. 즉 fᵢ ≤ sⱼ 또는 fⱼ ≤ sᵢ.

**목표**: 서로 호환되는 활동의 최대 부분 집합을 선택하라.

![활동 선택 테이블](/assets/posts/dsa-greedy-activity-selection-table.svg)

위 테이블에서 8개의 활동을 종료 시간 오름차순으로 정렬한 뒤, 탐욕 선택을 적용하면 A(1,4), D(5,7), H(8,11) 세 개가 선택됩니다.

## 탐욕 전략

활동 선택 문제에서도 **종료 시간 오름차순 정렬**이 최적 탐욕 전략입니다.

**핵심 직관**: 가장 빨리 끝나는 활동을 선택하면 자원을 가장 빠르게 확보할 수 있어, 뒤이어 더 많은 활동을 수행할 기회를 극대화합니다.

## Python 구현

```python
def activity_selection(activities):
    # Sort by finish time
    activities.sort(key=lambda x: x[1])

    selected = [activities[0]]
    last = activities[0][1]

    for start, finish in activities[1:]:
        if start >= last:
            selected.append((start, finish))
            last = finish

    return selected
```

구현의 특징으로는, 첫 번째 활동을 항상 선택하는 것에서 시작합니다. 종료 시간 정렬 후 첫 번째 활동은 반드시 최적해에 포함되기 때문입니다. 이후 각 활동의 시작 시간이 마지막 선택한 활동의 종료 시간 이상인지 확인합니다.

![활동 선택 코드](/assets/posts/dsa-greedy-activity-selection-code.svg)

## 구체적인 실행 예제

8개의 활동으로 단계별로 따라가 보겠습니다.

```python
# 입력 (시작, 종료)
acts = [(1,4),(3,5),(0,6),(5,7),(3,9),(5,9),(6,10),(8,11)]
# 종료 시간 정렬 후:
# A(1,4), B(3,5), C(0,6), D(5,7), E(3,9), F(5,9), G(6,10), H(8,11)

# last = 4 → selected = [A]
# B: 3 < 4 → skip
# C: 0 < 4 → skip
# D: 5 >= 4 → selected, last = 7
# E: 3 < 7 → skip
# F: 5 < 7 → skip
# G: 6 < 7 → skip
# H: 8 >= 7 → selected, last = 11
# 결과: [A, D, H]
```

## 최적성 증명

**정리**: 활동 선택 문제에서 종료 시간 오름차순 탐욕은 최적해를 반환한다.

**증명 (교환 논증)**:

최적해 OPT의 첫 번째 선택 oₘ과 탐욕 선택 g₁의 종료 시간을 비교합니다. 탐욕 정의상 f(g₁) ≤ f(oₘ)입니다. oₘ 대신 g₁을 선택해도 나머지 활동들에 영향이 없거나 더 넓은 시간이 확보됩니다. 이를 귀납적으로 적용하면, 탐욕해의 크기 ≥ OPT의 크기입니다. 최적성 정의상 반대도 성립하므로 두 크기는 같습니다.

## 구간 스케줄링과의 비교

활동 선택 문제와 구간 스케줄링 문제는 본질적으로 동일한 문제입니다. 차이는 표현 방식에 있습니다.

| 구분 | 활동 선택 | 구간 스케줄링 |
|------|----------|-------------|
| 단위 | 활동 (이름 있음) | 구간 (좌표만) |
| 초기화 | activities[0] 먼저 선택 | last_end = -1 |
| 실무 문제 | 강의실 배정, 기계 스케줄링 | 방송 스케줄, 회의실 예약 |

두 접근법 모두 정렬 후 O(N)으로 최대 집합을 구하며, 전체 복잡도는 O(N log N)입니다.

## 응용 문제

활동 선택의 개념은 다양한 응용 문제에 확장됩니다.

```python
# 응용: 최소 회의실 수 (구간 분할)
import heapq
def min_rooms(intervals):
    intervals.sort()   # 시작 시간 정렬
    heap = []          # 각 방의 종료 시간
    for start, end in intervals:
        if heap and heap[0] <= start:
            heapq.heapreplace(heap, end)
        else:
            heapq.heappush(heap, end)
    return len(heap)
```

---

**지난 글:** [탐욕: 구간 스케줄링](/posts/dsa-greedy-interval-scheduling/)

**다음 글:** [허프만 코딩 (Huffman Coding)](/posts/dsa-huffman-coding/)

<br>
읽어주셔서 감사합니다. 😊
