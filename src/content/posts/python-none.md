---
title: "None: Python의 '없음'을 나타내는 단 하나의 값"
description: "Python None의 정체(NoneType 싱글턴), 올바른 검사 방법(is/is not), 선택적 인수 기본값 패턴, 그리고 다른 Falsy 값과의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "None", "NoneType", "싱글턴", "Optional", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-bytes-bytearray/)에서 이진 데이터 타입을 살펴봤다. 이번에는 Python에서 "값이 없다"는 것을 표현하는 특별한 객체 `None`을 이해해 본다.

## None의 정체

`None`은 `NoneType`의 유일한 인스턴스다. 싱글턴이기 때문에 프로그램 전체에서 딱 하나의 `None` 객체만 존재한다.

```python
a = None
b = None

type(a)        # <class 'NoneType'>
a is b         # True — 같은 객체
id(a) == id(b) # True
bool(None)     # False
```

`None`은 대소문자를 구분한다. `none`, `Null`, `null`, `NULL`은 Python에서 이름 오류가 발생한다.

## 올바른 None 검사

None은 싱글턴이므로 `==` 대신 `is`/`is not`으로 검사한다.

```python
# 권장
if x is None:
    ...

if x is not None:
    ...

# 비권장: == 은 __eq__ 재정의에 취약
if x == None:  # PEP 8 E711 경고
    ...

# 위험: None뿐 아니라 0, "", [] 도 통과
if not x:
    ...
```

`not x`는 `None` 외에도 `0`, `""`, `[]`, `{}` 같은 모든 Falsy 값을 통과시키므로 의도가 다를 수 있다.

![None 개요](/assets/posts/python-none-overview.svg)

## 선택적 인수 기본값 패턴

가변 객체(`list`, `dict`)를 기본값으로 쓰면 함수 정의 시점에 단 한 번만 생성돼 모든 호출이 공유한다. `None`을 Sentinel로 쓰는 것이 표준 관례다.

```python
# 잘못된 패턴
def append_to(item, lst=[]):    # 모든 호출이 같은 lst 공유
    lst.append(item)
    return lst

# 올바른 패턴
def append_to(item, lst=None):
    if lst is None:
        lst = []
    lst.append(item)
    return lst
```

![None 활용 패턴](/assets/posts/python-none-patterns.svg)

## 타입 힌트에서의 None

`Optional[X]`는 `X | None`의 줄임이다.

```python
from typing import Optional

def find_user(uid: int) -> Optional[str]:
    # 찾으면 이름(str), 없으면 None 반환
    ...

# Python 3.10+ 간결한 문법
def find_user(uid: int) -> str | None:
    ...
```

## None을 반환하는 관례

Python의 순수 부수효과 함수들은 `None`을 반환한다. `list.append()`, `list.sort()`, `dict.update()`가 모두 그렇다.

```python
result = [1, 2, 3].sort()  # None!
# 의도가 sort된 리스트라면
lst = [1, 2, 3]
lst.sort()         # in-place
lst2 = sorted(lst) # 새 리스트 반환
```

`print()` 역시 `None`을 반환하므로, `x = print("hi")` 후 `x`는 `None`이다.

## None 비교 요약

| 값 | `is None` | `bool(x)` | 의미 |
|----|-----------|-----------|------|
| `None` | `True` | `False` | 값 없음 |
| `0` | `False` | `False` | 정수 0 |
| `""` | `False` | `False` | 빈 문자열 |
| `[]` | `False` | `False` | 빈 리스트 |
| `False` | `False` | `False` | 불리언 거짓 |

모두 Falsy지만 `is None`이 `True`인 것은 `None` 뿐이다.

---

**지난 글:** [bytes와 bytearray: 이진 데이터를 다루는 두 가지 방법](/posts/python-bytes-bytearray/)

**다음 글:** [리스트 기초: Python의 만능 순서형 자료구조](/posts/python-list-basics/)

<br>
읽어주셔서 감사합니다. 😊
