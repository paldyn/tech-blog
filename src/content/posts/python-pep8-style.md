---
title: "PEP 8 스타일 가이드: Pythonic한 코드 작성법"
description: "Python 공식 스타일 가이드 PEP 8의 핵심 규칙을 설명합니다. 명명 규칙, 들여쓰기, 공백 사용법과 black·ruff 같은 자동화 도구를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "PEP8", "스타일가이드", "black", "ruff", "린터"]
featured: false
draft: false
---

[지난 글](/posts/python-zen-pep20/)에서 Python의 설계 철학을 살펴봤다. 철학이 구체적인 코딩 규칙으로 구현된 것이 **PEP 8**이다. "읽기 쉬운 코드"라는 원칙이 실제로 어떤 규칙으로 표현되는지 알아보자.

## PEP 8이란

PEP 8은 2001년 Guido van Rossum, Barry Warsaw, Nick Coghlan이 작성한 **Python 코드 스타일 가이드**다. 공식 문서 제목은 "Style Guide for Python Code"다.

규칙이 많아 보이지만, 핵심 원칙은 하나다. **코드는 쓰는 것보다 읽히는 횟수가 훨씬 많다.** 따라서 일관된 스타일이 가독성을 높이고, 팀 협업을 쉽게 만든다.

![PEP 8 핵심 규칙](/assets/posts/python-pep8-style-rules.svg)

## 명명 규칙

가장 자주 틀리는 부분이 명명 규칙이다.

```python
# 변수, 함수 — snake_case
user_name = "Alice"
total_price = 0

def get_user_age():
    pass

def calculate_tax(price, rate):
    return price * rate

# 클래스 — PascalCase (UpperCamelCase)
class UserAccount:
    pass

class HttpRequestHandler:
    pass

# 상수 — UPPER_SNAKE_CASE
MAX_RETRY_COUNT = 3
DEFAULT_TIMEOUT = 30
BASE_URL = "https://api.example.com"

# 비공개 (관례) — 앞에 밑줄 하나
class MyClass:
    def __init__(self):
        self._internal_state = 0  # 외부에서 쓰지 말라는 신호

# 모듈명 — 짧은 소문자
# utils.py, data_reader.py, http_client.py
```

Java나 JavaScript에서 온 개발자가 가장 많이 실수하는 것이 **camelCase 함수명**이다. Python에서 함수와 변수는 반드시 `snake_case`다.

## 들여쓰기와 줄 길이

```python
# 들여쓰기: 스페이스 4칸 (탭 사용 금지)
def function():
    if condition:
        for item in items:
            process(item)  # 3단계 = 12칸

# 한 줄 최대 79자 — 긴 경우 괄호로 줄 나누기
result = (
    first_variable
    + second_variable
    + third_variable
)

# 함수 인자가 많을 때
def long_function_name(
    first_argument,
    second_argument,
    third_argument,
):
    pass

# 조건이 길 때
if (
    condition_one
    and condition_two
    and condition_three
):
    do_something()
```

## 공백 규칙

공백을 어디에 쓰고 쓰지 않는지가 PEP 8에서 세밀하게 규정돼 있다.

```python
# 올바른 공백 사용
x = 1
y = x + 2
z = x * 2 + y

result = func(arg1, arg2)       # 쉼표 뒤 공백
lst[1:3]                        # 슬라이스 공백 없음
dct["key"]                      # 대괄호 안 공백 없음

# 잘못된 공백
x=1          # 할당 연산자 양쪽 공백 없음 ❌
func( arg )  # 괄호 안 불필요한 공백 ❌
lst [0]      # 대괄호 앞 공백 ❌

# 키워드 인수/기본값 — 공백 없음
def greet(name="World"):        # 기본값에 공백 없음
    pass

greet(name="Alice")             # 키워드 인수에도 공백 없음
```

## 임포트 순서

```python
# PEP 8 임포트 순서: 표준 → 서드파티 → 로컬, 각 그룹 사이 빈 줄
import os
import sys
from pathlib import Path

import requests
import pandas as pd
from fastapi import FastAPI

from myapp.models import User
from myapp.utils import format_date

# 같은 모듈에서 여러 항목 임포트
from os.path import join, exists, dirname  # OK
from os.path import *                       # 금지 ❌
```

## 비교 연산자 주의

```python
# None과 비교 — is/is not 사용
if x is None:       # ✓
    pass
if x is not None:   # ✓
    pass
if x == None:       # ❌ (동작은 하지만 PEP 8 위반)
    pass

# 불린 비교 — 직접 평가
if is_valid:            # ✓
    pass
if is_valid == True:    # ❌
    pass
if not items:           # ✓ (빈 컨테이너 확인)
    pass
if len(items) == 0:     # 동작하지만 Pythonic하지 않음

# 타입 확인 — isinstance 사용
if isinstance(x, int):  # ✓
    pass
if type(x) == int:      # 동작하지만 상속 고려 안 함
    pass
```

![PEP 8 위반 vs 준수 예시](/assets/posts/python-pep8-style-code.svg)

## 자동화 도구: 직접 외울 필요 없다

현실적으로 PEP 8의 모든 규칙을 외워서 코딩하는 사람은 없다. 도구가 대신 확인하고 고쳐준다.

```bash
# black: 자동 포매터 (강제 적용)
pip install black
black my_script.py      # 파일 수정
black --check src/      # 수정 없이 확인만

# ruff: flake8 + isort 대체, 매우 빠름 (Rust 기반)
pip install ruff
ruff check src/         # 위반 사항 보고
ruff check --fix src/   # 자동 수정

# isort: 임포트 정렬
pip install isort
isort my_script.py
```

실무에서는 `pyproject.toml`에 도구 설정을 넣고 CI에서 자동 검사한다.

```toml
# pyproject.toml
[tool.black]
line-length = 88
target-version = ["py312"]

[tool.ruff]
line-length = 88
select = ["E", "F", "I"]  # pycodestyle + pyflakes + isort
```

## PEP 8을 무조건 따라야 하는가

PEP 8 자체가 이 질문에 답한다. "A Foolish Consistency is the Hobgoblin of Little Minds." (어리석은 일관성은 옹졸한 정신의 도깨비다.)

팀이 이미 다른 스타일 가이드를 쓰고 있다면 거기에 맞추는 것이 옳다. 기존 코드베이스에서 일관성을 깨는 것보다 기존 스타일을 유지하는 것이 낫다. 도구가 자동으로 수정하기 어려운 짧은 스크립트에서는 유연하게 적용한다.

PEP 8의 목적은 규칙 준수가 아니라 **가독성 향상**이다. 그 목적을 잊지 않는다면 언제 규칙을 따르고 언제 벗어나도 되는지 판단할 수 있다.

---

**지난 글:** [Python의 철학: Zen of Python (PEP 20)](/posts/python-zen-pep20/)

**다음 글:** [첫 Python 프로그램: Hello, World!](/posts/python-hello-world/)

<br>
읽어주셔서 감사합니다. 😊
