---
title: "딕셔너리 기초: 키-값 매핑의 모든 것"
description: "Python dict의 생성·접근·수정·순회 메서드를 정리하고, 컴프리헨션·병합(|)·setdefault·update 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "dict", "딕셔너리", "해시", "컴프리헨션", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-tuple/)에서 불변 시퀀스인 튜플을 살펴봤다. 이번에는 Python에서 두 번째로 자주 쓰이는 자료구조인 **딕셔너리(dict)**를 다룬다. 해시 테이블로 구현돼 있어 키 검색이 평균 O(1)이다.

## 딕셔너리란

딕셔너리는 **키-값(key-value) 쌍**의 가변 매핑이다. Python 3.7+에서 삽입 순서를 유지한다. 키는 해시 가능한 타입(str, int, tuple 등)이어야 한다.

```python
person = {"name": "Alice", "age": 30, "city": "Seoul"}
empty = {}
by_constructor = dict(name="Bob", age=25)
```

## 접근과 수정

```python
d = {"name": "Alice", "age": 30}

# 읽기
d["name"]           # "Alice"
d["x"]              # KeyError!
d.get("x")          # None (예외 없음)
d.get("x", "N/A")   # "N/A" (기본값)

# 쓰기
d["age"] = 31       # 업데이트
d["city"] = "Seoul" # 새 키 추가

# 삭제
del d["age"]
removed = d.pop("city", None)  # 없어도 None 반환
d.popitem()         # 마지막 (key, value) 쌍 삭제·반환
d.clear()           # 모두 삭제
```

![딕셔너리 기초](/assets/posts/python-dict-basics-overview.svg)

## 순회

```python
d = {"a": 1, "b": 2, "c": 3}

for key in d:           # 키 순회 (기본)
    print(key)

for val in d.values():  # 값 순회
    print(val)

for key, val in d.items():  # 키-값 쌍 순회
    print(f"{key}: {val}")
```

`d.keys()`, `d.values()`, `d.items()`은 뷰(view) 객체를 반환한다. 딕셔너리가 변경되면 뷰도 실시간으로 반영된다.

## 키 존재 여부 확인

```python
"name" in d       # True (키 검사)
"Alice" in d      # False (값 검사 아님!)
"Alice" in d.values()  # True (값 검사)
len(d)            # 항목 개수
```

## setdefault

키가 없을 때만 기본값을 삽입하고 반환한다. 그룹핑 패턴에 자주 쓰인다.

```python
counts = {}
for ch in "hello":
    counts.setdefault(ch, 0)
    counts[ch] += 1
# {"h": 1, "e": 1, "l": 2, "o": 1}
```

## 딕셔너리 병합 (Python 3.9+)

```python
a = {"x": 1, "y": 2}
b = {"y": 99, "z": 3}

c = a | b    # {"x": 1, "y": 99, "z": 3} — 새 dict, b 우선
a |= b       # a를 in-place 업데이트

# 3.9 이전
{**a, **b}   # 동일한 결과
```

## 딕셔너리 컴프리헨션

```python
squares = {x: x**2 for x in range(6)}
# {0: 0, 1: 1, 2: 4, 3: 9, 4: 16, 5: 25}

# 조건 필터링
even_squares = {x: x**2 for x in range(10) if x % 2 == 0}

# 키-값 뒤집기
d = {"a": 1, "b": 2}
inv = {v: k for k, v in d.items()}  # {1: "a", 2: "b"}

# zip으로 두 리스트를 딕셔너리로
keys = ["name", "age", "city"]
vals = ["Alice", 30, "Seoul"]
mapping = dict(zip(keys, vals))
```

![딕셔너리 컴프리헨션](/assets/posts/python-dict-basics-comprehension.svg)

## update

```python
d = {"a": 1}
d.update({"b": 2, "c": 3})   # dict 인수
d.update(d=4, e=5)           # kwargs
d.update([("f", 6)])         # (key, value) 이터러블
```

## 흔한 실수

```python
# 리스트는 키 불가
d = {[1, 2]: "bad"}  # TypeError: unhashable type: 'list'

# 올바른 방법: 튜플 사용
d = {(1, 2): "ok"}

# 순회 중 크기 변경 금지
for k in list(d):    # list()로 복사 후 순회
    del d[k]
```

---

**지난 글:** [튜플: 불변 시퀀스의 힘과 언패킹 패턴](/posts/python-tuple/)

**다음 글:** [집합과 frozenset: 중복 없는 컬렉션](/posts/python-set-frozenset/)

<br>
읽어주셔서 감사합니다. 😊
