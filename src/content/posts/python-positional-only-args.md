---
title: "위치 전용 인수: / 슬래시로 인터페이스 강화하기"
description: "Python 3.8에서 도입된 / 구분자를 사용해 특정 매개변수를 위치로만 전달하도록 강제하는 방법과, 내부 구현 보호 및 이름 충돌 방지 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "위치 전용 인수", "/ 구분자", "Python 3.8", "API 설계"]
featured: false
draft: false
---

[지난 글](/posts/python-keyword-only-args/)에서 `*` 구분자로 키워드 전용 인수를 만드는 방법을 배웠다. 이번에는 그 반대인 `/` 구분자를 다룬다.

## / 구분자란

Python 3.8에서 도입된 **위치 전용 인수(positional-only arguments)**는 `/` 기호를 매개변수 목록에 넣어 선언한다. `/` 앞에 있는 매개변수는 **반드시 위치 인수로만 전달**해야 한다.

```python
def greet(name, /, greeting="Hello"):
    print(f"{greeting}, {name}!")

greet("철수")              # OK — 위치로 전달
greet("철수", "안녕")      # OK
greet(name="철수")         # TypeError! — 이름 사용 불가
```

## 세 구역 체계

`/`와 `*`를 함께 쓰면 매개변수를 세 구역으로 나눌 수 있다.

```python
def f(pos_only, /, normal, *, kw_only):
    print(pos_only, normal, kw_only)
```

![위치 전용 인수: / 구분자 (Python 3.8+)](/assets/posts/python-positional-only-args-syntax.svg)

| 구역 | 범위 | 전달 방식 |
|------|------|-----------|
| 위치 전용 | `/` 이전 | 위치만 |
| 일반 | `/` 이후, `*` 이전 | 위치 또는 키워드 |
| 키워드 전용 | `*` 이후 | 키워드만 |

## 언제 사용하나

### 내부 구현 세부사항 숨기기

매개변수 이름을 공개 API의 일부로 만들고 싶지 않을 때 유용하다. `/` 앞 매개변수는 이름으로 호출할 수 없으므로, 나중에 내부 이름을 바꿔도 호출자 코드가 깨지지 않는다.

```python
def distance(x1, y1, x2, y2, /):
    return ((x2 - x1)**2 + (y2 - y1)**2)**0.5

distance(0, 0, 3, 4)   # 5.0
```

나중에 `x1`을 `ax`로 바꿔도 호출자는 영향을 받지 않는다.

### 매개변수명 충돌 방지

`**kwargs`와 함께 쓸 때 매개변수명과 키워드 인수 이름이 충돌하는 상황을 막는다.

```python
def update(d, /, **kwargs):
    return {**d, **kwargs}

update({"x": 1}, x=99)   # {'x': 99}  — d와 x 충돌 없음
```

`/`가 없으면 `d`가 위치·키워드 양쪽으로 쓰일 수 있어 `**kwargs`에 `d` 키가 들어오면 `TypeError`가 발생한다.

![위치 전용 인수 활용 사례](/assets/posts/python-positional-only-args-code.svg)

## 내장 함수의 / 표기

Python 내장 함수 `help()` 출력에 이미 `/`가 나온다.

```python
help(len)
# len(obj, /)
#   Return the number of items in a container.
```

이는 `len(obj=list1)` 같은 호출을 금지하고, 내부적으로 `obj`라는 이름을 바꿀 자유를 남겨 둔다.

## 정리

| 구분자 | 역할 | Python 버전 |
|--------|------|-------------|
| `/` | 이전 매개변수를 위치 전용으로 | 3.8+ |
| `*` | 이후 매개변수를 키워드 전용으로 | 3.0+ |

두 구분자를 함께 쓰면 인수의 전달 방식을 세밀하게 제어할 수 있어 더 안전한 API를 설계할 수 있다.

---

**지난 글:** [키워드 전용 인수: * 이후 매개변수 강제하기](/posts/python-keyword-only-args/)

**다음 글:** [여러 값 반환하기: 튜플 언패킹과 Python다운 반환](/posts/python-return-multiple/)

<br>
읽어주셔서 감사합니다. 😊
