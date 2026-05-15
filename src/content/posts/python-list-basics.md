---
title: "리스트 기초: Python의 만능 순서형 자료구조"
description: "Python list의 생성·접근·슬라이싱·변경 메서드를 정리하고, 정렬(sort/sorted)과 얕은·깊은 복사의 차이까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "list", "리스트", "슬라이싱", "정렬", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-none/)에서 None을 살펴봤다. 이번에는 Python에서 가장 자주 쓰이는 컨테이너 타입인 **리스트(list)**를 기초부터 살펴본다.

## 리스트란

리스트는 **가변(mutable)·순서 있음·중복 허용** 시퀀스다. 이질적인 타입도 담을 수 있으며, 내부적으로는 동적 배열로 구현돼 있다.

```python
lst = [1, 2, 3]
empty = []
mixed = [1, "hi", True, None, [4, 5]]  # 중첩도 가능
```

## 인덱싱과 슬라이싱

```python
lst = [10, 20, 30, 40, 50]
lst[0]     # 10  (첫 번째)
lst[-1]    # 50  (마지막)
lst[1:3]   # [20, 30]  (stop 미포함)
lst[::2]   # [10, 30, 50]  (2칸씩)
lst[::-1]  # [50, 40, 30, 20, 10]  (역순)
```

슬라이스는 **새 리스트**를 반환한다. `lst[::]`는 얕은 복사본이다.

![리스트 기초 — 생성·접근·수정](/assets/posts/python-list-basics-overview.svg)

## 주요 메서드

```python
lst = [1, 2, 3]
lst.append(4)        # 끝에 추가: [1, 2, 3, 4]
lst.insert(1, 99)    # 인덱스 1에 삽입: [1, 99, 2, 3, 4]
lst.extend([5, 6])   # 여러 원소 추가
lst.remove(99)       # 값으로 첫 번째 항목 삭제
lst.pop()            # 마지막 항목 삭제 후 반환
lst.pop(0)           # 인덱스 0 삭제 후 반환
del lst[2]           # 인덱스 2 삭제 (반환값 없음)
lst.clear()          # 모두 삭제
```

## 검색과 유용한 함수

```python
lst = [3, 1, 4, 1, 5, 9, 2, 6]
3 in lst          # True
lst.index(4)      # 2  (첫 위치)
lst.count(1)      # 2  (개수)
len(lst)          # 8
sum(lst)          # 31
min(lst), max(lst) # 1, 9
```

## 정렬

```python
nums = [3, 1, 4, 1, 5]
nums.sort()               # in-place, None 반환
nums.sort(reverse=True)   # 내림차순

s = sorted(nums)          # 새 리스트 반환, 원본 불변
sorted(nums, key=abs)     # key 함수 지정

words = ["banana", "fig", "apple"]
sorted(words, key=len)    # 길이 기준: ['fig', 'apple', 'banana']
sorted(words, key=lambda w: (len(w), w))  # 길이→알파벳 다중 조건
```

`sort()`는 원본을 수정하며 `None`을 반환한다. `sorted()`는 새 리스트를 반환한다.

![리스트 정렬·복사](/assets/posts/python-list-basics-sorting.svg)

## 얕은 복사 vs 깊은 복사

```python
a = [1, 2, [3, 4]]
b = a[:]            # 얕은 복사 (a.copy(), list(a)도 동일)

b[0] = 99           # a[0]은 그대로 1
b[2].append(5)      # a[2]도 [3, 4, 5]로 변경됨!

import copy
c = copy.deepcopy(a)
c[2].append(9)      # a 영향 없음
```

중첩 리스트가 있으면 얕은 복사는 내부 객체를 공유한다. 독립적인 복사가 필요하면 `deepcopy`를 써야 한다.

## 리스트 연산

```python
[1, 2] + [3, 4]  # [1, 2, 3, 4]  (새 리스트)
[0] * 3          # [0, 0, 0]

a = [1, 2]
a += [3, 4]      # extend와 동일: [1, 2, 3, 4] (in-place)
```

`+`는 새 리스트를 반환하지만 `+=`는 in-place 확장이다.

## 리스트 언패킹

```python
first, *rest = [1, 2, 3, 4, 5]
# first = 1, rest = [2, 3, 4, 5]

a, b, c = [10, 20, 30]
a, b = b, a      # swap
```

---

**지난 글:** [None: Python의 '없음'을 나타내는 단 하나의 값](/posts/python-none/)

**다음 글:** [튜플: 불변 시퀀스의 힘과 언패킹 패턴](/posts/python-tuple/)

<br>
읽어주셔서 감사합니다. 😊
