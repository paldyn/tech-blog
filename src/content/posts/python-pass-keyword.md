---
title: "pass 키워드: 아무것도 하지 않는 것의 역할"
description: "Python pass 키워드의 문법적 역할, 스텁·마커 클래스·예외 무시 패턴, ... (Ellipsis)와 raise NotImplementedError와의 비교, contextlib.suppress 대안을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "pass", "스텁", "NoOp", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-walrus-operator/)에서 `:=` 할당 표현식을 살펴봤다. 이번에는 정반대로 가장 단순한 Python 키워드 — **`pass`** 를 다룬다. `pass`는 문자 그대로 "아무것도 하지 않는다". 그런데 이것이 왜 필요할까?

## pass가 필요한 이유

Python에서 `if`, `for`, `while`, `def`, `class` 등의 블록은 **반드시 하나 이상의 문(statement)** 을 포함해야 한다. 빈 블록은 문법 오류다.

```python
def future_feature():
    # SyntaxError: expected an indented block

if condition:
    # SyntaxError: expected an indented block
```

`pass`는 이 문법 요구 사항을 충족시키는 **아무 일도 하지 않는 문**이다.

```python
def future_feature():
    pass   # 유효한 함수

if condition:
    pass   # 유효한 if 블록
```

## 주요 사용처

### 스텁 함수/메서드

인터페이스를 먼저 설계하고 구현을 나중에 채울 때.

```python
def save_to_database(record):
    pass   # TODO: DB 연결 후 구현

def send_email(recipient, subject, body):
    pass   # TODO: SMTP 연동
```

### 마커(marker) 예외 클래스

메시지가 필요 없고 이름만으로 의미를 전달하는 예외.

```python
class AuthenticationError(Exception):
    pass

class ValidationError(Exception):
    pass

raise AuthenticationError("토큰 만료")
```

`Exception`을 상속하는 것만으로 충분하므로 바디가 없다.

### 추상/인터페이스 메서드 자리 확보

```python
class Shape:
    def area(self):
        pass   # 서브클래스가 구현해야 함

    def perimeter(self):
        pass
```

단, 이 경우 `abc.ABC`와 `@abstractmethod`를 쓰면 서브클래스가 구현하지 않았을 때 오류를 명확히 알려줄 수 있다.

### 예외 묵살

```python
try:
    config = load_config()
except FileNotFoundError:
    pass   # 설정 파일 없으면 기본값 사용
```

![pass 키워드 사용처](/assets/posts/python-pass-keyword-overview.svg)

## pass vs `...` (Ellipsis) vs raise NotImplementedError

세 가지 모두 "빈 블록 채우기"에 사용할 수 있지만 의미가 다르다.

```python
# pass: 완전히 비어있음, 아무 의미 없음
def empty():
    pass

# ...: "아직 구현 안 됨"을 의도적으로 표시, 타입 힌트 관례
def not_yet() -> None:
    ...

# raise: 호출 시 반드시 오류, 서브클래스가 구현하도록 강제
def must_implement(self):
    raise NotImplementedError(f"{type(self).__name__}.method 구현 필요")
```

타이핑 관련 코드(`Protocol`, `TypedDict`, `@overload`)에서는 `...`을 쓰는 게 관례다.

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self, canvas) -> None: ...
    def resize(self, factor: float) -> None: ...
```

## 예외 묵살 대안 — contextlib.suppress

단순 예외 무시라면 `contextlib.suppress`가 더 명확하고 Pythonic하다.

```python
# pass 방식
try:
    os.remove(path)
except FileNotFoundError:
    pass

# suppress 방식 (의도가 더 명확)
from contextlib import suppress
with suppress(FileNotFoundError):
    os.remove(path)
```

![pass 관용 패턴과 대안](/assets/posts/python-pass-keyword-patterns.svg)

## 흔한 실수 — pass 뒤 코드

`pass`는 블록 안에서 다른 코드와 같은 들여쓰기에 위치한다. `pass` 이후 같은 블록 안에 코드를 쓰면 실행된다.

```python
for item in items:
    pass            # 아무것도 안 함
    print(item)     # 이건 실행됨!
```

빈 루프를 의도했다면 `pass` 뒤에 추가 코드를 두지 말자.

## 정리

- `pass` — 문법적으로 블록이 필요하지만 실행할 코드가 없을 때 자리 채움
- 스텁 함수, 마커 예외 클래스, 일시적 빈 블록에 사용
- 추상 메서드엔 `raise NotImplementedError`, 타입 힌트 관례엔 `...`
- 예외 묵살은 `try/except pass` 보다 `contextlib.suppress` 권장

---

**지난 글:** [바다코끼리 연산자 :=: 할당 표현식](/posts/python-walrus-operator/)

**다음 글:** [루프 함정: Python 루프에서 흔히 만나는 버그와 해결책](/posts/python-loop-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
