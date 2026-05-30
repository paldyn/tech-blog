---
title: "Union과 Optional: 여러 타입을 허용하기"
description: "Union, 파이프 신문법, Optional의 정확한 의미와 타입 좁히기(narrowing)까지, 여러 타입을 안전하게 다루는 법을 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Union", "Optional", "타입좁히기", "타입힌트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-generics/)에서 제네릭으로 타입을 흘려보내는 법을 배웠다. 현실의 함수는 종종 "정수 아니면 문자열", "값 아니면 None"처럼 여러 타입을 받는다. 파이썬에서 이 "여러 타입 중 하나"를 표현하는 도구가 `Union`이고, 그중에서도 가장 흔한 "None일 수도 있음"을 위한 약칭이 `Optional`이다.

## Union: 여러 타입 중 하나

`Union[A, B]`는 "A 또는 B 타입의 값"을 뜻한다. 함수가 여러 형태의 입력을 받거나, 상황에 따라 다른 타입을 반환할 때 쓴다.

```python
from typing import Union

def to_int(x: Union[int, str]) -> int:
    if isinstance(x, str):
        return int(x)
    return x

to_int(42)     # OK
to_int("42")   # OK
to_int(3.14)   # 오류: float은 허용 안 됨
```

`x`는 정수이거나 문자열이다. 그 외의 타입을 넘기면 검사기가 거부한다.

## 파이프 신문법

파이썬 3.10부터는 `Union` 대신 파이프(`|`)로 더 짧게 쓸 수 있다. import도 필요 없다. 의미는 완전히 동일하다.

```python
def to_int(x: int | str) -> int:
    if isinstance(x, str):
        return int(x)
    return x
```

![Union·Optional·신문법 비교](/assets/posts/python-typing-union-optional-overview.svg)

`int | str`은 `Union[int, str]`과 같다. 최신 코드에서는 이 파이프 문법이 표준으로 자리 잡았다. 가독성이 좋고 타이핑할 글자도 적다.

## Optional의 정확한 의미

`Optional[int]`는 많은 사람이 "선택적 인자", 즉 "안 넘겨도 되는 인자"로 오해한다. 하지만 정확한 의미는 **`int | None`**, 즉 "정수이거나 None일 수 있다"이다. 인자를 생략 가능하게 만드는 것은 기본값(`= None`)이지 `Optional` 자체가 아니다.

```python
from typing import Optional

# 이 둘은 완전히 같다
def f(x: Optional[int]) -> None: ...
def f(x: int | None) -> None: ...

# Optional이라고 자동으로 생략 가능한 게 아니다
def g(x: Optional[int]) -> None: ...
g()        # 오류: x는 여전히 필수 인자
g(None)    # OK
```

생략 가능하게 하려면 기본값을 줘야 한다: `def f(x: int | None = None)`. `Optional`은 "값의 종류"를, 기본값은 "인자의 필수 여부"를 결정한다. 둘은 별개다.

## 타입 좁히기(narrowing)

Union 타입을 받으면 그대로는 각 타입의 메서드를 쓸 수 없다. 검사기가 "둘 중 무엇인지 모르니" 안전한 메서드만 허용하기 때문이다. `isinstance`, `is None` 같은 검사를 통과하면 검사기가 그 블록 안에서 타입을 **좁혀** 준다.

```python
def length(s: str | None) -> int:
    if s is None:
        return 0
    # 이 줄부터 검사기는 s를 str로 좁힌다
    return len(s)

length("hello")   # 5
length(None)      # 0
```

![좁히기(narrowing)로 None 다루기](/assets/posts/python-typing-union-optional-code.svg)

`if s is None:` 블록에서 일찍 반환하면, 그 이후 코드에서 `s`는 자동으로 `str`로 간주된다. 이런 "조기 반환 후 좁히기" 패턴은 None을 다루는 가장 깔끔한 방법이다.

## 좁히기를 돕는 도구들

`isinstance`와 `is None` 외에도 좁히기를 유도하는 방법이 여럿 있다.

```python
from typing import assert_never

def handle(x: int | str | bytes) -> str:
    if isinstance(x, int):
        return str(x)
    elif isinstance(x, str):
        return x
    elif isinstance(x, bytes):
        return x.decode()
    else:
        assert_never(x)  # 모든 경우를 처리했는지 검사기가 확인
```

`assert_never`는 모든 분기를 처리했는지 검사기가 확인하게 해 준다. 나중에 Union에 타입을 추가하면, 처리하지 않은 분기가 있을 때 검사기가 경고를 띄운다. 다음 글에서는 값 자체를 타입으로 고정하는 Literal과 재할당을 막는 Final을 다룬다.

---

**지난 글:** [제네릭: TypeVar와 Generic으로 타입을 재사용하기](/posts/python-typing-generics/)

**다음 글:** [Literal과 Final: 값과 불변을 타입으로 표현하기](/posts/python-typing-literal-final/)

<br>
읽어주셔서 감사합니다. 😊
