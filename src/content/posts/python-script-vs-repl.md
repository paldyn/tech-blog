---
title: "스크립트 vs REPL: Python 실행 방식의 차이"
description: "Python 코드를 실행하는 두 가지 방식, 스크립트 파일과 REPL을 비교합니다. 언제 무엇을 써야 하는지, if __name__ == '__main__' 관용구도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 12
type: "knowledge"
category: "Python"
tags: ["Python", "스크립트", "REPL", "__name__", "실행방식"]
featured: false
draft: false
---

[지난 글](/posts/python-input-print/)에서 `input()`과 `print()`로 사용자와 대화하는 방법을 배웠다. 이 코드를 실제로 어디에 작성하고 어떻게 실행하는지를 이제 제대로 이해해 보자. Python에는 크게 두 가지 실행 방식이 있다.

## REPL: 즉각적인 피드백

**REPL**은 Read-Eval-Print Loop의 약자다. 코드를 입력하면 즉시 실행하고 결과를 보여준다.

```bash
$ python3
Python 3.12.4 (main, ...)
>>> 
```

`>>>` 프롬프트가 보이면 REPL이 시작된 것이다. 코드를 한 줄씩 입력한다.

```python
>>> 2 + 3
5
>>> "hello".upper()
'HELLO'
>>> [x**2 for x in range(5)]
[0, 1, 4, 9, 16]
>>> import math
>>> math.pi
3.141592653589793
```

REPL의 특징은 표현식의 값이 자동으로 출력된다는 것이다. 스크립트에서는 `print()`를 써야 하지만 REPL에서는 표현식만 입력해도 결과가 보인다. 이것이 탐색과 실험에 REPL이 유용한 이유다.

```python
# REPL: print 없어도 값이 출력됨
>>> x = [1, 2, 3]
>>> x            # 자동으로 repr 출력
[1, 2, 3]

# 여러 줄 코드
>>> def square(n):
...     return n ** 2
...
>>> square(7)
49
```

## 스크립트 파일: 저장하고 재사용

REPL에서 작성한 코드는 세션을 닫으면 사라진다. 재사용하려면 파일에 저장해야 한다.

`hello.py` 파일 생성:

```python
# hello.py
name = input("이름: ")
print(f"안녕하세요, {name}님!")
```

실행:

```bash
$ python hello.py
이름: Alice
안녕하세요, Alice님!
```

스크립트는 위에서 아래로 한 번에 실행된다. REPL처럼 한 줄씩 기다리지 않는다.

![스크립트 vs REPL 비교](/assets/posts/python-script-vs-repl-compare.svg)

## if \_\_name\_\_ == "\_\_main\_\_"

Python 스크립트를 작성할 때 자주 보이는 관용구가 있다.

```python
# calculator.py
def add(a, b):
    return a + b

def main():
    x = int(input("첫 번째 수: "))
    y = int(input("두 번째 수: "))
    print(f"합계: {add(x, y)}")

if __name__ == "__main__":
    main()
```

`__name__`은 Python이 자동으로 설정하는 특별한 변수다.

- 파일이 **직접 실행될 때**: `__name__` = `"__main__"`
- 파일이 **다른 모듈에서 임포트될 때**: `__name__` = 파일명(모듈명)

```bash
# 직접 실행
$ python calculator.py  # __name__ == "__main__" → main() 실행

# 다른 파일에서 임포트
# from calculator import add → __name__ == "calculator" → main() 실행 안 됨
```

이 구분이 왜 중요한가? `add()` 함수를 다른 파일에서 재사용하고 싶다면, 파일을 임포트할 때 `main()`이 자동으로 실행되면 곤란하다. `if __name__ == "__main__":` 가드가 이를 방지한다.

```python
# utils.py (라이브러리 용도)
def format_name(first, last):
    return f"{last} {first}"

# 단독 실행 시 테스트
if __name__ == "__main__":
    print(format_name("길동", "홍"))  # → 홍 길동
```

![스크립트 파일 구조](/assets/posts/python-script-vs-repl-code.svg)

## 더 강력한 REPL: IPython과 Jupyter

표준 REPL보다 기능이 강화된 도구들이 있다.

**IPython**: 문법 하이라이팅, 자동완성, 매직 명령어(`%timeit`, `%run` 등), 히스토리 검색을 제공하는 고급 REPL이다.

```bash
pip install ipython
ipython

In [1]: import numpy as np
In [2]: %timeit np.random.rand(1000)
# 실행 시간 자동 측정

In [3]: ?str.split  # 도움말 바로 표시
```

**Jupyter Notebook**: 코드, 텍스트, 그래프를 하나의 문서에 담을 수 있는 웹 기반 환경이다. 데이터 과학 분야에서 사실상 표준이다.

```bash
pip install jupyter
jupyter notebook  # 브라우저에서 열림
```

## 커맨드라인에서 짧은 코드 실행

파일을 만들지 않고 짧은 코드를 바로 실행할 수도 있다.

```bash
# -c 옵션으로 한 줄 실행
python -c "print('Hello')"
python -c "import sys; print(sys.version)"

# 파이프로 연결
echo "hello world" | python -c "import sys; print(sys.stdin.read().upper())"

# 모듈을 스크립트로 실행 (-m 옵션)
python -m http.server 8080        # 간단한 HTTP 서버
python -m json.tool data.json     # JSON 포매팅
python -m venv .venv              # 가상환경 생성
```

## 언제 무엇을 쓸까

**REPL 사용 시점**:
- 새로운 라이브러리 함수를 탐색할 때
- 짧은 계산이나 변환을 빠르게 확인할 때
- 코드 동작 방식을 실험할 때

**스크립트 파일 사용 시점**:
- 반복적으로 실행해야 하는 코드
- 팀과 공유하거나 버전 관리가 필요한 코드
- 큰 프로그램의 일부를 구성할 때

실무에서 자주 쓰이는 패턴은 먼저 REPL에서 아이디어를 탐색하고, 검증된 코드를 스크립트 파일로 옮기는 것이다. 두 도구의 장점을 상황에 맞게 활용하는 것이 효율적이다.

---

**지난 글:** [input()과 print(): 표준 입출력 완전 정복](/posts/python-input-print/)

<br>
읽어주셔서 감사합니다. 😊
