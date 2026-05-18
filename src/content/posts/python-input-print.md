---
title: "input()과 print(): 표준 입출력 완전 정복"
description: "Python의 input()과 print() 함수를 깊이 이해합니다. input()이 항상 문자열을 반환하는 이유, 타입 변환, 안전한 입력 처리 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 11
type: "knowledge"
category: "Python"
tags: ["Python", "input", "print", "표준입출력", "타입변환"]
featured: false
draft: false
---

[지난 글](/posts/python-indentation/)에서 들여쓰기 기반의 블록 구조를 이해했다. 이제 프로그램이 사용자와 실제로 대화하는 방법을 배울 차례다. `input()`과 `print()`는 Python에서 가장 기본적인 입출력 수단이다.

## input(): 사용자 입력 받기

`input()` 함수는 프로그램 실행을 일시 중단하고 사용자가 Enter 키를 누를 때까지 기다린다. 사용자가 입력한 내용을 문자열로 반환한다.

```python
# 기본 사용법
name = input("이름을 입력하세요: ")
print(f"안녕하세요, {name}님!")

# 프롬프트 없이
value = input()  # 빈 프롬프트, 그냥 기다림
```

터미널 실행 결과:

```
이름을 입력하세요: Alice
안녕하세요, Alice님!
```

## input()은 항상 문자열을 반환한다

Python 입문자가 가장 많이 실수하는 지점이다. `input()`은 사용자가 숫자를 입력해도 **항상 `str` 타입**으로 반환한다.

```python
age = input("나이: ")
print(type(age))   # <class 'str'>
print(age + 1)     # TypeError! str + int 불가
```

숫자로 사용하려면 명시적으로 타입을 변환해야 한다.

```python
# int로 변환
age = int(input("나이: "))
print(age + 10)  # 정상 동작

# float으로 변환
price = float(input("가격: "))
print(f"{price:.2f}원")

# 공백으로 구분된 여러 숫자 입력
# "3 5" 입력 시 → ['3', '5']
parts = input("두 수: ").split()
a, b = int(parts[0]), int(parts[1])
print(a + b)

# 한 줄로 표현
a, b = map(int, input("두 수: ").split())
```

`map(int, ...)` 패턴은 경쟁 프로그래밍에서 자주 쓰이는 형태다.

![표준 입출력 흐름](/assets/posts/python-input-print-flow.svg)

## 잘못된 입력 처리

사용자는 예상하지 않은 값을 입력할 수 있다. "나이"를 물었는데 "스물다섯"을 입력하면 `int()` 변환에서 `ValueError`가 발생한다.

```python
# 안전하지 않은 방법
age = int(input("나이: "))  # "abc" 입력 시 프로그램 죽음

# 안전한 방법: try-except
try:
    age = int(input("나이: "))
    print(f"10년 후 나이: {age + 10}")
except ValueError:
    print("숫자를 입력해주세요")

# 반복해서 올바른 입력 받기
while True:
    raw = input("1~10 사이 숫자: ")
    if raw.isdigit() and 1 <= int(raw) <= 10:
        number = int(raw)
        break
    print("잘못된 입력입니다")

print(f"입력한 숫자: {number}")
```

![안전한 input() 패턴](/assets/posts/python-input-print-patterns.svg)

## print() 심화

`print()`의 기본은 이미 Hello, World 편에서 다뤘다. 여기서는 실무에서 유용한 추가 기능을 본다.

```python
# 여러 값을 한 줄에
items = ["사과", "바나나", "딸기"]
print(*items, sep=" | ")  # 언패킹 활용
# → 사과 | 바나나 | 딸기

# 디버깅용 변수명 포함 출력 (Python 3.8+)
x = 42
print(f"{x = }")    # x = 42
print(f"{x + 1 = }") # x + 1 = 43

# 숫자 포매팅
pi = 3.141592653
print(f"{pi:.2f}")      # 3.14
print(f"{pi:.4f}")      # 3.1416
print(f"{1234567:,}")   # 1,234,567 (천 단위 구분)
print(f"{0.15:.2%}")    # 15.00%

# 정렬
print(f"{'왼쪽':<10}|{'가운데':^10}|{'오른쪽':>10}")
# → 왼쪽      |  가운데  |      오른쪽
```

## sys.stdin으로 대용량 입력

일반적인 `input()`은 한 번에 한 줄씩 받는다. 대용량 데이터나 반복적인 입력에서는 `sys.stdin`이 더 빠르다.

```python
import sys

# 경쟁 프로그래밍 등에서 빠른 입력
input = sys.stdin.readline

# 여러 줄 읽기
lines = sys.stdin.read().splitlines()

# 파이프로 데이터를 넘길 때
# echo "hello" | python script.py
for line in sys.stdin:
    print(line.strip().upper())
```

## 실용 예제: 간단한 계산기

`input()`과 `print()`를 활용한 실용적인 예제다.

```python
def calculate():
    print("간단한 계산기 (+, -, *, /)")
    
    while True:
        try:
            a = float(input("첫 번째 수: "))
            op = input("연산자: ")
            b = float(input("두 번째 수: "))
        except ValueError:
            print("올바른 숫자를 입력해주세요")
            continue
        
        if op == "+":
            result = a + b
        elif op == "-":
            result = a - b
        elif op == "*":
            result = a * b
        elif op == "/" and b != 0:
            result = a / b
        elif op == "/" and b == 0:
            print("0으로 나눌 수 없습니다")
            continue
        else:
            print("알 수 없는 연산자")
            continue
        
        print(f"{a} {op} {b} = {result}")
        
        if input("계속? (y/n): ").lower() != "y":
            break

calculate()
```

이 예제는 `input()`과 `print()` 외에도 반복문, 조건문, 예외 처리를 모두 활용한다. 다음 편에서는 이런 간단한 스크립트를 어떻게 파일로 저장하고 실행하는지, REPL과의 차이를 살펴본다.

---

**지난 글:** [들여쓰기: Python 문법의 핵심](/posts/python-indentation/)

**다음 글:** [스크립트 vs REPL: Python 실행 방식의 차이](/posts/python-script-vs-repl/)

<br>
읽어주셔서 감사합니다. 😊
