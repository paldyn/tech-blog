---
title: "input()과 print(): 표준 입출력 완전 정리"
description: "Python input()과 print() 함수의 모든 매개변수를 다룹니다. sep, end, file, flush 옵션과 타입 변환 패턴을 예제 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "input", "print", "표준입출력", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-indentation/)에서 들여쓰기가 Python의 문법 자체임을 살펴봤다. 이번에는 모든 Python 프로그램의 출발점인 **`print()`와 `input()`** 두 내장 함수를 깊이 파고든다. 이 두 함수를 제대로 이해해야 이후에 배울 모든 예제 코드를 직접 실행하고 확인할 수 있다.

## print() — 화면에 값을 출력하는 함수

Python 2에서 `print`는 **문장(statement)**이었다. 괄호 없이 `print "hello"` 처럼 쓸 수 있었다. Python 3에서는 완전한 **함수**가 되었다. 반드시 괄호로 인수를 감싸야 한다.

```python
print("Hello, Python!")   # OK
print "Hello"             # SyntaxError (Python 3)
```

### 여러 값 한 번에 출력하기

`print()`는 인수를 몇 개든 받아 기본적으로 **공백**으로 구분해 출력한다.

```python
name = "파이썬"
version = 3.12
print("이름:", name, "버전:", version)
# → 이름: 파이썬 버전: 3.12
```

### sep — 구분자 바꾸기

여러 값 사이의 구분 문자를 바꾸려면 `sep` 인수를 사용한다. 기본값은 `" "` (공백 한 칸)이다.

```python
print(2024, 5, 10, sep="-")   # → 2024-5-10
print("a", "b", "c", sep="")  # → abc
print(1, 2, 3, sep="\n")      # 각 값이 한 줄씩
```

### end — 줄 끝 문자 바꾸기

`print()`는 기본적으로 출력 후 **줄바꿈(`\n`)**을 추가한다. 이 동작을 `end` 인수로 바꿀 수 있다.

```python
for i in range(5):
    print(i, end=" ")   # → 0 1 2 3 4
print()                 # 마지막에 줄바꿈 한 번
```

진행 상황 표시기처럼 같은 줄에 계속 덮어쓰는 패턴에도 활용한다.

```python
import time
for step in range(3):
    print(f"\r처리 중: {step + 1}/3", end="", flush=True)
    time.sleep(0.5)
print()  # 완료 후 줄바꿈
```

### file / flush — 출력 대상과 버퍼

`file` 인수로 출력 대상을 `sys.stderr`나 파일 객체로 바꿀 수 있다. `flush=True`는 버퍼를 즉시 비워 진행률 표시처럼 실시간 출력이 필요한 경우에 사용한다.

```python
import sys

print("경고 메시지", file=sys.stderr)   # 표준 오류로 출력

with open("log.txt", "w", encoding="utf-8") as f:
    print("로그 기록", file=f)           # 파일로 출력
```

![print() 출력 형식 완전 정리](/assets/posts/python-input-print-format.svg)

## input() — 사용자 입력을 받는 함수

`input()`은 **프롬프트 문자열**을 받아 화면에 출력한 뒤 사용자가 Enter를 누를 때까지 대기한다. 사용자가 입력한 내용을 **항상 `str`(문자열)로 반환**한다는 점이 가장 중요하다.

```python
name = input("이름을 입력하세요: ")
print(f"안녕하세요, {name}님!")
```

### 반환값은 반드시 str

```python
x = input("숫자: ")
print(type(x))  # <class 'str'>
```

숫자 연산을 하려면 `int()` 또는 `float()`으로 **명시적으로 변환**해야 한다.

```python
age = int(input("나이: "))
print(f"10년 후: {age + 10}살")
```

변환 전에 사용자가 숫자가 아닌 값을 입력하면 `ValueError`가 발생하므로, 실제 프로그램에서는 예외 처리를 함께 사용한다.

```python
try:
    score = int(input("점수(0-100): "))
except ValueError:
    print("숫자만 입력해 주세요.")
```

### 여러 값 한 번에 받기

한 줄로 여러 값을 받으려면 `split()`과 함께 쓴다.

```python
a, b = input("두 수를 공백으로 입력: ").split()
print(int(a) + int(b))
```

또는 `map()`을 활용하면 더 간결하다.

```python
a, b = map(int, input("두 수: ").split())
print(a + b)
```

![input()과 print() 기본 사용법](/assets/posts/python-input-print-functions.svg)

## 흔한 실수와 해결책

**실수 1: 입력값을 변환 없이 연산**

```python
x = input("숫자: ")
print(x + 1)     # TypeError: can only concatenate str (not "int") to str
print(int(x) + 1) # 올바른 방법
```

**실수 2: Python 2 스타일 print**

```python
print "hello"    # Python 3에서는 SyntaxError
print("hello")   # 항상 괄호 사용
```

**실수 3: 빈 줄 출력 방법**

```python
print("")   # 가능하지만
print()     # 이쪽이 더 명확한 Python 관용구
```

## 정리

| 함수 | 반환값 | 주요 인수 |
|------|--------|-----------|
| `print()` | `None` | `sep`, `end`, `file`, `flush` |
| `input()` | `str` | 프롬프트 문자열 하나 |

`input()`의 반환값이 항상 `str`임을 잊지 않는 것, 그리고 `print()`의 `sep`/`end`를 상황에 맞게 활용하는 것이 표준 입출력을 능숙하게 다루는 핵심이다.

---

**지난 글:** [들여쓰기: Python이 공백을 문법으로 삼은 이유](/posts/python-indentation/)

**다음 글:** [스크립트 vs REPL: Python 실행 방식의 차이](/posts/python-script-vs-repl/)

<br>
읽어주셔서 감사합니다. 😊
