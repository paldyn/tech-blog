---
title: "collections.defaultdict: KeyError 없는 딕셔너리"
description: "Python collections.defaultdict로 없는 키에 자동으로 기본값을 생성하는 방법과 그룹화, 빈도 집계, 중첩 딕셔너리 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["python", "collections", "defaultdict", "딕셔너리", "그룹화"]
featured: false
draft: false
---

[지난 글](/posts/python-collections-counter/)에서 Counter로 빈도를 집계하는 법을 배웠습니다. 이번에는 `collections.defaultdict`를 살펴봅니다. 딕셔너리에서 **없는 키에 접근할 때 KeyError가 발생하는 대신 자동으로 기본값을 생성**해 주는 도구입니다. 그룹화 패턴, 역방향 인덱스, 빈도 집계 등 코드를 상당히 간결하게 만들어 줍니다.

## KeyError 문제와 defaultdict 해결책

```python
# 일반 dict: 없는 키에 접근하면 KeyError
d = {}
d["a"].append(1)  # KeyError: 'a'

# 흔한 우회 방법들
d.setdefault("a", []).append(1)     # setdefault
if "a" not in d: d["a"] = []
d["a"].append(1)                    # 명시적 초기화
```

`defaultdict`를 사용하면 이런 방어 코드가 필요 없습니다.

```python
from collections import defaultdict

d = defaultdict(list)
d["a"].append(1)  # 자동으로 [] 생성 후 append
d["a"].append(2)
d["b"].append(3)
print(dict(d))  # {'a': [1, 2], 'b': [3]}
```

![defaultdict — 없는 키에 기본값 자동 생성](/assets/posts/python-collections-defaultdict-concept.svg)

## default_factory 종류

`defaultdict`의 첫 번째 인수인 `default_factory`는 **인수 없이 호출 가능한 객체**면 무엇이든 됩니다.

```python
from collections import defaultdict

# int → 기본값 0  (빈도 집계)
freq = defaultdict(int)
for ch in "hello":
    freq[ch] += 1

# set → 기본값 set()  (중복 없는 그룹화)
tags = defaultdict(set)
tags["python"].add("tutorial")
tags["python"].add("tutorial")  # 중복 무시

# str → 기본값 ""
words = defaultdict(str)

# lambda → 임의 기본값
config = defaultdict(lambda: "unknown")
print(config["missing_key"])  # "unknown"
```

## 그룹화 패턴 — 가장 많이 쓰이는 용도

```python
# 학생 점수를 과목별로 그룹화
records = [
    ("Alice", "math", 90),
    ("Bob",   "math", 85),
    ("Alice", "english", 78),
    ("Bob",   "english", 92),
]

by_subject = defaultdict(list)
for name, subject, score in records:
    by_subject[subject].append((name, score))

print(dict(by_subject))
# {'math': [('Alice',90),('Bob',85)], 'english': [('Alice',78),('Bob',92)]}
```

## 역방향 인덱스

```python
# 원래: {키: 값} → 역: {값: 키 목록}
mapping = {"a": 1, "b": 2, "c": 1, "d": 3}

inv = defaultdict(list)
for k, v in mapping.items():
    inv[v].append(k)

print(dict(inv))  # {1: ['a', 'c'], 2: ['b'], 3: ['d']}
```

![defaultdict 실전 패턴](/assets/posts/python-collections-defaultdict-patterns.svg)

## 중첩 defaultdict

```python
# 2차원 가중치 그래프
graph = defaultdict(lambda: defaultdict(int))
graph["A"]["B"] += 1
graph["A"]["C"] += 2
graph["B"]["C"] += 1

print(graph["A"]["B"])   # 1
print(graph["X"]["Y"])   # 0  ← KeyError 없음
```

주의할 점은 중첩 `defaultdict`를 `pickle`이나 `json`으로 직렬화할 때 `lambda`가 피클링되지 않는다는 것입니다. 그럴 때는 일반 함수를 `default_factory`로 쓰거나, 직렬화 전에 `dict`로 변환하세요.

## defaultdict vs dict.setdefault

```python
# setdefault: 매 호출마다 기본값을 인수로 전달
d = {}
d.setdefault("key", []).append(1)

# defaultdict: 한 번만 factory 지정
d = defaultdict(list)
d["key"].append(1)
```

두 방법 모두 동작하지만, 같은 기본 타입을 반복 사용한다면 `defaultdict`가 더 읽기 쉽습니다. `setdefault`는 키마다 다른 기본값이 필요할 때 적합합니다.

---

**지난 글:** [collections.Counter: 빠른 빈도 분석](/posts/python-collections-counter/)

**다음 글:** [collections.OrderedDict: 순서 보장 딕셔너리](/posts/python-collections-ordereddict/)

<br>
읽어주셔서 감사합니다. 😊
