---
title: "이름 맹글링과 private 네임: _, __ 접두사 완전 정리"
description: "Python 이름 맹글링(__name → _ClassName__name), 단일 언더스코어 관례, 던더 메서드(__name__), 임시 변수(_) 등 네이밍 규약을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["python", "이름맹글링", "name mangling", "_언더스코어", "__private", "던더", "네이밍"]
featured: false
draft: false
---

[지난 글](/posts/python-conditional-import/)에서 조건부 임포트를 살펴봤습니다. 이번에는 모듈 시스템의 마지막 주제로, Python의 **이름 규약**을 정리합니다. `_name`, `__name`, `__name__` — 언더스코어 개수에 따라 의미가 달라지는 이 규약들과, 그중 하나인 **이름 맹글링(name mangling)**이 실제로 어떻게 동작하는지 알아봅니다.

## 네 가지 이름 패턴

Python에는 접근 제어 키워드(`private`, `protected`)가 없습니다. 대신 이름 규약으로 의도를 표현합니다.

![이름 규약 요약표](/assets/posts/python-private-name-mangling-dunder.svg)

### 1. name — 공개 (public)

아무 접두사 없는 이름은 공개 인터페이스입니다. 누구나 접근하고 사용해야 합니다.

```python
class Stack:
    def push(self, item): ...  # 공개 메서드
    def pop(self): ...          # 공개 메서드
```

### 2. _name — 내부용 관례

언더스코어 하나는 "내부 구현 세부사항, 외부에서 의존하지 마세요"라는 약속입니다. 언어 차원의 강제는 없습니다.

```python
class Parser:
    def _tokenize(self, text): ...  # 내부 메서드
    def _internal_state(self): ...  # 직접 접근 말 것
```

`from module import *` 시 `_`로 시작하는 이름은 기본적으로 제외됩니다(`__all__`이 없을 때).

### 3. __name — 이름 맹글링

이중 언더스코어로 시작하고 끝이 언더스코어 1개 이하인 이름은 **컴파일 타임에 이름이 변환**됩니다.

```python
class MyClass:
    def __init__(self):
        self.__secret = 42      # _MyClass__secret 으로 저장됨
        self.__method_data = [] # _MyClass__method_data 로 저장됨
```

```python
obj = MyClass()
obj.__secret          # AttributeError!
obj._MyClass__secret  # 42 (맹글링된 이름으로 접근 가능)
```

![이름 맹글링 개요](/assets/posts/python-private-name-mangling-overview.svg)

## 이름 맹글링의 진짜 목적

`__name`이 "접근을 막는다"고 이해하면 반은 맞고 반은 틀립니다. 맹글링의 실제 목적은 **서브클래스에서의 이름 충돌 방지**입니다.

```python
class Base:
    def __init__(self):
        self.__value = 1  # _Base__value

class Child(Base):
    def __init__(self):
        super().__init__()
        self.__value = 99  # _Child__value (다른 이름!)

obj = Child()
print(obj._Base__value)   # 1  (부모 클래스의 것)
print(obj._Child__value)  # 99 (자식 클래스의 것)
```

`self.__value`가 두 클래스에서 다른 이름으로 저장되므로 서로 덮어쓰지 않습니다. 프레임워크를 설계할 때 "서브클래스가 절대 건드리지 말아야 할" 내부 상태를 보호하는 용도입니다.

일반 애플리케이션 코드에서는 `__name`을 남용하지 않는 것이 좋습니다. 대부분의 경우 `_name` 관례로 충분합니다.

### 4. __name__ — 던더(dunder) 메서드

앞뒤로 언더스코어 두 개씩이면 Python 언어 프로토콜에서 정의한 **매직 메서드**입니다. 이름 맹글링이 적용되지 않습니다.

```python
class Vector:
    def __init__(self, x, y):  # 생성자
        self.x, self.y = x, y

    def __add__(self, other):  # + 연산자
        return Vector(self.x + other.x, self.y + other.y)

    def __repr__(self):         # repr()
        return f"Vector({self.x}, {self.y})"
```

사용자 정의 클래스에서 `__dunder__` 이름을 새로 만드는 것은 금지 사항은 아니지만, Python 미래 버전과 충돌할 수 있어 권장하지 않습니다.

### 5. _ (단독) — 임시/무시 변수

의미 없는 값을 받아야 할 때 쓰는 관례입니다. REPL에서는 마지막 표현식 결과를 가리킵니다.

```python
# 루프 카운터 무시
for _ in range(5):
    print("hello")

# 언패킹 중 불필요한 값 무시
first, *_, last = [1, 2, 3, 4, 5]
x, _ = (10, 20)  # 두 번째 값 무시

# 국제화(i18n) 관례: gettext 별칭
from gettext import gettext as _
message = _("Hello World")
```

## __slots__와 이름 맹글링

`__slots__`에 맹글링되는 이름을 넣으면 맹글링 전 이름으로 선언합니다.

```python
class MyClass:
    __slots__ = ["__value"]  # _MyClass__value 슬롯 생성

    def __init__(self):
        self.__value = 10    # _MyClass__value 에 저장
```

## dir()로 맹글링 확인

클래스나 객체의 속성 목록을 보면 맹글링된 이름을 직접 확인할 수 있습니다.

```python
class Example:
    def __init__(self):
        self._internal = 1
        self.__mangled = 2

e = Example()
print([a for a in dir(e) if "internal" in a or "mangled" in a])
# ['_Example__mangled', '_internal']
```

## 정리

| 패턴 | 언제 쓰나 |
|---|---|
| `name` | 공개 인터페이스 — 항상 기본 |
| `_name` | 내부 구현, 외부 의존 금지 관례 |
| `__name` | 서브클래스 이름 충돌 방지 필요할 때만 |
| `__name__` | Python 프로토콜 구현 (직접 만들지 말 것) |
| `_` | 임시 변수, 무시 값 |

Python은 완전한 접근 차단 대신 이름 규약으로 의도를 표현합니다. 팀 코드에서는 `_name`을 일관되게 쓰고, `__name` 맹글링은 프레임워크·라이브러리 수준에서 꼭 필요한 경우에만 사용하는 것이 좋습니다.

---

**지난 글:** [조건부 임포트](/posts/python-conditional-import/)

<br>
읽어주셔서 감사합니다. 😊
