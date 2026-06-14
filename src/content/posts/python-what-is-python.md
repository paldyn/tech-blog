---
title: "Python이란 무엇인가? 언어의 본질을 파악하다"
description: "Python의 핵심 특징과 강점을 소개합니다. 인터프리터 언어, 동적 타이핑, 범용성, 가독성을 코드와 함께 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "입문", "프로그래밍언어", "인터프리터", "동적타이핑"]
featured: false
draft: false
---

Python은 현재 세계에서 가장 많이 사용되는 프로그래밍 언어 중 하나다. TIOBE 지수, Stack Overflow 설문, GitHub 통계 모두 Python을 최상위권에 올려두고 있다. 웹 개발자도, 데이터 과학자도, AI 연구자도, 자동화 스크립트를 짜는 DevOps 엔지니어도 Python을 쓴다. 이 시리즈는 Python을 완전히 정복하기 위한 여정이다. 첫 편인 지금은 "Python이 도대체 무엇인가"라는 근본적인 질문에서 출발한다.

## Python: 한 문장으로 정의하면

Python은 **범용(general-purpose) 인터프리터(interpreted) 언어**다. 이 두 단어를 하나씩 뜯어보자.

**범용**이라는 말은 특정 목적에 국한되지 않는다는 뜻이다. SQL은 데이터베이스 조회에 특화되어 있고, HTML은 웹 문서 마크업용이다. Python은 그런 제약이 없다. 웹 서버를 만들 수도 있고, 기계학습 모델을 훈련시킬 수도 있고, 파일 수천 개를 자동으로 정리하는 스크립트도 짤 수 있다.

**인터프리터**라는 말은 코드를 실행하는 방식을 가리킨다. C나 Go 같은 컴파일 언어는 소스 코드를 미리 기계어로 변환해두어야 실행할 수 있다. Python은 다르다. 소스 파일을 그대로 Python 인터프리터에게 넘기면 한 줄씩 읽고 즉시 실행해준다. 덕분에 개발 중에 코드를 조금 수정하고 바로 결과를 확인하는 피드백 루프가 매우 짧다.

## 네 가지 핵심 특징

![Python 핵심 특징](/assets/posts/python-what-is-python-overview.svg)

### 1. 인터프리터 언어

Python 코드는 컴파일 없이 실행된다. 터미널에서 `python hello.py`를 치면 그 순간 인터프리터가 파일을 읽기 시작한다. 내부적으로는 바이트코드로 컴파일하는 중간 과정이 존재하지만 (`__pycache__/*.pyc`), 개발자 입장에서는 보이지 않는다. 덕분에 코드를 짜고, 실행하고, 수정하는 사이클이 매우 빠르다. REPL(Read-Eval-Print Loop)이라는 대화식 셸도 이 특징 덕분에 존재한다. `python` 명령 하나로 터미널에서 코드를 한 줄씩 치면서 즉각적으로 결과를 볼 수 있다.

### 2. 동적 타이핑

Java나 C++에서는 변수를 선언할 때 타입을 명시해야 한다. `int count = 0;` 처럼. Python에서는 그냥 `count = 0`이다. 타입을 적지 않아도 된다. Python이 실행 시점에 `0`이라는 값을 보고 이것이 정수(`int`)임을 스스로 파악한다. 이 방식을 **동적 타이핑(dynamic typing)**이라 부른다.

```python
x = 42          # int
x = "hello"     # 이제 str로 바뀐다, 오류 없음
x = [1, 2, 3]   # list도 된다

# type()으로 현재 타입 확인 가능
print(type(x))  # <class 'list'>
```

동적 타이핑은 코드를 빠르게 작성하는 데 도움이 된다. 타입을 일일이 적지 않아도 되고, 변수를 자유롭게 재할당할 수 있다. 단점은 규모가 커질수록 타입 관련 버그가 숨기 쉽다는 것이다. 이를 보완하기 위해 Python 3.5부터 **타입 힌트(type hints)**를 지원한다. 타입을 적어도 되고, 안 적어도 실행은 된다. 선택의 자유다.

### 3. 범용 언어와 풍부한 생태계

Python이 이렇게 많이 쓰이는 이유는 범용성 때문이다. 하나의 언어로 다양한 문제를 해결할 수 있다는 것은 배움의 투자 효율이 높다는 뜻이다.

- **웹 백엔드**: Django, Flask, FastAPI
- **데이터 분석**: pandas, NumPy, SciPy
- **머신러닝 / 딥러닝**: TensorFlow, PyTorch, scikit-learn
- **자동화 / 스크립팅**: os, subprocess, pathlib, shutil
- **API 클라이언트**: requests, httpx
- **CLI 툴**: typer, click, argparse

PyPI(Python Package Index)에는 50만 개 이상의 패키지가 있다. `pip install <패키지명>` 한 줄로 설치된다. 웬만한 기능은 이미 누군가 만들어놓았다.

### 4. 높은 가독성

