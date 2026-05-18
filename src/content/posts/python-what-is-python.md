---
title: "Python이란 무엇인가: 언어의 핵심 개념 이해"
description: "Python이 어떤 언어인지, 왜 배워야 하는지, 핵심 특성과 활용 분야를 초보자 관점에서 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "프로그래밍", "입문", "특성", "활용분야"]
featured: false
draft: false
---

Python은 1991년에 처음 공개된 이후 30년이 넘는 세월 동안 꾸준히 성장해 온 프로그래밍 언어다. 오늘날 인공지능 연구자, 웹 개발자, 데이터 과학자, 학생, 스타트업 창업자가 모두 Python을 쓴다. 이 시리즈는 Python의 기초부터 심화까지 단계적으로 완전히 정복하는 것을 목표로 한다. 첫 번째 글에서는 "Python이란 어떤 언어인가"라는 근본적인 질문에 답한다.

## Python이란 무엇인가

Python은 **범용 고수준 프로그래밍 언어**다. 세 가지 키워드로 요약할 수 있다.

**인터프리터 언어**: 소스 코드를 실행할 때 별도의 컴파일 단계가 필요 없다. `.py` 파일을 작성하고 `python script.py`를 입력하면 바로 실행된다. 물론 내부적으로는 바이트코드로 변환되지만, 개발자가 그 과정을 직접 관리할 필요가 없다.

**동적 타입**: 변수를 선언할 때 타입을 지정하지 않아도 된다. `x = 10`이라고 쓰면 Python이 알아서 정수 타입으로 인식한다. 나중에 같은 변수에 `x = "hello"`라고 쓰면 문자열이 된다. 덕분에 코드가 짧고 빠르게 쓰인다. 반면 타입 오류가 런타임에 드러나기 때문에 테스트가 중요해진다.

**고수준 언어**: 메모리 관리나 포인터 같은 하드웨어 세부 사항을 직접 다루지 않는다. 가비지 컬렉션이 자동으로 메모리를 관리한다.

![Python의 핵심 특성](/assets/posts/python-what-is-python-overview.svg)

## 왜 Python인가

Python이 이렇게 널리 쓰이는 데에는 이유가 있다.

**가독성**: Python의 문법은 의도적으로 영어 산문에 가깝게 설계됐다. 처음 보는 사람도 코드를 읽고 무슨 일을 하는지 짐작할 수 있다. C나 Java로 10줄 걸릴 코드가 Python에서는 3줄이 되는 경우가 흔하다.

**"배터리 포함" 철학**: 표준 라이브러리가 풍부하다. 파일 읽기·쓰기, HTTP 요청, JSON 파싱, 날짜 계산, 정규 표현식 등 흔히 필요한 기능 대부분이 기본 설치에 포함돼 있다. `import json`만 써도 JSON을 자유자재로 다룰 수 있다.

**생태계**: PyPI(Python Package Index)에는 50만 개가 넘는 패키지가 올라와 있다. NumPy, Pandas, TensorFlow, Django, Flask, FastAPI 등 각 분야의 사실상 표준 라이브러리가 모두 Python용으로 제공된다.

**멀티 패러다임**: 절차형으로도, 객체지향으로도, 함수형으로도 쓸 수 있다. 이 유연성이 다양한 문제를 Python 하나로 해결할 수 있게 한다.

## Python의 활용 분야

```python
# 웹 개발 (Django/Flask/FastAPI)
from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

# 데이터 분석 (Pandas)
import pandas as pd
df = pd.read_csv("data.csv")
print(df.describe())

# 자동화 스크립트
import pathlib
for p in pathlib.Path(".").glob("*.txt"):
    print(p.name, p.stat().st_size, "bytes")

# 머신러닝 (scikit-learn)
from sklearn.linear_model import LinearRegression
model = LinearRegression()
model.fit(X_train, y_train)
```

Python이 강세를 보이는 분야는 다양하다. **웹 백엔드**에서는 Django, Flask, FastAPI가 널리 쓰인다. **데이터 과학**에서는 Pandas, NumPy, Matplotlib이 표준 툴킷이다. **인공지능·머신러닝**에서는 TensorFlow, PyTorch, scikit-learn이 Python 생태계를 중심으로 발전했다. **자동화·스크립팅**에서도 Python은 Bash보다 강력하고 Java보다 가볍다.

![Python 코드 한 눈에 보기](/assets/posts/python-what-is-python-code.svg)

## Python의 단점도 알아두자

Python이 항상 최선의 선택은 아니다. 몇 가지 한계가 있다.

**속도**: 인터프리터 언어이기 때문에 C, C++, Rust 같은 컴파일 언어보다 실행 속도가 느리다. 이 문제는 NumPy처럼 핵심 부분을 C로 구현한 라이브러리를 쓰거나, PyPy 같은 JIT 컴파일러를 사용해 완화할 수 있다.

**GIL**: CPython(기본 Python 구현체)에는 GIL(Global Interpreter Lock)이 있어 멀티스레드 CPU 병렬 처리에 제약이 있다. CPU 집약적 작업에는 멀티프로세싱이나 다른 언어와의 연동이 필요할 수 있다. (Python 3.13부터 실험적 GIL 제거 옵션이 도입됐다.)

**모바일/임베디드**: 스마트폰 앱 개발이나 초저사양 임베디드 환경에서는 Python이 어울리지 않는다.

## 어떤 버전을 써야 하나

현재 시점에서는 **Python 3.12 이상**을 사용하는 것을 권장한다. Python 2는 2020년 1월 1일부로 공식 지원이 종료됐다. Python 3.10 이후에는 구조적 패턴 매칭, 더 명확한 에러 메시지, 성능 개선 등 많은 기능이 추가됐다.

```python
# 현재 Python 버전 확인
import sys
print(sys.version)
# 예: 3.12.4 (main, Jun  6 2024, 18:26:44)

print(sys.version_info)
# sys.version_info(major=3, minor=12, micro=4, ...)
```

이 시리즈 전체는 Python 3.10 이상을 기준으로 작성된다. 설치 환경 구성은 이후 편에서 자세히 다룬다. 지금은 "Python이 어떤 언어인가"에 대한 감을 잡는 것이 목표다.

---

**다음 글:** [Python의 역사: Guido van Rossum부터 현재까지](/posts/python-history/)

<br>
읽어주셔서 감사합니다. 😊
