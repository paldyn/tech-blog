---
title: "탐욕 알고리즘 (Greedy Algorithm)"
description: "탐욕 알고리즘의 원리, 탐욕 선택 속성, 최적 부분 구조, DP와의 비교, 동전 교환·거스름돈 등 예제를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 6
type: "knowledge"
category: "Algorithm"
tags: ["탐욕알고리즘", "Greedy", "최적화", "탐욕선택속성"]
featured: false
draft: false
---

[지난 글](/posts/dsa-closest-pair-of-points/)에서 분할 정복을 활용해 가장 가까운 두 점을 O(N log N)에 찾는 방법을 살펴봤습니다. 이번에는 최적화 문제를 풀 때 자주 등장하는 **탐욕 알고리즘(Greedy Algorithm)**을 소개합니다. 탐욕 알고리즘은 매 단계에서 **그 순간 가장 좋아 보이는 선택**을 반복해 최종 해답에 도달하는 방법입니다. 브루트포스처럼 모든 경우를 따지지 않고, DP처럼 모든 하위 문제를 저장하지도 않습니다. 단순하고 빠르지만, 항상 최적해를 보장하지는 않습니다.

## 탐욕 알고리즘이란?

탐욕(Greedy)이라는 이름처럼, 각 결정 시점에서 미래의 결과를 고려하지 않고 **현재 기준으로 최선인 선택**을 합니다. 이 방식이 전체 최적해를 보장하려면 두 가지 수학적 조건이 반드시 성립해야 합니다.

1. **탐욕 선택 속성(Greedy Choice Property)**: 지역적으로 최선인 선택이 전역 최적해의 일부가 됩니다.
2. **최적 부분 구조(Optimal Substructure)**: 문제의 최적해가 부분 문제의 최적해로 구성됩니다.

이 두 조건이 모두 성립하면 탐욕 알고리즘이 정확히 최적해를 반환합니다. 그렇지 않으면 근사해만 얻거나 오답이 발생할 수 있습니다.

![탐욕 알고리즘 개념](/assets/posts/dsa-greedy-concept.svg)

## 탐욕 vs 동적 프로그래밍

두 방법 모두 **최적 부분 구조**를 요구하지만, 탐욕은 추가로 **탐욕 선택 속성**이 필요합니다. 반면 DP는 탐욕 선택 속성 없이도 동작하며, 모든 하위 문제의 결과를 저장해 비교합니다.

| 구분 | 탐욕 알고리즘 | 동적 프로그래밍 |
|------|-------------|----------------|
| 선택 방식 | 현재 최선 | 모든 경우 비교 |
| 메모리 | O(1)~O(N) | O(N)~O(N²) |
| 속도 | 빠름 (O(N log N)) | 느림 (O(N²)~) |
| 적용 범위 | 제한적 | 더 넓음 |

## 동전 교환 문제

가장 대표적인 탐욕 예제는 **거스름돈 동전 교환**입니다. 사용할 동전 종류가 주어졌을 때, 특정 금액을 만드는 데 필요한 동전의 최소 개수를 구합니다.

### 탐욕 전략

1. 동전을 **내림차순 정렬**
2. 가장 큰 동전부터 가능한 만큼 사용
3. 나머지 금액으로 다음 동전 반복

```python
def greedy_coins(amount, coins):
    coins.sort(reverse=True)
    result = []
    for coin in coins:
        while amount >= coin:
            result.append(coin)
            amount -= coin
    return result

# coins = [500, 100, 50, 10]
# amount = 730
# result = [500, 100, 100, 10, 10, 10]
```

![동전 교환 탐욕 알고리즘](/assets/posts/dsa-greedy-coin-change.svg)

### 주의: 언제 탐욕이 실패하나?

한국 화폐 체계(10, 50, 100, 500)처럼 **큰 단위가 작은 단위의 배수**이면 탐욕이 최적입니다. 하지만 임의의 화폐 체계에서는 실패할 수 있습니다.

```python
# 반례: coins = [1, 3, 4], amount = 6
# 탐욕: 4 + 1 + 1 = 3개
# 최적: 3 + 3 = 2개  ← DP 필요
```

위 경우처럼 탐욕 선택 속성이 성립하지 않으면 DP를 사용해야 합니다.

## 대표 탐욕 알고리즘 목록

실전에서 자주 만나는 탐욕 알고리즘들입니다.

- **동전 교환**: 큰 동전부터 선택 (한국 화폐 체계 등)
- **크루스칼 MST**: 가중치 오름차순으로 간선 선택
- **프림 MST**: 현재 트리에서 가장 가까운 노드 선택
- **다익스트라**: 현재까지 최단 거리 노드를 탐욕 선택
- **구간 스케줄링**: 종료 시간 빠른 순서로 선택
- **허프만 코딩**: 빈도 낮은 두 노드를 반복 병합

## 시간 복잡도

탐욕 알고리즘의 복잡도는 문제마다 다르지만, 일반적으로 **정렬이 병목**이 됩니다.

```python
# 일반 탐욕 패턴
def greedy_template(items):
    items.sort(key=lambda x: x.priority)  # O(N log N)
    result = []
    for item in items:                     # O(N)
        if is_feasible(item, result):
            result.append(item)
    return result
# Total: O(N log N)
```

## 정확성 증명 방법

탐욕 알고리즘이 최적임을 증명하는 대표적인 방법은 두 가지입니다.

1. **교환 논증(Exchange Argument)**: 최적해와 탐욕해에서 차이가 나는 첫 번째 선택을 바꿔도 결과가 같거나 더 낫다는 것을 보임
2. **귀납법**: 탐욕 선택 후 남은 부분 문제에도 탐욕이 최적임을 귀납적으로 증명

---

**지난 글:** [가장 가까운 두 점 (Closest Pair of Points)](/posts/dsa-closest-pair-of-points/)

**다음 글:** [탐욕: 구간 스케줄링](/posts/dsa-greedy-interval-scheduling/)

<br>
읽어주셔서 감사합니다. 😊
