---
title: "스킵 리스트 (Skip List)"
description: "확률적 레벨 배정으로 O(log n) 탐색·삽입·삭제를 달성하는 스킵 리스트의 구조, 알고리즘, Python 구현을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "Algorithm"
tags: ["스킵리스트", "skip list", "자료구조", "확률적", "Redis"]
featured: false
draft: false
---

[지난 글](/posts/dsa-monotonic-stack/)에서 단조 스택으로 O(n²) 문제를 O(n)으로 해결하는 법을 배웠습니다. 이번에는 정렬된 데이터를 평균 O(log n)에 탐색·삽입·삭제할 수 있는 **스킵 리스트(Skip List)**를 소개합니다. 균형 이진 탐색 트리와 비슷한 성능을 내면서도 구현이 훨씬 단순해, Redis의 Sorted Set에 실제로 사용되는 자료구조입니다.

## 아이디어: 층층이 쌓은 고속 도로

단순 연결 리스트는 탐색이 O(n)입니다. 여기에 "상위 레벨" 연결을 추가하면 건너뛰기(skip)가 가능해집니다.

- **Level 0**: 모든 노드를 포함하는 전체 리스트
- **Level 1**: 약 n/2 노드를 포함하는 고속 레인
- **Level 2**: 약 n/4 노드
- **Level k**: 약 n/2^k 노드

각 노드의 레벨은 **동전 뒤집기(Bernoulli trial)**로 무작위로 결정합니다(p=0.5).

![스킵 리스트 구조](/assets/posts/dsa-skip-list-structure.svg)

## 탐색 알고리즘

최상위 레벨에서 시작해 목표값이 나올 때까지 오른쪽으로 이동하고, 더 이상 갈 수 없으면 한 레벨 내려가는 방식입니다.

```python
def search(self, target):
    curr = self.head
    for level in range(self.max_level - 1, -1, -1):  # 상위 레벨부터
        while curr.forward[level] and curr.forward[level].val < target:
            curr = curr.forward[level]     # 오른쪽으로 이동
        # 현재 레벨에서 더 이상 갈 수 없으면 한 단계 내려감
    curr = curr.forward[0]
    return curr and curr.val == target
```

## 삽입과 무작위 레벨 결정

삽입 시 탐색 경로(update 배열)를 기록하고, 새 노드에 무작위 레벨을 부여합니다.

```python
import random

class SkipNode:
    def __init__(self, val, level):
        self.val = val
        self.forward = [None] * (level + 1)

class SkipList:
    MAX_LEVEL = 16
    P = 0.5

    def __init__(self):
        self.head = SkipNode(-float('inf'), self.MAX_LEVEL)
        self.level = 0          # 현재 최대 레벨

    def _random_level(self):
        lvl = 0
        while random.random() < self.P and lvl < self.MAX_LEVEL:
            lvl += 1
        return lvl

    def insert(self, val):
        update = [None] * (self.MAX_LEVEL + 1)
        curr = self.head

        for i in range(self.level, -1, -1):
            while curr.forward[i] and curr.forward[i].val < val:
                curr = curr.forward[i]
            update[i] = curr          # 각 레벨의 삽입 위치 기록

        new_level = self._random_level()
        if new_level > self.level:
            for i in range(self.level + 1, new_level + 1):
                update[i] = self.head
            self.level = new_level

        new_node = SkipNode(val, new_level)
        for i in range(new_level + 1):
            new_node.forward[i] = update[i].forward[i]
            update[i].forward[i] = new_node

    def delete(self, val):
        update = [None] * (self.MAX_LEVEL + 1)
        curr = self.head

        for i in range(self.level, -1, -1):
            while curr.forward[i] and curr.forward[i].val < val:
                curr = curr.forward[i]
            update[i] = curr

        target = curr.forward[0]
        if target and target.val == val:
            for i in range(self.level + 1):
                if update[i].forward[i] != target:
                    break
                update[i].forward[i] = target.forward[i]
            # 최대 레벨 갱신
            while self.level > 0 and not self.head.forward[self.level]:
                self.level -= 1
```

## 스킵 리스트 vs 다른 자료구조

![자료구조 비교](/assets/posts/dsa-skip-list-comparison.svg)

## 복잡도 분석

| 연산 | 평균 | 최악 |
|------|------|------|
| 탐색 | O(log n) | O(n) |
| 삽입 | O(log n) | O(n) |
| 삭제 | O(log n) | O(n) |
| 공간 | O(n log n) | O(n log n) |

최악 O(n)은 모든 노드가 레벨 1에만 배정될 때 발생하지만, 확률적으로 극히 드문 경우입니다.

## Redis Sorted Set에서의 활용

Redis의 ZADD, ZRANGE, ZRANK 등이 스킵 리스트를 기반으로 동작합니다.

```text
ZADD leaderboard 100 "Alice"
ZADD leaderboard 200 "Bob"
ZADD leaderboard 150 "Charlie"

ZRANGE leaderboard 0 -1 WITHSCORES
# 1) "Alice" 2) "100"
# 3) "Charlie" 4) "150"
# 5) "Bob" 6) "200"
```

스킵 리스트를 선택한 이유:
1. **범위 쿼리** (ZRANGEBYSCORE): 연결 리스트 특성상 O(k)로 범위 순회 가능
2. **구현 단순성**: AVL/RB-Tree 대비 삽입/삭제 회전 불필요
3. **동시성 친화**: 락-프리(lock-free) 구현이 용이

## 정리

- 스킵 리스트는 확률적 레벨 배정으로 정렬된 데이터를 평균 O(log n)에 처리합니다.
- 균형 BST와 유사한 성능을 내지만 구현이 훨씬 단순합니다.
- Redis Sorted Set의 실제 구현체로 사용되는 실용적인 자료구조입니다.

---

**지난 글:** [단조 스택](/posts/dsa-monotonic-stack/)

**다음 글:** [해시 테이블](/posts/dsa-hash-table/)

<br>
읽어주셔서 감사합니다. 😊
