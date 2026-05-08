---
title: "Python 2 vs 3: 왜 모두가 3으로 넘어왔는가"
description: "Python 2와 3의 핵심 차이를 코드로 비교합니다. print, 나누기, 유니코드, range의 변화와 마이그레이션 도구를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "Python2", "Python3", "마이그레이션", "호환성"]
featured: false
draft: false
---

[지난 글](/posts/python-history/)에서 Python 2와 3이 10년 넘게 공존했던 복잡한 역사를 살펴봤다. 이번 편에서는 두 버전의 차이를 코드 수준에서 구체적으로 비교한다. Python 2는 2020년에 공식 지원이 종료되었지만, 레거시 코드베이스나 마이그레이션 작업을 위해 여전히 차이를 이해해야 하는 경우가 있다. 그리고 왜 Python 3의 설계가 더 올바른지를 이해하면 언어 자체에 대한 이해가 깊어진다.

## 가장 눈에 띄는 변화: print

Python을 처음 배울 때 가장 먼저 만나는 함수가 `print`다. 이것이 Python 2와 3 사이에서 가장 상징적인 변화다.

```python
# Python 2
print "Hello, World!"          # 문(statement)
print "a", "b", "c"            # 쉼표로 여러 값 출력
print >> sys.stderr, "error"   # 파일 리디렉션

# Python 3
print("Hello, World!")          # 함수(function)
print("a", "b", "c")            # 동일하게 동작
print("error", file=sys.stderr)  # 키워드 인수 사용
```

`print`가 문(statement)에서 함수(function)로 바뀐 것은 단순한 괄호 추가가 아니다. 함수가 되면서 변수에 할당하거나, 다른 함수에 인수로 넘기거나, `sep`·`end`·`file`·`flush` 같은 키워드 인수를 사용할 수 있게 되었다.

```python
# Python 3 print()의 추가 기능
print("a", "b", "c", sep="-")       # → a-b-c
print("loading", end="...")          # → loading... (줄바꿈 없음)
print(1, 2, 3, sep="\n")            # 각 값을 새 줄에

import sys
print("오류!", file=sys.stderr)      # stderr로 출력
```

![Python 2 vs 3 코드 비교](/assets/posts/python-2-vs-3-code.svg)

## 정수 나누기: 가장 흔한 버그의 원인

Python 2에서 정수끼리 나누면 결과가 항상 정수였다. 이 동작이 수많은 버그의 원인이었다.

```python
# Python 2
5 / 2   # → 2   (floor division, 소수점 버림)
5 / 2.0 # → 2.5 (float가 하나라도 있으면 float 결과)

# Python 3
5 / 2   # → 2.5  (항상 float 반환)
5 // 2  # → 2    (명시적 floor division)
5 % 2   # → 1    (나머지)
```

Python 3에서 `/`는 항상 실수 나누기를 하고, `//`는 명시적으로 버림 나누기를 한다. 의도를 코드에 명확히 드러내게 한 것이다. Python 2에서 `5 / 2`가 2인지 2.5인지를 인수 타입으로 판단해야 했던 문제가 사라졌다.

```python
# Python 3에서 안전한 정수 나누기
count = 7
half = count // 2      # 3 (정수 보장)
ratio = count / 2      # 3.5 (실수)

# 나누기 결과를 정수로 원할 때
result = int(count / 2)  # 3
result = count // 2       # 3 (더 명확)
```

## 문자열과 유니코드

Python 2에서 문자열 처리는 악몽이었다. `str`이 기본적으로 bytes였고, 유니코드 문자열은 `u"..."` 접두사를 붙여야 했다.

```python
# Python 2
s1 = "hello"      # bytes (str)
s2 = u"안녕"      # unicode
type(s1)          # <type 'str'>
type(s2)          # <type 'unicode'>

# 한글 출력 시 오류 발생 가능
print "안녕"      # UnicodeDecodeError 발생 가능

# Python 3
s1 = "hello"      # str (항상 Unicode)
s2 = "안녕"       # 동일하게 str
b1 = b"hello"     # bytes (바이트열)
type(s1)          # <class 'str'>
type(b1)          # <class 'bytes'>
```

Python 3에서 `str`은 항상 Unicode다. 전 세계 모든 문자를 아무 접두사 없이 사용할 수 있다. 바이트열이 필요할 때는 `b"..."` 접두사를 명시적으로 붙인다. 이 변화 덕분에 인코딩 관련 버그가 대폭 줄었다.