Python의 설계 철학에서 가독성은 최우선이다. "코드는 쓰는 횟수보다 읽는 횟수가 많다"는 원칙 하에 설계되었다. Python 코드를 처음 보는 사람도 코드의 의도를 어느 정도 파악할 수 있다.

```python
# 다른 언어 경험 없이도 의미가 읽힌다
fruits = ["apple", "banana", "cherry"]

for fruit in fruits:
    if fruit.startswith("b"):
        print(f"B로 시작: {fruit}")

# 출력: B로 시작: banana
```

`for fruit in fruits`는 영어 문장 "fruits 안의 각 fruit에 대해"처럼 읽힌다. 들여쓰기로 블록 구조를 나타내기 때문에 `{}`와 `;` 없이도 코드의 계층 구조가 명확하다.

## Python 활용 분야

![Python 활용 생태계](/assets/posts/python-what-is-python-ecosystem.svg)

Python이 강한 분야는 크게 여섯 가지다.

**웹 개발**: Django는 "배터리 포함(batteries included)"을 표방하는 풀스택 프레임워크다. 인증, ORM, 관리자 페이지가 기본 탑재된다. Flask는 마이크로 프레임워크로 필요한 것만 추가하는 방식이다. FastAPI는 현대적인 async 기반 API 서버를 만드는 데 탁월하다.

**데이터 분석**: pandas는 표 형태의 데이터를 다루는 표준 도구다. Excel처럼 행·열로 데이터를 다루는데, 수천만 행도 처리할 수 있다. NumPy는 수치 배열 연산의 기반이다. pandas 내부도 NumPy로 구현되어 있다.

**AI / 머신러닝**: TensorFlow와 PyTorch는 딥러닝 프레임워크의 양대 산맥이다. scikit-learn은 전통적인 ML 알고리즘(선형 회귀, 랜덤 포레스트, SVM 등)을 표준화된 API로 제공한다. Python이 AI 분야의 표준 언어가 된 이유는 이 생태계 때문이다.

**자동화**: 파일 정리, 이메일 발송, API 호출, 웹 스크래핑(BeautifulSoup, Playwright) 등 반복 작업을 코드로 대체할 때 Python이 첫 번째 선택지가 된다.

**교육**: 전 세계 대학의 CS 101 수업 중 상당수가 Python을 첫 번째 언어로 채택한다. 문법이 간결하고 결과를 바로 볼 수 있어서다.

**임베디드 / IoT**: MicroPython은 마이크로컨트롤러(ESP32, Arduino 호환)에서 Python 서브셋을 실행한다. 라즈베리파이(Raspberry Pi)의 공식 프로그래밍 언어도 Python이다.

## 첫 Python 코드

모든 프로그래밍 언어 학습은 Hello World로 시작하는 전통이 있다. Python은 이렇게 생겼다.

```python
# 가장 간단한 Python 프로그램
print("Hello, World!")
```

이걸 실행하면 터미널에 `Hello, World!`가 출력된다. 이것이 전부다. 클래스도, `public static void main`도, 세미콜론도 필요 없다. Python 철학의 핵심인 "단순함이 복잡함보다 낫다"가 첫 프로그램부터 드러난다.

조금 더 현실적인 코드를 보자.

```python
# 사용자 이름을 받아 인사하는 프로그램
name = input("이름을 입력하세요: ")
age = int(input("나이를 입력하세요: "))

if age >= 18:
    greeting = f"안녕하세요, {name}님! 어른이시군요."
else:
    greeting = f"안녕하세요, {name}님! 아직 미성년자시군요."

print(greeting)
```

이 코드에서 Python의 여러 특징이 한꺼번에 보인다. `input()`으로 사용자 입력을 받고, `int()`로 문자열을 정수로 변환하고, `if/else`로 조건 분기를 하고, f-string으로 문자열 안에 변수를 삽입한다. 모두 이후 편들에서 자세히 다룰 것이다.

## Python을 배우는 올바른 자세

Python은 배우기 쉽다고 알려져 있다. 실제로 다른 언어에 비해 첫 진입 장벽이 낮다. 그러나 "쉽다"는 말이 "깊이가 없다"는 뜻은 아니다. 제너레이터, 데코레이터, 메타클래스, 비동기 프로그래밍, GIL 등 깊은 곳에는 복잡한 개념들이 많다. 이 시리즈는 표면적인 문법 나열에 그치지 않고, 각 개념이 왜 그렇게 설계되었는지, 어떻게 올바르게 사용하는지를 함께 다룬다.

다음 편에서는 Python이 어떻게 탄생했는지, Guido van Rossum이라는 한 사람의 크리스마스 연휴 프로젝트가 어떻게 세계 최대 언어 생태계 중 하나가 되었는지를 살펴볼 것이다.

---

**다음 글:** [Python의 탄생과 역사: Guido에서 3.12까지](/posts/python-history/)

<br>
읽어주셔서 감사합니다. 😊
