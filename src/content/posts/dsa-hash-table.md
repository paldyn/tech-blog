---
title: "해시 테이블 (Hash Table)"
description: "키-값 쌍을 O(1) 평균으로 저장·조회하는 해시 테이블의 구조, 충돌 해결 전략, Python dict 내부 동작까지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "Algorithm"
tags: ["해시테이블", "hash table", "자료구조", "충돌해결", "dict"]
featured: false
draft: false
---

[지난 글](/posts/dsa-skip-list/)에서 정렬 데이터를 평균 O(log n)에 처리하는 스킵 리스트를 살펴봤습니다. 이번에는 더 빠른 **O(1) 평균** 탐색·삽입·삭제를 제공하는 **해시 테이블(Hash Table)**을 다룹니다. Python의 `dict`와 `set`, Java의 `HashMap`, JavaScript의 객체 리터럴 등이 모두 해시 테이블 기반입니다.

## 해시 테이블의 구조

해시 테이블은 **해시 함수(hash function)**로 키를 정수 인덱스로 변환해 배열의 해당 위치(버킷)에 값을 저장합니다.

```
인덱스 = hash(key) % capacity
```

이상적인 경우 모든 연산이 O(1)이지만, **충돌(collision)**이 발생하면 성능이 저하됩니다.

![해시 테이블 — 체이닝 방식](/assets/posts/dsa-hash-table-structure.svg)

## 로드 팩터 (Load Factor)

```
로드 팩터 α = 저장된 원소 수 n / 배열 용량 capacity
```

α가 높을수록 충돌이 잦아져 성능이 저하됩니다. 일반적으로 α < 0.75를 유지하며, 초과 시 **rehashing**(용량 2배 확장 + 전체 재삽입)을 수행합니다.

## 충돌 해결 전략

### 1. 체이닝 (Chaining)

같은 버킷의 원소들을 연결 리스트로 연결합니다.

```python
class HashTableChaining:
    def __init__(self, capacity=16):
        self._cap = capacity
        self._buckets = [[] for _ in range(capacity)]
        self._size = 0

    def _index(self, key):
        return hash(key) % self._cap

    def put(self, key, val):
        idx = self._index(key)
        for i, (k, v) in enumerate(self._buckets[idx]):
            if k == key:
                self._buckets[idx][i] = (key, val)
                return
        self._buckets[idx].append((key, val))
        self._size += 1
        if self._size / self._cap > 0.75:
            self._resize()

    def get(self, key):
        for k, v in self._buckets[self._index(key)]:
            if k == key:
                return v
        raise KeyError(key)

    def _resize(self):
        old_buckets = self._buckets
        self._cap *= 2
        self._buckets = [[] for _ in range(self._cap)]
        self._size = 0
        for bucket in old_buckets:
            for k, v in bucket:
                self.put(k, v)
```

### 2. 개방 주소법 (Open Addressing)

충돌 시 다른 빈 슬롯을 탐사합니다.

![충돌 해결 전략 비교](/assets/posts/dsa-hash-table-collision.svg)

```python
class HashTableOpenAddressing:
    DELETED = object()    # tombstone

    def __init__(self, capacity=16):
        self._cap = capacity
        self._slots = [None] * capacity
        self._size = 0

    def _probe(self, key, i):
        """선형 탐사: (h + i) % cap"""
        return (hash(key) + i) % self._cap

    def put(self, key, val):
        for i in range(self._cap):
            idx = self._probe(key, i)
            slot = self._slots[idx]
            if slot is None or slot is self.DELETED:
                self._slots[idx] = (key, val)
                self._size += 1
                return
            if slot[0] == key:
                self._slots[idx] = (key, val)
                return
        raise OverflowError("해시 테이블이 가득 찼습니다")

    def get(self, key):
        for i in range(self._cap):
            idx = self._probe(key, i)
            slot = self._slots[idx]
            if slot is None:
                raise KeyError(key)
            if slot is not self.DELETED and slot[0] == key:
                return slot[1]
        raise KeyError(key)

    def delete(self, key):
        for i in range(self._cap):
            idx = self._probe(key, i)
            slot = self._slots[idx]
            if slot is None:
                raise KeyError(key)
            if slot is not self.DELETED and slot[0] == key:
                self._slots[idx] = self.DELETED  # tombstone
                self._size -= 1
                return
        raise KeyError(key)
```

## Python dict의 내부 동작

Python 3.6+ `dict`는 개방 주소법 기반 해시 테이블입니다.

- 초기 capacity = 8
- 로드 팩터 임계값 = 2/3 (약 0.67)
- 삽입 순서 보장 (Python 3.7+)

```python
# dict의 해시 테이블 특성 확인
d = {}
for i in range(100):
    d[f"key_{i}"] = i

# 실제 크기는 가장 가까운 2의 제곱수
import sys
print(sys.getsizeof(d))          # 버킷 배열 크기 포함

# 해시 충돌 확인 (정수는 자기 자신이 해시값)
print(hash("hello"))             # 고정되지 않음 (Python은 PYTHONHASHSEED 사용)
print(hash(42))                  # 42
print(hash(42.0))                # 42 (42 == 42.0 이므로)
```

## 복잡도 정리

| 연산 | 평균 | 최악 |
|------|------|------|
| 조회 get | O(1) | O(n) |
| 삽입 put | O(1) amortized | O(n) |
| 삭제 delete | O(1) | O(n) |
| 공간 | O(n) | O(n) |

최악 O(n)은 모든 키가 동일한 버킷으로 해시되는 경우지만, 좋은 해시 함수 사용 시 실용적으로 무시 가능합니다.

## 실전 팁

```python
# 빈도 세기 — Counter 활용
from collections import Counter
words = ["apple", "banana", "apple", "cherry", "banana", "apple"]
freq = Counter(words)
print(freq.most_common(2))   # [('apple', 3), ('banana', 2)]

# defaultdict — 키 없을 때 기본값 자동 생성
from collections import defaultdict
graph = defaultdict(list)
graph[1].append(2)
graph[1].append(3)
print(dict(graph))   # {1: [2, 3]}

# 두 리스트의 교집합
a, b = [1, 2, 3, 4], [3, 4, 5, 6]
common = set(a) & set(b)         # O(min(len(a), len(b)))
```

## 정리

- 해시 테이블은 해시 함수로 키를 인덱스로 변환해 평균 O(1) 접근을 제공합니다.
- 로드 팩터 α < 0.75를 유지하는 것이 성능의 핵심입니다.
- 체이닝은 로드 팩터 1 이상도 허용하고, 개방 주소법은 캐시 친화적입니다.
- Python `dict`는 개방 주소법 기반으로 삽입 순서를 보장합니다.

---

**지난 글:** [스킵 리스트](/posts/dsa-skip-list/)

**다음 글:** [해시 함수](/posts/dsa-hash-function/)

<br>
읽어주셔서 감사합니다. 😊
