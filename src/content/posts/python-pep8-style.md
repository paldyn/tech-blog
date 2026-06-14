---
title: "PEP 8 스타일 가이드: 읽기 쉬운 코드의 기준"
description: "Python 공식 스타일 가이드 PEP 8의 핵심 규칙을 설명합니다. 들여쓰기, 줄 길이, 이름 규칙, 공백, import 순서와 자동 포매터를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "PEP8", "스타일가이드", "flake8", "black", "ruff"]
featured: false
draft: false
---

[지난 글](/posts/python-zen-pep20/)에서 Python의 설계 철학 "Zen of Python"을 살펴봤다. PEP 20이 "왜 이렇게 써야 하는가"에 대한 철학이라면, PEP 8은 "구체적으로 어떻게 써야 하는가"에 대한 실용 가이드다. PEP 8은 2001년에 작성되어 지금까지 Python 코드의 표준 스타일 가이드 역할을 하고 있다. 이것을 따르면 오픈소스 기여, 팀 협업, 코드 리뷰가 훨씬 수월해진다.

## 들여쓰기: 4 스페이스

가장 기본적인 규칙이다. PEP 8은 들여쓰기에 **스페이스 4칸**을 권장한다. 탭(Tab)을 사용해도 동작하지만 권장하지 않는다. 탭과 스페이스를 혼용하면 `TabError`가 발생한다.

```python
# 올바른 들여쓰기 (4 스페이스)
def calculate_area(width, height):
    if width <= 0 or height <= 0:
        raise ValueError("양수여야 합니다")
    return width * height

# 중첩 구조
for i in range(10):
    if i % 2 == 0:
        print(f"{i}은 짝수")
    else:
        print(f"{i}은 홀수")
```

에디터 설정에서 "탭을 스페이스로 변환(Expand tabs to spaces)"과 "탭 크기를 4로(Tab size: 4)"를 켜두면 탭키를 눌러도 스페이스 4칸이 삽입된다.

## 줄 길이: 79자 이하

PEP 8은 코드 한 줄을 **79자 이하**로 유지하길 권장한다. 주석과 독스트링은 72자. 이 규칙은 낡아 보일 수 있지만 (80열 터미널은 이제 드물다), 편집기 두 개를 나란히 열어두고 작업할 때나 코드 리뷰 도구에서 여전히 중요하다.

```python
# 너무 긴 줄
result = some_function(argument_one, argument_two, argument_three, keyword=value)

# 괄호 안에서 줄 바꿈 (암묵적 연속)
result = some_function(
    argument_one,
    argument_two,
    argument_three,
    keyword=value,
)

# 백슬래시로 줄 연속 (가능하지만 비권장)
result = (argument_one +
          argument_two +
          argument_three)
```

괄호, 대괄호, 중괄호 안에서는 자유롭게 줄을 바꿀 수 있다. 이것이 백슬래시보다 선호되는 방법이다.

## 빈 줄: 시각적 구분

```python
# 최상위 함수와 클래스 사이: 2줄

class MyClass:
    """클래스 독스트링."""

    class_var = 0       # 클래스 변수

    def method_one(self):
        pass
                        # 메서드 사이: 1줄
    def method_two(self):
        pass


def standalone_function():  # 클래스와 함수 사이: 2줄
    pass


def another_function():
    pass
```

![PEP 8 핵심 규칙](/assets/posts/python-pep8-style-rules.svg)

## import 규칙

import는 파일 상단에 위치하고, 세 그룹으로 나눠 각 그룹 사이에 빈 줄을 넣는다.

```python
# 1. 표준 라이브러리
import os
import sys
from pathlib import Path

# 2. 서드파티 라이브러리 (pip로 설치한 것)
import numpy as np
import pandas as pd
from fastapi import FastAPI

# 3. 로컬 모듈
from my_project import utils
from my_project.models import User
```

한 줄에 여러 모듈을 import하지 않는다.

```python
# 나쁨
import os, sys, json

# 좋음
import json
import os
import sys
```

## 이름 규칙 (Naming Convention)

Python에서 이름 규칙은 종류별로 다르다.

