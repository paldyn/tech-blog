---
title: "들여쓰기: Python이 공백을 문법으로 삼은 이유"
description: "Python 들여쓰기 규칙을 설명합니다. 왜 공백이 문법인지, 스페이스 vs 탭, 들여쓰기 수준, 자주 발생하는 IndentationError 해결법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "들여쓰기", "IndentationError", "문법", "PEP8"]
featured: false
draft: false
---

[지난 글](/posts/python-comments/)에서 주석 작성법을 살펴봤다. 이번 편에서는 Python을 처음 배우는 사람들이 가장 당황하는 특징 중 하나인 **들여쓰기(indentation)**를 다룬다. 대부분의 언어는 들여쓰기를 가독성을 위한 "권장 스타일"로 본다. 중괄호(`{}`)나 키워드(`begin`/`end`)로 블록을 표시하기 때문에 들여쓰기 없이도 코드가 실행된다. Python은 다르다. 들여쓰기가 **문법(syntax) 그 자체**다. 들여쓰기가 틀리면 코드가 실행되지 않는다.

## 왜 Python은 들여쓰기를 문법으로 택했나?

Guido van Rossum의 의도는 명확했다. "어차피 읽기 좋은 코드를 쓰려면 들여쓰기를 해야 한다. 그렇다면 이것을 문법으로 강제하면, 모든 Python 코드의 레이아웃이 동일하게 읽기 좋아진다."

C, Java, JavaScript에서는 이런 코드가 문법적으로 유효하다.

```c
// C: 중괄호가 블록을 정의
if (x > 0) {
int y = x * 2;
printf("%d", y);
}
// 들여쓰기 없어도 실행된다 (하지만 읽기 매우 어렵다)
```

Python에서 들여쓰기가 없거나 잘못되면 즉시 `IndentationError`가 발생한다. 코드 스타일이 언어 수준에서 강제된다. 이 철학이 Python 코드베이스가 다른 언어들에 비해 일관되게 읽기 좋은 이유 중 하나다.

## 기본 규칙: 스페이스 4칸

PEP 8이 권장하는 들여쓰기 단위는 **스페이스 4칸**이다.

```python
def greet(name):
    # 함수 본체: 스페이스 4칸
    if name:
        # if 블록: 스페이스 8칸 (4 × 2)
        msg = f"Hello, {name}!"
        print(msg)
    else:
        # else 블록: 스페이스 8칸
        print("이름을 알 수 없어요")
```

들여쓰기 수준이 하나 늘어날 때마다 4칸씩 증가한다. 시각적으로 코드 블록의 깊이를 즉시 알 수 있다.

![Python 들여쓰기 규칙](/assets/posts/python-indentation-rules.svg)

## 들여쓰기로 블록 구조 표현

Python에서 들여쓰기는 블록(block)의 시작과 끝을 나타낸다. `:`으로 끝나는 문장 다음 줄부터 들여쓰기가 시작되고, 이전 수준으로 돌아오면 블록이 끝난다.

```python
# 블록을 만드는 문장들: if, for, while, def, class, with, try...
def process_data(items):
    results = []

    for item in items:              # for 블록 시작
        if item > 0:                # if 블록 시작
            processed = item * 2
            results.append(processed)
        else:                       # if 블록 끝, else 블록 시작
            results.append(0)
                                    # else 블록 끝 (들여쓰기 감소)

    return results                  # for 블록 끝 (함수 수준으로 복귀)
```

같은 들여쓰기 수준의 코드는 같은 블록에 속한다. 들여쓰기 수준이 줄어드는 것이 블록의 종료 신호다. `}`나 `end` 키워드가 필요 없다.

## 스페이스 vs 탭: 오래된 논쟁

들여쓰기에 스페이스를 쓸지 탭을 쓸지는 프로그래머들 사이의 오랜 논쟁이다. Python의 공식 답변은 명확하다. **스페이스를 사용하라.**

```python
# 스페이스 4칸: PEP 8 권장
def good():
    x = 1  # 실제로 스페이스 4개

# 탭: 허용되지만 비권장
def ok_but_not_recommended():
	x = 1  # 탭 문자 1개
```

탭과 스페이스를 혼용하면 Python 3에서는 `TabError`가 즉시 발생한다.

```python
# TabError 유발 코드 (섞어서 사용)
def mixed():
    x = 1  # 스페이스 4개
	y = 2  # 탭 1개
# TabError: inconsistent use of tabs and spaces
```

탭 키를 누를 때 스페이스로 자동 변환되도록 에디터를 설정하면 이 문제를 원천 차단할 수 있다.

**VS Code**: `settings.json` → `"editor.insertSpaces": true`, `"editor.tabSize": 4`
**PyCharm**: Settings → Editor → Code Style → Python → Tabs and Indents

## 자주 발생하는 들여쓰기 오류

