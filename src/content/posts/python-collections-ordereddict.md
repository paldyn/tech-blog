---
title: "collections.OrderedDict: 순서 보장 딕셔너리"
description: "Python collections.OrderedDict의 순서 기반 동등성, move_to_end, popitem 메서드와 LRU 캐시 구현 패턴을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["python", "collections", "OrderedDict", "LRU 캐시", "딕셔너리"]
featured: false
draft: false
---

[지난 글](/posts/python-collections-defaultdict/)에서 defaultdict로 KeyError 없는 딕셔너리를 다뤘습니다. 이번에는 `collections.OrderedDict`를 살펴봅니다. Python 3.7부터 일반 `dict`도 삽입 순서를 보장하지만, OrderedDict는 **순서를 동등성 조건으로 포함**하고 `move_to_end`, `popitem` 같은 순서 조작 메서드를 제공합니다.

## dict와 OrderedDict의 핵심 차이

```python
from collections import OrderedDict

# 일반 dict: 순서 무관 동등성
d1 = {"a": 1, "b": 2}
d2 = {"b": 2, "a": 1}
print(d1 == d2)  # True

# OrderedDict: 순서도 동등성 조건
od1 = OrderedDict([("a", 1), ("b", 2)])
od2 = OrderedDict([("b", 2), ("a", 1)])
print(od1 == od2)  # False  ← 순서 다르면 불일치

# OrderedDict와 dict 비교: 순서 무시
print(od1 == d1)  # True  ← dict와 비교 시 순서 무관
```

![OrderedDict vs dict 차이점과 활용](/assets/posts/python-collections-ordereddict-compare.svg)

## move_to_end — 순서 조작

```python
od = OrderedDict([("a", 1), ("b", 2), ("c", 3)])

# 마지막으로 이동 (기본값 last=True)
od.move_to_end("a")
print(list(od.keys()))  # ['b', 'c', 'a']

# 처음으로 이동
od.move_to_end("a", last=False)
print(list(od.keys()))  # ['a', 'b', 'c']
```

## popitem — 양쪽 끝에서 꺼내기

```python
od = OrderedDict([("a", 1), ("b", 2), ("c", 3)])

# 마지막 아이템 꺼내기 (기본값 last=True)
print(od.popitem())        # ('c', 3)

# 첫 번째 아이템 꺼내기
print(od.popitem(last=False))  # ('a', 1)
```

일반 `dict.popitem()`은 Python 3.7 이후 항상 마지막을 꺼내지만, `last=False` 옵션은 없습니다. **맨 앞 요소를 꺼내야 할 때**는 `OrderedDict`가 필요합니다.

## LRU 캐시 구현

OrderedDict의 가장 유명한 활용 예시는 LRU(Least Recently Used) 캐시입니다.

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.cache = OrderedDict()
        self.capacity = capacity

    def get(self, key):
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)  # 최근 사용으로 표시
        return self.cache[key]

    def put(self, key, value):
        self.cache[key] = value
        self.cache.move_to_end(key)
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)  # 가장 오래된 항목 제거

# 사용 예
cache = LRUCache(2)
cache.put(1, "one")
cache.put(2, "two")
print(cache.get(1))    # "one" → 1이 최근 사용으로 이동
cache.put(3, "three")  # 용량 초과 → 2 제거
print(cache.get(2))    # -1  ← 제거됨
```

![OrderedDict로 LRU 캐시 구현](/assets/posts/python-collections-ordereddict-lru.svg)

## Python 3.7 이후 OrderedDict가 필요한 경우

Python 3.7 이후 `dict`도 삽입 순서를 유지하므로, **단순히 순서를 보존하고 싶다면 `dict`로 충분**합니다. OrderedDict를 선택해야 하는 경우는 다음과 같습니다.

- **순서가 동등성 판단에 포함되어야 할 때** (`od1 == od2`)
- **`move_to_end()`나 `popitem(last=False)`가 필요할 때**
- **Python 3.6 이하 호환성이 필요할 때**

```python
# Python 3.7+: 순서 보존 확인
d = {}
d["first"] = 1
d["second"] = 2
d["third"] = 3
print(list(d.keys()))  # ['first', 'second', 'third']
# 순서 보존 — OrderedDict 불필요
```

실무에서는 LRU 캐시가 필요하다면 `functools.lru_cache` 데코레이터나 `functools.cache`를 먼저 검토하고, 커스텀 로직이 필요할 때만 `OrderedDict`를 직접 사용하는 것이 일반적입니다.

---

**지난 글:** [collections.defaultdict: KeyError 없는 딕셔너리](/posts/python-collections-defaultdict/)

**다음 글:** [collections.namedtuple: 이름 있는 튜플](/posts/python-collections-namedtuple/)

<br>
읽어주셔서 감사합니다. 😊
