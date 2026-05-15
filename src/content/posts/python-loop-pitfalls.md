---
title: "루프 함정: Python 루프에서 흔히 만나는 버그와 해결책"
description: "Python 루프의 대표 함정 5가지 — 순회 중 컬렉션 수정, 클로저의 지연 바인딩, range(len) 안티패턴, 루프 내 비싼 연산, 루프 변수 누출 — 원인과 해결책을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "루프", "함정", "버그", "클로저", "중급"]
featured: false
draft: false
---

[지난 글](/posts/python-pass-keyword/)에서 `pass` 키워드를 살펴봤다. 이번 글로 제어 흐름 파트를 마무리한다. 앞서 배운 `for`, `while`, `break`, `continue`를 쓰다 보면 반드시 한 번쯤 만나는 **숨어있는 버그 패턴들**을 정리한다.

## 함정 1: 순회 중 컬렉션 수정

가장 흔한 실수다. 리스트를 `for`로 순회하면서 동시에 요소를 추가하거나 제거하면 인덱스가 어긋난다.

```python
nums = [1, 2, 3, 4, 5]
for n in nums:
    if n % 2 == 0:
        nums.remove(n)   # 순회 중 수정!

print(nums)   # [1, 3, 5] 예상 → 실제: [1, 3, 4, 5]
```

`n=2` 제거 후 인덱스가 밀려 `n=4`를 건너뛴다. 딕셔너리도 마찬가지 — 순회 중 키를 추가/삭제하면 `RuntimeError: dictionary changed size during iteration`이 발생한다.

**해결책: 컴프리헨션(신규 리스트) 또는 복사본 순회**

```python
# 권장: 컴프리헨션
nums = [n for n in nums if n % 2 != 0]

# 복사본 순회 (리스트 슬라이스)
for n in nums[:]:
    if n % 2 == 0:
        nums.remove(n)

# 딕셔너리: keys() 복사
for key in list(d.keys()):
    if should_delete(key):
        del d[key]
```

![루프 함정 1: 순회 중 컬렉션 수정](/assets/posts/python-loop-pitfalls-overview.svg)

## 함정 2: 클로저의 지연 바인딩

람다나 내부 함수에서 루프 변수를 참조하면, 변수의 **현재 값**이 아닌 **참조**를 캡처한다. 루프가 끝난 후에 함수를 호출하면 모두 마지막 값을 반환한다.

```python
funcs = []
for i in range(3):
    funcs.append(lambda: i)   # i 참조 캡처

print([f() for f in funcs])   # 기대: [0, 1, 2] → 실제: [2, 2, 2]
```

루프 종료 시 `i=2` 이고, 세 람다 모두 같은 `i`를 참조하므로 모두 `2`를 반환한다.

**해결책: 기본 인수로 값 캡처**

```python
funcs = []
for i in range(3):
    funcs.append(lambda i=i: i)   # 현재 i 값을 기본 인수로 고정

print([f() for f in funcs])   # [0, 1, 2] ✓
```

또는 `functools.partial`을 활용한다.

```python
from functools import partial

def make_func(n):
    return n

funcs = [partial(make_func, i) for i in range(3)]
print([f() for f in funcs])   # [0, 1, 2] ✓
```

## 함정 3: range(len()) 안티패턴

값만 필요한데 굳이 인덱스를 통해 접근하는 패턴은 장황하고 느리다.

```python
# 나쁜 예
for i in range(len(items)):
    print(items[i])

# 좋은 예: 값 직접 순회
for item in items:
    print(item)

# 인덱스도 필요하다면 enumerate
for i, item in enumerate(items):
    print(i, item)
```

두 리스트를 병렬로 처리하려면 `zip()`을 쓴다.

```python
# 나쁜 예
for i in range(len(names)):
    print(names[i], scores[i])

# 좋은 예
for name, score in zip(names, scores):
    print(name, score)
```

## 함정 4: 루프 안 비싼 연산

반복마다 동일하게 실행되는 비용 큰 연산은 루프 밖으로 끌어내야 한다.

```python
import re

# 나쁜 예: 매 반복마다 패턴 컴파일
for line in lines:
    if re.match(r"\d+\.\d+", line):   # 매번 컴파일
        process(line)

# 좋은 예: 루프 밖에서 컴파일
pattern = re.compile(r"\d+\.\d+")
for line in lines:
    if pattern.match(line):
        process(line)
```

데이터베이스 쿼리, 파일 열기, 네트워크 요청도 마찬가지다. 루프 조건에서 매번 같은 결과를 반환하는 함수 호출은 반드시 밖으로 꺼내자.

## 함정 5: 루프 변수 누출

Python `for` 루프는 블록 스코프가 없다. 루프가 끝난 후에도 변수가 남아있다.

```python
for x in range(5):
    pass

print(x)   # 4 — 루프가 끝났어도 살아있음
```

의도치 않게 같은 이름의 변수가 겹치면 디버깅이 어렵다.

```python
x = 100
for x in some_list:
    do_something(x)
# 루프 후 x = some_list의 마지막 값 (100이 아님!)
print(x)   # 예상과 다른 값
```

명시적 이름을 쓰거나, 루프 변수를 임시임을 나타내는 `_` 를 활용하자.

![루프 함정 2-4](/assets/posts/python-loop-pitfalls-patterns.svg)

## 함정 6: 빈 시퀀스에서 변수 미정의

루프가 한 번도 실행되지 않으면 루프 변수가 정의되지 않는다.

```python
for item in []:
    last = item

print(last)   # NameError: name 'last' is not defined
```

루프 후 변수를 쓸 계획이라면 반드시 루프 전에 초기값을 설정하자.

```python
last = None
for item in collection:
    last = item
# collection이 비어도 last는 None으로 안전
```

## 정리

| 함정 | 원인 | 해결책 |
|------|------|-------|
| 순회 중 수정 | 인덱스 어긋남 | 컴프리헨션, 복사본 순회 |
| 클로저 지연 바인딩 | 참조 캡처 | `lambda i=i: i`, `partial` |
| `range(len)` | 불필요한 인덱스 | 직접 순회, `enumerate`, `zip` |
| 루프 안 비싼 연산 | 반복 계산 | 루프 밖 호이스팅 |
| 변수 누출 | 블록 스코프 없음 | 명확한 이름, 루프 전 초기화 |

---

**지난 글:** [pass 키워드: 아무것도 하지 않는 것의 역할](/posts/python-pass-keyword/)

<br>
읽어주셔서 감사합니다. 😊
