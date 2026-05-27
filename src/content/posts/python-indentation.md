---
title: "Python 들여쓰기 — 문법으로서의 공백"
description: "Python에서 들여쓰기가 단순한 스타일이 아닌 문법 그 자체인 이유, IndentationError와 TabError를 피하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "들여쓰기", "IndentationError", "TabError", "블록 구조"]
featured: false
draft: false
---

[지난 글](/posts/python-comments/)에서 주석과 독스트링을 살펴봤습니다. Python을 처음 접하는 프로그래머가 가장 놀라는 특징이 있습니다. 다른 언어에서는 스타일의 영역인 **들여쓰기가 Python에서는 문법의 일부**라는 점입니다.

## 들여쓰기가 블록을 결정한다

C, Java, JavaScript는 `{}`로 블록을 표시합니다. Python은 **들여쓰기의 깊이**로 블록을 표현합니다.

```python
# 같은 들여쓰기 수준 = 같은 블록
def process(items):
    total = 0           # process 함수 블록
    for item in items:  # process 함수 블록
        total += item   # for 루프 블록 (한 단계 안쪽)
    return total        # process 함수 블록 (for 블록 밖)
```

들여쓰기가 달라지는 순간 블록이 달라집니다. `:`으로 끝나는 문(if, for, while, def, class 등)의 다음 줄은 반드시 한 단계 더 들여써야 합니다.

## IndentationError와 TabError

들여쓰기 규칙을 어기면 실행 전에 오류가 납니다.

```python
# IndentationError: expected an indented block
def greet():
print("Hello")  # 들여쓰기 없음 → 오류

# IndentationError: unexpected indent
x = 1
    y = 2  # 이유 없는 들여쓰기 → 오류

# TabError: inconsistent use of tabs and spaces
def bad():
    x = 1   # 스페이스 4칸
	y = 2   # 탭 → TabError!
```

Python 3는 탭과 스페이스 혼용을 엄격하게 금지합니다. Python 2에서는 허용됐지만 많은 버그의 원인이었습니다.

![들여쓰기 블록 비교](/assets/posts/python-indentation-blocks.svg)

## 스페이스 4칸이 표준

PEP 8은 스페이스 4칸을 들여쓰기 단위로 권장합니다. 2칸도 기술적으로 동작하지만 가독성이 떨어지고, 탭은 에디터에 따라 다르게 보여 혼란을 줍니다.

```python
# 올바름 — 4칸 스페이스
for i in range(3):
    for j in range(3):
        print(i, j)

# 작동하지만 비권장 — 2칸
for i in range(3):
  for j in range(3):
    print(i, j)
```

## 에디터 설정

VS Code에서 탭을 스페이스로 자동 변환하는 설정입니다.

```json
// settings.json
{
    "editor.insertSpaces": true,
    "editor.tabSize": 4,
    "editor.detectIndentation": false,
    "[python]": {
        "editor.tabSize": 4
    }
}
```

`Ctrl+Shift+P → "Convert Indentation to Spaces"`로 기존 탭을 스페이스로 일괄 변환할 수 있습니다.

## 여러 줄로 나누기

긴 코드를 여러 줄로 나눌 때는 괄호를 활용합니다.

```python
# 괄호 안에서는 자유롭게 줄 나눔
result = (
    first_value
    + second_value
    + third_value
)

# 함수 인자도 동일
user = User(
    name="Alice",
    email="alice@example.com",
    role="admin",
)

# 조건문
if (
    condition_a
    and condition_b
    and condition_c
):
    do_something()
```

역슬래시(`\`)로 줄을 나눌 수도 있지만 괄호 방식이 더 안전하고 선호됩니다.

![들여쓰기 규칙과 오류](/assets/posts/python-indentation-rules.svg)

## 들여쓰기를 설계 도구로 쓰기

Python의 들여쓰기 강제는 처음엔 제약처럼 느껴지지만, 코드의 구조가 시각적으로 즉시 드러나는 장점이 있습니다. 중첩이 깊어질수록 코드가 오른쪽으로 밀려나므로, 들여쓰기 깊이 자체가 복잡도를 경고해 줍니다.

```python
# 깊은 중첩 — 리팩터링 신호
def process(data):
    if data:
        for item in data:
            if item.is_valid():
                for sub in item.sub_items:
                    if sub.enabled:
                        result.append(sub.value)  # 5단계 중첩

# 평탄화 — early return + 함수 분리
def get_valid_sub_values(item):
    if not item.is_valid():
        return []
    return [s.value for s in item.sub_items if s.enabled]

def process(data):
    if not data:
        return
    for item in data:
        result.extend(get_valid_sub_values(item))
```

## 정리

Python의 들여쓰기는 단순히 코드를 예쁘게 만드는 것이 아닙니다. 블록 구조를 정의하는 문법 그 자체입니다. 스페이스 4칸을 일관되게 사용하고 탭과 혼용하지 않으면 들여쓰기 관련 오류를 완전히 피할 수 있습니다. 에디터에 "탭을 스페이스로 자동 변환" 설정을 해두면 이후로는 신경 쓸 필요가 없습니다.

---

**지난 글:** [Python 주석과 독스트링](/posts/python-comments/)

<br>
읽어주셔서 감사합니다. 😊
