---
title: "__init__ vs __new__: 객체 생성의 두 단계"
description: "Python 객체 생성 과정에서 __new__와 __init__의 역할 차이, 호출 순서, 싱글턴 패턴과 불변 타입 서브클래스에서의 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["python", "__init__", "__new__", "객체 생성", "싱글턴"]
featured: false
draft: false
---

[지난 글](/posts/python-self-keyword/)에서 `self`가 메서드 호출 시 자동으로 전달되는 원리를 살펴보았습니다. 그렇다면 `Dog("Rex")`를 호출할 때 `self`를 받는 `__init__`이 실행되기 전에는 어떤 일이 일어날까요? Python은 객체 생성을 `__new__`와 `__init__` 두 단계로 나눕니다.

## 생성 과정 전체 흐름

`Dog("Rex")`를 호출하면 다음 순서로 진행됩니다.

1. `type.__call__(Dog, "Rex")` 실행
2. `Dog.__new__(Dog, "Rex")` 호출 — 빈 인스턴스 메모리 할당
3. 반환된 인스턴스가 `Dog`의 인스턴스이면 `__init__` 호출
4. `Dog.__init__(instance, "Rex")` 실행 — 속성 초기화
5. 완성된 인스턴스 반환

```python
class Dog:
    def __new__(cls, name):
        print(f"__new__ called: cls={cls.__name__}")
        instance = super().__new__(cls)
        return instance

    def __init__(self, name):
        print(f"__init__ called: name={name}")
        self.name = name

d = Dog("Rex")
# __new__ called: cls=Dog
# __init__ called: name=Rex
```

`__new__`는 클래스(`cls`)를 첫 번째 인수로 받으며 새 인스턴스를 반환합니다. `__init__`은 인스턴스(`self`)를 받아 속성을 설정하고 `None`을 반환합니다.

## __init__이 호출 안 되는 경우

`__new__`가 해당 클래스의 인스턴스를 반환하지 않으면 `__init__`은 호출되지 않습니다.

```python
class Weird:
    def __new__(cls):
        return 42   # 클래스 인스턴스가 아님

w = Weird()
print(w)        # 42
print(type(w))  # <class 'int'>
# __init__은 실행되지 않음
```

![객체 생성 단계](/assets/posts/python-init-vs-new-flow.svg)

## 싱글턴 패턴

`__new__`를 오버라이드해 같은 인스턴스를 계속 반환하는 싱글턴을 구현할 수 있습니다.

```python
class Singleton:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

a = Singleton()
b = Singleton()
print(a is b)   # True — 같은 인스턴스
```

`super().__new__(cls)`는 `object.__new__(cls)`를 호출해 실제 메모리 할당을 수행합니다. 반드시 호출해야 인스턴스가 생성됩니다.

## 불변 타입 서브클래스

`int`, `str`, `tuple` 같은 불변 타입을 상속받을 때, 값은 `__new__`에서 결정됩니다. `__init__`이 호출될 시점에는 이미 값이 고정되어 있어 변경할 수 없습니다.

```python
class PositiveInt(int):
    def __new__(cls, value):
        if value <= 0:
            raise ValueError("must be positive")
        return super().__new__(cls, value)

x = PositiveInt(5)
print(x + 3)     # 8
print(type(x))   # <class 'PositiveInt'>

PositiveInt(-1)  # ValueError
```

문자열 검증도 같은 원리입니다.

```python
class NonEmptyStr(str):
    def __new__(cls, value):
        if not value.strip():
            raise ValueError("empty string not allowed")
        return super().__new__(cls, value)
```

![불변 타입 서브클래스와 __new__](/assets/posts/python-init-vs-new-immutable.svg)

## __init_subclass__

클래스가 다른 클래스를 상속받을 때 호출되는 훅입니다. 플러그인 레지스트리나 ORM 필드 등록 등에 사용됩니다.

```python
class Plugin:
    _registry = {}

    def __init_subclass__(cls, plugin_name=None, **kwargs):
        super().__init_subclass__(**kwargs)
        if plugin_name:
            Plugin._registry[plugin_name] = cls

class MyPlugin(Plugin, plugin_name="my"):
    pass

print(Plugin._registry)  # {'my': <class 'MyPlugin'>}
```

## 언제 무엇을 사용하나

| 상황 | 사용 |
|---|---|
| 일반적인 초기화, 속성 설정 | `__init__` |
| 싱글턴, 인스턴스 캐시 | `__new__` |
| int/str/tuple 서브클래스 | `__new__` |
| 메타클래스 | `__new__` |
| 서브클래스 등록 | `__init_subclass__` |

대부분의 경우 `__init__`만으로 충분합니다. `__new__`는 특수 목적 코드에만 사용하는 고급 기법입니다.

---

**지난 글:** [self 키워드 완전 이해](/posts/python-self-keyword/)

**다음 글:** [매직 메서드 개요](/posts/python-magic-methods-overview/)

<br>
읽어주셔서 감사합니다. 😊
