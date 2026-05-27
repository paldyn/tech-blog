---
title: "Python Hello World — 첫 번째 프로그램"
description: "Python의 첫 프로그램 Hello World를 REPL, 스크립트 파일, 모듈 실행 세 가지 방법으로 작성하고 print() 함수를 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "Hello World", "print", "REPL", "입문"]
featured: false
draft: false
---

[지난 글](/posts/python-pep8-style/)에서 코드 스타일 가이드를 살펴봤습니다. 이제 실제로 코드를 작성할 시간입니다. 모든 프로그래밍 언어의 입문은 "Hello, World!"입니다. Python에서는 이 코드가 딱 한 줄입니다.

## Hello, World!

```python
print("Hello, World!")
```

Java가 `System.out.println("Hello, World!");`를 `public static void main(String[] args)` 안에 넣어야 하는 것과 달리, Python은 파일에 이 한 줄만 적으면 됩니다. Python 설계 철학이 코드 길이에서도 드러납니다.

## 세 가지 실행 방법

Python 코드를 실행하는 방법은 크게 세 가지입니다.

![Python 실행 방법](/assets/posts/python-hello-world-execution.svg)

### 1. REPL (대화형 인터프리터)

터미널에서 `python` 명령을 실행하면 REPL(Read-Eval-Print Loop) 환경이 열립니다.

```python
$ python
Python 3.13.0 (main, ...) [GCC ...]
>>> print("Hello, World!")
Hello, World!
>>> 1 + 2
3
>>> "Python" * 3
'PythonPythonPython'
>>> quit()
```

`>>>` 프롬프트에 코드를 입력하면 즉시 실행 결과를 볼 수 있습니다. 탐색적 작업, 빠른 테스트에 적합합니다.

### 2. 스크립트 파일 실행

`hello.py` 파일을 만들고 코드를 작성합니다.

```python
# hello.py
name = "World"
print(f"Hello, {name}!")
print(f"Python {__import__('sys').version.split()[0]}")
```

```bash
$ python hello.py
Hello, World!
Python 3.13.0
```

### 3. -m 플래그로 모듈 실행

`-m` 플래그는 모듈을 직접 실행할 때 씁니다.

```bash
# HTTP 서버 바로 시작
python -m http.server 8080

# JSON 예쁘게 출력
echo '{"name":"Python"}' | python -m json.tool

# 단위 테스트 실행
python -m pytest tests/
```

## print() 함수 완전 이해

Python 3에서 `print`는 **일급 함수**입니다. 시그니처는 다음과 같습니다.

```python
print(*objects, sep=' ', end='\n', file=sys.stdout, flush=False)
```

- `*objects`: 출력할 값들 (여러 개 전달 가능)
- `sep`: 여러 값 사이의 구분자 (기본값: 공백)
- `end`: 줄 끝에 붙는 문자 (기본값: 줄바꿈)
- `file`: 출력 대상 (기본값: 표준 출력)
- `flush`: 버퍼를 즉시 비울지 여부

![print() 활용 패턴](/assets/posts/python-hello-world-print.svg)

실전 활용 예시입니다.

```python
# 여러 값 출력
print("이름:", "Alice", "나이:", 30)         # 이름: Alice 나이: 30

# 구분자 변경
print("2026", "05", "28", sep="-")           # 2026-05-28

# 줄바꿈 없이
for i in range(5):
    print(i, end=" ")  # 0 1 2 3 4

# 표준 에러로 출력
import sys
print("경고: 파일 없음", file=sys.stderr)

# 즉시 출력 (진행 상황 표시)
print("처리 중...", flush=True)
```

## 변수와 함께 쓰기

```python
# 변수에 값 대입 후 출력
name = "Python"
version = 3.13
print(f"{name} {version}")   # Python 3.13

# 여러 값 한 번에
x, y = 10, 20
print(f"x={x}, y={y}, x+y={x+y}")  # x=10, y=20, x+y=30

# 타입 확인
print(type(name))    # <class 'str'>
print(type(version)) # <class 'float'>
```

## __name__ == "__main__" 관용구

스크립트로 직접 실행할 때만 코드를 실행하고 싶을 때 씁니다.

```python
# greet.py
def greet(name):
    return f"Hello, {name}!"

if __name__ == "__main__":
    # 직접 실행 시에만 아래 코드 실행
    # import greet 로 가져올 때는 실행 안 됨
    print(greet("World"))
```

이 관용구는 나중에 모듈, 테스트, 패키지 구조를 배울 때 더 자세히 다룹니다.

## 정리

Python의 "Hello, World!"는 한 줄입니다. REPL로 즉시 실험하고, 스크립트 파일로 저장해 실행하는 두 가지 작업 흐름을 모두 익혀 두면 이후 학습이 훨씬 편해집니다. 다음 글에서는 Python의 주석 문법과 독스트링을 다룹니다.

---

**지난 글:** [PEP 8 — Python 코드 스타일 가이드](/posts/python-pep8-style/)

**다음 글:** [Python 주석과 독스트링](/posts/python-comments/)

<br>
읽어주셔서 감사합니다. 😊
