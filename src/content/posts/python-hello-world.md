---
title: "첫 Python 프로그램: Hello, World!"
description: "Python의 print() 함수로 첫 프로그램을 작성합니다. print()의 인수(sep, end, file), 다양한 출력 방식, 실행 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "HelloWorld", "print", "입출력", "기초"]
featured: false
draft: false
---

[지난 글](/posts/python-pep8-style/)에서 코드를 어떻게 쓸지 알았다면, 이제 첫 코드를 직접 실행해 보자. 프로그래밍의 전통적인 첫 번째 프로그램, "Hello, World!"다. 단 한 줄이지만 그 안에 이해해야 할 것들이 있다.

## 첫 번째 프로그램

```python
print("Hello, World!")
```

실행 결과:

```
Hello, World!
```

이 한 줄을 실행하는 방법은 두 가지다.

**파일 실행**: `hello.py` 파일에 저장하고 터미널에서 `python hello.py` 실행.

**REPL에서 실행**: 터미널에 `python`을 입력해 대화형 셸을 열고 바로 입력.

```bash
# 파일 실행
$ python hello.py
Hello, World!

# REPL에서
$ python
>>> print("Hello, World!")
Hello, World!
>>> 
```

## print() 함수 해부

`print()`는 Python의 내장 함수다. `builtins` 모듈에 있어서 임포트 없이 바로 사용할 수 있다.

함수 시그니처:

```python
print(*objects, sep=' ', end='\n', file=sys.stdout, flush=False)
```

- `*objects`: 출력할 값들 (여러 개 가능)
- `sep`: 값 사이 구분자 (기본: 공백 한 칸)
- `end`: 출력 끝에 붙는 문자 (기본: 줄바꿈 `\n`)
- `file`: 출력 대상 (기본: 표준 출력)
- `flush`: 출력 버퍼를 즉시 비울지 여부

![print() 함수 해부](/assets/posts/python-hello-world-print.svg)

## sep과 end 활용

```python
# 기본 동작: 스페이스로 구분, 끝에 줄바꿈
print("사과", "바나나", "체리")
# → 사과 바나나 체리

# sep으로 구분자 변경
print("2024", "05", "19", sep="-")
# → 2024-05-19

print("a", "b", "c", sep="")
# → abc

# end로 줄바꿈 제어
print("진행 중", end="...")
print("완료")
# → 진행 중...완료

# 빈 줄 출력
print()  # 줄바꿈만 출력
```

이 기능들이 유용한 예시로, CSV처럼 쉼표로 구분된 값을 출력하거나 진행 상황을 한 줄에 업데이트하는 데 사용할 수 있다.

## 다양한 값 출력

`print()`는 어떤 타입의 값이든 문자열로 변환해 출력한다.

```python
# 다양한 타입 출력
print(42)           # 정수
print(3.14)         # 실수
print(True)         # 불린
print([1, 2, 3])    # 리스트
print({"a": 1})     # 딕셔너리
print(None)         # None

# f-string으로 포매팅
name = "Alice"
age = 30
print(f"이름: {name}, 나이: {age}")
# → 이름: Alice, 나이: 30

# 계산 결과 포함
print(f"2 + 3 = {2 + 3}")
# → 2 + 3 = 5
```

![print()의 다양한 활용](/assets/posts/python-hello-world-code.svg)

## 표준 오류로 출력하기

프로그램에서 오류 메시지는 일반 출력(stdout)이 아닌 표준 오류(stderr)로 내보내는 것이 좋다. 로그 파싱이나 파이프라인 처리 시 분리가 가능하다.

```python
import sys

# 일반 출력 (stdout)
print("정상 처리됨")

# 오류 출력 (stderr)
print("파일을 찾을 수 없음", file=sys.stderr)

# 터미널에서 분리해서 볼 수 있음
# python script.py 2>/dev/null  # stderr 무시
# python script.py 1>/dev/null  # stdout 무시
```

## 진행 바 만들기

`end`와 `flush`를 활용하면 터미널에서 진행 상태를 같은 줄에 업데이트할 수 있다.

```python
import time

for i in range(1, 11):
    print(f"\r진행: {'█' * i}{'░' * (10-i)} {i*10}%", end="", flush=True)
    time.sleep(0.2)

print()  # 마지막 줄바꿈
```

`flush=True`는 출력 버퍼를 즉시 비워서 실시간으로 출력이 나타나게 한다. 버퍼링 때문에 출력이 지연되는 것을 방지한다.

## Python 2와의 차이

이전에 Python 2 코드를 본 적이 있다면 `print "Hello"`라는 형태를 봤을 것이다. Python 2에서 `print`는 함수가 아닌 문(statement)이었다. Python 3에서는 완전히 함수로 바뀌었다. 이것이 Python 2 코드가 Python 3에서 가장 먼저 실패하는 지점이다.

```python
# Python 2 방식 (Python 3에서 SyntaxError)
print "Hello"

# Python 3 방식 (함수 호출)
print("Hello")
```

다음 편에서는 코드에서 설명을 남기는 방법, 주석의 올바른 사용법을 다룬다.

---

**지난 글:** [PEP 8 스타일 가이드: Pythonic한 코드 작성법](/posts/python-pep8-style/)

**다음 글:** [들여쓰기: Python 문법의 핵심](/posts/python-indentation/)

<br>
읽어주셔서 감사합니다. 😊