```python
# Python 3의 인코딩 처리
text = "안녕하세요"
encoded = text.encode("utf-8")    # bytes
decoded = encoded.decode("utf-8") # str
print(decoded)  # 안녕하세요

# 파일 읽기 시 인코딩 명시
with open("file.txt", "r", encoding="utf-8") as f:
    content = f.read()
```

![Python 2 vs 3 비교표](/assets/posts/python-2-vs-3-comparison.svg)

## range()와 xrange()

Python 2에서 `range()`는 리스트를 즉시 생성했고, `xrange()`는 이터레이터를 반환했다. 두 함수가 공존해서 초보자를 혼란스럽게 했다.

```python
# Python 2
range(5)    # → [0, 1, 2, 3, 4] (리스트 즉시 생성)
xrange(5)   # → xrange(5) (이터레이터, 메모리 효율)

# range(10000000) → 1000만 개 리스트를 메모리에 올림
# xrange(10000000) → 필요할 때마다 하나씩 생성

# Python 3
range(5)    # → range(0, 5) (항상 이터레이터)
list(range(5))  # → [0, 1, 2, 3, 4] (리스트로 변환)

# 10000000번 루프: 메모리 걱정 없음
for i in range(10_000_000):
    pass
```

Python 3에서는 `xrange()`가 제거되고 `range()`가 이터레이터 방식으로 통일되었다. `range(10_000_000)`도 메모리를 거의 쓰지 않는다. 실제 숫자가 필요할 때만 하나씩 계산하기 때문이다.

## input()과 raw_input()

```python
# Python 2
x = raw_input("값 입력: ")  # 항상 str 반환
y = input("값 입력: ")      # eval() 후 반환 (보안 문제!)

# Python 3
x = input("값 입력: ")      # 항상 str 반환 (raw_input 동작)
y = int(input("숫자: "))    # 명시적 형변환 필요
```

Python 2의 `input()`은 사용자 입력을 `eval()`로 처리했다. `os.system("rm -rf /")` 같은 입력도 실행될 수 있었다. Python 3에서는 `input()`이 항상 문자열을 반환하도록 바뀌었고, Python 2의 안전하지 않은 `input()`은 제거되었다.

## 예외 처리 문법

```python
# Python 2
try:
    risky()
except ValueError, e:   # 쉼표로 예외 변수 바인딩
    print e

# Python 3
try:
    risky()
except ValueError as e:  # as 키워드 사용
    print(e)
```

Python 2의 `except Error, e:` 문법은 `except (A, B):` 처럼 여러 예외를 묶는 문법과 혼동되었다. Python 3에서 `as` 키워드로 명확하게 분리되었다.

## super() 사용법

```python
# Python 2
class Child(Parent):
    def __init__(self):
        super(Child, self).__init__()  # 클래스와 self를 명시

# Python 3
class Child(Parent):
    def __init__(self):
        super().__init__()  # 인수 불필요
```

## 마이그레이션 도구

레거시 Python 2 코드를 3으로 옮겨야 한다면 도구를 활용하자.

```bash
# 2to3: Python 2 코드를 3으로 자동 변환
2to3 -w my_script.py

# pyupgrade: 최신 Python 3 문법으로 업그레이드
pip install pyupgrade
pyupgrade --py310-plus my_file.py

# modernize: 2/3 호환 코드로 변환
pip install modernize
python-modernize -w my_file.py
```

자동 변환 도구가 모든 것을 처리하지는 못한다. 특히 문자열 인코딩, 의존 라이브러리의 3 호환성은 수동으로 확인해야 한다.

## 결론: 지금 시작한다면 Python 3

새로운 프로젝트를 시작한다면 Python 3를 사용해야 한다. Python 2는 2020년에 공식 지원이 종료되었고, 보안 패치도 더 이상 제공되지 않는다. 주요 라이브러리(NumPy, pandas, Django 등) 모두 Python 2 지원을 종료했다.

Python 3의 변화들은 단순히 "다르게 만들기 위한 변화"가 아니다. 각각의 변화에는 명확한 이유가 있다. `print`를 함수로 만든 것은 일관성 때문이고, 나누기를 float으로 한 것은 예상치 못한 버그를 방지하기 위해서다. 유니코드를 기본으로 한 것은 국제화 시대에 맞는 올바른 결정이었다.

다음 편에서는 CPython만이 Python의 유일한 구현체가 아님을 살펴본다. PyPy, Jython, IronPython 등 다양한 구현체와 그 용도를 알아볼 것이다.

---

**지난 글:** [Python의 탄생과 역사: Guido에서 3.12까지](/posts/python-history/)

**다음 글:** [CPython과 PyPy: Python 구현체의 세계](/posts/python-implementations-cpython-pypy/)

<br>
읽어주셔서 감사합니다. 😊
