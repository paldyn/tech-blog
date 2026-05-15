---
title: "위치 인수와 키워드 인수: Python 인수 전달 방식의 기본"
description: "함수 호출 시 인수를 순서로 전달하는 위치 인수와 이름으로 전달하는 키워드 인수의 차이, 혼합 규칙, 실수 방지법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "위치 인수", "키워드 인수", "인수 전달"]
featured: false
draft: false
---

[지난 글](/posts/python-function-def/)에서 `def` 키워드로 함수를 정의하는 방법을 배웠다. 이번에는 함수를 **호출**할 때 인수를 어떻게 전달하는지, 두 가지 방식의 차이와 혼합 규칙을 살펴본다.

## 두 가지 인수 전달 방식

Python에서 함수에 인수를 전달하는 방법은 두 가지다.

```python
def connect(host, port, timeout):
    print(f"연결: {host}:{port} (제한시간 {timeout}s)")
```

**위치 인수(positional argument)**: 순서로 매핑된다.

```python
connect("db.server.com", 5432, 30)
# host="db.server.com", port=5432, timeout=30
```

**키워드 인수(keyword argument)**: 이름으로 매핑된다.

```python
connect(host="db.server.com", port=5432, timeout=30)
connect(timeout=30, host="db.server.com", port=5432)  # 순서 무관
```

![위치 인수 vs 키워드 인수](/assets/posts/python-positional-keyword-args-diagram.svg)

## 혼합 규칙

위치 인수와 키워드 인수를 함께 쓸 수 있다. 단, **위치 인수는 키워드 인수 앞에** 와야 한다.

```python
# 앞쪽 인수를 위치로, 나머지를 키워드로
connect("db.server.com", port=5432, timeout=30)   # OK
connect("db.server.com", 5432, timeout=30)         # OK
```

키워드 인수 뒤에 위치 인수가 오면 `SyntaxError`다.

```python
connect(host="db.server.com", 5432, 30)   # SyntaxError!
```

같은 매개변수를 위치와 키워드로 중복 지정해도 `TypeError`가 발생한다.

```python
connect("db.server.com", host="db.server.com")
# TypeError: connect() got multiple values for argument 'host'
```

![혼합 호출과 규칙](/assets/posts/python-positional-keyword-args-code.svg)

## 키워드 인수를 써야 할 때

인수 개수가 많거나 타입이 비슷한 경우 키워드 인수를 쓰면 오류를 줄인다.

```python
def create_user(name, age, email, role="user"):
    pass

# 위치 인수 — 순서 실수 위험
create_user("철수", 25, "cs@example.com")

# 키워드 인수 — 의도가 명확
create_user(name="철수", age=25, email="cs@example.com")
```

`bool` 인수가 여러 개 있을 때도 키워드 인수가 빛난다.

```python
def render(text, bold=False, italic=False, underline=False):
    pass

# 위치 인수 — True/False 나열은 의미 불분명
render("Hello", True, False, True)

# 키워드 인수 — 의도 명확
render("Hello", bold=True, underline=True)
```

## 기본값이 있는 매개변수와의 조합

기본값 매개변수는 호출 시 생략하거나 키워드로 지정할 수 있다.

```python
def log(message, level="INFO", timestamp=True):
    prefix = f"[{level}]" if timestamp else ""
    print(prefix, message)

log("서버 시작")                        # [INFO] 서버 시작
log("디스크 경고", level="WARNING")    # [WARNING] 디스크 경고
log("에러!", "ERROR", False)           # 위치로도 가능
```

## 인수 언패킹 — * 와 **

시퀀스 앞에 `*`를 붙이면 위치 인수로 풀어서 전달하고, 딕셔너리 앞에 `**`를 붙이면 키워드 인수로 풀어서 전달한다.

```python
args = ("db.server.com", 5432, 30)
connect(*args)           # connect("db.server.com", 5432, 30) 과 동일

kwargs = {"host": "db.server.com", "port": 5432, "timeout": 30}
connect(**kwargs)        # connect(host=..., port=..., timeout=...) 과 동일
```

## 정리

| 방식 | 결정 기준 | 장단점 |
|------|-----------|--------|
| 위치 인수 | 순서 | 간결, 순서 실수 위험 |
| 키워드 인수 | 이름 | 명확, 순서 무관 |

키워드 인수를 적극 활용하면 API 가독성과 안전성이 높아진다.

---

**지난 글:** [Python 함수 정의: def 키워드로 코드를 묶다](/posts/python-function-def/)

**다음 글:** [기본 인수의 함정: 가변 객체를 기본값으로 쓰면 안 되는 이유](/posts/python-default-args-pitfall/)

<br>
읽어주셔서 감사합니다. 😊
