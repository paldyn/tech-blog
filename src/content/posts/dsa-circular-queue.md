---
title: "원형 큐 (Circular Queue)"
description: "선형 배열 큐의 공간 낭비 문제를 나머지 연산으로 해결하는 원형 큐의 원리와 Python 구현을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "Algorithm"
tags: ["원형큐", "circular queue", "자료구조", "링 버퍼", "배열"]
featured: false
draft: false
---

[지난 글](/posts/dsa-queue/)에서 큐의 기본 원리와 선형 배열 구현의 함정을 살펴봤습니다. 이번에는 그 함정을 우아하게 해결하는 **원형 큐(Circular Queue)**를 다룹니다. 배열 끝에 도달하면 앞으로 되돌아가 빈 공간을 재활용하는 아이디어는 단순하지만, 임베디드 시스템, 운영체제 버퍼, 스트리밍 데이터 처리에서 광범위하게 사용됩니다.

## 선형 배열 큐의 문제

일반 배열로 큐를 구현할 때 front 인덱스를 증가시켜 dequeue하면, 앞 공간이 점점 낭비됩니다. rear가 배열 끝에 도달하면 앞에 빈 공간이 남아있어도 "가득 찼다"고 판단합니다.

```python
# 문제 상황
arr = [_, _, _, A, B, None, None]
#              ↑front        ↑rear
# front 앞의 _, _, _은 영원히 낭비
```

![원형 큐 구조](/assets/posts/dsa-circular-queue-diagram.svg)

## 원형 큐의 핵심 아이디어

나머지 연산(%)으로 인덱스가 배열 끝을 넘어가면 앞으로 순환합니다.

```
rear = (rear + 1) % capacity
front = (front + 1) % capacity
```

이렇게 하면 배열이 논리적으로 원형처럼 동작합니다.

## 빈 상태와 가득 찬 상태 구별

원형 큐에서 가장 까다로운 부분입니다.

- **빈 상태**: `front == rear`
- **가득 찬 상태**: `(rear + 1) % capacity == front`

두 조건이 충돌하지 않도록 슬롯을 하나 희생합니다. 즉, capacity = 5이면 실제로 담을 수 있는 원소는 4개입니다.

대안으로 `size` 변수를 별도로 관리하면 슬롯 희생 없이 구현할 수 있습니다.

![원형 큐 상태 전이](/assets/posts/dsa-circular-queue-states.svg)

## 완성된 Python 구현

```python
class CircularQueue:
    def __init__(self, capacity: int):
        self._data = [None] * capacity
        self._cap = capacity
        self._front = 0
        self._rear = 0
        self._size = 0     # 슬롯 희생 없이 size로 구분

    def enqueue(self, val):
        if self._size == self._cap:
            raise OverflowError("큐가 가득 찼습니다")
        self._data[self._rear] = val
        self._rear = (self._rear + 1) % self._cap
        self._size += 1

    def dequeue(self):
        if self._size == 0:
            raise IndexError("큐가 비어 있습니다")
        val = self._data[self._front]
        self._data[self._front] = None  # 선택적: GC를 위해
        self._front = (self._front + 1) % self._cap
        self._size -= 1
        return val

    def peek(self):
        if self._size == 0:
            raise IndexError("큐가 비어 있습니다")
        return self._data[self._front]

    def is_empty(self):
        return self._size == 0

    def is_full(self):
        return self._size == self._cap

    def __len__(self):
        return self._size
```

## 동작 검증

```python
q = CircularQueue(4)
q.enqueue('A')
q.enqueue('B')
q.enqueue('C')
print(q.dequeue())  # A
print(q.dequeue())  # B
q.enqueue('D')
q.enqueue('E')      # rear가 앞으로 순환
print(q.dequeue())  # C
print(q.dequeue())  # D
print(q.dequeue())  # E
print(q.is_empty()) # True
```

## 링 버퍼(Ring Buffer)로의 활용

원형 큐의 또 다른 이름이 **링 버퍼(Ring Buffer)**입니다. 이는 프로듀서-컨슈머(Producer-Consumer) 패턴에서 특히 유용합니다.

```python
import threading

class RingBuffer:
    """스레드 안전 링 버퍼"""
    def __init__(self, capacity):
        self._q = CircularQueue(capacity)
        self._lock = threading.Lock()
        self._not_full = threading.Condition(self._lock)
        self._not_empty = threading.Condition(self._lock)

    def produce(self, item):
        with self._not_full:
            while self._q.is_full():
                self._not_full.wait()
            self._q.enqueue(item)
            self._not_empty.notify()

    def consume(self):
        with self._not_empty:
            while self._q.is_empty():
                self._not_empty.wait()
            item = self._q.dequeue()
            self._not_full.notify()
            return item
```

## 운영체제에서의 활용

| 시스템 | 링 버퍼 역할 |
|--------|-------------|
| Linux 커널 | 키보드 입력 버퍼 (kfifo) |
| 네트워크 스택 | 패킷 수신 큐 |
| 음성 처리 | 실시간 오디오 스트림 |
| 시리얼 통신 | UART TX/RX 버퍼 |

## 정리

- 원형 큐는 나머지 연산(%)으로 배열 공간을 재활용합니다.
- 빈/가득찬 상태 구별을 위해 슬롯 1개를 희생하거나 `size` 변수를 관리합니다.
- 모든 연산이 **O(1)** 이며 메모리 효율이 뛰어납니다.
- 링 버퍼로 알려진 이 구조는 운영체제와 임베디드 시스템에서 핵심 역할을 합니다.

---

**지난 글:** [큐](/posts/dsa-queue/)

**다음 글:** [덱](/posts/dsa-deque/)

<br>
읽어주셔서 감사합니다. 😊
