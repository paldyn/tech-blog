---
title: "Hello, World! Python 첫 프로그램 해부하기"
description: "Python 첫 프로그램 Hello World를 작성하고 실행하는 방법을 설명합니다. print() 함수의 모든 기능과 스크립트 파일 실행 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "HelloWorld", "print", "REPL", "입문"]
featured: false
draft: false
---

[지난 글](/posts/python-pep8-style/)에서 PEP 8 스타일 가이드를 살펴봤다. 이제 실제로 코드를 작성하고 실행해볼 차례다. 모든 프로그래밍 여정은 "Hello, World!"로 시작하는 전통이 있다. 하지만 단순히 한 줄을 출력하고 넘어가는 게 아니라, 이 한 줄 안에 담긴 Python의 핵심 개념들을 해부해보자. `print()` 함수 하나에 Python의 여러 특성이 압축되어 있다.

## 첫 번째 코드

텍스트 에디터를 열고 `hello.py`라는 파일을 만들어라. 안에 이렇게 입력한다.

```python
print("Hello, World!")
```

저장하고, 터미널에서 실행한다.

```bash
python hello.py
# Hello, World!
```

이것이 전부다. Java처럼 클래스를 선언할 필요도 없고, C처럼 `main()` 함수가 필요하지도 않다. 파일에 코드를 쓰면 바로 실행된다. Python의 "단순함"이 첫 프로그램부터 드러난다.

## Hello World 코드 해부

![Hello World 코드 해부](/assets/posts/python-hello-world-anatomy.svg)

`print("Hello, World!")`를 분해해보자.

**`print`**: Python 내장 함수(built-in function)다. `import` 없이 바로 사용할 수 있는 함수 중 하나다. Python에는 `print`, `len`, `range`, `type`, `input`, `int`, `str`, `list` 등 수십 개의 내장 함수가 있다.

**`(`와 `)`**: 함수 호출 연산자다. Python 3에서 `print`는 반드시 함수처럼 괄호와 함께 호출해야 한다 (Python 2와의 핵심 차이).

**`"Hello, World!"`**: 문자열 리터럴이다. 큰따옴표(`"`) 또는 작은따옴표(`'`) 모두 사용 가능하다. Python 3에서 문자열은 기본이 Unicode이므로 한국어도 따로 처리하지 않아도 된다.

```python
# 작은따옴표도 동일
print('Hello, World!')

# 한국어도 바로 사용
print("안녕하세요, 세상!")

# 타입 확인
print(type("hello"))  # <class 'str'>
```

## 실행 흐름

![Hello World 실행 흐름](/assets/posts/python-hello-world-execution.svg)

`python hello.py`를 실행하면 내부에서 어떤 일이 일어나는가?

1. **소스 파일 읽기**: Python 인터프리터가 `hello.py` 파일을 읽는다
2. **Tokenize**: `print`, `(`, `"Hello, World!"`, `)` 등 토큰으로 분해한다
3. **Parse**: 토큰에서 AST(추상 구문 트리)를 생성한다
4. **Compile**: AST를 바이트코드로 변환한다 (`__pycache__`에 `.pyc` 파일 저장)
5. **Execute**: PVM(Python Virtual Machine)이 바이트코드를 실행한다
6. **stdout 출력**: `print()` 함수가 표준 출력에 문자열을 쓴다

## 세 가지 실행 방법

### 1. 스크립트 파일

```bash
# 파일로 저장하고 실행
python hello.py

# 또는 python3 (시스템에 Python 2도 있을 때)
python3 hello.py
```

### 2. REPL (대화형 인터프리터)

REPL(Read-Eval-Print Loop)은 Python 코드를 한 줄씩 입력하고 즉시 결과를 보는 환경이다.

```bash
python  # 또는 python3
```

```python
>>> print("Hello, World!")
Hello, World!
>>> 2 + 2
4
>>> name = "Alice"
>>> f"Hello, {name}"
'Hello, Alice'
>>> exit()  # 또는 Ctrl+D
```

`>>>` 프롬프트가 나타나면 코드를 입력할 수 있다. 표현식을 입력하면 결과를 바로 출력한다. 실험, 탐색, 빠른 테스트에 적합하다.

