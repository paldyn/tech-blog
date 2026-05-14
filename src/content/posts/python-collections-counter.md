---
title: "collections.Counter: 빠른 빈도 분석"
description: "Python collections.Counter로 요소 빈도를 집계하고, most_common, update, subtract, 산술 연산까지 실전 패턴을 완벽하게 익힙니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["python", "collections", "Counter", "빈도 분석", "딕셔너리"]
featured: false
draft: false
---

[지난 글](/posts/python-collections-deque/)에서 양방향 큐인 deque를 살펴봤습니다. 이번에는 `collections.Counter`를 다룹니다. 텍스트의 단어 빈도, 리스트의 요소 개수, 로그의 이벤트 횟수처럼 **"얼마나 자주 등장하는가"**를 셀 때 for 루프와 딕셔너리를 직접 짜는 것보다 훨씬 간결한 도구입니다.

## Counter 생성 방법

```python
from collections import Counter

# 문자열 → 문자 빈도
c1 = Counter("mississippi")
# Counter({'i': 4, 's': 4, 'p': 2, 'm': 1})

# 리스트
c2 = Counter(["apple", "banana", "apple", "kiwi", "apple"])
# Counter({'apple': 3, 'banana': 1, 'kiwi': 1})

# 키워드 인수
c3 = Counter(red=4, blue=2, green=1)

# 딕셔너리
c4 = Counter({"a": 3, "b": 1})
```

`Counter`는 `dict`의 서브클래스입니다. **없는 키를 조회하면 `KeyError` 대신 `0`을 반환**합니다.

```python
c1 = Counter("hello")
print(c1['z'])  # 0  ← KeyError 없음
```

## most_common — 상위 N개 추출

```python
text = "to be or not to be that is the question"
words = Counter(text.split())

# 가장 많이 등장한 3단어
print(words.most_common(3))
# [('to', 2), ('be', 2), ('or', 1)]  (빈도 동률은 순서 비보장)

# 인수 없이 호출하면 전체를 빈도 내림차순으로
print(words.most_common())
```

![Counter 요소 빈도 자동 집계](/assets/posts/python-collections-counter-concept.svg)

## update와 subtract

```python
total = Counter()
documents = ["apple banana apple", "banana kiwi", "apple"]

for doc in documents:
    total.update(doc.split())

print(total)
# Counter({'apple': 3, 'banana': 2, 'kiwi': 1})

# subtract: 빈도 차감 (음수 허용)
inventory = Counter(apple=10, banana=5)
sold = Counter(apple=3, banana=8)
inventory.subtract(sold)
print(inventory)
# Counter({'apple': 7, 'banana': -3})

# + 연산자로 양수 항목만 추출
in_stock = +inventory
print(in_stock)  # Counter({'apple': 7})
```

`update`는 기존 카운트에 **더하고**, `subtract`는 **빼며** 음수를 허용합니다. 반면 `-` 연산자는 음수 결과를 제거합니다.

## 산술 연산

```python
c1 = Counter(a=3, b=2)
c2 = Counter(a=1, c=4)

print(c1 + c2)  # Counter({'c': 4, 'a': 4, 'b': 2})  — 합산
print(c1 - c2)  # Counter({'b': 2, 'a': 2})          — 차감(양수만)
print(c1 & c2)  # Counter({'a': 1})                  — 교집합(최솟값)
print(c1 | c2)  # Counter({'c': 4, 'a': 3, 'b': 2})  — 합집합(최댓값)
```

## elements와 활용 패턴

```python
c = Counter(a=3, b=2, c=1)

# 각 요소를 빈도만큼 반복 출력
print(list(c.elements()))
# ['a', 'a', 'a', 'b', 'b', 'c']

# 애너그램 판별
def is_anagram(s1, s2):
    return Counter(s1.lower()) == Counter(s2.lower())

print(is_anagram("listen", "silent"))  # True
print(is_anagram("hello", "world"))    # False
```

![Counter 실전 코드 패턴](/assets/posts/python-collections-counter-code.svg)

## Counter 없이 구현하면?

```python
# Counter 없이 단어 빈도 집계
freq = {}
for word in words:
    freq[word] = freq.get(word, 0) + 1

# Counter를 쓰면 한 줄
freq = Counter(words)
```

`Counter`는 이 패턴을 내부적으로 최적화해 처리하므로 직접 구현한 것보다 빠릅니다. 빈도 집계가 필요한 상황이라면 항상 `Counter`를 먼저 고려하세요.

---

**지난 글:** [collections.deque: 양방향 큐의 모든 것](/posts/python-collections-deque/)

**다음 글:** [collections.defaultdict: KeyError 없는 딕셔너리](/posts/python-collections-defaultdict/)

<br>
읽어주셔서 감사합니다. 😊
