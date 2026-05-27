---
title: "PEP 8 — Python 코드 스타일 가이드"
description: "Python 공식 코드 스타일 가이드 PEP 8의 핵심 규칙과 flake8, black, ruff 같은 자동화 도구 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "PEP 8", "코드 스타일", "black", "ruff", "flake8"]
featured: false
draft: false
---

[지난 글](/posts/python-zen-pep20/)에서 Python의 설계 철학을 살펴봤습니다. Zen of Python이 "왜"를 설명한다면, PEP 8은 "어떻게"를 구체적으로 안내합니다. 1990년대부터 이어진 Python 커뮤니티의 코드 스타일 합의서입니다.

## PEP 8이란?

PEP 8은 Guido van Rossum, Barry Warsaw, Nick Coghlan이 2001년에 작성한 **Python 코드 스타일 가이드**입니다. 강제 사항이 아니라 권고안이지만, Python 생태계 전반에서 표준으로 받아들여집니다.

## 들여쓰기: 스페이스 4칸

탭이 아닌 스페이스 4칸이 표준입니다. 탭과 스페이스를 혼용하면 Python 3에서 `TabError`가 발생합니다.

```python
# 올바름
def greet(name):
    if name:
        return f"Hello, {name}!"
    return "Hello, World!"

# 잘못됨 — 탭 사용 시 혼용 문제 발생
def greet(name):
	return name  # 탭
```

## 줄 길이: 최대 79자

PEP 8은 줄당 최대 79자를 권장합니다. 긴 줄은 괄호를 이용해 여러 줄로 나눕니다.

```python
# 긴 함수 호출 — 괄호로 줄 나눔
result = some_function(
    argument_one,
    argument_two,
    argument_three,
)

# 긴 조건문
if (condition_one
        and condition_two
        and condition_three):
    do_something()
```

현대 도구들은 88자(black 기본값)나 120자를 허용하기도 합니다. 팀 설정으로 통일하면 됩니다.

![PEP 8 핵심 규칙](/assets/posts/python-pep8-style-rules.svg)

## 네이밍 컨벤션

| 종류 | 컨벤션 | 예시 |
|---|---|---|
| 변수, 함수, 메서드 | `snake_case` | `user_name`, `get_data()` |
| 클래스 | `PascalCase` | `UserProfile`, `HTTPClient` |
| 상수 | `UPPER_SNAKE_CASE` | `MAX_SIZE`, `DEFAULT_TIMEOUT` |
| 비공개 | `_단일_밑줄` | `_internal_var` |
| 이름 맹글링 | `__이중_밑줄` | `__private_attr` |

```python
# 올바른 네이밍
MAX_RETRIES = 3

class DatabaseConnection:
    def __init__(self, host: str, port: int = 5432):
        self.host = host
        self.port = port
        self._connection = None  # 비공개 속성

    def connect(self) -> bool:
        ...
```

## 공백 규칙

연산자 주변에는 공백을 넣고, 함수 인자 목록의 괄호 바로 안에는 공백을 넣지 않습니다.

```python
# 올바름
x = 1 + 2
result = func(a, b)
my_dict = {"key": "value"}

# 잘못됨
x=1+2
result = func( a, b )
my_dict = {"key" : "value"}
```

## import 순서

import는 세 그룹으로 나누고 각 그룹 사이에 빈 줄을 넣습니다.

```python
# 1. 표준 라이브러리
import os
import sys
from pathlib import Path

# 2. 서드파티 패키지
import requests
from fastapi import FastAPI

# 3. 로컬 모듈
from myapp.models import User
from myapp.utils import format_date
```

`isort` 도구로 이 순서를 자동으로 정렬할 수 있습니다.

## 자동화 도구 활용

스타일을 일일이 검사하는 것은 비효율적입니다. 도구에 맡기세요.

![black 포매터 before/after](/assets/posts/python-pep8-style-tools.svg)

```bash
# flake8 — 스타일 검사기
pip install flake8
flake8 myfile.py

# black — 의견 없는 자동 포매터 (토론 종결자)
pip install black
black myfile.py

# ruff — Rust로 만든 초고속 올인원 (flake8 + isort + 더 많은 규칙)
pip install ruff
ruff check myfile.py  # 검사
ruff format myfile.py # 포맷

# isort — import 순서 자동 정렬
pip install isort
isort myfile.py
```

현대 Python 프로젝트에서는 **ruff** 하나로 flake8, isort, black을 대체하는 추세입니다. 속도가 100배 이상 빠릅니다.

## pyproject.toml 설정 예시

```toml
[tool.ruff]
line-length = 88
target-version = "py313"

[tool.ruff.lint]
select = ["E", "F", "I"]  # pycodestyle + pyflakes + isort

[tool.black]
line-length = 88
target-version = ["py313"]
```

## PEP 8에서 벗어나도 되는 경우

PEP 8 자체가 "일관성은 중요하지만, 가끔은 PEP 8 위반이 합리적이다"고 인정합니다.

- 기존 코드베이스 스타일과 일관성이 더 중요할 때
- 79자 제한이 URL처럼 자를 수 없는 내용일 때
- 수학 공식에서 연산자 배치가 수식 관례를 따를 때

## 정리

PEP 8은 Python 커뮤니티의 공통 언어입니다. 팀에서 협업할 때 "왜 이렇게 썼어요?"라는 논쟁을 줄여주고 코드 리뷰가 로직에 집중할 수 있게 해 줍니다. black이나 ruff를 저장 시 자동 실행되도록 에디터에 연동하면 스타일은 신경 쓰지 않아도 됩니다. 다음 글에서는 드디어 첫 Python 코드 "Hello, World!"를 작성합니다.

---

**지난 글:** [Python의 선 (Zen of Python) — PEP 20](/posts/python-zen-pep20/)

**다음 글:** [Python Hello World — 첫 번째 프로그램](/posts/python-hello-world/)

<br>
읽어주셔서 감사합니다. 😊
