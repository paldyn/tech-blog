---
title: "collections.deque: 양방향 큐의 모든 것"
description: "Python collections.deque의 내부 구조, O(1) 양방향 연산, maxlen 슬라이딩 윈도우, BFS 큐 패턴까지 완벽하게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["python", "collections", "deque", "큐", "자료구조", "BFS"]
featured: false
draft: false
---

[지난 글](/posts/python-sorted-vs-sort/)에서 정렬 함수의 핵심 차이를 살펴봤습니다. 이번 글에서는 `collections` 모듈의 첫 번째 주인공인 `deque`(덱, double-ended queue)를 다룹니다. 리스트의 `insert(0, x)`와 `pop(0)`이 O(n)인 것과 달리 deque는 **양쪽 끝에서 O(1) 삽입·삭제**를 보장하여 큐, 슬라이딩 윈도우, BFS 등 다양한 상황에서 효율적으로 쓸 수 있습니다.

## deque 기본 사용법

```python
from collections import deque

dq = deque([1, 2, 3])

# 뒤에 추가 / 앞에 추가
dq.append(4)        # deque([1, 2, 3, 4])
dq.appendleft(0)    # deque([0, 1, 2, 3, 4])

# 뒤에서 꺼내기 / 앞에서 꺼내기
dq.pop()            # 4 반환  → deque([0, 1, 2, 3])
dq.popleft()        # 0 반환  → deque([1, 2, 3])

# 여러 요소 한 번에
dq.extend([4, 5])       # deque([1, 2, 3, 4, 5])
dq.extendleft([-1, -2]) # deque([-2, -1, 1, 2, 3, 4, 5])
# extendleft는 역순으로 추가됨에 주의!
```

![deque 양방향 큐 구조](/assets/posts/python-collections-deque-structure.svg)

## rotate — 원형 회전

`rotate(n)`은 오른쪽으로 n칸 회전하고, 음수이면 왼쪽으로 회전합니다.

```python
dq = deque([1, 2, 3, 4, 5])

dq.rotate(2)   # deque([4, 5, 1, 2, 3])
dq.rotate(-2)  # deque([1, 2, 3, 4, 5])  ← 원상복구
```

원형 버퍼나 순환 스케줄링을 구현할 때 유용합니다.

## maxlen — 슬라이딩 윈도우

`maxlen`을 지정하면 크기가 고정되고, 새 요소가 추가될 때 반대편 끝 요소가 자동으로 제거됩니다.

```python
# 최근 3개 로그만 유지
recent = deque(maxlen=3)
for i in range(6):
    recent.append(f"event_{i}")

print(recent)
# deque(['event_3', 'event_4', 'event_5'], maxlen=3)
```

모니터링 도구에서 "최근 N개" 통계를 계산할 때, `maxlen` deque 하나로 고정 크기 원형 버퍼를 간단히 만들 수 있습니다.

## BFS(너비 우선 탐색) 큐

BFS에서 `list.pop(0)`을 쓰면 O(n)이지만 `deque.popleft()`는 O(1)입니다.

```python
from collections import deque

def bfs(graph, start):
    visited = set([start])
    queue = deque([start])
    order = []

    while queue:
        node = queue.popleft()
        order.append(node)

        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    return order

graph = {1: [2, 3], 2: [4], 3: [4, 5], 4: [], 5: []}
print(bfs(graph, 1))  # [1, 2, 3, 4, 5]
```

![deque 주요 메서드 코드 예제](/assets/posts/python-collections-deque-code.svg)

## deque vs list — 언제 어느 것을?

```python
import timeit

# 앞쪽 삽입 비교
setup = "from collections import deque; d = deque(range(10000)); l = list(range(10000))"
t_deque = timeit.timeit("d.appendleft(0)", setup=setup, number=100000)
t_list  = timeit.timeit("l.insert(0, 0)",  setup=setup, number=100000)

# deque가 수십 배 빠름
```

| 연산 | `deque` | `list` |
|---|---|---|
| 앞쪽 삽입/삭제 | **O(1)** | O(n) |
| 뒤쪽 삽입/삭제 | O(1) | O(1) |
| 임의 인덱스 접근 | O(n) | **O(1)** |
| 메모리 | 약간 더 사용 | 덜 사용 |

임의 인덱스로 자주 접근해야 한다면 `list`가, **양 끝에서 삽입·삭제가 빈번**하다면 `deque`가 적합합니다.

---

**지난 글:** [sorted vs sort: 정렬 함수 완벽 비교](/posts/python-sorted-vs-sort/)

**다음 글:** [collections.Counter: 빠른 빈도 분석](/posts/python-collections-counter/)

<br>
읽어주셔서 감사합니다. 😊