![들여쓰기 오류 유형](/assets/posts/python-indentation-errors.svg)

### IndentationError: unexpected indent

블록 없이 들여쓰기가 되어 있을 때.

```python
x = 5
    y = 10  # ← 왜 들여쓰기가 되어 있는가?
# IndentationError: unexpected indent
```

`if`, `for`, `def` 등 블록을 만드는 문장 없이 들여쓰기하면 발생한다. 들여쓰기 단계를 제거하면 해결된다.

### IndentationError: expected an indented block

블록을 시작하는 문장(`def`, `if`, `for` 등) 다음에 들여쓰기된 코드가 없을 때.

```python
def do_something():
# 아무것도 없음
x = 1  # 블록 밖으로 나와버림
# IndentationError: expected an indented block after function definition
```

빈 블록이 필요하다면 `pass` 또는 `...`을 사용한다.

```python
def not_yet_implemented():
    pass  # 나중에 구현할 예정

def also_empty():
    ...   # pass와 동일한 역할
```

### IndentationError: unindent does not match any outer indentation level

들여쓰기 수준이 기존 블록과 맞지 않을 때.

```python
def calculate():
    x = 1
        y = 2  # 8칸 들여쓰기 (4칸 블록 안에서 8칸?)
    return x + y
# IndentationError: unexpected indent
```

들여쓰기는 항상 4칸 단위로 늘리고 줄여야 한다.

## 긴 식(expression)의 들여쓰기

한 줄이 너무 길 때 줄을 바꾸면서 들여쓰기를 어떻게 처리해야 할까?

```python
# 괄호 안에서 줄 바꿈: 열린 괄호 기준으로 정렬
result = some_function(
    argument_one,
    argument_two,
    keyword=value,
)

# 또는 4칸 추가 들여쓰기
result = some_function(
        argument_one,  # 함수 호출 기준 4칸 더
        argument_two,
)

# if문의 긴 조건
if (condition_one
        and condition_two
        and condition_three):
    do_something()

# 리스트, 딕셔너리
items = [
    "item_one",
    "item_two",
    "item_three",
]

config = {
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
}
```

PEP 8은 두 가지 스타일을 허용한다. 열린 구분자에 맞추거나, 4칸을 추가로 들여쓰는 것. 프로젝트 내에서 일관되게 사용하면 된다.

## 들여쓰기와 가독성

Python 코드에서 들여쓰기 깊이가 깊어질수록 코드가 복잡해진다는 신호다. 들여쓰기가 4~5단계를 넘어가면 함수를 분리하거나 로직을 단순화하는 것을 고려해야 한다.

```python
# 과도한 중첩 (피하라)
def process(data):
    if data:
        for item in data:
            if item.is_valid():
                for sub in item.children:
                    if sub.active:
                        result = sub.process()
                        if result:
                            save(result)

# 개선: 조기 반환(early return)과 함수 분리
def process_item(item):
    if not item.is_valid():
        return
    for sub in item.children:
        if sub.active:
            result = sub.process()
            if result:
                save(result)

def process(data):
    if not data:
        return
    for item in data:
        process_item(item)
```

들여쓰기를 줄이는 것이 곧 복잡도를 줄이는 것이다. 조기 반환(early return)을 적극 활용하면 들여쓰기 중첩을 줄일 수 있다.

## 들여쓰기 자동화 도구

현대적인 IDE와 에디터는 들여쓰기를 자동으로 관리한다.

```bash
# black: 들여쓰기 포함 자동 포매팅
black my_file.py

# ruff: 빠른 포매터
ruff format my_file.py

# autopep8: PEP 8 준수 자동 수정
pip install autopep8
autopep8 --in-place my_file.py
```

이 도구들을 파일 저장 시 자동 실행되도록 에디터에 설정해두면 들여쓰기 오류를 원천 차단할 수 있다.

## 정리: 들여쓰기는 Python의 정체성

Python이 들여쓰기를 문법으로 사용하는 것은 "강제로 읽기 좋은 코드를 쓰게 하는" 철학적 결정이다. 처음에는 낯설고 불편할 수 있지만, 익숙해지면 Python 코드의 일관된 레이아웃이 얼마나 읽기 편한지 느끼게 된다. 다른 언어의 코드베이스를 보면 사람마다 들여쓰기 스타일이 제각각이라 오히려 불편함을 느낄 것이다.

스페이스 4칸을 사용하고, 탭과 섞지 않고, 들여쓰기 수준을 일관되게 유지하는 것. 이것이 Python 들여쓰기의 전부다. 에디터 설정을 한 번만 올바르게 해두면 나머지는 자동으로 해결된다.

---

**지난 글:** [주석 완전 정복: 좋은 주석과 나쁜 주석](/posts/python-comments/)

<br>
읽어주셔서 감사합니다. 😊
