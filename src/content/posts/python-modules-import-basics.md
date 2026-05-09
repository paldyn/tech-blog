---
title: "모듈과 import: 코드를 나누고 재사용하는 방법"
description: "Python 모듈의 개념과 import 문법을 설명합니다. import, from...import, as 별칭 사용법과 직접 모듈을 작성하는 방법까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "모듈", "import", "패키지", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-script-vs-repl/)에서 스크립트 파일로 코드를 실행하는 방법을 살펴봤다. 코드가 길어지면 한 파일에 모든 것을 넣는 것은 한계가 있다. **모듈(module)**은 Python 코드를 파일 단위로 나누어 재사용하는 방법이다.

## 모듈이란

모듈은 파이썬 코드가 담긴 `.py` 파일 하나다. 함수, 클래스, 변수를 정의해두면 다른 파일에서 `import`로 불러와 사용할 수 있다. Python 생태계는 이 모듈 시스템 위에 모든 것이 쌓여 있다.

모듈은 세 가지로 분류된다.

- **표준 라이브러리**: Python 설치 시 포함 (`math`, `os`, `json`, `datetime` 등)
- **서드파티**: `pip`로 설치하는 외부 패키지 (`numpy`, `requests`, `django` 등)
- **직접 작성**: 프로젝트 안에 만든 `.py` 파일

## import 문법 5가지 패턴

### ① 모듈 전체 임포트

가장 기본적인 형태다. 모듈 이름을 네임스페이스로 사용해야 한다.

```python
import math
print(math.sqrt(16))   # 4.0
print(math.pi)         # 3.141592653589793
```

이 방식의 장점은 `math.` 접두사로 어디서 온 함수인지 명확하게 알 수 있다는 점이다.

### ② from...import — 특정 이름만 가져오기

```python
from math import sqrt, pi
print(sqrt(25))    # 5.0  — math. 없이 바로 사용
print(pi)          # 3.141592653589793
```

자주 쓰는 함수를 짧게 참조할 수 있지만, 이름 충돌에 주의해야 한다.

### ③ as — 별칭 사용

긴 모듈 이름에 짧은 별칭을 붙인다. 데이터 과학 생태계에서 관례적으로 자주 쓰인다.

```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

arr = np.array([1, 2, 3])
```

### ④ 여러 이름 임포트

```python
from os.path import join, exists, dirname

path = join("/home", "user", "file.txt")
print(exists(path))
```

줄이 길어지면 괄호로 여러 줄에 나눠 쓸 수 있다.

```python
from os.path import (
    join,
    exists,
    dirname,
    basename,
)
```

### ⑤ * 임포트 — 사용하지 않는 것이 좋다

```python
from math import *   # 권장하지 않음
```

모듈의 모든 이름을 현재 네임스페이스로 가져온다. 어떤 이름이 어디서 왔는지 추적하기 어렵고, 기존 이름과 충돌할 위험이 있다.

![import 문법 5가지 패턴](/assets/posts/python-modules-import-basics-syntax.svg)

## 직접 모듈 작성하기

`mymodule.py` 파일을 만들고 함수, 클래스, 변수를 정의하면 곧 하나의 모듈이 된다.

```python
# mymodule.py
PI = 3.14159

def add(a, b):
    return a + b

class Greeter:
    def hello(self, name):
        return f"안녕, {name}!"

if __name__ == "__main__":
    print(add(1, 2))
```

같은 디렉터리에 있는 `main.py`에서 임포트한다.

```python
# main.py
import mymodule

print(mymodule.PI)           # 3.14159
print(mymodule.add(3, 4))    # 7
g = mymodule.Greeter()
print(g.hello("파이썬"))     # 안녕, 파이썬!
```

`if __name__ == "__main__":` 블록은 `mymodule.py`를 직접 실행할 때만 동작한다. 임포트 시에는 실행되지 않는다.

![모듈 작성 → 임포트 흐름](/assets/posts/python-modules-import-basics-structure.svg)

## import 내부 동작

`import mymodule`을 처음 실행하면 Python은 다음을 수행한다.

1. `sys.path`의 경로 목록을 순서대로 탐색해 `mymodule.py`를 찾는다.
2. 파일의 코드를 실행해 모듈 객체를 생성한다.
3. `sys.modules["mymodule"]`에 저장한다(캐시).
4. 두 번째 `import`부터는 캐시에서 바로 반환한다.

```python
import sys
import math

print("math" in sys.modules)   # True — 이미 캐시됨
```

## 표준 라이브러리 자주 쓰는 모듈

| 모듈 | 용도 |
|------|------|
| `math` | 수학 함수, 상수 |
| `os` | 운영체제 인터페이스 |
| `sys` | Python 인터프리터 정보 |
| `json` | JSON 직렬화/역직렬화 |
| `datetime` | 날짜·시간 처리 |
| `random` | 난수 생성 |
| `re` | 정규 표현식 |
| `collections` | 고급 자료구조 |

## 흔한 실수

**ModuleNotFoundError**: 설치되지 않은 서드파티 모듈을 임포트할 때 발생한다. `pip install 패키지명`으로 설치한다.

```python
import requests   # pip install requests 필요
```

**이름 충돌**: 내가 만든 파일 이름이 표준 라이브러리와 같으면 문제가 생긴다. 예를 들어 `random.py`라는 파일을 직접 만들면 표준 라이브러리 `random`을 가린다.

```bash
# 절대 피할 것
touch random.py    # 표준 라이브러리 random을 가림
```

---

**지난 글:** [스크립트 vs REPL: Python 실행 방식의 차이](/posts/python-script-vs-repl/)

**다음 글:** [셔뱅(Shebang)과 스크립트 실행](/posts/python-shebang-execution/)

<br>
읽어주셔서 감사합니다. 😊
