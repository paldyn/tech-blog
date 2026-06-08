---
title: "탐욕: 구간 스케줄링 (Interval Scheduling)"
description: "마감 시간 기준 정렬로 최대 비겹침 구간을 선택하는 구간 스케줄링 최대화 문제와 탐욕 증명을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 7
type: "knowledge"
category: "Algorithm"
tags: ["구간스케줄링", "IntervalScheduling", "탐욕알고리즘", "마감시간정렬"]
featured: false
draft: false
---

[지난 글](/posts/dsa-greedy/)에서 탐욕 알고리즘의 두 가지 핵심 조건인 탐욕 선택 속성과 최적 부분 구조를 살펴봤습니다. 이번에는 탐욕 알고리즘의 가장 대표적인 응용 중 하나인 **구간 스케줄링 최대화 문제(Interval Scheduling Maximization Problem)**를 다룹니다. 하나의 자원(예: 강의실, 회의실, 기계)을 여러 작업이 서로 나눠 쓸 때, **최대한 많은 작업을 수행**하도록 스케줄을 짜는 고전적인 문제입니다.

## 문제 정의

n개의 구간이 주어집니다. 각 구간은 시작 시간 s와 종료 시간 e를 갖습니다. 두 구간 (s₁,e₁)과 (s₂,e₂)가 **호환(compatible)**되려면 하나가 끝난 다음 다른 하나가 시작해야 합니다. 즉 e₁ ≤ s₂ 또는 e₂ ≤ s₁이어야 합니다.

목표: 서로 호환되는 구간의 최대 부분 집합을 찾는 것.

![구간 스케줄링 타임라인](/assets/posts/dsa-greedy-interval-scheduling-timeline.svg)

위 그림에서 구간 A[1,4], D[5,7], F[8,11]은 서로 겹치지 않으며, 이 세 구간이 최대 비겹침 집합입니다.

## 탐욕 전략: 종료 시간 기준 정렬

처음에는 다양한 기준을 시도해볼 수 있습니다.

- **시작 시간 오름차순**: 실패 — 시작은 빠르지만 매우 긴 구간이 선택될 수 있음
- **길이 오름차순**: 실패 — 짧지만 두 구간 사이에 끼여 양쪽을 막는 구간이 존재
- **종료 시간 오름차순**: 성공 — 현재 선택 후 남은 시간이 최대화됨

**핵심 직관**: 종료 시간이 빠른 구간을 먼저 선택하면, 자원(시간 축)을 가장 일찍 비워줄 수 있습니다. 따라서 이후 선택 가능한 구간의 수가 최대가 됩니다.

## Python 구현

```python
def interval_scheduling(intervals):
    # Sort by end time
    intervals.sort(key=lambda x: x[1])
    selected = []
    last_end = -1
    for start, end in intervals:
        if start >= last_end:
            selected.append((start, end))
            last_end = end
    return selected
```

알고리즘의 흐름을 단계별로 따라가 보겠습니다.

1. 종료 시간 기준 오름차순 정렬: A(4), B(5), C(6), D(7), E(9), F(11)
2. `last_end = -1`로 초기화 (아직 선택된 구간 없음)
3. A[1,4]: 1 ≥ -1 → 선택, last_end = 4
4. B[3,5]: 3 < 4 → 제외
5. C[0,6]: 0 < 4 → 제외
6. D[5,7]: 5 ≥ 4 → 선택, last_end = 7
7. E[6,9]: 6 < 7 → 제외
8. F[8,11]: 8 ≥ 7 → 선택, last_end = 11

결과: A, D, F → 3개 구간

![구간 스케줄링 알고리즘 코드](/assets/posts/dsa-greedy-interval-scheduling-code.svg)

## 탐욕 정확성 증명 (교환 논증)

**정리**: 종료 시간 기준 탐욕 알고리즘은 최대 수의 비겹침 구간을 반환한다.

**증명 (Exchange Argument)**:

1. 탐욕해 G = {g₁, g₂, ..., gₖ}와 최적해 OPT = {o₁, o₂, ..., oₘ}가 있다고 하자. (종료 시간 오름차순 정렬)
2. k < m이라고 가정 (모순을 유도)
3. 귀납적으로 i ≤ k에 대해 end(gᵢ) ≤ end(oᵢ)임을 보일 수 있음
4. 따라서 k+1번째 최적해 oₖ₊₁가 gₖ와 겹치지 않아야 하지만, 탐욕 알고리즘은 이를 선택했을 것 → 모순
5. 결론: k ≥ m, 즉 탐욕해의 크기 = 최적해의 크기

## 시간 복잡도 분석

```python
# 정렬: O(N log N)
# 탐색: O(N) — 각 구간 한 번씩 확인
# 전체: O(N log N)
# 공간: O(1) — 추가 배열 불필요
```

N개의 구간이 있을 때, 정렬이 병목이 되어 전체 O(N log N) 복잡도를 가집니다. 선택 단계는 O(N)이므로 매우 효율적입니다.

## 변형 문제들

구간 스케줄링은 다양한 변형이 있습니다.

- **구간 분할(Interval Partitioning)**: 최소 자원 수로 모든 구간을 처리 (시작 시간 정렬, 그리디)
- **구간 스케줄링 가중치 최대화**: 각 구간에 가중치가 있을 때 (DP 필요)
- **최소 지연 스케줄링(Minimizing Lateness)**: 마감 시간 기준 정렬

```python
# 변형: 가중치가 있는 경우는 DP 필요
# dp[i] = max weight using first i intervals
def weighted_interval_scheduling(intervals):
    intervals.sort(key=lambda x: x[1])
    # DP 처리 필요 (탐욕 불가)
    ...
```

---

**지난 글:** [탐욕 알고리즘 (Greedy Algorithm)](/posts/dsa-greedy/)

**다음 글:** [탐욕: 활동 선택 문제](/posts/dsa-greedy-activity-selection/)

<br>
읽어주셔서 감사합니다. 😊
