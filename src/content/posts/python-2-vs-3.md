---
title: "Python 2 vs 3 — 무엇이 얼마나 달라졌나"
description: "Python 2와 3의 핵심 차이점을 코드 수준에서 비교하고, 레거시 코드를 마이그레이션하는 방법을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "Python 2", "Python 3", "마이그레이션"]
featured: false
draft: false
---

[지난 글](/posts/python-history/)에서 Python의 역사를 살펴봤습니다. Python 3가 2008년에 나왔지만 2020년까지 Python 2가 공존했던 이유는 그 차이가 단순하지 않았기 때문입니다. 이 글에서는 두 버전의 핵심 차이를 코드 수준에서 비교합니다.

## 가장 눈에 띄는 차이: print

Python 2에서 `print`는 **문(statement)**이었습니다. Python 3에서는 **함수(function)**가 됐습니다.

```python
# Python 2
print "Hello, World!"
print "a =", 42

# Python 3
print("Hello, World!")
print("a =", 42)
```

겉보기에는 괄호 하나 차이지만, 함수로 바뀌면서 `file=`, `sep=`, `end=` 등 키워드 인자를 쓸 수 있게 됐습니다.

```python
# Python 3의 print 함수 활용
print("a", "b", "c", sep="-")   # a-b-c
print("loading", end=" ")        # 줄바꿈 없이
print("done!")                   # loading done!
```

## 나눗셈의 의미가 달라졌다

Python 2에서 정수끼리 나누면 결과도 정수였습니다. 이 동작이 많은 버그의 원인이 됐습니다.

```python
# Python 2
3 / 2   # 결과: 1  (정수 나눗셈)
3.0 / 2 # 결과: 1.5

# Python 3
3 / 2   # 결과: 1.5  (항상 실수 나눗셈)
3 // 2  # 결과: 1    (명시적 정수 나눗셈)
```

Python 3에서는 `/`가 항상 실수를 반환하고, 정수 나눗셈이 필요하면 `//`를 써야 합니다. 훨씬 직관적입니다.

![Python 2 vs 3 주요 차이](/assets/posts/python-2-vs-3-diff.svg)

## 문자열 처리의 근본적 변화

Python 2에서 `str`은 바이트 시퀀스였고, 유니코드 문자열은 `u"..."` 접두사로 따로 구분했습니다. 이 때문에 한글 등 비ASCII 문자 처리에서 `UnicodeDecodeError`가 빈번했습니다.

Python 3에서는 `str`이 기본적으로 유니코드(UTF-8)이고, 바이너리 데이터는 `bytes`로 명확히 분리됩니다.

```python
# Python 3
text = "안녕하세요"          # str = 유니코드
data = text.encode("utf-8") # bytes: b'\xec\x95\x88...'
back = data.decode("utf-8") # str로 복원
print(type(text))  # <class 'str'>
print(type(data))  # <class 'bytes'>
```

## range vs xrange

Python 2에는 `range()`(리스트 반환)와 `xrange()`(이터레이터 반환) 두 가지가 있었습니다. `range(10000000)`은 메모리를 크게 사용했습니다.

Python 3에서 `range()`가 이터레이터처럼 동작하고 `xrange`는 제거됐습니다.

```python
# Python 3
r = range(1_000_000)  # 메모리 거의 안 씀
print(type(r))        # <class 'range'>
print(r[500])         # 500 — 인덱싱은 가능
```

## 예외 문법 변경

```python
# Python 2
try:
    pass
except ValueError, e:  # 쉼표 구분
    print e

# Python 3
try:
    pass
except ValueError as e:  # as 키워드
    print(e)
```

## 기타 주요 차이점

| 항목 | Python 2 | Python 3 |
|---|---|---|
| `dict.keys()` | 리스트 반환 | 뷰 객체 반환 |
| `reduce()` | 내장 함수 | `functools.reduce` |
| 비교 연산 | 다른 타입 비교 가능 | TypeError 발생 |
| `input()` | 값을 eval | 항상 문자열 반환 |
| `long` 타입 | 있음 | `int`로 통합 |

## 마이그레이션 도구

레거시 코드를 Python 3로 옮길 때는 자동화 도구를 활용할 수 있습니다.

![마이그레이션 체크리스트](/assets/posts/python-2-vs-3-migration.svg)

```bash
# 내장 도구: 2to3
2to3 -w myproject/

# 더 적극적인 변환: pyupgrade
pip install pyupgrade
pyupgrade --py312-plus myfile.py
```

## 정리

Python 2와 3의 차이는 단순한 문법 변화가 아니라 언어의 일관성을 회복하려는 근본적 개선이었습니다. `print`, 나눗셈, 문자열, 이터레이터 등 핵심 부분이 더 명확하고 예측 가능하게 바뀌었습니다. 지금 새 프로젝트를 시작한다면 고민 없이 Python 3.12+를 선택하면 됩니다. 다음 글에서는 CPython, PyPy 등 다양한 Python 구현체를 비교합니다.

---

**지난 글:** [Python의 역사 — 탄생부터 현재까지](/posts/python-history/)

**다음 글:** [CPython, PyPy — Python 구현체 완전 비교](/posts/python-implementations-cpython-pypy/)

<br>
읽어주셔서 감사합니다. 😊