```python
# 변수, 함수, 메서드: snake_case
user_name = "Alice"
total_count = 42

def calculate_interest(principal, rate):
    return principal * rate

# 클래스: PascalCase (CapWords)
class UserAccount:
    pass

class HttpRequestHandler:
    pass

# 상수: UPPER_CASE
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30
PI = 3.14159

# 모듈, 패키지: lowercase (짧게)
import json
import os
# import mymodule (짧은 소문자)

# 보호된 속성: _single_underscore
class Config:
    _cache = {}

# 비공개 속성: __double_underscore (맹글링)
class Secret:
    __private_key = "..."

# 매직 메서드: __dunder__
class MyClass:
    def __init__(self):
        pass
    def __repr__(self):
        return "MyClass()"
```

## 공백 규칙

공백 하나가 코드 가독성에 큰 영향을 준다.

```python
# 연산자 주변에 공백 (대입, 비교, 논리)
x = 1
y = x + 2
is_valid = x > 0 and y > 0

# 함수 인수의 기본값 = 에는 공백 없음
def func(x, y=10, z=None):
    pass

# 키워드 인수 전달 시에도 공백 없음
func(x=1, y=2)

# 쉼표, 콜론, 세미콜론 뒤에만 공백
items = [1, 2, 3]
data = {"key": "value"}

# 슬라이싱에서는 : 주변 공백 없음
s = "hello"
sub = s[1:3]
sub = s[::2]
```

```python
# 잘못된 공백
x=1         # = 주변 공백 없음
func( x )   # 괄호 안 공백
items [0]   # 인덱스 앞 공백
d = {'a' : 1}  # 콜론 앞 공백
```

## 주석과 독스트링

```python
# 인라인 주석: 코드와 2칸 이상 공백, #과 내용 사이 1칸 공백
x += 1  # 카운터 증가

# 블록 주석: # 뒤 공백 1칸
# 이 섹션은 사용자 인증을 처리한다.
# 토큰 검증 후 세션을 생성한다.


def add(a, b):
    """두 숫자를 더한 결과를 반환한다.

    Args:
        a: 첫 번째 숫자
        b: 두 번째 숫자

    Returns:
        두 숫자의 합

    Raises:
        TypeError: a 또는 b가 숫자가 아닌 경우
    """
    return a + b
```

## 자동 포매터 활용

PEP 8을 손으로 지키기는 어렵다. 자동 포매터를 사용하면 스타일을 신경 쓰지 않아도 된다.

```bash
# flake8: 스타일 위반 검사기
pip install flake8
flake8 my_file.py
# E302 expected 2 blank lines, found 1
# E501 line too long (89 > 79 characters)

# black: 자동 포매터 (의견이 강한 - 설정 없음)
pip install black
black my_file.py   # 파일 자동 수정
black .            # 디렉토리 전체

# isort: import 순서 자동 정리
pip install isort
isort my_file.py

# ruff: 최신 빠른 올인원 도구 (Rust 기반)
pip install ruff
ruff check .       # 검사
ruff format .      # 포매팅
```

**ruff**는 flake8 + isort + 일부 black 기능을 결합한 도구로, Rust로 작성되어 매우 빠르다. 현재 가장 빠르게 채택되고 있는 도구다.

```toml
# pyproject.toml 설정 예시
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I"]  # 스타일, 에러, import 순서

[tool.black]
line-length = 88
target-version = ["py312"]
```

![PEP 8 스타일 전후 비교](/assets/posts/python-pep8-style-comparison.svg)

## PEP 8을 언제 어기나?

PEP 8은 가이드라인이지 법이 아니다. 문서에도 "일관성이 중요하다 — 코드베이스 내에서 일관된 스타일이 PEP 8을 따르는 것보다 중요할 때가 있다"고 명시되어 있다.

79자 제한을 넘어도 되는 경우:
- URL 주석
- 긴 문자열 리터럴(분리하면 오히려 가독성 하락)
- 표가 있는 코드

기존 코드베이스의 스타일을 따라야 하는 경우에는 그 코드베이스의 스타일을 우선한다. 단, 팀 내에서 스타일을 통일하는 것은 항상 중요하다.

다음 편에서는 드디어 첫 Python 프로그램 "Hello, World!"를 작성하고 실행하는 방법을 살펴본다.

---

**지난 글:** [The Zen of Python: PEP 20이 말하는 아름다운 코드](/posts/python-zen-pep20/)

**다음 글:** [Hello, World! Python 첫 프로그램 해부하기](/posts/python-hello-world/)

<br>
읽어주셔서 감사합니다. 😊
