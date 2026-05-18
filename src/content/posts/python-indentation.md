---
title: "들여쓰기: Python 문법의 핵심"
description: "Python에서 들여쓰기가 문법 요소인 이유를 설명합니다. IndentationError, TabError의 원인과 해결법, 에디터 설정까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "들여쓰기", "IndentationError", "TabError", "기초문법"]
featured: false
draft: false
---

[지난 글](/posts/python-comments/)에서 주석을 다뤘다. Python에서 코드를 작성하다 보면 다른 언어와 확연히 다른 점을 마주하게 된다. 중괄호 `{}`가 없다. 그 역할을 들여쓰기가 대신한다. Python에서 들여쓰기는 단순한 미적 선택이 아니라 **문법의 일부**다.

## 들여쓰기가 블록을 정의한다

대부분의 언어에서 코드 블록은 중괄호 `{}`로 구분된다. Python은 이 역할을 **들여쓰기(indentation)**가 한다.

```python
# 함수 정의
def greet(name):          # 헤더 (콜론으로 끝남)
    message = f"안녕, {name}!"  # 블록 시작 (들여쓰기)
    print(message)             # 같은 블록
                               # 들여쓰기 끝 = 블록 끝

# 조건문
if True:
    print("True 블록")   # if 블록
    print("여기도 같은 블록")
print("if 밖 코드")      # 들여쓰기 없음 = 블록 밖
```

코드 블록이 시작되는 것은 **콜론 `:`** 뒤에서다. `if`, `for`, `while`, `def`, `class` 등 뒤에 콜론이 오면 다음 줄부터 블록이 시작된다. 블록이 끝나는 것은 들여쓰기 수준이 같거나 낮아지는 첫 줄이다.

```python
for i in range(3):
    print(i)          # 루프 블록
    print(i * 2)      # 루프 블록
print("루프 끝")       # 루프 밖 — 이 줄부터 루프가 종료됨
```

## 왜 들여쓰기인가

Python을 처음 배우는 사람들이 "왜 중괄호를 안 쓰나요?"라고 물으면 Guido van Rossum의 답은 명확했다. "들여쓰기로 블록을 구분하면 어차피 해야 할 들여쓰기를 강제함으로써 모든 코드가 자연스럽게 읽기 쉬워진다."

C나 Java에서는 이런 코드가 문법적으로 유효하다.

```c
// C: 들여쓰기 없어도 동작 (가독성만 나쁨)
if(x>0){result=x*2;}else{result=0;}
```

Python에서는 이게 불가능하다. 들여쓰기가 없으면 SyntaxError가 발생한다. 규칙이 강제되기 때문에 Python 코드는 어디서 보든 동일한 구조를 갖는다.

![들여쓰기가 만드는 블록 구조](/assets/posts/python-indentation-structure.svg)

## 들여쓰기 규칙

PEP 8 기준으로 **스페이스 4칸**이 표준이다.

```python
# 올바른 들여쓰기: 스페이스 4칸
def calculate(x):
    if x > 0:           # 4칸
        result = x * 2  # 8칸 (중첩)
    return result       # 4칸

# 중첩 블록
def nested_example():
    for i in range(5):       # 4칸
        if i % 2 == 0:       # 8칸
            print(f"{i}은 짝수")  # 12칸
```

들여쓰기 수준이 일관성이 있으면 2칸, 3칸도 작동한다. 그러나 **같은 파일에서 혼용하면 안 된다**. PEP 8에서 4칸을 권장하는 이유는 가독성과 중첩 처리의 균형 때문이다.

## 흔한 오류들

들여쓰기 관련 오류는 Python 입문자가 가장 자주 만나는 오류다.

```python
# IndentationError: expected an indented block
def greet():
    # 이 줄이 비어있으면 함수 본문이 없음
# → 해결: pass나 실제 코드 추가

def greet():
    pass  # 빈 블록은 pass로 채움

# IndentationError: unexpected indent
x = 10
    y = 20  # 이유 없이 들여쓴 경우
# → 해결: 들여쓰기 제거

# IndentationError: unindent does not match
def process():
    if True:
        x = 1
       y = 2  # 3칸은 어느 레벨도 아님
# → 해결: 일관된 들여쓰기 사용
```

![들여쓰기 오류 유형과 해결](/assets/posts/python-indentation-errors.svg)

## 탭 vs 스페이스

탭과 스페이스를 혼용하면 `TabError`가 발생한다. Python 3는 탭과 스페이스 혼용을 허용하지 않는다.

```python
# Python 3: 탭과 스페이스 혼용 → TabError
def mixed():
    a = 1    # 스페이스 4칸
	b = 2    # 탭 1개 → TabError!

# 해결: 둘 중 하나만 사용 (스페이스 4칸 권장)
def consistent():
    a = 1    # 스페이스 4칸
    b = 2    # 스페이스 4칸 ✓
```

모든 현대 에디터는 탭 키를 스페이스로 변환하는 옵션을 제공한다.

```
# VS Code settings.json
"editor.insertSpaces": true,
"editor.tabSize": 4,
"editor.detectIndentation": false  // 파일마다 다른 설정 방지

# .editorconfig (팀 공유용)
[*.py]
indent_style = space
indent_size = 4
```

## 연속 줄에서의 들여쓰기

긴 표현식을 여러 줄로 나눌 때 들여쓰기 규칙이 조금 다르다.

```python
# 괄호 안에서는 들여쓰기가 자유로움
result = (
    first_value
    + second_value
    + third_value
)

# 함수 호출 인자
long_function(
    arg1,
    arg2,
    arg3,
)

# 딕셔너리
config = {
    "host": "localhost",
    "port": 8080,
    "debug": True,
}
```

괄호 `()`, 대괄호 `[]`, 중괄호 `{}` 안에서는 줄이 바뀌어도 자동으로 연속된 표현식으로 처리된다. 이런 경우 들여쓰기는 가독성을 위한 것이지 블록을 정의하는 것이 아니다.

## 빈 블록: pass

Python에서 블록은 반드시 최소 하나의 실행 가능한 문(statement)을 가져야 한다. 나중에 채울 생각으로 빈 블록을 만들 때는 `pass`를 사용한다.

```python
# 아직 구현하지 않은 함수
def future_feature():
    pass  # 나중에 구현

# 빈 클래스 뼈대
class EmptyClass:
    pass

# 특정 예외를 무시할 때 (드물게 사용)
try:
    risky_operation()
except SpecificError:
    pass  # 이 오류는 의도적으로 무시
```

이렇게 들여쓰기는 Python의 핵심 문법 요소다. 처음에는 낯설 수 있지만, 일관된 코드 구조를 강제함으로써 결국 더 읽기 쉬운 코드를 만드는 데 기여한다.

---

**지난 글:** [주석 완전 정복: 좋은 주석과 나쁜 주석](/posts/python-comments/)

**다음 글:** [input()과 print(): 표준 입출력 완전 정복](/posts/python-input-print/)

<br>
읽어주셔서 감사합니다. 😊