IPython은 더 강력한 REPL 도구다. 문법 하이라이팅, 탭 완성, `%timeit` 같은 매직 커맨드를 지원한다.

```bash
pip install ipython
ipython
```

### 3. -c 플래그

```bash
# 명령줄에서 직접 코드 실행
python -c "print('Hello, World!')"
python -c "import sys; print(sys.version)"
```

셸 스크립트에서 Python 한 줄을 실행할 때 유용하다.

## print() 함수의 모든 기능

`print()` 함수는 단순해 보이지만 여러 유용한 키워드 인수를 지원한다.

```python
# 기본: 여러 인수는 공백으로 구분
print("a", "b", "c")      # → a b c

# sep: 구분자 변경
print("a", "b", "c", sep="-")    # → a-b-c
print("a", "b", "c", sep="")     # → abc
print("2026", "05", "09", sep="/")  # → 2026/05/09

# end: 줄 끝 문자 변경 (기본: \n)
print("loading", end="...")   # → loading... (줄바꿈 없음)
print("done")                 # 이어서 출력 → loading...done

# file: 출력 대상 변경
import sys
print("오류 메시지", file=sys.stderr)  # 표준 에러로

with open("output.txt", "w") as f:
    print("파일에 저장", file=f)

# flush: 즉시 출력 강제
print("진행 중...", end="", flush=True)
```

## 문자열 포매팅

`print()`와 함께 자주 쓰이는 문자열 포매팅 방법들.

```python
name = "Alice"
age = 30

# f-string (Python 3.6+, 권장)
print(f"이름: {name}, 나이: {age}")

# format 메서드
print("이름: {}, 나이: {}".format(name, age))
print("이름: {n}, 나이: {a}".format(n=name, a=age))

# % 포매팅 (구식, 비권장)
print("이름: %s, 나이: %d" % (name, age))

# f-string에서 표현식
print(f"10년 후: {age + 10}세")
print(f"대문자: {name.upper()}")
print(f"π ≈ {3.14159:.2f}")  # 소수 2자리
```

f-string이 가장 읽기 쉽고 빠르며, Python 3.6 이상에서 사용 권장된다.

## 첫 번째 완성된 프로그램

조금 더 실용적인 첫 프로그램을 만들어보자.

```python
# greeting.py

def make_greeting(name, formal=False):
    """사용자를 맞이하는 메시지를 반환한다."""
    if formal:
        return f"안녕하세요, {name}님. 반갑습니다."
    return f"안녕, {name}!"


def main():
    name = input("이름을 입력하세요: ")
    greeting = make_greeting(name)
    print(greeting)


if __name__ == "__main__":
    main()
```

여기서 `if __name__ == "__main__":` 패턴이 등장한다. 이 파일을 직접 실행하면 `main()`이 호출된다. 다른 파일에서 import하면 `main()`이 자동으로 실행되지 않는다. Python의 중요한 관용구로, 이후 편에서 자세히 다룬다.

실행 결과:

```
이름을 입력하세요: 홍길동
안녕, 홍길동!
```

## 에러가 났을 때

처음 코드를 쓸 때 오류가 나는 것은 당연하다. Python의 에러 메시지를 읽는 법을 익혀두자.

```python
# SyntaxError: 문법 오류
print("Hello"   # 괄호를 닫지 않음
```

```
  File "hello.py", line 1
    print("Hello"
               ^
SyntaxError: '(' was never closed
```

```python
# NameError: 정의되지 않은 이름 사용
print(message)  # message 변수가 없음
```

```
NameError: name 'message' is not defined
```

에러 메시지에는 파일명, 줄 번호, 에러 타입, 설명이 포함된다. 줄 번호를 찾아 해당 코드를 확인하면 대부분 해결된다.

다음 편에서는 코드의 또 다른 필수 요소인 주석 작성법을 살펴본다. `#`으로 시작하는 주석, 독스트링(`"""..."""`), 좋은 주석과 나쁜 주석의 차이를 다룬다.

---

**지난 글:** [PEP 8 스타일 가이드: 읽기 쉬운 코드의 기준](/posts/python-pep8-style/)

**다음 글:** [주석 완전 정복: 좋은 주석과 나쁜 주석](/posts/python-comments/)

<br>
읽어주셔서 감사합니다. 😊
